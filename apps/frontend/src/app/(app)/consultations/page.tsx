// ============================================================
// LEGALIR — My consultations (PART 25)
// ============================================================
// The client's canonical list of consultation requests. Each row links to
// the case room where the request can be tracked and, once the lawyer
// accepts, discussed. This is the surface the profile hub and the lawyer
// CTAs funnel into.
// ============================================================

"use client";

import Link from "next/link";
import { useConsultations } from "@/hooks/useConsultations";
import { IconAdd, IconArrowBack, IconInfo, IconRefresh } from "@/lib/icons";
import { LEGAL_CATEGORY_FA } from "@legalir/types";
import { ConsultationStatusBadge, formatDateTime } from "@/components/consultations/consultation-status";

export default function ConsultationsPage() {
  const { data: requests, isLoading, isError, refetch } = useConsultations();

  return (
    <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-h2 text-on-surface">مشاوره‌های من</h1>
          <p className="text-body-2 text-muted">
            درخواست‌های مشاوره خود را پیگیری کنید و پس از پذیرش وکیل، در همین پرونده گفت‌وگو کنید.
          </p>
        </div>
        <Link
          href="/consultations/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-button font-medium text-white transition hover:bg-primary-700 active:scale-[0.98]"
        >
          <IconAdd size={18} />
          مشاوره جدید
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
          <p className="text-body-1 text-error">خطا در بارگذاری مشاوره‌ها</p>
          <button
            type="button"
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
          <p className="text-body-1 text-muted">هنوز درخواست مشاوره‌ای ثبت نکرده‌اید</p>
          <Link href="/consultations/new" className="text-body-2 text-primary hover:underline">
            ثبت درخواست مشاوره با وکیل
          </Link>
        </div>
      )}

      {!isLoading && !isError && (requests?.length ?? 0) > 0 && (
        <ul className="space-y-3">
          {requests!.map((r) => (
            <li key={r.id}>
              <Link
                href={`/consultations/${r.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-divider/60 bg-surface p-5 transition-all hover:border-primary/40 hover:shadow-elevation-1"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-body-1 font-semibold text-on-surface">{r.title}</h2>
                  <p className="mt-1 text-caption text-muted">
                    {LEGAL_CATEGORY_FA[r.category] ?? r.category}
                  </p>
                  <p className="mt-0.5 text-caption text-muted">
                    آخرین به‌روزرسانی: {formatDateTime(r.updatedAt)}
                  </p>
                </div>
                <ConsultationStatusBadge state={r.state} />
                <IconArrowBack size={18} className="shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
