import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { AIDisclaimer } from "@/components/public/AIDisclaimer";
import { CTASection } from "@/components/public/CTASection";
import { HeroAnalysisVisual } from "@/components/public/landing/hero-analysis-visual";
import { LandingStartCard } from "@/components/public/landing/landing-start-card";
import { HeroTitle } from "@/components/public/HeroTitle";
import { LegalTopicsSection } from "@/components/public/LegalTopicsSection";
import { LandingServices } from "@/components/public/landing/landing-services";
import { JudicialServiceZone } from "@/components/judicial/judicial-service-zone";
import { readBlog, isBlogPostPubliclyVisible } from "@/lib/legal-library-db";
import { SITE_URL, absoluteUrl } from "@/lib/site";
import { toPersianDate, toPersianDigits } from "@/lib/persian-utils";
import {
  IconArrowBack,
  IconBalance,
  IconCalendar,
  IconCategory,
  IconChat,
  IconCheckCircle,
  IconChevronLeft,
  IconHandshake,
  IconLawBook,
  IconMemory,
  IconSearch,
  IconShield,
  IconStar,
} from "@/lib/icons";

export const metadata: Metadata = {
  // `absolute` opts out of the root `%s | لیگالیر` template — without it the
  // brand is appended twice ("… | لیگالیر | لیگالیر").
  title: { absolute: "لیگالیر | دستیار هوشمند حقوقی ایران" },
  description:
    "دستیار هوشمند حقوقی ایران — پلتفرم تخصصی تحلیل حقوقی با هوش مصنوعی، آموزش‌دیده بر نظام حقوقی ایران شامل قانون اساسی، مدنی، کیفری، تجارت، خانواده، کار، مالیات و هزاران پرونده واقعی",
  alternates: { canonical: "/" },
};

// ================================================================
// Content — carried over from the previous landing page. The copy was
// not rewritten, no claim was added, and every CTA points at the same
// URL as before. Only the presentation around this data changed.
// ================================================================

const statsItems = [
  { value: "۷+", label: "خدمات اصلی", icon: IconCheckCircle },
  { value: "۲۰+", label: "حوزه حقوقی", icon: IconBalance },
  { value: "۲۴/۷", label: "دسترسی آنلاین", icon: IconShield },
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

const distinctions = [
  {
    icon: IconShield,
    title: "مدل زبانی تخصصی حقوقی",
    description:
      "هسته هوشمند لیگالیر بر پایه منابع حقوقی ساختاریافته، قوانین و آرای قضایی آموزش دیده و تحلیل ساختاریافته ارائه می‌دهد.",
  },
  {
    icon: IconBalance,
    title: "منابع معتبر حقوقی",
    description:
      "هر پاسخ با ارجاع دقیق به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه است. وضعیت اعتبار هر منبع (معتبر / اصلاح‌شده / منسوخ) به‌روشنی مشخص شده است.",
  },
  {
    icon: IconSearch,
    title: "مسیر شفاف به وکیل",
    description:
      "در موضوعات حساس، لیگالیر مسیر ارتباط با وکلای متخصص و تأییدشده را فراهم می‌کند تا تصمیم‌گیری حقوقی با اطمینان بیشتری انجام شود.",
  },
];

interface LegalTopic {
  icon: string;
  title: string;
  description: string;
  keywords: string[];
}

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

const sampleQuestions = [
  {
    question: "اگر مستأجر اجاره را پرداخت نکند، صاحبخانه چه اقداماتی می‌تواند انجام دهد؟",
    category: "مالک و مستأجر",
    sourceRef: "ماده ۴۹۴ قانون مدنی",
  },
  {
    question: "چک برگشتی دارم — چطور می‌توانم وجه آن را مطالبه کنم؟",
    category: "مطالبه وجه",
    sourceRef: "قانون صدور چک",
  },
  {
    question: "وجه‌الالتزام در قرارداد چیست و چه زمانی قابل مطالبه است؟",
    category: "قراردادها",
    sourceRef: "ماده ۲۳۰ قانون مدنی",
  },
  {
    question: "برای درخواست طلاق توافقی چه مدارکی لازم است و چقدر طول می‌کشد؟",
    category: "خانواده",
    sourceRef: "قانون حمایت خانواده",
  },
  {
    question: "خسارت تأخیر تأدیه چطور محاسبه می‌شود و نرخ آن چقدر است؟",
    category: "خسارت",
    sourceRef: "ماده ۵۲۲ آیین دادرسی مدنی",
  },
  {
    question: "برای تنظیم یک قرارداد اجاره مطمئن چه نکاتی را باید رعایت کنم؟",
    category: "قراردادها",
    sourceRef: "قانون روابط موجر و مستأجر",
  },
];

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

// FAQ — every answer restates a statement that already ships on this page
// (the disclaimer, the judicial note, the transparency cards or the service
// descriptions). The redesign introduces no new promise, statistic or legal
// claim; this block only makes the existing ones reachable in one place.
const faqItems = [
  {
    question: "آیا لیگالیر سند یا دادخواست را در مرجع قضایی ثبت می‌کند؟",
    answer:
      "نه. پیش‌نویس‌ها برای بازبینی خودتان و وکیل است؛ لیگالیر هیچ سندی را در مرجع قضایی ثبت، ارسال یا ابلاغ نمی‌کند.",
  },
  {
    question: "پاسخ‌ها بر چه مبنایی ارائه می‌شوند؟",
    answer:
      "لیگالیر بر پایه قوانین، مقررات و آرای معتبر نظام حقوقی ایران آموزش دیده است و هر پاسخ با ارجاع دقیق به منبع اصلی همراه است. وضعیت اعتبار هر منبع (معتبر / اصلاح‌شده / منسوخ) به‌روشنی مشخص می‌شود.",
  },
  {
    question: "اگر موضوع به تصمیم‌گیری حقوقی نیاز داشته باشد چه می‌شود؟",
    answer:
      "در موضوعات حساس، لیگالیر مسیر ارتباط با وکلای متخصص و تأییدشده را فراهم می‌کند تا تصمیم‌گیری حقوقی با اطمینان بیشتری انجام شود.",
  },
  {
    question: "برای شروع مشاوره، تحلیل سند یا تولید قرارداد چه مسیری را طی می‌کنم؟",
    answer:
      "از دکمه‌های شروع وارد مسیر ورود به حساب می‌شوید و پس از ورود، به همان سرویسی که انتخاب کرده بودید بازمی‌گردید.",
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
  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify escapes the object; the only free-text values are the
        // brand name and email, which contain no "<" or ">".
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* ============================================================
          HERO — one navy band: promise → action → proof
          ============================================================ */}
      <section className="relative isolate overflow-hidden bg-[color:var(--ln-navy-deep)] text-white">
        {/* Static brand light. No parallax and no scroll listener: the two
            pools are painted once and never animate, so the first screen
            keeps a stable LCP and a phone's GPU stays idle. */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(48% 60% at 82% 8%, rgba(29,98,78,0.55), transparent 68%)," +
              "radial-gradient(38% 48% at 12% 96%, rgba(198,155,56,0.14), transparent 72%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.45]"
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0)",
            backgroundSize: "44px 44px",
          }}
        />

        {/* Phone padding is deliberately tighter than tablet+: with the two
            CTAs stacked the hero must still leave part of the next band
            visible on a 844px viewport, or the first screen reads as a
            full-screen wall.

            Two columns from `laptop` up: the copy keeps its readable measure
            on the start side and the document visual takes the end side.
            Below `laptop` the visual drops under the CTAs, where it cannot
            push the primary action off the first screen. */}
        <div className="landing-container relative pb-8 pt-8 tablet:pb-16 tablet:pt-20 laptop:pb-20 laptop:pt-20">
          {/* The copy column takes a wider share than the visual: the <h1> is
              a fixed 25-grapheme sentence, and at 1.06fr/0.94fr the 900–1100px
              band had ~476px for it — enough to push «ایران» alone onto a
              second line (measured: h1 height doubled to 119px). At
              1.22fr/0.78fr the sentence fits on one line from 1024px up. */}
          <div className="grid items-center gap-8 tablet:gap-10 desktop:grid-cols-[minmax(0,1.22fr)_minmax(0,0.78fr)] desktop:gap-12">
            <div className="min-w-0 max-w-2xl">
              {/* The <h1> is the product name and types itself out on every
                  load (`HeroTitle`); the brief's two sentences follow verbatim
                  in two separate blocks — what the product does, then what
                  that produces.

                  Nothing here can end up missing: the heading's accessible
                  name is `sr-only` and complete on the first byte, and the
                  supporting lines are painted before their aperture opens.
                  The masks are staggered to land as the typing finishes
                  (~25 graphemes × 72ms), so the three lines read as one
                  sequence rather than three simultaneous animations. */}
              {/* `text-wrap: balance` is only a safety net: if a narrow width
                  must wrap the title, it splits it evenly instead of
                  orphaning the last word on its own line. */}
              <HeroTitle
                text="دستیار هوشمند حقوقی ایران"
                className="text-[clamp(1.875rem,1.2rem+2.6vw,3.25rem)] font-extrabold leading-[1.3] tracking-tight text-white [text-wrap:balance]"
              />
              <p
                className="ln-mask-line mt-4 max-w-xl text-[clamp(0.95rem,0.86rem+0.5vw,1.1875rem)] font-medium leading-[1.95] text-white/[0.82] [text-wrap:pretty]"
                style={{ "--ln-mask-delay": "1400ms" } as CSSProperties}
              >
                خدمات تخصصی حقوقی با بهره‌گیری از هوش مصنوعی، منابع حقوقی و
                مدل زبانی تخصصی لیگالیر
              </p>
              <p
                className="ln-mask-line mt-2 max-w-xl text-[clamp(0.875rem,0.82rem+0.3vw,1rem)] leading-[1.9] text-white/[0.68] [text-wrap:pretty]"
                style={{ "--ln-mask-delay": "1560ms" } as CSSProperties}
              >
                تحلیل ساختاریافته پرونده‌ها، قراردادها و مسائل حقوقی
              </p>

              {/* Two actions, one hierarchy: the emerald primary carries the
                  conversion, the outlined button is discovery. Both are 48px
                  tall at every width.

                  Phones stack them full-width. The row breakpoint is
                  `tablet`, not `mobile-l`: the two labels need ~371px plus
                  the 40px gutter, so at 375–430px a row pushed the second
                  button off the start edge (clipped by the hero's
                  `overflow-hidden`) — full-width stacking is both correct
                  and a bigger tap target. */}
              <div className="landing-rise landing-rise-2 mt-8 flex flex-col gap-3 tablet:mt-10 tablet:flex-row tablet:items-center">
                <Link
                  href="/auth/mobile?intent=chat"
                  className="landing-btn landing-btn--primary w-full tablet:w-auto"
                >
                  شروع مشاوره حقوقی
                  <IconChevronLeft size={18} aria-hidden="true" />
                </Link>
                <Link
                  href="/features"
                  className="landing-btn landing-btn--onDark w-full tablet:w-auto"
                >
                  مشاهده قابلیت‌ها
                </Link>
              </div>

              <p className="landing-rise landing-rise-3 mt-6 flex items-center gap-2 text-[12.5px] leading-6 text-white/60">
                <IconArrowBack
                  size={14}
                  aria-hidden="true"
                  className="shrink-0 text-[color:var(--ln-gold)]"
                />
                دانش حقوقی، تحلیل هوشمند و منابع مستند؛ یکپارچه در لیگالیر
              </p>
            </div>

            {/* The hero's visual: a legal document whose clauses are being
                segmented and anchored to sources — the product's own claim,
                drawn in code rather than a stock photo. Decorative, so it
                is `aria-hidden` and costs nothing to assistive tech. */}
            <HeroAnalysisVisual className="landing-rise landing-rise-3 mx-auto w-full max-w-md desktop:mx-0 desktop:max-w-none" />
          </div>
        </div>

        {/* Trust ribbon — the three shipped stats, merged into the hero
            instead of a separate band, so the first screen already answers
            «چقدر؟» without a second scroll. */}
        <div className="relative border-t border-white/[0.12]">
          <dl className="landing-container grid grid-cols-3 divide-x divide-x-reverse divide-white/[0.12]">
            {statsItems.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-1 px-2 py-5 text-center tablet:flex-row tablet:justify-center tablet:gap-3 tablet:py-6"
              >
                <stat.icon
                  size={18}
                  aria-hidden="true"
                  className="hidden shrink-0 text-[color:var(--ln-gold)] tablet:block"
                />
                <dt className="order-2 text-[11.5px] leading-5 text-white/60 tablet:order-none tablet:text-[13px]">
                  {stat.label}
                </dt>
                <dd className="order-1 text-[22px] font-bold leading-none tabular-nums tablet:order-none tablet:text-[26px]">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ============================================================
          START CARD — «نمی‌دانید از کجا شروع کنید؟»
          ============================================================
          Sits between the hero and the services catalog: a visitor who
          already has a problem in mind but does not know which service
          it belongs to gets one box and one button. It hands the text to
          the REAL start flow (/new → /Suggest_law); nothing is analysed
          or promised here. A guest is routed through the shipped login
          route first, with the same text waiting in the same tab. */}
      <LandingStartCard />

      {/* ============================================================
          SERVICES — the seven real services, one featured lead cell
          ============================================================
          The grid is rendered by `LandingServices`, which reads the
          service registry so the count, the names and the destinations
          always match what the product actually ships. */}
      <section className="landing-section" aria-labelledby="services-title">
        <div className="landing-container">
          <header className="max-w-2xl" data-ln-reveal="0">
            <p className="landing-eyebrow">خدمات هوشمند</p>
            <h2 id="services-title" className="landing-title mt-3">
              خدمات هوشمند لیگالیر
            </h2>
            <p className="landing-lead mt-3 max-w-2xl">
              ۷ سرویس تخصصی مبتنی بر هوش مصنوعی حقوقی؛ آموزش‌دیده بر نظام حقوقی ایران
            </p>
          </header>

          <LandingServices />
        </div>
      </section>

      {/* ============================================================
          JUDICIAL DOCUMENTS — «تنظیم دادخواست و شکواییه تخصصی»
          ============================================================
          The drafting family is not a marketing block: each card links into
          the real, resumable wizard. Visibility, status and copy come from
          the admin-managed service rows (surfaces.home), and anonymous
          visitors are routed through login back to the same wizard URL. */}
      <div className="landing-container pb-14 tablet:pb-16 laptop:pb-20" data-ln-reveal="0">
        <JudicialServiceZone
          surface="home"
          mode="public"
          appearance="marketing"
          footer={
            <p className="mt-4 text-[12.5px] leading-7 text-[color:var(--ln-muted)]">
              پیش‌نویس‌ها برای بازبینی خودتان و وکیل است؛ لیگالیر هیچ سندی را در مرجع
              قضایی ثبت، ارسال یا ابلاغ نمی‌کند.
            </p>
          }
        />
      </div>

      {/* ============================================================
          SAMPLE Q&A — proof of substance before the feature tour
          ============================================================ */}
      <section
        className="border-y border-[color:var(--ln-line)] bg-[color:var(--ln-canvas)]"
        aria-labelledby="qa-title"
      >
        <div className="landing-container landing-section">
          <header className="mx-auto max-w-2xl text-center" data-ln-reveal="0">
            <p className="landing-eyebrow justify-center">نمونه پرسش‌های واقعی</p>
            <h2 id="qa-title" className="landing-title mt-3">
              لیگالیر چه سوالاتی را پاسخ می‌دهد؟
            </h2>
            <p className="landing-lead mx-auto mt-3 max-w-xl">
              اینها نمونه‌هایی از پرسش‌های واقعی حقوقی هستند که می‌توانید از لیگالیر
              بپرسید. هر پاسخ همراه با استناد دقیق به مواد قانونی و آرای قضایی ارائه
              می‌شود.
            </p>
          </header>

          <ul className="mx-auto mt-10 grid max-w-5xl gap-3 tablet:grid-cols-2">
            {sampleQuestions.map((item, index) => (
              <li key={item.question}>
                <Link
                  href="/auth/mobile?intent=chat"
                  data-ln-reveal={String(index % 2)}
                  className="landing-card group gap-3 p-5"
                >
                  <span className="flex items-start gap-3">
                    <span className="landing-chip" aria-hidden="true">
                      <IconChat size={18} />
                    </span>
                    <span className="min-w-0 flex-1 text-[14px] leading-7 text-[color:var(--ln-ink)]">
                      {item.question}
                    </span>
                  </span>

                  <span className="flex flex-wrap items-center gap-2 ps-[3.25rem]">
                    <span className="inline-flex items-center gap-1 rounded-[var(--ln-r-sm)] bg-[color:var(--ln-canvas)] px-2 py-0.5 text-[11.5px] leading-5 text-[color:var(--ln-muted)]">
                      <IconStar size={12} aria-hidden="true" />
                      {item.category}
                    </span>
                    <span className="text-[11.5px] font-medium leading-5 text-[color:var(--ln-gold-deep)]">
                      {item.sourceRef}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 text-center" data-ln-reveal="0">
            <Link href="/auth/mobile?intent=chat" className="landing-btn landing-btn--primary">
              <IconChat size={18} aria-hidden="true" />
              پرسش خود را مطرح کنید
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          LEGAL TOPICS — one calm grid: no glass, no tracking light
          ============================================================ */}
      <LegalTopicsSection topics={legalTopics} />

      {/* ============================================================
          HOW IT WORKS — three numbered steps, connector on wide screens
          ============================================================ */}
      <section
        className="border-y border-[color:var(--ln-line)] bg-[color:var(--ln-canvas)]"
        aria-labelledby="how-title"
      >
        <div className="landing-container landing-section">
          <header className="mx-auto max-w-xl text-center" data-ln-reveal="0">
            <p className="landing-eyebrow justify-center">مسیر استفاده</p>
            <h2 id="how-title" className="landing-title mt-3">
              لیگالیر چطور کار می‌کند؟
            </h2>
            <p className="landing-lead mt-3">
              سه گام ساده برای دریافت تحلیل حقوقی — از طرح موضوع تا دریافت راهنمایی
              تخصصی
            </p>
          </header>

          <ol className="relative mt-10 grid gap-6 tablet:mt-12 tablet:grid-cols-3 tablet:gap-5">
            {/* Connector — decorative, sits behind the number badges. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[16%] top-6 hidden h-px bg-[color:var(--ln-line-strong)] tablet:block"
            />

            {howItWorksSteps.map((step, index) => (
              <li
                key={step.number}
                data-ln-reveal={String(index)}
                className="relative flex gap-4 tablet:flex-col tablet:items-center tablet:gap-4 tablet:text-center"
              >
                <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[color:var(--ln-line)] bg-[color:var(--ln-surface)] text-[15px] font-bold tabular-nums text-[color:var(--ln-green)]">
                  {step.number}
                </span>
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-[15.5px] font-semibold leading-8 text-[color:var(--ln-navy)] tablet:justify-center">
                    <step.icon
                      size={18}
                      aria-hidden="true"
                      className="shrink-0 text-[color:var(--ln-gold-deep)]"
                    />
                    {step.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-7 text-[color:var(--ln-muted)] tablet:mt-2">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============================================================
          HUMAN LAWYER — the natural next step after «ارجاع به وکیل»
          ============================================================ */}
      <section className="landing-container py-14 tablet:py-16 laptop:py-20">
        <div
          data-ln-reveal="0"
          className="relative isolate overflow-hidden rounded-[var(--ln-r-xl)] bg-[color:var(--ln-navy)] px-6 py-10 text-white tablet:px-10 tablet:py-12 laptop:px-14"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(60% 90% at 88% 0%, rgba(198,155,56,0.18), transparent 70%)",
            }}
          />
          <div className="relative flex flex-col gap-6 laptop:flex-row laptop:items-center laptop:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 text-[12.5px] font-semibold leading-6 text-[color:var(--ln-gold)]">
                <IconHandshake size={16} aria-hidden="true" />
                وکیل انسانی
              </p>
              <h2 className="mt-3 text-[clamp(1.25rem,1rem+0.9vw,1.75rem)] font-bold leading-9 text-white">
                وقتی موضوع به بررسی تخصصی نیاز دارد
              </h2>
              <p className="mt-3 text-[13.5px] leading-7 text-white/75 tablet:text-[14.5px] tablet:leading-8">
                لیگالیر مسیر ارتباط با وکلای متخصص و تأییدشده را فراهم می‌کند — انتخاب
                وکیل بر اساس تخصص، شهر و بودجه، با شفافیت کامل در هزینه و سابقه.
              </p>
            </div>
            <Link
              href="/lawyers"
              className="landing-btn landing-btn--onDark w-full shrink-0 laptop:w-auto"
            >
              مشاهده وکلای تأییدشده
              <IconChevronLeft size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          LEGAL SOURCES — a snap rail on phones, the same cards as a
          4-up grid from laptop up
          ============================================================ */}
      <section className="landing-section" aria-labelledby="sources-title">
        <div className="landing-container">
          <header className="mx-auto max-w-2xl text-center" data-ln-reveal="0">
            <p className="landing-eyebrow justify-center">
              <IconLawBook size={14} aria-hidden="true" />
              منابع معتبر حقوقی
            </p>
            <h2 id="sources-title" className="landing-title mt-3">
              منابع حقوقی تحت پوشش
            </h2>
            <p className="landing-lead mx-auto mt-3 max-w-xl">
              لیگالیر بر پایه قوانین، مقررات و آرای معتبر نظام حقوقی ایران آموزش دیده
              است. هر پاسخ با ارجاع دقیق به منبع اصلی همراه می‌باشد.
            </p>
          </header>
        </div>

        {/* Phones: four short cards read better as one snap rail than as a
            four-screen stack. From 900px up the same markup is a grid. */}
        <div className="mt-9 tablet:mt-11 laptop:landing-container">
          <ul
            className="landing-rail"
            data-lenis-prevent
            aria-label="منابع حقوقی تحت پوشش"
          >
            {keySources.map((source, index) => (
              <li key={source.title} className="h-full">
                <article data-ln-reveal={String(index)} className="landing-card p-5">
                  <h3 className="text-[15.5px] font-semibold leading-8 text-[color:var(--ln-navy)]">
                    {source.title}
                  </h3>
                  <p className="mt-1.5 flex-1 text-[13px] leading-7 text-[color:var(--ln-muted)]">
                    {source.description}
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-[color:var(--ln-line)] pt-3">
                    <span className="rounded-[var(--ln-r-sm)] bg-[color:var(--ln-gold-soft)] px-2.5 py-1 text-[11.5px] font-medium leading-5 text-[color:var(--ln-gold-deep)]">
                      {source.articles}
                    </span>
                    <span className="text-[11.5px] leading-5 text-[color:var(--ln-muted)]">
                      مصوب {source.year}
                    </span>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================================
          BLOG PREVIEW
          ============================================================ */}
      <section
        className="border-y border-[color:var(--ln-line)] bg-[color:var(--ln-canvas)]"
        aria-labelledby="blog-title"
      >
        <div className="landing-container landing-section">
          <header className="mx-auto max-w-2xl text-center" data-ln-reveal="0">
            <p className="landing-eyebrow justify-center">
              <IconLawBook size={14} aria-hidden="true" />
              مجله و آموزش حقوقی لیگالیر
            </p>
            <h2 id="blog-title" className="landing-title mt-3">
              مجله و آموزش حقوقی لیگالیر
            </h2>
            <p className="landing-lead mx-auto mt-3 max-w-xl">
              راهنماهای کاربردی، قوانین، آرای مهم و تحلیل موضوعات حقوقی — بر پایه منابع
              ساختاریافته حقوقی
            </p>
          </header>

          <ul className="mt-10 grid gap-4 tablet:grid-cols-3">
            {blogPreviewPosts.map((post, index) => (
              <li key={post.id}>
                <Link
                  href={`/blog/${post.slug}`}
                  data-ln-reveal={String(index)}
                  className="landing-card group overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[color:var(--ln-line)] px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 rounded-[var(--ln-r-sm)] bg-[color:var(--ln-green-soft)] px-2 py-0.5 text-[11.5px] leading-5 text-[color:var(--ln-green)]">
                      <IconCategory size={12} aria-hidden="true" />
                      {post.category}
                    </span>
                    <span className="shrink-0 text-[11.5px] tabular-nums leading-5 text-[color:var(--ln-muted)]">
                      {toPersianDigits(post.readingTime)} دقیقه مطالعه
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="line-clamp-2 text-[15px] font-semibold leading-8 text-[color:var(--ln-navy)]">
                      {post.titleFa}
                    </h3>
                    <p className="mb-4 mt-1.5 line-clamp-3 flex-1 text-[13px] leading-7 text-[color:var(--ln-muted)]">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11.5px] leading-5 text-[color:var(--ln-muted)]">
                      <IconCalendar size={13} aria-hidden="true" />
                      <span>{toPersianDate(post.publishedAt)}</span>
                      <span className="ms-auto inline-flex items-center gap-1 font-semibold text-[color:var(--ln-green)]">
                        مطالعه مقاله
                        <IconChevronLeft
                          size={14}
                          aria-hidden="true"
                          className="transition-transform duration-300 group-hover:-translate-x-0.5 motion-reduce:transition-none"
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 text-center">
            <Link href="/blog" className="landing-btn landing-btn--secondary">
              مشاهده همه مطالب وبلاگ
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          TRANSPARENCY — how the three layers relate
          ============================================================ */}
      <section className="landing-section" aria-labelledby="transparency-title">
        <div className="landing-container">
          <header className="mx-auto max-w-xl text-center" data-ln-reveal="0">
            <p className="landing-eyebrow justify-center">شفافیت</p>
            <h2 id="transparency-title" className="landing-title mt-3">
              شفافیت در خدمات
            </h2>
            <p className="landing-lead mt-3">
              لیگالیر مرز بین هوش مصنوعی، منابع معتبر حقوقی و وکیل متخصص را شفاف می‌کند
            </p>
          </header>

          <ul className="mt-10 grid gap-4 tablet:grid-cols-3">
            {distinctions.map((item, index) => (
              <li key={item.title}>
                <article data-ln-reveal={String(index)} className="landing-card p-6">
                  <span className="landing-chip">
                    <item.icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-[15.5px] font-semibold leading-8 text-[color:var(--ln-navy)]">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-7 text-[color:var(--ln-muted)]">
                    {item.description}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================================
          FAQ — native disclosure elements: keyboard operable, announced
          by screen readers, and open/close without JavaScript.
          ============================================================ */}
      <section
        className="border-y border-[color:var(--ln-line)] bg-[color:var(--ln-canvas)]"
        aria-labelledby="faq-title"
      >
        <div className="landing-container landing-section">
          <div className="mx-auto max-w-3xl">
            <header className="text-center" data-ln-reveal="0">
              <p className="landing-eyebrow justify-center">پرسش‌های متداول</p>
              <h2 id="faq-title" className="landing-title mt-3">
                پرسش‌های متداول
              </h2>
            </header>

            <div className="landing-faq mt-8 divide-y divide-[color:var(--ln-line)] rounded-[var(--ln-r-lg)] border border-[color:var(--ln-line)] bg-[color:var(--ln-surface)]">
              {faqItems.map((item) => (
                <details key={item.question} className="px-5">
                  <summary className="flex items-center gap-3 py-4 text-[14px] font-medium leading-7 text-[color:var(--ln-ink)]">
                    {item.question}
                  </summary>
                  <p className="pb-4 pe-1 text-[13px] leading-7 text-[color:var(--ln-muted)]">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          WHAT LEGALIR DOES — the full disclaimer block (unchanged copy
          lives in the shared component, so legal text has one owner)
          ============================================================ */}
      <section className="landing-section--tight landing-container">
        <div data-ln-reveal="0">
          <AIDisclaimer />
        </div>
      </section>

      {/* ============================================================
          FINAL CTA — the four shipped entry paths, one row on desktop.
          Rendered by the shared component so the copy has one owner and
          the unit test that covers it keeps exercising real production
          markup.
          ============================================================ */}
      <CTASection />
    </>
  );
}
