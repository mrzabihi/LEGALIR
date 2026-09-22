// ============================================================
// LEGALIR — Quick Access service launcher
// ============================================================
// Six equal product-style cards in one desktop row. Each card owns a
// single brand accent (from the service registry) that tints exactly
// three things: the icon container, the arrow affordance and a
// watermark illustration. The card surface itself stays neutral, so
// six different hues never read as visual chaos.
//
// All copy and hrefs come from the service registry — nothing here
// hard-codes service metadata.

"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { getServiceById, type LegalService } from "@/lib/services";
import type { ServiceType } from "@/lib/ai/service-context";
import { IconCalculator, IconChevronRight, IconServices } from "@/lib/icons";

/** One card's worth of presentation data. */
interface QuickAccessItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LegalService["icon"];
  accent: string;
  ariaLabel?: string;
}

/**
 * The calculator hub is a launcher, not a registry service — it links to
 * /calculators and lets the hub own calculator selection.
 */
const CALCULATOR_ITEM: QuickAccessItem = {
  id: "calculators",
  title: "محاسبه‌گر حقوقی",
  description: "دیه، مهریه و هزینه‌های حقوقی",
  href: "/calculators",
  icon: IconCalculator,
  accent: "#B6251E",
  ariaLabel: "ورود به محاسبه‌گرهای حقوقی",
};

/**
 * Display order for the registry-backed cards. `legal_calculation` is
 * deliberately absent — the calculator launcher above covers it, and
 * duplicating it would give the row seven cards.
 */
const QUICK_ACCESS_ORDER: ServiceType[] = [
  "document_analysis",
  "legal_notice",
  "contract_drafting",
  "contract_review",
  "legal_consultation",
];

const QUICK_ACCESS_ITEMS: QuickAccessItem[] = [
  CALCULATOR_ITEM,
  ...QUICK_ACCESS_ORDER.map((id) => getServiceById(id))
    .filter((s): s is LegalService => Boolean(s))
    .map((s) => ({
      id: s.id,
      title: s.title,
      description: s.subtitle,
      href: s.href,
      icon: s.icon,
      accent: s.accent,
    })),
];

// ============================================================
// QuickAccessServiceCard
// ============================================================

function QuickAccessServiceCard({ item }: { item: QuickAccessItem }) {
  const Icon = item.icon;

  // One accent → three derived tones. `--qa-ink` mixes toward the theme's
  // on-surface colour so the icon stays legible in light AND dark mode
  // without a second hand-tuned colour per service.
  const accentVars = {
    "--qa-accent": item.accent,
    "--qa-ink": `color-mix(in srgb, ${item.accent} 82%, var(--color-on-surface))`,
    "--qa-soft": `color-mix(in srgb, ${item.accent} 12%, transparent)`,
    "--qa-soft-strong": `color-mix(in srgb, ${item.accent} 22%, transparent)`,
  } as CSSProperties;

  return (
    <Link
      href={item.href}
      aria-label={item.ariaLabel}
      style={accentVars}
      className="group relative flex h-full flex-col overflow-hidden rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface-container-lowest p-4 transition-all duration-short4 ease-standard hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--qa-accent)_35%,transparent)] hover:shadow-elevation-3 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qa-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)] touch-target laptop:min-h-[196px] laptop:p-5"
    >
      {/* Watermark illustration — decorative only, clipped by the card edge. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 -right-3 hidden text-[var(--qa-ink)] opacity-[0.07] transition-opacity duration-short4 ease-standard group-hover:opacity-[0.12] tablet:block"
      >
        <Icon size={88} />
      </span>

      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-[var(--qa-soft)] text-[var(--qa-ink)] transition-transform duration-short4 ease-standard group-hover:scale-[1.03] laptop:h-12 laptop:w-12">
        <Icon size={24} />
      </div>

      <div className="mt-3 flex-1">
        <h3 className="text-body-2 font-semibold text-on-surface">{item.title}</h3>
        <p className="mt-1 text-caption leading-relaxed text-on-surface-variant line-clamp-2">
          {item.description}
        </p>
      </div>

      {/* Arrow affordance — the whole card is the real target. */}
      <span className="mt-3 inline-flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-full bg-[var(--qa-soft)] text-[var(--qa-ink)] transition-colors duration-short4 ease-standard group-hover:bg-[var(--qa-soft-strong)]">
        <IconChevronRight size={16} />
      </span>
    </Link>
  );
}

// ============================================================
// QuickActions — the «دسترسی سریع» section
// ============================================================

export function QuickActions() {
  return (
    <section className="mb-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-h3 font-bold text-on-surface">دسترسی سریع</h2>
          <p className="mt-1 text-caption text-on-surface-variant">
            خدمات محبوب لیگالیر در یک نگاه
          </p>
        </div>
        <Link
          href="/services"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)] px-3.5 py-2 text-caption font-medium text-on-surface-variant transition-colors duration-short3 ease-standard hover:bg-[color-mix(in_srgb,var(--color-on-surface)_6%,transparent)] hover:text-on-surface touch-target"
        >
          <IconServices size={16} />
          همه خدمات
          <IconChevronRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-2 items-stretch gap-3 tablet:grid-cols-3 laptop:grid-cols-6 desktop:gap-4">
        {QUICK_ACCESS_ITEMS.map((item) => (
          <QuickAccessServiceCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
