// ============================================================
// LEGALIR — Landing «خدمات هوشمند» grid (the seven real services)
// ============================================================
// The landing claims «۷ سرویس». That number is not marketing copy: it is
// the inventory that already ships in the product —
//
//   • the six rows of `LEGAL_SERVICES` (the registry every in-app surface
//     reads), and
//   • «جستجوی قوانین» — the seventh `ServiceType`, whose real surface is
//     the legal library's search (`/legal-library`).
//
// Nothing here invents a service name, description or destination. Titles
// and descriptions come from the registry / `SERVICE_CONTEXTS`; the only
// hand-written strings are the action labels, and each one names the next
// step instead of repeating the title.
//
// One route is deliberately resolved to its real product surface instead
// of the registry's raw href: «محاسبات حقوقی» → /calculators, the
// calculator hub that owns calculator selection. That is the same choice
// the dashboard's quick-access row makes; `/chat?service=legal_calculation`
// would drop the visitor into a chat instead of the calculators.
//
// Presentation follows the page's own token layer (`--ln-*`) rather than
// the app's MD3 tokens, so the marketing surface keeps its identity. Each
// card derives every tint from ONE brand accent with `color-mix`, exactly
// like `quick-access.tsx`, so seven hues never read as seven designs.
//
// The illustrations are the shared, code-native service art (`SERVICE_ART`)
// already used by /services and the dashboard — the same drawing for the
// same service on every surface. They are watermarked at low opacity and
// never compete with the title, description or action.
//
// This is a client component on purpose. `SERVICE_ART` is an object of
// components exported from a `"use client"` module; a server component
// only receives a client *reference* for the export, so `SERVICE_ART[id]`
// resolves to nothing and the illustrations silently disappear. The
// dashboard's `quick-access.tsx` lives on the client for the same reason.
// No data is fetched here — the registry is plain module data.

"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { SERVICE_ART } from "@/components/services/service-art";
import { getServiceById, type LegalService, type ServiceIcon } from "@/lib/services";
import { serviceArtKey } from "@/lib/services/presentation";
import { SERVICE_CONTEXTS, type ServiceType } from "@/lib/ai/service-context";
import { IconChevronLeft, IconLawBook } from "@/lib/icons";

interface LandingService {
  id: string;
  title: string;
  description: string;
  href: string;
  accent: string;
  icon: ServiceIcon;
  /** Names the next step — never a generic «بیشتر». */
  action: string;
}

/**
 * Display order. Consultation leads (it is the primary entry point and
 * also the featured card), then the document family, then the utilities.
 * `legal_calculation` resolves to the calculator hub below.
 */
const SERVICE_ORDER: ServiceType[] = [
  "legal_consultation",
  "document_analysis",
  "contract_review",
  "contract_drafting",
  "legal_notice",
  "legal_calculation",
];

const ACTION_LABEL: Record<string, string> = {
  legal_consultation: "شروع مشاوره",
  document_analysis: "تحلیل سند",
  contract_review: "بررسی قرارداد",
  contract_drafting: "ساخت قرارداد",
  legal_notice: "تنظیم اظهارنامه",
  legal_calculation: "محاسبه کنید",
  law_search: "جستجو در قوانین",
};

/** Real product surface for the calculator service. */
const CALCULATOR_HREF = "/calculators";

/**
 * The registry carries one accent hue per service (green, crimson, gold…),
 * which is right inside the app where a service's colour is its identity.
 * On the landing page it is not: the editorial direction allows exactly one
 * accent — cobalt — and no red / gold / green in marketing surfaces. So the
 * grid is printed in ink: icons, tiles and watermarks all derive from
 * `#111111`, and the only coloured thing in a card is its action label.
 *
 * Nothing about the registry itself changes; only the accent this page
 * draws from it.
 */
const LANDING_ACCENT = "#111111";

/** The seventh `ServiceType`; its real surface is the library's search. */
const LAW_SEARCH_CONTEXT = SERVICE_CONTEXTS["law_search"];

const LAW_SEARCH: LandingService = {
  id: "law_search",
  title: LAW_SEARCH_CONTEXT.label,
  description: LAW_SEARCH_CONTEXT.description,
  href: "/legal-library",
  // Printed in the same ink as the other six: one accent per page, not one
  // per card. The in-app library keeps its own gold.
  accent: LANDING_ACCENT,
  icon: IconLawBook,
  action: ACTION_LABEL["law_search"] ?? "جستجو در قوانین",
};

const REGISTRY_SERVICES: LandingService[] = SERVICE_ORDER.map((id) =>
  getServiceById(id)
)
  .filter((service): service is LegalService => Boolean(service))
  .map((service) => ({
    id: service.id,
    title: service.title,
    description: service.description,
    href: service.id === "legal_calculation" ? CALCULATOR_HREF : service.href,
    accent: LANDING_ACCENT,
    icon: service.icon,
    action: ACTION_LABEL[service.id] ?? "شروع کنید",
  }));

const SERVICES: LandingService[] = [...REGISTRY_SERVICES, LAW_SEARCH];

/**
 * One accent → four derived tones. `--ls-ink` is pulled 55% toward the
 * page ink (the same ratio the app's service cards use) so the action
 * label clears WCAG AA on its own tint for the light accents (gold,
 * green, crimson) as well as the dark ones.
 */
function accentVars(accent: string): CSSProperties {
  return {
    "--ls-accent": accent,
    "--ls-ink": `color-mix(in srgb, ${accent} 55%, var(--ln-ink))`,
    "--ls-tile": `color-mix(in srgb, ${accent} 10%, transparent)`,
    "--ls-tile-strong": `color-mix(in srgb, ${accent} 18%, transparent)`,
    "--ls-dim": `color-mix(in srgb, ${accent} 7%, transparent)`,
  } as CSSProperties;
}

// ============================================================
// Featured card — consultation, the primary entry point
// ============================================================

function FeaturedServiceCard({ service }: { service: LandingService }) {
  const Icon = service.icon;
  const artKey = serviceArtKey(service.id);
  const Art = artKey ? SERVICE_ART[artKey] : null;

  return (
    <article
      style={accentVars(service.accent)}
      className="landing-card relative overflow-hidden p-5 tablet:col-span-3 tablet:flex-row tablet:items-center tablet:justify-between tablet:gap-6 tablet:p-6 laptop:gap-8 laptop:p-7"
    >
      <div className="relative min-w-0">
        {/* Phones: icon and title share a row — one band of height saved on
            the first card of the page, which matters most at 390px. */}
        <div className="flex items-center gap-3 tablet:block">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--ln-r-sm)]"
            style={{ background: "var(--ls-tile-strong)", color: "var(--ls-ink)" }}
          >
            <Icon size={22} />
          </span>

          <h3 className="text-[18px] font-bold leading-8 text-[color:var(--ln-navy)] tablet:mt-4 tablet:text-[21px]">
            {service.title}
          </h3>
        </div>

        <p className="mt-2 max-w-md text-[13.5px] leading-7 text-[color:var(--ln-muted)] tablet:mt-2">
          {service.description}
        </p>

        <Link
          href={service.href}
          className="landing-btn landing-btn--primary mt-4 w-full mobile-l:mt-5 mobile-l:w-auto"
        >
          {service.action}
          <IconChevronLeft size={18} aria-hidden="true" />
        </Link>
      </div>

      {/* Art panel — the shared illustration at a readable size. Phones
          keep the copy-only card; from `tablet` the panel fills the wide
          side of the featured card instead of leaving it empty. */}
      <div
        aria-hidden="true"
        className="pointer-events-none relative hidden h-[7rem] w-[10rem] shrink-0 items-center justify-center rounded-[var(--ln-r-md)] tablet:flex laptop:h-[8.5rem] laptop:w-[12rem]"
        style={{ background: "var(--ls-tile)", color: "var(--ls-ink)" }}
      >
        {Art && <Art className="h-full w-full" />}
      </div>
    </article>
  );
}

// ============================================================
// Standard card
// ============================================================

function ServiceCard({ service, index }: { service: LandingService; index: number }) {
  const Icon = service.icon;
  const artKey = serviceArtKey(service.id);
  const Art = artKey ? SERVICE_ART[artKey] : null;

  return (
    <Link
      href={service.href}
      data-ln-reveal={String(index % 3)}
      style={accentVars(service.accent)}
      className="landing-card group relative overflow-hidden p-4 tablet:p-5"
    >
      {/* Faint shared illustration — texture, never a competing subject. */}
      {Art && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-4 -end-5 hidden tablet:block"
          style={{ color: "var(--ls-dim)" }}
        >
          <Art className="h-24 w-32" />
        </span>
      )}

      <div className="relative flex flex-1 flex-col">
        {/* Phones: icon beside the copy, so one card is ~120px instead of
            ~200px and the section does not become seven screens of scroll.
            From `tablet` the icon sits above the title, the taller card the
            3-up grid can afford. */}
        <div className="flex items-start gap-3 tablet:block">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ln-r-md)] transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
            style={{ background: "var(--ls-tile)", color: "var(--ls-ink)" }}
          >
            <Icon size={20} />
          </span>

          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-7 text-[color:var(--ln-navy)] tablet:mt-3">
              {service.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-6 text-[color:var(--ln-muted)] tablet:mt-1.5">
              {service.description}
            </p>
          </div>
        </div>

        {/* One action per card, pinned to the bottom so unequal descriptions
            never misalign a row.

            The label is brand green, not the service accent. Tinting it with
            the accent made «محاسبه کنید» render crimson — a colour that reads
            as "error/destructive" on a marketing card. The accent still
            identifies the service on its icon tile and watermark; every
            action on the page uses the same green, so the reader learns one
            affordance instead of seven. */}
        <span className="mt-auto flex items-center gap-1.5 pt-2.5 text-[12.5px] font-semibold text-[color:var(--ln-green)] tablet:pt-3">
          {service.action}
          <IconChevronLeft
            size={15}
            aria-hidden="true"
            className="transition-transform duration-300 group-hover:-translate-x-0.5 motion-reduce:transition-none"
          />
        </span>
      </div>
    </Link>
  );
}

// ============================================================
// Section body
// ============================================================

export function LandingServices() {
  const featured = SERVICES[0];

  // One column on phones: at 390px a two-up splits each card to ~165px and
  // the two-line description truncates mid-clause, which reads as broken
  // copy. Full-width cards keep every description intact and leave the
  // action row a comfortable tap target.
  return (
    <div className="mt-10 grid grid-cols-1 gap-3 tablet:mt-12 tablet:grid-cols-3 tablet:gap-4">
      {featured && <FeaturedServiceCard service={featured} />}
      {SERVICES.slice(1).map((service, index) => (
        <ServiceCard key={service.id} service={service} index={index} />
      ))}
    </div>
  );
}
