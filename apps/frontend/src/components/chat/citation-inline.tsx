"use client";

import type { V1Reference } from "@legalir/types";

interface CitationInlineProps {
  reference: V1Reference;
  onClick: (reference: V1Reference) => void;
}

export function CitationInline({ reference, onClick }: CitationInlineProps) {
  return (
    <button
      onClick={() => onClick(reference)}
      className="inline-flex items-center gap-1 align-middle mx-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-labelSmall hover:bg-primary/20 transition-colors"
      aria-label={`منبع: ${reference.locator}`}
      type="button"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
      {reference.locator}
    </button>
  );
}
