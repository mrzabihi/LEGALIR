// ============================================================
// LEGALIR — Featured service card
// ============================================================
// The six «خدمات پرکاربرد» cards. One coherent family: identical
// surface, illustration band, icon chip, heading style and CTA
// placement, so the row reads as a set rather than six unrelated tiles.
//
// Card anatomy (top → bottom):
//   1. an illustration band — a soft accent wash carrying the service's
//      line-art illustration, with a small tinted icon chip pinned to
//      the top-start corner
//   2. the title and description
//   3. a full-width tonal action bar pinned to the card's bottom edge
//
// The accent still identifies the service, but quietly: one raw accent
// per service drives the band wash, the icon chip, the illustration ink
// and the action bar. The card surface itself stays neutral, so six
// different hues never read as visual chaos.
//
// The whole card is the link, so the CTA is a styled `<span>` — never a
// nested anchor, which would be invalid markup and a second tab stop.
// ============================================================

"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { IconChevronRight } from "@/lib/icons";
import { trackServicesEvent, type ServiceBannerDef } from "@/lib/services/catalog";
import { serviceArtKey } from "@/lib/services/presentation";
import { SERVICE_ART } from "./service-art";

interface ServiceBannerProps {
  banner: ServiceBannerDef;
}

export function ServiceBanner({ banner }: ServiceBannerProps) {
  const Icon = banner.icon;
  const artKey = serviceArtKey(banner.id);
  const Art = artKey ? SERVICE_ART[artKey] : null;

  // One accent → four derived tones. `--sb-ink` mixes toward the
  // theme's on-surface colour so the glyph and the illustration stay
  // legible in light AND dark mode without a second hand-tuned colour
  // per service.
  //
  // The mix is 55% accent, not more: the light accents (gold #D89A13,
  // green #32B183) only clear WCAG AA 4.5:1 against their own 14% tint
  // once the ink is pulled this far toward on-surface. At 72% the gold
  // and green CTAs measured 3.67:1 and 3.91:1 — legible but failing.
  const accentVars = {
    "--sb-accent": banner.accent,
    "--sb-ink": `color-mix(in srgb, ${banner.accent} 55%, var(--color-on-surface))`,
    "--sb-soft": `color-mix(in srgb, ${banner.accent} 14%, transparent)`,
    "--sb-soft-strong": `color-mix(in srgb, ${banner.accent} 24%, transparent)`,
  } as CSSProperties;

  return (
    <Link
      href={banner.href}
      onClick={() =>
        trackServicesEvent("services_banner_click", {
          bannerId: banner.id,
          destination: banner.href,
        })
      }
      style={accentVars}
      className="group relative flex h-full flex-col overflow-hidden rounded-large border border-[color:var(--color-outline-variant)] bg-surface transition-all duration-short4 ease-standard hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--sb-accent)_38%,transparent)] hover:shadow-elevation-3 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sb-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)] touch-target"
    >
      {/* 1. Illustration band — soft accent wash + line art + icon chip. */}
      <div className="relative h-32 w-full shrink-0 overflow-hidden bg-[var(--sb-soft)] tablet:h-36">
        {/* Small tinted icon chip, pinned to the top-start corner. */}
        <span
          aria-hidden="true"
          className="absolute start-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-medium bg-[var(--sb-soft-strong)] text-[var(--sb-ink)] shadow-elevation-1 transition-transform duration-short4 ease-standard group-hover:scale-[1.05]"
        >
          <Icon size={20} />
        </span>

        {Art && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[var(--sb-ink)] transition-transform duration-short4 ease-standard group-hover:scale-[1.03]"
          >
            <Art className="h-full w-full" />
          </span>
        )}
      </div>

      {/* 2. Copy */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-titleMedium font-semibold text-on-surface">{banner.title}</h3>
        <p className="mt-1.5 text-body-2 leading-relaxed text-on-surface-variant">
          {banner.message}
        </p>

        {/* 3. CTA — full-width tonal bar, pinned to the bottom so all six
            cards align regardless of description length. */}
        <span className="mt-auto block pt-5">
          <span className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-medium bg-[var(--sb-soft)] px-4 text-labelLarge font-semibold text-[var(--sb-ink)] transition-colors duration-short4 ease-standard group-hover:bg-[var(--sb-soft-strong)]">
            {banner.cta}
            <IconChevronRight
              size={18}
              className="shrink-0 transition-transform duration-short4 ease-standard group-hover:-translate-x-0.5"
            />
          </span>
        </span>
      </div>
    </Link>
  );
}
