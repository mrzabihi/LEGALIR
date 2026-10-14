// ============================================================
// LEGALIR — Discovery entry card («نمی‌دونی از کجا شروع کنی؟»)
// ============================================================
// The shared, prominent entry point for the legal-path discovery flow. It is
// used on the dashboard and on /services and is deliberately ONE component so
// the two surfaces can never drift apart.
//
// It is a pure invitation: a short title, a one-line promise and a single CTA
// into the real intake (/new). When the user has an unfinished draft from a
// previous visit, it offers to resume it (from the same localStorage hand-off
// the intake writes) instead of a cold start. It fabricates nothing and links
// only to routes that exist.
//
// Material 3, brand-aligned: one surface, one accent, restrained elevation.
// ============================================================

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconSparkle, IconArrowBack } from "@/lib/icons";
import { useIsHydrated } from "@/hooks/useIsHydrated";
import { readSuggestLawDraft, SUGGEST_LAW_PATH } from "@/lib/intake/start-request";

/**
 * The brand "network" artwork behind the card — the LEGALIR ivory field with
 * green waves and gold/ink network nodes. Sourced from
 * `Documents/poster/legalir-network.jpg` and pre-optimised into a light 640w
 * derivative for phones and the 1280w file from tablet up. Decorative only
 * (`alt=""` + `aria-hidden`), so it is invisible to assistive tech; the real
 * copy always sits above it on an opaque surface scrim.
 */
const BACKDROP_SRC = "/assets/discovery/legalir-network.webp";
const BACKDROP_SRC_SM = "/assets/discovery/legalir-network-sm.webp";

export interface DiscoveryEntryCardProps {
  /** Optional className for surface-specific spacing. */
  className?: string;
  /** `panel` (default) is the full card; `compact` trims padding for tight rails. */
  variant?: "panel" | "compact";
}

export function DiscoveryEntryCard({ className, variant = "panel" }: DiscoveryEntryCardProps) {
  const hydrated = useIsHydrated();
  // Only read storage after hydration so the server HTML and the first client
  // render match (the draft lives purely client-side).
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    setHasDraft(readSuggestLawDraft() !== null);
  }, [hydrated]);

  const compact = variant === "compact";

  return (
    <section
      className={[
        "discovery-card rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface shadow-elevation-1",
        "transition-shadow duration-short4 ease-standard hover:shadow-elevation-3",
        "bg-gradient-to-l from-primary-container/40 to-transparent",
        compact ? "p-4" : "p-5 tablet:p-6",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      dir="rtl"
      aria-labelledby="discovery-entry-title"
    >
      {/* Decorative background — the brand network artwork clipped to the
          card radius, a theme-aware surface scrim keeping the copy legible,
          a faint drifting sheen, and one breathing brand-green aura that
          lives just outside the card edge. All four are inert and
          `aria-hidden`; none changes the card's height, so there is no CLS. */}
      <span aria-hidden="true" className="discovery-card-halo" />
      <span aria-hidden="true" className="discovery-card-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BACKDROP_SRC}
          srcSet={`${BACKDROP_SRC_SM} 640w, ${BACKDROP_SRC} 1280w`}
          sizes="(min-width: 900px) 900px, 100vw"
          alt=""
          width={1280}
          height={720}
          decoding="async"
        />
        <span className="discovery-card-scrim" />
        <span className="discovery-card-sheen" />
      </span>

      <div className="relative z-[1] flex items-start gap-4">
        <span
          aria-hidden="true"
          className={[
            "flex shrink-0 items-center justify-center rounded-large",
            "bg-primary-container text-primary",
            compact ? "h-11 w-11" : "h-14 w-14",
          ].join(" ")}
        >
          <IconSparkle size={compact ? 22 : 28} />
        </span>

        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center rounded-full bg-primary-container px-2.5 py-0.5 text-caption font-medium text-primary">
            مسیر هوشمند
          </span>
          <h2
            id="discovery-entry-title"
            className="mt-2 text-h4 font-semibold text-on-surface"
          >
            نمی‌دونی از کجا شروع کنی؟
          </h2>
          <p className="mt-1.5 max-w-xl text-bodySmall leading-relaxed text-muted">
            فقط مسئله‌ات را توضیح بده. لیگالیر بررسی می‌کند چه راه‌هایی برای حلش داری و مناسب‌ترین قدم
            بعدی را به تو پیشنهاد می‌دهد.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/new"
              className="inline-flex items-center gap-2 rounded-medium bg-primary px-5 py-2.5 text-labelLarge font-medium text-primary-on transition hover:brightness-105 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-target"
            >
              پیدا کردن مسیر مناسب
            </Link>

            {hasDraft && (
              <Link
                href={SUGGEST_LAW_PATH}
                className="inline-flex items-center gap-1.5 rounded-medium border border-divider px-4 py-2.5 text-labelMedium text-on-surface transition hover:border-primary hover:bg-primary-container/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-target"
              >
                ادامهٔ درخواست ناتمام
                <IconArrowBack size={15} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
