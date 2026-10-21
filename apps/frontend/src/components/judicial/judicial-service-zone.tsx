// ============================================================
// LEGALIR — Judicial service zone (discovery surfaces)
// ============================================================
// The section /services, /new and the home page show for the judicial
// document family. It is the same data the admin panel edits: the title,
// description, CTA and per-surface visibility all come from
// `GET /api/v1/judicial/services`, so toggling a surface in the admin moves
// the card here on the next load — no edit to any page.
//
// Two rules keep it honest:
//   • a service links only when its configured status AND feature flag AND
//     declared requirement all allow it, and when a real entry exists — the
//     drafting wizard for the four document families, the tracked intake for
//     the two provider services; otherwise the card explains and offers no
//     button;
//   • a failing or empty catalog renders NOTHING here — the surrounding page
//     keeps working exactly as before.
// ============================================================

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { buttonClasses } from "@legalir/ui";
import type { JudicialServiceId, JudicialServiceView } from "@legalir/types";
import {
  IconChevronLeft,
  IconFilePen,
  IconGavel,
  IconInfo,
  IconScale,
  IconShieldCheck,
} from "@/lib/icons";
import { StatusBadge } from "@/components/shared";
import { useJudicialServices } from "@/hooks/useJudicial";
import {
  JUDICIAL_FAMILY_DESCRIPTION_FA,
  JUDICIAL_FAMILY_EYEBROW_FA,
  JUDICIAL_FAMILY_TITLE_FA,
  JUDICIAL_STATUS_TONE,
} from "@/lib/judicial/identity";
import {
  judicialSearchHaystack,
  judicialServiceEntryHref,
} from "@/lib/judicial/entry";
import type { IconComponent } from "@/lib/services/catalog";

export type JudicialSurface = "home" | "services" | "new";

const SERVICE_ICON: Record<JudicialServiceId, IconComponent> = {
  judicial_statement: IconFilePen,
  judicial_brief: IconFilePen,
  judicial_petition: IconFilePen,
  judicial_complaint: IconGavel,
  judicial_criminal_record: IconShieldCheck,
  judicial_credit_check: IconScale,
};

const SERVICE_GRADIENT: Record<JudicialServiceId, string> = {
  judicial_statement: "from-violet-500 to-purple-600",
  judicial_brief: "from-sky-500 to-indigo-600",
  judicial_petition: "from-emerald-500 to-teal-600",
  judicial_complaint: "from-amber-500 to-orange-600",
  judicial_criminal_record: "from-slate-500 to-slate-700",
  judicial_credit_check: "from-cyan-600 to-blue-700",
};

/**
 * The badge text for a service that is not fully `available`. An available
 * service reads «در دسترس» — the same word the /cases card shows — so the two
 * surfaces describe the same state with the same vocabulary.
 */
const STATUS_LABEL_FA: Record<string, string> = {
  available: "در دسترس",
  soon: "به‌زودی",
  unavailable: "در دسترس نیست",
  request_only: "ثبت درخواست — تحویل پس از بررسی",
};

/**
 * The CTA destination for this caller. Discovery surfaces reachable without
 * a session send the visitor through login first and return them to the same
 * URL, exactly like the other home entry points.
 *
 * `available` opens the drafting wizard; `request_only` opens the tracked
 * intake. Nothing else links at all.
 */
function ctaHref(service: JudicialServiceView, mode: "app" | "public"): string | null {
  if (service.availability !== "available" && service.availability !== "request_only") {
    return null;
  }
  const target = judicialServiceEntryHref(service.id);
  if (!target) return null;
  return mode === "public"
    ? `/auth/mobile?intent=${encodeURIComponent(target)}`
    : target;
}

/** Whether a service can be entered right now (real route + real status). */
function isEnterable(service: JudicialServiceView): boolean {
  if (service.availability !== "available" && service.availability !== "request_only") {
    return false;
  }
  return judicialServiceEntryHref(service.id) !== null;
}

function JudicialServiceCard({
  service,
  mode,
  appearance,
}: {
  service: JudicialServiceView;
  mode: "app" | "public";
  appearance: "app" | "marketing";
}) {
  const Icon = SERVICE_ICON[service.id];
  const href = ctaHref(service, mode);
  const enterable = isEnterable(service);
  const marketing = appearance === "marketing";

  const note =
    service.availabilityNoteFa ??
    service.statusNoteFa ??
    "این خدمت هنوز برای شروع در دسترس نیست.";

  const body = (
    <>
      {/* Phones: icon beside the copy keeps one card near 170px instead of
          ~250px, so six services stay scannable instead of becoming six
          screens. From `tablet` the icon sits above the title, as it does on
          the app surfaces. */}
      <div
        className={
          marketing ? "flex items-start gap-3 tablet:block" : "flex items-start gap-3"
        }
      >
        <span
          aria-hidden="true"
          className={
            marketing
              ? `flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ln-r-md)] bg-gradient-to-br ${SERVICE_GRADIENT[service.id]} text-white tablet:h-11 tablet:w-11`
              : `flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${SERVICE_GRADIENT[service.id]} text-white shadow-elevation-1`
          }
        >
          <Icon size={marketing ? 20 : 22} />
        </span>
        <div className="min-w-0 flex-1">
          <div
            className={
              marketing
                ? "flex flex-wrap items-center gap-x-2 gap-y-1 tablet:mt-3"
                : "flex flex-wrap items-center gap-2"
            }
          >
            <h3
              className={
                marketing
                  ? "text-[15px] font-semibold leading-7 text-[color:var(--ln-navy)]"
                  : "text-body-1 font-semibold text-on-surface"
              }
            >
              {service.titleFa}
            </h3>
            {/* Every state carries its label — «در دسترس» included — so the
                badge position matches the /cases card and a working service
                is never quieter than a disabled one. */}
            <StatusBadge
              label={STATUS_LABEL_FA[service.availability] ?? "در دسترس نیست"}
              tone={JUDICIAL_STATUS_TONE[service.availability]}
              dot={false}
            />
          </div>
          <p
            className={
              marketing
                ? "mt-1 text-[12.5px] leading-6 text-[color:var(--ln-muted)] tablet:mt-1.5"
                : "mt-1 text-caption leading-6 text-on-surface-variant"
            }
          >
            {service.descriptionFa}
          </p>
        </div>
      </div>

      {/* A request-only service IS enterable, but its card still states who
          actually delivers the artifact. The note is the same server string
          the intake page repeats — one source, two placements. */}
      {(!enterable || service.availability === "request_only") && (
        <p
          className={
            marketing
              ? "mt-2.5 flex items-start gap-1.5 rounded-[var(--ln-r-sm)] bg-[color:var(--ln-canvas)] px-2.5 py-2 text-[11.5px] leading-6 text-[color:var(--ln-muted)]"
              : "mt-3 flex items-start gap-1.5 rounded-medium bg-surface-container-low px-2.5 py-2 text-caption leading-6 text-on-surface-variant"
          }
        >
          <IconInfo size={14} className="mt-1 shrink-0" />
          {note}
        </p>
      )}
    </>
  );

  // Marketing: the whole card is the action, like every other card on the
  // home page. One label names the next step and the arrow follows the text
  // — no separate full-width button row, which on a phone cost ~52px per
  // card for six cards. The app surfaces keep their explicit button.
  if (marketing) {
    const action = (
      <span
        className={
          href
            ? "mt-auto flex items-center gap-1.5 pt-3 text-[12.5px] font-semibold text-[color:var(--ln-green)]"
            : "mt-auto flex items-center gap-1.5 pt-3 text-[12.5px] font-semibold text-[color:var(--ln-muted)]"
        }
      >
        {service.ctaFa}
        <IconChevronLeft
          size={15}
          aria-hidden="true"
          className={
            href
              ? "transition-transform duration-300 group-hover:-translate-x-0.5 motion-reduce:transition-none"
              : "opacity-60"
          }
        />
      </span>
    );

    return href ? (
      <Link href={href} className="landing-card group p-4 tablet:p-5">
        {body}
        {action}
      </Link>
    ) : (
      <article
        aria-disabled="true"
        className="landing-card p-4 opacity-70 tablet:p-5"
      >
        {body}
        {action}
      </article>
    );
  }

  return (
    <article className="flex h-full flex-col rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4">
      {body}

      <div className="mt-auto pt-4">
        {href ? (
          <Link href={href} className={buttonClasses({ variant: "outlined", size: "small" })}>
            {service.ctaFa}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={`${buttonClasses({ variant: "outlined", size: "small" })} pointer-events-none opacity-60`}
          >
            {service.ctaFa}
          </span>
        )}
      </div>
    </article>
  );
}

export interface JudicialServiceZoneProps {
  /** The admin-managed surface flag this placement honours. */
  surface: JudicialSurface;
  /**
   * `public` routes anonymous visitors through login. Use it on pages that
   * render for signed-out visitors (home).
   */
  mode?: "app" | "public";
  /**
   * When set, the zone becomes a flat search result: only services whose
   * title/description/aliases match are returned, with no heading.
   */
  query?: string;
  /** Overrides the built-in section heading. `null` hides the heading. */
  title?: string | null;
  description?: string;
  className?: string;
  /** Rendered after the cards (e.g. a link to the full judicial launcher). */
  footer?: ReactNode;
  /**
   * Which card language this placement speaks. `app` (the default) is the
   * MD3 card used by /services, /new and /dashboard. `marketing` swaps in
   * the landing's own card recipe (`landing-card`) and a tighter phone
   * anatomy, so the home page does not drop six tall app cards into the
   * middle of its marketing rhythm. Only presentation changes — the data,
   * the statuses and every CTA destination are identical.
   */
  appearance?: "app" | "marketing";
}

/**
 * The whole section, or `null` when the admin hid this surface, when no
 * service names it, or when the catalog could not be read. Rendering nothing
 * is deliberate: a discovery page must not gain an empty box because a
 * feature table was unavailable.
 */
export function JudicialServiceZone({
  surface,
  mode = "app",
  query,
  title,
  description,
  className,
  footer,
  appearance = "app",
}: JudicialServiceZoneProps) {
  const { data, isLoading } = useJudicialServices();
  const items = data?.items;

  const trimmed = query?.trim().toLowerCase() ?? "";
  const isSearch = trimmed.length > 0;

  if (isLoading || !items) return null;

  const matches = items.filter((service) => {
    if (!service.surfaces[surface]) return false;
    return isSearch ? judicialSearchHaystack(service).includes(trimmed) : true;
  });

  if (matches.length === 0) return null;

  // Search mode never adds a heading: the page already owns the results
  // header and the count.
  if (isSearch) {
    return (
      <ul className={`grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3 ${className ?? ""}`}>
        {matches.map((service) => (
          <li key={service.id} className="h-full">
            <JudicialServiceCard
              service={service}
              mode={mode}
              appearance={appearance}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section
      aria-labelledby={title === null ? undefined : `judicial-zone-${surface}`}
      className={className}
    >
      {title !== null && (
        <div className={appearance === "marketing" ? "mb-5 max-w-2xl" : "mb-3"}>
          {/* Same eyebrow → title → description stack as the /cases card,
              wearing the landing's type scale when it sits on the home page
              so it reads as one of the page's own sections. */}
          <p
            className={
              appearance === "marketing"
                ? "landing-eyebrow"
                : "text-labelSmall font-medium tracking-wide text-primary"
            }
          >
            {JUDICIAL_FAMILY_EYEBROW_FA}
          </p>
          <h2
            id={`judicial-zone-${surface}`}
            className={
              appearance === "marketing"
                ? "landing-title mt-3"
                : "mt-0.5 text-h4 font-bold text-on-surface"
            }
          >
            {title ?? JUDICIAL_FAMILY_TITLE_FA}
          </h2>
          <p
            className={
              appearance === "marketing"
                ? "landing-lead mt-3"
                : "mt-1 text-caption text-on-surface-variant"
            }
          >
            {description ?? JUDICIAL_FAMILY_DESCRIPTION_FA}
          </p>
        </div>
      )}

      <ul
        className={
          appearance === "marketing"
            ? "grid grid-cols-1 gap-3 tablet:grid-cols-2 tablet:gap-4 laptop:grid-cols-3"
            : "grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3"
        }
      >
        {matches.map((service) => (
          <li key={service.id} className="h-full">
            <JudicialServiceCard
              service={service}
              mode={mode}
              appearance={appearance}
            />
          </li>
        ))}
      </ul>

      {footer}
    </section>
  );
}
