"use client";

// ============================================================
// LEGALIR — Lawyer Specialty Watermark
// ============================================================
// A large, very low-opacity glyph behind the card content that hints at
// the lawyer's primary practice area. Purely decorative: it is
// aria-hidden, sits behind everything, and never competes with the avatar
// or the text. The glyph comes from the central specialty→icon map.
// ============================================================

import { specialtyIcon } from "@/lib/lawyers/specialty";

interface LawyerSpecialtyWatermarkProps {
  /** Primary specialty slug (the first specialization). */
  category: string | null | undefined;
}

export function LawyerSpecialtyWatermark({ category }: LawyerSpecialtyWatermarkProps) {
  const Icon = specialtyIcon(category);

  return (
    <div
      className="pointer-events-none absolute -left-6 -top-6 select-none text-primary opacity-[0.05]"
      aria-hidden="true"
    >
      <Icon size={168} />
    </div>
  );
}

