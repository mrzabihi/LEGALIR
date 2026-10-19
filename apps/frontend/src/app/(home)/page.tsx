import type { Metadata } from "next";
import Link from "next/link";
import { AIDisclaimer } from "@/components/public/AIDisclaimer";
import { CTASection } from "@/components/public/CTASection";
import { LegalTopicsSection } from "@/components/public/LegalTopicsSection";
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
  IconContract,
  IconDocument,
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

const highlights = [
  {
    icon: IconChat,
    title: "مشاوره حقوقی با هوش مصنوعی",
    description:
      "پرسش حقوقی خود را به زبان ساده مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید",
    href: "/auth/mobile?intent=chat",
    badge: "اطلاعات AI",
  },
  {
    icon: IconDocument,
    title: "تحلیل هوشمند اسناد",
    description:
      "قراردادها و اسناد حقوقی خود را بارگذاری کنید و بندهای پرریسک با گزارش تحلیل دقیق و شناسایی ریسک دریافت کنید",
    href: "/auth/mobile?intent=document",
    badge: "کمک حقوقی",
  },
  {
    icon: IconContract,
    title: "تولید پیش‌نویس قرارداد",
    description:
      "با پاسخ به پرسش‌نامه گام‌به‌گام، پیش‌نویس قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید",
    href: "/auth/mobile?intent=contract",
    badge: "پیش‌نویس خودکار",
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

        <div className="landing-container relative pb-14 pt-14 tablet:pb-16 tablet:pt-20 laptop:pb-20 laptop:pt-24">
          <div className="max-w-3xl">
            {/* Eyebrow — the shipped compact disclaimer, not a new claim. */}
            <p className="landing-rise inline-flex items-center gap-2 rounded-[var(--ln-r-md)] border border-white/20 bg-white/[0.07] px-3 py-1.5 text-[12.5px] leading-6 text-white/85">
              <IconShield
                size={14}
                aria-hidden="true"
                className="shrink-0 text-[color:var(--ln-gold)]"
              />
              خدمات تخصصی حقوقی با پشتیبانی هوش مصنوعی و منابع حقوقی
            </p>

            <h1 className="landing-rise landing-rise-2 mt-5 text-[clamp(1.875rem,1.2rem+2.6vw,3.25rem)] font-extrabold leading-[1.3] tracking-tight text-white">
              دستیار هوشمند حقوقی ایران
            </h1>

            <p className="landing-rise landing-rise-3 mt-4 max-w-2xl text-[15px] leading-8 text-white/80 tablet:text-[16.5px] tablet:leading-9">
              خدمات تخصصی حقوقی با بهره‌گیری از هوش مصنوعی، منابع حقوقی و مدل زبانی
              تخصصی لیگالیر — تحلیل ساختاریافته پرونده‌ها، قراردادها و مسائل حقوقی
            </p>

            {/* Two actions, one hierarchy: the emerald primary carries the
                conversion, the outlined button is discovery. Both are 48px
                tall at every width and full-width until 375px. */}
            <div className="landing-rise landing-rise-4 mt-8 flex flex-col gap-3 mobile-l:flex-row mobile-l:items-center tablet:mt-10">
              <Link
                href="/auth/mobile?intent=chat"
                className="landing-btn landing-btn--primary w-full mobile-l:w-auto"
              >
                شروع مشاوره حقوقی
                <IconChevronLeft size={18} aria-hidden="true" />
              </Link>
              <Link
                href="/features"
                className="landing-btn landing-btn--onDark w-full mobile-l:w-auto"
              >
                مشاهده قابلیت‌ها
              </Link>
            </div>

            <p className="landing-rise landing-rise-4 mt-6 flex items-center gap-2 text-[12.5px] leading-6 text-white/60">
              <IconArrowBack
                size={14}
                aria-hidden="true"
                className="shrink-0 text-[color:var(--ln-gold)]"
              />
              دانش حقوقی، تحلیل هوشمند و منابع مستند؛ یکپارچه در لیگالیر
            </p>
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
          SERVICES — three capabilities in a bento with one lead cell
          ============================================================ */}
      <section className="landing-section" aria-labelledby="services-title">
        <div className="landing-container">
          <header className="max-w-2xl" data-ln-reveal="0">
            <p className="landing-eyebrow">خدمات هوشمند</p>
            <h2 id="services-title" className="landing-title mt-3">
              خدمات هوشمند لیگالیر
            </h2>
            <p className="landing-lead mt-3 max-w-xl">
              سه سرویس تخصصی مبتنی بر هوش مصنوعی حقوقی — آموزش‌دیده بر نظام حقوقی ایران
            </p>
          </header>

          <div className="mt-10 grid gap-4 tablet:mt-12 tablet:grid-cols-2 laptop:grid-cols-12">
            {highlights.map((item, index) => {
              // Bento hierarchy: the consultation service is the primary
              // path, so it takes the tall cell; the other two split the
              // remaining width. Tablet keeps a simple 2-up; phones stack.
              const span =
                index === 0
                  ? "tablet:col-span-2 laptop:col-span-5 laptop:row-span-2"
                  : "laptop:col-span-7";

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  data-ln-reveal={String(index % 2)}
                  className={`landing-card group p-6 ${span} ${
                    index === 0 ? "laptop:justify-between" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`landing-chip ${
                          index === 0 ? "!h-12 !w-12 !rounded-[var(--ln-r-lg)]" : ""
                        }`}
                      >
                        <item.icon size={index === 0 ? 26 : 22} aria-hidden="true" />
                      </span>
                      <span className="rounded-[var(--ln-r-sm)] bg-[color:var(--ln-canvas)] px-2.5 py-1 text-[11.5px] leading-5 text-[color:var(--ln-ink-soft)]">
                        {item.badge}
                      </span>
                    </div>

                    <h3
                      className={`mt-5 font-semibold leading-8 text-[color:var(--ln-navy)] ${
                        index === 0 ? "text-[19px] tablet:text-[21px]" : "text-[16.5px]"
                      }`}
                    >
                      {item.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-[13.5px] leading-7 text-[color:var(--ln-muted)]">
                      {item.description}
                    </p>
                  </div>

                  <span className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--ln-green)]">
                    شروع کنید
                    <IconChevronLeft
                      size={16}
                      aria-hidden="true"
                      className="transition-transform duration-300 group-hover:-translate-x-0.5 motion-reduce:transition-none"
                    />
                  </span>
                </Link>
              );
            })}
          </div>
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
