"use client";

import { useSource } from "@/hooks/useConversations";
import type { V1Reference } from "@legalir/types";
import { IconLawBook, IconChevronRight, IconWarning } from "@/lib/icons";
import { toPersianDigits } from "@/lib/persian-utils";

interface SourcesTabProps {
  references: V1Reference[];
  isLoading?: boolean;
  onSourceClick: (sourceId: string) => void;
}

interface UniqueSourceInfo {
  sourceId: string;
  refCount: number;
  firstLocator: string;
}

function extractUniqueSources(references: V1Reference[]): UniqueSourceInfo[] {
  const map = new Map<string, UniqueSourceInfo>();
  for (const ref of references) {
    const existing = map.get(ref.sourceId);
    if (existing) {
      existing.refCount++;
    } else {
      map.set(ref.sourceId, {
        sourceId: ref.sourceId,
        refCount: 1,
        firstLocator: ref.locator,
      });
    }
  }
  return Array.from(map.values());
}

function SourceItem({
  sourceId,
  refCount,
  firstLocator,
  onSourceClick,
}: UniqueSourceInfo & { onSourceClick: (sourceId: string) => void }) {
  const { data: source, isLoading, error, refetch } = useSource(sourceId);

  if (isLoading) {
    return (
      <div className="animate-pulse flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-surfaceVariant" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 bg-surfaceVariant rounded-small w-3/4" />
          <div className="h-3 bg-surfaceVariant rounded-small w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !source) {
    return (
      <div className="flex items-start gap-3 p-4">
        <span className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center shrink-0">
          <IconWarning size={18} className="text-error" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-labelMedium text-onSurface">
            {firstLocator}
          </p>
          <p className="text-bodySmall text-error mt-0.5">
            {error ? "خطا در دریافت اطلاعات منبع" : "منبع یافت نشد"}
          </p>
          {error && (
            <button
              onClick={() => refetch()}
              className="text-bodySmall text-primary font-medium mt-1 hover:text-primary-variant transition-colors"
            >
              تلاش مجدد
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-3 p-4"
    >
      <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <IconLawBook size={18} className="text-primary" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-labelMedium text-onSurface font-medium line-clamp-1">
            {source.title}
          </span>
          {source.sourceTypeFa && (
            <span className="text-bodySmall px-1.5 py-0.5 rounded-full bg-surfaceVariant text-muted shrink-0">
              {source.sourceTypeFa}
            </span>
          )}
        </div>
        <p className="text-bodySmall text-muted leading-relaxed mb-1">
          {source.articleSection ? `${source.articleSection} — ` : ""}
          {refCount > 1 ? `${toPersianDigits(refCount)} بار ارجاع شده` : "۱ بار ارجاع شده"}
        </p>
        <button
          onClick={() => onSourceClick(sourceId)}
          className="flex items-center gap-1 text-labelSmall text-primary hover:text-primary-variant transition-colors"
          aria-label={`مشاهده جزئیات ${source.title}`}
        >
          جزئیات منبع
          <IconChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

export function SourcesTab({
  references,
  isLoading = false,
  onSourceClick,
}: SourcesTabProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-full bg-surfaceVariant" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-surfaceVariant rounded-small w-3/4" />
              <div className="h-3 bg-surfaceVariant rounded-small w-1/2" />
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
        <p className="text-bodySmall text-muted mt-1">
          منابع حقوقی که در پاسخ‌ها به آن‌ها استناد شده، در این بخش نمایش داده می‌شوند.
        </p>
      </div>
    );
  }

  const uniqueSources = extractUniqueSources(references);

  return (
    <div className="divide-y divide-divider">
      {uniqueSources.map((src) => (
        <SourceItem
          key={src.sourceId}
          sourceId={src.sourceId}
          refCount={src.refCount}
          firstLocator={src.firstLocator}
          onSourceClick={onSourceClick}
        />
      ))}
    </div>
  );
}
