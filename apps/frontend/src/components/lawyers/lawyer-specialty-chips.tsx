"use client";

// ============================================================
// LEGALIR — Lawyer Specialty Chips
// ============================================================
// At most three specialty chips are shown; any remainder collapses into a
// «+N» chip so a lawyer with many specialties never stretches the card.
// ============================================================

import type { LawyerSpecialty } from "@legalir/types";
import { toPersianNumber } from "@/lib/persian-utils";
import { specialtyLabel } from "@/lib/lawyers/specialty";

const MAX_VISIBLE = 3;

interface LawyerSpecialtyChipsProps {
  specializations: LawyerSpecialty[];
}

export function LawyerSpecialtyChips({ specializations }: LawyerSpecialtyChipsProps) {
  if (specializations.length === 0) return null;

  const visible = specializations.slice(0, MAX_VISIBLE);
  const overflow = specializations.length - visible.length;

  // Reserve two chip rows so a lawyer with many specialties (which wraps)
  // does not make their card taller than the rest of the grid.
  return (
    <div className="flex min-h-[58px] flex-wrap content-start gap-1.5">
      {visible.map((s) => (
        <span
          key={s.category}
          className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-0.5 text-caption text-primary-700"
        >
          {specialtyLabel(s.category)}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="rounded-full border border-divider/60 bg-surface-container px-2.5 py-0.5 text-caption text-muted"
          aria-label={`${toPersianNumber(overflow)} تخصص دیگر`}
        >
          +{toPersianNumber(overflow)}
        </span>
      )}
    </div>
  );
}
