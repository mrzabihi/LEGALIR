// ============================================================
// LEGALIR — ساخت جدید (/new)
// ============================================================
// A client surface (like /services and /cases): the campaign banner it
// embeds carries an `icon` component, which cannot cross the
// server→client boundary as a prop. The page itself is static.
// A grouped launcher, not a wall of identical white tiles. Each
// category owns a distinct accent family — the same per-category
// colours the /services catalog already uses — so the page reads as
// five differentiated zones instead of one flat list:
//
//   • a tinted section panel (accent wash + accent border)
//   • a large faint category motif watermarked into the panel corner
//   • a gradient header chip carrying the category icon
//   • service cards that inherit the accent: a tinted glyph tile, a
//     gradient hairline and an accent hover, each with its OWN motif so
//     two services in the same zone never read as the same tile
//
// A contract-relevant campaign banner sits directly under the
// contract zone, and one closing CTA links to the full catalog.
//
// Every service name, description and destination is unchanged from
// the data below — this file only changes how they are presented. The
// accent hexes are the ones already used by the matching service
// banners in `@/lib/services/catalog`, so «قرارداد = green» and
// «محاسبه = gold» mean the same thing on both surfaces.
// ============================================================

"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import {
  IconCalculator,
  IconChat,
  IconChevronRight,
  IconDocument,
  IconFilePen,
  IconFileSearch,
  IconFileText,
  IconFiles,
  IconGavel,
  IconGrid,
  IconSearch,
  IconSparkle,
} from "@/lib/icons";
import { CampaignBanner } from "@/components/services/campaign-banner";
import { SECONDARY_CAMPAIGN, type IconComponent } from "@/lib/services/catalog";

// ============================================================
// Data
// ============================================================

interface QuickService {
  href: string;
  title: string;
  description: string;
  icon: string;
  category: string;
}

const quickServices: QuickService[] = [
  // --- Consultation ---
  {
    href: "/chat",
    title: "گفت‌وگوی حقوقی",
    description: "سوال خود را مطرح کنید و تحلیل حقوقی با استناد به منابع دریافت کنید",
    icon: "💬",
    category: "مشاوره",
  },
  {
    href: "/chat",
    title: "تحلیل اولیه مسئله",
    description: "مسئله خود را شرح دهید تا تحلیل حقوقی، چارچوب و رویه‌های مرتبط ارائه شود",
    icon: "🔍",
    category: "مشاوره",
  },
  {
    href: "/chat",
    title: "شناسایی ریسک‌های حقوقی",
    description: "ریسک‌های بالقوه در موضوع شما شناسایی و راهکار پیشگیری ارائه می‌شود",
    icon: "⚠️",
    category: "مشاوره",
  },

  // --- Contracts ---
  {
    href: "/contracts",
    title: "تولید قرارداد هوشمند",
    description: "با پاسخ به پرسش‌نامه، پیش‌نویس قرارداد شخصی‌سازی‌شده بسازید",
    icon: "📝",
    category: "قراردادها",
  },
  {
    href: "/documents",
    title: "بررسی و تحلیل قرارداد",
    description: "قرارداد خود را بارگذاری کنید تا تحلیل ریسک و شروط نامتعارف دریافت کنید",
    icon: "🔎",
    category: "قراردادها",
  },
  {
    href: "/documents",
    title: "شناسایی بندهای پرریسک",
    description: "بندهای پرریسک قرارداد با توضیح و پیشنهاد اصلاح شناسایی می‌شود",
    icon: "🚨",
    category: "قراردادها",
  },

  // --- Documents ---
  {
    href: "/chat?category=formal_letter",
    title: "تولید اظهارنامه",
    description: "اظهارنامه رسمی حقوقی با ذکر مستندات قانونی و خواسته‌های شما",
    icon: "✉️",
    category: "اسناد",
  },
  {
    href: "/chat",
    title: "تولید لایحه و دادخواست",
    description: "لایحه دفاعیه یا دادخواست حقوقی مطابق فرمت رسمی دادگستری",
    icon: "📋",
    category: "اسناد",
  },
  {
    href: "/documents",
    title: "خلاصه‌سازی اسناد حقوقی",
    description: "متن سند خود را بارگذاری کنید تا خلاصه اجرایی و نکات کلیدی استخراج شود",
    icon: "📑",
    category: "اسناد",
  },

  // --- Cases ---
  {
    href: "/documents",
    title: "ثبت و مدیریت پرونده",
    description: "پرونده جدید با مشخصات، طرفین، موضوع و اسناد مرتبط ایجاد کنید",
    icon: "📁",
    category: "پرونده‌ها",
  },
  {
    href: "/chat",
    title: "تحلیل وضعیت پرونده",
    description: "وضعیت پرونده تحلیل و پیش‌بینی روند، نقاط قوت و ضعف ارائه می‌شود",
    icon: "📊",
    category: "پرونده‌ها",
  },
  {
    href: "/history",
    title: "تایم‌لاین و پیگیری",
    description: "تایم‌لاین زمانی پرونده با ثبت وقایع، جلسات و مهلت‌های کلیدی",
    icon: "⏱️",
    category: "پرونده‌ها",
  },

  // --- Calculations ---
  {
    href: "/calculators",
    title: "همه محاسبه‌گرها",
    description: "فهرست کامل محاسبه‌گرهای حقوقی و استخدامی با نتایج مستند",
    icon: "🧮",
    category: "محاسبات",
  },
  {
    href: "/calculators/court-fee",
    title: "هزینه دادرسی",
    description: "محاسبه هزینه دادرسی بر اساس نوع دعوی، ارزش خواسته و مرحله رسیدگی",
    icon: "⚖️",
    category: "محاسبات",
  },
  {
    href: "/calculators/diyeh",
    title: "دیه",
    description: "محاسبه دیه بر اساس نوع آسیب و وقوع در ماه حرام",
    icon: "🩹",
    category: "محاسبات",
  },
  {
    href: "/calculators/delayed-payment",
    title: "خسارت تأخیر تأدیه",
    description: "محاسبه خسارت تأخیر تأدیه بر پایه شاخص تورم",
    icon: "📈",
    category: "محاسبات",
  },
  {
    href: "/calculators/dowry",
    title: "مهریه به نرخ روز",
    description: "بازارزش مهریه بر پایه شاخص قیمت سال ازدواج و مطالبه",
    icon: "💍",
    category: "محاسبات",
  },
  {
    href: "/calculators/salary",
    title: "حقوق خالص و ناخالص",
    description: "تبدیل حقوق ناخالص به خالص و بالعکس با احتساب بیمه و مالیات",
    icon: "💵",
    category: "محاسبات",
  },
  {
    href: "/calculators/bonus",
    title: "عیدی و پاداش",
    description: "محاسبه عیدی پایان سال با اعمال سقف قانونی",
    icon: "🎁",
    category: "محاسبات",
  },
  {
    href: "/calculators/severance",
    title: "سنوات",
    description: "محاسبه حق سنوات بر اساس مزد آخرین ماه و سابقه کار",
    icon: "📅",
    category: "محاسبات",
  },
  {
    href: "/calculators/leave-buyback",
    title: "بازخرید مرخصی",
    description: "محاسبه ارزش مرخصی استفاده‌نشده بر مبنای مزد روزانه",
    icon: "🏖️",
    category: "محاسبات",
  },
];

// ============================================================
// Category presentation
// ============================================================
// One accent family per zone. The `accent` hexes mirror the matching
// service banners in the catalog; the `gradient` classes mirror the
// per-category gradients already used on /services, so the whole app
// agrees on what each category looks like.

interface CategoryMeta {
  title: string;
  accent: string;
  gradient: string;
  icon: IconComponent;
}

/** The zones in reading order, top to bottom. */
const SECTION_ORDER = ["مشاوره", "قراردادها", "اسناد", "پرونده‌ها", "محاسبات"] as const;

const CATEGORY_META: Record<(typeof SECTION_ORDER)[number], CategoryMeta> = {
  مشاوره: {
    title: "مشاوره و تحلیل حقوقی",
    accent: "#6844C7",
    gradient: "from-blue-500 to-indigo-500",
    icon: IconChat,
  },
  قراردادها: {
    title: "قراردادها و اسناد تعهدآور",
    accent: "#32B183",
    gradient: "from-emerald-500 to-teal-500",
    icon: IconFilePen,
  },
  اسناد: {
    title: "نامه‌نگاری و اسناد حقوقی",
    accent: "#2F5FD0",
    gradient: "from-cyan-500 to-blue-500",
    icon: IconFiles,
  },
  "پرونده‌ها": {
    title: "پرونده‌ها و پیگیری",
    accent: "#7C3AED",
    gradient: "from-violet-500 to-purple-500",
    icon: IconGavel,
  },
  محاسبات: {
    title: "محاسبه‌گرهای حقوقی",
    accent: "#D89A13",
    gradient: "from-amber-600 to-yellow-500",
    icon: IconCalculator,
  },
};

/**
 * A motif per notable service. The brief names these explicitly, so they
 * get their own line-art glyph watermarked into the card; anything not
 * listed falls back to the category motif so no tile is ever unbranded.
 */
const SERVICE_MOTIF: Record<string, IconComponent> = {
  "گفت‌وگوی حقوقی": IconChat,
  "تحلیل اولیه مسئله": IconSearch,
  "شناسایی ریسک‌های حقوقی": IconFileSearch,
  "تولید قرارداد هوشمند": IconFilePen,
  "بررسی و تحلیل قرارداد": IconFileSearch,
  "شناسایی بندهای پرریسک": IconFileSearch,
  "تولید اظهارنامه": IconFileText,
  "تولید لایحه و دادخواست": IconDocument,
  "خلاصه‌سازی اسناد حقوقی": IconFiles,
};

/** Persian-digit count for the zone badge. */
function countFa(n: number): string {
  return n.toLocaleString("fa-IR");
}

// ============================================================
// Page Component
// ============================================================

export default function NewServicePage() {
  const byCategory = (category: string) =>
    quickServices.filter((s) => s.category === category);

  return (
    <div className="mx-auto max-w-5xl p-4 tablet:p-6" dir="rtl">
      {/* Hero — a brand panel so the launcher opens with intent instead
          of a bare heading. The destination (full catalog) is unchanged. */}
      <header className="relative mb-6 overflow-hidden rounded-xlarge bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 p-5 text-white shadow-elevation-3 tablet:p-6">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -end-12 h-52 w-52 rounded-full bg-[var(--brand-gold)] opacity-20 blur-3xl"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -start-16 h-52 w-52 rounded-full bg-black opacity-20 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-caption font-medium text-white backdrop-blur-sm">
              <IconSparkle size={14} />
              شروع سریع
            </span>
            <h1 className="mt-3 text-h2 font-bold text-white">ساخت جدید</h1>
            <p className="mt-2 max-w-lg text-body-2 leading-relaxed text-white/80">
              چه خدمتی نیاز دارید؟ یکی از گزینه‌های پرکاربرد را انتخاب کنید
            </p>
          </div>
          <Link
            href="/services"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-button font-semibold text-primary-800 shadow-elevation-1 transition-all duration-short4 ease-standard hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-800 touch-target"
          >
            <IconGrid size={16} />
            مشاهده همه خدمات
          </Link>
        </div>
      </header>

      {/* Zones in order, with the contract-relevant campaign slotted
          straight under the contract zone. */}
      {SECTION_ORDER.map((category) => (
        <div key={category}>
          <ServiceCategorySection
            meta={CATEGORY_META[category]}
            services={byCategory(category)}
          />

          {category === "قراردادها" && (
            <CampaignBanner banner={SECONDARY_CAMPAIGN} size="panel" className="mb-6" />
          )}
        </div>
      ))}

      {/* Closing CTA to the full catalog — same destination, restyled. */}
      <div className="mt-2 rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface-container p-6 text-center">
        <p className="text-body-1 text-on-surface mb-3">خدمات بیشتری نیاز دارید؟</p>
        <p className="mx-auto mb-4 max-w-xl text-body-2 text-muted">
          برای مشاهده فهرست کامل خدمات LEGALIR با توضیحات، زمان تخمینی و نوع خروجی، به صفحه خدمات
          مراجعه کنید
        </p>
        <Link
          href="/services"
          className="inline-flex items-center gap-1.5 rounded-medium bg-primary px-6 py-2.5 text-button font-medium text-primary-on transition-colors hover:bg-primary-600 hover:text-white touch-target"
        >
          رفتن به فهرست کامل خدمات
          <IconChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// ServiceCategorySection — a differentiated zone
// ============================================================

function ServiceCategorySection({
  meta,
  services,
}: {
  meta: CategoryMeta;
  services: QuickService[];
}) {
  if (services.length === 0) return null;

  const MetaIcon = meta.icon;

  // One accent → the panel wash, its border, the tile/heading ink and a
  // faint watermark tone. `--ctg-ink` mixes toward on-surface so the
  // accent stays legible in both light and dark themes.
  const vars = {
    "--ctg": meta.accent,
    "--ctg-soft": `color-mix(in srgb, ${meta.accent} 7%, var(--color-surface))`,
    "--ctg-tile": `color-mix(in srgb, ${meta.accent} 14%, transparent)`,
    "--ctg-border": `color-mix(in srgb, ${meta.accent} 26%, transparent)`,
    "--ctg-ink": `color-mix(in srgb, ${meta.accent} 74%, var(--color-on-surface))`,
    "--ctg-dim": `color-mix(in srgb, ${meta.accent} 12%, transparent)`,
  } as CSSProperties;

  return (
    <section
      style={{ ...vars, backgroundColor: "var(--ctg-soft)", borderColor: "var(--ctg-border)" }}
      className="relative mb-6 overflow-hidden rounded-xlarge border p-4 tablet:p-5"
    >
      {/* Large faint category motif watermarked into the corner. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 -start-6"
        style={{ color: "var(--ctg-dim)" }}
      >
        <MetaIcon size={190} />
      </span>

      <div className="relative">
        {/* Zone header — gradient chip + title + count. */}
        <div className="mb-4 flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${meta.gradient} text-white shadow-elevation-1`}
          >
            <MetaIcon size={22} />
          </span>
          <h2 className="text-h3 font-semibold text-on-surface">{meta.title}</h2>
          <span
            className="ms-auto rounded-full border px-2.5 py-0.5 text-caption font-medium"
            style={{
              backgroundColor: "var(--ctg-tile)",
              borderColor: "var(--ctg-border)",
              color: "var(--ctg-ink)",
            }}
          >
            {countFa(services.length)} خدمت
          </span>
        </div>

        <div className="grid gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
          {services.map((service) => (
            <ServiceTile
              key={service.href + service.title}
              service={service}
              meta={meta}
              Motif={SERVICE_MOTIF[service.title] ?? meta.icon}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// ServiceTile — one service inside a zone
// ============================================================

function ServiceTile({
  service,
  meta,
  Motif,
}: {
  service: QuickService;
  meta: CategoryMeta;
  Motif: IconComponent;
}) {
  return (
    <Link
      href={service.href}
      className="group relative flex h-full flex-col overflow-hidden rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 transition-all duration-short4 ease-standard hover:-translate-y-0.5 hover:border-[color:var(--ctg-border)] hover:shadow-elevation-3 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ctg)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ctg-soft)] touch-target"
    >
      {/* Accent hairline — the zone's colour, carried onto every tile. */}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${meta.gradient} opacity-80`}
      />

      {/* Faint per-service motif, so two tiles never look alike. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 -end-3"
        style={{ color: "var(--ctg-dim)" }}
      >
        <Motif size={96} />
      </span>

      <div className="relative flex items-center gap-3">
        {/* The service's own glyph, seated on the zone's tinted tile. */}
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium text-[26px] leading-none"
          style={{ backgroundColor: "var(--ctg-tile)" }}
        >
          {service.icon}
        </span>
        <h3 className="text-titleSmall font-semibold text-on-surface transition-colors group-hover:text-[color:var(--ctg-ink)]">
          {service.title}
        </h3>
      </div>

      <p className="relative mt-2.5 text-body-2 leading-relaxed text-muted">{service.description}</p>

      <span
        className="relative mt-auto inline-flex items-center gap-1.5 pt-3 text-labelMedium font-medium"
        style={{ color: "var(--ctg-ink)" }}
      >
        شروع
        <IconChevronRight
          size={16}
          className="transition-transform duration-short4 ease-standard group-hover:-translate-x-0.5"
        />
      </span>
    </Link>
  );
}
