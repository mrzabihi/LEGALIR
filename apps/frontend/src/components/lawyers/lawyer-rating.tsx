"use client";

// ============================================================
// LEGALIR — Lawyer Rating
// ============================================================
// Renders a 0–5 rating as five stars with a half-star for the .5 step,
// plus the review count. When there are no reviews we show a calm
// «هنوز نظری ثبت نشده» line instead of a misleading 0.0 / zero stars.
//
// The whole row carries a single screen-reader sentence so assistive tech
// hears «امتیاز ۴.۵ از ۵ بر اساس ۱۲ نظر» rather than five star glyphs.
// ============================================================

import { IconStar } from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";

interface LawyerRatingProps {
  /** 0–5, or null when the lawyer has no reviews yet. */
  average: number | null;
  reviewCount: number;
}

/** One star, filled / half / empty. */
function Star({ fill }: { fill: "full" | "half" | "empty" }) {
  if (fill === "full") {
    return <IconStar size={15} className="text-warning-600" />;
  }
  if (fill === "empty") {
    return <IconStar size={15} className="text-on-surface-variant/25" />;
  }
  // Half star: a clipped full star over a dimmed base.
  return (
    <span className="relative inline-flex" aria-hidden="true">
      <IconStar size={15} className="text-on-surface-variant/25" />
      <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
        <IconStar size={15} className="text-warning-600" />
      </span>
    </span>
  );
}

export function LawyerRating({ average, reviewCount }: LawyerRatingProps) {
  if (average === null || reviewCount === 0) {
    return (
      <p className="flex h-5 items-center text-caption text-muted">هنوز نظری ثبت نشده</p>
    );
  }

  const rounded = Math.round(average * 2) / 2; // snap to nearest 0.5
  const stars = Array.from({ length: 5 }, (_, i) => {
    const threshold = i + 1;
    if (rounded >= threshold) return "full" as const;
    if (rounded >= threshold - 0.5) return "half" as const;
    return "empty" as const;
  });

  return (
    <div
      className="flex h-5 items-center gap-2"
      role="img"
      aria-label={`امتیاز ${toPersianNumber(average)} از ۵ بر اساس ${toPersianNumber(reviewCount)} نظر`}
    >
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {stars.map((fill, i) => (
          <Star key={i} fill={fill} />
        ))}
      </span>
      <span className="text-caption font-medium text-on-surface" aria-hidden="true">
        {toPersianNumber(average)}
      </span>
      <span className="text-caption text-muted" aria-hidden="true">
        ({toPersianNumber(reviewCount)} نظر)
      </span>
    </div>
  );
}
