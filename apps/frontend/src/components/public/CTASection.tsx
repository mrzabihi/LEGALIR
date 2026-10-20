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
        className="rounded-[var(--ln-r-xl)] border border-[color:var(--ln-line)] bg-[color:var(--ln-surface)] p-5 tablet:p-8 laptop:p-10"
      >
        <header className="max-w-xl">
          <h2 id="start-title" className="landing-title">
            از کجا شروع کنیم؟
          </h2>
          <p className="landing-lead mt-2">
            بر اساس نیاز حقوقی خود، یکی از مسیرهای تخصصی زیر را انتخاب کنید
          </p>
        </header>

        {/* Same card anatomy as the services grid: title, description, one
            inline action — and the whole card is the link. The previous
            version stacked a blurb above a separate action row in a tall
            card, which on a phone spent nearly a full screen on four links
            that mostly repeat the services above. Copy and destinations are
            unchanged. */}
        <ul className="mt-6 grid gap-3 tablet:mt-7 tablet:grid-cols-2 tablet:gap-4 laptop:grid-cols-4">
          {ctaCards.map((card, index) => (
            <li key={card.href}>
              <Link
                href={card.href}
                data-ln-reveal={String(index)}
                className={`landing-card group p-4 tablet:p-5 ${
                  // The pricing card is the only non-service path; the gold
                  // tint separates it without introducing a new accent.
                  card.href === "/pricing" ? "bg-[color:var(--ln-gold-soft)]" : ""
                }`}
              >
                <span className="block text-[14px] font-semibold leading-7 text-[color:var(--ln-navy)]">
                  {card.title}
                </span>
                <span className="mt-1 block text-[12.5px] leading-6 text-[color:var(--ln-muted)] tablet:mt-1.5 tablet:leading-7">
                  {card.description}
                </span>

                <span className="mt-auto flex items-center gap-1.5 pt-3 text-[12.5px] font-semibold text-[color:var(--ln-green)]">
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
