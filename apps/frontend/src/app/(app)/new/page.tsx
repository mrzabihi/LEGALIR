// ============================================================
// LEGALIR — New Service Page (Phase 14)
// Quick-start shortcuts + link to full services catalog
// ============================================================

import Link from "next/link";

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
// Page Component
// ============================================================

export default function NewServicePage() {
  return (
    <div className="p-4 tablet:p-6 max-w-4xl mx-auto" dir="rtl">
      {/* Header with link to full catalog */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-h2 text-on-surface mb-2">ساخت جدید</h1>
          <p className="text-body-2 text-muted">چه خدمتی نیاز دارید؟ یکی از گزینه‌های پرکاربرد را انتخاب کنید</p>
        </div>
        <Link
          href="/services"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-medium border border-primary/30 bg-primary/5 text-primary px-4 py-2 text-button font-medium hover:bg-primary/10 transition-colors touch-target"
        >
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
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          مشاهده همه خدمات
        </Link>
      </div>

      {/* Category sections */}
      <ServiceCategorySection
        title="مشاوره حقوقی"
        services={quickServices.filter((s) => s.category === "مشاوره")}
      />
      <ServiceCategorySection
        title="قراردادها"
        services={quickServices.filter((s) => s.category === "قراردادها")}
      />
      <ServiceCategorySection
        title="اسناد حقوقی"
        services={quickServices.filter((s) => s.category === "اسناد")}
      />
      <ServiceCategorySection
        title="پرونده‌ها"
        services={quickServices.filter((s) => s.category === "پرونده‌ها")}
      />
      <ServiceCategorySection
        title="محاسبات حقوقی"
        services={quickServices.filter((s) => s.category === "محاسبات")}
      />

      {/* Bottom link to full catalog */}
      <div className="mt-8 p-6 rounded-large bg-surface-container border border-divider text-center">
        <p className="text-body-1 text-on-surface mb-3">
          خدمات بیشتری نیاز دارید؟
        </p>
        <p className="text-body-2 text-muted mb-4">
          برای مشاهده فهرست کامل خدمات LEGALIR با توضیحات، زمان تخمینی و نوع خروجی، به صفحه خدمات مراجعه کنید
        </p>
        <Link
          href="/services"
          className="inline-flex items-center gap-1.5 rounded-medium bg-primary text-white px-6 py-2.5 text-button font-medium hover:bg-primary-600 transition-colors touch-target"
        >
          رفتن به فهرست کامل خدمات
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
    </div>
  );
}

// ============================================================
// ServiceCategorySection — grouped service cards
// ============================================================

function ServiceCategorySection({
  title,
  services,
}: {
  title: string;
  services: QuickService[];
}) {
  if (services.length === 0) return null;

  return (
    <section className="mb-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="block h-0.5 w-8 rounded-full bg-primary-800/60" />
        <h2 className="text-h3 text-on-surface font-medium">{title}</h2>
      </div>

      {/* Service Cards Grid */}
      <div className="grid tablet:grid-cols-3 gap-4">
        {services.map((service) => (
          <Link
            key={service.href + service.title}
            href={service.href}
            className="rounded-large bg-surface p-5 shadow-elevation-1 hover:shadow-elevation-4 transition-shadow border border-divider text-center group active:scale-[0.98]"
          >
            <div className="text-4xl mb-4">{service.icon}</div>
            <h3 className="text-h3 text-on-surface mb-2 group-hover:text-primary transition-colors">
              {service.title}
            </h3>
            <p className="text-body-2 text-muted">{service.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
