// ============================================================
// LEGALIR — Material Design V2 Spacing Tokens
// 8px base grid system
// ============================================================

/** Base spacing unit: 8px */
const UNIT = 8;

export const spacing = {
  /** 0px */
  0: "0px",
  /** 4px */
  0.5: `${UNIT * 0.5}px`,
  /** 8px */
  1: `${UNIT}px`,
  /** 12px */
  1.5: `${UNIT * 1.5}px`,
  /** 16px */
  2: `${UNIT * 2}px`,
  /** 24px */
  3: `${UNIT * 3}px`,
  /** 32px */
  4: `${UNIT * 4}px`,
  /** 40px */
  5: `${UNIT * 5}px`,
  /** 48px */
  6: `${UNIT * 6}px`,
  /** 56px */
  7: `${UNIT * 7}px`,
  /** 64px */
  8: `${UNIT * 8}px`,
  /** 80px */
  10: `${UNIT * 10}px`,
  /** 96px */
  12: `${UNIT * 12}px`,
  /** 128px */
  16: `${UNIT * 16}px`,
} as const;

/** Responsive layout widths */
export const layout = {
  /** Mobile breakpoint: 320px */
  mobileS: 320,
  /** Mobile large breakpoint: 375px */
  mobileL: 375,
  /** Tablet breakpoint: 600px */
  tablet: 600,
  /** Desktop breakpoint: 1024px */
  desktop: 1024,
  /** Wide breakpoint: 1440px */
  wide: 1440,

  /** Max content width */
  maxContent: 1200,
  /** Narrow content (reading) */
  maxNarrow: 720,
  /** Drawer width */
  drawerWidth: 280,
} as const;

/** Touch target sizes — 48px minimum accessible */
export const touch = {
  /** Standard 48×48px */
  standard: "48px",
  /** Compact 40×40px (use sparingly) */
  compact: "40px",
} as const;
