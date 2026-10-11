// ============================================================
// LEGALIR — Photographic campaign banner
// ============================================================
// The full-bleed *photo* sibling of `CampaignBanner`. Where that one
// paints a brand gradient behind a code-native illustration, this one
// places a real photograph behind the copy — so the campaign reads as
// an editorial hero rather than a flat colour panel.
//
// The photo is the panel: it spans the whole surface and the copy sits
// over its quiet side. Every rule below exists to keep the (always
// selectable) HTML legible on top of a busy image:
//
//   • the subject stays on one side and the copy takes the other —
//     never a face behind a headline;
//   • a directional scrim darkens only the copy side, fading to
//     transparent over the subject, so the photo is never muted
//     everywhere just to buy contrast;
//   • on a phone the photo keeps its subject framed and the copy drops
//     to the bottom band behind a bottom-up scrim;
//   • a hairline + inner ring lift the panel off the page.
//
// Motion + light (the brief's «افکت نوری و موشن»): a slow ken-burns
// drift on the photo, a soft diagonal sheen that sweeps across the
// panel, and two drifting brand-accent blooms. All decorative, all
// collapsed under `prefers-reduced-motion` (see globals.css).
//
// All copy, CTAs and the eyebrow are the same markup as
// `CampaignBanner`, so switching a campaign between the two treatments
// never changes its words or its a11y contract.
// ============================================================

"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { IconChevronRight } from "@/lib/icons";
import { Reveal } from "./reveal";
import { trackServicesEvent, type CampaignBannerDef } from "@/lib/services/catalog";

interface CampaignPhotoBannerProps {
  banner: CampaignBannerDef;
  /** `hero` is the tall primary treatment; `wide` the shorter feature. */
  size?: "hero" | "wide";
  className?: string;
}

/** Deep brand teal-black used for every scrim stop — reads as «brand»,
 *  not as a neutral grey overlay. */
const SCRIM = "10,26,23";

/** `#RRGGBB` → `r,g,b` so a raw brand accent can drive an rgba() bloom. */
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16
  );
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export function CampaignPhotoBanner({
  banner,
  size = "hero",
  className = "",
}: CampaignPhotoBannerProps) {
  const photo = banner.photo;
  const Icon = banner.icon;
  const isHero = size === "hero";

  // `banner.photo` is optional on the shared type; a campaign only
  // reaches this component when it carries one, but guard anyway so a
  // mis-wire renders nothing rather than crashing the page.
  if (!photo) return null;

  const copySide = photo.copySide ?? "start";
  // RTL: `start` is the right edge, `end` the left.
  const to = copySide === "start" ? "left" : "right";

  const accentVars = {
    "--cb-accent": banner.accent,
    "--cb-accent-rgb": hexToRgb(banner.accent),
  } as CSSProperties;

  // Horizontal scrim: opaque on the copy side, fading to nothing over
  // the subject. Used from `tablet` up.
  const copyScrim = `linear-gradient(to ${to}, rgba(${SCRIM},0.96) 0%, rgba(${SCRIM},0.82) 30%, rgba(${SCRIM},0.38) 58%, rgba(${SCRIM},0) 84%)`;
  // Vertical scrim: the phone layout, copy over the bottom band.
  const bottomScrim = `linear-gradient(to top, rgba(${SCRIM},0.97) 0%, rgba(${SCRIM},0.84) 34%, rgba(${SCRIM},0.34) 64%, rgba(${SCRIM},0) 90%)`;
  // Brand grade — a whisper of teal-green so the photo feels on-brand.
  const brandGrade =
    "linear-gradient(118deg, rgba(29,98,78,0.30) 0%, rgba(34,46,45,0.12) 46%, transparent 72%)";

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
          "relative isolate overflow-hidden rounded-xlarge text-white shadow-elevation-3",
          "ring-1 ring-inset ring-white/10",
          isHero
            ? "min-h-[460px] tablet:min-h-[400px] laptop:min-h-[440px]"
            : "min-h-[440px] tablet:min-h-[340px] laptop:min-h-[380px]",
        ].join(" ")}
      >
        {/* ---- 1. The photograph ---- */}
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
          className="animate-banner-kenburns absolute inset-0 -z-10 h-full w-full object-cover"
        />

        {/* ---- 2. Scrims ---- */}
        {/* Phone: bottom-up band behind the copy. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 tablet:hidden"
          style={{ background: bottomScrim }}
        />
        {/* Tablet and up: directional, copy side dark → subject clear. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 hidden tablet:block"
          style={{ background: copyScrim }}
        />
        {/* Brand grade over the whole panel. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{ background: brandGrade }}
        />

        {/* ---- 3. Moving light ---- */}
        {/* Accent bloom on the copy side. */}
        <span
          aria-hidden="true"
          className={[
            "animate-banner-bloom pointer-events-none absolute -z-10 h-72 w-72 rounded-full blur-3xl",
            "bg-[radial-gradient(circle,rgba(var(--cb-accent-rgb),0.5)_0%,transparent_68%)]",
            copySide === "start" ? "-end-16 -top-20" : "-start-16 -top-20",
          ].join(" ")}
        />
        {/* Deep teal bloom, opposite corner, for depth. */}
        <span
          aria-hidden="true"
          style={{ animationDelay: "-5s" }}
          className={[
            "animate-banner-bloom pointer-events-none absolute -z-10 h-64 w-64 rounded-full blur-3xl",
            "bg-[radial-gradient(circle,rgba(34,46,45,0.6)_0%,transparent_70%)]",
            copySide === "start" ? "-start-20 -bottom-24" : "-end-20 -bottom-24",
          ].join(" ")}
        />
        {/* Diagonal sheen that sweeps across the panel. */}
        <span
          aria-hidden="true"
          className="animate-banner-sheen pointer-events-none absolute inset-y-[-20%] -z-10 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)]"
        />

        {/* ---- 4. Copy ---- */}
        <div
          className={[
            "relative z-10 flex h-full min-h-[inherit] flex-col justify-end gap-4 p-5 tablet:p-7 laptop:p-8",
            "tablet:justify-center",
            copySide === "start" ? "tablet:items-start" : "tablet:items-end",
          ].join(" ")}
        >
          <div className="w-full max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-caption font-medium text-white backdrop-blur-sm">
              <Icon size={14} />
              {banner.eyebrow}
            </span>

            <h2
              id={`${banner.id}-title`}
              className={[
                "mt-3 font-bold leading-snug text-white drop-shadow-[0_1px_12px_rgba(0,0,0,0.55)]",
                isHero ? "text-h2" : "text-h3",
              ].join(" ")}
            >
              {banner.title}
            </h2>

            <p
              className={[
                "mt-2 leading-relaxed text-white/85 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]",
                isHero ? "text-body-1 max-w-xl" : "text-body-2 max-w-lg",
              ].join(" ")}
            >
              {banner.message}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={banner.href}
                onClick={handleClick}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-button font-semibold text-primary-800 shadow-elevation-3 transition-all duration-short4 ease-standard hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-900 touch-target"
              >
                {banner.cta}
                <IconChevronRight size={16} />
              </Link>

              <span className="text-caption text-white/75 drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)]">
                {banner.experience}
              </span>
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
