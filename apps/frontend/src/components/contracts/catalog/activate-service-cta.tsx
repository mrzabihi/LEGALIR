// ============================================================
// LEGALIR — «Activate this service» CTA
// ============================================================
// The honest activation path for a «به‌زودی» service. It does NOT pretend
// the contract is produced. Instead it files a real *consultation request*
// through the existing legal-requests API (`useCreateConsultation`), with a
// title that names the exact service. The request genuinely lands in the
// user's «مشاوره‌های من» list — nothing is faked.
//
// Once a request for the same service already exists, the CTA switches to a
// confirmation that links straight to it, so the button never creates
// duplicates and never claims success it did not get.

"use client";

import Link from "next/link";
import { useMemo } from "react";
import { snackbar } from "@legalir/ui";
import { useConsultations, useCreateConsultation } from "@/hooks/useConsultations";
import { IconBell, IconCheckCircle, IconArrowBack } from "@/lib/icons";

interface ActivateServiceCtaProps {
  /**
   * The service being requested. Omit for the generic «درخواست قرارداد
   * جدید» fallback shown when a search returns nothing.
   */
  serviceTitle?: string;
}

/** The request title that identifies a service-activation request. */
export function activationRequestTitle(serviceTitle?: string): string {
  return serviceTitle
    ? `درخواست فعال‌سازی خدمت: ${serviceTitle}`
    : "درخواست قرارداد جدید";
}

export function ActivateServiceCta({ serviceTitle }: ActivateServiceCtaProps) {
  const title = activationRequestTitle(serviceTitle);
  const { data: requests } = useConsultations();
  const create = useCreateConsultation();

  const existing = useMemo(
    () => (requests ?? []).find((r) => r.title === title),
    [requests, title]
  );

  const submit = () => {
    create.mutate(
      // `contract` is a supported intake category; the title carries the
      // specific service so the request is unambiguous in the user's list.
      { title, category: "contract" },
      {
        onSuccess: () =>
          snackbar.show({
            message: "درخواست شما ثبت شد. در بخش «مشاوره‌های من» قابل پیگیری است.",
            variant: "success",
          }),
        onError: () =>
          snackbar.show({
            message: "ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید.",
            variant: "error",
          }),
      }
    );
  };

  if (existing) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-large border border-success-200 bg-success-50 p-5 text-center tablet:flex-row tablet:justify-between tablet:text-start">
        <div className="flex items-center gap-3">
          <IconCheckCircle size={24} className="shrink-0 text-success-700" aria-hidden="true" />
          <div>
            <p className="text-body-2 font-medium text-success-700">درخواست شما ثبت شده است</p>
            <p className="text-caption text-success-700/80">
              پس از فعال‌سازی این خدمت، در بخش «مشاوره‌های من» اطلاع‌رسانی می‌شوید.
            </p>
          </div>
        </div>
        <Link
          href="/consultations"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success-200 bg-surface px-4 py-2 text-caption font-medium text-success-700 transition-colors hover:bg-success-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-700/40 touch-target-min"
        >
          مشاهده درخواست‌ها
          <IconArrowBack size={16} aria-hidden="true" className="rtl-flip" />
        </Link>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={create.isPending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-medium bg-primary px-6 py-3 text-button font-medium text-white transition-colors hover:bg-primary-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60 touch-target tablet:w-auto"
    >
      <IconBell size={18} aria-hidden="true" />
      {create.isPending
        ? "در حال ثبت درخواست…"
        : serviceTitle
          ? "وقتی این خدمت فعال شد به من اطلاع بده"
          : "درخواست قرارداد جدید"}
    </button>
  );
}
