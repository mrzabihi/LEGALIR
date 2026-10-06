// ============================================================
// LEGALIR — Admin · Legal Knowledge Inventory
// ============================================================
// The staff surface for the Legal Knowledge Engine. It lists every legal
// source the AI can cite, with:
//
//   • its AUTHORITY TIER (قانون اساسی > قانون > آیین‌نامه > رویه > نظر)
//   • its PROVENANCE (which pass surfaced it, its content hash)
//   • its VERIFICATION STATUS (so unverified content can be found)
//
// Read-only: the knowledge base is seeded from the official law catalog
// and the ingested corpus, so there is no free-form write path.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useMe } from "@/hooks/useDashboard";
import { useKnowledgeInventory } from "@/hooks/useKnowledge";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconShield, IconDocument, IconDatabase, IconHistory } from "@/lib/icons";
import type { KnowledgeInventoryItem } from "@legalir/types";

const TIER_ORDER = [
  "CONSTITUTION",
  "STATUTE",
  "REGULATION",
  "PRECEDENT",
  "OPINION",
  "USER_DOCUMENT",
] as const;

const TIER_CLASS: Record<string, string> = {
  CONSTITUTION: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-700/30",
  STATUTE: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700/30",
  REGULATION: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-700/30",
  PRECEDENT: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/30",
  OPINION: "bg-muted/10 text-muted border-muted/20",
  USER_DOCUMENT: "bg-muted/10 text-muted border-muted/20",
};

const VERIFICATION_FA: Record<string, string> = {
  VERIFIED_OFFICIAL: "تأیید رسمی",
  VERIFIED_SECONDARY: "تأیید ثانویه",
  DEMO_VERIFIED: "تأیید نمایشی",
  UNVERIFIED: "تأییدنشده",
};

const ORIGIN_FA: Record<string, string> = {
  LIBRARY: "کتابخانه حقوقی",
  CATALOG: "فهرست قوانین",
  CORPUS: "پیکره ایندکس‌شده",
};

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-large border border-divider bg-surface p-4">
      <p className="text-caption text-muted">{label}</p>
      <p className="mt-1 text-h3 text-on-surface font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-caption text-muted">{hint}</p>}
    </div>
  );
}

function SourceRow({ item }: { item: KnowledgeInventoryItem }) {
  return (
    <li className="flex flex-col gap-2 bg-surface px-4 py-3 tablet:flex-row tablet:items-center tablet:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-medium ${TIER_CLASS[item.tier] ?? TIER_CLASS['OPINION']}`}>
            {item.tierFa}
          </span>
          <span className="text-body-2 text-on-surface font-medium truncate">{item.title}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
          <span>{item.authority}</span>
          {item.locator && <span className="tabular-nums">{item.locator}</span>}
          <span>{ORIGIN_FA[item.origin] ?? item.origin}</span>
          {item.textHash && (
            <span className="font-mono" dir="ltr" title={item.textHash}>
              {item.textHash.slice(0, 10)}…
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-divider px-2.5 py-0.5 text-caption text-muted">
          {VERIFICATION_FA[item.verificationStatus] ?? item.verificationStatus}
        </span>
        {item.status !== "valid" && (
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-caption text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/30">
            {item.status}
          </span>
        )}
      </div>
    </li>
  );
}

export default function AdminKnowledgePage() {
  const me = useMe();
  const [tier, setTier] = useState<string>("");
  const [verificationStatus, setVerificationStatus] = useState<string>("");

  const role = me.data?.user.role;
  const isStaff = role === "ADMIN" || role === "SUPER_ADMIN" || role === "SUPPORT";

  const query = useKnowledgeInventory({
    tier: tier || undefined,
    verificationStatus: verificationStatus || undefined,
  });

  const data = query.data;

  const tierCounts = useMemo(() => {
    const counts = data?.byTier ?? {};
    return TIER_ORDER.map((t) => ({
      tier: t,
      count: counts[t] ?? 0,
    })).filter((t) => t.count > 0);
  }, [data]);

  if (me.isLoading) {
    return (
      <div className="p-4 tablet:p-6 max-w-4xl mx-auto" dir="rtl">
        <div className="h-8 w-48 rounded-medium bg-surface-container-high skeleton-shimmer" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="p-4 tablet:p-6 max-w-4xl mx-auto" dir="rtl">
        <div className="rounded-large border border-divider bg-surface p-8 text-center">
          <IconShield size={32} className="mx-auto mb-3 text-muted" />
          <p className="text-body-1 text-on-surface font-medium">دسترسی محدود</p>
          <p className="mt-1 text-body-2 text-muted">
            این بخش فقط برای کارکنان پشتیبانی و مدیران در دسترس است.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 tablet:p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-h2 text-onSurface font-bold">پایگاه دانش حقوقی</h1>
        <p className="mt-1 text-body-2 text-muted">
          همه منابعی که هوش مصنوعی می‌تواند به آن‌ها استناد کند — همراه با سطح اعتبار، منشأ و وضعیت تأیید.
        </p>
      </div>

      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 tablet:grid-cols-4 gap-3">
        <StatCard label="کل منابع" value={toPersianNumber(data?.total ?? 0)} />
        <StatCard
          label="بالاترین سطح"
          value={tierCounts[0] ? (data?.items.find((i) => i.tier === tierCounts[0]!.tier)?.tierFa ?? "—") : "—"}
          hint={tierCounts[0] ? `${toPersianNumber(tierCounts[0].count)} منبع` : undefined}
        />
        <StatCard
          label="تأیید رسمی"
          value={toPersianNumber(data?.byStatus["VERIFIED_OFFICIAL"] ?? 0)}
        />
        <StatCard
          label="نیازمند بازبینی"
          value={toPersianNumber(
            (data?.byStatus["UNVERIFIED"] ?? 0) + (data?.byStatus["DEMO_VERIFIED"] ?? 0)
          )}
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTier("")}
          className={`rounded-full border px-3.5 py-1.5 text-caption font-medium transition-colors touch-target-min ${
            tier === ""
              ? "border-primary bg-primary text-on-primary"
              : "border-divider text-muted hover:text-on-surface"
          }`}
        >
          همه سطوح
        </button>
        {TIER_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTier(t)}
            className={`rounded-full border px-3.5 py-1.5 text-caption font-medium transition-colors touch-target-min ${
              tier === t
                ? "border-primary bg-primary text-on-primary"
                : "border-divider text-muted hover:text-on-surface"
            }`}
          >
            {data?.items.find((i) => i.tier === t)?.tierFa ?? t}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-divider" aria-hidden="true" />
        <button
          type="button"
          onClick={() =>
            setVerificationStatus(verificationStatus === "UNVERIFIED" ? "" : "UNVERIFIED")
          }
          className={`rounded-full border px-3.5 py-1.5 text-caption font-medium transition-colors touch-target-min ${
            verificationStatus === "UNVERIFIED"
              ? "border-primary bg-primary text-on-primary"
              : "border-divider text-muted hover:text-on-surface"
          }`}
        >
          تأییدنشده
        </button>
      </div>

      {/* Inventory */}
      {query.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-large bg-surface-container-high skeleton-shimmer" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-large border border-divider bg-surface p-6 text-center">
          <p className="text-body-2 text-muted mb-3">خطا در دریافت پایگاه دانش</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="inline-flex items-center rounded-medium border border-divider px-4 py-2 text-body-2 text-on-surface-variant font-medium hover:bg-surface-hover transition-colors touch-target"
          >
            تلاش مجدد
          </button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-large border border-divider bg-surface p-8 text-center">
          <IconDatabase size={28} className="mx-auto mb-3 text-muted" />
          <p className="text-body-2 text-muted">منبعی با این فیلتر یافت نشد.</p>
        </div>
      ) : (
        <ul className="divide-y divide-divider rounded-large border border-divider overflow-hidden">
          {data.items.map((item) => (
            <SourceRow key={`${item.origin}-${item.id}`} item={item} />
          ))}
        </ul>
      )}

      {/* Legend */}
      <div className="mt-5 rounded-large border border-divider bg-surface p-4">
        <div className="flex items-center gap-2 mb-2">
          <IconHistory size={16} className="text-muted" />
          <p className="text-body-2 text-on-surface font-medium">سلسله‌مراتب اعتبار</p>
        </div>
        <p className="text-caption text-muted leading-relaxed">
          در تعارض میان دو منبع، منبع با اعتبار بالاتر مقدم است:
          قانون اساسی › قانون › آیین‌نامه › رویه قضایی › نظر حقوقی › سند کاربر.
          منابع با تأیید رسمی و وضعیت «معتبر» در رتبه‌بندی بازیابی وزن بیشتری می‌گیرند.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-caption text-muted">
          <span className="inline-flex items-center gap-1.5">
            <IconDocument size={14} /> کتابخانه حقوقی
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconDatabase size={14} /> پیکره ایندکس‌شده (SHA-256)
          </span>
        </div>
      </div>
    </div>
  );
}
