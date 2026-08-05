"use client";

import type { V1Reference } from "@legalir/types";
import { useState, useEffect, useRef } from "react";

export interface StructuredSection {
  id: string;
  title: string;
  content: string;
  order: number;
}

interface StructuredResponseProps {
  sections: StructuredSection[];
  references?: V1Reference[];
  /** If true, reveal sections one by one for streaming effect */
  streaming?: boolean;
  onCitationClick?: (reference: V1Reference) => void;
  /** Section IDs to scroll to from citation navigation */
  scrollToSectionId?: string | null;
  onScrollComplete?: () => void;
}

const SECTION_ICONS: Record<string, string> = {
  "خلاصه": "📋",
  "اطلاعات و فرض‌ها": "📝",
  "تحلیل اولیه": "⚖️",
  "ریسک‌ها": "⚠️",
  "اقدامات پیشنهادی": "✅",
  "منابع": "📚",
  "هشدار حقوقی": "🛡️",
};

export function StructuredResponse({
  sections,
  references,
  streaming = false,
  onCitationClick,
  scrollToSectionId,
  onScrollComplete,
}: StructuredResponseProps) {
  const [visibleSections, setVisibleSections] = useState<number>(
    streaming ? 0 : sections.length
  );
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Streaming reveal effect
  useEffect(() => {
    if (!streaming) {
      setVisibleSections(sections.length);
      return;
    }

    const interval = setInterval(() => {
      setVisibleSections((prev) => {
        if (prev >= sections.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [streaming, sections.length]);

  // Scroll to section when citation is clicked
  useEffect(() => {
    if (scrollToSectionId) {
      const el = sectionRefs.current.get(scrollToSectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        onScrollComplete?.();
      }
    }
  }, [scrollToSectionId, onScrollComplete]);

  const sorted = [...sections].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4 mt-3 legal-text">
      {sorted.slice(0, visibleSections).map((section) => {
        const isSourceSection = section.title === "منابع";
        const isDisclaimer = section.title === "هشدار حقوقی";

        return (
          <div
            key={section.id}
            id={`section-${section.id}`}
            ref={(el) => {
              if (el) sectionRefs.current.set(section.id, el);
              else sectionRefs.current.delete(section.id);
            }}
            className={[
              "rounded-medium p-4 animate-fade-in",
              isDisclaimer
                ? "bg-warning/[0.06] border border-warning/20"
                : "bg-surfaceVariant/30",
            ].join(" ")}
          >
            <h4 className="text-labelLarge text-onSurface font-medium mb-2 flex items-center gap-2">
              <span>{SECTION_ICONS[section.title] ?? "•"}</span>
              {section.title}
            </h4>
            {isSourceSection && references && references.length > 0 ? (
              <div>
                <p className="text-bodyMedium text-onSurfaceVariant whitespace-pre-wrap leading-relaxed mb-2">
                  {section.content}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {references.map((ref) => (
                    <button
                      key={ref.id}
                      onClick={() => onCitationClick?.(ref)}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-labelSmall px-2.5 py-1 hover:bg-primary/20 transition-colors"
                      aria-label={`منبع: ${ref.locator}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {ref.locator}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className={[
                "text-bodyMedium text-onSurfaceVariant whitespace-pre-wrap leading-loose",
                isDisclaimer ? "text-onSurfaceVariant text-bodySmall" : "",
              ].join(" ")}>
                {section.content}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
