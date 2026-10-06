"use client";

// ============================================================
// LEGALIR — Compact Lawyer Card (carousel tile)
// ============================================================
// The narrow tile used inside the mobile/tablet category carousels, where
// two cards share the viewport. It is a deliberately reduced version of
// the full LawyerCard: face, name, headline, primary specialty, rating,
// one meta line and a single CTA. Everything else lives on the profile.
//
// The whole tile is one link to the profile, so a tap anywhere opens the
// lawyer — the CTA is a visual affordance, not a second target. A lawyer
// removed by LEGALIR review is rendered as a non-interactive red tile.
//
// Equal heights: the body is a flex column and the CTA is pushed to the
// bottom with `mt-auto`, so tiles in a row line up.
// ============================================================

import Link from "next/link";
import type { LawyerListItem } from "@legalir/types";
import { IconCheckCircle, IconError, IconLocation } from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import { availabilityView, removalReason } from "@/lib/lawyers/availability";
import { specialtyLabel } from "@/lib/lawyers/specialty";
import { yearsOfExperience } from "@/lib/lawyers/grouping";
import { LawyerAvatar } from "./lawyer-avatar";
import { LawyerRating } from "./lawyer-rating";

interface LawyerCardCompactProps {
  lawyer: LawyerListItem;
}

export function LawyerCardCompact({ lawyer }: LawyerCardCompactProps) {
  const view = availabilityView(
    lawyer.availabilityStatus,
    lawyer.consultationCapacity,
    lawyer.acceptingRequests
  );
  const years = yearsOfExperience(lawyer);
  const location = lawyer.locations[0];
  const primary = lawyer.specializations[0]?.category;
  const rejected = view.tone === "rejected";
  const removeReason = removalReason(view.status);

  const body = (
    <>
      {/* --- Identity --- */}
      <div className="flex flex-col items-center gap-2 text-center">
        <LawyerAvatar
          name={lawyer.fullName}
          avatarUrl={lawyer.avatarUrl}
          avatarType={lawyer.avatarType}
          tone={view.tone}
          size={64}
        />
        <div className="min-w-0 w-full">
          <div className="flex items-center justify-center gap-1">
            <h3 className="truncate text-body-2 font-semibold text-on-surface group-hover:text-primary">
              {lawyer.fullName}
            </h3>
            {!lawyer.isDemo && lawyer.verificationStatus === "VERIFIED" && (
              <IconCheckCircle size={14} className="shrink-0 text-success" aria-label="احراز هویت شده" />
            )}
          </div>
          {lawyer.professionalTitle && (
            <p className="mt-0.5 truncate text-caption text-muted">
              {lawyer.professionalTitle}
            </p>
          )}
        </div>
      </div>

      {/* --- Primary specialty --- */}
      {primary && (
        <span className="mx-auto rounded-full border border-primary/15 bg-primary/5 px-2.5 py-0.5 text-caption text-primary-700">
          {specialtyLabel(primary)}
        </span>
      )}

      {/* --- Rating --- */}
      <div className="flex justify-center">
        <LawyerRating
          average={lawyer.performance.averageRating}
          reviewCount={lawyer.performance.reviewCount}
        />
      </div>

      {/* --- Meta: experience • city --- */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-caption text-muted">
        {years > 0 && <span>{toPersianNumber(years)} سال سابقه</span>}
        {location && (
          <span className="inline-flex items-center gap-1">
            <IconLocation size={12} />
            {location.city}
          </span>
        )}
      </div>
    </>
  );

  if (rejected) {
    return (
      <div className="flex h-full flex-col gap-3 rounded-2xl border border-error-200 bg-error-50 p-4">
        {body}
        <div
          role="status"
          className="mt-auto flex items-center justify-center gap-1.5 rounded-xl border border-error-200 bg-error-100 px-3 py-2 text-center text-caption font-medium text-error-700"
        >
          <IconError size={14} className="shrink-0" aria-hidden="true" />
          {removeReason}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/lawyers/${lawyer.id}`}
      className="group flex h-full flex-col gap-3 rounded-2xl border border-divider/60 bg-surface p-4 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-elevation-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={`مشاهده پروفایل ${lawyer.fullName}`}
    >
      {body}

      {/* --- CTA (pinned to the bottom for equal heights) --- */}
      <span className="mt-auto block rounded-xl bg-primary px-3 py-2 text-center text-button font-medium text-white shadow-sm transition-colors group-hover:bg-primary-700">
        مشاهده پروفایل
      </span>
    </Link>
  );
}
