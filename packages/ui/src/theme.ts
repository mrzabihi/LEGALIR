// ============================================================
// LEGALIR — Theme Configuration
// ============================================================

import { lightThemeColors, darkThemeColors } from "./tokens/colors";

export type Theme = "light" | "dark";

export { lightThemeColors, darkThemeColors, getThemeColors } from "./tokens/colors";

export const typography = {
  h1: { fontSize: "32px", lineHeight: "48px", fontWeight: "700" },
  h2: { fontSize: "24px", lineHeight: "38px", fontWeight: "700" },
  h3: { fontSize: "20px", lineHeight: "32px", fontWeight: "500" },
  body1: { fontSize: "16px", lineHeight: "28px", fontWeight: "400" },
  body2: { fontSize: "14px", lineHeight: "24px", fontWeight: "400" },
  button: { fontSize: "14px", lineHeight: "22px", fontWeight: "500" },
  caption: { fontSize: "12px", lineHeight: "20px", fontWeight: "400" },
} as const;

export const fontFamily = `Vazir, Vazirmatn, "Noto Sans Arabic", Tahoma, sans-serif`;

// Legacy theme tokens — kept for backward compatibility
export const themeTokens = {
  light: {
    primary: lightThemeColors.primary,
    primaryVariant: lightThemeColors.primaryVariant,
    secondary: lightThemeColors.secondary,
    background: lightThemeColors.background,
    surface: lightThemeColors.surface,
    onSurface: lightThemeColors.onSurface,
    muted: lightThemeColors.onSurfaceVariant,
    error: lightThemeColors.error,
    warning: lightThemeColors.warning,
    success: lightThemeColors.success,
    border: lightThemeColors.outlineVariant,
    divider: lightThemeColors.divider,
  },
  dark: {
    primary: darkThemeColors.primary,
    primaryVariant: darkThemeColors.primaryVariant,
    secondary: darkThemeColors.secondary,
    background: darkThemeColors.background,
    surface: darkThemeColors.surface,
    onSurface: darkThemeColors.onSurface,
    muted: darkThemeColors.onSurfaceVariant,
    error: darkThemeColors.error,
    warning: darkThemeColors.warning,
    success: darkThemeColors.success,
    border: darkThemeColors.outlineVariant,
    divider: darkThemeColors.divider,
  },
} as const;
