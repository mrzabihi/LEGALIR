import type { Config } from "tailwindcss";

/**
 * Build a full 50–900 shade map that points at a semantic ramp's CSS vars.
 * Lets legacy raw-hue classes (`bg-amber-50`, `text-blue-700`) resolve to the
 * themeable semantic tokens instead of Tailwind's static palette.
 *
 * `offset` shifts the whole ramp so sibling hues (e.g. `blue` vs `indigo`)
 * stay visually distinct — important for two-tone decorative gradients.
 */
function semanticAlias(
  role: "error" | "warning" | "success" | "info",
  offset = 0
) {
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
  return Object.fromEntries(
    shades.map((s) => {
      const idx = shades.indexOf(s);
      const shifted = shades[Math.min(shades.length - 1, Math.max(0, idx + offset))];
      return [s, `var(--color-${role}-${shifted})`];
    })
  ) as Record<(typeof shades)[number], string>;
}

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          200: "var(--color-primary-200)",
          300: "var(--color-primary-300)",
          400: "var(--color-primary-400)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          800: "var(--color-primary-800)",
          900: "var(--color-primary-900)",
          DEFAULT: "var(--color-primary)",
          variant: "var(--color-primary-variant)",
          container: "var(--color-primary-container)",
          on: "var(--color-on-primary)",
          "on-container": "var(--color-on-primary-container)",
        },
        secondary: {
          50: "var(--color-secondary-50)",
          100: "var(--color-secondary-100)",
          200: "var(--color-secondary-200)",
          300: "var(--color-secondary-300)",
          400: "var(--color-secondary-400)",
          500: "var(--color-secondary-500)",
          600: "var(--color-secondary-600)",
          700: "var(--color-secondary-700)",
          800: "var(--color-secondary-800)",
          900: "var(--color-secondary-900)",
          DEFAULT: "var(--color-secondary)",
          light: "var(--color-secondary-light)",
          variant: "var(--color-secondary-variant)",
          container: "var(--color-secondary-container)",
          on: "var(--color-on-secondary)",
          "on-container": "var(--color-on-secondary-container)",
        },
        tertiary: {
          DEFAULT: "var(--color-tertiary)",
          container: "var(--color-tertiary-container)",
          on: "var(--color-on-tertiary)",
          "on-container": "var(--color-on-tertiary-container)",
        },
        neutral: {
          0: "var(--color-neutral-0)",
          50: "var(--color-neutral-50)",
          100: "var(--color-neutral-100)",
          200: "var(--color-neutral-200)",
          250: "var(--color-neutral-250)",
          300: "var(--color-neutral-300)",
          400: "var(--color-neutral-400)",
          500: "var(--color-neutral-500)",
          600: "var(--color-neutral-600)",
          700: "var(--color-neutral-700)",
          800: "var(--color-neutral-800)",
          900: "var(--color-neutral-900)",
          950: "var(--color-neutral-950)",
        },
        background: "var(--color-background)",
        surface: {
          DEFAULT: "var(--color-surface)",
          dim: "var(--color-surface-dim)",
          bright: "var(--color-surface-bright)",
          variant: "var(--color-surface-variant)",
          container: "var(--color-surface-container)",
          "container-lowest": "var(--color-surface-container-lowest)",
          "container-low": "var(--color-surface-container-low)",
          "container-high": "var(--color-surface-container-high)",
          "container-highest": "var(--color-surface-container-highest)",
          // `bg-surface-hover` is written all over the panel but was never
          // mapped here, so the class emitted no CSS and every hover state
          // silently did nothing. Alias it at the top level too (below).
          hover: "var(--color-surface-hover)",
        },
        "surface-hover": "var(--color-surface-hover)",
        // `bg-scrim` (the modal/drawer/popover backdrop) is written across the
        // app but `--color-scrim` was never exposed to Tailwind, so the class
        // emitted no CSS and every backdrop was invisible. Alias it here.
        scrim: "var(--color-scrim)",
        // Explicit solid container roles. Tailwind 3.4 cannot apply an
        // `/opacity` modifier to a `var()` colour (it silently drops the
        // class), so pick a solid container token instead of e.g. `bg-primary/10`
        // — those classes emit nothing. These are the safe, themeable
        // equivalents the admin panel builds its tints from.
        "primary-soft": "var(--color-primary-container)",
        "secondary-soft": "var(--color-secondary-container)",
        "success-soft": "var(--color-success-container)",
        "warning-soft": "var(--color-warning-container)",
        "error-soft": "var(--color-error-container)",
        "info-soft": "var(--color-info-container)",
        "surface-container": "var(--color-surface-container)",
        surfaceVariant: "var(--color-surface-variant)",
        "on-surface": "var(--color-on-surface)",
        "on-surface-variant": "var(--color-on-surface-variant)",
        muted: "var(--color-muted)",
        error: {
          DEFAULT: "var(--color-error)",
          50: "var(--color-error-50)",
          100: "var(--color-error-100)",
          200: "var(--color-error-200)",
          300: "var(--color-error-300)",
          400: "var(--color-error-400)",
          500: "var(--color-error-500)",
          600: "var(--color-error-600)",
          700: "var(--color-error-700)",
          800: "var(--color-error-800)",
          900: "var(--color-error-900)",
          container: "var(--color-error-container)",
          on: "var(--color-on-error)",
          "on-container": "var(--color-on-error-container)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          50: "var(--color-warning-50)",
          100: "var(--color-warning-100)",
          200: "var(--color-warning-200)",
          300: "var(--color-warning-300)",
          400: "var(--color-warning-400)",
          500: "var(--color-warning-500)",
          600: "var(--color-warning-600)",
          700: "var(--color-warning-700)",
          800: "var(--color-warning-800)",
          900: "var(--color-warning-900)",
          container: "var(--color-warning-container)",
          on: "var(--color-on-warning)",
          "on-container": "var(--color-on-warning-container)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          50: "var(--color-success-50)",
          100: "var(--color-success-100)",
          200: "var(--color-success-200)",
          300: "var(--color-success-300)",
          400: "var(--color-success-400)",
          500: "var(--color-success-500)",
          600: "var(--color-success-600)",
          700: "var(--color-success-700)",
          800: "var(--color-success-800)",
          900: "var(--color-success-900)",
          container: "var(--color-success-container)",
          on: "var(--color-on-success)",
          "on-container": "var(--color-on-success-container)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          50: "var(--color-info-50)",
          100: "var(--color-info-100)",
          200: "var(--color-info-200)",
          300: "var(--color-info-300)",
          400: "var(--color-info-400)",
          500: "var(--color-info-500)",
          600: "var(--color-info-600)",
          700: "var(--color-info-700)",
          800: "var(--color-info-800)",
          900: "var(--color-info-900)",
          container: "var(--color-info-container)",
          on: "var(--color-on-info)",
          "on-container": "var(--color-on-info-container)",
        },
        // Selection-control state colours (checkbox · switch · selectable
        // option/card). Backed by the `--control-*` custom properties so the
        // brand green lives in exactly one place.
        control: {
          selected: "var(--control-selected)",
          "selected-foreground": "var(--control-selected-foreground)",
          "selected-surface": "var(--control-selected-surface)",
          "selected-border": "var(--control-selected-border)",
          "unselected-bg": "var(--control-unselected-bg)",
          "unselected-border": "var(--control-unselected-border)",
          hover: "var(--control-hover)",
          focus: "var(--control-focus)",
          "disabled-bg": "var(--control-disabled-bg)",
          "disabled-text": "var(--control-disabled-text)",
        },
        // Hue aliases → semantic roles. Legacy markup used raw Tailwind hues
        // (amber/blue/emerald/red/green); these map them onto the themeable
        // semantic ramps so dark mode works without touching every file.
        amber: semanticAlias("warning"),
        yellow: semanticAlias("warning", 1),
        orange: semanticAlias("warning", -1),
        blue: semanticAlias("info"),
        sky: semanticAlias("info", 1),
        cyan: semanticAlias("info", 2),
        indigo: semanticAlias("info", -1),
        purple: semanticAlias("info", -2),
        violet: semanticAlias("info", -3),
        fuchsia: semanticAlias("info", -4),
        emerald: semanticAlias("success"),
        green: semanticAlias("success", 1),
        teal: semanticAlias("success", -1),
        lime: semanticAlias("success", 2),
        red: semanticAlias("error"),
        rose: semanticAlias("error", 1),
        pink: semanticAlias("error", 2),
        // Warm Smoked Glass navigation material — shared by the desktop
        // sidebar and the mobile bottom navigation (see globals.css).
        glass: {
          surface: "var(--warm-glass-surface)",
          "surface-strong": "var(--warm-glass-surface-strong)",
          border: "var(--warm-glass-border)",
          ivory: "var(--warm-glass-ivory)",
          "ivory-muted": "var(--warm-glass-ivory-muted)",
          state: "var(--warm-glass-state-layer)",
          "state-strong": "var(--warm-glass-state-layer-strong)",
        },
        border: "var(--color-border)",
        divider: "var(--color-divider)",
        outline: "var(--color-outline)",
        // MD3 outline-variant role — used by card/divider borders across the
        // dashboard and assistant surfaces. Was defined in globals.css but
        // never mapped here, so `border-outline-variant` emitted no CSS.
        outlineVariant: "var(--color-outline-variant)",
        "outline-variant": "var(--color-outline-variant)",
        // camelCase aliases — the @legalir/ui design-system components use
        // MD3 role names in camelCase (e.g. `text-onSurfaceVariant`).
        onSurface: "var(--color-on-surface)",
        onSurfaceVariant: "var(--color-on-surface-variant)",
        onPrimary: "var(--color-on-primary)",
        onPrimaryContainer: "var(--color-on-primary-container)",
        primaryContainer: "var(--color-primary-container)",
        secondaryContainer: "var(--color-secondary-container)",
        onSecondaryContainer: "var(--color-on-secondary-container)",
        onError: "var(--color-on-error)",
        onErrorContainer: "var(--color-on-error-container)",
        onWarning: "var(--color-on-warning)",
        onSuccess: "var(--color-on-success)",
        onInfo: "var(--color-on-info)",
        onBackground: "var(--color-on-background)",
        // Kebab-case aliases for the SAME on-* roles. Most of the app (and
        // @legalir/ui) writes `text-primary-on`, but a handful of surfaces
        // write `text-on-primary`; without these keys that class emitted no
        // CSS and silently inherited `--color-on-surface`, so e.g. the active
        // range pill rendered dark text on the dark primary fill (invisible).
        "on-primary": "var(--color-on-primary)",
        "on-primary-container": "var(--color-on-primary-container)",
        "on-secondary": "var(--color-on-secondary)",
        "on-secondary-container": "var(--color-on-secondary-container)",
        "on-tertiary": "var(--color-on-tertiary)",
        "on-tertiary-container": "var(--color-on-tertiary-container)",
        "on-error": "var(--color-on-error)",
        "on-error-container": "var(--color-on-error-container)",
        "on-warning": "var(--color-on-warning)",
        "on-warning-container": "var(--color-on-warning-container)",
        "on-success": "var(--color-on-success)",
        "on-success-container": "var(--color-on-success-container)",
        "on-info": "var(--color-on-info)",
        "on-info-container": "var(--color-on-info-container)",
        "on-background": "var(--color-on-background)",
      },
      fontFamily: {
        sans: ["Vazir", "Vazirmatn", '"Noto Sans Arabic"', "Tahoma", "sans-serif"],
      },
      fontSize: {
        h1: ["32px", { lineHeight: "48px", fontWeight: "700" }],
        h2: ["24px", { lineHeight: "38px", fontWeight: "700" }],
        h3: ["20px", { lineHeight: "32px", fontWeight: "500" }],
        h4: ["18px", { lineHeight: "28px", fontWeight: "500" }],
        "body-1": ["16px", { lineHeight: "28px", fontWeight: "400" }],
        "body-2": ["14px", { lineHeight: "24px", fontWeight: "400" }],
        bodySmall: ["12px", { lineHeight: "20px", fontWeight: "400" }],
        bodyMedium: ["14px", { lineHeight: "24px", fontWeight: "400" }],
        button: ["14px", { lineHeight: "22px", fontWeight: "500" }],
        caption: ["12px", { lineHeight: "20px", fontWeight: "400" }],
        labelSmall: ["10px", { lineHeight: "16px", fontWeight: "500" }],
        labelMedium: ["12px", { lineHeight: "20px", fontWeight: "500" }],
        labelLarge: ["14px", { lineHeight: "22px", fontWeight: "500" }],
        titleSmall: ["14px", { lineHeight: "22px", fontWeight: "600" }],
        titleMedium: ["16px", { lineHeight: "26px", fontWeight: "600" }],
      },
      borderRadius: {
        xs: "var(--shape-xs)",
        small: "var(--shape-small)",
        medium: "var(--shape-medium)",
        large: "var(--shape-large)",
        xlarge: "var(--shape-xlarge)",
        full: "var(--shape-full)",
      },
      spacing: {
        "1u": "4px",
        "2u": "8px",
        "3u": "12px",
        "4u": "16px",
        "6u": "24px",
        "8u": "32px",
        "12u": "48px",
      },
      boxShadow: {
        // Contract workspace sticky header — scroll-aware elevation. Named
        // rather than an arbitrary `shadow-[var(--…)]` because Tailwind
        // cannot disambiguate an arbitrary `var()` between box-shadow and
        // shadow-colour, and silently emits the colour form (no shadow).
        "contract-sticky": "var(--contract-sticky-shadow)",
        "elevation-1": "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
        "elevation-3": "0 1px 3px rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.10)",
        "elevation-4": "0 4px 6px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)",
        "elevation-8": "0 8px 16px rgba(0,0,0,0.14), 0 4px 8px rgba(0,0,0,0.08)",
        "elevation-16": "0 10px 10px rgba(0,0,0,0.20), 0 24px 38px rgba(0,0,0,0.06)",
        "elevation-24": "0 12px 12px rgba(0,0,0,0.24), 0 32px 48px rgba(0,0,0,0.06)",
      },
      keyframes: {
        "slide-in-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scroll-reveal": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(16, 46, 74, 0.3)" },
          "50%": { boxShadow: "0 0 20px 4px rgba(16, 46, 74, 0.15)" },
        },
        "skeleton-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "slide-up-fade": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Bottom-sheet reveal — rises from the bottom edge with a short fade.
        "sheet-up": {
          "0%": { opacity: "0", transform: "translateY(100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "drawer-slide-in": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        // Mirror of `drawer-slide-in` entering from the opposite edge. The
        // Drawer picks between the two with the `rtl:` variant so a panel
        // always slides in from the edge it is anchored to — never across the
        // screen. `both` fill (below) keeps the panel settled at translateX(0)
        // once the animation ends; without it the base transform would snap it
        // back off-screen.
        "drawer-slide-in-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "heading-shine": {
          "0%": { backgroundPosition: "200% center", opacity: "0", transform: "translateY(16px)" },
          "30%": { opacity: "1", transform: "translateY(0)" },
          "60%": { backgroundPosition: "-100% center" },
          "100%": { backgroundPosition: "-100% center", opacity: "1", transform: "translateY(0)" },
        },
        "hover-shimmer": {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
      animation: {
        // `both` = apply the 100% keyframe (translateX(0)) before AND after the
        // run, so the drawer never snaps back to its off-screen base transform.
        "drawer-slide-in": "drawer-slide-in 0.3s cubic-bezier(0.4, 0.0, 0.2, 1) both",
        "drawer-slide-in-left": "drawer-slide-in-left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1) both",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "scroll-reveal": "scroll-reveal 0.6s cubic-bezier(0.4, 0.0, 0.2, 1) both",
        "shimmer": "shimmer 1.8s ease-in-out infinite",
        "gradient-shift": "gradient-shift 12s ease-in-out infinite",
        "float": "float 4s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "skeleton-pulse": "skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up-fade": "slide-up-fade 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
        "sheet-up": "sheet-up var(--bottom-nav-motion-sheet) cubic-bezier(0.05, 0.7, 0.1, 1)",
        "heading-shine": "heading-shine 1.5s cubic-bezier(0.4, 0.0, 0.2, 1) both",
        "hover-shimmer": "hover-shimmer 1.2s ease-in-out infinite",
      },
      screens: {
        "mobile-s": "320px",
        "mobile-l": "375px",
        tablet: "600px",
        laptop: "900px",
        desktop: "1024px",
        wide: "1440px",
      },
      transitionDuration: {
        short1: "var(--motion-duration-short1)",
        short2: "var(--motion-duration-short2)",
        short3: "var(--motion-duration-short3)",
        short4: "var(--motion-duration-short4)",
        medium1: "var(--motion-duration-medium1)",
        medium2: "var(--motion-duration-medium2)",
        medium3: "var(--motion-duration-medium3)",
        medium4: "var(--motion-duration-medium4)",
        long1: "var(--motion-duration-long1)",
        long2: "var(--motion-duration-long2)",
        long3: "var(--motion-duration-long3)",
        long4: "var(--motion-duration-long4)",
        moderate1: "400ms",
      },
      transitionTimingFunction: {
        standard: "var(--motion-easing-standard)",
        "standard-decelerate": "var(--motion-easing-standard-decelerate)",
        "standard-accelerate": "var(--motion-easing-standard-accelerate)",
        emphasized: "var(--motion-easing-emphasized)",
        "emphasized-decelerate": "var(--motion-easing-emphasized-decelerate)",
        "emphasized-accelerate": "var(--motion-easing-emphasized-accelerate)",
      },
    },
  },
  plugins: [],
};

export default config;
