"use client";

// ============================================================
// LEGALIR — Trust-first Lawyer Card
// ============================================================
// The marketplace card. It reads as a professional PROFILE, not a product
// tile: face first, then who they are, then whether they are reachable,
// then what it costs.
//
// Information hierarchy (top → bottom):
//   avatar + name + professional title + demo/verified badge
//   rating (or an honest "no reviews yet")
//   specialty chips
//   experience • city • online
//   availability status  (independent of)
//   consultation capacity
//   consultation price
//   [view profile] [request consultation]
//
// Every card is equal height: the body is a flex column and the CTA block
// is pushed to the bottom with `mt-auto`, so all CTAs line up.
//
// Demo profiles are badged «نمونه» and never shown as verified. A real
// lawyer is badged «احراز هویت شده» only when the backend says VERIFIED.
// ============================================================

import Link from "next/link";
import type { LawyerListItem } from "@legalir/types";
import { IconCheckCircle, IconClock, IconError, IconLocation } from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import { availabilityView, REJECTED_REASON_FA } from "@/lib/lawyers/availability";
import { LawyerAvatar } from "./lawyer-avatar";
import { LawyerRating } from "./lawyer-rating";
import { LawyerAvailabilityBadge } from "./lawyer-availability-badge";
import { LawyerSpecialtyChips } from "./lawyer-specialty-chips";
import { LawyerSpecialtyWatermark } from "./lawyer-specialty-watermark";

interface LawyerCardProps {
  lawyer: LawyerListItem;
}

function formatToman(value: number): string {
  return `${toPersianNumber(value)} تومان`;
}

/** Max years across specialties — the headline experience figure. */
function yearsOfExperience(lawyer: LawyerListItem): number {
  return lawyer.specializations.reduce((m, s) => Math.max(m, s.yearsExperience), 0);
}

export function LawyerCard({ lawyer }: LawyerCardProps) {
  const view = availabilityView(
    lawyer.availabilityStatus,
    lawyer.consultationCapacity,
    lawyer.acceptingRequests
  );
  const years = yearsOfExperience(lawyer);
  const location = lawyer.locations[0];
  const duration = lawyer.pricing.consultationDurationMinutes;
  // A lawyer removed by LEGALIR review is shown in a red treatment so the
  // card can never be mistaken for a bookable profile.
  const rejected = view.tone === "rejected";

  return (
    <div
      className={[
        "group relative flex flex-col overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-200",
        rejected
          ? "border-error-200 bg-error-50 hover:shadow-elevation-2"
          : "border-divider/60 bg-surface hover:shadow-elevation-2",
      ].join(" ")}
    >
      <LawyerSpecialtyWatermark category={lawyer.specializations[0]?.category} />

      <div className="relative flex flex-col gap-4">
        {/* --- Identity --- */}
        <div className="flex items-start gap-3.5">
          <LawyerAvatar
            name={lawyer.fullName}
            avatarUrl={lawyer.avatarUrl}
            avatarType={lawyer.avatarType}
            tone={view.tone}
            size={72}
            className="hidden mobile-l:block"
          />
          <LawyerAvatar
            name={lawyer.fullName}
            avatarUrl={lawyer.avatarUrl}
            avatarType={lawyer.avatarType}
            tone={view.tone}
            size={60}
            className="mobile-l:hidden"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="truncate text-body-1 font-semibold text-on-surface group-hover:text-primary">
                {lawyer.fullName}
              </h3>
              {lawyer.isDemo ? (
                <span className="shrink-0 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-caption text-warning-700">
                  نمونه
                </span>
              ) : lawyer.verificationStatus === "VERIFIED" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-caption text-success">
                  <IconCheckCircle size={13} />
                  احراز هویت شده
                </span>
              ) : null}
            </div>

            {lawyer.professionalTitle && (
              <p className="mt-0.5 truncate text-caption text-muted">
                {lawyer.professionalTitle}
              </p>
            )}

            <div className="mt-2">
              <LawyerRating
                average={lawyer.performance.averageRating}
                reviewCount={lawyer.performance.reviewCount}
              />
            </div>
          </div>
        </div>

        {/* --- Specialties --- */}
        <LawyerSpecialtyChips specializations={lawyer.specializations} />

        {/* --- Compact professional meta --- */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
          {years > 0 && <span>{toPersianNumber(years)} سال سابقه</span>}
          {location && (
            <span className="inline-flex items-center gap-1">
              <IconLocation size={13} />
              {location.city}
            </span>
          )}
          {location?.remote && <span>آنلاین</span>}
        </div>

        {/* --- Availability (status) + capacity, kept separate --- */}
        <LawyerAvailabilityBadge view={view} />
      </div>

      {/* --- Price + CTA (pinned to the bottom for equal heights) --- */}
      <div className="relative mt-auto pt-4">
        <div className="mb-3 flex items-end justify-between border-t border-divider/60 pt-3">
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1 text-caption text-muted">
              <IconClock size={13} />
              {duration ? `مشاوره ${toPersianNumber(duration)} دقیقه‌ای` : "مشاوره"}
            </span>
            <span className="text-body-2 font-semibold text-on-surface">
              {formatToman(lawyer.pricing.consultationFeeToman)}
            </span>
          </div>
          {lawyer.pricing.freeFirstConsultation && (
            <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-caption text-success">
              اولین مشاوره رایگان
            </span>
          )}
        </div>

        {rejected ? (
          // Terminal state: no profile link, no request CTA — just the
          // reason, in red, so the card cannot invite an action.
          <div
            role="status"
            className="flex items-center justify-center gap-2 rounded-xl border border-error-200 bg-error-100 px-4 py-2.5 text-center text-button font-medium text-error-700"
          >
            <IconError size={16} className="shrink-0" aria-hidden="true" />
            {REJECTED_REASON_FA}
          </div>
        ) : (
          <div className="flex flex-col gap-2 mobile-l:flex-row">
            <Link
              href={`/lawyers/${lawyer.id}`}
              className="flex-1 rounded-xl border border-divider/60 bg-surface px-4 py-2.5 text-center text-button font-medium text-on-surface transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              مشاهده پروفایل
            </Link>
            {view.canRequest ? (
              <Link
                href={`/new?lawyerId=${lawyer.id}`}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-center text-button font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98]"
              >
                {view.ctaLabel}
              </Link>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="flex-1 cursor-not-allowed rounded-xl bg-surface-container px-4 py-2.5 text-center text-button font-medium text-muted"
              >
                {view.ctaLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
