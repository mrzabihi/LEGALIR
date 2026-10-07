// ============================================================
// LEGALIR — Calculator card
// ============================================================
// One tile per calculator, shared by the home grid, the suggested row,
// the per-category rows and the /calculators/all grid. It renders only
// fields that exist on the calculator record: the emoji icon and its
// category gradient, the name, the one-line subtitle, the category
// tag and (when declared) the legal-standing badge.
//
// The whole tile is one link — a large, unambiguous touch target with
// a short tab order — and a visible «ورود» affordance makes the click
// affordance explicit rather than implied.
// ============================================================

"use client";

import Link from "next/link";
import { IconChevronLeft } from "@/lib/icons";
import type { CalculatorCardModel } from "@/lib/calculators/catalog";
import { toneClasses } from "./tone";

/** Legal-standing badges, keyed by the calculator's declared status. */
const STATUS_TONE: Record<string, string> = {
  legal_basis: "bg-primary-soft text-on-primary-container border-[color:var(--color-primary)]",
  official_tariff: "bg-secondary-soft text-on-secondary-container border-[color:var(--color-secondary)]",
  estimate: "bg-warning-50 text-warning-700 border-warning-200",
  not_determinable: "bg-error-50 text-error-700 border-error-200",
};

interface CalculatorCardProps {
  card: CalculatorCardModel;
  /** Show the legal-standing badge (default true). */
  showStatus?: boolean;
  /** Extra classes for the outer link (e.g. a fixed width in a row). */
  className?: string;
}

export function CalculatorCard({ card, showStatus = true, className = "" }: CalculatorCardProps) {
  const statusTone = card.status ? STATUS_TONE[card.status] : undefined;
  const tone = toneClasses(card.categoryTone);

  return (
    <Link
      href={card.href}
      data-slug={card.slug}
      className={[
        "group flex h-full w-full flex-col rounded-large border border-[color:var(--color-outline-variant)]",
        "bg-surface p-4 transition-all duration-short4 ease-standard",
        "hover:-translate-y-0.5 hover:shadow-elevation-3",
        tone.cardHoverBorder,
        "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)] touch-target",
        className,
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${card.categoryGradient} text-white shadow-elevation-1 transition-transform duration-short4 ease-standard group-hover:scale-[1.05]`}
        >
          <span className="text-xl leading-none">{card.icon}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-body-2 font-semibold leading-snug text-on-surface transition-colors group-hover:text-primary">
            {card.title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-caption leading-relaxed text-on-surface-variant">
            {card.subtitle}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container px-2.5 py-0.5 text-labelSmall text-on-surface-variant">
          {card.categoryLabel}
        </span>
        {showStatus && statusTone && card.statusLabel && (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-labelSmall font-medium ${statusTone}`}
          >
            {card.statusLabel}
          </span>
        )}
      </div>

      <span className="mt-auto inline-flex items-center gap-1.5 self-start pt-3 text-labelLarge font-medium text-primary">
        ورود
        <IconChevronLeft
          size={16}
          className="transition-transform duration-short4 ease-standard group-hover:-translate-x-0.5"
        />
      </span>
    </Link>
  );
}
