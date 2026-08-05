// ============================================================
// LEGALIR — Material Design V2 Typography Tokens
// Vazir-first, with English fallback
// ============================================================

export const fontFamily = {
  fa: `Vazir, Vazirmatn, "Noto Sans Arabic", Tahoma, sans-serif`,
  en: `"Inter", system-ui, -apple-system, sans-serif`,
} as const;

export const typeScale = {
  // Display
  displayLarge: {
    fontSize: "57px",
    lineHeight: "64px",
    fontWeight: "400",
    letterSpacing: "-0.25px",
  },
  displayMedium: {
    fontSize: "45px",
    lineHeight: "52px",
    fontWeight: "400",
    letterSpacing: "0px",
  },
  displaySmall: {
    fontSize: "36px",
    lineHeight: "44px",
    fontWeight: "400",
    letterSpacing: "0px",
  },

  // Headline
  headlineLarge: {
    fontSize: "32px",
    lineHeight: "40px",
    fontWeight: "700",
    letterSpacing: "0px",
  },
  headlineMedium: {
    fontSize: "28px",
    lineHeight: "36px",
    fontWeight: "700",
    letterSpacing: "0px",
  },
  headlineSmall: {
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: "700",
    letterSpacing: "0px",
  },

  // Title
  titleLarge: {
    fontSize: "22px",
    lineHeight: "28px",
    fontWeight: "500",
    letterSpacing: "0px",
  },
  titleMedium: { fontSize: "16px", lineHeight: "24px", fontWeight: "500", letterSpacing: "0.15px" },
  titleSmall: {
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: "500",
    letterSpacing: "0.1px",
  },

  // Label
  labelLarge: {
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: "500",
    letterSpacing: "0.1px",
  },
  labelMedium: {
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: "500",
    letterSpacing: "0.5px",
  },
  labelSmall: {
    fontSize: "11px",
    lineHeight: "16px",
    fontWeight: "500",
    letterSpacing: "0.5px",
  },

  // Body
  bodyLarge: {
    fontSize: "16px",
    lineHeight: "28px",
    fontWeight: "400",
    letterSpacing: "0.5px",
  },
  bodyMedium: {
    fontSize: "14px",
    lineHeight: "24px",
    fontWeight: "400",
    letterSpacing: "0.25px",
  },
  bodySmall: {
    fontSize: "12px",
    lineHeight: "20px",
    fontWeight: "400",
    letterSpacing: "0.4px",
  },
} as const;

export type TypeScaleKey = keyof typeof typeScale;

export function getTypographyClass(key: TypeScaleKey): string {
  const scale = typeScale[key];
  return `text-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
}
