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

const categories = ["همه", "خدمات AI", "منابع", "مدیریت", "پلتفرم"] as const;

export default function FeaturesPage() {
  return (
    <>
      {/* Page Header - Gradient */}
      <section className="bg-gradient-to-b from-primary-800 to-primary-900 text-white py-16 tablet:py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h1 className="text-h1 text-white mb-4">قابلیت‌های LEGALIR</h1>
          <p className="text-body-1 text-primary-100/80 max-w-xl mx-auto leading-relaxed">
            LEGALIR چگونه به شما کمک می‌کند؟ با ابزارهای هوشمند حقوقی ما آشنا شوید
          </p>
        </div>
      </section>

      {/* Category filters */}
      <section className="bg-neutral-50 border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {categories.map((cat) => (
              <span
                key={cat}
                className="px-5 py-2 rounded-full text-body-2 text-neutral-600 bg-white border border-neutral-300 hover:border-primary-300 hover:text-primary-700 transition-colors cursor-pointer"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid tablet:grid-cols-2 desktop:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl bg-surface border border-neutral-200 shadow-sm hover:shadow-elevation-4 transition-shadow flex flex-col p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-700">
                    <f.icon size={24} />
                  </div>
                  {f.badge && (
                    <span className="text-caption px-2.5 py-0.5 rounded-full border border-primary-200 bg-primary-50 text-primary-700">
                      {f.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-h3 text-primary-800 mb-2">{f.title}</h3>
                <p className="text-body-2 text-neutral-500 mb-6 flex-1 leading-relaxed">
                  {f.description}
                </p>

                {f.href ? (
                  <Link
                    href={f.href}
                    className="inline-flex items-center justify-center rounded-medium bg-primary-700 text-white px-5 py-2.5 text-button hover:bg-primary-800 transition-colors touch-target mt-auto"
                  >
                    شروع کنید
                  </Link>
                ) : (
                  <p className="text-caption text-neutral-400 mt-auto">
                    در دسترس در نسخه فعلی
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-neutral-50 border-t border-neutral-200 py-16">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-h2 text-primary-800 mb-3">
            آماده شروع هستید؟
          </h2>
          <p className="text-body-1 text-neutral-500 mb-8 max-w-lg mx-auto leading-relaxed">
            بدون نیاز به پرداخت اولیه، دسترسی محدود رایگان دریافت کنید و
            قابلیت‌های LEGALIR را تجربه کنید
          </p>
          <Link
            href="/auth/mobile"
            className="inline-block rounded-medium bg-primary-700 text-white px-10 py-4 text-button hover:bg-primary-800 transition-colors touch-target shadow-elevation-1 hover:shadow-elevation-4"
          >
            شروع رایگان — بدون نیاز به پرداخت اولیه
          </Link>
          <p className="text-caption text-neutral-400 mt-4">
            با ثبت‌نام، دسترسی محدود رایگان دریافت می‌کنید
          </p>
        </div>
      </section>
    </>
  );
}
