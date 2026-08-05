import type { Config } from "tailwindcss";

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
          DEFAULT: "var(--color-primary)",
          variant: "var(--color-primary-variant)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
        },
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        surfaceVariant: "var(--color-surface-variant)",
        "on-surface": "var(--color-on-surface)",
        "on-surface-variant": "var(--color-on-surface-variant)",
        muted: "var(--color-muted)",
        error: "var(--color-error)",
        warning: "var(--color-warning)",
        success: "var(--color-success)",
        border: "var(--color-border)",
        divider: "var(--color-divider)",
        outline: "var(--color-outline)",
      },
      fontFamily: {
        sans: ["Vazir", "Vazirmatn", '"Noto Sans Arabic"', "Tahoma", "sans-serif"],
      },
      fontSize: {
        h1: ["32px", { lineHeight: "48px", fontWeight: "700" }],
        h2: ["24px", { lineHeight: "38px", fontWeight: "700" }],
        h3: ["20px", { lineHeight: "32px", fontWeight: "500" }],
        "body-1": ["16px", { lineHeight: "28px", fontWeight: "400" }],
        "body-2": ["14px", { lineHeight: "24px", fontWeight: "400" }],
        button: ["14px", { lineHeight: "22px", fontWeight: "500" }],
        caption: ["12px", { lineHeight: "20px", fontWeight: "400" }],
      },
      borderRadius: {
        small: "var(--shape-small)",
        medium: "var(--shape-medium)",
        large: "var(--shape-large)",
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
        "elevation-1": "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
        "elevation-3": "0 1px 3px rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.10)",
        "elevation-4": "0 4px 6px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)",
        "elevation-8": "0 8px 16px rgba(0,0,0,0.14), 0 4px 8px rgba(0,0,0,0.08)",
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
        "drawer-slide-in": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "scroll-reveal": "scroll-reveal 0.6s cubic-bezier(0.4, 0.0, 0.2, 1) both",
        "shimmer": "shimmer 1.8s ease-in-out infinite",
        "gradient-shift": "gradient-shift 12s ease-in-out infinite",
        "float": "float 4s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "skeleton-pulse": "skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up-fade": "slide-up-fade 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
        "drawer-slide-in": "drawer-slide-in 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
      },
      screens: {
        "mobile-s": "320px",
        "mobile-l": "375px",
        tablet: "600px",
        laptop: "900px",
        desktop: "1024px",
        wide: "1440px",
      },
    },
  },
  plugins: [],
};

export default config;
