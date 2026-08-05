// ============================================================
// LEGALIR — Extracted Text
// Collapsible section for document OCR/extracted text (Phase 9)
// ============================================================

"use client";

import { useState, useCallback } from "react";
import { Skeleton } from "@legalir/ui";
import { IconChevronDown, IconDocument } from "@/lib/icons";

// ============================================================
// ExtractedText component
// ============================================================

interface ExtractedTextProps {
  text: string | null;
  isLoading: boolean;
}

export function ExtractedText({ text, isLoading }: ExtractedTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const hasText = text !== null && text.length > 0;

  return (
    <section aria-label="متن استخراج شده" dir="rtl">
      {/* Header with toggle */}
      <button
        type="button"
        onClick={toggle}
        disabled={isLoading}
        aria-expanded={isExpanded}
        aria-label={
          isExpanded ? "بستن متن استخراج شده" : "نمایش متن استخراج شده"
        }
        className="flex items-center justify-between w-full py-3 border-b border-divider"
      >
        <h3 className="text-labelLarge text-on-surface font-medium">
          متن استخراج شده
        </h3>
        <IconChevronDown
          size={22}
          className={`text-muted transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="mt-3">
          {isLoading ? (
            /* Loading skeleton */
            <div className="flex flex-col gap-2" aria-label="در حال بارگذاری متن">
              <Skeleton variant="text" width="100%" height="16px" />
              <Skeleton variant="text" width="92%" height="16px" />
              <Skeleton variant="text" width="100%" height="16px" />
              <Skeleton variant="text" width="75%" height="16px" />
              <Skeleton variant="text" width="100%" height="16px" />
              <Skeleton variant="text" width="83%" height="16px" />
            </div>
          ) : hasText ? (
            /* Text content */
            <div className="max-h-80 overflow-y-auto rounded-medium border border-divider bg-surface p-4">
              <pre className="text-caption text-on-surface leading-relaxed text-right font-sans whitespace-pre-wrap break-words">
                {text}
              </pre>
            </div>
          ) : (
            /* No text placeholder */
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              <IconDocument size={32} className="text-muted" />
              <p className="text-caption text-muted">
                متنی برای این سند استخراج نشده است.
              </p>
              <p className="text-caption text-muted">
                استخراج متن برای اسناد تصویری (اسکن شده) در دسترس خواهد بود.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
