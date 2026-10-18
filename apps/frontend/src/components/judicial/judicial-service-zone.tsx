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
//     declared requirement all allow it, and when a real wizard entry exists
//     (`judicialEntryType`); otherwise the card explains and offers no button;
//   • a failing or empty catalog renders NOTHING here — the surrounding page
//     keeps working exactly as before.
// ============================================================

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { buttonClasses } from "@legalir/ui";
import type { JudicialServiceId, JudicialServiceView } from "@legalir/types";
import {
  IconFilePen,
  IconGavel,
  IconInfo,
  IconScale,
  IconShieldCheck,
} from "@/lib/icons";
import { StatusBadge, type StatusTone } from "@/components/shared";
import { useJudicialServices } from "@/hooks/useJudicial";
import {
  judicialEntryHref,
  judicialEntryType,
  judicialSearchHaystack,
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

const STATUS_TONE: Record<string, StatusTone> = {
  soon: "warning",
  unavailable: "neutral",
};

/**
 * The CTA destination for this caller. Discovery surfaces reachable without
 * a session send the visitor through login first and return them to the same
 * wizard URL, exactly like the other home entry points.
 */
function ctaHref(service: JudicialServiceView, mode: "app" | "public"): string | null {
  const type = judicialEntryType(service.id);
  if (!type || service.availability !== "available") return null;
  const target = judicialEntryHref(type);
  return mode === "public"
    ? `/auth/mobile?intent=${encodeURIComponent(target)}`
    : target;
}

/** Whether a service can be entered right now (real route + real status). */
function isEnterable(service: JudicialServiceView): boolean {
  return service.availability === "available" && judicialEntryType(service.id) !== null;
}

function JudicialServiceCard({
  service,
  mode,
}: {
  service: JudicialServiceView;
  mode: "app" | "public";
}) {
  const Icon = SERVICE_ICON[service.id];
  const href = ctaHref(service, mode);
  const enterable = isEnterable(service);

  return (
    <article className="flex h-full flex-col rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${SERVICE_GRADIENT[service.id]} text-white shadow-elevation-1`}
        >
          <Icon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body-1 font-semibold text-on-surface">{service.titleFa}</h3>
            {service.availability !== "available" && (
              <StatusBadge
                label={service.availability === "soon" ? "به‌زودی" : "در دسترس نیست"}
                tone={STATUS_TONE[service.availability] ?? "neutral"}
                dot={false}
              />
            )}
          </div>
          <p className="mt-1 text-caption leading-6 text-on-surface-variant">
            {service.descriptionFa}
          </p>
        </div>
      </div>

      {!enterable && (
        <p className="mt-3 flex items-start gap-1.5 rounded-medium bg-surface-container-low px-2.5 py-2 text-caption leading-6 text-on-surface-variant">
          <IconInfo size={14} className="mt-1 shrink-0" />
          {service.availabilityNoteFa ??
            service.statusNoteFa ??
            "این خدمت هنوز برای شروع در دسترس نیست."}
        </p>
      )}

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
            <JudicialServiceCard service={service} mode={mode} />
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
        <div className="mb-3">
          <h2
            id={`judicial-zone-${surface}`}
            className="text-h4 font-bold text-on-surface"
          >
            {title ?? "تنظیم دادخواست و شکواییه تخصصی"}
          </h2>
          <p className="mt-1 text-caption text-on-surface-variant">
            {description ??
              "موضوع را توضیح دهید، به پرسش‌های لازم پاسخ دهید و پیش‌نویس خود را مرحله‌به‌مرحله آماده کنید."}
          </p>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
        {matches.map((service) => (
          <li key={service.id} className="h-full">
            <JudicialServiceCard service={service} mode={mode} />
          </li>
        ))}
      </ul>

      {footer}
    </section>
  );
}
