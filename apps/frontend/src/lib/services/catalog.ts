// ============================================================
// LEGALIR — Services Catalog (single source of truth for /services)
// ============================================================
// The /services page is a *discovery* surface: it must present the
// complete product inventory, grouped by what the user wants to
// accomplish, plus the promotional banners that lead into it.
//
// Nothing on that page may hard-code a service title, description or
// href. Everything below is derived from the registries that already
// own the data:
//
//   • LEGAL_SERVICES        → the six AI service entry points
//   • LAW_SERVICE_EXAMPLES  → the 16 documented law-backed services
//   • listCalculators()     → the deterministic calculator catalog
//   • implementedContractDefinitions() → the contract types that ship
//
// Adding a calculator or a contract type therefore makes it appear on
// /services with no edit to this file or to the page.
// ============================================================

import type { ComponentType, SVGProps } from "react";
import { LEGAL_SERVICES, type LegalService } from "./registry";
import { LAW_SERVICE_EXAMPLES, type LawServiceExample } from "@/lib/law-catalog";
import { listCalculators } from "@/lib/calculators";
import { implementedContractDefinitions } from "@/lib/contracts/registry";
import { normalizePersian } from "@/lib/persian-utils";
import {
  IconCalculator,
  IconChat,
  IconContract,
  IconFilePen,
  IconFileSearch,
  IconFileText,
  IconFiles,
  IconGavel,
  IconHandshake,
  IconLawBook,
  IconLibrary,
  IconScale,
  IconShieldCheck,
  IconUsers,
} from "@/lib/icons";

/** The shape every `@/lib/icons` component satisfies. */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

// ============================================================
// Categories — grouped by user intent, not by implementation
// ============================================================

export type ServiceCategoryId =
  | "consultation"
  | "contracts"
  | "documents"
  | "calculators"
  | "cases"
  | "library";

export interface ServiceCategory {
  id: ServiceCategoryId;
  /** Persian section title. */
  title: string;
  /** One-line explanation shown under the title. */
  description: string;
  /** Anchor id used by the category shortcuts. */
  anchor: string;
  icon: IconComponent;
  /** Tailwind gradient for the shortcut chip icon. */
  gradient: string;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "consultation",
    title: "مشاوره و وکالت",
    description: "پرسش حقوقی، تحلیل مسئله و مشاوره با وکیل انسانی",
    anchor: "cat-consultation",
    icon: IconChat,
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    id: "contracts",
    title: "قراردادها و تنظیم اسناد",
    description: "پیش‌نویس هوشمند قرارداد و نامه‌نگاری حقوقی",
    anchor: "cat-contracts",
    icon: IconFilePen,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    id: "documents",
    title: "بررسی و تحلیل اسناد",
    description: "تحلیل ریسک، خلاصه‌سازی و استخراج تعهدات",
    anchor: "cat-documents",
    icon: IconFileSearch,
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    id: "calculators",
    title: "محاسبه‌گرهای حقوقی",
    description: "دیه، مهریه، هزینه دادرسی و محاسبات کار و استخدام",
    anchor: "cat-calculators",
    icon: IconCalculator,
    gradient: "from-amber-600 to-yellow-500",
  },
  {
    id: "cases",
    title: "پرونده‌ها و پیگیری",
    description: "ثبت پرونده، تایم‌لاین و تحلیل وضعیت پرونده",
    anchor: "cat-cases",
    icon: IconGavel,
    gradient: "from-violet-500 to-purple-500",
  },
  {
    id: "library",
    title: "منابع و آموزش حقوقی",
    description: "قوانین، راهنماها و مقالات آموزشی لیگالیر",
    anchor: "cat-library",
    icon: IconLibrary,
    gradient: "from-secondary-600 to-secondary-800",
  },
];

export function getCategory(id: ServiceCategoryId): ServiceCategory {
  const found = SERVICE_CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown service category: ${id}`);
  return found;
}

// ============================================================
// Catalog items
// ============================================================

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  /** Verified destination. */
  href: string;
  category: ServiceCategoryId;
  icon: IconComponent;
  /** Tailwind gradient for the card's icon chip + accent bar. */
  gradient: string;
  /** Short duration label, when the source registry provides one. */
  duration?: string;
  /** Output kind badge («متن» / «گزارش» / «سند PDF»). */
  outputType?: string;
  /** Law source ids documenting this service (rendered as chips). */
  lawRefs?: string[];
  /** Search-only keywords (aliases, Latin terms) — never rendered. */
  keywords?: string[];
}

// ------------------------------------------------------------
// 1) The six AI service entry points (LEGAL_SERVICES)
// ------------------------------------------------------------

const SERVICE_ICON: Record<string, IconComponent> = {
  legal_consultation: IconChat,
  contract_review: IconFileSearch,
  contract_drafting: IconFilePen,
  legal_notice: IconFileText,
  document_analysis: IconFiles,
  legal_calculation: IconCalculator,
};

const SERVICE_CATEGORY: Record<string, ServiceCategoryId> = {
  legal_consultation: "consultation",
  contract_review: "documents",
  contract_drafting: "contracts",
  legal_notice: "contracts",
  document_analysis: "documents",
  legal_calculation: "calculators",
};

const SERVICE_KEYWORDS: Record<string, string[]> = {
  legal_consultation: ["مشاوره", "سوال", "پرسش", "چت", "هوش مصنوعی", "ai"],
  contract_review: ["بررسی قرارداد", "ریسک", "شروط", "تحلیل قرارداد"],
  contract_drafting: ["تنظیم قرارداد", "پیش‌نویس", "قرارداد", "nda"],
  legal_notice: ["اظهارنامه", "نامه", "اخطار", "مطالبه"],
  document_analysis: ["تحلیل سند", "بررسی سند", "مستندات", "خلاصه"],
  legal_calculation: ["محاسبه", "دیه", "مهریه", "خسارت", "هزینه دادرسی"],
};

const AI_SERVICE_ITEMS: CatalogItem[] = LEGAL_SERVICES.map((s: LegalService) => ({
  id: `svc-${s.id}`,
  title: s.title,
  description: s.description,
  href: s.href,
  category: SERVICE_CATEGORY[s.id] ?? "consultation",
  icon: SERVICE_ICON[s.id] ?? IconChat,
  gradient: s.gradient,
  keywords: SERVICE_KEYWORDS[s.id],
}));

// ------------------------------------------------------------
// 2) Documented law-backed services (LAW_SERVICE_EXAMPLES)
// ------------------------------------------------------------

const LAW_CATEGORY_STYLE: Record<
  LawServiceExample["category"],
  { gradient: string; icon: IconComponent }
> = {
  consultation: { gradient: "from-blue-500 to-indigo-500", icon: IconScale },
  contracts: { gradient: "from-emerald-500 to-teal-500", icon: IconFilePen },
  documents: { gradient: "from-stone-500 to-neutral-500", icon: IconFileText },
  cases: { gradient: "from-violet-500 to-purple-500", icon: IconGavel },
  calculations: { gradient: "from-amber-600 to-yellow-500", icon: IconCalculator },
};

const LAW_ITEMS: CatalogItem[] = LAW_SERVICE_EXAMPLES.map((s) => {
  const style = LAW_CATEGORY_STYLE[s.category];
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    href: s.href,
    category: s.category === "calculations" ? "calculators" : s.category,
    icon: style.icon,
    gradient: style.gradient,
    duration: s.duration,
    outputType: s.outputType,
    lawRefs: s.lawRefs,
  };
});

// ------------------------------------------------------------
// 3) Calculators (listCalculators) — one card per real calculator
// ------------------------------------------------------------

const CALCULATOR_ITEMS: CatalogItem[] = listCalculators().map(({ def }) => ({
  id: `calc-${def.slug}`,
  title: def.titleFa,
  description: def.subtitleFa,
  href: `/calculators/${def.slug}`,
  category: "calculators",
  icon: IconCalculator,
  gradient: def.gradient,
  outputType: "متن",
  keywords: [def.legalBasisFa, def.category],
}));

// ------------------------------------------------------------
// 4) Contract types (implementedContractDefinitions)
// ------------------------------------------------------------

const CONTRACT_ICON: Record<string, IconComponent> = {
  property_rent: IconContract,
  property_sale: IconContract,
  vehicle_sale: IconContract,
  debt: IconScale,
  freelance: IconUsers,
  nda: IconShieldCheck,
  saas: IconFiles,
  startup: IconUsers,
};

const CONTRACT_ITEMS: CatalogItem[] = implementedContractDefinitions().map((def) => ({
  id: `ctr-${def.id}`,
  title: def.typeFa,
  description: def.descriptionFa,
  href: `/contracts/new?type=${def.id}`,
  category: "contracts",
  icon: CONTRACT_ICON[def.id] ?? IconContract,
  gradient: def.gradient,
  outputType: "سند PDF",
  keywords: [def.categoryFa, def.id],
}));

// ------------------------------------------------------------
// 5) Library / educational content
// ------------------------------------------------------------
// The library and blog are *content*, not services, and their
// inventory lives in server-side fixtures (`@legalir/testing`) plus
// the inline source map in `legal-library/[slug]/page.tsx` — neither
// of which is importable from this client module. Rather than invent
// a parallel inventory, this lists only the destinations that are
// verified to resolve in the running app: the library index, the four
// published source pages, the blog index and its rich article. Every
// href below was checked against the routes that render them.

export const LIBRARY_ITEMS: CatalogItem[] = [
  {
    id: "lib-index",
    title: "کتابخانه حقوقی",
    description: "قوانین، آرای وحدت رویه، راهنماها و چک‌لیست‌های حقوقی",
    href: "/legal-library",
    category: "library",
    icon: IconLibrary,
    gradient: "from-secondary-600 to-secondary-800",
    outputType: "متن",
    keywords: ["کتابخانه", "منابع", "قانون", "راهنما", "چک‌لیست"],
  },
  {
    id: "lib-civil-230",
    title: "ماده ۲۳۰ قانون مدنی",
    description: "شرط وجه‌الالتزام در قراردادها و نحوه مطالبه آن",
    href: "/legal-library/article-230-civil-code",
    category: "library",
    icon: IconLawBook,
    gradient: "from-secondary-600 to-secondary-800",
    outputType: "متن",
    keywords: ["ماده ۲۳۰", "وجه التزام", "قانون مدنی", "خسارت"],
  },
  {
    id: "lib-procedure-522",
    title: "ماده ۵۲۲ آیین دادرسی مدنی",
    description: "نحوه محاسبه خسارت تأخیر تأدیه در دعاوی مالی",
    href: "/legal-library/article-522-procedure",
    category: "library",
    icon: IconLawBook,
    gradient: "from-secondary-600 to-secondary-800",
    outputType: "متن",
    keywords: ["ماده ۵۲۲", "تاخیر تادیه", "خسارت", "آیین دادرسی"],
  },
  {
    id: "lib-unity-805",
    title: "رأی وحدت رویه ۸۰۵",
    description: "وجه‌الالتزام در تعهدات پولی طبق رأی هیأت عمومی دیوان عالی کشور",
    href: "/legal-library/unity-decision-805",
    category: "library",
    icon: IconGavel,
    gradient: "from-secondary-600 to-secondary-800",
    outputType: "متن",
    keywords: ["رأی وحدت رویه", "۸۰۵", "دیوان عالی", "رویه قضایی"],
  },
  {
    id: "lib-landlord-tenant",
    title: "راهنمای مالک و مستأجر",
    description: "حقوق و تعهدات موجر و مستأجر در قرارداد اجاره",
    href: "/legal-library/landlord-tenant-guide",
    category: "library",
    icon: IconFileText,
    gradient: "from-secondary-600 to-secondary-800",
    outputType: "متن",
    keywords: ["اجاره", "مستاجر", "موجر", "تخلیه", "مالک"],
  },
  {
    id: "lib-blog",
    title: "مقالات حقوقی",
    description: "تحلیل‌ها و راهنماهای تحریریه لیگالیر",
    href: "/blog",
    category: "library",
    icon: IconLibrary,
    gradient: "from-secondary-600 to-secondary-800",
    outputType: "متن",
    keywords: ["مقاله", "بلاگ", "تحلیل", "آموزش"],
  },
  {
    id: "lib-blog-penalty",
    title: "وجه‌الالتزام در قراردادها",
    description: "از ماده ۲۳۰ قانون مدنی تا رأی وحدت رویه ۸۰۵",
    href: "/blog/contract-penalty-clause",
    category: "library",
    icon: IconFileText,
    gradient: "from-secondary-600 to-secondary-800",
    outputType: "متن",
    keywords: ["وجه التزام", "قرارداد", "مقاله", "ماده ۲۳۰"],
  },
];

// ============================================================
// The complete catalog
// ============================================================

export const SERVICE_CATALOG: CatalogItem[] = [
  ...AI_SERVICE_ITEMS,
  ...LAW_ITEMS,
  ...CONTRACT_ITEMS,
  ...CALCULATOR_ITEMS,
  ...LIBRARY_ITEMS,
];

/** Catalog items for one category, in registry order. */
export function itemsByCategory(category: ServiceCategoryId): CatalogItem[] {
  return SERVICE_CATALOG.filter((item) => item.category === category);
}

/** Categories that actually have at least one item. */
export function populatedCategories(): ServiceCategory[] {
  return SERVICE_CATEGORIES.filter((c) => itemsByCategory(c.id).length > 0);
}

// ============================================================
// Search
// ============================================================

/**
 * Search the catalog across title, description and keywords, with
 * Persian orthographic normalization so Arabic yeh/kaf input still
 * matches, and `NDA` matches `nda`.
 */
export function searchCatalog(query: string): CatalogItem[] {
  const q = normalizePersian(query);
  if (!q) return SERVICE_CATALOG;

  const terms = q.split(" ").filter(Boolean);

  return SERVICE_CATALOG.filter((item) => {
    const haystack = normalizePersian(
      [item.title, item.description, ...(item.keywords ?? [])].join(" ")
    );
    return terms.every((term) => haystack.includes(term));
  });
}

// ============================================================
// Banners — the six service promotions (exact destinations)
// ============================================================

export type BannerTone = "primary" | "secondary" | "compact";

export interface ServiceBannerDef {
  id: string;
  /** Persian headline. */
  title: string;
  /** Short benefit statement. */
  message: string;
  /** Explicit action label. */
  cta: string;
  /** Verified destination. */
  href: string;
  icon: IconComponent;
  /** Tailwind gradient for the banner artwork. */
  gradient: string;
  /** Raw brand accent used by the code-native illustration. */
  accent: string;
  /** Visual weight on the page. */
  tone: BannerTone;
  /** Search keywords so banners surface in results too. */
  keywords: string[];
}

/**
 * The six service banners, in the order the brief specifies. Every
 * `href` is verified against the running app:
 *   /calculators, /documents?service=…, /chat?service=…, /contracts?service=…
 */
export const SERVICE_BANNERS: ServiceBannerDef[] = [
  {
    id: "banner-calculators",
    title: "محاسبه‌گر حقوقی",
    message: "دیه، مهریه و هزینه‌های حقوقی را دقیق و مستند محاسبه کنید",
    cta: "ورود به محاسبه‌گرها",
    href: "/calculators",
    icon: IconCalculator,
    gradient: "from-amber-600 to-yellow-500",
    accent: "#D89A13",
    tone: "secondary",
    keywords: ["محاسبه", "دیه", "مهریه", "هزینه دادرسی", "خسارت"],
  },
  {
    id: "banner-document-analysis",
    title: "تحلیل اسناد",
    message: "بررسی و تحلیل مستندات حقوقی همراه با ارجاع به مواد قانونی",
    cta: "تحلیل سند",
    href: "/documents?service=document_analysis",
    icon: IconFiles,
    gradient: "from-cyan-500 to-blue-500",
    accent: "#2F5FD0",
    tone: "secondary",
    keywords: ["تحلیل", "سند", "مستندات", "بررسی سند"],
  },
  {
    id: "banner-legal-notice",
    title: "تولید اظهارنامه",
    message: "نامه‌نگاری حقوقی حرفه‌ای با ذکر مستندات قانونی",
    cta: "تنظیم اظهارنامه",
    href: "/chat?service=legal_notice",
    icon: IconFileText,
    gradient: "from-orange-500 to-amber-500",
    accent: "#D89A13",
    tone: "secondary",
    keywords: ["اظهارنامه", "نامه", "اخطار", "مطالبه"],
  },
  {
    id: "banner-contract-drafting",
    title: "تنظیم قرارداد",
    message: "پیش‌نویس هوشمند قراردادها بر اساس شرایط شما",
    cta: "شروع تنظیم قرارداد",
    href: "/contracts?service=contract_drafting",
    icon: IconFilePen,
    gradient: "from-emerald-500 to-teal-500",
    accent: "#32B183",
    tone: "secondary",
    keywords: ["قرارداد", "تنظیم", "پیش‌نویس", "nda"],
  },
  {
    id: "banner-contract-review",
    title: "بررسی قرارداد",
    message: "تحلیل ریسک و شرایط قرارداد پیش از امضا",
    cta: "بررسی قرارداد",
    href: "/documents?service=contract_review",
    icon: IconFileSearch,
    gradient: "from-rose-500 to-pink-500",
    accent: "#B6251E",
    tone: "secondary",
    keywords: ["بررسی قرارداد", "ریسک", "شروط", "امضا"],
  },
  {
    id: "banner-legal-consultation",
    title: "مشاوره حقوقی",
    message: "سؤال خود را بپرسید و پاسخ مستند دریافت کنید",
    cta: "شروع گفت‌وگو",
    href: "/chat?service=legal_consultation",
    icon: IconChat,
    gradient: "from-blue-500 to-indigo-500",
    accent: "#6844C7",
    tone: "secondary",
    keywords: ["مشاوره", "پرسش", "سوال", "چت"],
  },
];

// ============================================================
// Campaign banners — marketing treatments (distinct from service banners)
// ============================================================

export interface CampaignBannerDef {
  id: string;
  /** Small eyebrow label above the headline. */
  eyebrow: string;
  title: string;
  message: string;
  cta: string;
  href: string;
  icon: IconComponent;
  /** Which code-native illustration to render. */
  art: "lawyer" | "contract" | "nda" | "library";
  /** Tailwind gradient for the banner surface. */
  gradient: string;
  /** Raw brand accent for the illustration. */
  accent: string;
  /** Explicitly names the experience the CTA opens. */
  experience: string;
  keywords: string[];
}

/**
 * The primary campaign: consultation with a **human lawyer**. The copy
 * and the CTA name the experience explicitly so it can never be confused
 * with the AI «مشاوره حقوقی» service banner above it.
 */
export const PRIMARY_CAMPAIGN: CampaignBannerDef = {
  id: "campaign-lawyer",
  eyebrow: "وکیل انسانی",
  title: "پرونده‌تان را به یک وکیل بسپارید",
  message:
    "اگر موضوع شما به بررسی تخصصی و پیگیری انسانی نیاز دارد، از میان وکلای تأییدشده لیگالیر وکیل مناسب را انتخاب کنید.",
  cta: "مشاهده وکلای تأییدشده",
  href: "/lawyers",
  icon: IconHandshake,
  art: "lawyer",
  gradient: "from-primary-700 via-primary-800 to-primary-900",
  accent: "#D89A13",
  experience: "مشاوره با وکیل انسانی",
  keywords: ["وکیل", "وکالت", "مشاوره انسانی", "پیگیری پرونده"],
};

/** Secondary campaign, placed between catalog sections. */
export const SECONDARY_CAMPAIGN: CampaignBannerDef = {
  id: "campaign-contract",
  eyebrow: "قرارداد حرفه‌ای",
  title: "قبل از امضا، قرارداد را بسپارید به لیگالیر",
  message:
    "پیش‌نویس قرارداد را در چند دقیقه بسازید یا قرارداد موجود را برای شناسایی بندهای پرریسک بررسی کنید.",
  cta: "شروع تنظیم قرارداد",
  href: "/contracts?service=contract_drafting",
  icon: IconFilePen,
  art: "contract",
  gradient: "from-emerald-600 via-emerald-700 to-teal-800",
  accent: "#32B183",
  experience: "تنظیم و بررسی قرارداد",
  keywords: ["قرارداد", "امضا", "ریسک", "پیش‌نویس"],
};

/** Compact campaign near the new-services area — NDA is operational. */
export const NDA_CAMPAIGN: CampaignBannerDef = {
  id: "campaign-nda",
  eyebrow: "خدمت جدید",
  title: "توافقنامه محرمانگی (NDA)",
  message: "پیش از تبادل اطلاعات محرمانه، تعهد محرمانگی یک‌طرفه یا دوجانبه تنظیم کنید.",
  cta: "تنظیم NDA",
  href: "/contracts/new?type=nda",
  icon: IconShieldCheck,
  art: "nda",
  gradient: "from-primary-600 via-primary-700 to-primary-800",
  accent: "#32B183",
  experience: "تنظیم توافقنامه محرمانگی",
  keywords: ["nda", "محرمانگی", "اطلاعات محرمانه", "توافقنامه"],
};

/** Library / blog treatment — educational, explicitly not legal advice. */
export const LIBRARY_CAMPAIGN: CampaignBannerDef = {
  id: "campaign-library",
  eyebrow: "آموزش حقوقی",
  title: "منابع و مقالات حقوقی لیگالیر",
  message:
    "قوانین، راهنماهای کاربردی و مقالات تحلیلی را مطالعه کنید. این محتوا آموزشی است و جایگزین مشاوره حقوقی نیست.",
  cta: "مشاهده منابع حقوقی",
  href: "/legal-library",
  icon: IconLibrary,
  art: "library",
  gradient: "from-secondary-600 via-secondary-700 to-secondary-800",
  accent: "#D89A13",
  experience: "مطالعه منابع آموزشی",
  keywords: ["منابع", "آموزش", "مقاله", "قانون", "کتابخانه"],
};

// ============================================================
// New services — genuinely available, with honest status
// ============================================================

export interface NewServiceDef {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: IconComponent;
  gradient: string;
  /** `available` renders a working CTA; `soon` renders a status badge. */
  status: "available" | "soon";
  /** Shown instead of the CTA when `status === "soon"`. */
  statusLabel?: string;
}

/**
 * Three genuinely new capabilities. NDA drafting is fully implemented
 * (see `implementedContractDefinitions`), so it gets a working CTA.
 * The other two are real, shipped features that are new to this page.
 */
export const NEW_SERVICES: NewServiceDef[] = [
  {
    id: "new-nda",
    title: "توافقنامه محرمانگی (NDA)",
    description: "تنظیم توافقنامه عدم افشای اطلاعات محرمانه، یک‌طرفه یا دوجانبه.",
    href: "/contracts/new?type=nda",
    icon: IconShieldCheck,
    gradient: "from-primary-600 to-primary-800",
    status: "available",
  },
  {
    id: "new-inheritance",
    title: "محاسبه سهم‌الارث",
    description: "تقسیم ماترک میان وراث بر پایه سهم‌های قانونی و سهم‌الارث.",
    href: "/calculators/inheritance",
    icon: IconCalculator,
    gradient: "from-amber-600 to-yellow-500",
    status: "available",
  },
  {
    id: "new-regional-property",
    title: "محاسبه ارزش منطقه‌ای ملک",
    description: "برآورد ارزش منطقه‌ای ملک بر اساس تعرفه‌های رسمی.",
    href: "/calculators/regional-property-value",
    icon: IconScale,
    gradient: "from-cyan-500 to-blue-500",
    status: "available",
  },
];

// ============================================================
// Analytics — privacy-safe banner measurement
// ============================================================

export type ServicesAnalyticsEvent =
  | "services_banner_impression"
  | "services_banner_click"
  | "services_category_selected"
  | "services_search_performed"
  | "services_search_cleared";

interface DataLayerWindow extends Window {
  dataLayer?: Record<string, unknown>[];
}

/**
 * Report a /services discovery event.
 *
 * There is no analytics vendor wired into the app yet, so — exactly like
 * `lib/contracts/analytics.ts` and `lib/auth/signup-analytics.ts` — this
 * pushes onto `window.dataLayer` when a tag manager is present and is
 * otherwise a no-op. Swapping in a real vendor means editing this file only.
 *
 * Only stable banner ids and destination names are ever sent. Search terms,
 * legal questions and document names are deliberately never included.
 */
export function trackServicesEvent(
  event: ServicesAnalyticsEvent,
  props: { bannerId?: string; destination?: string; categoryId?: string } = {}
): void {
  if (typeof window === "undefined") return;
  const w = window as DataLayerWindow;
  if (!Array.isArray(w.dataLayer)) return;
  w.dataLayer.push({ event, ...props });
}

// ============================================================
// Discovery helpers
// ============================================================

/** Total number of distinct services presented on the page. */
export const CATALOG_SIZE = SERVICE_CATALOG.length;
