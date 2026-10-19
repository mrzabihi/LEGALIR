// ============================================================
// LEGALIR — /cases entry card (تنظیم دادخواست و شکواییه تخصصی)
// ============================================================
// The drafting service's entry point inside the existing /cases flow.
//
// Everything it renders comes from ONE authenticated endpoint
// (`/api/v1/judicial/card`): the admin-managed title/description/CTA, the
// caller's EFFECTIVE availability (config status AND feature flag AND the
// declared provider requirement) and the caller's own unfinished work.
//
// Three honesty rules this card obeys:
//   • no CTA when the service is not enterable — the wizard would refuse, so
//     the card must not promise otherwise;
//   • a failed fetch degrades to a quiet unavailable note, never a broken
//     page and never a fabricated "active" state;
//   • the footer states outright that this is a draft, not a filing.
// ============================================================

"use client";

import Link from "next/link";
import { buttonClasses } from "@legalir/ui";
import { JUDICIAL_REQUEST_STATUS_FA } from "@legalir/types";
import { IconFilePen, IconInfo, IconRefresh, IconArrowBack } from "@/lib/icons";
import { StatusBadge, type StatusTone } from "@/components/shared";
import { useJudicialCard } from "@/hooks/useJudicial";
import { toPersianDate } from "@/lib/persian-utils";

const STATUS_TONE: Record<string, StatusTone> = {
  available: "success",
  soon: "warning",
  unavailable: "neutral",
};

export function JudicialCasesCard() {
  const { data, isLoading, isError, refetch } = useJudicialCard();

  if (isLoading) {
    return (
      <section
        aria-label="تنظیم دادخواست و شکواییه"
        className="mt-4 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5"
      >
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-56 rounded bg-surface-container" />
          <div className="h-4 w-full max-w-xl rounded bg-surface-container" />
          <div className="h-10 w-44 rounded-full bg-surface-container" />
        </div>
      </section>
    );
  }

  // A failing status endpoint must not take the case list down with it. The
  // card says it could not check availability — it does not claim either way.
  if (isError || !data) {
    return (
      <section className="mt-4 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4">
        <p className="text-body-2 text-on-surface-variant">
          وضعیت «تنظیم دادخواست و شکواییه» در دسترس نیست.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-2 inline-flex items-center gap-1.5 text-labelLarge text-primary hover:underline"
        >
          <IconRefresh size={16} />
          تلاش مجدد
        </button>
      </section>
    );
  }

  const { summary, capabilities } = data;
  const settings = summary.settings;
  const { visible, enabled, statusLabelFa, noteFa } = summary.availability;

  // Hidden by admin on this surface — render nothing at all, but the case
  // list below is untouched.
  if (!visible) return null;

  const latest = summary.latest;

  return (
    <section
      aria-labelledby="judicial-card-title"
      className="mt-4 overflow-hidden rounded-large border border-[color:var(--color-outline-variant)] bg-surface-container-low"
    >
      <div className="flex flex-col gap-4 p-4 tablet:flex-row tablet:items-start tablet:gap-6 tablet:p-5">
        <div
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-primary-container text-primary"
        >
          <IconFilePen size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* The family headline and CTA are fixed by the product: this one
                card starts BOTH families, so it cannot inherit the single
                service row's name. Everything that varies — status, note,
                description, visibility — still comes from the admin row. */}
            <h2 id="judicial-card-title" className="text-titleMedium text-on-surface">
              تنظیم دادخواست و شکواییه تخصصی
            </h2>
            <StatusBadge
              label={statusLabelFa}
              tone={STATUS_TONE[settings.status] ?? "neutral"}
              dot={false}
            />
            {summary.openCount > 0 && (
              <span className="text-labelSmall text-on-surface-variant">
                {summary.openCount.toLocaleString("fa-IR")} درخواست در جریان
              </span>
            )}
          </div>

          <p className="mt-1 max-w-2xl text-body-2 leading-6 text-on-surface-variant">
            موضوع را توضیح دهید، به پرسش‌های لازم پاسخ دهید و پیش‌نویس خود را مرحله‌به‌مرحله
            آماده کنید.
          </p>

          {!enabled && (
            <p className="mt-2 rounded-medium bg-surface-container px-3 py-2 text-caption leading-6 text-on-surface-variant">
              {noteFa ?? settings.statusNoteFa ?? "این خدمت در حال حاضر برای حساب شما فعال نیست."}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {enabled ? (
              <Link href="/judicial" className={buttonClasses()}>
                شروع تنظیم
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className={`${buttonClasses({ variant: "outlined" })} pointer-events-none opacity-60`}
              >
                شروع تنظیم
              </span>
            )}

            {latest && latest.draftCount > 0 && (
              <Link
                href={`/judicial/${latest.id}`}
                className="inline-flex items-center gap-1 text-labelLarge text-primary hover:underline"
              >
                آخرین پیش‌نویس (نسخهٔ {latest.latestDraftVersion?.toLocaleString("fa-IR") ?? "—"})
                <IconArrowBack size={16} />
              </Link>
            )}
          </div>

          {latest && (
            <div className="mt-4 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 truncate text-labelLarge text-on-surface">
                  {latest.titleFa}
                </span>
                <StatusBadge
                  label={JUDICIAL_REQUEST_STATUS_FA[latest.status]}
                  tone={latest.hasApprovedDraft ? "success" : "info"}
                  dot={false}
                />
                <span className="text-labelSmall text-on-surface-variant">
                  {toPersianDate(latest.updatedAt)}
                </span>
              </div>
              <Link
                href={`/judicial/${latest.id}`}
                className="mt-1.5 inline-flex items-center gap-1 text-labelLarge text-primary hover:underline"
              >
                ادامهٔ درخواست از همان مرحله
                <IconArrowBack size={16} />
              </Link>
            </div>
          )}

          <p className="mt-3 flex items-start gap-1.5 text-caption leading-6 text-on-surface-variant">
            <IconInfo size={14} className="mt-1 shrink-0" />
            {capabilities.filingNoteFa}
          </p>
        </div>
      </div>
    </section>
  );
}
