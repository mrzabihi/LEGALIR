// ============================================================
// LEGALIR — Contract Service Catalog (single source of truth)
// ============================================================
// The /contracts surface is a *discovery catalog* for contract-drafting
// services. Every service is data-driven and lives here — the page and
// the detail route render nothing that is not described below.
//
// Each service declares its own status:
//
//   • "coming-soon" → detail page + related lawyers + honest activation CTA
//   • "active"      → the same detail page, plus a CTA into the real
//                     contract wizard (added when a service ships)
//
// In this phase every service is `coming-soon`: no contract is produced,
// no wizard runs and no text is generated. Activating a service later is a
// one-line status change here — no page edit.
//
// Fields mirror the product brief exactly: id, slug, title, shortDescription,
// description, category, icon, keywords, status, features,
// recommendedLawyerSpecialties, seoTitle, metaDescription.
// ============================================================

import type { ComponentType, SVGProps } from "react";
import { normalizePersian } from "@/lib/persian-utils";
import {
  IconArchive,
  IconBalance,
  IconBriefcase,
  IconBusiness,
  IconCalendar,
  IconCar,
  IconCloud,
  IconCode,
  IconCoin,
  IconContract,
  IconDatabase,
  IconDocument,
  IconFilePen,
  IconFileText,
  IconFiles,
  IconGavel,
  IconHandshake,
  IconHome,
  IconLocation,
  IconPerson,
  IconRefresh,
  IconScale,
  IconStar,
  IconTrademark,
  IconUsers,
} from "@/lib/icons";

/** The shape every `@/lib/icons` component satisfies. */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

// ============================================================
// Status
// ============================================================

export type ContractServiceStatus = "coming-soon" | "active";

export const CONTRACT_SERVICE_STATUS_FA: Record<ContractServiceStatus, string> = {
  "coming-soon": "به‌زودی",
  active: "فعال",
};

/** Long-form status label used on the detail page. */
export const CONTRACT_SERVICE_STATUS_LONG_FA: Record<ContractServiceStatus, string> = {
  "coming-soon": "به‌زودی فعال می‌شود",
  active: "فعال است",
};

/** A lawyer specialization code — a key of `LEGAL_CATEGORY_FA`. */
export type LawyerSpecialtyCode =
  | "family"
  | "contract"
  | "real_estate"
  | "labor"
  | "commerce"
  | "criminal"
  | "tax"
  | "companies"
  | "checks"
  | "immigration"
  | "cyber"
  | "other";

// ============================================================
// Categories — grouped by the user's subject matter
// ============================================================

export type ContractCategoryId =
  | "employment"
  | "real-estate"
  | "contracting"
  | "technology"
  | "finance"
  | "business"
  | "vehicle"
  | "corporate"
  | "family";

export interface ContractCategory {
  id: ContractCategoryId;
  /** Persian section title. */
  title: string;
  /** One-line explanation shown in the filter and the section header. */
  description: string;
  /** Anchor id for in-page navigation. */
  anchor: string;
  icon: IconComponent;
  /** Tailwind gradient used by the category chip and the card icon. */
  gradient: string;
}

export const CONTRACT_CATEGORIES: ContractCategory[] = [
  {
    id: "employment",
    title: "کار و استخدام",
    description: "استخدام، کارآموزی و دورکاری",
    anchor: "cat-employment",
    icon: IconBriefcase,
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    id: "real-estate",
    title: "املاک و مستغلات",
    description: "اجاره تجاری، پیش‌فروش، مشارکت در ساخت و سرقفلی",
    anchor: "cat-real-estate",
    icon: IconBusiness,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    id: "contracting",
    title: "پیمانکاری و پروژه",
    description: "پیمانکاری، پیمانکار تک‌نفره و قرارداد خدمات",
    anchor: "cat-contracting",
    icon: IconGavel,
    gradient: "from-amber-600 to-yellow-500",
  },
  {
    id: "technology",
    title: "فناوری و نرم‌افزار",
    description: "توسعه نرم‌افزار، طراحی سایت، پشتیبانی و لایسنس",
    anchor: "cat-technology",
    icon: IconCode,
    gradient: "from-cyan-500 to-sky-600",
  },
  {
    id: "finance",
    title: "مالی و تعهدات",
    description: "اقرارنامه بدهی، تقسیط و سرمایه‌گذاری",
    anchor: "cat-finance",
    icon: IconCoin,
    gradient: "from-rose-500 to-pink-500",
  },
  {
    id: "business",
    title: "شراکت و کسب‌وکار",
    description: "شراکت تجاری، نمایندگی، بازاریابی، توزیع و تأمین",
    anchor: "cat-business",
    icon: IconHandshake,
    gradient: "from-violet-500 to-purple-500",
  },
  {
    id: "vehicle",
    title: "خودرو",
    description: "خرید و فروش اقساطی خودرو",
    anchor: "cat-vehicle",
    icon: IconCar,
    gradient: "from-orange-500 to-amber-500",
  },
  {
    id: "corporate",
    title: "شرکت و سهام",
    description: "توافق سهامداران و خروج شریک",
    anchor: "cat-corporate",
    icon: IconBalance,
    gradient: "from-secondary-600 to-secondary-800",
  },
  {
    id: "family",
    title: "خانواده و ارث",
    description: "توافق‌های خانواده و تقسیم ارث",
    anchor: "cat-family",
    icon: IconUsers,
    gradient: "from-indigo-500 to-violet-600",
  },
];

export function getContractCategory(id: ContractCategoryId): ContractCategory {
  const found = CONTRACT_CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown contract category: ${id}`);
  return found;
}

// ============================================================
// Service
// ============================================================

export interface ContractService {
  id: string;
  /** URL-safe, Latin, stable — used by /contracts/service/[slug]. */
  slug: string;
  title: string;
  /** One-line summary shown on the card and in search results. */
  shortDescription: string;
  /** Full description shown on the detail page. */
  description: string;
  category: ContractCategoryId;
  icon: IconComponent;
  /** Search-only terms (aliases, sub-types). Never rendered verbatim. */
  keywords: string[];
  status: ContractServiceStatus;
  /** Future capabilities introduced on the detail page (no form). */
  features: string[];
  /** Lawyer specializations this service most relates to (primary first). */
  recommendedLawyerSpecialties: LawyerSpecialtyCode[];
  seoTitle: string;
  metaDescription: string;
  /** Optional short note rendered as a chip on the card. */
  note?: string;
}

// ============================================================
// The 28 services
// ============================================================

export const CONTRACT_SERVICES: ContractService[] = [
  // ----------------------------------------------------------
  // کار و استخدام
  // ----------------------------------------------------------
  {
    id: "employment-contract",
    slug: "employment-contract",
    title: "قرارداد استخدام",
    shortDescription: "قرارداد همکاری میان کارفرما و نیروی کار",
    description:
      "تنظیم قرارداد همکاری میان کارفرما و نیروی کار با مشخص کردن سمت، حقوق، مزایا، مدت همکاری و تعهدات طرفین.",
    category: "employment",
    icon: IconBriefcase,
    keywords: ["استخدام", "کارمند", "کارفرما", "قرارداد کار", "نیروی انسانی", "حقوق", "مزایا"],
    status: "coming-soon",
    features: [
      "مشخصات طرفین (کارفرما و کارمند)",
      "عنوان شغلی، شرح وظایف و محل کار",
      "حقوق، مزایا و نحوه پرداخت",
      "مدت همکاری، ساعات کار و تعطیلات",
      "تعهدات طرفین و شرایط فسخ یا خاتمه همکاری",
    ],
    recommendedLawyerSpecialties: ["labor", "contract"],
    seoTitle: "قرارداد استخدام | تنظیم قرارداد استخدام",
    metaDescription:
      "خدمت تنظیم قرارداد استخدام در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه جزئیات و قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "internship-contract",
    slug: "internship-contract",
    title: "قرارداد کارآموزی",
    shortDescription: "توافق همکاری کارآموز و مجموعه در یک دوره مشخص",
    description:
      "تنظیم توافق همکاری کارآموز و مجموعه برای تعیین دوره، شرح فعالیت، آموزش، تعهدات و شرایط همکاری.",
    category: "employment",
    icon: IconUsers,
    keywords: ["کارآموزی", "کارآموز", "دوره آموزشی", "اینترن", "آموزش"],
    status: "coming-soon",
    features: [
      "مشخصات کارآموز و مجموعه میزبان",
      "مدت و بازه زمانی دوره کارآموزی",
      "شرح فعالیت و برنامه آموزشی",
      "حق‌الزحمه یا شرایط بدون دستمزد",
      "تعهدات، محرمانگی و شرایط پایان دوره",
    ],
    recommendedLawyerSpecialties: ["labor"],
    seoTitle: "قرارداد کارآموزی | تنظیم توافق کارآموزی",
    metaDescription:
      "خدمت تنظیم قرارداد کارآموزی در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "remote-work-contract",
    slug: "remote-work-contract",
    title: "قرارداد دورکاری",
    shortDescription: "قرارداد همکاری دورکاری با تعیین ساعات و مسئولیت‌ها",
    description:
      "تنظیم قرارداد همکاری دورکاری با تعیین ساعات، نحوه ارتباط، مسئولیت‌ها، تجهیزات و شرایط انجام کار.",
    category: "employment",
    icon: IconHome,
    keywords: ["دورکاری", "کار از راه دور", "ریموت", "ساعات کاری", "تجهیزات"],
    status: "coming-soon",
    features: [
      "مشخصات کارفرما و فرد دورکار",
      "ساعات کاری و انعطاف‌پذیری زمانی",
      "نحوه ارتباط و گزارش‌دهی",
      "تجهیزات و هزینه‌های کار از راه دور",
      "تعهدات، محرمانگی و شرایط خاتمه",
    ],
    recommendedLawyerSpecialties: ["labor", "contract"],
    seoTitle: "قرارداد دورکاری | تنظیم قرارداد کار از راه دور",
    metaDescription:
      "خدمت تنظیم قرارداد دورکاری در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه جزئیات و قابلیت‌های آینده این خدمت معرفی شده است.",
  },

  // ----------------------------------------------------------
  // املاک و مستغلات
  // ----------------------------------------------------------
  {
    id: "commercial-lease-contract",
    slug: "commercial-lease-contract",
    title: "قرارداد اجاره ملک تجاری",
    shortDescription: "اجاره مغازه، دفتر یا واحد تجاری",
    description: "تنظیم قرارداد اجاره مغازه، دفتر، واحد تجاری و سایر املاک با کاربری تجاری.",
    category: "real-estate",
    icon: IconBusiness,
    keywords: ["اجاره مغازه", "اجاره دفتر", "ملک تجاری", "سرقفلی", "مستاجر", "موجر", "تجاری"],
    status: "coming-soon",
    features: [
      "مشخصات موجر و مستأجر",
      "نشانی و مشخصات ملک تجاری",
      "مبلغ اجاره، ودیعه و نحوه پرداخت",
      "مدت اجاره و شرایط تمدید",
      "تعهدات طرفین و شرایط تخلیه",
    ],
    recommendedLawyerSpecialties: ["real_estate", "commerce"],
    seoTitle: "قرارداد اجاره ملک تجاری | تنظیم قرارداد اجاره مغازه و دفتر",
    metaDescription:
      "خدمت تنظیم قرارداد اجاره ملک تجاری در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "construction-partnership-contract",
    slug: "construction-partnership-contract",
    title: "قرارداد مشارکت در ساخت",
    shortDescription: "توافق مالک و سازنده برای ساخت‌وساز و تقسیم واحدها",
    description:
      "تنظیم قرارداد میان مالک و سازنده برای ساخت‌وساز، تعیین سهم طرفین، تعهدات، زمان‌بندی و نحوه تقسیم واحدها.",
    category: "real-estate",
    icon: IconHandshake,
    keywords: ["مشارکت در ساخت", "سازنده", "مالک", "تقسیم واحد", "پروژه ساختمانی"],
    status: "coming-soon",
    features: [
      "مشخصات مالک و سازنده",
      "مشخصات ملک و مجوزهای ساخت",
      "سهم هر یک از طرفین از واحدها",
      "زمان‌بندی مراحل ساخت",
      "تعهدات، تضامین و شرایط فسخ",
    ],
    recommendedLawyerSpecialties: ["real_estate", "contract"],
    seoTitle: "قرارداد مشارکت در ساخت | تنظیم توافق مالک و سازنده",
    metaDescription:
      "خدمت تنظیم قرارداد مشارکت در ساخت در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "pre-sale-contract",
    slug: "pre-sale-contract",
    title: "قرارداد پیش‌فروش",
    shortDescription: "پیش‌فروش ساختمان و واحدهای در حال احداث",
    description:
      "تنظیم قرارداد پیش‌فروش ساختمان و واحدهای در حال احداث با تعیین مشخصات ملک، تعهدات، زمان تحویل و شرایط پرداخت.",
    category: "real-estate",
    icon: IconDocument,
    keywords: ["پیش‌فروش", "پیش فروش", "واحد در حال ساخت", "تحویل", "اقساط"],
    status: "coming-soon",
    features: [
      "مشخصات فروشنده و خریدار",
      "مشخصات فنی و مکانی واحد",
      "زمان تحویل و تعهدات اجرایی",
      "شرایط و مراحل پرداخت",
      "تضامین و شرایط فسخ",
    ],
    recommendedLawyerSpecialties: ["real_estate"],
    seoTitle: "قرارداد پیش‌فروش | تنظیم قرارداد پیش‌فروش ساختمان",
    metaDescription:
      "خدمت تنظیم قرارداد پیش‌فروش در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "goodwill-contract",
    slug: "goodwill-contract",
    title: "قرارداد سرقفلی",
    shortDescription: "قراردادهای مرتبط با سرقفلی و حقوق بهره‌برداری از ملک تجاری",
    description: "تنظیم قراردادهای مرتبط با سرقفلی و حقوق مربوط به بهره‌برداری از ملک تجاری.",
    category: "real-estate",
    icon: IconContract,
    keywords: ["سرقفلی", "حق کسب و پیشه", "ملک تجاری", "واگذاری"],
    status: "coming-soon",
    features: [
      "مشخصات طرفین و ملک تجاری",
      "میزان و شرایط سرقفلی",
      "نحوه واگذاری یا انتقال حق",
      "تعهدات طرفین",
      "شرایط فسخ و حل اختلاف",
    ],
    recommendedLawyerSpecialties: ["real_estate", "commerce"],
    seoTitle: "قرارداد سرقفلی | تنظیم قرارداد سرقفلی ملک تجاری",
    metaDescription:
      "خدمت تنظیم قرارداد سرقفلی در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },

  // ----------------------------------------------------------
  // پیمانکاری و پروژه
  // ----------------------------------------------------------
  {
    id: "contracting-agreement",
    slug: "contracting-agreement",
    title: "قرارداد پیمانکاری",
    shortDescription: "انجام پروژه و خدمات پیمانکاری با تعیین مبلغ و زمان‌بندی",
    description:
      "تنظیم قرارداد انجام پروژه و خدمات پیمانکاری با تعیین موضوع، مبلغ، زمان‌بندی، تعهدات و شرایط تحویل.",
    category: "contracting",
    icon: IconGavel,
    keywords: ["پیمانکاری", "پیمانکار", "پروژه", "خدمات اجرایی", "تحویل"],
    status: "coming-soon",
    features: [
      "مشخصات کارفرما و پیمانکار",
      "موضوع پیمان و شرح خدمات",
      "مبلغ قرارداد و نحوه پرداخت",
      "زمان‌بندی و مراحل تحویل",
      "تعهدات، تضامین و شرایط فسخ",
    ],
    recommendedLawyerSpecialties: ["contract", "commerce"],
    seoTitle: "قرارداد پیمانکاری | تنظیم قرارداد انجام پروژه",
    metaDescription:
      "خدمت تنظیم قرارداد پیمانکاری در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "sole-contractor-contract",
    slug: "sole-contractor-contract",
    title: "قرارداد پیمانکار تک‌نفره",
    shortDescription: "همکاری با پیمانکار حقیقی یا حقوقی برای یک پروژه",
    description:
      "تنظیم قرارداد همکاری با پیمانکار حقیقی یا حقوقی برای انجام پروژه یا ارائه خدمات مشخص.",
    category: "contracting",
    icon: IconPerson,
    keywords: ["پیمانکار تک‌نفره", "پیمانکار حقیقی", "پیمانکار حقوقی", "فریلنسر"],
    status: "coming-soon",
    note: "مناسب برای اشخاص حقیقی و شرکت‌ها",
    features: [
      "مشخصات کارفرما و پیمانکار",
      "شرح پروژه یا خدمات",
      "مبلغ و شرایط پرداخت",
      "زمان‌بندی و تحویل",
      "تعهدات و شرایط خاتمه",
    ],
    recommendedLawyerSpecialties: ["contract"],
    seoTitle: "قرارداد پیمانکار تک‌نفره | تنظیم قرارداد پروژه",
    metaDescription:
      "خدمت تنظیم قرارداد پیمانکار تک‌نفره در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "services-agreement",
    slug: "services-agreement",
    title: "قرارداد خدمات",
    shortDescription: "ارائه خدمات تخصصی یا عمومی با تعیین موضوع و مبلغ",
    description:
      "تنظیم قرارداد ارائه خدمات تخصصی یا عمومی با مشخص کردن موضوع، مدت، مبلغ، نحوه پرداخت و تعهدات طرفین.",
    category: "contracting",
    icon: IconFilePen,
    keywords: ["قرارداد خدمات", "ارائه خدمت", "خدمات تخصصی", "مبلغ", "پرداخت"],
    status: "coming-soon",
    features: [
      "مشخصات خدمت‌دهنده و خدمت‌گیرنده",
      "موضوع و محدوده خدمات",
      "مدت قرارداد و زمان‌بندی",
      "مبلغ و نحوه پرداخت",
      "تعهدات طرفین و شرایط فسخ",
    ],
    recommendedLawyerSpecialties: ["contract"],
    seoTitle: "قرارداد خدمات | تنظیم قرارداد ارائه خدمات",
    metaDescription:
      "خدمت تنظیم قرارداد خدمات در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },

  // ----------------------------------------------------------
  // فناوری و نرم‌افزار
  // ----------------------------------------------------------
  {
    id: "software-development-contract",
    slug: "software-development-contract",
    title: "قرارداد توسعه نرم‌افزار",
    shortDescription: "توسعه نرم‌افزار، اپلیکیشن یا سامانه",
    description:
      "تنظیم قرارداد توسعه نرم‌افزار، اپلیکیشن یا سامانه با تعیین محدوده پروژه، زمان‌بندی، مالکیت کد و تعهدات طرفین.",
    category: "technology",
    icon: IconCode,
    keywords: ["برنامه‌نویس", "نرم‌افزار", "اپلیکیشن", "توسعه", "کدنویسی", "سامانه", "مالکیت کد"],
    status: "coming-soon",
    features: [
      "مشخصات کارفرما و تیم توسعه",
      "محدوده پروژه و شرح فنی",
      "زمان‌بندی و مراحل تحویل",
      "مالکیت کد و حقوق مالکیت فکری",
      "تعهدات، پشتیبانی و شرایط فسخ",
    ],
    recommendedLawyerSpecialties: ["contract", "commerce"],
    seoTitle: "قرارداد توسعه نرم‌افزار | تنظیم قرارداد برنامه‌نویس",
    metaDescription:
      "خدمت تنظیم قرارداد توسعه نرم‌افزار در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "website-design-contract",
    slug: "website-design-contract",
    title: "قرارداد طراحی سایت",
    shortDescription: "طراحی و توسعه وب‌سایت با تعیین امکانات و زمان‌بندی",
    description:
      "تنظیم قرارداد طراحی و توسعه وب‌سایت با تعیین امکانات، زمان‌بندی، مبلغ، مالکیت و شرایط تحویل.",
    category: "technology",
    icon: IconCloud,
    keywords: ["سایت", "طراحی سایت", "وب‌سایت", "طراحی وب", "امکانات سایت"],
    status: "coming-soon",
    features: [
      "مشخصات کارفرما و طراح",
      "امکانات و صفحات موردنیاز",
      "زمان‌بندی طراحی و تحویل",
      "مبلغ و نحوه پرداخت",
      "مالکیت اثر و شرایط پشتیبانی",
    ],
    recommendedLawyerSpecialties: ["contract"],
    seoTitle: "قرارداد طراحی سایت | تنظیم قرارداد طراحی وب‌سایت",
    metaDescription:
      "خدمت تنظیم قرارداد طراحی سایت در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "software-support-contract",
    slug: "software-support-contract",
    title: "قرارداد پشتیبانی و نگهداری نرم‌افزار",
    shortDescription: "پشتیبانی فنی، رفع اشکال و به‌روزرسانی نرم‌افزار",
    description:
      "تنظیم قرارداد پشتیبانی فنی، رفع اشکال، نگهداری و به‌روزرسانی نرم‌افزار یا سامانه.",
    category: "technology",
    icon: IconRefresh,
    keywords: ["پشتیبانی", "نگهداری", "رفع اشکال", "به‌روزرسانی", "پشتیبانی فنی"],
    status: "coming-soon",
    features: [
      "مشخصات ارائه‌دهنده و دریافت‌کننده خدمات",
      "دامنه پشتیبانی و سطوح خدمات",
      "زمان پاسخ‌گویی و رفع اشکال",
      "به‌روزرسانی و نگهداری دوره‌ای",
      "مبلغ، مدت و شرایط تمدید",
    ],
    recommendedLawyerSpecialties: ["contract", "commerce"],
    seoTitle: "قرارداد پشتیبانی نرم‌افزار | تنظیم قرارداد نگهداری",
    metaDescription:
      "خدمت تنظیم قرارداد پشتیبانی و نگهداری نرم‌افزار در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "system-maintenance-contract",
    slug: "system-maintenance-contract",
    title: "قرارداد نگهداری سیستم",
    shortDescription: "نگهداری و مدیریت زیرساخت‌ها و سیستم‌های فناوری اطلاعات",
    description:
      "تنظیم قرارداد نگهداری، پشتیبانی و مدیریت زیرساخت‌ها و سیستم‌های فناوری اطلاعات.",
    category: "technology",
    icon: IconDatabase,
    keywords: ["نگهداری سیستم", "زیرساخت", "فناوری اطلاعات", "مدیریت سیستم", "سرور"],
    status: "coming-soon",
    features: [
      "مشخصات طرفین و دامنه سیستم‌ها",
      "سطح خدمات و زمان پاسخ‌گویی",
      "نگهداری پیشگیرانه و دوره‌ای",
      "مدیریت تغییرات و گزارش‌دهی",
      "مبلغ، مدت و شرایط خاتمه",
    ],
    recommendedLawyerSpecialties: ["contract"],
    seoTitle: "قرارداد نگهداری سیستم | تنظیم قرارداد پشتیبانی زیرساخت",
    metaDescription:
      "خدمت تنظیم قرارداد نگهداری سیستم در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "license-agreement",
    slug: "license-agreement",
    title: "قرارداد لایسنس",
    shortDescription: "اعطای مجوز استفاده از نرم‌افزار، محتوا یا فناوری",
    description:
      "تنظیم قرارداد اعطای مجوز استفاده از نرم‌افزار، محتوا، فناوری یا سایر حقوق قابل بهره‌برداری.",
    category: "technology",
    icon: IconTrademark,
    keywords: ["لایسنس", "مجوز", "لیسانس", "حق بهره‌برداری", "مالکیت فکری"],
    status: "coming-soon",
    features: [
      "مشخصات اعطاکننده و دریافت‌کننده مجوز",
      "موضوع و دامنه مجوز",
      "مدت و قلمرو بهره‌برداری",
      "حق امتیاز و نحوه پرداخت",
      "تعهدات، محدودیت‌ها و شرایط فسخ",
    ],
    recommendedLawyerSpecialties: ["commerce", "contract"],
    seoTitle: "قرارداد لایسنس | تنظیم قرارداد اعطای مجوز",
    metaDescription:
      "خدمت تنظیم قرارداد لایسنس در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },

  // ----------------------------------------------------------
  // مالی و تعهدات
  // ----------------------------------------------------------
  {
    id: "debt-acknowledgment",
    slug: "debt-acknowledgment",
    title: "اقرارنامه بدهی و تعهد به پرداخت",
    shortDescription: "ثبت تعهد بدهکار به پرداخت مبلغ مشخص",
    description:
      "ثبت و تنظیم تعهد بدهکار نسبت به مبلغ مشخص و تعیین شرایط و زمان‌بندی پرداخت بدهی.",
    category: "finance",
    icon: IconFileText,
    keywords: ["اقرارنامه", "بدهی", "تعهد پرداخت", "بدهکار", "طلبکار"],
    status: "coming-soon",
    features: [
      "مشخصات بدهکار و طلبکار",
      "مبلغ بدهی و منشأ آن",
      "زمان‌بندی و شرایط پرداخت",
      "تضامین و تعهدات بدهکار",
      "شرایط مطالبه و حل اختلاف",
    ],
    recommendedLawyerSpecialties: ["contract", "checks"],
    seoTitle: "اقرارنامه بدهی | تنظیم تعهد به پرداخت",
    metaDescription:
      "خدمت تنظیم اقرارنامه بدهی در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "debt-installment-contract",
    slug: "debt-installment-contract",
    title: "قرارداد تقسیط بدهی",
    shortDescription: "توافق پرداخت بدهی به‌صورت اقساطی",
    description:
      "تنظیم توافق پرداخت بدهی به صورت اقساطی با تعیین مبلغ اقساط، سررسیدها و تعهدات طرفین.",
    category: "finance",
    icon: IconCalendar,
    keywords: ["تقسیط", "اقساط", "بدهی", "سررسید", "پرداخت اقساطی"],
    status: "coming-soon",
    features: [
      "مشخصات بدهکار و طلبکار",
      "مبلغ بدهی و تعداد اقساط",
      "مبلغ هر قسط و سررسیدها",
      "تضامین و تعهدات طرفین",
      "شرایط نکول و حل اختلاف",
    ],
    recommendedLawyerSpecialties: ["contract", "checks"],
    seoTitle: "قرارداد تقسیط بدهی | تنظیم توافق پرداخت اقساطی",
    metaDescription:
      "خدمت تنظیم قرارداد تقسیط بدهی در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "investment-agreement",
    slug: "investment-agreement",
    title: "قرارداد سرمایه‌گذاری",
    shortDescription: "توافق سرمایه‌گذاری با تعیین سود یا سهم و شرایط خروج",
    description:
      "تنظیم توافق سرمایه‌گذاری برای تعیین مبلغ سرمایه، حقوق سرمایه‌گذار، تعهدات طرفین، سود یا سهم و شرایط خروج.",
    category: "finance",
    icon: IconCoin,
    keywords: ["سرمایه", "سرمایه‌گذاری", "سرمایه‌گذار", "سود", "سهم", "خروج"],
    status: "coming-soon",
    features: [
      "مشخصات سرمایه‌گذار و دریافت‌کننده",
      "مبلغ و زمان تأمین سرمایه",
      "سود یا سهم سرمایه‌گذار",
      "تعهدات و گزارش‌دهی طرفین",
      "شرایط خروج و بازگشت سرمایه",
    ],
    recommendedLawyerSpecialties: ["commerce", "companies"],
    seoTitle: "قرارداد سرمایه‌گذاری | تنظیم توافق سرمایه‌گذاری",
    metaDescription:
      "خدمت تنظیم قرارداد سرمایه‌گذاری در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },

  // ----------------------------------------------------------
  // شراکت و کسب‌وکار
  // ----------------------------------------------------------
  {
    id: "business-partnership-agreement",
    slug: "business-partnership-agreement",
    title: "قرارداد شراکت تجاری",
    shortDescription: "توافق شرکا برای راه‌اندازی یا اداره کسب‌وکار",
    description:
      "تنظیم توافق میان شرکا برای راه‌اندازی یا اداره کسب‌وکار و تعیین سهم، سرمایه، مسئولیت‌ها و نحوه تقسیم سود و زیان.",
    category: "business",
    icon: IconUsers,
    keywords: ["شراکت", "شریک", "شرکت تجاری", "سهم", "سود و زیان", "سرمایه"],
    status: "coming-soon",
    features: [
      "مشخصات شرکا",
      "سهم و سرمایه هر شریک",
      "نحوه تقسیم سود و زیان",
      "مسئولیت‌ها و تصمیم‌گیری",
      "شرایط خروج و انحلال",
    ],
    recommendedLawyerSpecialties: ["commerce", "companies"],
    seoTitle: "قرارداد شراکت تجاری | تنظیم توافق شرکا",
    metaDescription:
      "خدمت تنظیم قرارداد شراکت تجاری در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "sales-agency-contract",
    slug: "sales-agency-contract",
    title: "قرارداد نمایندگی فروش",
    shortDescription: "فروش محصولات یا خدمات یک کسب‌وکار توسط نماینده",
    description:
      "تنظیم قرارداد همکاری برای فروش محصولات یا خدمات یک کسب‌وکار توسط نماینده با تعیین محدوده فعالیت، پورسانت و تعهدات طرفین.",
    category: "business",
    icon: IconLocation,
    keywords: ["نمایندگی", "نماینده فروش", "فروش", "پورسانت", "منطقه فعالیت"],
    status: "coming-soon",
    features: [
      "مشخصات شرکت و نماینده",
      "محدوده فعالیت و منطقه فروش",
      "نحوه فروش و تعهدات نماینده",
      "پورسانت و شرایط پرداخت",
      "مدت قرارداد و شرایط فسخ",
    ],
    recommendedLawyerSpecialties: ["commerce"],
    seoTitle: "قرارداد نمایندگی فروش | تنظیم قرارداد نمایندگی",
    metaDescription:
      "خدمت تنظیم قرارداد نمایندگی فروش در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "marketing-commission-contract",
    slug: "marketing-commission-contract",
    title: "قرارداد بازاریابی و پورسانت",
    shortDescription: "همکاری بازاریابی با تعیین پورسانت و شرایط پرداخت",
    description:
      "تنظیم قرارداد همکاری بازاریابی با تعیین نحوه معرفی مشتری، میزان پورسانت، شرایط پرداخت و تعهدات طرفین.",
    category: "business",
    icon: IconStar,
    keywords: ["بازاریابی", "پورسانت", "فروش", "معرفی مشتری", "کمیسیون"],
    status: "coming-soon",
    features: [
      "مشخصات کارفرما و بازاریاب",
      "نحوه معرفی و جذب مشتری",
      "میزان پورسانت",
      "شرایط و زمان‌بندی پرداخت",
      "تعهدات و شرایط خاتمه",
    ],
    recommendedLawyerSpecialties: ["commerce"],
    seoTitle: "قرارداد بازاریابی و پورسانت | تنظیم قرارداد همکاری",
    metaDescription:
      "خدمت تنظیم قرارداد بازاریابی و پورسانت در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "distribution-agreement",
    slug: "distribution-agreement",
    title: "قرارداد توزیع",
    shortDescription: "توزیع محصولات و کالاها با تعیین محدوده و شرایط فروش",
    description:
      "تنظیم قرارداد توزیع محصولات و کالاها با تعیین محدوده فعالیت، شرایط فروش و تعهدات طرفین.",
    category: "business",
    icon: IconFiles,
    keywords: ["توزیع", "توزیع‌کننده", "پخش", "کالا", "منطقه توزیع"],
    status: "coming-soon",
    features: [
      "مشخصات تأمین‌کننده و توزیع‌کننده",
      "محدوده و منطقه توزیع",
      "شرایط فروش و قیمت‌گذاری",
      "تعهدات، انبارش و حمل",
      "مدت قرارداد و شرایط فسخ",
    ],
    recommendedLawyerSpecialties: ["commerce"],
    seoTitle: "قرارداد توزیع | تنظیم قرارداد توزیع کالا",
    metaDescription:
      "خدمت تنظیم قرارداد توزیع در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "supply-agreement",
    slug: "supply-agreement",
    title: "قرارداد تأمین کالا",
    shortDescription: "تأمین کالا با تعیین مشخصات، مقدار، قیمت و تحویل",
    description:
      "تنظیم قرارداد تأمین کالا با تعیین مشخصات کالا، مقدار، قیمت، زمان تحویل و شرایط پرداخت.",
    category: "business",
    icon: IconArchive,
    keywords: ["تأمین کالا", "تامین", "خرید کالا", "مقدار", "تحویل"],
    status: "coming-soon",
    features: [
      "مشخصات خریدار و فروشنده",
      "مشخصات و مقدار کالا",
      "قیمت و نحوه پرداخت",
      "زمان و شرایط تحویل",
      "تعهدات و شرایط فسخ",
    ],
    recommendedLawyerSpecialties: ["commerce", "contract"],
    seoTitle: "قرارداد تأمین کالا | تنظیم قرارداد خرید و تأمین",
    metaDescription:
      "خدمت تنظیم قرارداد تأمین کالا در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },

  // ----------------------------------------------------------
  // خودرو
  // ----------------------------------------------------------
  {
    id: "vehicle-installment-sale-contract",
    slug: "vehicle-installment-sale-contract",
    title: "قرارداد فروش اقساطی خودرو",
    shortDescription: "فروش خودرو به‌صورت اقساطی با تعیین اقساط و سررسیدها",
    description:
      "تنظیم قرارداد فروش خودرو به صورت اقساطی با تعیین مبلغ، پیش‌پرداخت، اقساط، سررسیدها و تعهدات طرفین.",
    category: "vehicle",
    icon: IconCar,
    keywords: ["فروش اقساطی", "خودرو", "ماشین", "اقساط", "پیش‌پرداخت", "فروش"],
    status: "coming-soon",
    features: [
      "مشخصات خریدار و فروشنده",
      "مشخصات خودرو",
      "مبلغ و پیش‌پرداخت",
      "تعداد و مبلغ اقساط و سررسیدها",
      "تضامین، تعهدات و شرایط فسخ",
    ],
    recommendedLawyerSpecialties: ["contract", "commerce"],
    seoTitle: "قرارداد فروش اقساطی خودرو | تنظیم قرارداد خودرو",
    metaDescription:
      "خدمت تنظیم قرارداد فروش اقساطی خودرو در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },

  // ----------------------------------------------------------
  // شرکت و سهام
  // ----------------------------------------------------------
  {
    id: "shareholders-agreement",
    slug: "shareholders-agreement",
    title: "قرارداد سهامداران",
    shortDescription: "توافق سهامداران درباره حقوق، تصمیم‌گیری و انتقال سهام",
    description:
      "تنظیم توافق میان سهامداران درباره حقوق، مسئولیت‌ها، تصمیم‌گیری، انتقال سهام و نحوه اداره شرکت.",
    category: "corporate",
    icon: IconScale,
    keywords: ["سهام", "سهامداران", "انتقال سهام", "تصمیم‌گیری", "شرکت"],
    status: "coming-soon",
    features: [
      "مشخصات سهامداران و سهام هر یک",
      "حقوق و مسئولیت‌ها",
      "نحوه تصمیم‌گیری و اداره شرکت",
      "شرایط انتقال سهام",
      "تعهدات، تضامین و حل اختلاف",
    ],
    recommendedLawyerSpecialties: ["companies"],
    seoTitle: "قرارداد سهامداران | تنظیم توافق سهامداران",
    metaDescription:
      "خدمت تنظیم قرارداد سهامداران در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "partner-exit-agreement",
    slug: "partner-exit-agreement",
    title: "قرارداد خروج شریک",
    shortDescription: "توافق خروج شریک، ارزش‌گذاری سهم و تسویه",
    description:
      "تنظیم توافق برای خروج یکی از شرکا، تعیین ارزش سهم، نحوه تسویه و انتقال حقوق و تعهدات.",
    category: "corporate",
    icon: IconBalance,
    keywords: ["خروج شریک", "شریک", "تسویه", "ارزش سهم", "انتقال سهم"],
    status: "coming-soon",
    features: [
      "مشخصات شرکا و شریک خارج‌شونده",
      "ارزش‌گذاری سهم",
      "نحوه و زمان‌بندی تسویه",
      "انتقال حقوق و تعهدات",
      "تعهدات باقی‌مانده و حل اختلاف",
    ],
    recommendedLawyerSpecialties: ["companies", "commerce"],
    seoTitle: "قرارداد خروج شریک | تنظیم توافق تسویه سهم",
    metaDescription:
      "خدمت تنظیم قرارداد خروج شریک در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },

  // ----------------------------------------------------------
  // خانواده و ارث
  // ----------------------------------------------------------
  {
    id: "family-contracts",
    slug: "family-contracts",
    title: "قراردادهای خانواده",
    shortDescription: "خدمات قراردادی و توافق‌های حقوقی مرتبط با روابط خانوادگی",
    description:
      "معرفی خدمات قراردادی و توافق‌های حقوقی مرتبط با روابط خانوادگی. جزئیات دقیق هر توافق پس از فعال‌سازی خدمت و بر پایه مشاوره حقوقی مشخص می‌شود.",
    category: "family",
    icon: IconUsers,
    keywords: ["خانواده", "توافق خانوادگی", "روابط خانوادگی", "مهریه", "نفقه"],
    status: "coming-soon",
    features: [
      "معرفی انواع توافق‌های خانوادگی",
      "شرایط و ملاحظات هر توافق",
      "راهنمای انتخاب توافق مناسب",
      "ارجاع به مشاوره حقوقی تخصصی",
      "آماده‌سازی برای تنظیم سند در آینده",
    ],
    recommendedLawyerSpecialties: ["family"],
    seoTitle: "قراردادهای خانواده | خدمات حقوقی روابط خانوادگی",
    metaDescription:
      "خدمت قراردادهای خانواده در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
  {
    id: "inheritance-division-agreement",
    slug: "inheritance-division-agreement",
    title: "توافق‌نامه تقسیم ارث",
    shortDescription: "توافق میان وراث برای نحوه تقسیم اموال و ترکه",
    description:
      "معرفی خدمت تنظیم توافق میان وراث برای تعیین نحوه تقسیم و تخصیص اموال و حقوق مربوط به ترکه.",
    category: "family",
    icon: IconGavel,
    keywords: ["ارث", "تقسیم ارث", "وراث", "ترکه", "سهم‌الارث"],
    status: "coming-soon",
    features: [
      "معرفی ساختار توافق تقسیم ارث",
      "تعیین سهام و اموال مشمول",
      "نحوه تخصیص اموال میان وراث",
      "ملاحظات حقوقی و ثبت سند",
      "ارجاع به مشاوره حقوقی تخصصی",
    ],
    recommendedLawyerSpecialties: ["family", "other"],
    seoTitle: "توافق‌نامه تقسیم ارث | تنظیم توافق وراث",
    metaDescription:
      "خدمت تنظیم توافق‌نامه تقسیم ارث در لیگالیر به‌زودی فعال می‌شود؛ در این صفحه قابلیت‌های آینده این خدمت معرفی شده است.",
  },
];

export const CONTRACT_SERVICE_COUNT = CONTRACT_SERVICES.length;

// ============================================================
// Popular — the services surfaced in «قراردادهای پرکاربرد»
// ============================================================
// A curated, hand-ordered shortlist so the page can lead with the most
// requested services instead of a uniform 28-card wall. Ids only: the
// card metadata still comes from CONTRACT_SERVICES above.

export const POPULAR_CONTRACT_SERVICE_IDS: string[] = [
  "employment-contract",
  "commercial-lease-contract",
  "software-development-contract",
  "contracting-agreement",
  "business-partnership-agreement",
  "debt-installment-contract",
];

export function popularContractServices(): ContractService[] {
  return POPULAR_CONTRACT_SERVICE_IDS.map((id) =>
    CONTRACT_SERVICES.find((s) => s.id === id)
  ).filter((s): s is ContractService => Boolean(s));
}

// ============================================================
// Lookups
// ============================================================

export function getContractService(slug: string): ContractService | undefined {
  return CONTRACT_SERVICES.find((s) => s.slug === slug);
}

export function contractServicesByCategory(id: ContractCategoryId): ContractService[] {
  return CONTRACT_SERVICES.filter((s) => s.category === id);
}

/** Categories that actually contain at least one service. */
export function populatedContractCategories(): ContractCategory[] {
  return CONTRACT_CATEGORIES.filter((c) => contractServicesByCategory(c.id).length > 0);
}

/** Every service as an href into its detail page. */
export function contractServiceHref(service: ContractService): string {
  return `/contracts/service/${service.slug}`;
}

// ============================================================
// Search
// ============================================================

/** Normalized search text for one service — title, copy and aliases. */
function serviceHaystack(service: ContractService): string {
  const category = getContractCategory(service.category);
  return normalizePersian(
    [
      service.title,
      service.shortDescription,
      service.description,
      category.title,
      ...service.keywords,
    ].join(" ")
  );
}

/**
 * Search services across title, description, category and keywords, with
 * Persian orthographic normalization so Arabic yeh/kaf input still matches
 * and «NDA» matches «nda». All terms must appear (AND semantics).
 */
export function searchContractServices(
  query: string,
  category: ContractCategoryId | "all" = "all"
): ContractService[] {
  const scoped =
    category === "all" ? CONTRACT_SERVICES : contractServicesByCategory(category);

  const q = normalizePersian(query.trim());
  if (!q) return scoped;

  const terms = q.split(" ").filter(Boolean);

  return scoped.filter((service) => {
    const haystack = serviceHaystack(service);
    return terms.every((term) => haystack.includes(term));
  });
}

// ============================================================
// Contract Finder — deterministic keyword matching
// ============================================================
// The finder is a plain-text prompt («می‌خواهم با یک برنامه‌نویس …»).
// This resolves it by scoring each service against the prompt's meaningful
// terms — no AI, no network. The scoring is deliberately transparent so it
// can later be swapped for a real matching service without touching the UI.

/** Words that carry no discriminating signal for service matching. */
const FINDER_STOPWORDS = new Set([
  "میخواهم",
  "میخوام",
  "نیاز",
  "دارم",
  "برای",
  "با",
  "یک",
  "و",
  "یا",
  "در",
  "به",
  "از",
  "که",
  "را",
  "بر",
  "هم",
  "این",
  "آن",
  "قرارداد",
  "قراردادی",
  "ببندم",
  "بستم",
  "بسته",
  "امضا",
  "منعقد",
  "ساخت",
  "انجام",
  "میان",
  "طرفین",
  "مورد",
  "خود",
]);

/**
 * Rank services against a free-text prompt. Returns the best matches
 * (score > 0), highest first, capped at `limit`. Deterministic and
 * side-effect free.
 */
export function findContractServices(prompt: string, limit = 3): ContractService[] {
  const normalized = normalizePersian(prompt.trim());
  if (!normalized) return [];

  const terms = normalized
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !FINDER_STOPWORDS.has(t));

  if (terms.length === 0) return [];

  const scored = CONTRACT_SERVICES.map((service) => {
    const title = normalizePersian(service.title);
    const keywords = normalizePersian(service.keywords.join(" "));
    const body = normalizePersian(`${service.shortDescription} ${service.description}`);

    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 3;
      if (keywords.includes(term)) score += 2;
      if (body.includes(term)) score += 1;
    }
    return { service, score };
  }).filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score || a.service.id.localeCompare(b.service.id));

  return scored.slice(0, limit).map((s) => s.service);
}
