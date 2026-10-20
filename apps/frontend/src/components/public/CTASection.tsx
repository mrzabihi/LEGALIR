import Link from "next/link";

import { IconChevronLeft } from "@/lib/icons";

// ============================================================
// LEGALIR — Landing · «از کجا شروع کنیم؟» (final CTA)
// ============================================================
// The four shipped entry paths, unchanged in copy and destination. The
// redesign only re-presents them with the scoped landing tokens: one card
// recipe, one CTA affordance, and a gold-tinted pricing card so it reads
// as the secondary path rather than a fourth service.
//
// This component is landing-only; the classes it uses (`landing-card`,
// `--ln-*`) are scoped to the `.landing` wrapper, so nothing here can
// restyle an app surface.

const ctaCards = [
  {
    title: "مشاوره حقوقی با هوش مصنوعی",
    description:
      "پرسش حقوقی خود را مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید",
    href: "/auth/mobile?intent=chat",
    cta: "شروع مشاوره",
  },
  {
    title: "تحلیل هوشمند اسناد",
    description:
      "قراردادها و اسناد خود را بارگذاری کنید و بندهای پرریسک را با گزارش تحلیل دقیق شناسایی کنید",
    href: "/auth/mobile?intent=document",
    cta: "تحلیل سند",
  },
  {
    title: "تولید پیش‌نویس قرارداد",
    description:
      "با پاسخ به پرسش‌نامه گام‌به‌گام، قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید",
    href: "/auth/mobile?intent=contract",
    cta: "ایجاد قرارداد",
  },
  {
    title: "مشاهده تعرفه‌ها",
    description:
      "پلن مناسب خود را انتخاب کنید و با قیمت شفاف از خدمات تخصصی LEGALIR استفاده کنید",
    href: "/pricing",
    cta: "مشاهده اشتراک‌ها",
  },
];

export function CTASection() {
  return (
    <section className="landing-container pb-16 tablet:pb-20" aria-labelledby="start-title">
      <div
        data-ln-reveal="0"
        className="rounded-[var(--ln-r-xl)] border border-[color:var(--ln-line)] bg-[color:var(--ln-surface)] p-6 tablet:p-8 laptop:p-10"
      >
        <header className="max-w-xl">
          <h2 id="start-title" className="landing-title">
            از کجا شروع کنیم؟
          </h2>
          <p className="landing-lead mt-2">
            بر اساس نیاز حقوقی خود، یکی از مسیرهای تخصصی زیر را انتخاب کنید
          </p>
        </header>

        <ul className="mt-7 grid gap-3 tablet:grid-cols-2 laptop:grid-cols-4">
          {ctaCards.map((card, index) => (
            <li key={card.href}>
              <Link
                href={card.href}
                data-ln-reveal={String(index)}
                className={`landing-card group justify-between gap-4 p-5 ${
                  // The pricing card is the only non-service path; the gold
                  // tint separates it without introducing a new accent.
                  card.href === "/pricing" ? "bg-[color:var(--ln-gold-soft)]" : ""
                }`}
              >
                <span>
                  <span className="block text-[14px] font-semibold leading-7 text-[color:var(--ln-navy)]">
                    {card.title}
                  </span>
                  <span className="mt-1.5 block text-[12.5px] leading-7 text-[color:var(--ln-muted)]">
                    {card.description}
                  </span>
                </span>

                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--ln-green)]">
                  {card.cta}
                  <IconChevronLeft
                    size={15}
                    aria-hidden="true"
                    className="transition-transform duration-300 group-hover:-translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
