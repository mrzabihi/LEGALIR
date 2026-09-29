// ============================================================
// LEGALIR — Service card illustrations
// ============================================================
// One line-art illustration per service, shared by the /services
// «خدمات پرکاربرد» cards and the dashboard «دسترسی سریع» cards. The
// same artwork therefore reads identically on both surfaces — only the
// rendered size differs.
//
// House rules (identical to `banner-art.tsx`, so the two families look
// like one hand drew them):
//   • code-native SVG — no bitmaps, no external URLs, no baked text
//   • every stroke/fill paints with `currentColor`, so one artwork works
//     on any accent and in both themes
//   • a single soft radial halo behind the subject, never a second hue
//   • decorative only — `aria-hidden`, so it never enters the a11y tree
//   • the subject drifts with `animate-float`, which collapses under
//     `prefers-reduced-motion` (see globals.css)
//
// The viewBox is 200×140 (a landscape card band). Each illustration is
// drawn to fill it edge-to-edge so it scales cleanly from the compact
// dashboard card up to the full /services card.
// ============================================================

"use client";

import { useId } from "react";

/**
 * `useId()` returns values like `:r0:` — strip the punctuation so the
 * generated `url(#…)` references resolve in every browser.
 */
function useArtId(prefix: string): string {
  const raw = useId();
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
}

interface ArtProps {
  className?: string;
}

/** Shared halo — one soft radial wash behind every subject. */
function Halo({
  id,
  cx = 100,
  cy = 66,
  r = 74,
}: {
  id: string;
  cx?: number;
  cy?: number;
  r?: number;
}) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-halo)`} />
    </>
  );
}

// ------------------------------------------------------------
// Calculator — a calculator with a small balance-scale motif
// ------------------------------------------------------------

export function CalculatorArt({ className = "" }: ArtProps) {
  const id = useArtId("calc");
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden="true" fill="none">
      <Halo id={id} />

      {/* Balance scale — the legal half of the idea, kept small and light. */}
      <g opacity="0.55" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M150 30v34" />
        <path d="M132 34h36" />
        <path d="M132 34l-8 16h16z" fill="currentColor" fillOpacity="0.35" />
        <path d="M168 34l-8 16h16z" fill="currentColor" fillOpacity="0.35" />
        <path d="M140 64h20" />
      </g>

      {/* Calculator body */}
      <g className="animate-float" style={{ transformOrigin: "78px 74px" }}>
        <rect x="40" y="26" width="76" height="96" rx="12" fill="currentColor" opacity="0.16" />
        <rect
          x="40"
          y="26"
          width="76"
          height="96"
          rx="12"
          stroke="currentColor"
          strokeWidth="3.5"
          opacity="0.85"
        />
        {/* Display */}
        <rect x="50" y="36" width="56" height="20" rx="5" fill="currentColor" opacity="0.28" />
        {/* Keypad — 3×3 dots */}
        <g fill="currentColor" opacity="0.7">
          <circle cx="58" cy="72" r="4" />
          <circle cx="78" cy="72" r="4" />
          <circle cx="98" cy="72" r="4" />
          <circle cx="58" cy="90" r="4" />
          <circle cx="78" cy="90" r="4" />
          <circle cx="98" cy="90" r="4" />
          <circle cx="58" cy="108" r="4" />
          <circle cx="78" cy="108" r="4" />
          <circle cx="98" cy="108" r="4" />
        </g>
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Document analysis — stacked sheets under a magnifier
// ------------------------------------------------------------

export function DocumentAnalysisArt({ className = "" }: ArtProps) {
  const id = useArtId("docan");
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden="true" fill="none">
      <Halo id={id} />

      {/* Back sheet */}
      <rect
        x="52"
        y="24"
        width="70"
        height="92"
        rx="9"
        fill="currentColor"
        opacity="0.14"
        transform="rotate(-6 87 70)"
      />

      {/* Front sheet with text lines */}
      <g className="animate-float" style={{ transformOrigin: "84px 72px" }}>
        <rect x="46" y="22" width="72" height="96" rx="9" fill="currentColor" opacity="0.18" />
        <rect
          x="46"
          y="22"
          width="72"
          height="96"
          rx="9"
          stroke="currentColor"
          strokeWidth="3.5"
          opacity="0.8"
        />
        <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.5">
          <path d="M60 44h44" />
          <path d="M60 60h44" />
          <path d="M60 76h30" />
          <path d="M60 92h44" />
        </g>
      </g>

      {/* Magnifier over the text */}
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.9">
        <circle cx="132" cy="86" r="22" fill="currentColor" fillOpacity="0.12" />
        <path d="M148 102l16 16" />
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Legal notice — an official sheet with a pen and a seal
// ------------------------------------------------------------

export function LegalNoticeArt({ className = "" }: ArtProps) {
  const id = useArtId("notice");
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden="true" fill="none">
      <Halo id={id} />

      {/* Official sheet */}
      <g className="animate-float" style={{ transformOrigin: "86px 72px" }}>
        <rect x="44" y="20" width="80" height="100" rx="9" fill="currentColor" opacity="0.18" />
        <rect
          x="44"
          y="20"
          width="80"
          height="100"
          rx="9"
          stroke="currentColor"
          strokeWidth="3.5"
          opacity="0.8"
        />
        {/* Header rule + body lines */}
        <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.5">
          <path d="M58 40h52" />
          <path d="M58 58h52" />
          <path d="M58 74h52" />
          <path d="M58 90h34" />
        </g>
      </g>

      {/* Seal / stamp — a ring with a check */}
      <g opacity="0.9">
        <circle cx="140" cy="98" r="20" fill="currentColor" fillOpacity="0.14" />
        <circle cx="140" cy="98" r="20" stroke="currentColor" strokeWidth="3.5" />
        <path
          d="M131 98l6 6 12-13"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Pen */}
      <g transform="rotate(-34 158 44)" opacity="0.9">
        <rect x="150" y="14" width="16" height="58" rx="5" fill="currentColor" opacity="0.75" />
        <path d="M150 72h16l-8 18z" fill="currentColor" />
        <rect x="150" y="26" width="16" height="7" fill="currentColor" opacity="0.4" />
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Contract drafting — a contract sheet with a pen and a signature
// ------------------------------------------------------------

export function ContractDraftingArt({ className = "" }: ArtProps) {
  const id = useArtId("draft");
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden="true" fill="none">
      <Halo id={id} />

      {/* Back sheet for depth */}
      <rect
        x="66"
        y="22"
        width="72"
        height="96"
        rx="9"
        fill="currentColor"
        opacity="0.13"
        transform="rotate(6 102 70)"
      />

      {/* Front contract sheet */}
      <g className="animate-float" style={{ transformOrigin: "82px 72px" }}>
        <rect x="42" y="20" width="76" height="100" rx="9" fill="currentColor" opacity="0.18" />
        <rect
          x="42"
          y="20"
          width="76"
          height="100"
          rx="9"
          stroke="currentColor"
          strokeWidth="3.5"
          opacity="0.8"
        />
        <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.5">
          <path d="M56 40h48" />
          <path d="M56 56h48" />
          <path d="M56 72h30" />
        </g>
        {/* Signature line + squiggle */}
        <path
          d="M56 100h22"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.45"
        />
        <path
          d="M82 100c5-11 9-11 12-3s8 8 12-5 9-9 12 2"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      </g>

      {/* Pen */}
      <g transform="rotate(-36 156 46)" opacity="0.9">
        <rect x="148" y="16" width="16" height="58" rx="5" fill="currentColor" opacity="0.75" />
        <path d="M148 74h16l-8 18z" fill="currentColor" />
        <rect x="148" y="28" width="16" height="7" fill="currentColor" opacity="0.4" />
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Contract review — a contract sheet under a magnifier with a risk flag
// ------------------------------------------------------------

export function ContractReviewArt({ className = "" }: ArtProps) {
  const id = useArtId("review");
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden="true" fill="none">
      <Halo id={id} />

      {/* Contract sheet */}
      <g className="animate-float" style={{ transformOrigin: "82px 72px" }}>
        <rect x="44" y="20" width="76" height="100" rx="9" fill="currentColor" opacity="0.18" />
        <rect
          x="44"
          y="20"
          width="76"
          height="100"
          rx="9"
          stroke="currentColor"
          strokeWidth="3.5"
          opacity="0.8"
        />
        <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.5">
          <path d="M58 40h48" />
          <path d="M58 56h48" />
          <path d="M58 72h48" />
          <path d="M58 88h30" />
        </g>
      </g>

      {/* Magnifier */}
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.9">
        <circle cx="128" cy="82" r="22" fill="currentColor" fillOpacity="0.12" />
        <path d="M144 98l16 16" />
      </g>

      {/* Risk flag — a small warning triangle inside the lens */}
      <g opacity="0.95">
        <path
          d="M128 70l11 19h-22z"
          fill="currentColor"
          fillOpacity="0.2"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M128 78v6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="128" cy="88" r="1.6" fill="currentColor" />
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Legal consultation — two professional chat bubbles
// ------------------------------------------------------------

export function ConsultationArt({ className = "" }: ArtProps) {
  const id = useArtId("consult");
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden="true" fill="none">
      <Halo id={id} />

      {/* Incoming bubble (start side) */}
      <g className="animate-float" style={{ transformOrigin: "76px 62px" }}>
        <path
          d="M40 34h72a10 10 0 0110 10v26a10 10 0 01-10 10H64l-16 14V80h-8a10 10 0 01-10-10V44a10 10 0 0110-10z"
          fill="currentColor"
          opacity="0.18"
        />
        <path
          d="M40 34h72a10 10 0 0110 10v26a10 10 0 01-10 10H64l-16 14V80h-8a10 10 0 01-10-10V44a10 10 0 0110-10z"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinejoin="round"
          opacity="0.8"
        />
        <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.5">
          <path d="M46 50h60" />
          <path d="M46 64h40" />
        </g>
      </g>

      {/* Outgoing bubble (end side) */}
      <g opacity="0.95">
        <path
          d="M104 74h56a10 10 0 0110 10v20a10 10 0 01-10 10h-6v12l-14-12h-36a10 10 0 01-10-10V84a10 10 0 0110-10z"
          fill="currentColor"
          opacity="0.28"
        />
        <path
          d="M104 74h56a10 10 0 0110 10v20a10 10 0 01-10 10h-6v12l-14-12h-36a10 10 0 01-10-10V84a10 10 0 0110-10z"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinejoin="round"
          opacity="0.85"
        />
        <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.55">
          <path d="M110 90h44" />
          <path d="M110 104h28" />
        </g>
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Registry — maps a service's `art` key to its illustration
// ------------------------------------------------------------

export const SERVICE_ART = {
  calculator: CalculatorArt,
  document_analysis: DocumentAnalysisArt,
  legal_notice: LegalNoticeArt,
  contract_drafting: ContractDraftingArt,
  contract_review: ContractReviewArt,
  legal_consultation: ConsultationArt,
} as const;

export type ServiceArtKey = keyof typeof SERVICE_ART;
