// ============================================================
// LEGALIR — Legal Library (اسناد) Page
// Rich legal knowledge center with search, filters, and
// categorized sections: topics, guides, laws, rulings, tools,
// recent updates, popular content, and recommendations.
// ============================================================

"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";

// ============================================================
// Persian Text Normalization
// ============================================================

const PERSIAN_NORMALIZATION_MAP: Record<string, string> = {
  "\u064A": "\u06CC", // Arabic yeh -> Persian yeh
  "\u0643": "\u06A9", // Arabic kaf -> Persian kaf
  "\u0660": "\u06F0", // ٠ -> ۰
  "\u0661": "\u06F1",
  "\u0662": "\u06F2",
  "\u0663": "\u06F3",
  "\u0664": "\u06F4",
  "\u0665": "\u06F5",
  "\u0666": "\u06F6",
  "\u0667": "\u06F7",
  "\u0668": "\u06F8",
  "\u0669": "\u06F9",
};

function normalizePersian(text: string): string {
  return text
    .split("")
    .map((ch) => PERSIAN_NORMALIZATION_MAP[ch] ?? ch)
    .join("");
}

// ============================================================
// Inline SVG Icon Components
// ============================================================

function SvgIcon({
  children,
  size = 28,
  className = "",
}: {
  children: React.ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
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

const IconLawBook = () => (
  <SvgIcon size={24}>
    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z" />
    <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z" />
    <path d="M10 9h8v2h-8V9zm0 3h4v2h-4v-2zm0-6h8v2h-8V6z" />
  </SvgIcon>
);

const IconBalance = () => (
  <SvgIcon size={24}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.88-11.71L10 14.17l-1.88-1.88a.996.996 0 10-1.41 1.41l2.59 2.59c.39.39 1.02.39 1.41 0L17.3 9.7a.996.996 0 000-1.41c-.39-.39-1.03-.39-1.42 0z" />
  </SvgIcon>
);

const IconShield = () => (
  <SvgIcon size={24}>
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
  </SvgIcon>
);

const IconCheckCircle = (props?: { className?: string }) => (
  <SvgIcon size={16} className={props?.className ?? ""}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </SvgIcon>
);

const IconClock = () => (
  <SvgIcon size={14}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </SvgIcon>
);

const IconBookOpen = () => (
  <SvgIcon size={20}>
    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
    <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
  </SvgIcon>
);

const IconFileText = () => (
  <SvgIcon size={20}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
    <path d="M10 9H8" />
  </SvgIcon>
);

const IconScale = () => (
  <SvgIcon size={20}>
    <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
    <path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
    <path d="M7 21h10" />
    <path d="M12 3v18" />
    <path d="M3 7h2c2 0 2-1 4-1s2 1 4-1 2-1 4-1h2" />
  </SvgIcon>
);

const IconCalendar = () => (
  <SvgIcon size={14}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </SvgIcon>
);

const IconEye = () => (
  <SvgIcon size={14}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </SvgIcon>
);

const IconArrowLeft = () => (
  <SvgIcon size={20}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </SvgIcon>
);

const IconSearch = () => (
  <SvgIcon size={20}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </SvgIcon>
);

const IconList = () => (
  <SvgIcon size={16}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </SvgIcon>
);

const IconTag = () => (
  <SvgIcon size={12}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <path d="M7 7h.01" />
  </SvgIcon>
);

const IconBriefcase = () => (
  <SvgIcon size={20}>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
  </SvgIcon>
);

const IconLightbulb = () => (
  <SvgIcon size={20}>
    <path d="M9 18h6M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5a4.61 4.61 0 011.41 2.5z" />
  </SvgIcon>
);

const IconAlert = () => (
  <SvgIcon size={20}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </SvgIcon>
);

// ============================================================
// Types
// ============================================================

type SourceType = "all" | "law" | "guide" | "ruling" | "tool" | "checklist";

interface TopicCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  tags: string[];
  description: string;
}

interface GuideCard {
  id: string;
  title: string;
  description: string;
  steps: number;
  readingTime: string;
  category: string;
}

interface LawCard {
  id: string;
  title: string;
  articleNumber: string;
  authority: string;
  description: string;
  verified: boolean;
  lastUpdated: string;
}

interface RulingCard {
  id: string;
  title: string;
  judgmentNumber: string;
  date: string;
  authority: string;
  description: string;
  relatedSources: number;
}

interface ToolCard {
  id: string;
  title: string;
  description: string;
  toolType: "calculator" | "generator" | "checklist";
  usageCount: string;
}

interface UpdateCard {
  id: string;
  title: string;
  description: string;
  date: string;
  type: "new" | "updated" | "amended";
}

interface PopularCard {
  id: string;
  title: string;
  description: string;
  views: number;
  category: string;
}

// ============================================================
// Filter Config
// ============================================================

const SOURCE_FILTERS: { key: SourceType; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "law", label: "قانون" },
  { key: "guide", label: "راهنما" },
  { key: "ruling", label: "رای وحدت رویه" },
  { key: "tool", label: "ابزار" },
  { key: "checklist", label: "چک‌لیست" },
];

// ============================================================
// Mock Data
// ============================================================

const TOPICS: TopicCard[] = [
  {
    id: "t1",
    title: "دعاوی ملکی و املاک",
    icon: <IconBriefcase />,
    tags: ["تصرف عدوانی", "خلع ید", "تخلیه", "غصب"],
    description: "قوانین و رویه‌های مربوط به دعاوی ملکی، تصرف عدوانی، خلع ید و تخلیه اماکن",
  },
  {
    id: "t2",
    title: "قراردادها و تعهدات",
    icon: <IconFileText />,
    tags: ["شروط ضمن عقد", "فسخ", "جبران خسارت", "وجه‌التزام"],
    description: "اصول حاکم بر قراردادها، شروط قراردادی، فسخ و جبران خسارت",
  },
  {
    id: "t3",
    title: "مسئولیت مدنی",
    icon: <IconAlert />,
    tags: ["تقصیر", "اتلاف", "تسبیب", "خسارت"],
    description: "مبانی مسئولیت مدنی، ارکان تحقق و روش‌های جبران خسارت",
  },
  {
    id: "t4",
    title: "حقوق خانواده",
    icon: <IconBalance />,
    tags: ["نکاح", "طلاق", "مهریه", "حضانت"],
    description: "قوانین و مقررات حوزه خانواده، ازدواج، طلاق، نفقه و حضانت فرزندان",
  },
  {
    id: "t5",
    title: "آیین دادرسی مدنی",
    icon: <IconScale />,
    tags: ["صلاحیت", "دعوی", "اعتراض", "تجدیدنظر"],
    description: "تشریفات دادرسی مدنی، صلاحیت محاکم، طرق اعتراض به آرا",
  },
  {
    id: "t6",
    title: "حقوق تجارت",
    icon: <IconBriefcase />,
    tags: ["شرکت‌ها", "اسناد تجاری", "ورشکستگی", "برات"],
    description: "قانون تجارت، شرکت‌های تجاری، اسناد تجاری و ورشکستگی",
  },
];

const GUIDES: GuideCard[] = [
  {
    id: "g1",
    title: "راهنمای تنظیم دادخواست حقوقی",
    description: "مراحل گام‌به‌گام تنظیم دادخواست حقوقی با ذکر نکات کلیدی و مستندات لازم",
    steps: 8,
    readingTime: "۱۵ دقیقه",
    category: "آیین دادرسی",
  },
  {
    id: "g2",
    title: "نحوه محاسبه خسارت تاخیر تادیه",
    description: "روش محاسبه خسارت تاخیر تادیه بر اساس ماده ۵۲۲ و نرخ تورم بانک مرکزی",
    steps: 5,
    readingTime: "۱۰ دقیقه",
    category: "محاسبات حقوقی",
  },
  {
    id: "g3",
    title: "راهنمای استناد به رویه قضایی",
    description: "شیوه صحیح استناد به آرای وحدت رویه و رویه‌های قضایی در لوایح حقوقی",
    steps: 6,
    readingTime: "۱۲ دقیقه",
    category: "فنون وکالت",
  },
  {
    id: "g4",
    title: "تنظیم قرارداد اجاره استاندارد",
    description: "راهنمای کامل تنظیم قرارداد اجاره اماکن مسکونی و تجاری با ذکر شروط ضروری",
    steps: 7,
    readingTime: "۱۸ دقیقه",
    category: "قراردادها",
  },
];

const LAWS: LawCard[] = [
  {
    id: "l1",
    title: "قانون مدنی — ماده ۲۳۰",
    articleNumber: "ماده ۲۳۰",
    authority: "مجلس شورای اسلامی",
    description:
      "اگر در ضمن معامله شرط شود که در صورت تخلف متخلف مبلغی به عنوان خسارت تادیه نماید...",
    verified: true,
    lastUpdated: "۱۴۰۲/۰۶/۱۵",
  },
  {
    id: "l2",
    title: "قانون آیین دادرسی مدنی — ماده ۵۲۲",
    articleNumber: "ماده ۵۲۲",
    authority: "مجلس شورای اسلامی",
    description:
      "در دعاوی که موضوع آن وجه نقد است، خسارت تاخیر تادیه بر اساس نرخ تورم...",
    verified: true,
    lastUpdated: "۱۴۰۲/۰۴/۰۳",
  },
  {
    id: "l3",
    title: "قانون روابط موجر و مستاجر ۱۳۷۶",
    articleNumber: "مجموعه مواد",
    authority: "مجمع تشخیص مصلحت نظام",
    description:
      "قانون حاکم بر روابط موجر و مستاجر در اماکن مسکونی، تجاری و اداری با اصلاحات بعدی",
    verified: true,
    lastUpdated: "۱۴۰۲/۰۲/۲۰",
  },
];

const RULINGS: RulingCard[] = [
  {
    id: "r1",
    title: "نحوه محاسبه خسارت تاخیر تادیه وجه نقد",
    judgmentNumber: "۸۰۵",
    date: "۱۴۰۱/۱۲/۱۰",
    authority: "هیات عمومی دیوان عالی کشور",
    description:
      "چنانچه موضوع دین وجه نقد باشد، دادگاه بر اساس شاخص تورم بانک مرکزی خسارت تاخیر تادیه را محاسبه می‌کند.",
    relatedSources: 12,
  },
  {
    id: "r2",
    title: "شرط عدم مسئولیت در قراردادهای حمل و نقل",
    judgmentNumber: "۷۹۴",
    date: "۱۴۰۱/۰۸/۰۳",
    authority: "هیات عمومی دیوان عالی کشور",
    description:
      "شرط عدم مسئولیت متصدی حمل و نقل در قبال خسارات وارده به کالا، در صورتی که ناشی از تقصیر عمدی باشد، باطل است.",
    relatedSources: 8,
  },
];

const TOOLS: ToolCard[] = [
  {
    id: "tl1",
    title: "محاسبه‌گر خسارت تاخیر تادیه",
    description: "محاسبه دقیق خسارت تاخیر تادیه بر اساس نرخ تورم اعلامی بانک مرکزی و ماده ۵۲۲",
    toolType: "calculator",
    usageCount: "۴,۲۰۰+ استفاده",
  },
  {
    id: "tl2",
    title: "تولیدگر پیش‌نویس دادخواست",
    description: "تولید خودکار پیش‌نویس دادخواست حقوقی با تکمیل اطلاعات پرونده توسط شما",
    toolType: "generator",
    usageCount: "۲,۸۰۰+ استفاده",
  },
  {
    id: "tl3",
    title: "چک‌لیست مدارک دعاوی ملکی",
    description: "چک‌لیست کامل مدارک و مستندات مورد نیاز برای طرح دعاوی ملکی در دادگاه",
    toolType: "checklist",
    usageCount: "۱,۹۰۰+ استفاده",
  },
];

const UPDATES: UpdateCard[] = [
  {
    id: "u1",
    title: "به‌روزرسانی نرخ دیه سال ۱۴۰۳",
    description: "نرخ دیه کامل در ماه‌های عادی و حرام بر اساس مصوبه جدید قوه قضاییه اعلام شد.",
    date: "۱۴۰۳/۰۱/۱۵",
    type: "updated",
  },
  {
    id: "u2",
    title: "افزودن قانون جدید شوراهای حل اختلاف",
    description: "متن کامل قانون جدید شوراهای حل اختلاف مصوب ۱۴۰۲ به بانک قوانین اضافه شد.",
    date: "۱۴۰۲/۱۱/۲۸",
    type: "new",
  },
  {
    id: "u3",
    title: "اصلاح آیین‌نامه ماده ۱۸۷ قانون مالیات‌های مستقیم",
    description: "آیین‌نامه اجرایی ماده ۱۸۷ با اصلاحات جدید سازمان امور مالیاتی منتشر شد.",
    date: "۱۴۰۲/۱۰/۱۲",
    type: "amended",
  },
];

const POPULAR: PopularCard[] = [
  {
    id: "p1",
    title: "ماده ۲۳۰ قانون مدنی — خسارت قراردادی",
    description: "شرح کامل وجه‌التزام و خسارت قراردادی در معاملات",
    views: 12_450,
    category: "قانون مدنی",
  },
  {
    id: "p2",
    title: "شرایط و آثار فسخ قرارداد",
    description: "تحلیل حقوقی خیارات قانونی، فسخ یک‌طرفه و آثار آن بر روابط قراردادی",
    views: 9_820,
    category: "حقوق قراردادها",
  },
  {
    id: "p3",
    title: "نحوه محاسبه مهریه بر اساس شاخص تورم",
    description: "راهنمای عملی محاسبه مهریه به نرخ روز با استناد به رویه قضایی",
    views: 8_350,
    category: "حقوق خانواده",
  },
];

// ============================================================
// Card Components
// ============================================================

function TopicCardItem({ topic }: { topic: TopicCard }) {
  return (
    <div className="card-lift card-press shrink-0 w-[260px] rounded-2xl bg-surface border border-divider/60 p-4 flex flex-col gap-3 shadow-elevation-1 hover:border-primary/20 transition-colors cursor-pointer group">
      {/* Icon */}
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200">
        {topic.icon}
      </div>
      {/* Title */}
      <h3 className="text-titleSmall text-on-surface font-semibold group-hover:text-primary transition-colors">
        {topic.title}
      </h3>
      {/* Description */}
      <p className="text-caption text-muted line-clamp-2 leading-relaxed">
        {topic.description}
      </p>
      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {topic.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-lg bg-surface-container px-2 py-0.5 text-labelSmall text-on-surface-variant"
          >
            <IconTag />
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function GuideCardItem({ guide }: { guide: GuideCard }) {
  return (
    <div className="card-lift card-press rounded-2xl bg-surface border border-divider/60 p-4 flex flex-col gap-3 shadow-elevation-1 hover:border-secondary/30 transition-colors cursor-pointer group">
      {/* Category badge */}
      <div className="flex items-center justify-between">
        <span className="text-labelSmall text-secondary font-medium bg-secondary/8 px-2 py-0.5 rounded-lg">
          {guide.category}
        </span>
        <span className="inline-flex items-center gap-1 text-caption text-muted">
          <IconClock />
          {guide.readingTime}
        </span>
      </div>
      {/* Title */}
      <h3 className="text-titleSmall text-on-surface font-semibold group-hover:text-primary transition-colors">
        {guide.title}
      </h3>
      {/* Description */}
      <p className="text-caption text-muted line-clamp-2 leading-relaxed">
        {guide.description}
      </p>
      {/* Steps */}
      <div className="flex items-center gap-1.5 mt-auto">
        <IconList />
        <span className="text-caption text-muted">
          {guide.steps} گام — راهنمای تصویری
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1 rounded-full bg-surface-container overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-secondary to-secondary-light rounded-full transition-all duration-300"
          style={{ width: `${Math.min((guide.steps / 10) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

function LawCardItem({ law }: { law: LawCard }) {
  return (
    <div className="card-lift card-press rounded-2xl bg-surface border border-divider/60 p-4 flex flex-col gap-3 shadow-elevation-1 hover:border-primary/30 transition-colors cursor-pointer group">
      {/* Header with article and verified badge */}
      <div className="flex items-start justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary/8 text-primary font-semibold px-3 py-1 text-labelMedium">
          <IconLawBook />
          {law.articleNumber}
        </span>
        {law.verified && (
          <span
            className="inline-flex items-center gap-1 text-labelSmall text-success font-medium"
            title="تایید شده توسط کارشناسان حقوقی"
          >
            <IconCheckCircle className="text-success" />
            تایید شده
          </span>
        )}
      </div>
      {/* Title */}
      <h3 className="text-titleSmall text-on-surface font-semibold group-hover:text-primary transition-colors">
        {law.title}
      </h3>
      {/* Description */}
      <p className="text-caption text-muted line-clamp-2 leading-relaxed">
        {law.description}
      </p>
      {/* Authority + Date */}
      <div className="flex items-center justify-between mt-auto text-labelSmall text-on-surface-variant">
        <span className="inline-flex items-center gap-1">
          <IconShield />
          {law.authority}
        </span>
        <span className="inline-flex items-center gap-1">
          <IconCalendar />
          {law.lastUpdated}
        </span>
      </div>
    </div>
  );
}

function RulingCardItem({ ruling }: { ruling: RulingCard }) {
  return (
    <div className="card-lift card-press rounded-2xl bg-surface border-r-4 border-r-secondary border border-divider/60 p-4 flex flex-col gap-3 shadow-elevation-1 hover:border-secondary/40 transition-colors cursor-pointer group">
      {/* Judgment Number + Date */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/10 text-secondary font-semibold px-2.5 py-0.5 text-labelMedium">
          <IconScale />
          شماره {ruling.judgmentNumber}
        </span>
        <span className="text-caption text-muted">{ruling.date}</span>
      </div>
      {/* Authority */}
      <span className="text-labelSmall text-secondary font-medium">{ruling.authority}</span>
      {/* Title */}
      <h3 className="text-titleSmall text-on-surface font-semibold group-hover:text-primary transition-colors">
        {ruling.title}
      </h3>
      {/* Description */}
      <p className="text-caption text-muted line-clamp-3 leading-relaxed">
        {ruling.description}
      </p>
      {/* Related sources */}
      <div className="flex items-center gap-1.5 mt-auto text-labelSmall text-muted">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 10h16M4 14h12M4 18h8" />
        </svg>
        {ruling.relatedSources} منبع مرتبط
      </div>
    </div>
  );
}

function ToolCardItem({ tool }: { tool: ToolCard }) {
  const toolStyles: Record<ToolCard["toolType"], { gradient: string; icon: React.ReactNode; label: string }> = {
    calculator: {
      gradient: "from-blue-500 to-cyan-500",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M8 6h8M8 10h0M8 14h0M12 10h0M16 10h0M8 18h4" />
        </svg>
      ),
      label: "محاسبه‌گر",
    },
    generator: {
      gradient: "from-secondary-500 to-secondary-700",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M12 10v6M9 13h6" />
        </svg>
      ),
      label: "تولیدگر",
    },
    checklist: {
      gradient: "from-emerald-500 to-teal-500",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      ),
      label: "چک‌لیست",
    },
  };

  const style = toolStyles[tool.toolType];

  return (
    <div className="card-lift card-press rounded-2xl bg-surface border border-divider/60 overflow-hidden flex flex-col shadow-elevation-1 hover:border-primary/20 transition-colors cursor-pointer group">
      {/* Tool type header bar */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r ${style.gradient} text-white`}
      >
        <span className="shrink-0">{style.icon}</span>
        <span className="text-labelMedium font-semibold">{style.label}</span>
        <span className="mr-auto text-labelSmall opacity-80">{tool.usageCount}</span>
      </div>
      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="text-titleSmall text-on-surface font-semibold group-hover:text-primary transition-colors">
          {tool.title}
        </h3>
        <p className="text-caption text-muted line-clamp-2 leading-relaxed">
          {tool.description}
        </p>
        <div className="mt-auto pt-2">
          <span className="inline-flex items-center gap-1.5 text-labelSmall text-primary font-medium">
            استفاده از ابزار
            <IconArrowLeft />
          </span>
        </div>
      </div>
    </div>
  );
}

function UpdateCardItem({ update }: { update: UpdateCard }) {
  const typeBadges: Record<UpdateCard["type"], { label: string; className: string }> = {
    new: { label: "جدید", className: "bg-info-container text-info border-info/20" },
    updated: { label: "به‌روزرسانی", className: "bg-warning-container text-warning border-warning/20" },
    amended: { label: "اصلاحیه", className: "bg-error-container text-error border-error/20" },
  };

  const badge = typeBadges[update.type];

  return (
    <div className="card-lift card-press rounded-xl bg-surface border border-divider/60 p-3 flex items-start gap-3 shadow-elevation-1 hover:border-primary/20 transition-colors cursor-pointer group">
      {/* Date */}
      <div className="shrink-0 flex flex-col items-center w-14 text-center">
        <div className="text-labelLarge text-on-surface font-bold leading-tight">
          {update.date.split("/")[2]}
        </div>
        <div className="text-labelSmall text-muted leading-tight">
          {update.date.split("/")[1]}/{update.date.split("/")[0]}
        </div>
      </div>
      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-body-2 text-on-surface font-medium truncate group-hover:text-primary transition-colors">
            {update.title}
          </h4>
          <span className={`shrink-0 text-labelSmall px-1.5 py-0.5 rounded-md border ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-caption text-muted line-clamp-1 leading-relaxed">
          {update.description}
        </p>
      </div>
    </div>
  );
}

function PopularCardItem({ item, rank }: { item: PopularCard; rank: number }) {
  return (
    <div className="card-lift card-press rounded-xl bg-surface border border-divider/60 p-3 flex items-start gap-3 shadow-elevation-1 hover:border-secondary/30 transition-colors cursor-pointer group">
      {/* Rank number */}
      <div
        className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-labelMedium font-bold ${
          rank === 1
            ? "bg-gradient-to-br from-secondary to-secondary-light text-white shadow-sm"
            : rank === 2
              ? "bg-secondary/10 text-secondary"
              : "bg-surface-container text-on-surface-variant"
        }`}
      >
        {rank}
      </div>
      {/* Content */}
      <div className="min-w-0 flex-1">
        <h4 className="text-body-2 text-on-surface font-medium truncate group-hover:text-primary transition-colors">
          {item.title}
        </h4>
        <p className="text-caption text-muted line-clamp-1 leading-relaxed mt-0.5">
          {item.description}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-labelSmall text-muted">
          <span className="inline-flex items-center gap-1">
            <IconEye />
            {item.views.toLocaleString("fa-IR")}
          </span>
          <span className="inline-flex items-center gap-1">
            <IconTag />
            {item.category}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page Component
// ============================================================

export default function LegalLibraryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<SourceType>("all");

  // Persian normalization helper
  const matchesSearch = useCallback(
    (text: string) => {
      if (!searchQuery.trim()) return true;
      const normalizedQuery = normalizePersian(searchQuery.trim());
      const normalizedText = normalizePersian(text);
      return normalizedText.includes(normalizedQuery);
    },
    [searchQuery]
  );

  // Filter topics by search
  const filteredTopics = useMemo(
    () =>
      TOPICS.filter(
        (t) =>
          matchesSearch(t.title) ||
          matchesSearch(t.description) ||
          t.tags.some((tag) => matchesSearch(tag))
      ),
    [matchesSearch]
  );

  // Filter guides by search
  const filteredGuides = useMemo(
    () =>
      GUIDES.filter(
        (g) => matchesSearch(g.title) || matchesSearch(g.description) || matchesSearch(g.category)
      ),
    [matchesSearch]
  );

  // Filter laws by search
  const filteredLaws = useMemo(
    () =>
      LAWS.filter(
        (l) =>
          matchesSearch(l.title) ||
          matchesSearch(l.description) ||
          matchesSearch(l.articleNumber) ||
          matchesSearch(l.authority)
      ),
    [matchesSearch]
  );

  // Filter rulings by search
  const filteredRulings = useMemo(
    () =>
      RULINGS.filter(
        (r) =>
          matchesSearch(r.title) ||
          matchesSearch(r.description) ||
          matchesSearch(r.judgmentNumber) ||
          matchesSearch(r.authority)
      ),
    [matchesSearch]
  );

  // Filter tools by search
  const filteredTools = useMemo(
    () =>
      TOOLS.filter(
        (t) => matchesSearch(t.title) || matchesSearch(t.description)
      ),
    [matchesSearch]
  );

  // Filter updates by search
  const filteredUpdates = useMemo(
    () =>
      UPDATES.filter(
        (u) => matchesSearch(u.title) || matchesSearch(u.description)
      ),
    [matchesSearch]
  );

  // Filter popular by search
  const filteredPopular = useMemo(
    () =>
      POPULAR.filter(
        (p) => matchesSearch(p.title) || matchesSearch(p.description) || matchesSearch(p.category)
      ),
    [matchesSearch]
  );

  // Determine if any results exist
  const hasResults =
    filteredTopics.length > 0 ||
    filteredGuides.length > 0 ||
    filteredLaws.length > 0 ||
    filteredRulings.length > 0 ||
    filteredTools.length > 0 ||
    filteredUpdates.length > 0 ||
    filteredPopular.length > 0;

  const isSearching = searchQuery.trim().length > 0 && !hasResults;

  return (
    <div className="p-4 tablet:p-6 max-w-7xl mx-auto" dir="rtl">
      {/* ============================================================
          Page Header
          ============================================================ */}
      <div className="mb-6">
        <h1 className="text-h2 text-on-surface mb-2">اسناد</h1>
        <p className="text-body-2 text-muted max-w-2xl">
          قوانین، مقررات، راهنماها و منابع حقوقی مورد نیاز شما — دسترسی سریع به دانش حقوقی با جستجوی هوشمند و دسته‌بندی موضوعی
        </p>
      </div>

      {/* ============================================================
          Search Bar
          ============================================================ */}
      <div className="relative mb-5 max-w-xl">
        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
          <IconSearch />
        </div>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجو در قوانین، راهنماها، آرا و ابزارهای حقوقی..."
          className="w-full h-12 pr-12 pl-12 rounded-xl bg-surface border border-divider/60 text-body-2 text-on-surface placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          aria-label="جستجو در اسناد حقوقی"
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

      {/* ============================================================
          Filter Chips
          ============================================================ */}
      <div
        role="tablist"
        aria-label="فیلتر نوع منبع حقوقی"
        className="flex items-center gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide"
      >
        {SOURCE_FILTERS.map((filter) => (
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
                : "bg-surface text-on-surface hover:bg-surface-container border border-divider/60",
            ].join(" ")}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* ============================================================
          Empty State — No search results
          ============================================================ */}
      {isSearching && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="h-20 w-20 rounded-2xl bg-surface-container border border-divider/40 flex items-center justify-center">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted/40"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
              <path d="M8 11h6" />
            </svg>
          </div>
          <p className="text-body-1 text-on-surface font-medium">
            نتیجه‌ای برای &ldquo;{searchQuery}&rdquo; یافت نشد
          </p>
          <p className="text-body-2 text-muted max-w-md">
            لطفا عبارت دیگری را جستجو کنید یا از دسته‌بندی‌های موضوعی برای مرور منابع حقوقی استفاده نمایید.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setActiveFilter("all");
            }}
            className="mt-3 rounded-xl bg-gradient-to-r from-primary-700 to-primary-800 text-white px-6 py-2.5 text-button font-medium hover:from-primary-800 hover:to-primary-900 transition-all shadow-md shadow-primary/20 active:scale-[0.98] touch-target"
          >
            نمایش همه منابع
          </button>
        </div>
      )}

      {/* ============================================================
          Content Sections
          ============================================================ */}
      {!isSearching && (
        <>
          {/* ---- Section 1: موضوعات پرکاربرد ---- */}
          {(activeFilter === "all" || activeFilter === "law") && filteredTopics.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-7 w-1 rounded-full bg-gradient-to-b from-primary-600 to-primary-800" />
                <h2 className="text-h3 text-primary-800 font-bold">موضوعات پرکاربرد</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {filteredTopics.map((topic) => (
                  <TopicCardItem key={topic.id} topic={topic} />
                ))}
              </div>
            </section>
          )}

          {/* ---- Section 2: راهنماهای کاربردی ---- */}
          {(activeFilter === "all" || activeFilter === "guide") && filteredGuides.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-7 w-1 rounded-full bg-gradient-to-b from-secondary to-secondary-light" />
                <h2 className="text-h3 text-secondary-700 font-bold">راهنماهای کاربردی</h2>
              </div>
              <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
                {filteredGuides.map((guide) => (
                  <GuideCardItem key={guide.id} guide={guide} />
                ))}
              </div>
            </section>
          )}

          {/* ---- Section 3: قوانین منتخب ---- */}
          {(activeFilter === "all" || activeFilter === "law") && filteredLaws.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-7 w-1 rounded-full bg-gradient-to-b from-primary-600 to-primary-800" />
                <h2 className="text-h3 text-primary-800 font-bold">قوانین منتخب</h2>
              </div>
              <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
                {filteredLaws.map((law) => (
                  <LawCardItem key={law.id} law={law} />
                ))}
              </div>
            </section>
          )}

          {/* ---- Section 4: آرای مهم ---- */}
          {(activeFilter === "all" || activeFilter === "ruling") && filteredRulings.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-7 w-1 rounded-full bg-gradient-to-b from-secondary to-secondary-light" />
                <h2 className="text-h3 text-secondary-700 font-bold">آرای مهم</h2>
              </div>
              <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
                {filteredRulings.map((ruling) => (
                  <RulingCardItem key={ruling.id} ruling={ruling} />
                ))}
              </div>
            </section>
          )}

          {/* ---- Section 5: ابزارهای حقوقی ---- */}
          {(activeFilter === "all" || activeFilter === "tool" || activeFilter === "checklist") &&
            filteredTools.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-7 w-1 rounded-full bg-gradient-to-b from-primary-600 to-primary-800" />
                <h2 className="text-h3 text-primary-800 font-bold">ابزارهای حقوقی</h2>
              </div>
              <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
                {filteredTools.map((tool) => (
                  <ToolCardItem key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          )}

          {/* ---- Section 6: آخرین به‌روزرسانی‌ها ---- */}
          {(activeFilter === "all") && filteredUpdates.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-7 w-1 rounded-full bg-gradient-to-b from-info to-primary-600" />
                <h2 className="text-h3 text-primary-800 font-bold">آخرین به‌روزرسانی‌ها</h2>
              </div>
              <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
                {filteredUpdates.map((update) => (
                  <UpdateCardItem key={update.id} update={update} />
                ))}
              </div>
            </section>
          )}

          {/* ---- Section 7: پربازدیدترین مطالب ---- */}
          {(activeFilter === "all") && filteredPopular.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-7 w-1 rounded-full bg-gradient-to-b from-secondary to-secondary-light" />
                <h2 className="text-h3 text-secondary-700 font-bold">پربازدیدترین مطالب</h2>
              </div>
              <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
                {filteredPopular.map((item, idx) => (
                  <PopularCardItem key={item.id} item={item} rank={idx + 1} />
                ))}
              </div>
            </section>
          )}

          {/* ---- Section 8: مطالب پیشنهادی برای شما ---- */}
          {activeFilter === "all" && (
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-7 w-1 rounded-full bg-gradient-to-b from-primary-500 to-secondary-500" />
                <h2 className="text-h3 text-primary-800 font-bold">مطالب پیشنهادی برای شما</h2>
              </div>
              <div className="relative rounded-2xl bg-gradient-to-br from-primary-50/60 to-secondary-50/40 border border-divider/40 p-6 overflow-hidden">
                {/* Decorative background pattern */}
                <div className="absolute inset-0 bg-geometric-pattern pointer-events-none" />
                <div className="relative grid grid-cols-1 tablet:grid-cols-3 gap-4">
                  {/* Recommendation 1 */}
                  <Link
                    href="/legal-library"
                    className="card-lift card-press rounded-xl bg-surface/80 backdrop-blur-sm border border-divider/40 p-4 flex flex-col gap-2 hover:border-primary/30 transition-colors group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 text-white flex items-center justify-center">
                      <IconLightbulb />
                    </div>
                    <h4 className="text-body-2 text-on-surface font-semibold group-hover:text-primary transition-colors">
                      تفاوت خیار فسخ و شرط انفساخ
                    </h4>
                    <p className="text-caption text-muted line-clamp-2 leading-relaxed">
                      تحلیل حقوقی تفاوت‌های خیار فسخ قانونی و شرط انفساخ قراردادی با ذکر نمونه پرونده
                    </p>
                    <span className="text-labelSmall text-primary mt-auto inline-flex items-center gap-1">
                      مطالعه
                      <IconArrowLeft />
                    </span>
                  </Link>

                  {/* Recommendation 2 */}
                  <Link
                    href="/legal-library"
                    className="card-lift card-press rounded-xl bg-surface/80 backdrop-blur-sm border border-divider/40 p-4 flex flex-col gap-2 hover:border-primary/30 transition-colors group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-secondary to-secondary-light text-white flex items-center justify-center">
                      <IconScale />
                    </div>
                    <h4 className="text-body-2 text-on-surface font-semibold group-hover:text-primary transition-colors">
                      صلاحیت محلی در دعاوی ملکی
                    </h4>
                    <p className="text-caption text-muted line-clamp-2 leading-relaxed">
                      راهنمای تشخیص صلاحیت محلی دادگاه در دعاوی مربوط به اموال غیرمنقول و املاک
                    </p>
                    <span className="text-labelSmall text-primary mt-auto inline-flex items-center gap-1">
                      مطالعه
                      <IconArrowLeft />
                    </span>
                  </Link>

                  {/* Recommendation 3 */}
                  <Link
                    href="/legal-library"
                    className="card-lift card-press rounded-xl bg-surface/80 backdrop-blur-sm border border-divider/40 p-4 flex flex-col gap-2 hover:border-primary/30 transition-colors group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 text-white flex items-center justify-center">
                      <IconBookOpen />
                    </div>
                    <h4 className="text-body-2 text-on-surface font-semibold group-hover:text-primary transition-colors">
                      مجموعه قوانین مزایده و مناقصه
                    </h4>
                    <p className="text-caption text-muted line-clamp-2 leading-relaxed">
                      گردآوری و شرح مواد قانون برگزاری مناقصات و آیین‌نامه‌های اجرایی مرتبط
                    </p>
                    <span className="text-labelSmall text-primary mt-auto inline-flex items-center gap-1">
                      مطالعه
                      <IconArrowLeft />
                    </span>
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* ---- Filtered empty state when specific filter has no results ---- */}
          {activeFilter !== "all" &&
            !filteredTopics.length &&
            !filteredGuides.length &&
            !filteredLaws.length &&
            !filteredRulings.length &&
            !filteredTools.length && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="h-16 w-16 rounded-2xl bg-surface-container border border-divider/40 flex items-center justify-center">
                <IconBookOpen />
              </div>
              <p className="text-body-1 text-on-surface font-medium">
                محتوایی در این دسته‌بندی یافت نشد
              </p>
              <p className="text-body-2 text-muted max-w-md">
                در حال حاضر محتوایی در بخش &ldquo;{SOURCE_FILTERS.find((f) => f.key === activeFilter)?.label}&rdquo; با عبارت جستجوی شما مطابقت ندارد.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveFilter("all");
                }}
                className="mt-2 rounded-xl border border-divider bg-surface px-5 py-2.5 text-body-2 text-on-surface font-medium hover:bg-surface-container transition-colors touch-target"
              >
                نمایش همه منابع
              </button>
            </div>
          )}
        </>
      )}

      {/* ============================================================
          Bottom CTA — Community-driven knowledge base
          ============================================================ */}
      {!isSearching && (
        <div className="mt-12 mb-4 p-6 rounded-2xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10 text-center">
          <p className="text-body-1 text-on-surface font-medium mb-1">
            منبع حقوقی مورد نظر خود را پیدا نکردید؟
          </p>
          <p className="text-body-2 text-muted mb-4">
            پایگاه دانش LEGALIR به صورت مستمر به‌روزرسانی می‌شود. می‌توانید درخواست افزودن منبع جدید را ثبت کنید.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-6 py-2.5 text-button font-medium hover:bg-primary-700 transition-colors active:scale-[0.98] shadow-sm touch-target"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              درخواست منبع جدید
            </Link>
            <Link
              href="/support"
              className="inline-flex items-center gap-2 rounded-xl border border-divider px-6 py-2.5 text-button text-on-surface font-medium hover:bg-surface-container transition-colors active:scale-[0.98] touch-target"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
              ارتباط با ما
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
