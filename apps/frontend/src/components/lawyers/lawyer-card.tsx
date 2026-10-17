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
import { Button, buttonClasses } from "@legalir/ui";
import type { LawyerListItem } from "@legalir/types";
import { LAWYER_PROFESSIONAL_RANK_SHORT_FA } from "@legalir/types";
import {
  IconCheckCircle,
  IconClock,
  IconError,
  IconLocation,
  IconSparkle,
} from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import { availabilityView, removalReason } from "@/lib/lawyers/availability";
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
  const years = lawyer.yearsExperience ?? yearsOfExperience(lawyer);
  const location = lawyer.locations[0];
  const rankLabel = lawyer.professionalRank
    ? LAWYER_PROFESSIONAL_RANK_SHORT_FA[lawyer.professionalRank]
    : null;
  const duration = lawyer.pricing.consultationDurationMinutes;
  // A lawyer removed from the marketplace (rejected by the bar, or suspended
  // by LEGALIR) is shown in a red treatment so the card can never be mistaken
  // for a bookable profile. The copy differs per outcome.
  const rejected = view.tone === "rejected";
  const removeReason = removalReason(view.status);

  return (
    <div
      className={[
        "group relative flex flex-col overflow-hidden rounded-large border p-5 shadow-elevation-1 transition-shadow duration-short3",
        rejected
          ? "border-error-200 bg-error-50 hover:shadow-elevation-3"
          : "border-divider bg-surface hover:shadow-elevation-3",
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
              {lawyer.featured && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary bg-primary-container px-2 py-0.5 text-caption text-primary">
                  <IconSparkle size={13} />
                  برگزیده
                </span>
              )}
              {lawyer.isDemo ? (
                <span className="shrink-0 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-caption text-warning-700">
                  نمونه
                </span>
              ) : lawyer.verificationStatus === "VERIFIED" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-container px-2 py-0.5 text-caption text-success">
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
                average={lawyer.displayRating ?? lawyer.performance.averageRating}
                reviewCount={lawyer.displayReviewCount ?? lawyer.performance.reviewCount}
              />
            </div>
          </div>
        </div>

        {/* --- Specialties --- */}
        <LawyerSpecialtyChips specializations={lawyer.specializations} />

        {/* --- Compact professional meta --- */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
          {rankLabel && (
            <span className="rounded-md bg-surface-container px-1.5 py-0.5 text-on-surface-variant">
              {rankLabel}
            </span>
          )}
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
        <div className="mb-3 flex items-end justify-between border-t border-divider pt-3">
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
            <span className="rounded-full bg-success-container px-2.5 py-0.5 text-caption text-success">
              اولین مشاوره رایگان
            </span>
          )}
        </div>

        {rejected ? (
          // Terminal state: no profile link, no request CTA — just the
          // reason, in red, so the card cannot invite an action.
          <div
            role="status"
            className="flex items-center justify-center gap-2 rounded-medium border border-error bg-error-container px-4 py-2.5 text-center text-button font-medium text-error"
          >
            <IconError size={16} className="shrink-0" aria-hidden="true" />
            {removeReason}
          </div>
        ) : (
          <div className="flex flex-col gap-2 mobile-l:flex-row">
            <Link
              href={`/lawyers/${lawyer.id}`}
              className={buttonClasses({ variant: "outlined", className: "flex-1" })}
            >
              مشاهده پروفایل
            </Link>
            {view.canRequest ? (
              <Link
                href={`/consultations/new?lawyerId=${lawyer.id}`}
                className={buttonClasses({ className: "flex-1" })}
              >
                {view.ctaLabel}
              </Link>
            ) : (
              <Button disabled className="flex-1">
                {view.ctaLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
