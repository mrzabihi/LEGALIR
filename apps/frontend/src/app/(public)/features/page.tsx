import type { Metadata } from "next";
import Link from "next/link";
import {
  IconChat,
  IconDocument,
  IconContract,
  IconHistory,
  IconSearch,
  IconShield,
} from "@/lib/icons";

export const metadata: Metadata = {
  title: "قابلیت‌های LEGALIR | پلتفرم هوشمند حقوقی",
  description:
    "قابلیت‌های LEGALIR: تحلیل حقوقی با هوش مصنوعی، تولید پیش‌نویس قرارداد، تحلیل اسناد، منابع حقوقی معتبر، تاریخچه دسته‌بندی‌شده و تجربه کاملاً فارسی",
  alternates: { canonical: "/features" },
};

const features = [
  {
    icon: IconChat,
    title: "تحلیل حقوقی با هوش مصنوعی",
    description:
      "مسئله حقوقی خود را به زبان ساده بیان کنید و تحلیل اولیه با استناد به قوانین و منابع معتبر دریافت کنید. هوش مصنوعی LEGALIR حوزه حقوقی را تشخیص می‌دهد، سوالات تکمیلی می‌پرسد و تحلیل ساختاریافته با سطح ریسک ارائه می‌دهد.",
    category: "خدمات AI",
    badge: "خروجی هوش مصنوعی",
    href: "/auth/mobile?intent=chat",
  },
  {
    icon: IconContract,
    title: "تولید پیش‌نویس قرارداد",
    description:
      "با پاسخ به پرسش‌نامه مرحله‌ای، پیش‌نویس قرارداد شخصی‌سازی‌شده دریافت کنید. انواع قراردادهای اجاره، NDA، استخدام، پیمانکاری و شراکت در نسخه اولیه پشتیبانی می‌شوند.",
    category: "خدمات AI",
    badge: "پیش‌نویس خودکار",
    href: "/auth/mobile?intent=contract",
  },
  {
    icon: IconDocument,
    title: "تحلیل و بررسی اسناد",
    description:
      "قراردادها و اسناد حقوقی خود را با فرمت PDF، DOCX یا تصویر بارگذاری کنید. سیستم با پردازش هوشمند، بندهای پرریسک را شناسایی می‌کند، پیشنهاد اصلاح ارائه می‌دهد و گزارش تحلیل حقوقی کامل تولید می‌کند.",
    category: "خدمات AI",
    badge: "کمک حقوقی",
    href: "/auth/mobile?intent=document",
  },
  {
    icon: IconSearch,
    title: "منابع و مستندات حقوقی",
    description:
      "تمام پاسخ‌های AI با ارجاع دقیق به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه است. وضعیت اعتبار هر منبع (معتبر / اصلاح‌شده / منسوخ) به صورت شفاف مشخص شده است.",
    category: "منابع",
    badge: "منابع معتبر",
    href: null,
  },
  {
    icon: IconHistory,
    title: "تاریخچه دسته‌بندی‌شده",
    description:
      "تمام گفتگوها، اسناد و قراردادها در تاریخچه شخصی شما با دسته‌بندی حقوقی (پرونده‌ها، قراردادها، املاک، خانواده، تجارت) ذخیره می‌شوند. جستجو و دسترسی سریع به تمام فعالیت‌های گذشته.",
    category: "مدیریت",
    badge: null,
    href: null,
  },
  {
    icon: IconShield,
    title: "تجربه کاملاً فارسی و امن",
    description:
      "رابط کاربری کاملاً فارسی با فونت وزیر، تقویم جلالی، اعداد فارسی و طراحی راست‌به‌چپ. تمام اصطلاحات حقوقی با دقت و بر اساس فرهنگ حقوقی ایران انتخاب شده‌اند. داده‌های شما رمزنگاری شده و محرمانه باقی می‌مانند.",
    category: "پلتفرم",
    badge: null,
    href: null,
  },
];

export default function FeaturesPage() {
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-h1 text-on-surface mb-3">قابلیت‌های LEGALIR</h1>
          <p className="text-body-1 text-muted max-w-xl mx-auto">
            LEGALIR چگونه به شما کمک می‌کند؟ با ما آشنا شوید
          </p>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          {["همه", "خدمات AI", "منابع", "مدیریت", "پلتفرم"].map((cat) => (
            <span
              key={cat}
              className="px-4 py-2 rounded-full text-body-2 text-on-surface bg-surface border border-divider"
            >
              {cat}
            </span>
          ))}
        </div>

        {/* Features Grid */}
        <div className="grid tablet:grid-cols-2 desktop:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider hover:shadow-elevation-4 transition-shadow flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-12 w-12 rounded-large bg-primary/10 flex items-center justify-center text-primary">
                  <f.icon size={24} />
                </div>
                {f.badge && (
                  <span className="text-caption px-2 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary">
                    {f.badge}
                  </span>
                )}
              </div>

              <h3 className="text-h3 text-on-surface mb-2">{f.title}</h3>
              <p className="text-body-2 text-muted mb-4 flex-1">{f.description}</p>

              {f.href ? (
                <Link
                  href={f.href}
                  className="inline-flex items-center justify-center rounded-medium bg-primary text-white px-4 py-2.5 text-button hover:bg-primary-variant transition-colors touch-target mt-2"
                >
                  شروع کنید
                </Link>
              ) : (
                <p className="text-caption text-muted">در دسترس در نسخه فعلی</p>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <Link
            href="/auth/mobile"
            className="inline-block rounded-medium bg-primary text-white px-10 py-4 text-button hover:bg-primary-variant transition-colors touch-target"
          >
            شروع رایگان — بدون نیاز به پرداخت اولیه
          </Link>
          <p className="text-caption text-muted mt-3">
            با ثبت‌نام، دسترسی محدود رایگان دریافت می‌کنید
          </p>
        </div>
      </div>
    </>
  );
}
