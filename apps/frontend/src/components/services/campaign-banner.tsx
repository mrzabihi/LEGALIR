// ============================================================
// LEGALIR — Campaign banner
// ============================================================
// The marketing treatment for /services. Deliberately *not* a service
// card with a bigger background: it is a full-bleed gradient panel
// with a code-native illustration, an eyebrow that names the
// experience, a headline, one supporting line and exactly one CTA.
//
// Composition rules (from the clickable-banner brief):
//   • one message, one action — never two competing CTAs
//   • the headline is the largest text; the CTA is the only filled
//     button in the panel
//   • the illustration never sits under the text on mobile — it moves
//     to its own band so nothing is cropped or obscured
//   • all copy is selectable HTML, never baked into the artwork
//
// Sizes:
//   hero    — the primary campaign near the top of the page
//   panel   — the secondary treatment between catalog sections
//   compact — the narrow strip beside a card row
//   wide    — the full-width, deliberately short feature banner that
//             leads the new-services section. Copy and artwork sit side
//             by side from `tablet` up; on a phone the artwork drops to
//             its own band below the copy so the CTA is never covered.
//
// Motion: the illustration drifts (`animate-float`) and the panel
// reveals on scroll. Both collapse under `prefers-reduced-motion`.
// ============================================================

"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { IconChevronRight } from "@/lib/icons";
import { BANNER_ART } from "./banner-art";
import { Reveal } from "./reveal";
import { trackServicesEvent, type CampaignBannerDef } from "@/lib/services/catalog";

interface CampaignBannerProps {
  banner: CampaignBannerDef;
  size?: "hero" | "panel" | "compact" | "wide";
  className?: string;
}

export function CampaignBanner({
  banner,
  size = "panel",
  className = "",
}: CampaignBannerProps) {
  const Art = BANNER_ART[banner.art];
  const Icon = banner.icon;
  const isHero = size === "hero";
  const isCompact = size === "compact";
  const isWide = size === "wide";

  // One accent → the illustration tint and the CTA fill. The panel
  // surface itself comes from the banner's own gradient so each
  // campaign reads as its own piece of art.
  const accentVars = {
    "--cb-accent": banner.accent,
    "--cb-ink": `color-mix(in srgb, ${banner.accent} 88%, #FFFFFF)`,
  } as CSSProperties;

  function handleClick() {
    trackServicesEvent("services_banner_click", {
      bannerId: banner.id,
      destination: banner.href,
    });
  }

  return (
    <Reveal className={className}>
      <section
        aria-labelledby={`${banner.id}-title`}
        style={accentVars}
        className={[
          "relative isolate overflow-hidden rounded-xlarge bg-gradient-to-br text-white shadow-elevation-3",
          banner.gradient,
          isHero
            ? "p-5 tablet:p-7 laptop:p-8"
            : isWide
              ? "p-5 tablet:p-6 laptop:p-7"
              : isCompact
                ? "p-5"
                : "p-5 tablet:p-6",
        ].join(" ")}
      >
        {/* Ambient light — decorative, keeps the flat gradient from
            reading as a plain rectangle. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -end-16 h-64 w-64 rounded-full bg-[var(--cb-ink)] opacity-[0.14] blur-3xl"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -start-20 h-64 w-64 rounded-full bg-black opacity-[0.18] blur-3xl"
        />

        <div
          className={[
            "relative grid items-center gap-5",
            isWide
              ? "tablet:grid-cols-[minmax(0,1fr)_minmax(0,240px)] tablet:gap-6 laptop:grid-cols-[minmax(0,1fr)_minmax(0,300px)] laptop:gap-8"
              : isCompact
                ? "tablet:grid-cols-[1fr_auto]"
                : "laptop:grid-cols-[minmax(0,1fr)_minmax(0,340px)] laptop:gap-8",
          ].join(" ")}
        >
          {/* ---- Copy ---- */}
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-caption font-medium text-white backdrop-blur-sm">
              <Icon size={14} />
              {banner.eyebrow}
            </span>

            <h2
              id={`${banner.id}-title`}
              className={[
                "mt-3 font-bold leading-snug text-white",
                isHero ? "text-h2" : isWide ? "text-h3" : isCompact ? "text-h4" : "text-h3",
              ].join(" ")}
            >
              {banner.title}
            </h2>

            <p
              className={[
                "mt-2 leading-relaxed text-white/80",
                isHero ? "text-body-1 max-w-xl" : "text-body-2 max-w-lg",
              ].join(" ")}
            >
              {banner.message}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href={banner.href}
                onClick={handleClick}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-button font-semibold text-primary-800 shadow-elevation-1 transition-all duration-short4 ease-standard hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-800 touch-target"
              >
                {banner.cta}
                <IconChevronRight size={16} />
              </Link>

              {/* Names the experience the CTA opens, so the AI
                  «مشاوره حقوقی» service and the human-lawyer campaign
                  can never be confused for one another. */}
              <span className="text-caption text-white/70">{banner.experience}</span>
            </div>
          </div>

          {/* ---- Artwork ---- */}
          {/* On mobile the art gets its own band rather than sitting
              behind the copy, so the headline and CTA are never covered.
              `wide` keeps the art in the trailing cell from `tablet` up
              and only stacks it below the copy on a phone. */}
          <div
            aria-hidden="true"
            className={[
              "pointer-events-none flex items-center justify-center text-[var(--cb-ink)]",
              isCompact ? "hidden tablet:flex" : "",
            ].join(" ")}
          >
            <Art
              className={[
                "h-auto w-full",
                isHero
                  ? "max-w-[280px] tablet:max-w-[340px]"
                  : isWide
                    ? "max-w-[200px] tablet:max-w-[220px] laptop:max-w-[260px]"
                    : isCompact
                      ? "max-w-[180px]"
                      : "max-w-[240px] tablet:max-w-[300px]",
              ].join(" ")}
            />
          </div>
        </div>
      </section>
    </Reveal>
  );
}
