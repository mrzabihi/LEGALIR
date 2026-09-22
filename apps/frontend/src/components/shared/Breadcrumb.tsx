// ============================================================
// LEGALIR — Breadcrumb
// ============================================================
// RTL-correct breadcrumb trail. The last item is the current page
// (aria-current="page", not a link). Chevrons are decorative and
// flipped for RTL via the shared IconChevronRight rtlFlip prop.
// ============================================================

import Link from "next/link";
import { IconChevronRight } from "@/lib/icons";

export interface BreadcrumbItem {
  label: string;
  /** Omit href for the current (last) item. */
  href?: string;
}

export function Breadcrumb({ items, className = "" }: { items: BreadcrumbItem[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="مسیر صفحه" className={`mb-3 ${className}`}>
      <ol className="flex flex-wrap items-center gap-1.5 text-caption text-muted">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden="true" className="flex items-center text-neutral-300">
                  <IconChevronRight size={16} rtlFlip />
                </span>
              )}
              {isLast || !item.href ? (
                <span aria-current="page" className="px-1 py-0.5 font-medium text-on-surface">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="rounded-small px-1 py-0.5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
