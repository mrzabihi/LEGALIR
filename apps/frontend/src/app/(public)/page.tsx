import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CTASection } from "@/components/public/CTASection";
import { AIDisclaimer } from "@/components/public/AIDisclaimer";
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
} from "@/lib/icons";

export const metadata: Metadata = {
  title: "LEGALIR | دستیار هوشمند حقوقی ایران",
  description:
    "دستیار هوشمند حقوقی ایران — پلتفرم تخصصی تحلیل حقوقی با هوش مصنوعی، آموزش‌دیده بر نظام حقوقی ایران شامل قانون اساسی، مدنی، کیفری، تجارت، خانواده، کار، مالیات و هزاران پرونده واقعی",
  alternates: { canonical: "/" },
};

const statsItems = [
  { value: "۳+", label: "خدمات اصلی", icon: IconCheckCircle },
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
      "هسته تخصصی LEGALIR با استناد به قوانین، آرای وحدت رویه و بخشنامه‌های معتبر، موضوع شما را تحلیل می‌کند",
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
    title: "اطلاعات هوش مصنوعی",
    description:
      "تمامی خروجی‌های AI با برچسب مشخص ارائه می‌شوند. این اطلاعات برای آگاهی اولیه است و مشاوره حقوقی رسمی محسوب نمی‌شود.",
    color: "border-r-warning",
    accentBg: "bg-warning/5",
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
  },
  {
    icon: IconBalance,
    title: "منابع معتبر حقوقی",
    description:
      "هر پاسخ با ارجاع دقیق به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه است. وضعیت اعتبار هر منبع (معتبر / اصلاح‌شده / منسوخ) به‌روشنی مشخص شده است.",
    color: "border-r-success",
    accentBg: "bg-success/5",
    iconBg: "bg-success/10",
    iconColor: "text-success",
  },
  {
    icon: IconSearch,
    title: "کمک حقوقی، نه جایگزین وکیل",
    description:
      "LEGALIR یک ابزار کمک‌آموزشی است. در موضوعات حساس، ارجاع به وکلای متخصص و تأییدشده توصیه می‌شود.",
    color: "border-r-primary",
    accentBg: "bg-primary/5",
    iconBg: "bg-primary/10",
    iconColor: "text-primary-700",
  },
];

// ================================================================
// Real Legal Topic Examples (نمونه موضوعات پرکاربرد حقوقی)
// ================================================================
const legalTopics = [
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
// Sample Q&A — Real Legal Questions LEGALIR Can Answer
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

export default function LandingPage() {
  return (
    <div id="main-content">
      {/* ============================================================
          HERO — Dramatic Navy Gradient with Geometric Pattern
          ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-900 via-primary-800 to-primary-700">
        {/* Geometric dot-grid pattern overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
          aria-hidden="true"
        />

        {/* Top-right gold glow */}
        <div
          className="absolute -top-20 -end-20 w-96 h-96 rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(212,175,55,0.4), transparent 70%)",
          }}
          aria-hidden="true"
        />

        {/* Bottom-left subtle glow */}
        <div
          className="absolute -bottom-40 -start-20 w-[500px] h-[500px] rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)",
          }}
          aria-hidden="true"
        />

        <div className="mx-auto max-w-4xl px-4 pt-28 pb-24 tablet:pt-40 tablet:pb-32 text-center relative">
          {/* Logo */}
          <div
            className="mb-8 animate-fade-in"
            style={{ animationDelay: "0ms" }}
          >
            <div className="relative mx-auto w-44 h-44 tablet:w-56 tablet:h-56">
              <Image
                src="/legalir-logo.png"
                alt="LEGALIR"
                fill
                sizes="(min-width: 600px) 224px, 176px"
                className="object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-transform duration-500 hover:scale-105 hover:drop-shadow-[0_12px_32px_rgba(212,175,55,0.25)]"
                priority
              />
            </div>
          </div>

          {/* Refined AI disclaimer badge */}
          <div
            className="mb-8 animate-fade-in"
            style={{ animationDelay: "100ms" }}
          >
            <AIDisclaimer compact />
          </div>

          {/* Main heading */}
          <h1
            className="text-[40px] tablet:text-[60px] font-extrabold text-white leading-[1.1] mb-6 tracking-tight"
          >
            دستیار هوشمند<br />حقوقی ایران
          </h1>

          {/* Subheading */}
          <p
            className="text-white/70 text-lg leading-relaxed mb-10 max-w-2xl mx-auto"
          >
            پلتفرم تخصصی هوش مصنوعی حقوقی، آموزش‌دیده بر قوانین و مقررات ایران —
            قانون اساسی، مدنی، کیفری، تجارت، خانواده، کار، مالیات و هزاران پرونده واقعی
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col mobile-s:flex-row items-center justify-center gap-3 mb-8 scroll-reveal visible"
            style={{ transitionDelay: "350ms" }}
          >
            <Link
              href="/auth/mobile?intent=chat"
              className="rounded-large bg-white text-primary-800 px-10 py-4 text-button font-semibold hover:bg-neutral-100 transition-all duration-300 touch-target w-full mobile-s:w-auto shadow-[0_4px_20px_rgba(255,255,255,0.1)] hover:shadow-[0_6px_24px_rgba(255,255,255,0.18)] active:scale-[0.98]"
            >
              شروع مشاوره حقوقی
            </Link>
            <Link
              href="/features"
              className="rounded-large border border-primary-300/25 text-primary-100 px-10 py-4 text-button hover:border-primary-200/40 hover:text-white hover:bg-primary-600/30 transition-all duration-300 touch-target w-full mobile-s:w-auto active:scale-[0.98]"
            >
              مشاهده قابلیت‌ها
            </Link>
          </div>

          {/* Disclaimer note */}
          <p
            className="flex items-center justify-center gap-1.5 text-caption text-primary-300/60 scroll-reveal visible"
            style={{ transitionDelay: "450ms" }}
          >
            <IconArrowBack size={14} className="text-warning shrink-0" />
            LEGALIR جایگزین وکیل نیست — ابزاری کمک‌آموزشی برای آگاهی حقوقی اولیه
          </p>
        </div>
      </section>

      {/* ============================================================
          STATS BAR — With Muted Gold Accents
          ============================================================ */}
      <section className="border-b border-divider bg-surface relative overflow-hidden">
        <div className="absolute inset-0 bg-geometric-pattern pointer-events-none" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-4 py-7 relative">
          <div className="flex flex-col tablet:flex-row items-center justify-center gap-6 tablet:gap-14">
            {statsItems.map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-large bg-secondary-500/10 flex items-center justify-center shrink-0">
                  <stat.icon size={20} className="text-secondary-600 shrink-0" />
                </div>
                <span className="text-[28px] tablet:text-[32px] font-bold text-primary-700 leading-none">
                  {stat.value}
                </span>
                <span className="text-body-2 text-neutral-500">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SERVICES — "خدمات هوشمند LEGALIR"
          ============================================================ */}
      <section className="mx-auto max-w-6xl px-4 py-20 tablet:py-24">
        <div className="text-center mb-12">
          <h2 className="text-h2 text-primary-800 mb-3">خدمات هوشمند LEGALIR</h2>
          <p className="text-body-1 text-neutral-500 max-w-xl mx-auto leading-relaxed">
            سه سرویس تخصصی مبتنی بر هوش مصنوعی حقوقی — آموزش‌دیده بر نظام حقوقی ایران
          </p>
        </div>

        <div className="grid tablet:grid-cols-3 gap-6">
          {highlights.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-large bg-surface p-6 border border-divider shadow-elevation-1 card-lift card-press relative overflow-hidden transition-all duration-300 hover:border-primary-100"
            >
              {/* Subtle top border accent on hover */}
              <div
                className="absolute top-0 inset-x-0 h-[3px] bg-primary-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center rounded-t-large"
                aria-hidden="true"
              />

              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-large bg-primary-50 flex items-center justify-center text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-all duration-300 group-hover:shadow-elevation-4">
                  <item.icon size={24} />
                </div>
                <span
                  className={`text-caption px-2.5 py-0.5 rounded-full border ${item.badgeBg}`}
                >
                  {item.badge}
                </span>
              </div>

              <h3 className="text-h3 text-primary-800 mb-2 group-hover:text-primary-600 transition-colors duration-200">
                {item.title}
              </h3>
              <p className="text-body-2 text-neutral-500 leading-relaxed">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ============================================================
          SAMPLE Q&A — "LEGALIR چه سوالاتی را پاسخ می‌دهد؟"
          ============================================================ */}
      <section className="bg-neutral-50 border-y border-divider">
        <div className="mx-auto max-w-6xl px-4 py-20 tablet:py-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary-100/50 border border-secondary-200/30 px-4 py-1.5 text-caption font-medium text-secondary-700 mb-4">
              <IconStar size={16} className="text-secondary-600" />
              نمونه پرسش‌های واقعی
            </div>
            <h2 className="text-h2 text-primary-800 mb-3">LEGALIR چه سوالاتی را پاسخ می‌دهد؟</h2>
            <p className="text-body-1 text-neutral-500 max-w-2xl mx-auto leading-relaxed">
              اینها نمونه‌هایی از پرسش‌های واقعی حقوقی هستند که می‌توانید از LEGALIR بپرسید.
              هر پاسخ همراه با استناد دقیق به مواد قانونی و آرای قضایی ارائه می‌شود.
            </p>
          </div>

          <div className="grid tablet:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {sampleQuestions.map((item) => (
              <Link
                key={item.question}
                href="/auth/mobile?intent=chat"
                className="group flex items-start gap-4 rounded-large bg-surface p-5 border border-divider shadow-elevation-1 hover:shadow-elevation-3 hover:border-primary-200 card-lift transition-all duration-300"
              >
                <div className="h-10 w-10 rounded-medium bg-primary-50 flex items-center justify-center text-primary-600 shrink-0 group-hover:bg-primary-600 group-hover:text-white transition-all duration-300">
                  <item.icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-body-2 text-on-surface leading-relaxed mb-2 group-hover:text-primary-700 transition-colors">
                    {item.question}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-caption text-neutral-400 bg-neutral-100 rounded-full px-2 py-0.5">
                      {item.category}
                    </span>
                    <span className="text-caption text-secondary-600 font-medium">
                      {item.sourceRef}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/auth/mobile?intent=chat"
              className="inline-flex items-center gap-2 rounded-large bg-primary-700 text-white px-8 py-3.5 text-button font-semibold hover:bg-primary-800 transition-all duration-300 shadow-md hover:shadow-elevation-4 active:scale-[0.98] touch-target"
            >
              <IconChat size={20} />
              پرسش خود را مطرح کنید
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          LEGAL TOPICS — "موضوعات پرکاربرد حقوقی"
          ============================================================ */}
      <section className="mx-auto max-w-6xl px-4 py-20 tablet:py-24">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-info-50 border border-info-100 px-4 py-1.5 text-caption font-medium text-info-700 mb-4">
            <IconCategory size={16} className="text-info-600" />
            موضوعات حقوقی
          </div>
          <h2 className="text-h2 text-primary-800 mb-3">موضوعات پرکاربرد حقوقی</h2>
          <p className="text-body-1 text-neutral-500 max-w-2xl mx-auto leading-relaxed">
            LEGALIR در حوزه‌های متنوع حقوقی آموزش دیده است. هر حوزه شامل منابع قانونی،
            آرای قضایی و تحلیل تخصصی مرتبط می‌باشد.
          </p>
        </div>

        <div className="grid tablet:grid-cols-2 desktop:grid-cols-3 gap-5">
          {legalTopics.map((topic) => (
            <Link
              key={topic.title}
              href="/auth/mobile?intent=chat"
              className="group rounded-large bg-surface p-6 border border-divider shadow-elevation-1 card-lift card-press relative overflow-hidden transition-all duration-300 hover:border-primary-200"
            >
              {/* Decorative gradient accent */}
              <div
                className="absolute top-0 end-0 w-24 h-24 rounded-bl-[100%] bg-gradient-to-bl from-secondary-100/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                aria-hidden="true"
              />

              <div className="flex items-start gap-4 mb-3">
                <span className="text-[32px] leading-none shrink-0" aria-hidden="true">
                  {topic.icon}
                </span>
                <div>
                  <h3 className="text-h3 text-primary-800 mb-1.5 group-hover:text-primary-600 transition-colors">
                    {topic.title}
                  </h3>
                  <p className="text-body-2 text-neutral-500 leading-relaxed">
                    {topic.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {topic.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-caption text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-full px-2.5 py-0.5"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ============================================================
          HOW IT WORKS — 3-Step Connected Diagram
          ============================================================ */}
      <section className="bg-neutral-50 border-y border-divider">
        <div className="mx-auto max-w-6xl px-4 py-20 tablet:py-24">
          <div className="text-center mb-14">
            <h2 className="text-h2 text-primary-800 mb-3">LEGALIR چطور کار می‌کند؟</h2>
            <p className="text-body-1 text-neutral-500 max-w-xl mx-auto leading-relaxed">
              سه گام ساده برای دریافت تحلیل حقوقی — از طرح موضوع تا دریافت راهنمایی تخصصی
            </p>
          </div>

          <div className="relative">
            {/* Connecting line — desktop horizontal */}
            <div
              className="hidden tablet:block absolute top-[56px] start-[calc(16.67%+28px)] end-[calc(16.67%+28px)] h-[2px] bg-primary-100"
              aria-hidden="true"
            />
            {/* Connecting line — mobile vertical */}
            <div
              className="tablet:hidden absolute top-0 start-[28px] bottom-0 w-[2px] bg-primary-100"
              aria-hidden="true"
            />

            <div className="flex flex-col tablet:flex-row items-start tablet:items-start justify-between gap-8 tablet:gap-0">
              {howItWorksSteps.map((step, idx) => (
                <div
                  key={step.number}
                  className="relative flex tablet:flex-col items-start tablet:items-center gap-4 tablet:gap-0 tablet:text-center tablet:w-1/3 scroll-reveal visible"
                  style={{ transitionDelay: `${idx * 150}ms` }}
                >
                  {/* Step number circle */}
                  <div className="relative z-10 flex-shrink-0">
                    <div className="h-14 w-14 rounded-full bg-primary-700 text-white flex items-center justify-center text-h3 font-bold shadow-elevation-3">
                      {step.number}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="tablet:mt-5 flex-1">
                    {/* Icon */}
                    <div className="hidden tablet:flex mx-auto mb-3 h-10 w-10 rounded-medium bg-primary-50 items-center justify-center text-primary-600">
                      <step.icon size={22} />
                    </div>

                    <h3 className="text-h3 text-primary-800 mb-1.5 tablet:mb-2">
                      {step.title}
                    </h3>
                    <p className="text-body-2 text-neutral-500 leading-relaxed max-w-[280px] tablet:mx-auto">
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
          LEGAL SOURCES — "منابع حقوقی تحت پوشش"
          ============================================================ */}
      <section className="mx-auto max-w-6xl px-4 py-20 tablet:py-24">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-success-50 border border-success-100 px-4 py-1.5 text-caption font-medium text-success-700 mb-4">
            <IconLawBook size={16} className="text-success-600" />
            منابع معتبر حقوقی
          </div>
          <h2 className="text-h2 text-primary-800 mb-3">منابع حقوقی تحت پوشش</h2>
          <p className="text-body-1 text-neutral-500 max-w-2xl mx-auto leading-relaxed">
            LEGALIR بر پایه قوانین، مقررات و آرای معتبر نظام حقوقی ایران آموزش دیده است.
            هر پاسخ با ارجاع دقیق به منبع اصلی همراه می‌باشد.
          </p>
        </div>

        <div className="grid tablet:grid-cols-2 desktop:grid-cols-4 gap-5">
          {keySources.map((source) => (
            <div
              key={source.title}
              className="rounded-large bg-surface p-6 border border-divider shadow-elevation-1 card-lift relative overflow-hidden"
            >
              {/* Decorative left border */}
              <div className="absolute inset-y-0 end-0 w-1 bg-gradient-to-b from-secondary-400 to-primary-500 opacity-70" aria-hidden="true" />

              <div className="mb-4">
                <h3 className="text-h3 text-primary-800 mb-2">{source.title}</h3>
                <p className="text-body-2 text-neutral-500 leading-relaxed">
                  {source.description}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-caption font-medium text-secondary-700 bg-secondary-100 rounded-full px-3 py-1">
                  {source.articles}
                </span>
                <span className="text-caption text-neutral-400">
                  مصوب {source.year}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================
          DISTINCTIONS — "شفافیت در خدمات"
          ============================================================ */}
      <section className="bg-neutral-50 border-y border-divider">
        <div className="mx-auto max-w-6xl px-4 py-20 tablet:py-24">
          <div className="text-center mb-12">
            <h2 className="text-h2 text-primary-800 mb-3">شفافیت در خدمات</h2>
            <p className="text-body-1 text-neutral-500 max-w-xl mx-auto leading-relaxed">
              LEGALIR مرز بین هوش مصنوعی، منابع معتبر حقوقی و وکیل متخصص را شفاف می‌کند
            </p>
          </div>

          <div className="grid tablet:grid-cols-3 gap-6">
            {distinctions.map((item) => (
              <div
                key={item.title}
                className={`rounded-large bg-surface p-6 border-r-4 ${item.color} border border-divider shadow-elevation-1 card-lift ${item.accentBg}`}
              >
                <div className={`h-10 w-10 rounded-medium ${item.iconBg} flex items-center justify-center ${item.iconColor} mb-4`}>
                  <item.icon size={22} />
                </div>
                <h3 className="text-h3 text-primary-800 mb-2">{item.title}</h3>
                <p className="text-body-2 text-neutral-500 leading-relaxed">
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
      <section className="mx-auto max-w-6xl px-4 py-8 border-t border-divider">
        <AIDisclaimer />
      </section>

      {/* ============================================================
          CTA SECTION
          ============================================================ */}
      <CTASection />
    </div>
  );
}
