// ============================================================
// LEGALIR — Analytics: Report 6 — platform operations
// ============================================================
// The operational health of the platform, over the SAME resolved range as
// every other tab. Three real surfaces:
//
//   • the request pipeline — the live composition of open legal requests by
//     state-machine state (from `legal_requests`) + window-scoped intake volume
//   • the lawyer review queue — professional profiles by admin decision bucket
//     (from `lawyer_profiles`, demo rows excluded)
//   • the audit trail — the one operational table with a complete, append-only,
//     timestamped history (`admin_audit_log`), so it is the one that is windowed
//
// Nothing here re-slices the sales numbers, and nothing is estimated: a metric
// that cannot be derived (renewal rate, first-response SLA, login failures) is
// listed in `unavailable[]` with its reason, and the UI renders it as an
// explicit «ناموجود» card.
// ============================================================

import type { OperationsReport, OperationsBreakdownRow } from "@legalir/types";
import {
  ACTIVE_LEGAL_REQUEST_STATES,
  LEGAL_REQUEST_STATE_FA,
  LAWYER_DECISION_BUCKETS,
  LAWYER_DECISION_BUCKET_FA,
  lawyerDecisionBucket,
  type LegalRequestState,
  type LawyerDecisionBucket,
} from "@legalir/types";
import { readLegalRequests, readAuditLog, readLawyerProfiles, earliestDataIso } from "./sources";
import { resolveRange, toWindowInfo, withinWindow, changePct, type ResolveRangeInput } from "./range";
import { analyticsDataQuality } from "./quality";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** A one-decimal percentage, or `null` where no honest comparison exists. */
function pct(current: number, previous: number | null): number | null {
  return changePct(current, previous);
}

/** Round to one decimal place (ages/rates read better than raw floats). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Turn a `key → count` tally into breakdown rows sorted most-populous first. */
function breakdown(
  counts: Map<string, number>,
  labelOf: (key: string) => string
): OperationsBreakdownRow[] {
  return [...counts.entries()]
    .map(([key, count]) => ({ key, labelFa: labelOf(key), count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

// Persian labels for the audit actions observed in the trail. An action not
// listed falls back to its raw code so a new action is never hidden — just
// untranslated.
const AUDIT_ACTION_FA: Record<string, string> = {
  "export.download": "دانلود خروجی",
  "lawyer.verify": "بررسی و تأیید وکیل",
  "announcement.create": "ایجاد اعلان",
  "announcement.retract": "بازگردانی اعلان",
  "rag.review.update": "به‌روزرسانی بازبینی دانش",
  "commission.update": "تغییر کمیسیون",
  "user.role.change": "تغییر نقش کاربر",
  "settlement.create": "ایجاد تسویه",
  "settlement.transition": "تغییر وضعیت تسویه",
  "settlement.line.add": "افزودن ردیف تسویه",
  "energy.profile.save": "ذخیرهٔ پروفایل انرژی",
  "energy.admin.adjust": "تعدیل انرژی توسط مدیر",
};

/** Build the operations report for a resolved range. */
export function buildOperationsReport(input: ResolveRangeInput): OperationsReport {
  const resolved = resolveRange(input);
  const window = toWindowInfo(resolved, earliestDataIso());
  const { fromIso, toIso, prevFromIso, prevToIso } = resolved;
  const nowMs = (input.now ?? new Date()).getTime();

  // --- Request pipeline -----------------------------------------------------
  const requests = readLegalRequests();
  const activeSet = new Set<string>(ACTIVE_LEGAL_REQUEST_STATES);
  const open = requests.filter((r) => activeSet.has(r.state));

  const stateCounts = new Map<string, number>();
  for (const r of open) stateCounts.set(r.state, (stateCounts.get(r.state) ?? 0) + 1);
  const byState = breakdown(stateCounts, (k) => LEGAL_REQUEST_STATE_FA[k as LegalRequestState] ?? k);

  const createdCur = requests.filter((r) => withinWindow(r.createdAt, fromIso, toIso)).length;
  const createdPrev = requests.filter((r) =>
    withinWindow(r.createdAt, prevFromIso, prevToIso)
  ).length;
  const createdPrevious = window.comparable ? createdPrev : null;

  // Age of the OPEN requests relative to their last update — a real current
  // snapshot (the only basis available for "how long has this been waiting").
  const avgAgeDays =
    open.length === 0
      ? null
      : round1(
          open.reduce((sum, r) => sum + Math.max(0, nowMs - new Date(r.updatedAt).getTime()), 0) /
            open.length /
            DAY_MS
        );

  // --- Lawyer review queue --------------------------------------------------
  const lawyers = readLawyerProfiles().filter((l) => !l.isDemo);
  const bucketCounts = new Map<string, number>();
  for (const l of lawyers) {
    const b = lawyerDecisionBucket(l.verificationStatus);
    bucketCounts.set(b, (bucketCounts.get(b) ?? 0) + 1);
  }
  const byBucket = LAWYER_DECISION_BUCKETS.map((b) => ({
    key: b,
    labelFa: LAWYER_DECISION_BUCKET_FA[b],
    count: bucketCounts.get(b) ?? 0,
  }));

  // --- Audit trail ----------------------------------------------------------
  const audit = readAuditLog();
  const inWindow = audit.filter((a) => withinWindow(a.createdAt, fromIso, toIso));
  const prevAudit = audit.filter((a) => withinWindow(a.createdAt, prevFromIso, prevToIso));
  const auditCounts = new Map<string, number>();
  for (const a of inWindow) auditCounts.set(a.action, (auditCounts.get(a.action) ?? 0) + 1);
  const byAction = breakdown(auditCounts, (k) => AUDIT_ACTION_FA[k] ?? k).slice(0, 8);

  const latestAt =
    audit.length === 0
      ? null
      : audit.reduce((max, a) => (a.createdAt > max ? a.createdAt : max), audit[0]!.createdAt);
  const freshnessHours =
    latestAt == null ? null : round1(Math.max(0, nowMs - new Date(latestAt).getTime()) / HOUR_MS);

  const prevEntries = window.comparable ? prevAudit.length : null;

  return {
    window,
    requests: {
      totalNow: requests.length,
      openNow: open.length,
      byState,
      created: {
        current: createdCur,
        previous: createdPrevious,
        changePct: pct(createdCur, createdPrevious),
      },
      avgAgeDays,
      snapshotNoteFa:
        "ترکیب وضعیت درخواست‌ها و صف بررسی وکلا یک تصویر «لحظه‌ای» است (وضعیت فعلی)، نه محدود به بازهٔ انتخابی.",
    },
    lawyerQueue: {
      totalNow: lawyers.length,
      byBucket,
      reviewCount: bucketCounts.get("REVIEW" as LawyerDecisionBucket) ?? 0,
      snapshotNoteFa: "پروفایل‌های وکلا بر اساس آخرین تصمیم بررسی دسته‌بندی شده‌اند (تصویر لحظه‌ای).",
    },
    audit: {
      entries: {
        current: inWindow.length,
        previous: prevEntries,
        changePct: pct(inWindow.length, prevEntries),
      },
      successCount: inWindow.filter((a) => a.result === "success").length,
      deniedCount: inWindow.filter((a) => a.result === "denied").length,
      failureCount: inWindow.filter((a) => a.result === "failure").length,
      byAction,
      distinctActors: new Set(inWindow.map((a) => a.actorUserId)).size,
      latestAt,
      freshnessHours,
    },
    unavailable: [
      {
        key: "renewal_rate",
        labelFa: "نرخ تمدید اشتراک",
        reasonFa:
          "رویداد تمدید/انقضای اشتراک به‌صورت جداگانه ثبت نمی‌شود؛ نرخ تمدید از دادهٔ فعلی قابل محاسبه نیست.",
      },
      {
        key: "first_response_sla",
        labelFa: "زمان پاسخ اول وکیل (SLA)",
        reasonFa:
          "بازهٔ «واگذاری به وکیل تا پذیرش» به‌صورت جفت‌زمانی ثبت نمی‌شود؛ بنابراین SLA قابل محاسبه نیست (در عوض «میانگین عمر درخواست‌های باز» نمایش داده می‌شود).",
      },
      {
        key: "login_failures",
        labelFa: "ورودهای ناموفق / رخدادهای امنیتی",
        reasonFa: "تلهمتری ورود ناموفق یا رخداد امنیتی ثبت نمی‌شود؛ بنابراین این شاخص ناموجود است.",
      },
    ],
    quality: analyticsDataQuality(),
  };
}
