// ============================================================
// LEGALIR — Lawyer Profile (PART 3)
// ============================================================
// Public profile for a single verified lawyer. Performance metrics are
// derived server-side from real events — there is no fabricated win-rate.
// The CTA starts a legal request; the user always chooses the lawyer.
// ============================================================

"use client";

import { use } from "react";
import Link from "next/link";
import { useLawyer } from "@/hooks/useLawyers";
import {
  IconPerson,
  IconStar,
  IconCheckCircle,
  IconInfo,
  IconRefresh,
  IconArrowBack,
  IconCalendar,
  IconError,
} from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import { REJECTED_REASON_FA } from "@/lib/lawyers/availability";
import { LEGAL_CATEGORY_FA } from "@legalir/types";

const WEEKDAY_FA = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];

function formatToman(value: number): string {
  return `${toPersianNumber(value)} تومان`;
}

export default function LawyerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: lawyer, isLoading, isError, refetch } = useLawyer(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
        <div className="h-64 animate-pulse rounded-2xl bg-surface-container" />
      </div>
    );
  }

  if (isError || !lawyer) {
    return (
      <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
        <div className="flex flex-col items-center gap-3 rounded-large bg-error/10 p-8 text-center">
          <p className="text-body-1 text-error">وکیل یافت نشد یا در دسترس نیست</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-body-2 text-primary transition hover:bg-primary/10"
          >
            <IconRefresh size={16} />
            تلاش مجدد
          </button>
          <Link href="/lawyers" className="text-body-2 text-primary hover:underline">
            بازگشت به فهرست وکلا
          </Link>
        </div>
      </div>
    );
  }

  const perf = lawyer.performance;

  return (
    <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
      <Link
        href="/lawyers"
        className="mb-4 inline-flex items-center gap-1.5 text-body-2 text-muted transition hover:text-primary"
      >
        <IconArrowBack size={18} />
        فهرست وکلا
      </Link>

      {/* Header */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-divider/60 bg-surface p-6 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary-600 to-primary-800" />
        <div className="flex flex-col gap-4 tablet:flex-row tablet:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <IconPerson size={40} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-h2 text-on-surface">{lawyer.fullName}</h1>
              {lawyer.verificationStatus === "VERIFIED" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-caption text-success">
                  <IconCheckCircle size={14} />
                  تأییدشده
                </span>
              )}
              {lawyer.isDemo && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-caption text-amber-700">
                  نمونه
                </span>
              )}
            </div>
            <p className="mt-3 text-body-2 leading-relaxed text-muted">{lawyer.bio}</p>
            {lawyer.licenseNumber && (
              <p className="mt-2 text-caption text-muted">
                شماره پروانه: {lawyer.licenseNumber}
                {lawyer.licenseYear ? ` · سال ${toPersianNumber(lawyer.licenseYear)}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Performance — derived from real events */}
      <div className="mb-6 grid grid-cols-2 gap-3 tablet:grid-cols-4">
        <div className="rounded-2xl border border-divider/60 bg-surface p-4 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-amber-600">
            <IconStar size={18} />
            <span className="text-h3">{perf.averageRating !== null ? toPersianNumber(perf.averageRating) : "—"}</span>
          </div>
          <p className="text-caption text-muted">
            {perf.reviewCount > 0 ? `${toPersianNumber(perf.reviewCount)} نظر` : "بدون نظر"}
          </p>
        </div>
        <div className="rounded-2xl border border-divider/60 bg-surface p-4 text-center">
          <div className="mb-1 text-h3 text-on-surface">{toPersianNumber(perf.acceptedRequests)}</div>
          <p className="text-caption text-muted">درخواست پذیرفته‌شده</p>
        </div>
        <div className="rounded-2xl border border-divider/60 bg-surface p-4 text-center">
          <div className="mb-1 text-h3 text-on-surface">{toPersianNumber(perf.completedCases)}</div>
          <p className="text-caption text-muted">پرونده تکمیل‌شده</p>
        </div>
        <div className="rounded-2xl border border-divider/60 bg-surface p-4 text-center">
          <div className="mb-1 text-h3 text-on-surface">
            {perf.medianResponseMinutes !== null
              ? `${toPersianNumber(perf.medianResponseMinutes)} د`
              : "—"}
          </div>
          <p className="text-caption text-muted">میانه زمان پاسخ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 tablet:grid-cols-3">
        <div className="tablet:col-span-2 space-y-6">
          {/* Specializations */}
          <section className="rounded-2xl border border-divider/60 bg-surface p-5">
            <h2 className="mb-3 text-h3 text-on-surface">تخصص‌ها</h2>
            <div className="flex flex-wrap gap-2">
              {lawyer.specializations.map((s) => (
                <span
                  key={s.category}
                  className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-caption text-primary-700"
                >
                  {LEGAL_CATEGORY_FA[s.category] ?? s.category} · {toPersianNumber(s.yearsExperience)} سال
                </span>
              ))}
            </div>
          </section>

          {/* Reviews */}
          <section className="rounded-2xl border border-divider/60 bg-surface p-5">
            <h2 className="mb-3 text-h3 text-on-surface">نظرات موکلان</h2>
            {lawyer.reviews.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <IconInfo size={28} className="text-muted" />
                <p className="text-body-2 text-muted">هنوز نظری ثبت نشده است</p>
              </div>
            ) : (
              <ul className="divide-y divide-divider/70">
                {lawyer.reviews.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-body-2 text-on-surface">{r.authorName}</span>
                      <span className="inline-flex items-center gap-1 text-caption text-amber-600">
                        <IconStar size={14} />
                        {toPersianNumber(r.rating)}
                      </span>
                    </div>
                    <p className="text-body-2 text-muted">{r.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-divider/60 bg-surface p-5">
            <h2 className="mb-3 text-h3 text-on-surface">تعرفه‌ها</h2>
            <dl className="space-y-2 text-body-2">
              <div className="flex items-center justify-between">
                <dt className="text-muted">مشاوره</dt>
                <dd className="font-semibold text-on-surface">
                  {formatToman(lawyer.pricing.consultationFeeToman)}
                </dd>
              </div>
              {lawyer.pricing.hourlyRateToman ? (
                <div className="flex items-center justify-between">
                  <dt className="text-muted">ساعتی</dt>
                  <dd className="text-on-surface">{formatToman(lawyer.pricing.hourlyRateToman)}</dd>
                </div>
              ) : null}
              {lawyer.pricing.contractReviewFeeToman ? (
                <div className="flex items-center justify-between">
                  <dt className="text-muted">بررسی قرارداد</dt>
                  <dd className="text-on-surface">{formatToman(lawyer.pricing.contractReviewFeeToman)}</dd>
                </div>
              ) : null}
            </dl>
            {lawyer.pricing.freeFirstConsultation && (
              <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-caption text-success">
                اولین مشاوره رایگان است
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-divider/60 bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 text-h3 text-on-surface">
              <IconCalendar size={18} />
              زمان‌های در دسترس
            </h2>
            <ul className="space-y-1.5 text-body-2 text-muted">
              {lawyer.availability.map((slot, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span>{WEEKDAY_FA[slot.weekday] ?? slot.weekday}</span>
                  <span dir="ltr">
                    {slot.startTime}–{slot.endTime}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-divider/60 bg-surface p-5">
            <h2 className="mb-3 text-h3 text-on-surface">موقعیت و زبان</h2>
            <ul className="space-y-1.5 text-body-2 text-muted">
              {lawyer.locations.map((loc, i) => (
                <li key={i}>
                  {loc.province} · {loc.city}
                  {loc.remote ? " · آنلاین" : ""}
                </li>
              ))}
              <li>{lawyer.languages.map((l) => l.labelFa).join("، ")}</li>
            </ul>
          </section>

          {lawyer.availabilityStatus === "REJECTED" ? (
            // Terminal state — the profile is viewable for transparency but
            // can never start a request.
            <div
              role="status"
              className="flex items-center justify-center gap-2 rounded-xl border border-error-200 bg-error-100 px-5 py-3 text-center text-button font-medium text-error-700"
            >
              <IconError size={16} className="shrink-0" aria-hidden="true" />
              {REJECTED_REASON_FA}
            </div>
          ) : (
            <Link
              href={`/new?lawyerId=${lawyer.id}`}
              className="block rounded-xl bg-primary px-5 py-3 text-center text-button font-medium text-white shadow-sm transition-colors hover:bg-primary-700 active:scale-[0.98]"
            >
              درخواست مشاوره از این وکیل
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
