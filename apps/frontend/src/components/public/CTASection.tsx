import Link from "next/link";

import { IconChevronLeft } from "@/lib/icons";

const ctaCards: {
  title: string;
  description: string;
  href: string;
  cta: string;
  variant: keyof typeof cardStyles;
}[] = [
  {
    title: "مشاوره حقوقی با هوش مصنوعی",
    description:
      "پرسش حقوقی خود را مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید",
    href: "/auth/mobile?intent=chat",
    cta: "شروع مشاوره",
    variant: "primary",
  },
  {
    title: "تحلیل هوشمند اسناد",
    description:
      "قراردادها و اسناد خود را بارگذاری کنید و بندهای پرریسک را با گزارش تحلیل دقیق شناسایی کنید",
    href: "/auth/mobile?intent=document",
    cta: "تحلیل سند",
    variant: "default",
  },
  {
    title: "تولید پیش‌نویس قرارداد",
    description:
      "با پاسخ به پرسش‌نامه گام‌به‌گام، قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید",
    href: "/auth/mobile?intent=contract",
    cta: "ایجاد قرارداد",
    variant: "default",
  },
  {
    title: "مشاهده تعرفه‌ها",
    description:
      "پلن مناسب خود را انتخاب کنید و با قیمت شفاف از خدمات تخصصی LEGALIR استفاده کنید",
    href: "/pricing",
    cta: "مشاهده اشتراک‌ها",
    variant: "outlined",
  },
];

const cardStyles = {
  primary: {
    card: "bg-primary-700 text-white shadow-elevation-4 hover:shadow-elevation-10 border border-primary-600",
    seam: "bg-gradient-to-l from-secondary-400 via-secondary-300 to-secondary-200",
    title: "text-white",
    desc: "text-primary-100 opacity-80",
    cta: "bg-white text-primary-800 group-hover:bg-neutral-100",
    chevron: "text-primary-700",
  },
  default: {
    card: "bg-surface shadow-elevation-1 hover:shadow-elevation-8 border border-divider hover:border-primary-200",
    seam: "bg-gradient-to-l from-primary-400 via-primary-300 to-primary-100",
    title: "text-primary-800 group-hover:text-primary-600",
    desc: "text-neutral-500",
    cta: "bg-primary-50 text-primary-700 group-hover:bg-primary-100",
    chevron: "text-primary-600",
  },
  outlined: {
    card: "bg-surface border border-primary-200 shadow-elevation-1 hover:shadow-elevation-6 hover:border-primary-400",
    seam: "bg-gradient-to-l from-secondary-400 via-secondary-300 to-primary-300",
    title: "text-primary-800 group-hover:text-primary-600",
    desc: "text-neutral-500",
    cta: "bg-primary-700 text-white group-hover:bg-primary-800",
    chevron: "text-white",
  },
};

export function CTASection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 pt-4 tablet:pb-24 tablet:pt-6">
      <div className="mb-10 text-center tablet:mb-12" data-reveal>
        <h2 className="text-h2 text-primary-800 mb-3">از کجا شروع کنیم؟</h2>
        <p className="text-body-1 text-neutral-500 max-w-xl mx-auto leading-relaxed">
          بر اساس نیاز حقوقی خود، یکی از مسیرهای تخصصی زیر را انتخاب کنید
        </p>
      </div>

      <div className="grid tablet:grid-cols-2 desktop:grid-cols-4 gap-4">
        {ctaCards.map((card, i) => {
          const s = cardStyles[card.variant];
          return (
            <Link
              key={card.href}
              href={card.href}
              data-reveal
              data-reveal-delay={String((i % 4) + 1)}
              className={`rounded-large p-6 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1.5 active:scale-[0.98] flex flex-col group h-full overflow-hidden relative motion-reduce:transform-none motion-reduce:transition-none ${s.card}`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 top-0 h-[3px] ${s.seam}`}
              />
              <h3
                className={`text-h3 mb-2 transition-colors duration-200 ${s.title}`}
              >
                {card.title}
              </h3>
              <p
                className={`text-body-2 mb-5 flex-1 transition-colors duration-200 leading-relaxed ${s.desc}`}
              >
                {card.description}
              </p>
              <span
                className={`mt-auto inline-flex items-center justify-center gap-1.5 rounded-medium px-4 py-2.5 text-button font-medium shadow-sm transition-[background-color,box-shadow] duration-200 group-hover:shadow-md ${s.cta}`}
              >
                {card.cta}
                <IconChevronLeft
                  size={16}
                  aria-hidden="true"
                  className={`shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transform-none ${s.chevron}`}
                />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
