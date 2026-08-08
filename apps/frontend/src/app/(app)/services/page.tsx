// ============================================================
// LEGALIR — Services Catalog (Phase 14)
// Full service catalog with categories, search, and filter
// ============================================================

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { IconSearch } from "@/lib/icons";

// ============================================================
// Inline SVG Icon Components
// ============================================================

function SvgIcon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// --- Consultation Icons ---
const IconQnA = () => (
  <SvgIcon>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M9 9h6M9 13h4" />
  </SvgIcon>
);

const IconAnalysis = () => (
  <SvgIcon>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
    <path d="M11 8v3l2 2" />
  </SvgIcon>
);

const IconRoute = () => (
  <SvgIcon>
    <path d="M3 17h2l1-3h3l1 3h1l1-4h3l1 4h2" />
    <circle cx="8" cy="7" r="2" />
    <circle cx="17" cy="5" r="2" />
    <circle cx="20" cy="11" r="1.5" />
    <circle cx="5" cy="14" r="1.5" />
  </SvgIcon>
);

const IconRisk = () => (
  <SvgIcon>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </SvgIcon>
);

// --- Contract Icons ---
const IconDocSearch = () => (
  <SvgIcon>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <circle cx="10" cy="13" r="2" />
    <path d="m18 18-2.5-2.5" />
  </SvgIcon>
);

const IconCompare = () => (
  <SvgIcon>
    <path d="M16 3h5v5" />
    <path d="M8 3H3v5" />
    <path d="M21 21 16 16" />
    <path d="M3 21l5-5" />
    <path d="M10 14h4M10 10h4M10 18h4" />
  </SvgIcon>
);

const IconExtract = () => (
  <SvgIcon>
    <path d="M4 7V4h16v3" />
    <path d="M9 20h6" />
    <path d="M12 4v16" />
    <path d="M6 20h12" />
    <path d="M4 12h16" />
  </SvgIcon>
);

// --- Document Icons ---
const IconFileCreate = () => (
  <SvgIcon>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M12 18v-6" />
    <path d="M9 15h6" />
  </SvgIcon>
);

const IconFileText = () => (
  <SvgIcon>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M10 9h4" />
    <path d="M8 13h8" />
    <path d="M8 17h6" />
  </SvgIcon>
);

const IconFilePlus = () => (
  <SvgIcon>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M12 10v6" />
    <path d="M9 13h6" />
  </SvgIcon>
);

const IconSummarize = () => (
  <SvgIcon>
    <path d="M4 6h16M4 10h16M4 14h12M4 18h8" />
  </SvgIcon>
);

// --- Case Icons ---
const IconFolderPlus = () => (
  <SvgIcon>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    <path d="M12 11v6" />
    <path d="M9 14h6" />
  </SvgIcon>
);

const IconFolder = () => (
  <SvgIcon>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
  </SvgIcon>
);

const IconAnalytics = () => (
  <SvgIcon>
    <path d="M3 3v18h18" />
    <path d="M7 16l4-8 4 4 4-8" />
  </SvgIcon>
);

const IconTimeline = () => (
  <SvgIcon>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </SvgIcon>
);

// --- Calculation Icons ---
const IconCalculator = () => (
  <SvgIcon>
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M8 6h8M8 10h0M8 14h0M12 10h0M16 10h0M8 18h0M12 14h0M16 14h0M12 18h0M16 18h0" />
  </SvgIcon>
);

const IconMoney = () => (
  <SvgIcon>
    <circle cx="12" cy="12" r="10" />
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
    <path d="M12 18V6" />
  </SvgIcon>
);

// ============================================================
// Types & Data
// ============================================================

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: "consultation" | "contracts" | "documents" | "cases" | "calculations";
  duration: string;
  outputType: string;
  href: string;
}

const CATEGORY_FILTERS = [
  { key: "all", label: "همه" },
  { key: "consultation", label: "مشاوره" },
  { key: "contracts", label: "قراردادها" },
  { key: "documents", label: "اسناد" },
  { key: "cases", label: "پرونده‌ها" },
  { key: "calculations", label: "محاسبات" },
] as const;

const CATEGORY_SECTIONS: { key: Exclude<ServiceItem["category"], "all">; title: string }[] = [
  { key: "consultation", title: "دسته مشاوره حقوقی" },
  { key: "contracts", title: "دسته قراردادها" },
  { key: "documents", title: "دسته اسناد حقوقی" },
  { key: "cases", title: "دسته پرونده‌ها" },
  { key: "calculations", title: "دسته محاسبات حقوقی" },
];

const OUTPUT_TYPE_STYLES: Record<string, string> = {
  "متن": "bg-info/10 text-info",
  "سند PDF": "bg-warning/10 text-warning",
  "گزارش": "bg-success/10 text-success",
};

const SERVICES: ServiceItem[] = [
  // ---- Consultation ----
  {
    id: "qna",
    title: "پرسش و پاسخ حقوقی",
    description: "سوال حقوقی خود را مطرح کنید و پاسخ مستند با استناد به قوانین دریافت کنید",
    icon: <IconQnA />,
    category: "consultation",
    duration: "~۵ دقیقه",
    outputType: "متن",
    href: "/chat",
  },
  {
    id: "initial-analysis",
    title: "تحلیل اولیه مسئله",
    description: "مسئله خود را شرح دهید تا تحلیل اولیه، چارچوب حقوقی و رویه‌های مرتبط ارائه شود",
    icon: <IconAnalysis />,
    category: "consultation",
    duration: "~۱۰ دقیقه",
    outputType: "متن",
    href: "/chat",
  },
  {
    id: "suggested-route",
    title: "ارائه مسیر پیشنهادی",
    description: "مسیر حقوقی مناسب شامل اقدامات، مستندات لازم و مراجع ذی‌صلاح پیشنهاد می‌شود",
    icon: <IconRoute />,
    category: "consultation",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/chat",
  },
  {
    id: "risk-identification",
    title: "شناسایی ریسک‌های حقوقی",
    description: "ریسک‌های بالقوه در موضوع شما شناسایی و راهکار پیشگیری ارائه می‌شود",
    icon: <IconRisk />,
    category: "consultation",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/chat",
  },

  // ---- Contracts ----
  {
    id: "generate-contract",
    title: "تولید قرارداد",
    description: "با پاسخ به پرسش‌نامه هوشمند، پیش‌نویس قرارداد شخصی‌سازی‌شده دریافت کنید",
    icon: <IconFileCreate />,
    category: "contracts",
    duration: "~۱۵ دقیقه",
    outputType: "سند PDF",
    href: "/contracts",
  },
  {
    id: "review-contract",
    title: "بررسی قرارداد",
    description: "قرارداد خود را بارگذاری کنید تا تحلیل حقوقی، ریسک‌ها و شروط نامتعارف شناسایی شود",
    icon: <IconDocSearch />,
    category: "contracts",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/documents",
  },
  {
    id: "compare-contracts",
    title: "مقایسه قراردادها",
    description: "دو نسخه از یک قرارداد را مقایسه و تغییرات، الحاقات و حذفیات را شناسایی کنید",
    icon: <IconCompare />,
    category: "contracts",
    duration: "~۵ دقیقه",
    outputType: "گزارش",
    href: "/contracts",
  },
  {
    id: "extract-obligations",
    title: "استخراج تعهدات",
    description: "تعهدات، ضرب‌الاجل‌ها و شروط کلیدی از متن قرارداد استخراج و دسته‌بندی می‌شود",
    icon: <IconExtract />,
    category: "contracts",
    duration: "~۵ دقیقه",
    outputType: "گزارش",
    href: "/documents",
  },
  {
    id: "risk-clauses",
    title: "شناسایی بندهای پرریسک",
    description: "بندهای پرریسک قرارداد با توضیح علت ریسک و پیشنهاد اصلاح مشخص می‌شود",
    icon: <IconRisk />,
    category: "contracts",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/documents",
  },

  // ---- Documents ----
  {
    id: "generate-statement",
    title: "تولید اظهارنامه",
    description: "اظهارنامه رسمی حقوقی با ذکر مستندات قانونی و خواسته‌های شما تنظیم می‌شود",
    icon: <IconFileCreate />,
    category: "documents",
    duration: "~۱۰ دقیقه",
    outputType: "سند PDF",
    href: "/chat?category=formal_letter",
  },
  {
    id: "generate-brief",
    title: "تولید لایحه",
    description: "لایحه دفاعیه یا حقوقی با استناد به قوانین، رویه قضایی و دکترین حقوقی تنظیم می‌شود",
    icon: <IconFileText />,
    category: "documents",
    duration: "~۱۵ دقیقه",
    outputType: "سند PDF",
    href: "/chat",
  },
  {
    id: "generate-petition",
    title: "تولید دادخواست",
    description: "دادخواست حقوقی مطابق با فرمت رسمی دادگستری و ذکر خواسته، دلایل و مستندات",
    icon: <IconFilePlus />,
    category: "documents",
    duration: "~۱۵ دقیقه",
    outputType: "سند PDF",
    href: "/chat",
  },
  {
    id: "summarize-document",
    title: "خلاصه‌سازی اسناد",
    description: "متن سند حقوقی خود را بارگذاری کنید تا خلاصه اجرایی و نکات کلیدی استخراج شود",
    icon: <IconSummarize />,
    category: "documents",
    duration: "~۵ دقیقه",
    outputType: "متن",
    href: "/documents",
  },

  // ---- Cases ----
  {
    id: "register-case",
    title: "ثبت پرونده",
    description: "پرونده جدید با مشخصات، طرفین، موضوع و اسناد مرتبط ایجاد و مدیریت کنید",
    icon: <IconFolderPlus />,
    category: "cases",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/documents",
  },
  {
    id: "manage-case-docs",
    title: "مدیریت اسناد پرونده",
    description: "کلیه اسناد، مدارک و مستندات پرونده را به صورت طبقه‌بندی شده مدیریت کنید",
    icon: <IconFolder />,
    category: "cases",
    duration: "مداوم",
    outputType: "گزارش",
    href: "/documents",
  },
  {
    id: "case-analysis",
    title: "تحلیل وضعیت پرونده",
    description: "وضعیت جاری پرونده تحلیل و پیش‌بینی روند، نقاط قوت و ضعف ارائه می‌شود",
    icon: <IconAnalytics />,
    category: "cases",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/chat",
  },
  {
    id: "create-timeline",
    title: "ایجاد تایم‌لاین",
    description: "تایم‌لاین زمانی پرونده با ثبت وقایع، جلسات، مهلت‌ها و اقدامات کلیدی",
    icon: <IconTimeline />,
    category: "cases",
    duration: "~۵ دقیقه",
    outputType: "گزارش",
    href: "/history",
  },

  // ---- Calculations ----
  {
    id: "damages-calculation",
    title: "محاسبه خسارت",
    description: "محاسبه خسارت تاخیر تادیه، عدم انجام تعهد، و سایر خسارات قانونی بر اساس نرخ روز",
    icon: <IconCalculator />,
    category: "calculations",
    duration: "~۵ دقیقه",
    outputType: "متن",
    href: "/chat?category=calculator",
  },
  {
    id: "court-fee-calculation",
    title: "محاسبه هزینه دادرسی",
    description: "محاسبه هزینه دادرسی، تمبر، و کارشناسی بر اساس نوع دعوی و خواسته",
    icon: <IconMoney />,
    category: "calculations",
    duration: "~۵ دقیقه",
    outputType: "متن",
    href: "/chat?category=calculator",
  },
  {
    id: "diyeh-calculation",
    title: "محاسبه دیه",
    description: "محاسبه میزان دیه بر اساس نوع آسیب، جنسیت، سال وقوع و نرخ مصوب قوه قضاییه",
    icon: <IconMoney />,
    category: "calculations",
    duration: "~۵ دقیقه",
    outputType: "متن",
    href: "/chat?category=calculator",
  },
];

// ============================================================
// Service Card Component
// ============================================================

function ServiceCard({ service }: { service: ServiceItem }) {
  const outputStyle = OUTPUT_TYPE_STYLES[service.outputType] ?? "bg-neutral-100 text-neutral-700";

  return (
    <div className="rounded-large bg-surface border border-neutral-200 shadow-sm hover:shadow-elevation-2 transition-shadow p-5 flex flex-col gap-4 group">
      {/* Icon + Title + Description */}
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-medium bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {service.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-body-1 text-on-surface font-medium group-hover:text-primary transition-colors">
            {service.title}
          </h3>
          <p className="text-caption text-muted mt-1 line-clamp-2">
            {service.description}
          </p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 text-neutral-600 px-2.5 py-0.5 text-caption font-medium">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          {service.duration}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-medium ${outputStyle}`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
          </svg>
          {service.outputType}
        </span>
      </div>

      {/* Action */}
      <Link
        href={service.href}
        className="mt-auto inline-flex items-center justify-center gap-1 rounded-medium bg-primary text-white px-5 py-2 text-button font-medium hover:bg-primary-600 transition-colors active:scale-[0.98] touch-target"
      >
        شروع
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="rtl-flip"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

// ============================================================
// Main Page Component
// ============================================================

export default function ServicesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const filteredServices = useMemo(() => {
    return SERVICES.filter((service) => {
      // Filter by category
      if (activeFilter !== "all" && service.category !== activeFilter) {
        return false;
      }

      // Filter by search
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        return (
          service.title.toLowerCase().includes(query) ||
          service.description.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [activeFilter, searchQuery]);

  // Group filtered services by category
  const groupedServices = useMemo(() => {
    const groups: Record<string, ServiceItem[]> = {};
    for (const section of CATEGORY_SECTIONS) {
      const items = filteredServices.filter((s) => s.category === section.key);
      if (items.length > 0) {
        groups[section.key] = items;
      }
    }
    return groups;
  }, [filteredServices]);

  const visibleSections = CATEGORY_SECTIONS.filter((s) => s.key in groupedServices);

  return (
    <div className="p-4 tablet:p-6 max-w-6xl mx-auto" dir="rtl">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-h2 text-on-surface mb-2">خدمات LEGALIR</h1>
        <p className="text-body-2 text-muted">
          کلیه خدمات حقوقی مبتنی بر هوش مصنوعی قانون‌مدار — دسته‌بندی شده بر اساس حوزه تخصصی
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-5 max-w-xl">
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <IconSearch size={20} className="text-muted" />
        </div>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجو در خدمات..."
          className="w-full h-12 pr-10 pl-4 rounded-large bg-surface-container border border-divider text-body-2 text-on-surface placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
          aria-label="جستجو در خدمات"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted hover:text-on-surface transition-colors"
            aria-label="پاک کردن جستجو"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter Chips */}
      <div
        role="tablist"
        aria-label="فیلتر دسته‌بندی خدمات"
        className="flex items-center gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide"
      >
        {CATEGORY_FILTERS.map((filter) => (
          <button
            key={filter.key}
            role="tab"
            type="button"
            aria-selected={activeFilter === filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={[
              "shrink-0 rounded-full px-4 py-2 text-caption font-medium transition-colors touch-target",
              activeFilter === filter.key
                ? "bg-primary text-white shadow-sm"
                : "bg-surface text-on-surface hover:bg-surface-hover border border-divider",
            ].join(" ")}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {visibleSections.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-surface-container flex items-center justify-center">
            <IconSearch size={32} className="text-muted/50" />
          </div>
          <p className="text-body-1 text-muted">خدمتی با این مشخصات یافت نشد</p>
          <p className="text-body-2 text-muted/70">
            لطفا عبارت جستجو یا دسته‌بندی دیگری را امتحان کنید
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setActiveFilter("all");
            }}
            className="mt-2 rounded-medium bg-primary text-white px-5 py-2 text-button hover:bg-primary-600 transition-colors touch-target"
          >
            نمایش همه خدمات
          </button>
        </div>
      )}

      {/* Category Sections */}
      {visibleSections.map((section) => (
        <section key={section.key} className="mb-10">
          {/* Section Header with Gold Accent */}
          <div className="flex items-center gap-3 mb-5">
            <span className="block h-1 w-10 rounded-full bg-primary-800" />
            <h2 className="text-h3 text-primary-800 font-semibold">{section.title}</h2>
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
            {groupedServices[section.key]?.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
