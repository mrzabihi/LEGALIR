// ============================================================
// LEGALIR — Page Intro Banner
// ============================================================
// A compact, reusable identity banner for the top of a page. It states
// *what the page is* in one glance — an optional breadcrumb, an optional
// eyebrow chip, a single H1 and a short description — and can host the
// page's primary control (search / CTA) on the opposite edge from `tablet`
// up, without growing into a hero.
//
// Design rules this component encodes:
//   • Height follows its content — no fixed height, so long Persian titles
//     and descriptions simply wrap and the banner grows naturally.
//   • One H1 only. Pages must not render a second page title once the
//     banner carries the heading.
//   • Theme-safe: it uses semantic surface/outline tokens, so it reads as a
//     warm-white card in light mode and a raised panel in dark mode. The
//     only hard-coded brand marks are the green→gold ribbon and the icon
//     tile, drawn from the LEGALIR palette.
//   • Optional slots (breadcrumb / eyebrow / icon / actions) are all
//     additive: a page with none of them still lays out correctly.
//
// The entrance is a short fade that the global `prefers-reduced-motion`
// guard (globals.css) neutralises for users who ask for less motion.
// ============================================================

import type { ComponentType, ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";

type BannerIcon = ComponentType<{ size?: number; className?: string }>;

export interface PageIntroBannerProps {
  /** The page title — rendered as the page's single H1. */
  title: ReactNode;
  /** One or two lines of context under the title. */
  description?: ReactNode;
  /** Optional small pill above the title (e.g. a count chip). */
  eyebrow?: ReactNode;
  /**
   * Optional trail shown above the title. Kept low-emphasis so it is never
   * mistaken for the heading.
   */
  breadcrumb?: BreadcrumbItem[];
  /** Accessible name for the breadcrumb nav. Defaults to «مسیر صفحه». */
  breadcrumbAriaLabel?: string;
  /** Optional icon tile beside the title (hidden on the narrowest screens). */
  icon?: BannerIcon;
  /** Tailwind gradient classes for the icon tile. Defaults to the brand pair. */
  iconGradient?: string;
  /**
   * Primary control rendered on the opposite edge from the title (end edge
   * in RTL) from `tablet` up; stacks full-width beneath the title on phones.
   * When absent the banner renders as a single-column block.
   */
  actions?: ReactNode;
  className?: string;
}

const DEFAULT_ICON_GRADIENT = "from-[var(--brand-green)] to-[var(--brand-teal)]";

export function PageIntroBanner({
  title,
  description,
  eyebrow,
  breadcrumb,
  breadcrumbAriaLabel,
  icon: Icon,
  iconGradient = DEFAULT_ICON_GRADIENT,
  actions,
  className = "",
}: PageIntroBannerProps) {
  const hasBreadcrumb = Boolean(breadcrumb && breadcrumb.length > 0);

  return (
    <header
      className={[
        "relative animate-fade-in overflow-hidden rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface shadow-elevation-1",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Brand ribbon — the banner's only accent line. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,var(--brand-green)_0%,var(--brand-gold)_100%)]"
      />

      <div className="grid gap-4 px-4 pb-4 pt-5 tablet:px-5 laptop:grid-cols-[minmax(0,1fr)_auto] laptop:items-center laptop:gap-8">
        <div className="min-w-0">
          {hasBreadcrumb && (
            <Breadcrumb items={breadcrumb!} className="mb-2" ariaLabel={breadcrumbAriaLabel} />
          )}

          <div className="flex items-start gap-3">
            {Icon && (
              <span
                aria-hidden="true"
                className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${iconGradient} text-white shadow-elevation-1 mobile-l:flex`}
              >
                <Icon size={20} />
              </span>
            )}

            <div className="min-w-0">
              {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
              <h1 className="text-h3 font-bold text-on-surface">{title}</h1>
              {description && (
                <p className="mt-1 max-w-3xl text-body-2 leading-relaxed text-on-surface-variant">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 laptop:w-auto laptop:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
