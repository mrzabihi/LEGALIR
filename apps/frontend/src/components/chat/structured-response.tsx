"use client";

import type { V1Reference } from "@legalir/types";
import { useEffect, useRef } from "react";
import { IconInfo } from "@/lib/icons";

export interface StructuredSection {
  id: string;
  title: string;
  content: string;
  order: number;
}

interface StructuredResponseProps {
  sections: StructuredSection[];
  references?: V1Reference[];
  /**
   * Retained for call-site compatibility. The old staggered reveal was a
   * client-side timer (§5 forbids fake progress); real text now arrives via
   * the streaming assistant bubble, so sections render as they are — never on
   * an animation.
   */
  streaming?: boolean;
  onCitationClick?: (reference: V1Reference) => void;
  /** Section IDs to scroll to from citation navigation */
  scrollToSectionId?: string | null;
  onScrollComplete?: () => void;
}

/**
 * The reference section's real, backend-returned sources for this answer.
 * Each chip opens the SAME source detail the citations point at — the chip
 * label is the source's real locator, never an invented number.
 */
function ReferenceChips({
  references,
  onCitationClick,
}: {
  references: V1Reference[];
  onCitationClick?: (reference: V1Reference) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {references.map((ref) => (
        <button
          key={ref.id}
          type="button"
          onClick={() => onCitationClick?.(ref)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-2.5 py-1 text-labelSmall text-on-primary-container transition-colors hover:bg-surface-hover"
          aria-label={`منبع: ${ref.locator}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          {ref.locator}
        </button>
      ))}
    </div>
  );
}

export function StructuredResponse({
  sections,
  references,
  onCitationClick,
  scrollToSectionId,
  onScrollComplete,
}: StructuredResponseProps) {
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to a cited section when the user follows a reference (§7).
  useEffect(() => {
    if (!scrollToSectionId) return;
    const el = sectionRefs.current.get(scrollToSectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      onScrollComplete?.();
    }
  }, [scrollToSectionId, onScrollComplete]);

  const sorted = [...sections].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3 legal-text">
      {sorted.map((section) => {
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
            className={
              isDisclaimer
                ? "flex items-start gap-2 rounded-medium bg-warning-container p-3"
                : ""
            }
          >
            {isDisclaimer ? (
              <>
                <IconInfo size={16} className="mt-0.5 shrink-0 text-warning" />
                <div>
                  <h4 className="mb-1 text-labelSmall font-medium text-warning">
                    {section.title}
                  </h4>
                  <p className="whitespace-pre-wrap text-bodySmall leading-relaxed text-onSurfaceVariant">
                    {section.content}
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* A quiet section heading — a label, not a card header. */}
                {section.title !== "پاسخ" && (
                  <h4 className="mb-1 text-labelMedium font-medium text-muted">
                    {section.title}
                  </h4>
                )}
                <p className="whitespace-pre-wrap text-bodyMedium leading-loose text-onSurfaceVariant">
                  {section.content}
                </p>
                {isSourceSection && references && references.length > 0 && (
                  <ReferenceChips
                    references={references}
                    onCitationClick={onCitationClick}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
