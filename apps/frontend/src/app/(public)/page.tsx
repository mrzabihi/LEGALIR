import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CTASection } from "@/components/public/CTASection";
import { AIDisclaimer } from "@/components/public/AIDisclaimer";
import { HeroTitle } from "@/components/public/HeroTitle";
import { LandingReveal } from "@/components/public/LandingReveal";
import { LegalTopicsSection, type LegalTopic } from "@/components/public/LegalTopicsSection";
import { PromoPanel } from "@/components/shared";
import { JudicialServiceZone } from "@/components/judicial/judicial-service-zone";
import { readBlog, isBlogPostPubliclyVisible } from "@/lib/legal-library-db";
import { SITE_URL, absoluteUrl } from "@/lib/site";
import { toPersianDate, toPersianDigits } from "@/lib/persian-utils";
import {
  IconChat,
  IconDocument,
  IconContract,
  IconSearch,
  IconCheckCircle,
  IconShield,
  IconBalance,
  IconArrowBack,
  IconMemory,
  IconStar,
  IconLawBook,
  IconCategory,
  IconCalendar,
  IconHandshake,
  IconChevronLeft,
} from "@/lib/icons";

export const metadata: Metadata = {
  // `absolute` opts out of the root `%s | لیگالیر` template — without it the
  // brand is appended twice ("… | لیگالیر | لیگالیر").
  title: { absolute: "لیگالیر | دستیار هوشمند حقوقی ایران" },
  description:
    "دستیار هوشمند حقوقی ایران — پلتفرم تخصصی تحلیل حقوقی با هوش مصنوعی، آموزش‌دیده بر نظام حقوقی ایران شامل قانون اساسی، مدنی، کیفری، تجارت، خانواده، کار، مالیات و هزاران پرونده واقعی",
  alternates: { canonical: "/" },
};

const statsItems = [
  { value: "۷+", label: "خدمات اصلی", icon: IconCheckCircle },
  { value: "۲۰+", label: "حوزه حقوقی", icon: IconBalance },
  { value: "۲۴/۷", label: "دسترسی آنلاین", icon: IconShield },
];

const highlights = [
  {
    icon: IconChat,
    title: "مشاوره حقوقی با هوش مصنوعی",
    description:
      "پرسش حقوقی خود را به زبان ساده مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید",
    href: "/auth/mobile?intent=chat",
    badge: "اطلاعات AI",
    badgeBg: "bg-info-50 text-info-600 border-info-100",
  },
  {
    icon: IconDocument,
    title: "تحلیل هوشمند اسناد",
    description:
      "قراردادها و اسناد حقوقی خود را بارگذاری کنید و بندهای پرریسک با گزارش تحلیل دقیق و شناسایی ریسک دریافت کنید",
    href: "/auth/mobile?intent=document",
    badge: "کمک حقوقی",
    badgeBg: "bg-success-50 text-success-600 border-success-100",
  },
  {
    icon: IconContract,
    title: "تولید پیش‌نویس قرارداد",
    description:
      "با پاسخ به پرسش‌نامه گام‌به‌گام، پیش‌نویس قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید",
    href: "/auth/mobile?intent=contract",
    badge: "پیش‌نویس خودکار",
    badgeBg: "bg-secondary-50 text-secondary-600 border-secondary-100",
  },
];

const howItWorksSteps = [
  {
    number: "۰۱",
    icon: IconChat,
    title: "طرح موضوع حقوقی",
    description:
      "موضوع یا پرسش حقوقی خود را به زبان ساده و محاوره‌ای توضیح دهید — مانند صحبت با یک مشاور",
  },
  {
    number: "۰۲",
    icon: IconMemory,
    title: "تحلیل تخصصی هوش مصنوعی",
    description:
      "هسته تخصصی لیگالیر با استناد به قوانین، آرای وحدت رویه و بخشنامه‌های معتبر، موضوع شما را تحلیل می‌کند",
  },
  {
    number: "۰۳",
    icon: IconCheckCircle,
    title: "دریافت راهنمایی",
    description:
      "تحلیل تفصیلی با ارجاع دقیق دریافت کنید و در صورت نیاز، برای مشاوره تخصصی به وکیل ارجاع شوید",
  },
];

// Presentation-only accents for the transparency trio (gold → green → navy).
// The copy is untouched; the tokens make the three cards read as one set.
const distinctions = [
  {
    icon: IconShield,
    title: "مدل زبانی تخصصی حقوقی",
    description:
      "هسته هوشمند لیگالیر بر پایه منابع حقوقی ساختاریافته، قوانین و آرای قضایی آموزش دیده و تحلیل ساختاریافته ارائه می‌دهد.",
    accentBar: "bg-gradient-to-l from-warning-500 via-warning-400 to-warning-200",
    iconChip: "bg-warning-50 text-warning-700 ring-1 ring-warning-200",
  },
  {
    icon: IconBalance,
    title: "منابع معتبر حقوقی",
    description:
      "هر پاسخ با ارجاع دقیق به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه است. وضعیت اعتبار هر منبع (معتبر / اصلاح‌شده / منسوخ) به‌روشنی مشخص شده است.",
    accentBar: "bg-gradient-to-l from-success-500 via-success-400 to-success-200",
    iconChip: "bg-success-50 text-success-700 ring-1 ring-success-200",
  },
  {
    icon: IconSearch,
    title: "مسیر شفاف به وکیل",
    description:
      "در موضوعات حساس، لیگالیر مسیر ارتباط با وکلای متخصص و تأییدشده را فراهم می‌کند تا تصمیم‌گیری حقوقی با اطمینان بیشتری انجام شود.",
    accentBar: "bg-gradient-to-l from-primary-500 via-primary-400 to-primary-200",
    iconChip: "bg-primary-container text-primary ring-1 ring-primary-100",
  },
];

// ================================================================
// Real Legal Topic Examples (نمونه موضوعات پرکاربرد حقوقی)
// ================================================================
const legalTopics: LegalTopic[] = [
  {
    icon: "🏠",
    title: "مالک و مستأجر",
    description: "قوانین اجاره، تخلیه، تعدیل اجاره‌بها، ودیعه و تعهدات طرفین",
    keywords: ["اجاره", "تخلیه", "ودیعه", "سرقفلی"],
  },
  {
    icon: "💰",
    title: "مطالبه وجه و خسارت",
    description: "چک برگشتی، سفته، خسارت تأخیر تأدیه، وجه‌الالتزام قراردادی",
    keywords: ["چک", "سفته", "خسارت", "تأخیر تأدیه"],
  },
  {
    icon: "📝",
    title: "قراردادها و تعهدات",
    description: "تنظیم، بررسی و تفسیر قراردادهای ملکی، تجاری، پیمانکاری و استخدام",
    keywords: ["قرارداد", "تعهدات", "فسخ", "وجه‌الالتزام"],
  },
  {
    icon: "👨‍👩‍👧",
    title: "حقوق خانواده",
    description: "ازدواج، طلاق، مهریه، نفقه، حضانت، ارث و وصیت",
    keywords: ["مهریه", "طلاق", "حضانت", "ارث"],
  },
  {
    icon: "🏢",
    title: "شرکت‌ها و تجارت",
    description: "ثبت شرکت، اساسنامه، سهام، قراردادهای تجاری، ورشکستگی",
    keywords: ["شرکت", "تجارت", "سهام", "ورشکستگی"],
  },
  {
    icon: "⚖️",
    title: "آیین دادرسی و دعاوی",
    description: "تنظیم دادخواست، اظهارنامه، لایحه دفاعیه و پیگیری پرونده",
    keywords: ["دادخواست", "اظهارنامه", "لایحه", "دادرسی"],
  },
];

// ================================================================
// Sample Q&A — Real Legal Questions لیگالیر Can Answer
// ================================================================
const sampleQuestions = [
  {
    question: "اگر مستأجر اجاره را پرداخت نکند، صاحبخانه چه اقداماتی می‌تواند انجام دهد؟",
    category: "مالک و مستأجر",
    sourceRef: "ماده ۴۹۴ قانون مدنی",
    icon: IconChat,
  },
  {
    question: "چک برگشتی دارم — چطور می‌توانم وجه آن را مطالبه کنم؟",
    category: "مطالبه وجه",
    sourceRef: "قانون صدور چک",
    icon: IconChat,
  },
  {
    question: "وجه‌الالتزام در قرارداد چیست و چه زمانی قابل مطالبه است؟",
    category: "قراردادها",
    sourceRef: "ماده ۲۳۰ قانون مدنی",
    icon: IconChat,
  },
  {
    question: "برای درخواست طلاق توافقی چه مدارکی لازم است و چقدر طول می‌کشد؟",
    category: "خانواده",
    sourceRef: "قانون حمایت خانواده",
    icon: IconChat,
  },
  {
    question: "خسارت تأخیر تأدیه چطور محاسبه می‌شود و نرخ آن چقدر است؟",
    category: "خسارت",
    sourceRef: "ماده ۵۲۲ آیین دادرسی مدنی",
    icon: IconChat,
  },
  {
    question: "برای تنظیم یک قرارداد اجاره مطمئن چه نکاتی را باید رعایت کنم؟",
    category: "قراردادها",
    sourceRef: "قانون روابط موجر و مستأجر",
    icon: IconChat,
  },
];

// ================================================================
// Legal Sources — Key References
// ================================================================
const keySources = [
  {
    title: "قانون مدنی",
    description: "منبع اصلی حقوق خصوصی ایران — شامل احکام عقود، تعهدات، اموال و مالکیت",
    articles: "۱۳۳۵ ماده",
    year: "۱۳۰۷",
  },
  {
    title: "آیین دادرسی مدنی",
    description: "قواعد شکلی رسیدگی به دعاوی حقوقی در دادگاه‌های عمومی و انقلاب",
    articles: "۵۲۹ ماده",
    year: "۱۳۷۹",
  },
  {
    title: "قانون تجارت",
    description: "مقررات مربوط به شرکت‌های تجاری، اسناد تجاری، ورشکستگی و امور بازرگانی",
    articles: "۶۰۰ ماده",
    year: "۱۳۱۱",
  },
  {
    title: "آرای وحدت رویه",
    description: "تصمیمات هیأت عمومی دیوان عالی کشور برای ایجاد رویه واحد قضایی",
    articles: "۸۵۰+ رأی",
    year: "جاری",
  },
];

// ================================================================
// Blog preview — pulled from the real Legal Library / Blog JSON-DB
// ================================================================
const blogPreviewPosts = (() => {
  const { items, details } = readBlog();
  return items
    .filter((i) => isBlogPostPubliclyVisible(i, details[i.slug]))
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
    })
    .slice(0, 3);
})();

// Organization + WebSite structured data. Only verifiable facts are emitted —
// brand name, canonical URL, logo and the public support email (as used on
// /contact). No address, phone, rating or social profile is invented; add
// those once the real values are confirmed.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "لیگالیر",
      alternateName: "LEGALIR",
      url: SITE_URL,
      logo: absoluteUrl("/legalir-logo.png"),
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "info@legalir.ir",
        availableLanguage: ["fa"],
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "لیگالیر",
      url: SITE_URL,
      inLanguage: "fa-IR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function LandingPage() {
  const lastStep = howItWorksSteps.length - 1;

  return (
    <div id="main-content">
      <script
        type="application/ld+json"
        // JSON.stringify escapes the object; the only free-text values are the
        // brand name and email, which contain no "<" or ">".
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* One client island reveals the [data-reveal] nodes below on first
          scroll-in; it is a no-op for no-JS visitors (see LandingReveal). */}
      <LandingReveal />

      {/* ============================================================
          HERO — photographic backdrop + procedural brand light
          ============================================================ */}
      <section className="relative isolate overflow-hidden bg-primary-800">
        {/* Backdrop: photograph under a green→navy scrim (the scrim, not the
            gradient, is what keeps the white copy at WCAG AA). The artwork
            drifts ~4% as the first screen scrolls away — decorative only,
            CSS scroll-driven, and silent where unsupported. */}
        <div className="absolute inset-0" aria-hidden="true">
          <div className="landing-parallax absolute inset-0">
            <Image
              src="/assets/legalir-landing-hero.webp"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(29,98,78,0.62)_0%,rgba(17,34,44,0.68)_55%,rgba(11,18,32,0.82)_100%)]" />
          </div>

          {/* Procedural brand light — three very low-opacity pools (brand
              green, gold, deep teal) on one oversized sheet that drifts a
              couple of percent over ~30s. Static on phones and under
              reduced motion. */}
          <div
            className="landing-aurora absolute -inset-[18%] opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(38% 42% at 24% 28%, rgba(29,98,78,0.55), transparent 70%)," +
                "radial-gradient(30% 34% at 78% 16%, rgba(198,155,56,0.20), transparent 72%)," +
                "radial-gradient(44% 46% at 64% 92%, rgba(34,46,45,0.65), transparent 70%)",
            }}
          />

          {/* Geometric dot-grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0)`,
              backgroundSize: "40px 40px",
            }}
          />

          {/* Vignette — sinks the edges so the centred copy keeps its focus. */}
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_35%,transparent_45%,rgba(5,10,20,0.45)_100%)]" />

          {/* Gold hairline seam into the white stats bar. */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-secondary-400/70 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-14 text-center mobile-l:pb-20 mobile-l:pt-16 tablet:pb-24 tablet:pt-20">
          {/* Logo */}
          <div className="mb-5 flex justify-center tablet:mb-7">
            <div className="relative h-32 w-32 mobile-l:h-36 mobile-l:w-36 tablet:h-44 tablet:w-44">
              <Image
                src="/legalir-logo-bronze.png"
                alt="LEGALIR"
                fill
                sizes="(min-width: 600px) 176px, 144px"
                className="object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.30)] transition-transform duration-500 hover:scale-[1.04] hover:drop-shadow-[0_8px_32px_rgba(212,175,55,0.40)] motion-reduce:transition-none motion-reduce:hover:scale-100"
                priority
              />
            </div>
          </div>

          {/* AI disclaimer badge */}
          <div className="mb-5 flex justify-center tablet:mb-6">
            <AIDisclaimer compact />
          </div>

          {/* Main heading — one-shot typewriter reveal (see HeroTitle).
              The solid white copy, size and weight are unchanged; the
              line-height is tuned so the two-line mobile lockup keeps an
              even rhythm. */}
          <HeroTitle
            className="text-[34px] font-extrabold leading-[1.25] tracking-tight text-white cursor-default select-none mobile-l:text-[38px] tablet:text-[56px] tablet:leading-tight"
            text="دستیار هوشمند حقوقی ایران"
          />

          {/* Subheading */}
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-body-1 leading-loose text-white/85 tablet:mt-6 tablet:text-lg tablet:leading-relaxed">
            خدمات تخصصی حقوقی با بهره‌گیری از هوش مصنوعی، منابع حقوقی و مدل زبانی
            تخصصی لیگالیر — تحلیل ساختاریافته پرونده‌ها، قراردادها و مسائل حقوقی
          </p>

          {/* CTAs — one primary (solid light) and one secondary (ghost).
              Identical heights and touch targets on every width. */}
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 mobile-s:flex-row mobile-s:items-center tablet:mt-10">
            <Link
              href="/auth/mobile?intent=chat"
              className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-large bg-white px-8 text-button font-semibold text-primary-800 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/40 transition-[background-color,box-shadow,transform] duration-300 hover:bg-secondary-50 hover:shadow-[0_14px_34px_-12px_rgba(212,175,55,0.55)] active:scale-[0.98] touch-target motion-reduce:transition-none mobile-s:w-auto"
            >
              شروع مشاوره حقوقی
            </Link>
            <Link
              href="/features"
              className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-large border border-white/30 bg-white/[0.06] px-8 text-button text-white backdrop-blur-sm transition-[background-color,border-color,transform] duration-300 hover:border-white/50 hover:bg-white/15 active:scale-[0.98] touch-target motion-reduce:transition-none mobile-s:w-auto"
            >
              مشاهده قابلیت‌ها
            </Link>
          </div>

          {/* Disclaimer note */}
          <p className="mt-6 flex items-center justify-center gap-1.5 text-caption text-secondary-200">
            <IconArrowBack size={14} className="shrink-0 text-secondary-300" />
            دانش حقوقی، تحلیل هوشمند و منابع مستند؛ یکپارچه در لیگالیر
          </p>
        </div>
      </section>

      {/* ============================================================
          STATS BAR — trust ribbon under the hero
          ============================================================ */}
      <section className="relative overflow-hidden border-b border-divider bg-surface">
        <div className="absolute inset-0 bg-geometric-pattern pointer-events-none" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-1 divide-y divide-divider tablet:grid-cols-3 tablet:divide-y-0">
            {statsItems.map((stat, i) => (
              <div
                key={stat.label}
                data-reveal
                data-reveal-delay={i > 0 ? String(i) : undefined}
                className={`flex items-center justify-center gap-3 px-4 py-5 tablet:border-s tablet:border-divider tablet:py-7 ${
                  i === 0 ? "tablet:border-s-0" : ""
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-large bg-secondary-container">
                  <stat.icon size={20} className="text-secondary-600" />
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="text-[28px] font-bold leading-none text-on-surface tabular-nums tablet:text-[32px]">
                    {stat.value}
                  </span>
                  <span className="text-body-2 text-neutral-500">{stat.label}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SERVICES — "خدمات هوشمند لیگالیر"
          ============================================================ */}
      <section className="mx-auto max-w-6xl px-4 py-20 tablet:py-24">
        <div className="mb-12 text-center" data-reveal>
          {/* Persian LEGALIR wordmark replaces the old heading text.
              A breathing halo sits behind it and it lifts on hover. */}
          <div className="brand-logo-glow mb-3">
            <img
              src="/legalir-logo-fa-type.png"
              alt="خدمات هوشمند لیگالیر"
              className="h-14 tablet:h-16 w-auto max-w-[280px] object-contain"
            />
          </div>
          <p className="mx-auto max-w-xl text-body-1 leading-relaxed text-neutral-500">
            سه سرویس تخصصی مبتنی بر هوش مصنوعی حقوقی — آموزش‌دیده بر نظام حقوقی ایران
          </p>
        </div>

        {/* Two balanced columns on tablet (the third tile closes the row at
            full width), three equal columns on desktop. */}
        <div className="grid gap-6 tablet:grid-cols-2 desktop:grid-cols-3">
          {highlights.map((item, i) => (
            <Link
              key={item.title}
              href={item.href}
              data-reveal
              data-reveal-delay={i > 0 ? String(i) : undefined}
              className={`group relative flex flex-col overflow-hidden rounded-large border border-divider bg-surface p-6 shadow-elevation-1 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-elevation-8 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                i === highlights.length - 1 ? "tablet:col-span-2 desktop:col-span-1" : ""
              }`}
            >
              {/* Top accent — a hairline that warms and widens on hover. */}
              <span
                className="absolute inset-x-0 top-0 h-[3px] origin-center scale-x-[0.18] bg-gradient-to-l from-primary-500 via-primary-400 to-secondary-400 opacity-60 transition-[transform,opacity] duration-300 group-hover:scale-x-100 group-hover:opacity-100 motion-reduce:transition-none"
                aria-hidden="true"
              />

              <div className="mb-5 flex items-start justify-between gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-large bg-primary-container text-primary ring-1 ring-primary-100 transition-colors duration-300 group-hover:bg-primary-700 group-hover:text-white group-hover:ring-primary-700 motion-reduce:transition-none">
                  <item.icon size={24} />
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-caption ${item.badgeBg}`}
                >
                  {item.badge}
                </span>
              </div>

              <h3 className="mb-2 text-h3 text-on-surface transition-colors duration-200 group-hover:text-primary">
                {item.title}
              </h3>
              <p className="text-body-2 leading-relaxed text-neutral-500">
                {item.description}
              </p>

              {/* Quiet "enter" affordance — no new copy, hidden from AT. */}
              <div className="mt-auto flex justify-end pt-6" aria-hidden="true">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-divider text-primary transition-[background-color,border-color,transform] duration-300 group-hover:-translate-x-0.5 group-hover:border-primary-200 group-hover:bg-primary-50 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
                  <IconChevronLeft size={18} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ============================================================
          JUDICIAL DOCUMENTS — «تنظیم دادخواست و شکواییه تخصصی»
          ============================================================
          The drafting family is not a marketing block: each card links into
          the real, resumable wizard. Visibility, status and copy come from
          the admin-managed service rows (surfaces.home), and anonymous
          visitors are routed through login back to the same wizard URL. */}
      <JudicialServiceZone
        surface="home"
        mode="public"
        className="mx-auto max-w-6xl px-4 pb-20 tablet:pb-24"
        footer={
          <p className="mt-4 text-caption leading-6 text-neutral-500">
            پیش‌نویس‌ها برای بازبینی خودتان و وکیل است؛ لیگالیر هیچ سندی را در مرجع قضایی ثبت،
            ارسال یا ابلاغ نمی‌کند.
          </p>
        }
      />

      {/* ============================================================
          SAMPLE Q&A — "لیگالیر چه سوالاتی را پاسخ می‌دهد؟"
          ============================================================ */}
      <section className="border-y border-divider bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-20 tablet:py-24">
          <div className="mb-12 text-center" data-reveal>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-secondary-200 bg-secondary-100 px-4 py-1.5 text-caption font-medium text-secondary-700">
              <IconStar size={16} className="text-secondary-600" />
              نمونه پرسش‌های واقعی
            </div>
            <h2 className="mb-3 text-h2 text-on-surface">لیگالیر چه سوالاتی را پاسخ می‌دهد؟</h2>
            <p className="mx-auto max-w-2xl text-body-1 leading-relaxed text-neutral-500">
              اینها نمونه‌هایی از پرسش‌های واقعی حقوقی هستند که می‌توانید از لیگالیر بپرسید.
              هر پاسخ همراه با استناد دقیق به مواد قانونی و آرای قضایی ارائه می‌شود.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-4 tablet:grid-cols-2">
            {sampleQuestions.map((item, i) => (
              <Link
                key={item.question}
                href="/auth/mobile?intent=chat"
                data-reveal
                data-reveal-delay={i % 2 === 1 ? "1" : undefined}
                className="group flex items-start gap-4 rounded-large border border-divider bg-surface p-5 shadow-elevation-1 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-elevation-3 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-primary-container text-primary transition-colors duration-300 group-hover:bg-primary-700 group-hover:text-white motion-reduce:transition-none">
                  <item.icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mb-2 block text-body-2 leading-relaxed text-on-surface transition-colors group-hover:text-primary">
                    {item.question}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-caption text-neutral-500">
                      {item.category}
                    </span>
                    <span className="text-caption font-medium text-secondary-700">
                      {item.sourceRef}
                    </span>
                  </span>
                </span>
                <span
                  className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary opacity-50 transition-[opacity,transform] duration-300 group-hover:translate-x-0.5 group-hover:opacity-100 motion-reduce:transition-none tablet:flex"
                  aria-hidden="true"
                >
                  <IconChevronLeft size={18} />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-10 text-center" data-reveal>
            <Link
              href="/auth/mobile?intent=chat"
              className="inline-flex items-center gap-2 rounded-large bg-primary-700 px-8 py-3.5 text-button font-semibold text-white shadow-elevation-2 transition-[background-color,box-shadow,transform] duration-300 hover:bg-primary-800 hover:shadow-elevation-8 active:scale-[0.98] touch-target motion-reduce:transition-none"
            >
              <IconChat size={20} />
              پرسش خود را مطرح کنید
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          LEGAL TOPICS — "موضوعات پرکاربرد حقوقی"
          The section (blurred photographic backdrop + frosted-glass topic
          cards with a pointer/scroll light) lives in its own client
          component; the copy stays here as the single source of truth.
          ============================================================ */}
      <LegalTopicsSection topics={legalTopics} />

      {/* ============================================================
          HOW IT WORKS — 3-Step Connected Diagram
          ============================================================ */}
      <section className="border-y border-divider bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-20 tablet:py-24">
          <div className="mb-14 text-center" data-reveal>
            <h2 className="mb-3 text-h2 text-on-surface">لیگالیر چطور کار می‌کند؟</h2>
            <p className="mx-auto max-w-xl text-body-1 leading-relaxed text-neutral-500">
              سه گام ساده برای دریافت تحلیل حقوقی — از طرح موضوع تا دریافت راهنمایی تخصصی
            </p>
          </div>

          <div className="relative">
            {/* Connector — one line through the circles' centres, drawn as
                the diagram scrolls in. Decorative; hidden from AT. */}
            <div
              className="landing-step-line absolute inset-x-[16.67%] top-7 hidden h-[2px] bg-gradient-to-l from-primary-100 via-primary-200 to-primary-100 tablet:block"
              data-reveal
              aria-hidden="true"
            />

            <div className="flex flex-col justify-between gap-8 tablet:flex-row tablet:items-start tablet:gap-0">
              {howItWorksSteps.map((step, idx) => (
                <div
                  key={step.number}
                  data-reveal
                  data-reveal-delay={idx > 0 ? String(idx) : undefined}
                  className="relative flex items-start gap-4 tablet:w-1/3 tablet:flex-col tablet:items-center tablet:gap-0 tablet:text-center"
                >
                  {/* Mobile connector: each step draws the segment down to
                      the next one, so the line never trails past the end. */}
                  {idx < lastStep && (
                    <span
                      className="landing-step-line-v absolute -bottom-8 start-7 top-14 w-[2px] bg-primary-100 tablet:hidden"
                      aria-hidden="true"
                    />
                  )}

                  {/* Step number circle */}
                  <div className="relative z-10 shrink-0">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-600 to-primary-800 text-h3 font-bold text-white shadow-elevation-3 ring-4 ring-primary-50">
                      {step.number}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 tablet:mt-5">
                    <div className="mb-3 hidden h-10 w-10 items-center justify-center rounded-medium bg-primary-container text-primary tablet:mx-auto tablet:flex">
                      <step.icon size={22} />
                    </div>

                    <h3 className="mb-1.5 text-h3 text-on-surface tablet:mb-2">
                      {step.title}
                    </h3>
                    <p className="max-w-[280px] text-body-2 leading-relaxed text-neutral-500 tablet:mx-auto">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          HUMAN LAWYER — editorial promo panel
          ============================================================
          Placed after «چطور کار میکند» — the reader has just seen the
          AI path end in «ارجاع به وکیل», so this is the natural moment
          to offer the human one. The artwork is square and carries the
          LEGALIR wordmark, so the copy beside it never repeats the
          brand as a second heading. */}
      <section className="mx-auto max-w-6xl px-4 py-20 tablet:py-24" data-reveal>
        <PromoPanel
          art="one"
          eyebrow="وکیل انسانی"
          title="وقتی موضوع به بررسی تخصصی نیاز دارد"
          message="لیگالیر مسیر ارتباط با وکلای متخصص و تأییدشده را فراهم می‌کند — انتخاب وکیل بر اساس تخصص، شهر و بودجه، با شفافیت کامل در هزینه و سابقه."
          cta="مشاهده وکلای تأییدشده"
          href="/lawyers"
          icon={IconHandshake}
          imageSide="end"
          size="feature"
        />
      </section>

      {/* ============================================================
          LEGAL SOURCES — "منابع حقوقی تحت پوشش"
          ============================================================ */}
      <section className="border-t border-divider">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-20 tablet:pb-24 tablet:pt-24">
          <div className="mb-12 text-center" data-reveal>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-success-100 bg-success-50 px-4 py-1.5 text-caption font-medium text-success-700">
              <IconLawBook size={16} className="text-success-600" />
              منابع معتبر حقوقی
            </div>
            <h2 className="mb-3 text-h2 text-on-surface">منابع حقوقی تحت پوشش</h2>
            <p className="mx-auto max-w-2xl text-body-1 leading-relaxed text-neutral-500">
              لیگالیر بر پایه قوانین، مقررات و آرای معتبر نظام حقوقی ایران آموزش دیده است.
              هر پاسخ با ارجاع دقیق به منبع اصلی همراه می‌باشد.
            </p>
          </div>

          <div className="grid gap-5 tablet:grid-cols-2 desktop:grid-cols-4">
            {keySources.map((source, i) => (
              <div
                key={source.title}
                data-reveal
                data-reveal-delay={i > 0 ? String(i) : undefined}
                className="group relative flex flex-col overflow-hidden rounded-large border border-divider bg-surface p-6 shadow-elevation-1 card-lift"
              >
                {/* Gold→navy seam along the top edge. */}
                <span
                  className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-l from-secondary-400 via-secondary-300 to-primary-400 opacity-80"
                  aria-hidden="true"
                />

                <h3 className="mb-2 text-h3 text-on-surface">{source.title}</h3>
                <p className="flex-1 text-body-2 leading-relaxed text-neutral-500">
                  {source.description}
                </p>

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-divider pt-4">
                  <span className="rounded-full bg-secondary-100 px-3 py-1 text-caption font-medium text-secondary-700">
                    {source.articles}
                  </span>
                  <span className="text-caption text-neutral-400">
                    مصوب {source.year}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          BLOG PREVIEW — "مجله و آموزش حقوقی لیگالیر"
          ============================================================ */}
      <section className="border-t border-divider">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-20 tablet:pb-24 tablet:pt-24">
          <div className="mb-12 text-center" data-reveal>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-secondary-200 bg-secondary-50 px-4 py-1.5 text-caption font-medium text-secondary-700">
              <IconLawBook size={16} className="text-secondary-600" />
              مجله و آموزش حقوقی لیگالیر
            </div>
            <h2 className="mb-3 text-h2 text-on-surface">مجله و آموزش حقوقی لیگالیر</h2>
            <p className="mx-auto max-w-xl text-body-1 leading-relaxed text-neutral-500">
              راهنماهای کاربردی، قوانین، آرای مهم و تحلیل موضوعات حقوقی — بر پایه منابع
              ساختاریافته حقوقی
            </p>
          </div>

          <div className="grid gap-6 tablet:grid-cols-3">
            {blogPreviewPosts.map((post, i) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                data-reveal
                data-reveal-delay={i > 0 ? String(i) : undefined}
                className="group flex flex-col overflow-hidden rounded-large border border-divider bg-surface shadow-elevation-1 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-elevation-8 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <div className="flex items-center justify-between gap-2 border-b border-divider px-5 pb-3 pt-5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-secondary-200 bg-secondary-50 px-2.5 py-0.5 text-caption text-secondary-700">
                    <IconCategory size={12} />
                    {post.category}
                  </span>
                  <span className="shrink-0 text-caption text-neutral-400 tabular-nums">
                    {toPersianDigits(post.readingTime)} دقیقه مطالعه
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="mb-2 line-clamp-2 text-h3 leading-snug text-on-surface transition-colors group-hover:text-primary">
                    {post.titleFa}
                  </h3>
                  <p className="mb-4 line-clamp-3 flex-1 text-body-2 leading-relaxed text-neutral-500">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-2 text-caption text-neutral-400">
                    <IconCalendar size={14} />
                    <span>{toPersianDate(post.publishedAt)}</span>
                    <span className="ms-auto inline-flex items-center gap-1 font-medium text-primary">
                      مطالعه مقاله
                      <IconChevronLeft
                        size={14}
                        className="transition-transform duration-300 group-hover:-translate-x-0.5 motion-reduce:transition-none"
                      />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-10 text-center" data-reveal>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-large border border-primary-300 px-8 py-3.5 text-button font-semibold text-primary-700 transition-[background-color,border-color,transform] duration-300 hover:border-primary-400 hover:bg-primary-50 active:scale-[0.98] touch-target motion-reduce:transition-none"
            >
              مشاهده همه مطالب وبلاگ
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          DISTINCTIONS — "شفافیت در خدمات"
          ============================================================ */}
      <section className="border-y border-divider bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-20 tablet:py-24">
          <div className="mb-12 text-center" data-reveal>
            <h2 className="mb-3 text-h2 text-on-surface">شفافیت در خدمات</h2>
            <p className="mx-auto max-w-xl text-body-1 leading-relaxed text-neutral-500">
              لیگالیر مرز بین هوش مصنوعی، منابع معتبر حقوقی و وکیل متخصص را شفاف می‌کند
            </p>
          </div>

          <div className="grid gap-6 tablet:grid-cols-3">
            {distinctions.map((item, i) => (
              <div
                key={item.title}
                data-reveal
                data-reveal-delay={i > 0 ? String(i) : undefined}
                className="group relative flex h-full flex-col overflow-hidden rounded-large border border-divider bg-surface p-6 shadow-elevation-1 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-elevation-4 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className={`absolute inset-x-0 top-0 h-1 ${item.accentBar}`} aria-hidden="true" />

                <div
                  className={`mb-5 flex h-11 w-11 items-center justify-center rounded-medium ${item.iconChip}`}
                >
                  <item.icon size={22} />
                </div>
                <h3 className="mb-2 text-h3 text-on-surface">{item.title}</h3>
                <p className="text-body-2 leading-relaxed text-neutral-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          AI DISCLAIMER — Full
          ============================================================ */}
      <section className="mx-auto max-w-6xl px-4 py-10 tablet:py-12" data-reveal>
        <AIDisclaimer />
      </section>

      {/* ============================================================
          CTA SECTION
          ============================================================ */}
      <CTASection />
    </div>
  );
}
