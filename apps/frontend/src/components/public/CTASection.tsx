import Link from "next/link";

const ctaCards: {
  title: string;
  description: string;
  href: string;
  cta: string;
  variant: keyof typeof cardStyles;
  iconBg: string;
}[] = [
  {
    title: "مشاوره حقوقی با هوش مصنوعی",
    description: "مسئله حقوقی خود را بپرسید و تحلیل اولیه با استناد به قوانین ایران دریافت کنید",
    href: "/auth/mobile?intent=chat",
    cta: "شروع مشاوره",
    variant: "primary",
    iconBg: "bg-white/20",
  },
  {
    title: "تحلیل و بررسی اسناد",
    description: "قراردادها و اسناد خود را بارگذاری کنید و بندهای پرریسک را شناسایی کنید",
    href: "/auth/mobile?intent=document",
    cta: "تحلیل سند",
    variant: "default",
    iconBg: "bg-primary/10",
  },
  {
    title: "تولید پیش‌نویس قرارداد",
    description: "با پاسخ به پرسش‌نامه، قرارداد شخصی‌سازی‌شده مطابق قوانین ایران دریافت کنید",
    href: "/auth/mobile?intent=contract",
    cta: "ایجاد قرارداد",
    variant: "default",
    iconBg: "bg-secondary/10",
  },
  {
    title: "مشاهده تعرفه‌ها",
    description: "پلن مناسب خود را انتخاب کنید و با قیمت مناسب از خدمات LEGALIR استفاده کنید",
    href: "/pricing",
    cta: "مشاهده اشتراک‌ها",
    variant: "outlined",
    iconBg: "bg-primary/5",
  },
];

const cardStyles = {
  primary: {
    card: "bg-primary text-white shadow-elevation-4 hover:shadow-elevation-8 gradient-border",
    title: "text-white",
    desc: "text-white/75",
    cta: "bg-white text-primary hover:bg-white/90 active:bg-white/80",
  },
  default: {
    card: "bg-surface shadow-elevation-1 hover:shadow-elevation-8 border border-divider",
    title: "text-on-surface group-hover:text-primary",
    desc: "text-muted",
    cta: "bg-primary/10 text-primary hover:bg-primary/20 active:bg-primary/30",
  },
  outlined: {
    card: "bg-surface border-2 border-primary/20 shadow-elevation-1 hover:shadow-elevation-4 hover:border-primary/40",
    title: "text-on-surface group-hover:text-primary",
    desc: "text-muted",
    cta: "bg-primary text-white hover:bg-primary-variant active:bg-primary/80",
  },
};

export function CTASection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center mb-10">
        <h2 className="text-h2 text-on-surface mb-2">از کجا شروع کنیم؟</h2>
        <p className="text-body-1 text-muted max-w-xl mx-auto">
          LEGALIR چهار مسیر اصلی برای کمک به شما دارد. بر اساس نیاز خود انتخاب کنید
        </p>
      </div>

      <div className="grid tablet:grid-cols-2 desktop:grid-cols-4 gap-4">
        {ctaCards.map((card, _idx) => {
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
                className={`text-body-2 mb-4 flex-1 transition-colors duration-200 ${s.desc}`}
              >
                {card.description}
              </p>
              <span
                className={`inline-block text-center py-2.5 px-4 rounded-medium text-button transition-all duration-200 shadow-sm hover:shadow-md ${s.cta}`}
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
