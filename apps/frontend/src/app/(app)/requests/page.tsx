// ============================================================
// LEGALIR — Legal Requests List (PART 7)
// ============================================================
// The user's legal requests with their current state. Each row links to
// the detail view where legal transitions can be requested.
// ============================================================

"use client";

import Link from "next/link";
import { useLegalRequests } from "@/hooks/useLegalRequests";
import { IconInfo, IconRefresh, IconAdd, IconArrowBack } from "@/lib/icons";
import { LEGAL_CATEGORY_FA, LEGAL_REQUEST_STATE_FA, type LegalRequestState } from "@legalir/types";

const STATE_TONE: Partial<Record<LegalRequestState, string>> = {
  DRAFT: "bg-neutral-100 text-neutral-600",
  AI_INTAKE: "bg-blue-50 text-blue-700",
  AI_ANALYSIS_READY: "bg-cyan-50 text-cyan-700",
  LAWYER_REQUESTED: "bg-indigo-50 text-indigo-700",
  MATCHING: "bg-violet-50 text-violet-700",
  LAWYER_PROPOSED: "bg-purple-50 text-purple-700",
  LAWYER_SELECTED: "bg-fuchsia-50 text-fuchsia-700",
  WAITING_FOR_ACCEPTANCE: "bg-amber-50 text-amber-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  SCHEDULED: "bg-teal-50 text-teal-700",
  IN_PROGRESS: "bg-sky-50 text-sky-700",
  WAITING_FOR_CLIENT: "bg-orange-50 text-orange-700",
  WAITING_FOR_LAWYER: "bg-orange-50 text-orange-700",
  COMPLETED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
  CLOSED: "bg-neutral-100 text-neutral-500",
};

export default function RequestsPage() {
  const { data: requests, isLoading, isError, refetch } = useLegalRequests();

  return (
    <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-h2 text-on-surface">درخواست‌های حقوقی</h1>
          <p className="text-body-2 text-muted">
            وضعیت درخواست‌های خود را پیگیری کنید و در هر مرحله اقدام بعدی را انجام دهید.
          </p>
        </div>
        <Link
          href="/intake"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-button font-medium text-white transition hover:bg-primary-700 active:scale-[0.98]"
        >
          <IconAdd size={18} />
          درخواست جدید
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-container" />
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-large bg-error/10 p-6 text-center">
          <p className="text-body-1 text-error">خطا در بارگذاری درخواست‌ها</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-body-2 text-primary transition hover:bg-primary/10"
          >
            <IconRefresh size={16} />
            تلاش مجدد
          </button>
        </div>
      )}

      {!isLoading && !isError && (requests?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <IconInfo size={32} className="text-muted" />
          <p className="text-body-1 text-muted">هنوز درخواستی ثبت نکرده‌اید</p>
          <Link href="/intake" className="text-body-2 text-primary hover:underline">
            شروع پرسش‌نامه حقوقی
          </Link>
        </div>
      )}

      {!isLoading && !isError && (requests?.length ?? 0) > 0 && (
        <ul className="space-y-3">
          {requests!.map((r) => (
            <li key={r.id}>
              <Link
                href={`/requests/${r.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-divider/60 bg-surface p-5 transition-all hover:border-primary/40 hover:shadow-elevation-1"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-body-1 font-semibold text-on-surface">{r.title}</h2>
                  <p className="mt-1 text-caption text-muted">
                    {LEGAL_CATEGORY_FA[r.category] ?? r.category}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-caption ${STATE_TONE[r.state] ?? "bg-neutral-100 text-neutral-600"}`}
                >
                  {LEGAL_REQUEST_STATE_FA[r.state]}
                </span>
                <IconArrowBack size={18} className="shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
