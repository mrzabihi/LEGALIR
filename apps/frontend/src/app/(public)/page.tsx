import type { Metadata } from "next";
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
} from "@/lib/icons";

export const metadata: Metadata = {
  title: "LEGALIR | دستیار هوشمند حقوقی ایران",
  description:
    "پلتفرم هوشمند قوانین و قراردادهای حقوقی ایران — تحلیل حقوقی با هوش مصنوعی، بررسی اسناد، تولید پیش‌نویس قرارداد و اتصال به وکلای متخصص",
  alternates: { canonical: "/" },
};

const highlights = [
  {
    icon: IconChat,
    title: "تحلیل حقوقی با هوش مصنوعی",
    description:
      "مسئله حقوقی خود را به زبان ساده بیان کنید و تحلیل اولیه با استناد به قوانین و منابع معتبر ایران دریافت کنید",
    href: "/auth/mobile?intent=chat",
    badge: "اطلاعات AI",
    badgeClass: "bg-info/10 text-info border-info/20",
  },
  {
    icon: IconDocument,
    title: "بررسی هوشمند اسناد",
    description:
      "قراردادها و اسناد حقوقی خود را بارگذاری کنید و بندهای پرریسک را با گزارش تحلیل دقیق شناسایی کنید",
    href: "/auth/mobile?intent=document",
    badge: "کمک حقوقی",
    badgeClass: "bg-success/10 text-success border-success/20",
  },
  {
    icon: IconContract,
    title: "تولید پیش‌نویس قرارداد",
    description:
      "با پاسخ به پرسش‌نامه مرحله‌ای، پیش‌نویس قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید",
    href: "/auth/mobile?intent=contract",
    badge: "پیش‌نویس خودکار",
    badgeClass: "bg-secondary/10 text-secondary border-secondary/20",
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
  },
  {
    icon: IconBalance,
    title: "منابع معتبر حقوقی",
    description:
      "هر پاسخ با ارجاع دقیق به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه است. وضعیت اعتبار هر منبع (معتبر / اصلاح‌شده / منسوخ) مشخص شده است.",
    color: "border-r-success",
    accentBg: "bg-success/5",
  },
  {
    icon: IconSearch,
    title: "کمک حقوقی، نه جایگزین وکیل",
    description:
      "LEGALIR یک ابزار کمک‌آموزشی است. در موضوعات حساس، ارجاع به وکیل متخصص توصیه می‌شود. در آینده امکان اتصال به وکلای تأییدشده فراهم خواهد شد.",
    color: "border-r-primary",
    accentBg: "bg-primary/5",
  },
];

const statsItems = [
  { value: "۳", label: "خدمات اصلی", icon: IconCheckCircle },
  { value: "۶+", label: "دسته‌بندی حقوقی", icon: IconBalance },
  { value: "۲۴/۷", label: "دسترسی آنلاین", icon: IconShield },
];

export default function LandingPage() {
  return (
    <div id="main-content">
      {/* Hero — with mesh gradient background */}
      <section className="relative overflow-hidden bg-hero-mesh">
        {/* Decorative floating blobs */}
        <div
          className="absolute -top-32 -start-32 w-96 h-96 rounded-full opacity-[0.06] animate-float"
          style={{
            background: "radial-gradient(circle, var(--color-primary), transparent 70%)",
            animationDelay: "0s",
          }}
        />
        <div
          className="absolute -bottom-24 -end-24 w-80 h-80 rounded-full opacity-[0.05] animate-float"
          style={{
            background: "radial-gradient(circle, var(--color-secondary), transparent 70%)",
            animationDelay: "1.5s",
          }}
        />
        <div
          className="absolute top-1/3 end-1/4 w-64 h-64 rounded-full opacity-[0.04] animate-float"
          style={{
            background: "radial-gradient(circle, var(--color-primary), transparent 70%)",
            animationDelay: "3s",
          }}
        />

        <div className="mx-auto max-w-4xl px-4 pt-20 pb-16 tablet:pt-32 tablet:pb-24 text-center relative">
          {/* Compact AI disclaimer badge */}
          <div className="mb-6 animate-fade-in">
            <AIDisclaimer compact />
          </div>

          <h1 className="text-h1 text-on-surface mb-4 leading-tight scroll-reveal visible">
            دستیار هوشمند حقوقی ایران
          </h1>
          <p className="text-body-1 text-muted mb-8 max-w-2xl mx-auto scroll-reveal visible" style={{ transitionDelay: "100ms" }}>
            با <strong className="text-on-surface">LEGALIR</strong>، مسائل حقوقی خود را با
            هوش مصنوعی تحلیل کنید، قراردادهای هوشمند بسازید، اسناد خود را بررسی کنید
            و در آینده به وکلای متخصص متصل شوید
          </p>

          {/* Hero CTAs — with glow effect */}
          <div className="flex flex-col mobile-s:flex-row items-center justify-center gap-3 mb-6 scroll-reveal visible" style={{ transitionDelay: "200ms" }}>
            <Link
              href="/auth/mobile?intent=chat"
              className="rounded-medium bg-primary text-white px-8 py-4 text-button hover:bg-primary-variant transition-all duration-300 touch-target w-full mobile-s:w-auto animate-glow hover:shadow-elevation-8 active:scale-[0.98]"
            >
              شروع مشاوره حقوقی
            </Link>
            <Link
              href="/features"
              className="rounded-medium border-2 border-border text-on-surface px-8 py-4 text-button hover:bg-surface hover:border-primary/30 transition-all duration-300 touch-target w-full mobile-s:w-auto active:scale-[0.98]"
            >
              مشاهده قابلیت‌ها
            </Link>
          </div>

          {/* Disclaimer note */}
          <p className="flex items-center justify-center gap-1 text-caption text-muted scroll-reveal visible" style={{ transitionDelay: "300ms" }}>
            <IconArrowBack size={14} className="text-warning shrink-0" />
            LEGALIR جایگزین وکیل نیست — ابزاری برای آگاهی حقوقی اولیه
          </p>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-divider bg-surface/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-geometric-pattern pointer-events-none" />
        <div className="mx-auto max-w-6xl px-4 py-6 relative">
          <div className="flex flex-col tablet:flex-row items-center justify-center gap-6 tablet:gap-12">
            {statsItems.map((stat, _idx) => (
              <div key={stat.label} className="flex items-center gap-2 text-muted">
                <div className="h-8 w-8 rounded-medium bg-primary/10 flex items-center justify-center">
                  <stat.icon size={18} className="text-primary shrink-0" />
                </div>
                <span className="text-h3 text-on-surface font-bold">{stat.value}</span>
                <span className="text-body-2">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-h2 text-on-surface mb-2">خدمات هوشمند LEGALIR</h2>
          <p className="text-body-1 text-muted max-w-xl mx-auto">
            سه مسیر اصلی برای کمک به شما — هر کدام با شفافیت درباره نقش هوش مصنوعی
          </p>
        </div>

        <div className="grid tablet:grid-cols-3 gap-6">
          {highlights.map((item, _idx) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider card-lift card-press group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-12 w-12 rounded-large bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 group-hover:shadow-elevation-4 group-hover:scale-105">
                  <item.icon size={24} />
                </div>
                <span
                  className={`text-caption px-2 py-0.5 rounded-full border ${item.badgeClass}`}
                >
                  {item.badge}
                </span>
              </div>
              <h3 className="text-h3 text-on-surface mb-2 group-hover:text-primary transition-colors duration-200">{item.title}</h3>
              <p className="text-body-2 text-muted">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Distinctions — clarifying AI vs Lawyer roles */}
      <section className="mx-auto max-w-6xl px-4 py-16 border-t border-divider">
        <div className="text-center mb-10">
          <h2 className="text-h2 text-on-surface mb-2">شفافیت در خدمات</h2>
          <p className="text-body-1 text-muted max-w-xl mx-auto">
            LEGALIR تفاوت بین هوش مصنوعی، منابع حقوقی و وکیل را شفاف می‌کند
          </p>
        </div>

        <div className="grid tablet:grid-cols-3 gap-6">
          {distinctions.map((item) => (
            <div
              key={item.title}
              className={`rounded-large bg-surface p-6 border-r-4 ${item.color} border border-divider shadow-elevation-1 card-lift ${item.accentBg}`}
            >
              <div className="h-10 w-10 rounded-medium bg-surface-variant flex items-center justify-center text-primary mb-3 transition-colors duration-200 group-hover:bg-primary/10">
                <item.icon size={22} />
              </div>
              <h3 className="text-h3 text-on-surface mb-2">{item.title}</h3>
              <p className="text-body-2 text-muted">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Full AI Disclaimer */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <AIDisclaimer />
      </section>

      {/* CTA Section */}
      <CTASection />
    </div>
  );
}
