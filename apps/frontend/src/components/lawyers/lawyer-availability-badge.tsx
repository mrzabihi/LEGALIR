"use client";

// ============================================================
// LEGALIR — Lawyer Availability Badge
// ============================================================
// A status dot + text, plus an optional capacity line. Colour alone never
// carries the meaning — the text is always present, so the state is
// readable without colour vision.
//
// Status and capacity are rendered as two separate lines on purpose: a
// lawyer can be «فعال» with only «۲ ظرفیت باقی‌مانده».
// ============================================================

import { IconError } from "@/lib/icons";
import {
  TONE_DOT_CLASS,
  TONE_TEXT_CLASS,
  removalReason,
  type AvailabilityView,
} from "@/lib/lawyers/availability";

interface LawyerAvailabilityBadgeProps {
  view: AvailabilityView;
}

export function LawyerAvailabilityBadge({ view }: LawyerAvailabilityBadgeProps) {
  // Removed (rejected by the bar, or suspended by LEGALIR) is terminal and
  // gets a glyph instead of an availability dot, so it never reads like an
  // ordinary "reachable" state.
  const removed = view.tone === "rejected";
  const reason = removalReason(view.status);

  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5">
        {removed ? (
          <IconError size={14} className="shrink-0 text-error" aria-label={reason ?? undefined} />
        ) : (
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT_CLASS[view.tone]}`}
            aria-hidden="true"
          />
        )}
        <span className={`text-caption font-medium ${TONE_TEXT_CLASS[view.tone]}`}>
          {view.label}
        </span>
      </span>
      {/* The capacity line is always reserved (even when empty) so cards
          with and without a capacity figure stay the same height. */}
      <span className={`min-h-5 pr-3.5 text-caption ${removed ? "text-error" : "text-muted"}`}>
        {view.capacityLabel ?? ""}
      </span>
    </div>
  );
}
