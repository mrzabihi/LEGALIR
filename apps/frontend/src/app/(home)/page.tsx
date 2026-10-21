import type { Metadata } from "next";
import type { ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { AIDisclaimer } from "@/components/public/AIDisclaimer";
import { CTASection } from "@/components/public/CTASection";
import { LandingStartCard } from "@/components/public/landing/landing-start-card";
import { LandingServices } from "@/components/public/landing/landing-services";
import { LandingExhibit } from "@/components/public/landing/landing-exhibit";
import { LandingGeometry } from "@/components/public/landing/landing-geometry";
import {
  LandingHighlight,
  LandingHighlightWide,
} from "@/components/public/landing/landing-highlight";
import { EXHIBIT } from "@/components/public/landing/exhibits";
import { JudicialServiceZone } from "@/components/judicial/judicial-service-zone";
import { readBlog, isBlogPostPubliclyVisible } from "@/lib/legal-library-db";
import { SITE_URL, absoluteUrl } from "@/lib/site";
import { toPersianDate, toPersianDigits } from "@/lib/persian-utils";
import {
  IconArrowBack,
  IconBusiness,
  IconCalendar,
  IconCategory,
  IconCheckCircle,
  IconChevronLeft,
  IconChat,
  IconCoin,
  IconDocument,
  IconFileSearch,
  IconHome,
  IconLawBook,
  IconMemory,
  IconSearch,
  IconShield,
  IconUsers,
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
//
// The three measures are printed with Persian digits, like every other
// number on this page. `.landing-stat__value` isolates the run with
// `unicode-bidi`, so the sign can never be reordered to the far side of
// its digits by the RTL paragraph. The numbers themselves are the ones the
// product already ships — nothing here was rounded up.
// ================================================================

interface StatItem {
  /** Persian sign + digits, e.g. "+۷", rendered as one isolated run. */
  value: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

const statsItems: StatItem[] = [
  { value: "+۷", label: "خدمات اصلی", icon: IconCheckCircle },
  { value: "+۲۰", label: "حوزه حقوقی", icon: IconCategory },
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
    icon: IconFileSearch,
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
  /** A real component from `lib/icons` — the illustration line-art set.
   *  The previous version used emoji, and one of them (⚖️) is exactly the
   *  scales-of-justice cliché the art direction rules out. */
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  keywords: string[];
}

const legalTopics: LegalTopic[] = [
  {
    icon: IconHome,
    title: "مالک و مستأجر",
    description: "قوانین اجاره، تخلیه، تعدیل اجاره‌بها، ودیعه و تعهدات طرفین",
    keywords: ["اجاره", "تخلیه", "ودیعه", "سرقفلی"],
  },
  {
    icon: IconCoin,
    title: "مطالبه وجه و خسارت",
    description: "چک برگشتی، سفته، خسارت تأخیر تأدیه، وجه‌الالتزام قراردادی",
    keywords: ["چک", "سفته", "خسارت", "تأخیر تأدیه"],
  },
  {
    icon: IconDocument,
    title: "قراردادها و تعهدات",
    description: "تنظیم، بررسی و تفسیر قراردادهای ملکی، تجاری، پیمانکاری و استخدام",
    keywords: ["قرارداد", "تعهدات", "فسخ", "وجه‌الالتزام"],
  },
  {
    icon: IconUsers,
    title: "حقوق خانواده",
    description: "ازدواج، طلاق، مهریه، نفقه، حضانت، ارث و وصیت",
    keywords: ["مهریه", "طلاق", "حضانت", "ارث"],
  },
  {
    icon: IconBusiness,
    title: "شرکت‌ها و تجارت",
    description: "ثبت شرکت، اساسنامه، سهام، قراردادهای تجاری، ورشکستگی",
    keywords: ["شرکت", "تجارت", "سهام", "ورشکستگی"],
  },
  {
    icon: IconLawBook,
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

/** One band of the exhibition. Odd chapters sit on Mist, even ones on
 *  white; the hairline is what separates them, never a shadow. */
function bandClass(tinted: boolean, extra = "") {
  return `landing-section ${tinted ? "border-y border-[color:var(--ln-line)] bg-[color:var(--ln-canvas)]" : ""} ${extra}`;
}

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
          SCENE 00 — the opening wall
          ============================================================
          Editorial hero: a catalogue mark, one editorial headline, one
          deck, exactly two actions, and the illustration treated as the
          subject rather than a background. The dark «سند حقوقی · در حال
          بررسی» panel and every skeleton part of it are gone.

          The headline is new, so the shipped product sentence is carried
          inside it as `sr-only` text: the accessible name still contains
          «دستیار هوشمند حقوقی ایران», which is the contract the
          accessibility spec asserts. */}
      <section
        className="relative overflow-hidden border-b border-[color:var(--ln-line)]"
        aria-labelledby="hero-title"
      >
        {/* One tinted disc + one hairline square, well outside the text
            column. They only exist from `tablet` up, where there is margin
            to hold them without pushing the copy. */}
        <LandingGeometry variant="hero" />
        <div className="landing-container landing-layer pb-10 pt-10 tablet:pb-14 tablet:pt-16 laptop:min-h-[640px] laptop:pb-16 laptop:pt-20">
          <div className="grid items-center gap-10 laptop:grid-cols-[minmax(0,1fr)_minmax(0,0.94fr)] laptop:gap-14">
            <div className="min-w-0">
              {/* Catalogue marks are Persian numerals («۰۰»…«۱۳»), like every
                  other number on the page — a wall number is read aloud the
                  same way the copy is. */}
              <p className="landing-chapter landing-rise">
                <span className="landing-chapter__num">۰۰</span>
                <span>آغاز</span>
              </p>

              <h1
                id="hero-title"
                className="landing-rise landing-rise-2 mt-6 text-[clamp(2rem,1.15rem+3.1vw,3.5rem)] font-bold leading-[1.25] tracking-[-0.02em] text-[color:var(--ln-ink)] [text-wrap:balance]"
              >
                {/* The marker under «دقیق‌تر» is the page's one drawn
                    gesture, and it is the first thing it does: the stroke
                    draws as the hero settles. The stroke is a sibling SVG,
                    so the accessible name is just the sentence.
                    No full stop: a headline on this page is never closed
                    with one — the second line stands as its own statement. */}
                حقوق را <LandingHighlight draw>دقیق‌تر</LandingHighlight> بفهمید
                <span className="mt-1 block text-[color:var(--ln-ink-soft)]">
                  مطمئن‌تر تصمیم بگیرید
                </span>
                <span className="sr-only">دستیار هوشمند حقوقی ایران</span>
              </h1>

              <p className="landing-rise landing-rise-3 mt-6 max-w-xl text-[clamp(0.95rem,0.88rem+0.45vw,1.125rem)] leading-[1.9] text-[color:var(--ln-ink-soft)] [text-wrap:pretty]">
                خدمات تخصصی حقوقی با بهره‌گیری از هوش مصنوعی، منابع حقوقی و مدل
                زبانی تخصصی لیگالیر — تحلیل ساختاریافتهٔ پرونده‌ها، قراردادها و
                مسائل حقوقی.
              </p>

              {/* Two actions, one hierarchy. Phones stack them full-width:
                  at 375px a row would clip the second label. */}
              <div className="landing-rise landing-rise-4 mt-8 flex flex-col gap-3 tablet:flex-row tablet:items-center">
                <Link
                  href="/auth/mobile?intent=chat"
                  className="landing-btn landing-btn--primary w-full tablet:w-auto"
                >
                  شروع مشاوره حقوقی
                  <IconChevronLeft size={18} aria-hidden="true" />
                </Link>
                <Link
                  href="/features"
                  className="landing-btn landing-btn--secondary w-full tablet:w-auto"
                >
                  مشاهده قابلیت‌ها
                </Link>
              </div>

              <p className="landing-rise landing-rise-4 mt-6 flex items-center gap-2 text-[12.5px] leading-6 text-[color:var(--ln-muted)]">
                {/* The marker turns the line's direction: in an RTL sentence
                    a left-pointing arrow is read as "back", so the leading
                    bullet points into the text instead of against it. It is
                    printed amber at double size, outlined in ink, because
                    the pale gold alone has no edge on white. */}
                <IconArrowBack
                  size={28}
                  rtlFlip={false}
                  aria-hidden="true"
                  className="landing-marker shrink-0"
                />
                دانش حقوقی، تحلیل هوشمند و منابع مستند؛ یکپارچه در لیگالیر
              </p>
            </div>

            {/* The hero plate is the one eager image on the page: it is
                above the fold, so it carries `priority` and an explicit
                size.

                It is a 4:5 portrait with a transparent surround, so it is
                NOT stretched to the column: on desktop it is capped at 30rem,
                which keeps the figure at a sane optical size next to a 3.5rem
                headline. On phones it follows the actions at 78% of the
                measure, aligned to the end edge, with its caption running
                down the free side instead of under it — one bento row rather
                than a full-screen picture wedged between two blocks of text. */}
            <figure className="landing-rise landing-rise-3 landing-hero m-0 min-w-0">
              <div className="landing-hero__frame" data-ln-parallax="1">
                <Image
                  src={EXHIBIT.heroDesk.src}
                  alt={EXHIBIT.heroDesk.alt}
                  width={EXHIBIT.heroDesk.width}
                  height={EXHIBIT.heroDesk.height}
                  // Matches the CSS exactly: 74% of the measure below 600px
                  // (≈65vw once the gutters are taken out), capped at 23rem up
                  // to 900px and 30rem above. Asking for more only downloads
                  // pixels the frame cannot show.
                  sizes="(min-width: 900px) 30rem, (min-width: 600px) 23rem, 65vw"
                  className="landing-hero__img select-none"
                  priority
                  draggable={false}
                />
              </div>
              <figcaption className="landing-hero__caption">
                <span className="shrink-0 text-[11px] font-semibold tracking-[0.12em] text-[color:var(--ln-faint)]">
                  ۰۰
                </span>
                <span className="text-[12px] leading-6 text-[color:var(--ln-muted)]">
                  {EXHIBIT.heroDesk.caption.title} —{" "}
                  {EXHIBIT.heroDesk.caption.note}
                </span>
              </figcaption>
            </figure>
          </div>

          {/* Trust row — the three shipped measures, on one baseline. The
              numeral is isolated LTR so the sign never moves. */}
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-[color:var(--ln-line)] pt-6 tablet:mt-14 tablet:gap-8 tablet:pt-8">
            {statsItems.map((stat) => (
              <div key={stat.label} className="landing-stat">
                <dt className="landing-stat__label order-2 flex items-center gap-1.5">
                  <stat.icon
                    size={14}
                    aria-hidden="true"
                    className="hidden shrink-0 text-[color:var(--ln-faint)] tablet:block"
                  />
                  {stat.label}
                </dt>
                <dd className="landing-stat__value order-1">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ============================================================
          INTAKE DESK — «نمی‌دانید از کجا شروع کنید؟»
          ============================================================
          Deliberately given its own band: the hero ends on the trust row
          and 80–112px of air separates it from the desk, so the form never
          reads as welded to the first screen. Behaviour and API are
          untouched (LandingStartCard owns the whole hand-off). */}
      <div className="landing-container pt-16 tablet:pt-20 laptop:pt-28">
        <div className="landing-rule" aria-hidden="true">
          <span className="landing-exhibit__index">میز پذیرش</span>
        </div>
      </div>
      <LandingStartCard />

      {/* ============================================================
          01 · مسئله
          ============================================================ */}
      <section className={bandClass(false)} aria-labelledby="ch-problem-title">
        <div className="landing-container">
          <LandingExhibit
            id="ch-problem"
            index="۰۱"
            chapter="مسئله"
            art={EXHIBIT.complexity}
            scale="wide"
            variant="bare"
            title="سند حقوقی، وقتی فقط یک دسته کاغذ است"
            body={
              <p>
                قراردادها و اسناد حقوقی از بندهایی ساخته می‌شوند که به هم ارجاع
                می‌دهند: ضمیمه‌ها، تبصره‌ها، و آنچه در سند نوشته نشده است. خواندن
                دقیق همین جزئیات است که تفاوت میان یک تصمیم مطمئن و یک اشتباه
                پرهزینه را می‌سازد.
              </p>
            }
            footnote="سؤال درست، پیش از پاسخ درست می‌آید."
          />
        </div>
      </section>

      {/* ============================================================
          02 · ساختار — the three shipped steps
          ============================================================ */}
      <section className={bandClass(true)} aria-labelledby="ch-order-title">
        <div className="landing-container">
          <LandingExhibit
            id="ch-order"
            index="۰۲"
            chapter="ساختار"
            art={EXHIBIT.order}
            flip
            variant="mist"
            title="همان مسئله، این بار مرتب‌شده"
            body={
              <>
                <p>
                  لیگالیر موضوع شما را گام‌به‌گام پیش می‌برد؛ از طرح پرسش تا
                  تحلیلی که به منبع مشخص تکیه دارد.
                </p>

                <ol className="mt-6 border-t border-[color:var(--ln-line)]">
                  {howItWorksSteps.map((step) => (
                    <li
                      key={step.number}
                      className="flex gap-4 border-b border-[color:var(--ln-line)] py-4"
                    >
                      <span className="w-8 shrink-0 text-[12px] font-semibold leading-7 tabular-nums text-[color:var(--ln-cobalt)]">
                        {step.number}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-[14.5px] font-semibold leading-7 text-[color:var(--ln-ink)]">
                          <step.icon
                            size={16}
                            aria-hidden="true"
                            className="shrink-0 text-[color:var(--ln-faint)]"
                          />
                          {step.title}
                        </span>
                        <span className="mt-1 block text-[13px] leading-7 text-[color:var(--ln-muted)]">
                          {step.description}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            }
          />
        </div>
      </section>

      {/* ============================================================
          03 · گفت‌وگو
          ============================================================ */}
      <section className={bandClass(false)} aria-labelledby="ch-dialogue-title">
        <div className="landing-container">
          <LandingExhibit
            id="ch-dialogue"
            index="۰۳"
            chapter="گفت‌وگو"
            art={EXHIBIT.consultation}
            scale="narrow"
            variant="bare"
            title="پیش از هر سند، یک پرسش روشن"
            body={
              <p>
                موضوع را به زبان ساده و محاوره‌ای توضیح دهید. دستیار لیگالیر
                سؤال‌های تکمیلی می‌پرسد تا مسئله روشن شود و سپس تحلیل را با استناد
                به قوانین، آرای وحدت رویه و بخشنامه‌های معتبر پیش می‌برد.
              </p>
            }
            action={{ href: "/auth/mobile?intent=chat", label: "شروع مشاوره حقوقی" }}
          />
        </div>
      </section>

      {/* ============================================================
          04 · دانش — the topic register
          ============================================================ */}
      <section className={bandClass(true)} aria-labelledby="ch-knowledge-title">
        <div className="landing-container">
          <LandingExhibit
            id="ch-knowledge"
            index="۰۴"
            chapter="دانش"
            art={EXHIBIT.knowledge}
            flip
            variant="mist"
            title="قانون، رویه و تفسیر در یک تنه"
            body={
              <p>
                لیگالیر بر پایه منابع ساختاریافته حقوقی ایران آموزش دیده است:
                قانون اساسی، مدنی، کیفری، تجارت، خانواده، کار و مالیات — و
                هزاران پرونده واقعی.
              </p>
            }
          />

          {/* A register, not a card grid: six rows on hairlines read as a
              catalogue of subjects and keep the page from turning into a
              wall of boxes. */}
          <ul className="mt-12 grid gap-x-12 border-t border-[color:var(--ln-line)] tablet:grid-cols-2">
            {legalTopics.map((topic, index) => (
              <li
                key={topic.title}
                data-ln-reveal={String(index % 2)}
                className="flex gap-3 border-b border-[color:var(--ln-line)] py-5"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-[color:var(--ln-faint)]"
                >
                  <topic.icon size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold leading-7 text-[color:var(--ln-ink)]">
                    {topic.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-7 text-[color:var(--ln-muted)]">
                    {topic.description}
                  </p>
                  <p className="mt-1.5 text-[11.5px] leading-6 text-[color:var(--ln-faint)]">
                    {topic.keywords.join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================================
          05 · ارجاع — the source register
          ============================================================ */}
      <section className={bandClass(false)} aria-labelledby="ch-sources-title">
        <div className="landing-container">
          <LandingExhibit
            id="ch-sources"
            index="۰۵"
            chapter="ارجاع"
            art={EXHIBIT.sources}
            variant="bare"
            title="هر بند، به منبع خودش"
            body={
              <p>
                هر پاسخ با ارجاع دقیق به ماده قانونی، رأی وحدت رویه یا بخشنامه
                همراه است و وضعیت اعتبار هر منبع — معتبر، اصلاح‌شده یا منسوخ —
                به‌روشنی مشخص می‌شود.
              </p>
            }
          />

          <dl className="mt-12 border-t border-[color:var(--ln-line)]">
            {keySources.map((source, index) => (
              <div
                key={source.title}
                data-ln-reveal={String(index)}
                className="grid gap-1 border-b border-[color:var(--ln-line)] py-5 tablet:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] tablet:items-baseline tablet:gap-6"
              >
                <dt className="text-[15px] font-semibold leading-7 text-[color:var(--ln-ink)]">
                  {source.title}
                </dt>
                <dd className="text-[13px] leading-7 text-[color:var(--ln-muted)]">
                  {source.description}
                </dd>
                <dd className="flex items-baseline gap-3 text-[11.5px] leading-6 text-[color:var(--ln-faint)] tablet:justify-end">
                  <span className="tabular-nums">{source.articles}</span>
                  <span aria-hidden="true">·</span>
                  <span>مصوب {source.year}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ============================================================
          06 · تحلیل — two plates (the finding and its trace) plus the
          sample-question register
          ============================================================ */}
      <section className={bandClass(true)} aria-labelledby="ch-analysis-title">
        <div className="landing-container">
          <LandingExhibit
            id="ch-analysis"
            index="۰۶"
            chapter="تحلیل"
            art={EXHIBIT.contractAnalysis}
            secondaryArt={EXHIBIT.traceability}
            flip
            scale="wide"
            variant="mist"
            title="بندهای مهم، مشخص‌شده"
            body={
              <p>
                سند یا قرارداد را بارگذاری کنید؛ بندهای پرریسک و تعهدات پنهان
                شناسایی می‌شوند و هر یافته به متن سند و منبع قانونی آن وصل
                می‌شود.
              </p>
            }
            action={{ href: "/auth/mobile?intent=document", label: "تحلیل سند" }}
          />

          <div className="mt-14 border-t border-[color:var(--ln-line)] pt-8">
            <h3 className="text-[13px] font-semibold tracking-[0.06em] text-[color:var(--ln-ink)]">
              نمونه پرسش‌های واقعی
            </h3>
            <ul className="mt-4 grid gap-x-12 tablet:grid-cols-2">
              {sampleQuestions.map((item, index) => (
                <li key={item.question}>
                  <Link
                    href="/auth/mobile?intent=chat"
                    data-ln-reveal={String(index % 2)}
                    className="landing-row group flex items-start gap-3 border-b border-[color:var(--ln-line)] py-4"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-[color:var(--ln-faint)] transition-colors duration-[var(--ln-dur-fast)] group-hover:text-[color:var(--ln-cobalt)]"
                    >
                      <IconChat size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] leading-7 text-[color:var(--ln-ink)] transition-colors duration-[var(--ln-dur-fast)] group-hover:text-[color:var(--ln-cobalt)]">
                        {item.question}
                      </span>
                      <span className="mt-1 block text-[11.5px] leading-6 text-[color:var(--ln-faint)]">
                        {item.category} — {item.sourceRef}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============================================================
          07 · پیش‌نویس — the drafting family, including the real
          judicial wizard (unchanged behaviour and destinations)
          ============================================================ */}
      <section className={bandClass(false)} aria-labelledby="ch-drafting-title">
        <div className="landing-container">
          <LandingExhibit
            id="ch-drafting"
            index="۰۷"
            chapter="پیش‌نویس"
            art={EXHIBIT.drafting}
            secondaryArt={EXHIBIT.contractDomains}
            scale="wide"
            variant="bare"
            title="از پاسخ‌ها تا سند آمادهٔ بازبینی"
            body={
              <p>
                با پاسخ به پرسش‌نامه گام‌به‌گام، پیش‌نویس قرارداد شخصی‌سازی‌شده
                آماده می‌شود — املاک، خودرو، خانواده و کسب‌وکار. پیش‌نویس برای
                بازبینی خودتان و وکیل است.
              </p>
            }
            action={{ href: "/auth/mobile?intent=contract", label: "تولید پیش‌نویس قرارداد" }}
          />

          <div className="mt-12" data-ln-reveal="0">
            <JudicialServiceZone
              surface="home"
              mode="public"
              appearance="marketing"
              footer={
                <p className="mt-4 text-[12.5px] leading-7 text-[color:var(--ln-muted)]">
                  پیش‌نویس‌ها برای بازبینی خودتان و وکیل است؛ لیگالیر هیچ سندی را
                  در مرجع قضایی ثبت، ارسال یا ابلاغ نمی‌کند.
                </p>
              }
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          08 · محاسبه
          ============================================================ */}
      <section className={bandClass(true)} aria-labelledby="ch-calc-title">
        <div className="landing-container">
          <LandingExhibit
            id="ch-calc"
            index="۰۸"
            chapter="محاسبه"
            art={EXHIBIT.calculator}
            flip
            variant="mist"
            title="عدد دقیق، جای حدس"
            body={
              <p>
                محاسبات حقوقی — خسارت تأخیر تأدیه، مهریه، نفقه، ارث و دیه — بر
                پایه قواعد مصوب انجام می‌شود؛ هر عدد با قاعده و سال محاسبه‌اش
                همراه است.
              </p>
            }
            action={{ href: "/calculators", label: "محاسبه کنید" }}
          />
        </div>
      </section>

      {/* ============================================================
          SERVICES — the seven real services, rendered from the registry
          ============================================================ */}
      <section
        className={`${bandClass(false)} relative overflow-hidden`}
        aria-labelledby="services-title"
      >
        <LandingGeometry variant="services" />
        <div className="landing-container landing-layer">
          <header className="max-w-2xl" data-ln-reveal="0">
            <p className="landing-chapter">
              <span className="landing-chapter__num">۰۸</span>
              <span>کاتالوگ خدمات</span>
            </p>
            <h2 id="services-title" className="landing-title mt-4">
              خدمات <LandingHighlightWide draw>هوشمند</LandingHighlightWide> لیگالیر
            </h2>
            <p className="landing-lead mt-3 max-w-2xl">
              هفت سرویس تخصصی مبتنی بر هوش مصنوعی حقوقی؛ آموزش‌دیده بر نظام حقوقی
              ایران
            </p>
          </header>

          <LandingServices />
        </div>
      </section>

      {/* ============================================================
          09 · بازبینی
          ============================================================ */}
      <section className={bandClass(true)} aria-labelledby="ch-review-title">
        <div className="landing-container">
          <LandingExhibit
            id="ch-review"
            index="۰۹"
            chapter="بازبینی"
            art={EXHIBIT.review}
            scale="narrow"
            variant="mist"
            title="وقتی تصمیم به چشم متخصص نیاز دارد"
            body={
              <p>
                در موضوعات حساس، لیگالیر مسیر ارتباط با وکلای متخصص و تأییدشده
                را فراهم می‌کند — انتخاب وکیل بر اساس تخصص، شهر و بودجه، با
                شفافیت کامل در هزینه و سابقه.
              </p>
            }
            action={{ href: "/lawyers", label: "مشاهده وکلای تأییدشده" }}
          />
        </div>
      </section>

      {/* ============================================================
          10 · دقت — the three shipped distinctions, as a register
          ============================================================ */}
      <section className={bandClass(false)} aria-labelledby="ch-precision-title">
        <div className="landing-container">
          <LandingExhibit
            id="ch-precision"
            index="۱۰"
            chapter="دقت"
            // No plate here on purpose. The one unused drawing in the set is
            // a classical column, which the brief bans outright, so this
            // room is set in type (see `LandingExhibit` without `art`).
            flip
            variant="bare"
            title="اندازه‌گیری، نه تخمین"
            body={
              <p>
                لیگالیر مرز بین هوش مصنوعی، منابع معتبر حقوقی و وکیل متخصص را
                شفاف می‌کند؛ هر لایه مسئولیت خودش را دارد و هیچ‌کدام جای دیگری
                را نمی‌گیرد.
              </p>
            }
          />

          <ul className="mt-12 border-t border-[color:var(--ln-line)]">
            {distinctions.map((item, index) => (
              <li
                key={item.title}
                data-ln-reveal={String(index)}
                className="flex gap-4 border-b border-[color:var(--ln-line)] py-6"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-[color:var(--ln-ink)]"
                >
                  <item.icon size={20} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold leading-7 text-[color:var(--ln-ink)]">
                    {item.title}
                  </h3>
                  <p className="mt-1 max-w-3xl text-[13px] leading-7 text-[color:var(--ln-muted)]">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================================
          11 · همراهی
          ============================================================ */}
      <section className={bandClass(true)} aria-labelledby="ch-company-title">
        <div className="landing-container">
          <LandingExhibit
            id="ch-company"
            index="۱۱"
            chapter="همراهی"
            art={EXHIBIT.helpingHand}
            secondaryArt={EXHIBIT.guidance}
            scale="narrow"
            variant="mist"
            title="قدم‌به‌قدم، تا رسیدن به تصمیم"
            body={
              <>
                <p>
                  موضوع شما دست‌نخورده و روشن می‌ماند. متنی که در میز پذیرش
                  می‌نویسید فقط در همین تب و تا رسیدن به مرحلهٔ بعد نگه داشته
                  می‌شود؛ نه در نشانی صفحه و نه در گزارش‌ها.
                </p>
                <p className="mt-3">
                  هیچ تحلیلی پیش از رسیدن شما به مرحلهٔ بعد ساخته نمی‌شود.
                </p>
              </>
            }
          />
        </div>
      </section>

      {/* ============================================================
          12 · اعتماد
          ============================================================ */}
      <section className={bandClass(false)} aria-labelledby="ch-trust-title">
        <div className="landing-container">
          <LandingExhibit
            id="ch-trust"
            index="۱۲"
            chapter="اعتماد"
            art={EXHIBIT.judgment}
            flip
            scale="narrow"
            variant="bare"
            title="مسیر تخصصی، وقتی کار به وکیل می‌رسد"
            body={
              <p>
                لیگالیر جای وکیل را نمی‌گیرد. تحلیل و پیش‌نویس مسیر را روشن
                می‌کند؛ تصمیم نهایی و اقدام قضایی، کار وکیل و مرجع صالح است.
              </p>
            }
          />
        </div>
      </section>

      {/* ============================================================
          BLOG — a register of the three published posts
          ============================================================ */}
      <section
        className="border-y border-[color:var(--ln-line)] bg-[color:var(--ln-canvas)]"
        aria-labelledby="blog-title"
      >
        <div className="landing-container landing-section">
          <header className="max-w-2xl" data-ln-reveal="0">
            <p className="landing-eyebrow">
              <IconLawBook size={14} aria-hidden="true" />
              مجله و آموزش حقوقی لیگالیر
            </p>
            <h2 id="blog-title" className="landing-title mt-3">
              مجله و آموزش حقوقی لیگالیر
            </h2>
            <p className="landing-lead mt-3">
              راهنماهای کاربردی، قوانین، آرای مهم و تحلیل موضوعات حقوقی — بر پایه
              منابع ساختاریافته حقوقی
            </p>
          </header>

          <ol className="mt-10 border-t border-[color:var(--ln-line)]">
            {blogPreviewPosts.map((post, index) => (
              <li key={post.id}>
                <Link
                  href={`/blog/${post.slug}`}
                  data-ln-reveal={String(index)}
                  className="landing-row group grid gap-2 border-b border-[color:var(--ln-line)] py-6 tablet:grid-cols-[3.5rem_minmax(0,1fr)_auto] tablet:items-baseline tablet:gap-6"
                >
                  <span className="text-[11.5px] font-semibold tracking-[0.12em] tabular-nums text-[color:var(--ln-faint)]">
                    {toPersianDigits(index + 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15.5px] font-semibold leading-8 text-[color:var(--ln-ink)] transition-colors duration-[var(--ln-dur-fast)] group-hover:text-[color:var(--ln-cobalt)]">
                      {post.titleFa}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-[13px] leading-7 text-[color:var(--ln-muted)]">
                      {post.excerpt}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] leading-6 text-[color:var(--ln-muted)] tablet:justify-end">
                    <span className="inline-flex items-center gap-1">
                      <IconCategory size={12} aria-hidden="true" />
                      {post.category}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      {toPersianDigits(post.readingTime)} دقیقه
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconCalendar size={12} aria-hidden="true" />
                      {toPersianDate(post.publishedAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          <div className="mt-8">
            <Link href="/blog" className="landing-btn landing-btn--quiet">
              مشاهده همه مطالب وبلاگ
              <IconChevronLeft size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          FAQ — native disclosure elements: keyboard operable, announced
          by screen readers, and open/close without JavaScript.
          ============================================================ */}
      <section
        className="border-b border-[color:var(--ln-line)] bg-[color:var(--ln-surface)]"
        aria-labelledby="faq-title"
      >
        <div className="landing-container landing-section">
          <div className="grid gap-8 laptop:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] laptop:gap-16">
            <header className="self-start laptop:sticky laptop:top-28" data-ln-reveal="0">
              <p className="landing-eyebrow">پرسش‌های متداول</p>
              <h2 id="faq-title" className="landing-title mt-3">
                چیزهایی که پیش از شروع باید بدانید
              </h2>
              <p className="landing-lead mt-3">
                پاسخ‌ها همان چیزی است که در همین صفحه و در سند شفافیت لیگالیر
                آمده است.
              </p>
            </header>

            <div className="landing-faq divide-y divide-[color:var(--ln-line)] border-t border-[color:var(--ln-line)]">
              {faqItems.map((item) => (
                <details key={item.question}>
                  <summary className="flex items-center gap-3 py-5 text-[14.5px] font-medium leading-7 text-[color:var(--ln-ink)]">
                    {item.question}
                  </summary>
                  <p className="pb-5 pe-1 text-[13.5px] leading-7 text-[color:var(--ln-muted)]">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FINALE — the closed book, one action, and the shared
          disclaimer (its copy still lives in one component)
          ============================================================ */}
      <section className={bandClass(false)} aria-labelledby="finale-title">
        <div className="landing-container">
          {/* The closing room uses the exhibits' own grammar instead of the
              old "full-measure picture, then copy" stack: the chapter mark
              and the plate share a header row, the headline runs the full
              measure beneath them, and the actions close the block. Desktop
              still sees the two-column spread it had. */}
          <div className="landing-finale">
            <div className="landing-finale__mark min-w-0" data-ln-reveal="0">
              <p className="landing-chapter">
                <span className="landing-chapter__num">۱۳</span>
                <span>پایان نمایش</span>
              </p>
            </div>

            <figure className="landing-finale__art m-0 min-w-0" data-ln-reveal="0">
              <div data-ln-parallax="1">
                <Image
                  src={EXHIBIT.lawPrinciples.src}
                  alt={EXHIBIT.lawPrinciples.alt}
                  width={EXHIBIT.lawPrinciples.width}
                  height={EXHIBIT.lawPrinciples.height}
                  sizes="(min-width: 900px) 38vw, 42vw"
                  className="h-auto w-full select-none"
                  loading="lazy"
                  draggable={false}
                />
              </div>
              <figcaption className="landing-finale__caption">
                <span className="shrink-0 text-[11px] font-semibold tracking-[0.12em] text-[color:var(--ln-faint)]">
                  ۱۳
                </span>
                <span className="text-[12px] leading-6 text-[color:var(--ln-muted)]">
                  {EXHIBIT.lawPrinciples.caption.title} —{" "}
                  {EXHIBIT.lawPrinciples.caption.note}
                </span>
              </figcaption>
            </figure>

            <div className="landing-finale__copy min-w-0" data-ln-reveal="1">
              <h2
                id="finale-title"
                className="landing-title text-[clamp(1.5rem,1.1rem+1.6vw,2rem)]"
              >
                از یک <LandingHighlightWide draw>پرسش</LandingHighlightWide>{" "}
                شروع کنید
              </h2>
              <p className="landing-deck mt-4">
                مسیر روشن است: موضوع را بنویسید، تحلیل مستند بگیرید و اگر تصمیم
                به متخصص نیاز داشت، مسیر وکیل باز است.
              </p>
              <div className="mt-8 flex flex-col gap-3 tablet:flex-row tablet:items-center">
                <Link
                  href="/auth/mobile?intent=chat"
                  className="landing-btn landing-btn--primary w-full tablet:w-auto"
                >
                  شروع مشاوره حقوقی
                  <IconChevronLeft size={18} aria-hidden="true" />
                </Link>
                <Link
                  href="/pricing"
                  className="landing-btn landing-btn--secondary w-full tablet:w-auto"
                >
                  مشاهده تعرفه‌ها
                </Link>
              </div>
            </div>
          </div>

          <div className="landing-disclaimer mt-14" data-ln-reveal="0">
            <AIDisclaimer />
          </div>
        </div>
      </section>

      {/* ============================================================
          CTA — the four shipped entry paths. Rendered by the shared
          component so the copy has one owner and the unit test that
          covers it keeps exercising real production markup.
          ============================================================ */}
      <CTASection />
    </>
  );
}
