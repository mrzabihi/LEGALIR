// ============================================================
// LEGALIR — Services page banner artwork
// ============================================================
// Code-native SVG illustrations for the campaign banners. No bitmap
// assets, no external URLs, and no text baked into the artwork — every
// headline and CTA stays selectable HTML in the banner component.
//
// Each illustration is decorative (`aria-hidden`) and paints with
// `currentColor`, so one artwork works on every gradient in the
// palette and in both themes.
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

// ------------------------------------------------------------
// Lawyer — balance scale above two people (human consultation)
// ------------------------------------------------------------

export function LawyerArt({ className = "" }: ArtProps) {
  const id = useArtId("lawyer");
  return (
    <svg viewBox="0 0 320 220" className={className} aria-hidden="true" fill="none">
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.30" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      <circle cx="160" cy="96" r="104" fill={`url(#${id}-glow)`} />

      {/* Two people — the human side of the consultation. */}
      <g opacity="0.5">
        <circle cx="66" cy="158" r="15" fill="currentColor" />
        <path
          d="M40 206c0-15 12-26 26-26s26 11 26 26z"
          fill="currentColor"
          opacity="0.75"
        />
        <circle cx="254" cy="158" r="15" fill="currentColor" />
        <path
          d="M228 206c0-15 12-26 26-26s26 11 26 26z"
          fill="currentColor"
          opacity="0.75"
        />
      </g>

      {/* Balance scale — the legal side. */}
      <g className="animate-float" style={{ transformOrigin: "160px 110px" }}>
        <circle cx="160" cy="44" r="9" fill="currentColor" />
        <path
          d="M92 62h136"
          stroke={`url(#${id}-beam)`}
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M160 62v72"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M128 140h64"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Left pan */}
        <path d="M92 62l-18 32h36z" fill="currentColor" opacity="0.55" />
        <path
          d="M74 94h36"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Right pan */}
        <path d="M228 62l-18 32h36z" fill="currentColor" opacity="0.55" />
        <path
          d="M210 94h36"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Contract — a drafted sheet with a signature and a pen
// ------------------------------------------------------------

export function ContractArt({ className = "" }: ArtProps) {
  const id = useArtId("contract");
  return (
    <svg viewBox="0 0 320 220" className={className} aria-hidden="true" fill="none">
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="58%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.26" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="160" cy="104" r="104" fill={`url(#${id}-glow)`} />

      {/* Back sheet — depth without a second colour. */}
      <rect
        x="118"
        y="34"
        width="112"
        height="150"
        rx="12"
        fill="currentColor"
        opacity="0.16"
        transform="rotate(6 174 109)"
      />

      {/* Front sheet */}
      <g className="animate-float" style={{ transformOrigin: "150px 110px" }}>
        <rect
          x="86"
          y="28"
          width="118"
          height="158"
          rx="12"
          fill="currentColor"
          opacity="0.22"
        />
        <rect
          x="86"
          y="28"
          width="118"
          height="158"
          rx="12"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.7"
        />

        {/* Body lines */}
        <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.55">
          <path d="M104 58h82" />
          <path d="M104 78h82" />
          <path d="M104 98h60" />
          <path d="M104 118h82" />
        </g>

        {/* Signature line + squiggle */}
        <path
          d="M104 156h34"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.45"
        />
        <path
          d="M142 156c6-14 12-14 16-4s10 10 16-6 12-12 16 2"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      </g>

      {/* Pen */}
      <g transform="rotate(-38 232 150)" opacity="0.9">
        <rect x="222" y="96" width="20" height="76" rx="6" fill="currentColor" opacity="0.75" />
        <path d="M222 172h20l-10 22z" fill="currentColor" />
        <rect x="222" y="112" width="20" height="8" fill="currentColor" opacity="0.4" />
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// NDA — a shield with a keyhole over a confidential sheet
// ------------------------------------------------------------

export function NdaArt({ className = "" }: ArtProps) {
  const id = useArtId("nda");
  return (
    <svg viewBox="0 0 320 220" className={className} aria-hidden="true" fill="none">
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="58%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="160" cy="104" r="104" fill={`url(#${id}-glow)`} />

      {/* Confidential sheet behind the shield */}
      <rect
        x="196"
        y="52"
        width="86"
        height="112"
        rx="10"
        fill="currentColor"
        opacity="0.16"
        transform="rotate(8 239 108)"
      />
      <g
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.35"
        transform="rotate(8 239 108)"
      >
        <path d="M212 82h54" />
        <path d="M212 102h54" />
        <path d="M212 122h34" />
      </g>

      {/* Shield */}
      <g className="animate-float" style={{ transformOrigin: "140px 110px" }}>
        <path
          d="M140 26l-72 27v56c0 45 31 84 72 96 41-12 72-51 72-96V53z"
          fill="currentColor"
          opacity="0.22"
        />
        <path
          d="M140 26l-72 27v56c0 45 31 84 72 96 41-12 72-51 72-96V53z"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
          opacity="0.85"
        />

        {/* Keyhole */}
        <circle cx="140" cy="104" r="17" fill="currentColor" opacity="0.9" />
        <path
          d="M140 118v30"
          stroke="currentColor"
          strokeWidth="15"
          strokeLinecap="round"
          opacity="0.9"
        />
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Library — an open book with a bookmark
// ------------------------------------------------------------

export function LibraryArt({ className = "" }: ArtProps) {
  const id = useArtId("library");
  return (
    <svg viewBox="0 0 320 220" className={className} aria-hidden="true" fill="none">
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="58%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.26" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="160" cy="104" r="104" fill={`url(#${id}-glow)`} />

      {/* Stacked volumes behind the open book */}
      <g opacity="0.28">
        <rect x="70" y="150" width="180" height="20" rx="6" fill="currentColor" />
        <rect x="82" y="172" width="156" height="20" rx="6" fill="currentColor" opacity="0.8" />
      </g>

      {/* Open book */}
      <g className="animate-float" style={{ transformOrigin: "160px 110px" }}>
        <path
          d="M160 74c-26-17-60-23-90-19v98c30-4 64 2 90 19 26-17 60-23 90-19V55c-30-4-64 2-90 19z"
          fill="currentColor"
          opacity="0.22"
        />
        <path
          d="M160 74c-26-17-60-23-90-19v98c30-4 64 2 90 19 26-17 60-23 90-19V55c-30-4-64 2-90 19z"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
          opacity="0.85"
        />
        <path
          d="M160 74v98"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Page rules */}
        <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.45">
          <path d="M92 84c18-1 38 2 54 9" />
          <path d="M92 104c18-1 38 2 54 9" />
          <path d="M92 124c18-1 38 2 54 9" />
          <path d="M174 93c16-7 36-10 54-9" />
          <path d="M174 113c16-7 36-10 54-9" />
          <path d="M174 133c16-7 36-10 54-9" />
        </g>

        {/* Bookmark ribbon */}
        <path d="M214 60v46l-11-9-11 9V56z" fill="currentColor" opacity="0.9" />
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Registry — maps a campaign's `art` key to its illustration
// ------------------------------------------------------------

export const BANNER_ART = {
  lawyer: LawyerArt,
  contract: ContractArt,
  nda: NdaArt,
  library: LibraryArt,
} as const;

export type BannerArtKey = keyof typeof BANNER_ART;
