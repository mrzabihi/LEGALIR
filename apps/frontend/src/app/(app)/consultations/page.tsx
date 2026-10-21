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
import { Button } from "@legalir/ui";
import { useConsultations } from "@/hooks/useConsultations";
import { IconAdd, IconArrowBack, IconHeadset, IconInfo, IconRefresh } from "@/lib/icons";
import { PageContainer, PageIntroBanner } from "@/components/shared";
import { LEGAL_CATEGORY_FA } from "@legalir/types";
import { ConsultationStatusBadge, formatDateTime } from "@/components/consultations/consultation-status";

export default function ConsultationsPage() {
  const { data: requests, isLoading, isError, refetch } = useConsultations();

  return (
    <PageContainer>
      <PageIntroBanner
        className="mb-6"
        icon={IconHeadset}
        title="مشاوره‌های من"
        description="درخواست‌های مشاوره خود را پیگیری کنید و پس از پذیرش وکیل، در همین پرونده گفت‌وگو کنید."
        actions={
          <Link
            href="/consultations/new"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-medium bg-primary px-4 py-2.5 text-button font-medium text-primary-on transition hover:bg-primary-700 hover:text-white active:scale-[0.98] tablet:w-auto"
          >
            <IconAdd size={18} />
            مشاوره جدید
          </Link>
        }
      />

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-large bg-surface-container" />
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-large bg-error-container p-6 text-center">
          <p className="text-body-1 text-error">خطا در بارگذاری مشاوره‌ها</p>
          <Button
            type="button"
            variant="text"
            size="small"
            onClick={() => refetch()}
            startIcon={<IconRefresh size={16} />}
          >
            تلاش مجدد
          </Button>
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
                className="flex items-center justify-between gap-4 rounded-large border border-divider bg-surface p-5 transition-all hover:border-primary hover:shadow-elevation-1"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-body-1 font-semibold text-on-surface">
                      {r.title}
                    </h2>
                    {/* A consultation routed to this lawyer is marked so it
                        can never be mistaken for one they opened. */}
                    {r.access === "assigned" && (
                      <span className="shrink-0 rounded-full bg-primary-container px-2 py-0.5 text-caption text-primary-on">
                        ارجاع‌شده به شما
                      </span>
                    )}
                  </div>
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
    </PageContainer>
  );
}
