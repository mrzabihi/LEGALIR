"use client";

import type { V1Reference } from "@legalir/types";
import { IconLawBook, IconChevronRight } from "@/lib/icons";

interface ReferencesTabProps {
  references: V1Reference[];
  isLoading?: boolean;
  onReferenceClick: (reference: V1Reference) => void;
  onNavigateToSection: (sectionId: string) => void;
}

const _SOURCE_TYPE_FALLBACK: Record<string, string> = {
  law: "قانون",
  regulation: "آیین‌نامه",
  precedent: "رأی یا رویه قضایی",
  directive: "بخشنامه",
  opinion: "منبع تفسیری",
  user_document: "سند کاربر",
};

function sourceTypeLabel(locator: string, sourceTypeFa?: string): string {
  if (sourceTypeFa) return sourceTypeFa;

  // Fallback heuristic when sourceType is not in the reference
  if (locator.includes("ماده")) return "قانون";
  if (locator.includes("بند") || locator.includes("بخش")) return "آیین‌نامه";
  if (locator.includes("دادنامه") || locator.includes("رأی")) return "رویه قضایی";
  return "منبع";
}

export function ReferencesTab({
  references,
  isLoading = false,
  onReferenceClick,
  onNavigateToSection,
}: ReferencesTabProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-full bg-surfaceVariant" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-surfaceVariant rounded-small w-1/2" />
              <div className="h-3 bg-surfaceVariant rounded-small w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (references.length === 0) {
    return (
      <div className="p-6 text-center">
        <IconLawBook size={32} className="text-muted mx-auto mb-2" />
        <p className="text-bodyMedium text-muted">منبعی برای این گفتگو یافت نشد</p>
        <p className="text-bodySmall text-muted mt-1">منابع مرتبط با پاسخ‌های این گفتگو در این بخش نمایش داده می‌شوند.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-divider">
      {references.map((ref) => (
        <div key={ref.id} className="px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <IconLawBook size={14} className="text-primary" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-labelMedium text-onSurface font-medium">
                  {ref.locator}
                </span>
                <span className="text-bodySmall px-1.5 py-0.5 rounded-full bg-surfaceVariant text-muted">
                  {sourceTypeLabel(ref.locator, ref.sourceTypeFa)}
                </span>
              </div>
              <p className="text-bodySmall text-onSurfaceVariant leading-relaxed line-clamp-2 mb-2">
                {ref.quote}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onReferenceClick(ref)}
                  className="flex items-center gap-1 text-labelSmall text-primary hover:text-primary-variant transition-colors"
                  aria-label="مشاهده جزئیات منبع"
                >
                  جزئیات منبع
                  <IconChevronRight size={12} />
                </button>
                <button
                  onClick={() => onNavigateToSection(ref.section)}
                  className="text-labelSmall text-muted hover:text-onSurface transition-colors"
                  aria-label="رفتن به بخش مربوطه"
                >
                  رفتن به بخش
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
