// ============================================================
// LEGALIR — Contract visual system
// ============================================================
// The Contracts page shows two kinds of card, and both need a visual
// that is more than a 24px outline glyph:
//
//   • a TEMPLATE card is inspirational — it must make the user want to
//     start that contract;
//   • a USER contract card is a work item — its visual is a small,
//     quiet thumbnail that anchors the row.
//
// There are no illustration assets in the repo, so this module is the
// single, hand-built visual system: one abstract SVG scene per contract
// type, all on the same 320×180 (16:9) viewBox so a grid of cards never
// shifts layout. Every scene is drawn from the MD3 semantic tokens via
// `currentColor` + one accent hue, so it themes with the app and never
// hard-codes a hex value.
//
// Adding a contract type means adding one scene here — the cards read
// `hasContractVisual` / `ContractVisual` and never branch on the type.
// ============================================================

import React from "react";
import type { ContractTypeId } from "@legalir/types";

/** The accent hue each scene is drawn in. Falls back to primary. */
const ACCENTS: Record<string, string> = {
  property_rent: "var(--color-primary)",
  property_sale: "var(--color-secondary)",
  vehicle_sale: "var(--color-tertiary)",
  debt: "var(--color-primary)",
  freelance: "var(--color-secondary)",
  nda: "var(--color-tertiary)",
  saas: "var(--color-primary)",
  startup: "var(--color-secondary)",
};

/**
 * The shared frame every scene draws inside: a soft accent plate plus
 * the two stroke weights the scenes use. Keeping this in one place is
 * what makes eight hand-drawn scenes read as one system.
 */
function Scene({
  accent,
  children,
}: {
  accent: string;
  children: React.ReactNode;
}) {
  const uid = React.useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`plate-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.16" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.03" />
        </linearGradient>
        <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.9" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <rect width="320" height="180" fill={`url(#plate-${uid})`} />

      {/* A faint horizon line grounds every scene on the same baseline. */}
      <line
        x1="24"
        y1="140"
        x2="296"
        y2="140"
        stroke={accent}
        strokeOpacity="0.18"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <g
        fill="none"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Scenes
// ------------------------------------------------------------

/** Rent — a residential block with lit windows and a key. */
function RentScene({ accent }: { accent: string }) {
  return (
    <Scene accent={accent}>
      <rect x="52" y="44" width="96" height="96" rx="6" />
      <line x1="52" y1="76" x2="148" y2="76" />
      <line x1="52" y1="108" x2="148" y2="108" />
      <line x1="84" y1="44" x2="84" y2="140" />
      <line x1="116" y1="44" x2="116" y2="140" />
      <rect x="66" y="56" width="12" height="12" rx="2" fill={accent} fillOpacity="0.35" stroke="none" />
      <rect x="98" y="88" width="12" height="12" rx="2" fill={accent} fillOpacity="0.35" stroke="none" />
      <rect x="130" y="120" width="12" height="12" rx="2" fill={accent} fillOpacity="0.35" stroke="none" />
      {/* Key */}
      <circle cx="212" cy="86" r="16" />
      <line x1="224" y1="98" x2="256" y2="130" />
      <line x1="244" y1="118" x2="256" y2="106" />
      <line x1="252" y1="126" x2="264" y2="114" />
    </Scene>
  );
}

/** Sale — a house with a transfer arrow and a signed deed. */
function SaleScene({ accent }: { accent: string }) {
  return (
    <Scene accent={accent}>
      <path d="M56 96 L104 56 L152 96" />
      <path d="M68 90 V140 H140 V90" />
      <rect x="92" y="112" width="24" height="28" rx="3" />
      {/* Deed */}
      <rect x="188" y="52" width="76" height="88" rx="6" />
      <line x1="202" y1="76" x2="250" y2="76" />
      <line x1="202" y1="92" x2="250" y2="92" />
      <line x1="202" y1="108" x2="234" y2="108" />
      {/* Transfer arrow */}
      <path d="M160 118 H182" />
      <path d="M174 110 L182 118 L174 126" />
    </Scene>
  );
}

/** Vehicle — a car on a road with a plate. */
function VehicleScene({ accent }: { accent: string }) {
  return (
    <Scene accent={accent}>
      <path d="M64 116 L80 84 H208 L224 116" />
      <path d="M56 116 H232 V132 H56 Z" />
      <path d="M92 84 L100 104 H188 L196 84" />
      <circle cx="92" cy="134" r="12" />
      <circle cx="196" cy="134" r="12" />
      <circle cx="92" cy="134" r="4" fill={accent} fillOpacity="0.4" stroke="none" />
      <circle cx="196" cy="134" r="4" fill={accent} fillOpacity="0.4" stroke="none" />
      <rect x="132" y="120" width="28" height="10" rx="2" fill={accent} fillOpacity="0.3" stroke="none" />
    </Scene>
  );
}

/** Debt — stacked coins and a repayment arrow. */
function DebtScene({ accent }: { accent: string }) {
  return (
    <Scene accent={accent}>
      <ellipse cx="104" cy="128" rx="40" ry="12" />
      <path d="M64 128 V112 M144 128 V112" />
      <ellipse cx="104" cy="112" rx="40" ry="12" />
      <path d="M64 112 V96 M144 112 V96" />
      <ellipse cx="104" cy="96" rx="40" ry="12" />
      <path d="M64 96 V80 M144 96 V80" />
      <ellipse cx="104" cy="80" rx="40" ry="12" />
      {/* Repayment arrow */}
      <path d="M196 96 C232 96 232 128 200 128" />
      <path d="M208 120 L200 128 L208 136" />
    </Scene>
  );
}

/** Freelance — a laptop with a task checklist. */
function FreelanceScene({ accent }: { accent: string }) {
  return (
    <Scene accent={accent}>
      <rect x="60" y="56" width="120" height="76" rx="6" />
      <path d="M48 132 H192 L184 144 H56 Z" />
      <line x1="76" y1="76" x2="120" y2="76" />
      <line x1="76" y1="92" x2="140" y2="92" />
      <line x1="76" y1="108" x2="112" y2="108" />
      {/* Checklist */}
      <rect x="212" y="60" width="60" height="76" rx="6" />
      <path d="M224 80 L230 86 L242 72" />
      <path d="M224 102 L230 108 L242 94" />
      <line x1="250" y1="80" x2="262" y2="80" />
      <line x1="250" y1="102" x2="262" y2="102" />
    </Scene>
  );
}

/** NDA — a shield with a padlock. */
function NdaScene({ accent }: { accent: string }) {
  return (
    <Scene accent={accent}>
      <path d="M160 40 L216 60 V104 C216 128 190 144 160 152 C130 144 104 128 104 104 V60 Z" />
      <rect x="140" y="94" width="40" height="34" rx="5" />
      <path d="M148 94 V84 A12 12 0 0 1 172 84 V94" />
      <circle cx="160" cy="110" r="4" fill={accent} fillOpacity="0.5" stroke="none" />
      <line x1="160" y1="114" x2="160" y2="122" />
    </Scene>
  );
}

/** SaaS — a cloud over connected server nodes. */
function SaasScene({ accent }: { accent: string }) {
  return (
    <Scene accent={accent}>
      <path d="M112 92 A26 26 0 0 1 116 42 A30 30 0 0 1 172 40 A24 24 0 0 1 208 92 Z" />
      <line x1="160" y1="92" x2="160" y2="112" />
      <rect x="72" y="112" width="56" height="28" rx="5" />
      <rect x="132" y="112" width="56" height="28" rx="5" />
      <rect x="192" y="112" width="56" height="28" rx="5" />
      <circle cx="88" cy="126" r="3.5" fill={accent} fillOpacity="0.5" stroke="none" />
      <circle cx="148" cy="126" r="3.5" fill={accent} fillOpacity="0.5" stroke="none" />
      <circle cx="208" cy="126" r="3.5" fill={accent} fillOpacity="0.5" stroke="none" />
    </Scene>
  );
}

/** Startup — a growth chart with founder nodes. */
function StartupScene({ accent }: { accent: string }) {
  return (
    <Scene accent={accent}>
      <path d="M56 132 H264" />
      <path d="M56 132 V52" />
      <path d="M72 120 L120 96 L164 108 L216 64 L252 76" />
      <circle cx="120" cy="96" r="6" fill={accent} fillOpacity="0.4" />
      <circle cx="164" cy="108" r="6" fill={accent} fillOpacity="0.4" />
      <circle cx="216" cy="64" r="6" fill={accent} fillOpacity="0.4" />
      <path d="M216 64 L232 48" />
      <path d="M224 48 H232 V56" />
    </Scene>
  );
}

const SCENES: Record<string, (props: { accent: string }) => React.ReactElement> = {
  property_rent: RentScene,
  property_sale: SaleScene,
  vehicle_sale: VehicleScene,
  debt: DebtScene,
  freelance: FreelanceScene,
  nda: NdaScene,
  saas: SaasScene,
  startup: StartupScene,
};

/** True when a hand-built scene exists for this contract type. */
export function hasContractVisual(type: string): boolean {
  return type in SCENES;
}

/** The accent hue for a contract type (used for badges and rails too). */
export function contractAccent(type: string): string {
  return ACCENTS[type] ?? "var(--color-primary)";
}

interface ContractVisualProps {
  type: ContractTypeId | string;
  /** Override the accent hue (defaults to the type's own accent). */
  accent?: string;
  className?: string;
}

/**
 * The illustration for a contract type. Renders nothing when the type
 * has no scene, so a caller can fall back to an icon without branching
 * on the type itself.
 */
export function ContractVisual({ type, accent, className = "" }: ContractVisualProps) {
  const SceneComponent = SCENES[type];
  if (!SceneComponent) return null;
  return (
    <div className={className}>
      <SceneComponent accent={accent ?? contractAccent(type)} />
    </div>
  );
}
