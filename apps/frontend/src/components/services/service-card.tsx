// ============================================================
// LEGALIR — Catalog service card
// ============================================================
// One tile per catalog item. This is the *recognizable* card from the
// previous /services page — gradient icon chip, title, description,
// duration/output badges, documented-law chips and a «شروع» action —
// rebuilt on the design tokens so it works in dark mode and so the
// whole catalog shares one component instead of two inventories.
//
// The card is a single link: the whole tile is the target, which keeps
// the touch area large and the tab order short.
// ============================================================

"use client";

import Link from "next/link";
import { IconChevronRight, IconClock, IconFileText } from "@/lib/icons";
import { getLawById } from "@/lib/law-catalog";
import type { CatalogItem } from "@/lib/services/catalog";

/** Output-kind badge tones, keyed by the registry's `outputType`. */
const OUTPUT_TONE: Record<string, string> = {
  "متن": "bg-info-50 text-info-700 border-info-200",
  "سند PDF": "bg-warning-50 text-warning-700 border-warning-200",
  "گزارش": "bg-success-50 text-success-700 border-success-200",
};

interface ServiceCardProps {
  item: CatalogItem;
}

export function ServiceCard({ item }: ServiceCardProps) {
  const Icon = item.icon;
  const tone = item.outputType
    ? (OUTPUT_TONE[item.outputType] ??
      "bg-surface-container text-on-surface-variant border-outline-variant")
    : null;

  return (
    <Link
      href={item.href}
      className="group relative flex h-full flex-col overflow-hidden rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 transition-all duration-short4 ease-standard hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--color-primary)_28%,transparent)] hover:shadow-elevation-3 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)] touch-target"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${item.gradient} text-white shadow-elevation-1 transition-transform duration-short4 ease-standard group-hover:scale-[1.04]`}
        >
          <Icon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-body-2 font-semibold text-on-surface">{item.title}</h3>
          <p className="mt-1 text-caption leading-relaxed text-on-surface-variant line-clamp-2">
            {item.description}
          </p>
        </div>
      </div>

      {(item.duration || tone) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.duration && (
            <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container px-2.5 py-0.5 text-caption text-on-surface-variant">
              <IconClock size={12} />
              {item.duration}
            </span>
          )}
          {tone && item.outputType && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-caption font-medium ${tone}`}
            >
              <IconFileText size={12} />
              {item.outputType}
            </span>
          )}
        </div>
      )}

      {item.lawRefs && item.lawRefs.length > 0 && (
        <div className="mt-3 border-t border-divider pt-3">
          <p className="mb-1.5 text-caption text-muted">مستندات</p>
          <div className="flex flex-wrap gap-1.5">
            {item.lawRefs.map((refId) => {
              const law = getLawById(refId);
              if (!law) return null;
              return (
                <span
                  key={refId}
                  title={law.title}
                  className="inline-flex items-center rounded-full border border-primary/15 bg-primary/5 px-2.5 py-0.5 text-caption text-primary-700"
                >
                  {law.articleSection}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <span className="mt-auto inline-flex items-center gap-1.5 self-start pt-4 text-labelLarge font-medium text-primary">
        شروع
        <IconChevronRight
          size={16}
          className="transition-transform duration-short4 ease-standard group-hover:-translate-x-0.5"
        />
      </span>
    </Link>
  );
}
