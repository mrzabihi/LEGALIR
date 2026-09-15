// ============================================================
// LEGALIR — Services Catalog (Phase 14)
// Full service catalog with categories, search, and filter
// Modern UI redesign — gradient cards, accent bars, glass touches
// ============================================================

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { IconSearch } from "@/lib/icons";
import { LAW_SERVICE_EXAMPLES, getLawById, type LawServiceExample } from "@/lib/law-catalog";

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
  gradient: string;
  duration: string;
  outputType: string;
  href: string;
  /** Optional law source ids that document this service (rendered as chips). */
  lawRefs?: string[];
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

const OUTPUT_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  "متن":      { bg: "bg-blue-50",  text: "text-blue-700",  border: "border-blue-200" },
  "سند PDF":  { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "گزارش":    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

const SERVICES: ServiceItem[] = [
  // ---- Consultation ----
  {
    id: "qna",
    title: "پرسش و پاسخ حقوقی",
    description: "سوال حقوقی خود را مطرح کنید و پاسخ مستند با استناد به قوانین دریافت کنید",
    icon: <IconQnA />,
    category: "consultation",
    gradient: "from-blue-500 to-indigo-500",
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
    gradient: "from-cyan-500 to-blue-500",
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
    gradient: "from-violet-500 to-purple-500",
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
    gradient: "from-amber-500 to-orange-500",
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
    gradient: "from-emerald-500 to-teal-500",
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
    gradient: "from-rose-500 to-pink-500",
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
    gradient: "from-sky-500 to-cyan-500",
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
    gradient: "from-fuchsia-500 to-purple-500",
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
    gradient: "from-red-500 to-rose-500",
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
    gradient: "from-stone-500 to-neutral-500",
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
    gradient: "from-blue-600 to-indigo-600",
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
    gradient: "from-teal-500 to-emerald-500",
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
    gradient: "from-orange-500 to-amber-500",
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
    gradient: "from-green-500 to-emerald-500",
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
    gradient: "from-lime-500 to-green-500",
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
    gradient: "from-purple-500 to-violet-500",
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
    gradient: "from-cyan-500 to-sky-500",
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
    gradient: "from-amber-600 to-yellow-500",
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
    gradient: "from-rose-500 to-red-500",
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
    gradient: "from-indigo-500 to-blue-500",
    duration: "~۵ دقیقه",
    outputType: "متن",
    href: "/chat?category=calculator",
  },
];

// ============================================================
// Documented law-backed services (16 official law files)
// ============================================================
// Maps the law-catalog service examples into ServiceItem with a stable
// icon + gradient per category, plus lawRefs for the «مستندات» chips.

const LAW_CATEGORY_STYLE: Record<
  LawServiceExample["category"],
  { gradient: string; icon: React.ReactNode }
> = {
  consultation: { gradient: "from-blue-500 to-indigo-500", icon: <IconAnalysis /> },
  contracts: { gradient: "from-emerald-500 to-teal-500", icon: <IconFileCreate /> },
  documents: { gradient: "from-stone-500 to-neutral-500", icon: <IconFileText /> },
  cases: { gradient: "from-purple-500 to-violet-500", icon: <IconFolder /> },
  calculations: { gradient: "from-amber-600 to-yellow-500", icon: <IconCalculator /> },
};

const LAW_SERVICES: ServiceItem[] = LAW_SERVICE_EXAMPLES.map((s) => {
  const style = LAW_CATEGORY_STYLE[s.category];
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    icon: style.icon,
    category: s.category,
    gradient: style.gradient,
    duration: s.duration,
    outputType: s.outputType,
    href: s.href,
    lawRefs: s.lawRefs,
  };
});

const ALL_SERVICES: ServiceItem[] = [...SERVICES, ...LAW_SERVICES];

// ============================================================
// Service Card Component
// ============================================================

function ServiceCard({ service }: { service: ServiceItem }) {
  const badge = OUTPUT_BADGE[service.outputType] ?? { bg: "bg-neutral-50", text: "text-neutral-600", border: "border-neutral-200" };

  return (
    <div className="relative rounded-2xl bg-surface border border-divider/60 shadow-sm hover:shadow-elevation-2 transition-all duration-200 p-5 flex flex-col gap-4 group overflow-hidden">
      {/* Gradient accent top bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${service.gradient}`} />

      {/* Icon + Title + Description */}
      <div className="flex items-start gap-3 pt-0.5">
        <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${service.gradient} text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-200`}>
          {service.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-body-1 text-on-surface font-semibold group-hover:text-primary transition-colors">
            {service.title}
          </h3>
          <p className="text-caption text-muted mt-1 line-clamp-2 leading-relaxed">
            {service.description}
          </p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-600 px-2.5 py-0.5 text-caption font-medium">
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
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-caption font-medium ${badge.bg} ${badge.text} ${badge.border}`}
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

      {/* Documented law references (مستندات) */}
      {service.lawRefs && service.lawRefs.length > 0 && (
        <div className="pt-3 border-t border-divider/60">
          <p className="text-caption text-muted mb-2 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            مستندات
          </p>
          <div className="flex flex-wrap gap-1.5">
            {service.lawRefs.map((refId) => {
              const law = getLawById(refId);
              if (!law) return null;
              return (
                <span
                  key={refId}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/5 border border-primary/15 text-primary-700 px-2.5 py-0.5 text-caption"
                  title={law.title}
                >
                  {law.articleSection}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Action */}
      <Link
        href={service.href}
        className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-white px-5 py-2.5 text-button font-medium hover:bg-primary-700 transition-colors active:scale-[0.98] touch-target shadow-sm"
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
    return ALL_SERVICES.filter((service) => {
      if (activeFilter !== "all" && service.category !== activeFilter) {
        return false;
      }
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
        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
          <IconSearch size={20} className="text-muted" />
        </div>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجو در خدمات..."
          className="w-full h-12 pr-11 pl-12 rounded-xl bg-surface-container border border-divider/60 text-body-2 text-on-surface placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          aria-label="جستجو در خدمات"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 left-0 flex items-center pl-4 text-muted hover:text-on-surface transition-colors"
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
              "shrink-0 rounded-xl px-4 py-2 text-caption font-medium transition-all touch-target",
              activeFilter === filter.key
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "bg-surface text-on-surface hover:bg-surface-hover border border-divider/60",
            ].join(" ")}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {visibleSections.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="h-20 w-20 rounded-2xl bg-surface-container border border-divider/40 flex items-center justify-center">
            <IconSearch size={36} className="text-muted/40" />
          </div>
          <p className="text-body-1 text-muted font-medium">خدمتی با این مشخصات یافت نشد</p>
          <p className="text-body-2 text-muted/60">
            لطفا عبارت جستجو یا دسته‌بندی دیگری را امتحان کنید
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setActiveFilter("all");
            }}
            className="mt-3 rounded-xl bg-gradient-to-r from-primary-700 to-primary-800 text-white px-6 py-2.5 text-button font-medium hover:from-primary-800 hover:to-primary-900 transition-all shadow-md shadow-primary/20 active:scale-[0.98] touch-target"
          >
            نمایش همه خدمات
          </button>
        </div>
      )}

      {/* Category Sections */}
      {visibleSections.map((section) => (
        <section key={section.key} className="mb-10">
          {/* Section Header with gradient accent bar */}
          <div className="flex items-center gap-3 mb-5">
            <span className="block h-1.5 w-10 rounded-full bg-gradient-to-r from-primary-600 to-primary-800" />
            <h2 className="text-h3 text-primary-800 font-bold">{section.title}</h2>
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
            {groupedServices[section.key]?.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </section>
      ))}

      {/* Bottom CTA */}
      <div className="mt-12 mb-4 p-6 rounded-2xl bg-gradient-to-r from-primary-50 to-blue-50 border border-primary/10 text-center">
        <p className="text-body-1 text-on-surface font-medium mb-1">
          خدمت مورد نظر خود را پیدا نکردید؟
        </p>
        <p className="text-body-2 text-muted mb-4">
          با مشاور هوش مصنوعی LEGALIR گفتگو کنید تا راهنمایی تخصصی دریافت کنید
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-6 py-2.5 text-button font-medium hover:bg-primary-700 transition-colors active:scale-[0.98] shadow-sm"
        >
          شروع گفتگو
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

      {/* Legal Library CTA */}
      <div className="mt-12 mb-4 p-6 rounded-2xl bg-gradient-to-r from-primary-700 via-primary-800 to-primary-900 text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-geometric-pattern opacity-15" aria-hidden="true" />
        <div className="relative">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <path d="M8 7h6" /><path d="M8 11h8" /><path d="M8 15h5" />
              </svg>
            </div>
          </div>
          <h2 className="text-h2 mb-2">اسناد و منابع حقوقی</h2>
          <p className="text-body-1 text-white/70 mb-5 max-w-lg mx-auto leading-relaxed">
            قوانین، مقررات، راهنماهای کاربردی و آرای مهم حقوقی را مطالعه کنید و دانش حقوقی خود را ارتقا دهید
          </p>
          <Link href="/legal-library" className="inline-flex items-center gap-2 rounded-xl bg-white text-primary-800 px-6 py-2.5 text-button font-semibold hover:bg-neutral-100 transition-colors active:scale-[0.98] shadow-lg">
            مشاهده منابع حقوقی
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl-flip"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
