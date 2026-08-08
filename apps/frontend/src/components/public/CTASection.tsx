import Link from "next/link";

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
    card: "bg-primary-700 text-white shadow-elevation-4 hover:shadow-elevation-8 border border-primary-600",
    title: "text-white",
    desc: "text-primary-100/70",
    cta: "bg-white text-primary-800 hover:bg-neutral-100 active:bg-white/85",
  },
  default: {
    card: "bg-surface shadow-elevation-1 hover:shadow-elevation-8 border border-divider hover:border-primary-100",
    title: "text-primary-800 group-hover:text-primary-600",
    desc: "text-neutral-500",
    cta: "bg-primary-50 text-primary-700 hover:bg-primary-100 active:bg-primary-200",
  },
  outlined: {
    card: "bg-surface border-2 border-primary-200/60 shadow-elevation-1 hover:shadow-elevation-4 hover:border-primary-400/50",
    title: "text-primary-800 group-hover:text-primary-600",
    desc: "text-neutral-500",
    cta: "bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900",
  },
};

export function CTASection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 tablet:py-24">
      <div className="text-center mb-12">
        <h2 className="text-h2 text-primary-800 mb-3">از کجا شروع کنیم؟</h2>
        <p className="text-body-1 text-neutral-500 max-w-xl mx-auto leading-relaxed">
          بر اساس نیاز حقوقی خود، یکی از مسیرهای تخصصی زیر را انتخاب کنید
        </p>
      </div>

      <div className="grid tablet:grid-cols-2 desktop:grid-cols-4 gap-4">
        {ctaCards.map((card) => {
          const s = cardStyles[card.variant];
          return (
            <Link
              key={card.href}
              href={card.href}
              className={`rounded-large p-6 transition-all duration-300 hover:-translate-y-1.5 active:scale-[0.98] flex flex-col group ${s.card}`}
            >
              <h3
                className={`text-h3 mb-2 transition-colors duration-200 ${s.title}`}
              >
                {card.title}
              </h3>
              <p
                className={`text-body-2 mb-4 flex-1 transition-colors duration-200 leading-relaxed ${s.desc}`}
              >
                {card.description}
              </p>
              <span
                className={`inline-block text-center py-2.5 px-4 rounded-medium text-button font-medium transition-all duration-200 shadow-sm hover:shadow-md ${s.cta}`}
              >
                {card.cta}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
