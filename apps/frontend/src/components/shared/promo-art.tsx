// ============================================================
// LEGALIR — Promotional artwork system
// ============================================================
// One placement system for the six Legalir promotional illustrations.
// The source bitmaps are square (≈354×357), opaque, and carry the
// LEGALIR wordmark baked into the lower-left corner. Two consequences
// drive every rule below:
//
//   • They are square, so they are never stretched into a wide hero
//     strip. Each one gets a square (or near-square) frame, or sits in
//     a split layout beside the copy.
//   • The wordmark is already in the bitmap, so the adjacent HTML never
//     repeats it as a second identical heading.
//
// Three treatments, one visual language (same frame, radius, border,
// spacing, and CTA styling):
//
//   PromoArt    — the framed square image itself
//   PromoPanel  — full-width editorial panel: image + copy + one CTA
//   PromoModule — compact secondary module for the signed-in dashboard
//
// All copy and CTAs are selectable HTML. Nothing is baked into the art.
// ============================================================

import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { IconChevronLeft } from "@/lib/icons";

export type PromoArtKey = "one" | "two" | "three" | "four" | "five" | "six";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

/** Native pixel size of every derivative — the frame's aspect ratio. */
const ART_W = 354;
const ART_H = 357;

function artSrc(art: PromoArtKey, compact = false): string {
  return `/assets/promo/legalir-promo-${art}${compact ? "-sm" : ""}.webp`;
}

// ------------------------------------------------------------
// PromoArt — the framed square image
// ------------------------------------------------------------

interface PromoArtProps {
  art: PromoArtKey;
  /** Meaningful alt when the image carries information; "" when the
   *  adjacent HTML already says the same thing. */
  alt: string;
  /** Rendered width hint for the browser's srcset picker. */
  sizes: string;
  className?: string;
}

export function PromoArt({ art, alt, sizes, className = "" }: PromoArtProps) {
  return (
    <div
      className={[
        "relative aspect-[354/357] w-full overflow-hidden rounded-large",
        "border border-[color:var(--color-outline-variant)] bg-surface-container-low",
        className,
      ].join(" ")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={artSrc(art)}
        srcSet={`${artSrc(art, true)} 176w, ${artSrc(art)} ${ART_W}w`}
        sizes={sizes}
        alt={alt}
        width={ART_W}
        height={ART_H}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}

// ------------------------------------------------------------
// PromoPanel — editorial panel: image + copy + one CTA
// ------------------------------------------------------------

interface PromoPanelProps {
  art: PromoArtKey;
  eyebrow: string;
  title: string;
  message: string;
  cta: string;
  href: string;
  icon: IconComponent;
  /** Which side the artwork sits on from `tablet` up. */
  imageSide?: "start" | "end";
  /** `feature` is the larger landing-page treatment. */
  size?: "feature" | "panel";
  className?: string;
}

export function PromoPanel({
  art,
  eyebrow,
  title,
  message,
  cta,
  href,
  icon: Icon,
  imageSide = "end",
  size = "panel",
  className = "",
}: PromoPanelProps) {
  const isFeature = size === "feature";

  return (
    <section
      className={[
        "overflow-hidden rounded-xlarge border border-[color:var(--color-outline-variant)]",
        "bg-surface shadow-elevation-1",
        className,
      ].join(" ")}
    >
      <div
        className={[
          "grid items-center gap-5 tablet:gap-8",
          isFeature ? "p-5 tablet:p-7 laptop:p-8" : "p-5 tablet:p-6",
          imageSide === "start"
            ? "tablet:grid-cols-[minmax(0,240px)_minmax(0,1fr)] laptop:grid-cols-[minmax(0,300px)_minmax(0,1fr)]"
            : "tablet:grid-cols-[minmax(0,1fr)_minmax(0,240px)] laptop:grid-cols-[minmax(0,1fr)_minmax(0,300px)]",
        ].join(" ")}
      >
        {/* ---- Copy ---- */}
        <div className={["min-w-0", imageSide === "start" ? "tablet:order-2" : ""].join(" ")}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)] bg-surface-container-low px-3 py-1 text-caption font-medium text-on-surface-variant">
            <Icon size={14} />
            {eyebrow}
          </span>

          <h2
            className={[
              "mt-3 font-bold leading-snug text-on-surface",
              isFeature ? "text-h3 tablet:text-h2" : "text-h4 tablet:text-h3",
            ].join(" ")}
          >
            {title}
          </h2>

          <p
            className={[
              "mt-2 leading-relaxed text-on-surface-variant",
              isFeature ? "text-body-1 max-w-xl" : "text-body-2 max-w-lg",
            ].join(" ")}
          >
            {message}
          </p>

          <Link
            href={href}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-button font-semibold text-white shadow-elevation-1 transition-colors hover:bg-primary-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 touch-target"
          >
            {cta}
            <IconChevronLeft size={16} />
          </Link>
        </div>

        {/* ---- Artwork ---- */}
        {/* On a phone the art drops to its own band below the copy so the
            headline and CTA are never covered. */}
        <div
          className={[
            "mx-auto w-full max-w-[260px] tablet:max-w-none",
            imageSide === "start" ? "tablet:order-1" : "",
          ].join(" ")}
        >
          <PromoArt
            art={art}
            alt=""
            sizes="(min-width: 900px) 300px, (min-width: 600px) 240px, 260px"
          />
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------
// PromoModule — compact secondary module (dashboard)
// ------------------------------------------------------------

interface PromoModuleProps {
  art: PromoArtKey;
  title: string;
  message: string;
  cta: string;
  href: string;
  icon: IconComponent;
  className?: string;
}

export function PromoModule({
  art,
  title,
  message,
  cta,
  href,
  icon: Icon,
  className = "",
}: PromoModuleProps) {
  return (
    <section
      className={[
        "rounded-2xl border border-[color:var(--color-outline-variant)] bg-surface",
        "p-4 tablet:p-5 shadow-elevation-1",
        className,
      ].join(" ")}
    >
      <div className="flex items-center gap-4">
        <div className="w-20 shrink-0 tablet:w-24">
          <PromoArt art={art} alt="" sizes="96px" />
        </div>

        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 text-caption font-medium text-on-surface-variant">
            <Icon size={14} />
            {title}
          </span>
          <p className="mt-1 text-caption leading-relaxed text-muted line-clamp-2">
            {message}
          </p>
          <Link
            href={href}
            className="mt-2 inline-flex items-center gap-1 rounded-small text-caption font-semibold text-primary-700 transition-colors hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {cta}
            <IconChevronLeft size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
