// ============================================================
// LEGALIR — Promo card (the shared Promotional Banner Card)
// ============================================================
// A compact, brand-toned panel that carries ONE message and ONE action
// to a real route. It exists so a page can offer a next step («مشاهده
// همهٔ قراردادها», «رزرو مشاوره») beside a rail without those extras
// pushing the primary list down.
//
// The action is either a navigation (`href`) or an in-place command
// (no `href` + `onClick`), so the same visual weight can mean "go to a
// page" or "reveal more here" without inventing a second card style.
//
// Deliberately NOT the large `CampaignBanner`/`PromoModule`: those are
// full-bleed photographic surfaces for the top of a page. This one is a
// card-sized companion, so it can sit at the end of a rail or in a
// sidebar gutter and still read as secondary.
//
// Accessibility:
//   • the whole card is one <Link>, so there is exactly one tab stop;
//   • the description is real text, never an image of text;
//   • the brand gradient is dark enough that `text-white/85` clears AA.
// ============================================================

import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronLeft } from "@/lib/icons";

export interface PromoCardProps {
  title: string;
  message: string;
  cta: string;
  /**
   * Destination. When omitted the card renders as a real <button> and
   * calls `onClick` instead — used for an in-place action (e.g. expanding
   * a list) that must not leave the page.
   */
  href?: string;
  /** Required when `href` is omitted: the in-place command. */
  onClick?: () => void;
  icon?: ReactNode;
  /** Optional short label above the title. */
  eyebrow?: string;
  /**
   * `stacked` (default) is the card that pairs with a rail. `row` folds
   * the same content into a full-width banner: icon, text, then the
   * action on the trailing edge — used when the card sits alone under a
   * long list rather than beside one.
   */
  layout?: "stacked" | "row";
  className?: string;
}

export function PromoCard({
  title,
  message,
  cta,
  href,
  icon,
  eyebrow,
  layout = "stacked",
  onClick,
  className = "",
}: PromoCardProps) {
  const isRow = layout === "row";
  const className_ = [
    "group relative flex h-full w-full flex-col overflow-hidden rounded-large p-4 text-start text-white",
    isRow && "tablet:flex-row tablet:items-center tablet:gap-4 tablet:px-5",
    "bg-[linear-gradient(135deg,var(--brand-teal)_0%,var(--brand-green)_100%)]",
    "shadow-elevation-2 transition-[box-shadow,transform] duration-short3 ease-standard",
    "hover:shadow-elevation-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {/* A whisper of gold at the far corner — the brand's only decoration. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -end-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,var(--brand-gold)_0%,transparent_70%)] opacity-30"
      />

      {icon && (
        <span
          aria-hidden="true"
          className={[
            "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-medium bg-white/15 text-white",
            isRow ? "mb-2.5 tablet:mb-0" : "mb-2.5",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {icon}
        </span>
      )}

      <div className="relative min-w-0 flex-1">
        {eyebrow && (
          <p className="mb-1 text-labelSmall font-medium tracking-wide text-[var(--brand-gold)]">
            {eyebrow}
          </p>
        )}
        <h3 className="text-body-1 font-bold leading-snug text-white">{title}</h3>
        <p className="mt-1.5 text-caption leading-relaxed text-white/85">{message}</p>
      </div>

      <span
        className={[
          "relative mt-3 inline-flex items-center gap-1 text-labelLarge font-medium text-white",
          isRow && "tablet:mt-0 tablet:shrink-0",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {cta}
        <IconChevronLeft
          size={16}
          aria-hidden="true"
          className="transition-transform duration-short3 ease-standard group-hover:-translate-x-0.5 motion-reduce:transform-none"
        />
      </span>
    </>
  );

  // Navigation card (default) or in-place command. Both are one real
  // control, so the card has exactly one tab stop in either mode.
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={className_}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className_}>
      {content}
    </button>
  );
}
