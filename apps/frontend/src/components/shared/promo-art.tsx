// ============================================================
// LEGALIR — Promotional artwork system
// ============================================================
// One placement system for the six Legalir promotional illustrations.
// The source bitmaps are square (≈354×357) and opaque. Most are branded
// illustrations with the LEGALIR wordmark baked into the lower-left
// corner; "five" is instead a photographic editorial (a hand signing a
// document) with no baked wordmark. Two consequences drive every rule
// below:
//
//   • They are square, so they are never stretched into a wide hero
//     strip. Each one gets a square (or near-square) frame, or sits in
//     a split layout beside the copy.
//   • Where a wordmark is baked in, the adjacent HTML never repeats it
//     as a second identical heading; where it is not, the HTML copy
//     still stands on its own.
//
// Three treatments, one visual language (same radius, spacing and CTA
// styling):
//
//   PromoArt    — the framed square image itself
//   PromoPanel  — full-width editorial panel: image + copy + one CTA
//   PromoModule — the signed-in dashboard banner: a full-bleed photograph
//                 with the copy laid over its quiet side
//
// `PromoPanel` has a second skin: pass a `photo` and the image stops being
// a framed square beside the copy and becomes the section *background*,
// with the copy laid over its quiet side (used by the legal-sources
// section on /services). The square-art SVG path is untouched.
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

/** A full-bleed photographic background. When set, the photo *is* the
 *  panel and the copy sits over its quiet side; `art`/`imageSide` are then
 *  unused. Mirrors `BannerPhoto` in the services catalog. */
export interface PromoPanelPhoto {
  /** Full-resolution webp (≈1280w), path under `/public`. */
  src: string;
  /** Half-resolution webp (≈640w) for narrow viewports. */
  srcSm: string;
  /** Native pixel size of `src` — the frame's aspect ratio. */
  width: number;
  height: number;
  /** CSS `object-position` — which slice of the photo survives the crop,
   *  so the informative part stays framed at every breakpoint. */
  objectPosition: string;
  /** Which edge the copy hugs from `tablet` up. The photo's subject should
   *  sit on the *opposite* side. Defaults to `start` (the right in RTL). */
  copySide?: "start" | "end";
}

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
  /** When present, renders the photographic treatment instead of the
   *  framed square art — the image becomes the section background. */
  photo?: PromoPanelPhoto;
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
  photo,
  className = "",
}: PromoPanelProps) {
  const isFeature = size === "feature";

  // ---- Photographic treatment ----
  // The image is the section background and the copy sits over its quiet
  // side. The copy hugs the START edge (the right in RTL) — the side the
  // crop keeps — and a LIGHT ivory scrim sinks in from that same edge, so
  // the dark text keeps its contrast while the informative side of the
  // photo stays crisp. On a phone the copy spans the frame, so the veil is
  // stronger there and lighter from `tablet` up, where the copy already
  // sits over the quiet side.
  if (photo) {
    const copySide = photo.copySide ?? "start";
    const startClass = copySide === "start" ? "tablet:items-start" : "tablet:items-end";
    const to = copySide === "start" ? "left" : "right";
    const ivoryScrim = `linear-gradient(to ${to}, rgba(252,246,232,0.82) 0%, rgba(252,246,232,0.5) 42%, rgba(252,246,232,0) 80%)`;
    return (
      <section
        className={[
          "overflow-hidden rounded-xlarge border border-[color:var(--color-outline-variant)]",
          "bg-surface shadow-elevation-1",
          className,
        ].join(" ")}
      >
        <div className="relative isolate min-h-[300px] overflow-hidden tablet:min-h-[340px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            srcSet={`${photo.srcSm} ${Math.round(photo.width / 2)}w, ${photo.src} ${photo.width}w`}
            sizes="(min-width: 1024px) 1024px, 100vw"
            alt=""
            aria-hidden="true"
            width={photo.width}
            height={photo.height}
            loading="lazy"
            decoding="async"
            style={{ objectPosition: photo.objectPosition }}
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
          {/* Light coverage: a flat ivory veil lifts the whole photo off the
              page (stronger on phones, where the copy spans the frame), and
              a directional ivory scrim sinks in behind the copy so the dark
              text never fights the artwork. Both are LIGHT — the photo reads
              brighter, never muddier. */}
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[rgba(252,246,232,0.45)] tablet:bg-[rgba(252,246,232,0.22)]"
          />
          {/* Brand grade — a whisper of green/teal so the photo feels on-brand,
              never a neutral grey wash. */}
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(118deg,rgba(29,98,78,0.12)_0%,rgba(34,46,45,0.04)_46%,transparent_72%)]"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{ background: ivoryScrim }}
          />

          {/* Copy */}
          <div
            className={[
              "relative z-10 flex h-full min-h-[inherit] flex-col justify-center gap-4 p-5 tablet:p-7 laptop:p-8",
              startClass,
            ].join(" ")}
          >
            <div className="w-full max-w-xl">
              {/* The photo is a FIXED light surface, so every ink here is a
                  fixed brand colour — never a theme token. `text-on-surface`
                  would turn light in the dark theme and vanish on the ivory. */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_srgb,var(--brand-green)_24%,transparent)] bg-[color-mix(in_srgb,var(--brand-green)_10%,transparent)] px-3 py-1 text-caption font-medium text-[var(--brand-green)] backdrop-blur-sm">
                <Icon size={14} />
                {eyebrow}
              </span>

              <h2
                className={[
                  "mt-3 font-bold leading-snug text-[var(--brand-teal)]",
                  isFeature ? "text-h3 tablet:text-h2" : "text-h4 tablet:text-h3",
                ].join(" ")}
              >
                {title}
              </h2>

              <p
                className={[
                  "mt-2 leading-relaxed text-[color-mix(in_srgb,var(--brand-teal)_82%,transparent)]",
                  isFeature ? "text-body-1 max-w-xl" : "text-body-2 max-w-lg",
                ].join(" ")}
              >
                {message}
              </p>

              <Link
                href={href}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--brand-green)] px-5 py-2.5 text-button font-semibold text-[var(--brand-ivory)] shadow-elevation-2 transition-[background-color,transform] duration-short4 ease-standard hover:bg-[color-mix(in_srgb,var(--brand-green)_88%,black)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)] focus-visible:ring-offset-2 touch-target"
              >
                {cta}
                <IconChevronLeft size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

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
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-button font-semibold text-primary-on shadow-elevation-1 transition-colors hover:bg-primary-700 hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 touch-target"
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
// PromoModule — the dashboard photo banner
// ------------------------------------------------------------
// A full-bleed photographic banner: the poster *is* the surface and the copy
// sits over its quiet side. The image is a plain `<img>` cropped with
// `object-cover` (the picture equivalent of `background-size: cover`) and a
// responsive `object-position` (of `background-position`), so the subject
// stays framed at every breakpoint. A single dark scrim — a flat tint
// beneath a directional wash, heaviest where the copy sits — keeps the
// light, gold-tinted text legible while the artwork stays clearly visible.
//
// Every ink over the photograph is a FIXED brand colour, never a theme
// token: the poster is a permanent dark-green surface, so `text-on-surface`
// would flip light in the dark theme and vanish. Interaction is a whisper —
// a hairline that warms, a faint lift, a ≤2% image drift — gated to fine
// pointers so touch never inherits a stuck hover, and neutralised under
// `prefers-reduced-motion`.

/** A full-bleed photographic background for the dashboard banner. */
export interface PromoModulePhoto {
  /** Full-resolution webp (≈1600w), path under `/public`. */
  src: string;
  /** Half-resolution webp (≈800w) for narrow viewports. */
  srcSm: string;
  /** Native pixel size of `src` — the frame's aspect ratio. */
  width: number;
  height: number;
  /**
   * CSS `object-position` on phones, where the frame is portrait and crops
   * hardest. From `tablet` up the wide frame matches the source aspect, so
   * the whole photo shows and this is unused.
   */
  objectPositionMobile: string;
  /**
   * Flat darkening across the whole photo, 0–1. Higher where the source is
   * brighter; it is the baseline that guarantees light text on any slice.
   */
  scrim: number;
  /** Which edge the copy hugs from `tablet` up. The photo's subject should
   *  sit on the *opposite* side. Defaults to `start` (the right in RTL). */
  copySide?: "start" | "end";
}

interface PromoModuleProps {
  eyebrow: string;
  title: string;
  message: string;
  cta: string;
  href: string;
  icon: IconComponent;
  photo: PromoModulePhoto;
  className?: string;
}

export function PromoModule({
  eyebrow,
  title,
  message,
  cta,
  href,
  icon: Icon,
  photo,
  className = "",
}: PromoModuleProps) {
  const copyStart = (photo.copySide ?? "start") === "start";
  const to = copyStart ? "left" : "right";
  // The wash sinks in from the copy edge, so the artwork side stays crisp.
  // Stronger on phones (copy spans the frame), lighter from `tablet` up.
  const washSm = `linear-gradient(to ${to}, rgba(18,30,28,0.82) 0%, rgba(18,30,28,0.46) 44%, rgba(18,30,28,0.12) 74%)`;
  const washLg = `linear-gradient(to ${to}, rgba(18,30,28,0.72) 0%, rgba(18,30,28,0.34) 42%, rgba(18,30,28,0.04) 70%)`;

  return (
    <section
      className={[
        "group relative isolate overflow-hidden rounded-large",
        "border border-[color:color-mix(in_srgb,var(--brand-gold)_22%,transparent)] bg-[#12211f]",
        "shadow-elevation-1",
        "transition-[transform,box-shadow,border-color] duration-short4 ease-standard motion-reduce:transition-none",
        "can-hover:hover:-translate-y-0.5",
        "can-hover:hover:border-[color:color-mix(in_srgb,var(--brand-gold)_48%,transparent)]",
        "can-hover:hover:shadow-elevation-3",
        className,
      ].join(" ")}
    >
      {/* Photograph: one asset, cropped two ways. Pinned away from the subject
          on phones, full frame from `tablet` up; the srcSet keeps it a single
          download at every width. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        srcSet={`${photo.srcSm} ${Math.round(photo.width / 2)}w, ${photo.src} ${photo.width}w`}
        sizes="(min-width: 1024px) 1104px, (min-width: 600px) 92vw, 100vw"
        alt=""
        aria-hidden="true"
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
        style={{ objectPosition: photo.objectPositionMobile }}
        className={[
          "absolute inset-0 -z-20 h-full w-full object-cover tablet:object-center",
          "transition-transform duration-long2 ease-standard motion-reduce:transition-none",
          "can-hover:group-hover:scale-[1.02]",
        ].join(" ")}
      />

      {/* Legibility scrim: a flat tint beneath a directional wash, both light
          on the artwork and heaviest where the copy sits, so the text clears
          WCAG AA over any slice of the photo. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ backgroundColor: `rgba(18,30,28,${photo.scrim})` }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 tablet:hidden"
        style={{ background: washSm }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 hidden tablet:block"
        style={{ background: washLg }}
      />
      {/* A hairline of light along the artwork edge so the panel reads as one
          crafted surface, never a flat rectangle. */}
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none absolute inset-y-0 -z-10 w-24 opacity-60",
          copyStart
            ? "end-0 bg-[linear-gradient(to_left,color-mix(in_srgb,var(--brand-gold)_12%,transparent),transparent)]"
            : "start-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--brand-gold)_12%,transparent),transparent)]",
        ].join(" ")}
      />

      {/* Copy: a column pinned to the copy side, capped so it never walks over
          the artwork on wide frames. */}
      <div className="relative z-10 flex min-h-[192px] flex-col justify-center p-5 tablet:min-h-[210px] tablet:p-7 laptop:min-h-[224px] laptop:p-8">
        <div
          className={[
            "w-full tablet:max-w-[560px]",
            copyStart ? "self-start text-start" : "self-end text-end",
          ].join(" ")}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_srgb,var(--brand-gold)_42%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-teal)_45%,transparent)] px-3 py-1 text-caption font-medium text-[var(--brand-ivory)] backdrop-blur-sm">
            <Icon size={14} />
            {eyebrow}
          </span>
          <h2 className="mt-3 max-w-xl text-h3 font-bold leading-snug text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)] tablet:text-h2">
            {title}
          </h2>

          <p className="mt-2 max-w-lg text-body-2 leading-relaxed text-[color-mix(in_srgb,var(--brand-ivory)_90%,transparent)] drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]">
            {message}
          </p>

          <Link
            href={href}
            className={[
              "mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--brand-gold)] px-5 py-2.5 text-button font-semibold text-[var(--brand-teal)]",
              "shadow-elevation-2 touch-target",
              "transition-[background-color,transform] duration-short4 ease-standard",
              "can-hover:hover:bg-[color-mix(in_srgb,var(--brand-gold)_88%,white)]",
              "active:scale-[0.98] active:bg-[color-mix(in_srgb,var(--brand-gold)_82%,white)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#12211f]",
            ].join(" ")}
          >
            {cta}
            <IconChevronLeft
              size={16}
              className="transition-transform duration-short4 ease-standard motion-reduce:transition-none can-hover:group-hover:-translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </section>
  );
}
