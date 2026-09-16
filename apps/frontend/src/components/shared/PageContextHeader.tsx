// ============================================================
// LEGALIR — Page Context Header
// ============================================================
// Compact contextual header for a service page: breadcrumb +
// service icon + title + subtitle. The active service is resolved
// from the URL (single source of truth), so it survives refresh,
// deep-linking and browser back/forward.
//
// Shared by Chat, Documents and Contracts so the implementation
// can never drift between pages.
// ============================================================

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { resolveService, type LegalService } from "@/lib/services";
import { IconChevronRight } from "@/lib/icons";

interface PageContextHeaderProps {
  /** Override the URL-derived service (rarely needed). */
  service?: LegalService;
  /** Extra classes for the outer wrapper. */
  className?: string;
}

export function PageContextHeader({ service, className = "" }: PageContextHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = service ?? resolveService(pathname, searchParams);
  if (!active) return null;

  const Icon = active.icon;

  return (
    <div className={`mb-4 ${className}`}>
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="mb-2">
        <ol className="flex items-center gap-1.5 text-caption text-muted">
          <li>
            <Link
              href="/dashboard"
              className="rounded-small px-1 py-0.5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              داشبورد
            </Link>
          </li>
          <li aria-hidden="true" className="flex items-center text-neutral-300">
            <IconChevronRight size={16} />
          </li>
          <li>
            <span aria-current="page" className="px-1 py-0.5 font-medium text-on-surface">
              {active.title}
            </span>
          </li>
        </ol>
      </nav>

      {/* Contextual header */}
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${active.gradient} text-white shadow-elevation-1`}
          aria-hidden="true"
        >
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-h3 font-bold text-on-surface">{active.title}</h1>
          <p className="truncate text-caption text-muted">{active.subtitle}</p>
        </div>
      </div>
    </div>
  );
}
