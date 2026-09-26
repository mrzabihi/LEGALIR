// ============================================================
// LEGALIR — Service banner
// ============================================================
// The six service promotions. Lighter than a campaign banner and
// heavier than a catalog card: a tinted gradient surface, a gradient
// icon chip, a headline, one benefit line and an inline CTA.
//
// The tint is a *soft* wash of the service's own gradient rather than
// a full-bleed panel, so six of them in a grid never shout over the
// primary campaign above them.
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

  const accentVars = {
    "--sb-accent": banner.accent,
    "--sb-ink": `color-mix(in srgb, ${banner.accent} 80%, var(--color-on-surface))`,
    "--sb-soft": `color-mix(in srgb, ${banner.accent} 10%, transparent)`,
    "--sb-soft-strong": `color-mix(in srgb, ${banner.accent} 20%, transparent)`,
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
      className="group relative flex h-full flex-col overflow-hidden rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface p-5 transition-all duration-short4 ease-standard hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--sb-accent)_38%,transparent)] hover:shadow-elevation-3 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sb-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)] touch-target"
    >
      {/* Soft gradient wash — the "banner" cue, kept low-contrast so the
          text above it stays the loudest thing in the tile. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${banner.gradient} opacity-[0.10] transition-opacity duration-short4 ease-standard group-hover:opacity-[0.16]`}
      />
      {/* Accent rail on the leading edge. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 start-0 w-1 bg-gradient-to-b ${banner.gradient}`}
      />

      <div className="relative flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${banner.gradient} text-white shadow-elevation-1 transition-transform duration-short4 ease-standard group-hover:scale-[1.04]`}
          aria-hidden="true"
        >
          <Icon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-body-1 font-semibold text-on-surface">{banner.title}</h3>
          <p className="mt-1 text-caption leading-relaxed text-on-surface-variant">
            {banner.message}
          </p>
        </div>
      </div>

      <span className="relative mt-4 inline-flex items-center gap-1.5 self-start text-labelLarge font-medium text-[var(--sb-ink)]">
        {banner.cta}
        <IconChevronRight
          size={16}
          className="transition-transform duration-short4 ease-standard group-hover:-translate-x-0.5"
        />
      </span>
    </Link>
  );
}
