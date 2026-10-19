// ============================================================
// LEGALIR — Compact page header (list surfaces)
// ============================================================
// A LOW, quiet identity block for the scan-oriented list pages
// (/history, /cases, /contracts, /documents). Where `PageIntroBanner`
// is a raised card with a brand ribbon — right for a hero — this is
// deliberately flat: an optional breadcrumb, a single H1, one short
// description and only the page's ONE primary action, all on one row
// from `tablet` up.
//
// It keeps the same identity language (Vazir, semantic surface/outline
// tokens, MD3 type roles) so a list page still reads as LEGALIR, just
// without the decorative weight the brief asked to remove.
// ============================================================

import type { ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";

export interface CompactPageHeaderProps {
  /**
   * A small category label above the title — the list-page analogue of the
   * eyebrow a service card carries. Decorative to the document outline, so it
   * never replaces the H1.
   */
  eyebrow?: ReactNode;
  /** The page title — the page's single H1. */
  title: ReactNode;
  /**
   * A status chip rendered immediately after the title, on the same line.
   * Service pages use it to state availability in exactly the place a /cases
   * service card does. Always text — never colour alone.
   */
  badge?: ReactNode;
  /** One short line of context. Wraps naturally; never truncated. */
  description?: ReactNode;
  /** Optional low-emphasis trail above the title. */
  breadcrumb?: BreadcrumbItem[];
  breadcrumbAriaLabel?: string;
  /** The page's single primary control, pinned to the end edge on tablet+. */
  actions?: ReactNode;
  /**
   * Tighter vertical rhythm (smaller padding + gaps). Opt-in for a page whose
   * top-of-list region must stay short; other list pages keep the default.
   */
  compact?: boolean;
  className?: string;
}

export function CompactPageHeader({
  eyebrow,
  title,
  badge,
  description,
  breadcrumb,
  breadcrumbAriaLabel,
  actions,
  compact = false,
  className = "",
}: CompactPageHeaderProps) {
  const hasBreadcrumb = Boolean(breadcrumb && breadcrumb.length > 0);

  return (
    <header
      className={[
        "flex flex-col border-b border-[color:var(--color-outline-variant)]",
        compact
          ? "gap-3 pb-3 tablet:flex-row tablet:items-end tablet:justify-between tablet:gap-5"
          : "gap-4 pb-4 tablet:flex-row tablet:items-end tablet:justify-between tablet:gap-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0">
        {hasBreadcrumb && (
          <Breadcrumb
            items={breadcrumb!}
            className={compact ? "mb-1" : "mb-1.5"}
            ariaLabel={breadcrumbAriaLabel}
          />
        )}
        {eyebrow && (
          <p
            className={[
              "text-labelSmall font-medium tracking-wide text-primary",
              compact ? "mb-0.5" : "mb-1",
            ].join(" ")}
          >
            {eyebrow}
          </p>
        )}
        {badge ? (
          // Badge sits beside the title, never inside it: the H1's accessible
          // name must stay exactly the service name.
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h3 font-bold text-on-surface">{title}</h1>
            {badge}
          </div>
        ) : (
          <h1 className="text-h3 font-bold text-on-surface">{title}</h1>
        )}
        {description && (
          <p
            className={[
              "max-w-2xl text-body-2 leading-relaxed text-on-surface-variant",
              compact ? "mt-0.5" : "mt-1",
            ].join(" ")}
          >
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 tablet:w-auto tablet:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
