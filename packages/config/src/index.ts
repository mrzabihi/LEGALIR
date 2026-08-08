// ============================================================
// LEGALIR — Shared Configuration
// ============================================================

import type { FeatureFlags, RouteDefinition } from "@legalir/types";

export {
  browserEnvSchema,
  serverEnvSchema,
  validateBrowserEnv,
  validateServerEnv,
} from "./env";
export type { BrowserEnv, ServerEnv } from "./env";

// --- Environment ---

/*******************************************************************************
 * Browser-safe env reads (bracket notation for noUncheckedIndexedAccess)
 ******************************************************************************/
const pe = typeof process !== "undefined" ? process.env : {} as Record<string, string | undefined>;

export const env = {
  apiMode: (pe["NEXT_PUBLIC_API_MODE"] ?? "mock") as
    | "mock"
    | "hybrid"
    | "real-dev"
    | "preview"
    | "staging",
  apiBaseUrl: pe["NEXT_PUBLIC_API_BASE_URL"] ?? "",
  isProduction: pe["NODE_ENV"] === "production",
  isDevelopment: pe["NODE_ENV"] === "development",
  isTest: pe["NODE_ENV"] === "test",
} as const;

// --- Feature Flags ---

export const defaultFeatureFlags: FeatureFlags = {
  useMockApi: env.apiMode === "mock",
  documentAnalysis: pe["NEXT_PUBLIC_FEATURE_DOCUMENT_ANALYSIS"] !== "false",
  contractWorkspace: pe["NEXT_PUBLIC_FEATURE_CONTRACT_WORKSPACE"] !== "false",
  memory: pe["NEXT_PUBLIC_FEATURE_MEMORY"] !== "false",
  adminHistoryReview: false,
  englishLocale: pe["NEXT_PUBLIC_FEATURE_ENGLISH_LOCALE"] === "true",
};

// --- Route Registry ---

export const routeRegistry: RouteDefinition[] = [
  // Public
  { path: "/", titleFa: "صفحه اصلی", access: "guest", icon: "Home" },
  { path: "/pricing", titleFa: "تعرفه‌ها", access: "guest", icon: "Payment" },
  { path: "/features", titleFa: "قابلیت‌ها", access: "guest", icon: "Star" },
  { path: "/about", titleFa: "درباره LEGALIR", access: "guest", icon: "Info" },

  // Auth
  { path: "/auth/mobile", titleFa: "ورود", access: "guest", icon: "Login" },
  { path: "/auth/verify", titleFa: "تأیید کد", access: "challenge" },
  { path: "/auth/profile", titleFa: "تکمیل اطلاعات", access: "authenticated" },

  // App — Workplace
  { path: "/dashboard", titleFa: "محیط کار", access: "user", icon: "Dashboard" },
  { path: "/new", titleFa: "ساخت جدید", access: "user", icon: "Add" },
  { path: "/chat", titleFa: "گفت‌وگوی حقوقی", access: "entitled", icon: "Chat" },
  { path: "/documents", titleFa: "اسناد", access: "entitled", icon: "Description" },
  { path: "/contracts", titleFa: "قراردادها", access: "entitled", icon: "Article" },
  { path: "/history", titleFa: "تاریخچه", access: "user", icon: "History" },
  { path: "/memory", titleFa: "حافظه", access: "user", icon: "Memory" },
  { path: "/subscription", titleFa: "اشتراک", access: "user", icon: "WorkspacePremium" },
  { path: "/profile", titleFa: "پروفایل", access: "user", icon: "Person" },
  { path: "/settings", titleFa: "تنظیمات", access: "user", icon: "Settings" },
];

export const publicRoutes = routeRegistry.filter((r) => r.access === "guest").map((r) => r.path);
export const authRoutes = routeRegistry.filter((r) => r.access === "guest" || r.access === "challenge").map((r) => r.path);
export const appRoutes = routeRegistry.filter((r) => !authRoutes.includes(r.path)).map((r) => r.path);

// --- Breakpoints ---

export const breakpoints = {
  mobileS: 320,
  mobileL: 375,
  tablet: 600,
  desktop: 1024,
  wide: 1440,
} as const;

// --- Subscription Plans ---

export const planConfig = {
  ultra: {
    code: "ultra" as const,
    nameFa: "الترا",
    listPrice: 1_800_000,
    salePrice: 900_000,
    durationDays: 30,
    dailyRequestLimit: 5,
    totalTokenLimit: 1_150_000,
    features: [
      "۵ درخواست روزانه",
      "۱٬۱۵۰٬۰۰۰ توکن ماهانه",
      "دسترسی پایه به منابع حقوقی",
      "پشتیبانی پیامکی",
      "مدت ۳۰ روزه",
    ],
  },
  pro: {
    code: "pro" as const,
    nameFa: "پرو",
    listPrice: 4_500_000,
    salePrice: 2_000_000,
    durationDays: 30,
    dailyRequestLimit: 10,
    totalTokenLimit: 1_300_000,
    features: [
      "۱۰ درخواست روزانه",
      "۱٬۳۰۰٬۰۰۰ توکن ماهانه",
      "منابع حقوقی پیشرفته",
      "اولویت پردازش",
      "پشتیبانی تلفنی",
      "مدت ۳۰ روزه",
    ],
  },
  pro_max: {
    code: "pro_max" as const,
    nameFa: "پرو مکس",
    listPrice: 11_000_000,
    salePrice: 3_000_000,
    durationDays: 30,
    dailyRequestLimit: 20,
    totalTokenLimit: 1_600_000,
    features: [
      "۲۰ درخواست روزانه",
      "۱٬۶۰۰٬۰۰۰ توکن ماهانه",
      "تمام قابلیت‌های MVP",
      "دسترسی زودهنگام به ویژگی‌های جدید",
      "پشتیبانی اختصاصی",
      "مدت ۳۰ روزه",
    ],
  },
} as const;

// --- Design Token Constants ---

export const tokens = {
  splashDurationMs: 4000,
  touchTargetMin: 48,
  spacingUnit: 4,
  cornerSmall: 4,
  cornerMedium: 8,
  cornerLarge: 12,
  elevation1: 1,
  elevation4: 4,
  elevation8: 8,
} as const;
