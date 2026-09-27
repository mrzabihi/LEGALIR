// ============================================================
// LEGALIR — Featured service card
// ============================================================
// The six «خدمات پرکاربرد» cards. One coherent family: identical
// surface, padding, icon scale, heading style and CTA placement, so
// the row reads as a set rather than six unrelated tiles.
//
// What changed from the previous treatment, and why:
//   • the per-card pastel wash and the coloured edge rail are gone —
//     six competing backgrounds were what made the row feel
//     fragmented. The surface is now uniform.
//   • the icon chip is *tonal* (a soft tint of the service accent with
//     an accent-coloured glyph) instead of a saturated gradient block.
//     The accent still identifies the service, but quietly.
//   • the description is `text-body-2` (14px), not `text-caption`
//     (12px), so it is readable rather than fine print.
//   • the CTA is a full-width tonal bar pinned to the card's bottom
//     edge, not a thin text row. It reads as an action, and because it
//     is `mt-auto` it lands on the same line in all six cards no matter
//     how the descriptions wrap.
//
// The whole card is the link, so the CTA is a styled `<span>` — never a
// nested anchor, which would be invalid markup and a second tab stop.
// ============================================================

"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { IconChevronRight } from "@/lib/icons";
import { trackServicesEvent, type ServiceBannerDef } from "@/lib/services/catalog";

interface ServiceBannerProps {
  banner: ServiceBannerDef;
}

export function ServiceBanner({ banner }: ServiceBannerProps) {
  const Icon = banner.icon;

  // One accent → three derived tones. `--sb-ink` mixes toward the
  // theme's on-surface colour so the glyph stays legible in light AND
  // dark mode without a second hand-tuned colour per service.
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
      className="group relative flex h-full flex-col rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-5 transition-all duration-short4 ease-standard hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--sb-accent)_38%,transparent)] hover:shadow-elevation-3 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sb-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)] touch-target"
    >
      {/* Tonal icon chip — the service's identifying accent, restrained. */}
      <span
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-medium bg-[var(--sb-soft)] text-[var(--sb-ink)] transition-transform duration-short4 ease-standard group-hover:scale-[1.04]"
      >
        <Icon size={24} />
      </span>

      <h3 className="mt-4 text-titleMedium font-semibold text-on-surface">{banner.title}</h3>
      <p className="mt-1.5 text-body-2 leading-relaxed text-on-surface-variant">
        {banner.message}
      </p>

      {/* CTA — full-width tonal bar, pinned to the bottom so all six
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
    </Link>
  );
}
