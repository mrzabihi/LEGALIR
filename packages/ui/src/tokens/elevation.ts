// ============================================================
// LEGALIR — Material Design V2 Elevation Tokens
// ============================================================

export const elevationLevels = {
  0: "none",
  1: "0 1px 2px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)",
  2: "0 1px 2px rgba(0,0,0,0.16), 0 2px 4px rgba(0,0,0,0.10)",
  3: "0 1px 3px rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.10)",
  4: "0 2px 3px rgba(0,0,0,0.20), 0 6px 10px rgba(0,0,0,0.10)",
  6: "0 4px 5px rgba(0,0,0,0.22), 0 8px 16px rgba(0,0,0,0.10)",
  8: "0 6px 6px rgba(0,0,0,0.24), 0 12px 24px rgba(0,0,0,0.10)",
  12: "0 8px 8px rgba(0,0,0,0.26), 0 16px 32px rgba(0,0,0,0.10)",
  16: "0 10px 10px rgba(0,0,0,0.28), 0 24px 38px rgba(0,0,0,0.10)",
  24: "0 12px 12px rgba(0,0,0,0.30), 0 32px 48px rgba(0,0,0,0.10)",
} as const;

export const elevationDarkOverlay = {
  1: 0.2,
  2: 0.24,
  3: 0.28,
  4: 0.30,
  6: 0.32,
  8: 0.34,
  12: 0.36,
  16: 0.38,
  24: 0.40,
} as const;

export type ElevationLevel = keyof typeof elevationLevels;

export function elevationShadow(level: ElevationLevel, isDark: boolean): string {
  const base = elevationLevels[level];
  if (base === "none") return "none";

  // In dark theme, shadows appear lighter/more diffused
  if (isDark && level !== 0) {
    const overlay = elevationDarkOverlay[level];
    return base.replace(
      /rgba\(0,0,0,([^)]+)\)/g,
      (_, alpha) => `rgba(0,0,0,${parseFloat(alpha) + overlay})`
    );
  }

  return base;
}
