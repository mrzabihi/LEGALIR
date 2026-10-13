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
  /** The page title — the page's single H1. */
  title: ReactNode;
  /** One short line of context. Wraps naturally; never truncated. */
  description?: ReactNode;
  /** Optional low-emphasis trail above the title. */
  breadcrumb?: BreadcrumbItem[];
  breadcrumbAriaLabel?: string;
  /** The page's single primary control, pinned to the end edge on tablet+. */
  actions?: ReactNode;
  className?: string;
}

export function CompactPageHeader({
  title,
  description,
  breadcrumb,
  breadcrumbAriaLabel,
  actions,
  className = "",
}: CompactPageHeaderProps) {
  const hasBreadcrumb = Boolean(breadcrumb && breadcrumb.length > 0);

  return (
    <header
      className={[
        "flex flex-col gap-4 border-b border-[color:var(--color-outline-variant)] pb-4 tablet:flex-row tablet:items-end tablet:justify-between tablet:gap-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0">
        {hasBreadcrumb && (
          <Breadcrumb items={breadcrumb!} className="mb-1.5" ariaLabel={breadcrumbAriaLabel} />
        )}
        <h1 className="text-h3 font-bold text-on-surface">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-body-2 leading-relaxed text-on-surface-variant">
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
