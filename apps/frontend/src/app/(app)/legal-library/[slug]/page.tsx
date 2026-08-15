// ============================================================
// LEGALIR — Legal Source Detail Page
// Route: /legal-library/[slug]
// ============================================================

"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  IconWarning,
  IconCopy,
  IconLinkSource,
  IconCheckCircle,
  IconLawBook,
  IconChat,
  IconDocument,
  IconContract,
} from "@/lib/icons";

// ============================================================
// Inline SVG Icons (not in the shared library)
// ============================================================

function SvgIcon({ children, size = 20, className = "" }: { children: React.ReactNode; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconBookmark = ({ filled, size = 20 }: { filled?: boolean; size?: number }) => (
  <SvgIcon size={size}>
    <path
      d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
      fill={filled ? "currentColor" : "none"}
    />
  </SvgIcon>
);

const IconShare = ({ size = 20 }: { size?: number }) => (
  <SvgIcon size={size}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
  </SvgIcon>
);

const IconArrowLeft = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <SvgIcon size={size} className={className}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </SvgIcon>
);

const IconVerified = ({ size = 16 }: { size?: number }) => (
  <SvgIcon size={size}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="m9 11 3 3L22 4" />
  </SvgIcon>
);

const IconCalendar = ({ size = 16 }: { size?: number }) => (
  <SvgIcon size={size}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </SvgIcon>
);

const IconBuilding = ({ size = 16 }: { size?: number }) => (
  <SvgIcon size={size}>
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 6v.01M15 6v.01M9 10v.01M15 10v.01M9 14v.01M15 14v.01M9 18v.01M15 18v.01" />
  </SvgIcon>
);

const IconDot = ({ size = 10 }: { size?: number }) => (
  <SvgIcon size={size}>
    <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
  </SvgIcon>
);

// ============================================================
// Types
// ============================================================

type SourceType = "law" | "unity_decision" | "guide" | "regulation";
type RelationshipType = "interprets" | "refers" | "related";

interface LegalSourceRelationship {
  sourceSlug: string;
  sourceTitle: string;
  relationshipType: RelationshipType;
}

interface RelatedContentItem {
  title: string;
  href: string;
  type: string;
}

interface RelatedServiceItem {
  title: string;
  description: string;
  href: string;
  icon: "chat" | "documents" | "contracts";
}

interface LegalSource {
  slug: string;
  title: string;
  sourceType: SourceType;
  category: string;
  verified: boolean;
  lastUpdated: string;
  authority: string;
  sourceUrl: string | null;
  text: string | null;
  simpleExplanation: string | null;
  practicalApplication: string | null;
  keyPoints: string[] | null;
  examples: string | null;
  relationships: LegalSourceRelationship[];
  relatedContent: RelatedContentItem[];
  relatedServices: RelatedServiceItem[];
}

// ============================================================
// Mock Data
// ============================================================

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  law: "قانون",
  unity_decision: "رأی وحدت رویه",
  guide: "راهنما",
  regulation: "آیین‌نامه",
};

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  interprets: "تفسیر می‌کند",
  refers: "ارجاع می‌دهد",
  related: "مرتبط است",
};

const RELATIONSHIP_COLORS: Record<RelationshipType, string> = {
  interprets: "#2563EB",
  refers: "#8A6A33",
  related: "#6B7280",
};

const SOURCES: Record<string, LegalSource> = {
  "article-230-civil-code": {
    slug: "article-230-civil-code",
    title: "ماده ۲۳۰ قانون مدنی",
    sourceType: "law",
    category: "حقوق مدنی / تعهدات",
    verified: true,
    lastUpdated: "۱۴۰۴/۰۲/۱۵",
    authority: "قانون مدنی جمهوری اسلامی ایران",
    sourceUrl: "https://rc.majlis.ir/fa/law/show/97937",
    text: `ماده ۲۳۰ قانون مدنی:

هرگاه در ضمن معامله شرط شود که در صورت تخلف متخلف مبلغی به عنوان خسارت تأدیه نماید، حاکم نمی‌تواند او را به بیشتر یا کمتر از آنچه ملزم شده است محکوم کند.

این ماده ناظر بر شرط وجه التزام در قراردادهاست. وجه التزام مبلغی است که طرفین قرارداد به عنوان جبران خسارت ناشی از عدم انجام یا تأخیر در انجام تعهد، از پیش تعیین می‌کنند. مطابق نظر مشهور فقها و حقوقدانان، وجه التزام نوعی شرط نتیجه است و نیاز به اثبات ورود ضرر ندارد.`,
    simpleExplanation:
      "اگر در یک قرارداد، طرفین از قبل مبلغی را مشخص کنند که در صورت زیر پا گذاشتن تعهد، آن مبلغ پرداخت شود، دادگاه نمی‌تواند آن مبلغ را کم یا زیاد کند. به این مبلغ «وجه‌التزام» می‌گویند. یعنی شما و طرف مقابل می‌توانید از همان ابتدا هزینه تخلف را مشخص کنید و دادگاه ملزم به رعایت توافق شماست.",
    practicalApplication:
      "در قراردادهای خرید و فروش، پیمانکاری، مشارکت و... می‌توانید با درج شرط وجه‌التزام، از همان ابتدا تکلیف خسارت تأخیر یا عدم انجام تعهد را روشن کنید. نکته مهم: مبلغ وجه‌التزام باید معقول و متناسب باشد. اگر مبلغ گزاف و نامتعارف باشد، ممکن است دادگاه آن را خلاف نظم عمومی تشخیص دهد.",
    keyPoints: [
      "وجه التزام یک شرط نتیجه است و نیاز به اثبات ضرر ندارد",
      "دادگاه نمی‌تواند مبلغ توافقی را تغییر دهد (اصل لزوم قراردادها)",
      "مبلغ وجه التزام باید معقول و متناسب با موضوع قرارداد باشد",
      "وجه التزام قابل مطالبه مستقل از خسارت اصلی است",
      "در صورت فورس ماژور (قوه قاهره)، وجه التزام قابل مطالبه نیست",
    ],
    examples:
      "مثال ۱: در قرارداد فروش یک آپارتمان به مبلغ ۵ میلیارد تومان، شرط می‌شود که در صورت تأخیر ۳۰ روزه در تحویل، فروشنده ماهانه ۵۰ میلیون تومان وجه‌التزام بپردازد. خریدار می‌تواند بدون اثبات ضرر، این مبلغ را مطالبه کند.\n\nمثال ۲: در قرارداد پیمانکاری ساختمان، اگر پیمانکار ۶۰ روز تأخیر داشته باشد و وجه‌التزام روزانه ۱۰ میلیون تومان تعیین شده باشد، کارفرما ۶۰۰ میلیون تومان طلبکار می‌شود بدون آنکه نیازی به اثبات خسارت واقعی داشته باشد.",
    relationships: [
      {
        sourceSlug: "unity-decision-805",
        sourceTitle: "رأی وحدت رویه ۸۰۵",
        relationshipType: "interprets",
      },
      {
        sourceSlug: "article-522-procedure",
        sourceTitle: "ماده ۵۲۲ آیین دادرسی مدنی",
        relationshipType: "related",
      },
    ],
    relatedContent: [
      { title: "آموزش تنظیم شرط وجه‌التزام در قرارداد", href: "/chat?topic=penalty-clause", type: "گفتگو با مشاور" },
      { title: "راهنمای محاسبه خسارت قراردادی", href: "/chat?topic=damages-calculation", type: "محاسبه" },
    ],
    relatedServices: [
      { title: "تنظیم قرارداد با شرط وجه‌التزام", description: "قرارداد شخصی‌سازی‌شده با درج شرط وجه‌التزام", href: "/contracts/new", icon: "contracts" },
      { title: "بررسی قرارداد از نظر شروط خسارت", description: "تحلیل بندهای خسارت و وجه‌التزام در قرارداد شما", href: "/documents", icon: "documents" },
    ],
  },

  "article-522-procedure": {
    slug: "article-522-procedure",
    title: "ماده ۵۲۲ آیین دادرسی مدنی",
    sourceType: "law",
    category: "آیین دادرسی مدنی / خسارت",
    verified: true,
    lastUpdated: "۱۴۰۴/۰۱/۲۰",
    authority: "قانون آیین دادرسی دادگاه‌های عمومی و انقلاب در امور مدنی",
    sourceUrl: "https://rc.majlis.ir/fa/law/show/93353",
    text: `ماده ۵۲۲ قانون آیین دادرسی مدنی:

در دعاوی که موضوع آن دِین و از نوع وجه رایج بوده و با مطالبه داین و تمکّن مدیون، مدیون از تأدیه دین امتناع نموده، دادگاه می‌تواند متعهد را با رعایت تناسب تغییر شاخص قیمت سالانه که از سوی بانک مرکزی جمهوری اسلامی ایران تعیین می‌گردد، به پرداخت خسارت تأخیر تأدیه محکوم نماید.`,
    simpleExplanation:
      "اگر کسی به شما بدهی پولی دارد و با وجود اینکه شما درخواست پرداخت کرده‌اید و او توانایی پرداخت را داشته، اما پرداخت نکرده است، دادگاه می‌تواند علاوه بر اصل بدهی، مبلغی را هم به عنوان خسارت تأخیر (بر اساس نرخ تورم اعلامی بانک مرکزی) به نفع شما تعیین کند. به این «خسارت تأخیر تأدیه» می‌گویند.",
    practicalApplication:
      "برای مطالبه خسارت تأخیر تأدیه باید چند شرط را اثبات کنید: ۱- دین وجه رایج باشد (پول، نه کالا)، ۲- شما (داین) مطالبه کرده باشید، ۳- بدهکار (مدیون) توانایی پرداخت داشته باشد، ۴- بدهکار از پرداخت امتناع کرده باشد. میزان خسارت بر اساس شاخص تورم بانک مرکزی محاسبه می‌شود.",
    keyPoints: [
      "خسارت تأخیر تأدیه مختص دیون پولی (وجه رایج) است",
      "حتماً باید مطالبه دین از سوی طلبکار احراز شود",
      "تمکّن مالی مدیون شرط ضروری است",
      "میزان خسارت بر اساس شاخص تورم سالانه بانک مرکزی محاسبه می‌شود",
      "این ماده با رأی وحدت رویه ۸۰۵ تکمیل شده است",
      "خسارت تأخیر تأدیه با وجه‌التزام (ماده ۲۳۰ ق.م) متفاوت است",
    ],
    examples:
      "مثال ۱: چکی به مبلغ ۱ میلیارد تومان صادر شده اما برگشت خورده است. دارنده چک می‌تواند علاوه بر مبلغ چک، خسارت تأخیر تأدیه از تاریخ سررسید تا زمان پرداخت را مطالبه کند.\n\nمثال ۲: در یک قرارداد قرض‌الحسنه ۵۰۰ میلیون تومانی، اگر وام‌گیرنده با وجود توانایی مالی از بازپرداخت امتناع کند، وام‌دهنده می‌تواند علاوه بر اصل مبلغ، خسارت تأخیر تأدیه مطالبه نماید.",
    relationships: [
      {
        sourceSlug: "unity-decision-805",
        sourceTitle: "رأی وحدت رویه ۸۰۵",
        relationshipType: "refers",
      },
      {
        sourceSlug: "article-230-civil-code",
        sourceTitle: "ماده ۲۳۰ قانون مدنی",
        relationshipType: "related",
      },
    ],
    relatedContent: [
      { title: "روش محاسبه خسارت تأخیر تأدیه با نرخ روز", href: "/chat?topic=late-payment-damages", type: "محاسبه" },
      { title: "تفاوت وجه‌التزام و خسارت تأخیر تأدیه", href: "/chat?topic=penalty-vs-delay", type: "گفتگو با مشاور" },
    ],
    relatedServices: [
      { title: "محاسبه خسارت تأخیر تأدیه", description: "محاسبه خودکار میزان خسارت بر اساس نرخ تورم بانک مرکزی", href: "/chat?category=calculator", icon: "documents" },
      { title: "تنظیم دادخواست مطالبه وجه", description: "تنظیم دادخواست حرفه‌ای با ذکر مستندات قانونی", href: "/chat?category=petition", icon: "chat" },
    ],
  },

  "unity-decision-805": {
    slug: "unity-decision-805",
    title: "رأی وحدت رویه ۸۰۵",
    sourceType: "unity_decision",
    category: "آیین دادرسی مدنی / خسارت",
    verified: true,
    lastUpdated: "۱۴۰۴/۰۳/۰۱",
    authority: "هیأت عمومی دیوان عالی کشور",
    sourceUrl: "https://divanealee.eadl.ir/",
    text: `رأی وحدت رویه شماره ۸۰۵ هیأت عمومی دیوان عالی کشور:

با توجه به مواد ۲۲۱، ۲۲۷ و ۲۲۹ قانون مدنی، تعیین خسارت قراردادی (وجه‌التزام) به شرح مقرر در ماده ۲۳۰ قانون مدنی، منصرف از خسارت تأخیر تأدیه موضوع ماده ۵۲۲ قانون آیین دادرسی دادگاه‌های عمومی و انقلاب در امور مدنی بوده و با تحقق شرایط مقرر در ماده اخیرالذکر، قابل مطالبه است. همچنین در مواردی که مقدار خسارت قراردادی کمتر از خسارت تأخیر تأدیه باشد، متعهدله می‌تواند مابه‌التفاوت را نیز مطالبه کند.

این رأی مطابق ماده ۴۷۱ قانون آیین دادرسی کیفری برای شعب دیوان عالی کشور و دادگاه‌ها و سایر مراجع لازمالاتباع است.`,
    simpleExplanation:
      "دیوان عالی کشور در این رأی مشخص کرده که «وجه‌الالتزام» (ماده ۲۳۰ قانون مدنی) و «خسارت تأخیر تأدیه» (ماده ۵۲۲ آیین دادرسی مدنی) دو چیز متفاوت هستند و هر دو قابل مطالبه‌اند. یعنی شما هم می‌توانید وجه‌الالتزام قراردادی را بگیرید و هم خسارت تأخیر تأدیه قانونی را. حتی اگر وجه‌الالتزام کمتر از تورم باشد، می‌توانید مابه‌التفاوت را هم مطالبه کنید. این رأی برای همه دادگاه‌ها لازم‌الاجراست.",
    practicalApplication:
      "اگر در قرارداد خود شرط وجه‌الالتزام دارید اما مبلغ آن از نرخ تورم کمتر است، می‌توانید هم وجه‌الالتزام را مطالبه کنید و هم مابه‌التفاوت آن تا سقف نرخ تورم را. این رأی یک حمایت قوی از طلبکاران ایجاد کرده است. برای استناد به این رأی در دادخواست خود، حتماً شماره رأی (۸۰۵) و تاریخ آن را ذکر کنید.",
    keyPoints: [
      "وجه‌الالتزام و خسارت تأخیر تأدیه دو نهاد متفاوت و مستقل هستند",
      "هر دو نوع خسارت هم‌زمان قابل مطالبه می‌باشند",
      "اگر وجه‌الالتزام کمتر از تورم باشد، مابه‌التفاوت قابل مطالبه است",
      "این رأی برای کلیه مراجع قضایی لازم‌الاتباع است",
      "مطالبه وجه‌الالتزام نیاز به اثبات ضرر ندارد",
      "مطالبه خسارت تأخیر تأدیه نیاز به اثبات تمکّن مدیون دارد",
    ],
    examples:
      "مثال: در یک قرارداد، وجه‌الالتزام ماهانه ۲۰ میلیون تومان تعیین شده است. تورم سالانه ۴۰٪ است و اصل بدهی ۱ میلیارد تومان. طلبکار می‌تواند: الف) وجه‌الالتزام ۲۰ میلیون تومان ماهانه را بدون اثبات ضرر دریافت کند. ب) علاوه بر آن، مابه‌التفاوت خسارت تأخیر تأدیه (بر اساس شاخص تورم بانک مرکزی) را نیز مطالبه نماید.",
    relationships: [
      {
        sourceSlug: "article-230-civil-code",
        sourceTitle: "ماده ۲۳۰ قانون مدنی",
        relationshipType: "interprets",
      },
      {
        sourceSlug: "article-522-procedure",
        sourceTitle: "ماده ۵۲۲ آیین دادرسی مدنی",
        relationshipType: "refers",
      },
    ],
    relatedContent: [
      { title: "تحلیل کامل رأی وحدت رویه ۸۰۵", href: "/chat?topic=unity-805-analysis", type: "گفتگو با مشاور" },
      { title: "مقایسه وجه‌التزام و خسارت تأخیر تأدیه", href: "/chat?topic=penalty-vs-delay", type: "گفتگو با مشاور" },
      { title: "نمونه دادخواست با استناد به رأی ۸۰۵", href: "/chat?topic=petition-805", type: "تنظیم سند" },
    ],
    relatedServices: [
      { title: "تحلیل پرونده با استناد به رأی ۸۰۵", description: "بررسی امکان مطالبه هم‌زمان وجه‌الالتزام و خسارت تأخیر", href: "/chat", icon: "chat" },
      { title: "تنظیم دادخواست مطالبه خسارت مضاعف", description: "دادخواست حرفه‌ای با استناد به رأی وحدت رویه ۸۰۵", href: "/chat?category=petition", icon: "documents" },
    ],
  },

  "landlord-tenant-guide": {
    slug: "landlord-tenant-guide",
    title: "راهنمای مالک و مستأجر",
    sourceType: "guide",
    category: "حقوق مدنی / اجاره",
    verified: true,
    lastUpdated: "۱۴۰۴/۰۴/۱۰",
    authority: "LEGALIR — مرجع آموزش حقوقی",
    sourceUrl: null,
    text: `راهنمای جامع حقوق مالک و مستأجر در ایران

این راهنما بر اساس قوانین روابط موجر و مستأجر (مصوب ۱۳۷۶ و اصلاحات بعدی) و قانون مدنی تدوین شده است. رابطه مالک و مستأجر یکی از پرچالش‌ترین حوزه‌های حقوقی در ایران است.

مبانی قانونی اصلی:
- قانون روابط موجر و مستأجر مصوب ۱۳۷۶ (برای اماکن مسکونی)
- قانون روابط موجر و مستأجر مصوب ۱۳۵۶ (برای اماکن تجاری)
- مواد ۴۶۶ تا ۵۰۶ قانون مدنی (قواعد عمومی اجاره)`,
    simpleExplanation:
      "اگر خانه یا مغازه‌ای اجاره می‌دهید یا اجاره می‌کنید، دانستن حقوق و تکالیف قانونی شما ضروری است. این راهنما به زبان ساده توضیح می‌دهد که: چه زمانی مالک می‌تواند مستأجر را تخلیه کند، مهلت تخلیه چقدر است، افزایش اجاره‌بها طبق قانون چگونه است، سرقفلی چیست و چه کسی باید هزینه تعمیرات را بدهد.",
    practicalApplication:
      "برای هر قرارداد اجاره این نکات را رعایت کنید: ۱- حتماً قرارداد کتبی تنظیم و در بنگاه معتبر ثبت شود، ۲- مبلغ اجاره، مهلت پرداخت و شرایط تمدید دقیقاً ذکر شود، ۳- از وضعیت ملک عکس و فیلم تهیه شود، ۴- هزینه تعمیرات اساسی با مالک و جزئی با مستأجر است، ۵- برای تخلیه، مالک باید از مسیر قانونی (شورای حل اختلاف یا دادگاه) اقدام کند.",
    keyPoints: [
      "قرارداد اجاره حتماً کتبی باشد و در سامانه ثبت معاملات املاک ثبت شود",
      "مالک نمی‌تواند خودسرانه مستأجر را تخلیه کند — نیاز به دستور قضایی دارد",
      "افزایش اجاره‌بها سالانه و بر اساس نرخ تورم مصوب شورای عالی مسکن است",
      "تعمیرات اساسی (لوله‌کشی، سیم‌کشی، نما) با مالک است",
      "تعمیرات جزئی (شیرآلات، کلید و پریز، رنگ‌آمیزی) با مستأجر است",
      "سرقفلی در اماکن تجاری (قانون ۱۳۵۶) با اماکن مسکونی (قانون ۱۳۷۶) متفاوت است",
      "در قراردادهای جدید (مصوب ۱۳۷۶) مستأجر حق سرقفلی ندارد",
    ],
    examples:
      "مثال ۱: مستأجری ۳ ماه اجاره پرداخت نکرده است. مالک باید ابتدا اظهارنامه ارسال کند و در صورت عدم پرداخت، به شورای حل اختلاف مراجعه نماید. مالک حق قطع آب، برق یا گاز را ندارد.\n\nمثال ۲: در یک مغازه تجاری مشمول قانون ۱۳۵۶، مالک می‌خواهد ملک را تخلیه کند. باید سرقفلی مستأجر (حق کسب و پیشه) را به نرخ کارشناسی روز پرداخت کند.",
    relationships: [],
    relatedContent: [
      { title: "نمونه قرارداد اجاره مسکونی", href: "/contracts/new?type=rental", type: "تنظیم قرارداد" },
      { title: "شرایط قانونی تخلیه مستأجر", href: "/chat?topic=eviction-law", type: "گفتگو با مشاور" },
      { title: "محاسبه سرقفلی اماکن تجاری", href: "/chat?topic=goodwill-calculation", type: "محاسبه" },
    ],
    relatedServices: [
      { title: "تنظیم قرارداد اجاره", description: "قرارداد اجاره شخصی‌سازی‌شده منطبق با آخرین قوانین", href: "/contracts/new", icon: "contracts" },
      { title: "تنظیم اظهارنامه تخلیه", description: "اظهارنامه رسمی برای درخواست تخلیه مستأجر", href: "/chat?category=formal_letter", icon: "documents" },
      { title: "مشاوره حقوقی روابط موجر و مستأجر", description: "پرسش و پاسخ تخصصی در زمینه اجاره", href: "/chat", icon: "chat" },
    ],
  },
};

// ============================================================
// Helpers
// ============================================================

function getSource(slug: string): LegalSource | null {
  return SOURCES[slug] ?? null;
}

function sourceTypeBadgeStyles(type: SourceType): { bg: string; text: string; border: string } {
  const map: Record<SourceType, { bg: string; text: string; border: string }> = {
    law: { bg: "bg-primary-50", text: "text-primary-700", border: "border-primary-200" },
    unity_decision: { bg: "bg-info-container", text: "text-info", border: "border-info/30" },
    guide: { bg: "bg-secondary-50", text: "text-secondary-700", border: "border-secondary-200" },
    regulation: { bg: "bg-warning-container", text: "text-warning", border: "border-warning/30" },
  };
  return map[type];
}

// ============================================================
// Sub-components
// ============================================================

/** Colored verification badge */
function VerificationBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-container text-success border border-success/25 px-3 py-1 text-caption font-medium">
      <IconVerified size={14} />
      تأیید شده
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-container text-warning border border-warning/25 px-3 py-1 text-caption font-medium">
      <IconWarning size={14} />
      در انتظار بازبینی
    </span>
  );
}

/** Source type badge */
function SourceTypeBadge({ type }: { type: SourceType }) {
  const styles = sourceTypeBadgeStyles(type);
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-caption font-medium ${styles.bg} ${styles.text} ${styles.border}`}>
      {SOURCE_TYPE_LABELS[type]}
    </span>
  );
}

/** Action button */
function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  active,
  variant = "default",
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: "default" | "primary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-button font-medium transition-all duration-200 touch-target",
        "border border-divider/60",
        variant === "primary"
          ? active
            ? "bg-primary text-white border-primary shadow-sm"
            : "bg-surface text-on-surface hover:bg-surface-container active:scale-[0.97]"
          : active
            ? "bg-secondary-50 text-secondary-700 border-secondary-200"
            : "bg-surface text-on-surface hover:bg-surface-container active:scale-[0.97]",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      {icon}
      <span className="hidden tablet:inline">{label}</span>
    </button>
  );
}

/** Section container for body content */
function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface border border-divider/60 p-5 tablet:p-6 shadow-sm">
      <h3 className="text-h4 text-on-surface font-semibold mb-4 flex items-center gap-2">
        <span className="block h-1.5 w-8 rounded-full bg-primary-600" />
        {title}
      </h3>
      <div className="text-body-2 text-on-surface leading-relaxed">{children}</div>
    </section>
  );
}

/** Key points bullet list */
function KeyPointsList({ points }: { points: string[] }) {
  return (
    <ul className="space-y-3">
      {points.map((point, i) => (
        <li key={i} className="flex items-start gap-3 text-body-2 text-on-surface">
          <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
            <IconDot size={8} />
          </span>
          <span>{point}</span>
        </li>
      ))}
    </ul>
  );
}

// ============================================================
// Related Sources Graph — Visual Card Connector
// ============================================================

function RelatedSourcesGraph({
  currentSlug,
  relationships,
}: {
  currentSlug: string;
  relationships: LegalSourceRelationship[];
}) {
  // Build the graph: current source is center, related sources around it
  // Show: Source A <--interprets-- Current --refers--> Source B
  // The relationships describe how the *related* source relates to *this* source

  if (relationships.length === 0) return null;

  // Create nodes: each relationship becomes a trio: source -> current -> target (or reversed)
  const allTargets = relationships.map((r) => {
    const target = SOURCES[r.sourceSlug];
    return { relationship: r, target };
  });

  return (
    <section className="rounded-2xl bg-surface border border-divider/60 p-5 tablet:p-6 shadow-sm">
      <h3 className="text-h4 text-on-surface font-semibold mb-4 flex items-center gap-2">
        <span className="block h-1.5 w-8 rounded-full bg-primary-600" />
        منابع مرتبط
      </h3>

      <div className="overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex items-stretch gap-0 min-w-max" style={{ minWidth: allTargets.length * 280 }}>
          {allTargets.map(({ relationship, target }, idx) => {
            if (!target) return null;

            const relLabel = RELATIONSHIP_LABELS[relationship.relationshipType];
            const relColor = RELATIONSHIP_COLORS[relationship.relationshipType];
            const typeBadge = sourceTypeBadgeStyles(target.sourceType);
            const isSourceA = true; // the related source is the connected card

            return (
              <div key={idx} className="flex items-center gap-0">
                {/* Related Source Card */}
                <Link
                  href={`/legal-library/${target.slug}`}
                  className="group flex shrink-0 flex-col gap-2 rounded-xl border border-divider/60 bg-surface-container p-4 w-[200px] hover:border-primary/40 hover:shadow-elevation-1 transition-all duration-200"
                >
                  <span className={`inline-flex self-start rounded-full border px-2 py-0.5 text-labelSmall font-medium ${typeBadge.bg} ${typeBadge.text} ${typeBadge.border}`}>
                    {SOURCE_TYPE_LABELS[target.sourceType]}
                  </span>
                  <h4 className="text-titleSmall text-on-surface group-hover:text-primary transition-colors leading-snug">
                    {target.title}
                  </h4>
                </Link>

                {/* Connector Line + Label */}
                <div className="flex flex-col items-center shrink-0 px-2">
                  {/* Line */}
                  <div className="w-10 h-0.5 rounded-full" style={{ backgroundColor: relColor }} />
                  {/* Relationship direction for the connected card to this one */}
                  <span
                    className="text-labelSmall font-medium mt-1 whitespace-nowrap"
                    style={{ color: relColor }}
                  >
                    {relLabel}
                  </span>
                  <span className="text-labelSmall text-muted whitespace-nowrap mt-0.5">⬅</span>
                </div>
              </div>
            );
          })}

          {/* Current Source Card (center/anchor) */}
          <div className="flex shrink-0 items-center">
            <div className="flex flex-col gap-2 rounded-xl border-2 border-primary/30 bg-primary-50 p-4 w-[200px] shadow-elevation-1">
              <span className="inline-flex self-start rounded-full bg-primary text-white border border-primary px-2 py-0.5 text-labelSmall font-medium">
                این منبع
              </span>
              <h4 className="text-titleSmall text-on-surface font-bold leading-snug">
                {getSource(currentSlug)?.title ?? currentSlug}
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-divider/40 flex-wrap">
        {(Object.entries(RELATIONSHIP_LABELS) as [RelationshipType, string][]).map(([key, label]) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-caption text-muted">
            <span className="block h-2 w-2 rounded-full" style={{ backgroundColor: RELATIONSHIP_COLORS[key] }} />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// Related Content Section
// ============================================================

function RelatedContentSection({ items }: { items: RelatedContentItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl bg-surface border border-divider/60 p-5 tablet:p-6 shadow-sm">
      <h3 className="text-h4 text-on-surface font-semibold mb-4 flex items-center gap-2">
        <span className="block h-1.5 w-8 rounded-full bg-primary-600" />
        مطالب آموزشی مرتبط
      </h3>
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
        {items.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className="flex items-center gap-3 rounded-xl border border-divider/60 p-4 bg-surface-container hover:border-primary/30 hover:shadow-elevation-1 transition-all duration-200 group"
          >
            <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <IconLawBook size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-2 text-on-surface font-medium group-hover:text-primary transition-colors truncate">
                {item.title}
              </p>
              <p className="text-caption text-muted">{item.type}</p>
            </div>
            <IconArrowLeft size={16} className="text-muted shrink-0 rtl-flip" />
          </Link>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// Related Services Section (LEGALIR CTA Cards)
// ============================================================

const serviceIconMap: Record<RelatedServiceItem["icon"], React.ReactNode> = {
  chat: <IconChat size={20} />,
  documents: <IconDocument size={20} />,
  contracts: <IconContract size={20} />,
};

function RelatedServicesSection({ items }: { items: RelatedServiceItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl bg-surface border border-divider/60 p-5 tablet:p-6 shadow-sm">
      <h3 className="text-h4 text-on-surface font-semibold mb-4 flex items-center gap-2">
        <span className="block h-1.5 w-8 rounded-full bg-primary-600" />
        خدمات مرتبط LEGALIR
      </h3>
      <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
        {items.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className="flex flex-col gap-2 rounded-xl border border-divider/60 p-4 bg-surface-container hover:border-primary/40 hover:shadow-elevation-1 transition-all duration-200 group"
          >
            <span className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm group-hover:scale-110 transition-transform duration-200">
              {serviceIconMap[item.icon]}
            </span>
            <p className="text-body-2 text-on-surface font-semibold group-hover:text-primary transition-colors">
              {item.title}
            </p>
            <p className="text-caption text-muted leading-relaxed">{item.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// Not Found State
// ============================================================

function NotFoundState({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center" dir="rtl">
      <div className="h-20 w-20 rounded-2xl bg-error-container border border-error/20 flex items-center justify-center mb-6">
        <SvgIcon size={36} className="text-error">
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </SvgIcon>
      </div>
      <h2 className="text-h2 text-on-surface mb-2">منبع حقوقی یافت نشد</h2>
      <p className="text-body-1 text-muted mb-2 max-w-md">
        منبع حقوقی با شناسه «{slug}» در کتابخانه حقوقی LEGALIR یافت نشد.
      </p>
      <p className="text-body-2 text-muted/60 mb-8 max-w-md">
        لطفاً از طریق صفحه کتابخانه حقوقی به جستجوی منابع معتبر بپردازید یا از مشاور هوش مصنوعی کمک بگیرید.
      </p>
      <div className="flex items-center gap-3">
        <Link
          href="/legal-library"
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-button font-medium hover:bg-primary-700 transition-colors active:scale-[0.98] shadow-sm"
        >
          کتابخانه حقوقی
        </Link>
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 rounded-xl border border-divider/60 bg-surface text-on-surface px-5 py-2.5 text-button font-medium hover:bg-surface-container transition-colors active:scale-[0.98]"
        >
          مشاوره با LEGALIR
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Main Page Component
// ============================================================

export default function LegalSourceDetailPage() {
  const params = useParams();
  const slug = (params?.["slug"] as string) ?? "";
  const source = getSource(slug);

  // --- Local state ---
  const [bookmarked, setBookmarked] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // --- Copy citation ---
  const handleCopyCitation = useCallback(() => {
    if (!source) return;
    const citation = `${source.title} — ${source.authority} (${source.lastUpdated})\n${source.sourceUrl ?? "لینک منبع ثبت نشده است"}`;
    navigator.clipboard
      .writeText(citation)
      .then(() => {
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      })
      .catch(() => {
        // silently fail
      });
  }, [source]);

  // --- Share ---
  const handleShare = useCallback(async () => {
    if (!source) return;
    const shareData = {
      title: source.title,
      text: `${source.title} — ${source.category}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      }
    } catch {
      // user cancelled or error — ignore
    }
  }, [source]);

  // --- Not found ---
  if (!source) {
    return (
      <div className="p-4 tablet:p-6 max-w-4xl mx-auto">
        <NotFoundState slug={slug} />
      </div>
    );
  }

  const typeBadgeStyles = sourceTypeBadgeStyles(source.sourceType);

  return (
    <div className="p-4 tablet:p-6 max-w-4xl mx-auto" dir="rtl">
      {/* ================================================================ */}
      {/* Back Link */}
      {/* ================================================================ */}
      <div className="mb-5">
        <Link
          href="/legal-library"
          className="inline-flex items-center gap-1.5 text-body-2 text-muted hover:text-on-surface transition-colors"
        >
          <IconArrowLeft size={16} className="rtl-flip" />
          بازگشت به کتابخانه حقوقی
        </Link>
      </div>

      {/* ================================================================ */}
      {/* Header Section */}
      {/* ================================================================ */}
      <header className="rounded-2xl bg-surface border border-divider/60 p-5 tablet:p-6 shadow-sm mb-5">
        {/* Badges Row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <SourceTypeBadge type={source.sourceType} />
          <VerificationBadge verified={source.verified} />
        </div>

        {/* Title */}
        <h1 className="text-h2 text-on-surface mb-3">{source.title}</h1>

        {/* Meta Row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-caption">
          {/* Category */}
          <span className="inline-flex items-center gap-1.5 text-muted">
            <SvgIcon size={14}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </SvgIcon>
            {source.category}
          </span>

          {/* Last Updated */}
          <span className="inline-flex items-center gap-1.5 text-muted">
            <IconCalendar size={14} />
            آخرین به‌روزرسانی: {source.lastUpdated}
          </span>

          {/* Authority */}
          <span className="inline-flex items-center gap-1.5 text-muted">
            <IconBuilding size={14} />
            {source.authority}
          </span>
        </div>
      </header>

      {/* ================================================================ */}
      {/* Action Buttons Row */}
      {/* ================================================================ */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        {/* Bookmark */}
        <ActionButton
          label="ذخیره"
          icon={<IconBookmark filled={bookmarked} size={18} />}
          onClick={() => setBookmarked((prev) => !prev)}
          active={bookmarked}
        />

        {/* Copy Citation */}
        <ActionButton
          label={copyFeedback ? "کپی شد" : "کپی ارجاع"}
          icon={copyFeedback ? <IconCheckCircle size={18} className="text-success" /> : <IconCopy size={18} />}
          onClick={handleCopyCitation}
        />

        {/* View Source */}
        {source.sourceUrl ? (
          <a
            href={source.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-button font-medium transition-all duration-200 touch-target border border-divider/60 bg-surface text-on-surface hover:bg-surface-container active:scale-[0.97] cursor-pointer"
          >
            <IconLinkSource size={18} />
            <span className="hidden tablet:inline">مشاهده منبع</span>
          </a>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-caption text-muted border border-divider/40 bg-surface-container/50">
            <IconLinkSource size={18} className="opacity-40" />
            لینک منبع ثبت نشده است
          </span>
        )}

        {/* Share */}
        <ActionButton
          label="اشتراک‌گذاری"
          icon={<IconShare size={18} />}
          onClick={handleShare}
        />
      </div>

      {/* ================================================================ */}
      {/* Body Sections */}
      {/* ================================================================ */}

      {/* متن / معرفی */}
      {source.text && (
        <div className="mb-5">
          <SectionBlock title="متن / معرفی">
            <div className="whitespace-pre-line">{source.text}</div>
          </SectionBlock>
        </div>
      )}

      {/* توضیح ساده */}
      {source.simpleExplanation && (
        <div className="mb-5">
          <SectionBlock title="توضیح ساده">
            <p>{source.simpleExplanation}</p>
          </SectionBlock>
        </div>
      )}

      {/* کاربرد عملی */}
      {source.practicalApplication && (
        <div className="mb-5">
          <SectionBlock title="کاربرد عملی">
            <p>{source.practicalApplication}</p>
          </SectionBlock>
        </div>
      )}

      {/* نکات مهم */}
      {source.keyPoints && source.keyPoints.length > 0 && (
        <div className="mb-5">
          <SectionBlock title="نکات مهم">
            <KeyPointsList points={source.keyPoints} />
          </SectionBlock>
        </div>
      )}

      {/* مثال */}
      {source.examples && (
        <div className="mb-5">
          <SectionBlock title="مثال">
            <div className="whitespace-pre-line">{source.examples}</div>
          </SectionBlock>
        </div>
      )}

      {/* ================================================================ */}
      {/* Related Sources Graph */}
      {/* ================================================================ */}
      {source.relationships.length > 0 && (
        <div className="mb-5">
          <RelatedSourcesGraph currentSlug={slug} relationships={source.relationships} />
        </div>
      )}

      {/* ================================================================ */}
      {/* Related Content */}
      {/* ================================================================ */}
      {source.relatedContent.length > 0 && (
        <div className="mb-5">
          <RelatedContentSection items={source.relatedContent} />
        </div>
      )}

      {/* ================================================================ */}
      {/* Related Services */}
      {/* ================================================================ */}
      {source.relatedServices.length > 0 && (
        <div className="mb-5">
          <RelatedServicesSection items={source.relatedServices} />
        </div>
      )}

      {/* ================================================================ */}
      {/* Bottom Spacer */}
      {/* ================================================================ */}
      <div className="h-8" />
    </div>
  );
}
