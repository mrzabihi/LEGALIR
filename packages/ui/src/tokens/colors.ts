// ============================================================
// LEGALIR — Material Design V2 Color Tokens
// Deep Navy + Gold + White brand direction
// ============================================================

export const brandColors = {
  navy: {
    50: "#E8EDF2",
    100: "#C5D2DE",
    200: "#9FB4C8",
    300: "#7996B1",
    400: "#5C7EA0",
    500: "#3F678E",
    600: "#1E4F79",
    700: "#102E4A", // PRIMARY
    800: "#0A2034", // PRIMARY VARIANT
    900: "#061422",
  },
  gold: {
    50: "#FDF8EC",
    100: "#FAEECF",
    200: "#F5E1AF",
    300: "#F1D48F",
    400: "#EDC775",
    500: "#E6C35C",
    600: "#D4A92A",
    700: "#B8860B", // SECONDARY
    800: "#8C6508",
    900: "#604405",
  },
};

export const semanticColors = {
  error: {
    DEFAULT: "#B3261E",
    light: "#FFB4AB",
    bg: "#FCE4E4",
  },
  warning: {
    DEFAULT: "#9A6700",
    light: "#F4C95D",
    bg: "#FFF4E0",
  },
  success: {
    DEFAULT: "#1F6B45",
    light: "#7BD9A8",
    bg: "#E6F4EC",
  },
  info: {
    DEFAULT: "#1565C0",
    light: "#90CAF9",
    bg: "#E3F2FD",
  },
};

export const stateLayerOpacity = {
  hover: 0.08,
  focus: 0.12,
  pressed: 0.12,
  dragged: 0.16,
  disabled: 0.38,
} as const;

export type ThemeColors = typeof lightThemeColors;

export const lightThemeColors = {
  primary: brandColors.navy[700],
  primaryVariant: brandColors.navy[800],
  onPrimary: "#FFFFFF",
  primaryContainer: brandColors.navy[50],
  onPrimaryContainer: brandColors.navy[900],

  secondary: brandColors.gold[700],
  secondaryVariant: brandColors.gold[800],
  onSecondary: "#FFFFFF",
  secondaryContainer: brandColors.gold[50],
  onSecondaryContainer: brandColors.gold[900],

  background: "#F7F8FA",
  onBackground: "#17212B",

  surface: "#FFFFFF",
  surfaceVariant: "#F0F2F5",
  onSurface: "#17212B",
  onSurfaceVariant: "#66727D",

  outline: "#8B95A1",
  outlineVariant: "#DEE2E6",
  divider: "#E9ECEF",

  error: semanticColors.error.DEFAULT,
  onError: "#FFFFFF",
  errorContainer: semanticColors.error.bg,
  onErrorContainer: "#601410",

  warning: semanticColors.warning.DEFAULT,
  onWarning: "#FFFFFF",
  warningContainer: semanticColors.warning.bg,
  onWarningContainer: "#4D3300",

  success: semanticColors.success.DEFAULT,
  onSuccess: "#FFFFFF",
  successContainer: semanticColors.success.bg,
  onSuccessContainer: "#0D331F",

  inverseSurface: "#2D3748",
  inverseOnSurface: "#F2F5F7",
  inversePrimary: "#A9C7E3",

  scrim: "rgba(0,0,0,0.5)",
  shadow: "rgba(0,0,0,0.12)",
};

export const darkThemeColors = {
  primary: brandColors.navy[100],
  primaryVariant: brandColors.navy[200],
  onPrimary: brandColors.navy[900],
  primaryContainer: brandColors.navy[800],
  onPrimaryContainer: brandColors.navy[50],

  secondary: brandColors.gold[500],
  secondaryVariant: brandColors.gold[400],
  onSecondary: brandColors.gold[900],
  secondaryContainer: brandColors.gold[800],
  onSecondaryContainer: brandColors.gold[50],

  background: "#0E141B",
  onBackground: "#F2F5F7",

  surface: "#17212B",
  surfaceVariant: "#1E2A38",
  onSurface: "#F2F5F7",
  onSurfaceVariant: "#A9B3BD",

  outline: "#5C6A7D",
  outlineVariant: "#2D3748",
  divider: "#1E2A38",

  error: semanticColors.error.light,
  onError: "#601410",
  errorContainer: "#4A1412",
  onErrorContainer: "#FFB4AB",

  warning: semanticColors.warning.light,
  onWarning: "#4D3300",
  warningContainer: "#4A3310",
  onWarningContainer: "#F4C95D",

  success: semanticColors.success.light,
  onSuccess: "#0D331F",
  successContainer: "#1A4A2E",
  onSuccessContainer: "#7BD9A8",

  inverseSurface: "#F2F5F7",
  inverseOnSurface: "#2D3748",
  inversePrimary: "#102E4A",

  scrim: "rgba(0,0,0,0.7)",
  shadow: "rgba(0,0,0,0.3)",
};

export function getThemeColors(theme: "light" | "dark") {
  return theme === "dark" ? darkThemeColors : lightThemeColors;
}
