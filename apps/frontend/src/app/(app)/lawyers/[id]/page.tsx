// ============================================================
// LEGALIR — Lawyer Profile (PART 3)
// ============================================================
// Public profile for a single verified lawyer. Performance metrics are
// derived server-side from real events — there is no fabricated win-rate.
// The CTA starts a legal consultation; the user always chooses the lawyer.
//
// The profile renders the FULL professional dossier: expertise (a 4-level
// taxonomy path), offered services, education, experience timeline and
// jurisdictions — all read from the SAME profile row the admin panel edits,
// so a change made there appears here immediately.
// ============================================================

"use client";

import { use } from "react";
import Link from "next/link";
import { useLawyer } from "@/hooks/useLawyers";
import { LawyerAvatar } from "@/components/lawyers";
import {
  IconStar,
  IconCheckCircle,
  IconInfo,
  IconRefresh,
  IconArrowBack,
  IconCalendar,
  IconError,
  IconBriefcase,
  IconLawBook,
  IconGavel,
} from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import { removalReason, SUSPENDED_REASON_FA } from "@/lib/lawyers/availability";
import { specialtyLabel } from "@/lib/lawyers/specialty";
import {
  taxonomyPathLabels,
  lawyerServiceLabel,
  jurisdictionLabel,
  LAWYER_PROFESSIONAL_RANK_FA,
  LAWYER_ORGANIZATION_TYPE_FA,
  LAWYER_LICENSE_STATUS_FA,
  type LawyerDetail,
} from "@legalir/types";

const WEEKDAY_FA = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];

function formatToman(value: number): string {
  return `${toPersianNumber(value)} تومان`;
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-divider/60 bg-surface p-5">
      <h2 className="mb-3 flex items-center gap-2 text-h3 text-on-surface">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
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

  return <LawyerProfileView lawyer={lawyer} />;
}

function LawyerProfileView({ lawyer }: { lawyer: LawyerDetail }) {
  const perf = lawyer.performance;
  const displayRating = lawyer.displayRating ?? perf.averageRating;
  const displayReviewCount = lawyer.displayReviewCount ?? perf.reviewCount;
  // A lawyer removed by review (rejected by the bar, or suspended by LEGALIR)
  // keeps a reachable profile for transparency, but the alert is prominent and
  // every booking CTA below is disabled.
  const suspended = lawyer.availabilityStatus === "SUSPENDED";
  const removed = suspended || lawyer.availabilityStatus === "REJECTED";
  const removeReasonText = removalReason(lawyer.availabilityStatus) ?? SUSPENDED_REASON_FA;

  // The primary expertise row first, then the rest in order.
  const expertise = [...(lawyer.expertise ?? [])].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.displayOrder - b.displayOrder
  );
  const services = (lawyer.services ?? []).filter((s) => s.enabled);
  const education = lawyer.education ?? [];
  const experience = lawyer.experience ?? [];
  const jurisdictions = lawyer.jurisdictions ?? [];

  return (
    <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
      <Link
        href="/lawyers"
        className="mb-4 inline-flex items-center gap-1.5 text-body-2 text-muted transition hover:text-primary"
      >
        <IconArrowBack size={18} />
        فهرست وکلا
      </Link>

      {/* Suspension alert — the profile stays viewable, but this must be
          impossible to miss before the (disabled) CTAs are reached. */}
      {suspended && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-xl border border-error-200 bg-error-100 px-4 py-3 text-body-2 text-error-700"
        >
          <IconError size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="font-medium">{SUSPENDED_REASON_FA}</span>
        </div>
      )}

      {/* Header */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-divider/60 bg-surface p-6 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary-600 to-primary-800" />
        <div className="flex flex-col gap-4 tablet:flex-row tablet:items-start">
          <LawyerAvatar
            name={lawyer.fullName}
            avatarUrl={lawyer.avatarUrl}
            avatarType={lawyer.avatarType}
            size={72}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-h2 text-on-surface">{lawyer.fullName}</h1>
              {lawyer.featured && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-caption text-primary-700">
                  برگزیده
                </span>
              )}
              {lawyer.verificationStatus === "VERIFIED" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-caption text-success">
                  <IconCheckCircle size={14} />
                  تأییدشده
                </span>
              )}
              {suspended && (
                <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-2.5 py-0.5 text-caption text-error">
                  <IconError size={14} />
                  معلق
                </span>
              )}
              {lawyer.isDemo && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-caption text-amber-700">
                  نمونه
                </span>
              )}
            </div>

            {/* Professional rank · organisation — independent attributes */}
            <div className="mt-2 flex flex-wrap gap-2 text-caption text-muted">
              {lawyer.professionalRank && (
                <span>{LAWYER_PROFESSIONAL_RANK_FA[lawyer.professionalRank]}</span>
              )}
              {lawyer.organizationType && (
                <span>· {LAWYER_ORGANIZATION_TYPE_FA[lawyer.organizationType]}</span>
              )}
              {lawyer.licenseStatus && (
                <span>· پروانه: {LAWYER_LICENSE_STATUS_FA[lawyer.licenseStatus]}</span>
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
            <span className="text-h3">
              {displayRating !== null ? toPersianNumber(displayRating) : "—"}
            </span>
          </div>
          <p className="text-caption text-muted">
            {displayReviewCount > 0 ? `${toPersianNumber(displayReviewCount)} نظر` : "بدون نظر"}
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
        <div className="space-y-6 tablet:col-span-2">
          {/* Expertise — the full taxonomy path per node */}
          <SectionCard title="تخصص‌ها و موضوع‌های پرونده" icon={<IconGavel size={18} />}>
            {expertise.length === 0 ? (
              <div className="flex flex-wrap gap-2">
                {lawyer.specializations.map((s) => (
                  <span
                    key={s.category}
                    className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-caption text-primary-700"
                  >
                    {specialtyLabel(s.category)} · {toPersianNumber(s.yearsExperience)} سال
                  </span>
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-divider/70">
                {expertise.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-body-2 text-on-surface">
                        {e.isPrimary && (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-caption text-primary-700">
                            اصلی
                          </span>
                        )}
                        {taxonomyPathLabels(e.taxonomyNodeId)}
                      </p>
                      {e.note && <p className="mt-0.5 text-caption text-muted">{e.note}</p>}
                    </div>
                    <span className="shrink-0 text-caption text-muted">
                      {toPersianNumber(e.yearsExperience)} سال
                      {e.caseCount > 0 ? ` · ${toPersianNumber(e.caseCount)} پرونده` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Services offered */}
          <SectionCard title="خدمات قابل ارائه" icon={<IconBriefcase size={18} />}>
            {services.length === 0 ? (
              <p className="py-2 text-body-2 text-muted">خدمتی برای این وکیل ثبت نشده است.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {services.map((s) => (
                  <span
                    key={s.serviceId}
                    className="rounded-full border border-divider/60 bg-surface-container/50 px-3 py-1 text-caption text-on-surface"
                  >
                    {lawyerServiceLabel(s.serviceId)}
                    {typeof s.priceToman === "number" && (
                      <span className="text-muted"> · {formatToman(s.priceToman)}</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Education */}
          <SectionCard title="تحصیلات" icon={<IconLawBook size={18} />}>
            {education.length === 0 ? (
              <p className="py-2 text-body-2 text-muted">اطلاعات تحصیلی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {education.map((ed) => (
                  <li key={ed.id} className="flex items-start justify-between gap-3 text-body-2">
                    <div>
                      <p className="text-on-surface">{ed.degreeFa}</p>
                      <p className="text-caption text-muted">
                        {ed.institutionFa}
                        {ed.fieldFa ? ` · ${ed.fieldFa}` : ""}
                      </p>
                    </div>
                    {ed.graduationYear ? (
                      <span className="shrink-0 text-caption text-muted">
                        {toPersianNumber(ed.graduationYear)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Experience timeline */}
          <SectionCard title="سوابق حرفه‌ای" icon={<IconBriefcase size={18} />}>
            {experience.length === 0 ? (
              <p className="py-2 text-body-2 text-muted">سابقه‌ای ثبت نشده است.</p>
            ) : (
              <ol className="relative space-y-4 border-s border-divider/70 ps-4">
                {experience.map((ex) => (
                  <li key={ex.id} className="relative">
                    <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                    <p className="text-body-2 text-on-surface">
                      {ex.roleFa}
                      {ex.organizationFa ? (
                        <span className="text-muted"> — {ex.organizationFa}</span>
                      ) : null}
                    </p>
                    <p className="text-caption text-muted">
                      {ex.startYear ? toPersianNumber(ex.startYear) : ""}
                      {ex.endYear
                        ? ` تا ${toPersianNumber(ex.endYear)}`
                        : ex.startYear
                          ? " تا کنون"
                          : ""}
                    </p>
                    {ex.descriptionFa && (
                      <p className="mt-0.5 text-caption text-muted">{ex.descriptionFa}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          {/* Reviews */}
          <SectionCard title="نظرات موکلان">
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
                      <span className="flex items-center gap-2 text-body-2 text-on-surface">
                        {r.authorName}
                        {r.verifiedEngagement && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[11px] text-success">
                            <IconCheckCircle size={11} />
                            موکل تأییدشده
                          </span>
                        )}
                      </span>
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
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <SectionCard title="تعرفه‌ها">
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
                  <dd className="text-on-surface">
                    {formatToman(lawyer.pricing.contractReviewFeeToman)}
                  </dd>
                </div>
              ) : null}
            </dl>
            {lawyer.pricing.freeFirstConsultation && (
              <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-caption text-success">
                اولین مشاوره رایگان است
              </p>
            )}
          </SectionCard>

          {/* Jurisdictions — where this lawyer can appear */}
          {jurisdictions.length > 0 && (
            <SectionCard title="مراجع صلاحیت‌دار" icon={<IconGavel size={18} />}>
              <ul className="space-y-1.5 text-body-2 text-muted">
                {jurisdictions.map((j) => (
                  <li key={j}>{jurisdictionLabel(j)}</li>
                ))}
              </ul>
            </SectionCard>
          )}

          <SectionCard title="زمان‌های در دسترس" icon={<IconCalendar size={18} />}>
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
          </SectionCard>

          <SectionCard title="موقعیت و زبان">
            <ul className="space-y-1.5 text-body-2 text-muted">
              {lawyer.locations.map((loc, i) => (
                <li key={i}>
                  {loc.province} · {loc.city}
                  {loc.remote ? " · آنلاین" : ""}
                </li>
              ))}
              <li>{lawyer.languages.map((l) => l.labelFa).join("، ")}</li>
            </ul>
          </SectionCard>

          {removed ? (
            // Terminal state — the profile is viewable for transparency but
            // can never start a request. The same red treatment covers both
            // outcomes; only the copy differs.
            <div
              role="status"
              className="flex items-center justify-center gap-2 rounded-xl border border-error-200 bg-error-100 px-5 py-3 text-center text-button font-medium text-error-700"
            >
              <IconError size={16} className="shrink-0" aria-hidden="true" />
              {removeReasonText}
            </div>
          ) : (
            <Link
              href={`/consultations/new?lawyerId=${lawyer.id}`}
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
