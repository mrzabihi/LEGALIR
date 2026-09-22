// ============================================================
// LEGALIR — Lawyer Workspace (PART 24)
// ============================================================
// The lawyer's own dashboard: derived stats, the requests assigned to
// them (their inbox) and the cases those requests produced.
//
// Every number here is derived server-side from real events. A lawyer
// with no assigned work sees zeros — never a fabricated win-rate. A
// non-lawyer (403) is shown an onboarding prompt, not an error.
// ============================================================

"use client";

import Link from "next/link";
import { useLawyerWorkspace } from "@/hooks/useLawyerWorkspace";
import { ApiClientError } from "@/lib/api/errors";
import {
  IconBalance,
  IconInfo,
  IconRefresh,
  IconStar,
  IconCalendar,
  IconArrowBack,
  IconCheckCircle,
  IconWarning,
} from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  LEGAL_CATEGORY_FA,
  LEGAL_REQUEST_STATE_FA,
  LAWYER_VERIFICATION_FA,
  type LegalRequestState,
} from "@legalir/types";

const STATE_TONE: Partial<Record<LegalRequestState, string>> = {
  LAWYER_SELECTED: "bg-fuchsia-50 text-fuchsia-700",
  WAITING_FOR_ACCEPTANCE: "bg-amber-50 text-amber-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  SCHEDULED: "bg-teal-50 text-teal-700",
  IN_PROGRESS: "bg-sky-50 text-sky-700",
  WAITING_FOR_CLIENT: "bg-orange-50 text-orange-700",
  WAITING_FOR_LAWYER: "bg-orange-50 text-orange-700",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-divider/60 bg-surface p-4 text-center">
      <div className={`mb-1 text-h3 ${tone ?? "text-on-surface"}`}>{value}</div>
      <p className="text-caption text-muted">{label}</p>
    </div>
  );
}

export default function LawyerWorkspacePage() {
  const { data, isLoading, isError, error, refetch } = useLawyerWorkspace();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-4 tablet:p-6" dir="rtl">
        <div className="h-64 animate-pulse rounded-2xl bg-surface-container" />
      </div>
    );
  }

  // A non-lawyer gets 403 — this is an onboarding state, not a failure.
  const isForbidden = error instanceof ApiClientError && error.status === 403;

  if (isForbidden) {
    return (
      <div className="mx-auto max-w-3xl p-4 tablet:p-6" dir="rtl">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-divider/60 bg-surface p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <IconBalance size={28} />
          </span>
          <h1 className="text-h3 text-on-surface">میزکار وکیل</h1>
          <p className="max-w-md text-body-2 text-muted">
            این بخش مخصوص حساب‌های وکیل است. برای دسترسی، حساب خود را به نوع «وکیل» تغییر دهید و
            پروفایل حرفه‌ای خود را تکمیل کنید.
          </p>
          <Link
            href="/profile"
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-button font-medium text-white transition hover:bg-primary-700 active:scale-[0.98]"
          >
            تنظیمات حساب
          </Link>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl p-4 tablet:p-6" dir="rtl">
        <div className="flex flex-col items-center gap-3 rounded-large bg-error/10 p-8 text-center">
          <p className="text-body-1 text-error">خطا در بارگذاری میزکار</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-body-2 text-primary transition hover:bg-primary/10"
          >
            <IconRefresh size={16} />
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  const { profile, stats, inbox, cases } = data;
  const perf = stats.performance;

  return (
    <div className="mx-auto max-w-5xl p-4 tablet:p-6" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-2 text-h2 text-on-surface">میزکار وکیل</h1>
          <p className="text-body-2 text-muted">
            درخواست‌های ارجاع‌شده، پرونده‌های در جریان و عملکرد شما — همه بر پایه رویدادهای واقعی.
          </p>
        </div>
        {profile && (
          <div className="flex items-center gap-2">
            <span className="text-body-2 text-on-surface">{profile.fullName}</span>
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption",
                profile.verificationStatus === "VERIFIED"
                  ? "bg-success/10 text-success"
                  : "bg-amber-50 text-amber-700",
              ].join(" ")}
            >
              {profile.verificationStatus === "VERIFIED" && <IconCheckCircle size={14} />}
              {LAWYER_VERIFICATION_FA[profile.verificationStatus]}
            </span>
          </div>
        )}
      </div>

      {/* No profile yet — the workspace is empty but the account is a lawyer */}
      {!profile && (
        <div className="mb-6 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-body-2 text-amber-800">
          <IconWarning size={18} className="mt-0.5 shrink-0" />
          <span>
            هنوز پروفایل وکیل نساخته‌اید. تا زمانی که پروفایل شما تأیید نشود، درخواستی به شما ارجاع
            داده نمی‌شود.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 tablet:grid-cols-4">
        <StatCard label="درخواست فعال" value={toPersianNumber(stats.activeRequests)} />
        <StatCard
          label="نیازمند پاسخ شما"
          value={toPersianNumber(stats.awaitingResponse)}
          tone={stats.awaitingResponse > 0 ? "text-amber-600" : undefined}
        />
        <StatCard label="پرونده در جریان" value={toPersianNumber(stats.activeCases)} />
        <StatCard
          label="مهلت تا ۷ روز آینده"
          value={toPersianNumber(stats.upcomingDeadlines)}
          tone={stats.upcomingDeadlines > 0 ? "text-error" : undefined}
        />
      </div>

      {/* Performance — derived from real events */}
      <div className="mb-6 grid grid-cols-2 gap-3 tablet:grid-cols-4">
        <div className="rounded-2xl border border-divider/60 bg-surface p-4 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-amber-600">
            <IconStar size={18} />
            <span className="text-h3">
              {perf.averageRating !== null ? toPersianNumber(perf.averageRating) : "—"}
            </span>
          </div>
          <p className="text-caption text-muted">
            {perf.reviewCount > 0 ? `${toPersianNumber(perf.reviewCount)} نظر` : "بدون نظر"}
          </p>
        </div>
        <StatCard label="درخواست پذیرفته‌شده" value={toPersianNumber(perf.acceptedRequests)} />
        <StatCard label="پرونده تکمیل‌شده" value={toPersianNumber(perf.completedCases)} />
        <StatCard
          label="میانه زمان پاسخ"
          value={perf.medianResponseMinutes !== null ? `${toPersianNumber(perf.medianResponseMinutes)} د` : "—"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2">
        {/* Inbox */}
        <section className="rounded-2xl border border-divider/60 bg-surface p-5">
          <h2 className="mb-4 text-h3 text-on-surface">صندوق درخواست‌ها</h2>
          {inbox.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <IconInfo size={28} className="text-muted" />
              <p className="text-body-2 text-muted">درخواستی به شما ارجاع نشده است</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {inbox.map((item) => (
                <li key={item.requestId}>
                  <Link
                    href={`/requests/${item.requestId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-divider/60 px-3 py-3 transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-body-2 font-medium text-on-surface">
                          {item.title}
                        </h3>
                        {item.awaitingLawyer && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-caption text-amber-700">
                            نوبت شما
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-caption text-muted">
                        {item.clientName} · {LEGAL_CATEGORY_FA[item.category] ?? item.category}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-caption ${STATE_TONE[item.state] ?? "bg-neutral-100 text-neutral-600"}`}
                    >
                      {LEGAL_REQUEST_STATE_FA[item.state]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Cases */}
        <section className="rounded-2xl border border-divider/60 bg-surface p-5">
          <h2 className="mb-4 text-h3 text-on-surface">پرونده‌های من</h2>
          {cases.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <IconInfo size={28} className="text-muted" />
              <p className="text-body-2 text-muted">هنوز پرونده‌ای ندارید</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {cases.map((c) => (
                <li key={c.caseId}>
                  <Link
                    href={`/cases/${c.caseId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-divider/60 px-3 py-3 transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-body-2 font-medium text-on-surface">{c.title}</h3>
                      <p className="mt-0.5 text-caption text-muted">
                        {LEGAL_CATEGORY_FA[c.category] ?? c.category}
                        {c.openTasks > 0 ? ` · ${toPersianNumber(c.openTasks)} کار باز` : ""}
                      </p>
                      {c.nextDeadlineAt && (
                        <p className="mt-1 inline-flex items-center gap-1 text-caption text-error">
                          <IconCalendar size={13} />
                          مهلت بعدی: {formatDate(c.nextDeadlineAt)}
                        </p>
                      )}
                    </div>
                    <IconArrowBack size={18} className="shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
