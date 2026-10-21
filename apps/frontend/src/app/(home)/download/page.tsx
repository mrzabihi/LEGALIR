import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DownloadPlatforms } from "@/components/public/landing/download-platforms";
import { LandingGeometry } from "@/components/public/landing/landing-geometry";
import { EXHIBIT } from "@/components/public/landing/exhibits";
import {
  IconChevronLeft,
  IconInstall,
  IconShield,
  IconDocument,
} from "@/lib/icons";

// ============================================================
// LEGALIR — /download
// ============================================================
// The distribution shelf. It lives in the `(home)` route group, so it
// inherits the landing header, the landing footer and the motion island —
// one visual language, and the `--ln-*` token scope, without a second
// header being written for one page.
//
// Honesty is the design constraint here. Exactly one channel ships today
// (the PWA), so three cards state «به‌زودی» as plain text and only the
// fourth carries a button. A row of four fake download buttons would be
// the easiest thing to build and the worst thing to ship: a visitor taps
// one, nothing happens, and the page spends the credibility the rest of
// the catalogue earns.
//
// Same rules as the rest of the landing: Persian numerals everywhere, no
// title closed with a full stop, cobalt rationed to one action per
// viewport, and every link resolves to a real route.

export const metadata: Metadata = {
  title: { absolute: "دانلود لیگالیر | نسخهٔ موبایل و وب" },
  description:
    "لیگالیر را روی گوشی نصب کنید — نسخهٔ وب (PWA) امروز در دسترس است و نسخه‌های کافه‌بازار، گوگل پلی و اپل استور به‌زودی منتشر می‌شوند",
  alternates: { canonical: "/download" },
};

const WHY = [
  {
    icon: IconInstall,
    title: "بدون فروشگاه، بدون انتظار",
    body: "نسخهٔ وب روی صفحهٔ اصلی گوشی می‌نشیند و مثل یک برنامهٔ نصب‌شده باز می‌شود؛ نه فروشگاهی در میان است و نه به‌روزرسانی دستی",
  },
  {
    icon: IconShield,
    title: "همان حساب، همان حریم خصوصی",
    body: "نصب چیزی را به اشتراک نمی‌گذارد: متن موضوع، اسناد و گفت‌وگوها همان‌جایی می‌مانند که در نسخهٔ وب هستند",
  },
  {
    icon: IconDocument,
    title: "همیشه از آخرین نسخه",
    body: "نسخهٔ وب به‌روزرسانی خودکار دارد؛ هر تغییری که منتشر شود، در بازکردن بعدی روی گوشی شماست",
  },
];

export default function DownloadPage() {
  return (
    <>
      {/* ---- Hero ------------------------------------------------- */}
      <section
        className="relative overflow-hidden border-b border-[color:var(--ln-line)]"
        aria-labelledby="download-title"
      >
        <LandingGeometry variant="hero" />
        <div className="landing-container landing-layer pb-12 pt-12 tablet:pb-16 tablet:pt-16 laptop:pb-20 laptop:pt-20">
          <div className="grid items-center gap-10 laptop:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] laptop:gap-14">
            <div className="min-w-0">
              <p className="landing-chapter">
                <span className="landing-chapter__num">۱۴</span>
                <span>همراه</span>
              </p>

              <h1
                id="download-title"
                className="mt-5 text-[clamp(2rem,1.15rem+3vw,3.25rem)] font-bold leading-[1.28] tracking-[-0.02em] text-[color:var(--ln-ink)] [text-wrap:balance]"
              >
                لیگالیر را روی گوشی داشته باشید
                <span className="mt-1 block text-[color:var(--ln-ink-soft)]">
                  همان‌جا که پرسش پیش می‌آید
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-[clamp(0.95rem,0.88rem+0.45vw,1.0625rem)] leading-[1.9] text-[color:var(--ln-ink-soft)] [text-wrap:pretty]">
                یک نسخه در دسترس است و سه نسخه در راه. نسخهٔ وب امروز نصب
                می‌شود؛ نسخه‌های فروشگاهی پس از انتشار همین‌جا اعلام می‌شوند.
              </p>

              <div className="mt-8 flex flex-col gap-3 tablet:flex-row tablet:items-center">
                <Link
                  href="/auth/mobile?intent=chat"
                  className="landing-btn landing-btn--primary w-full tablet:w-auto"
                >
                  شروع مشاوره حقوقی
                  <IconChevronLeft size={18} aria-hidden="true" />
                </Link>
                <Link
                  href="/"
                  className="landing-btn landing-btn--secondary w-full tablet:w-auto"
                >
                  بازگشت به صفحهٔ اصلی
                </Link>
              </div>
            </div>

            <figure className="m-0 min-w-0">
              <Image
                src={EXHIBIT.guidance.src}
                alt={EXHIBIT.guidance.alt}
                width={EXHIBIT.guidance.width}
                height={EXHIBIT.guidance.height}
                sizes="(min-width: 900px) 42vw, 88vw"
                className="h-auto w-full select-none"
                priority
                draggable={false}
              />
              <figcaption className="mt-3 flex items-baseline gap-2 border-t border-[color:var(--ln-line)] pt-2.5">
                <span className="shrink-0 text-[11px] font-semibold tracking-[0.12em] text-[color:var(--ln-faint)]">
                  ۱۴
                </span>
                <span className="text-[12px] leading-6 text-[color:var(--ln-muted)]">
                  {EXHIBIT.guidance.caption.title} — {EXHIBIT.guidance.caption.note}
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ---- The shelf -------------------------------------------- */}
      <section
        className="border-b border-[color:var(--ln-line)] bg-[color:var(--ln-canvas)]"
        aria-labelledby="shelf-title"
      >
        <div className="landing-container landing-section">
          <header className="max-w-2xl">
            <p className="landing-eyebrow">کانال‌های انتشار</p>
            <h2 id="shelf-title" className="landing-title mt-3">
              چهار راه، یک برنامه
            </h2>
            <p className="landing-lead mt-3">
              فروشگاه‌ها به‌ترتیب باز می‌شوند. تا آن روز، نسخهٔ وب کامل است و
              همان تجربه را می‌دهد.
            </p>
          </header>

          <div className="mt-10">
            <DownloadPlatforms />
          </div>
        </div>
      </section>

      {/* ---- Why the web version ---------------------------------- */}
      <section className="landing-section" aria-labelledby="why-title">
        <div className="landing-container">
          <div className="grid gap-10 laptop:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] laptop:gap-16">
            <header className="self-start laptop:sticky laptop:top-28">
              <p className="landing-eyebrow">چرا نسخهٔ وب</p>
              <h2 id="why-title" className="landing-title mt-3">
                نصب، بدون فروشگاه
              </h2>
              <p className="landing-lead mt-3">
                نسخهٔ وب همان برنامه است، فقط از راه دیگری روی گوشی می‌نشیند.
              </p>
            </header>

            <ul className="border-t border-[color:var(--ln-line)]">
              {WHY.map((item) => (
                <li
                  key={item.title}
                  className="flex gap-4 border-b border-[color:var(--ln-line)] py-6"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ln-r-sm)] border border-[color:var(--ln-line)] bg-[color:var(--ln-canvas)] text-[color:var(--ln-ink)]"
                  >
                    <item.icon size={20} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold leading-7 text-[color:var(--ln-ink)]">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-[13.5px] leading-7 text-[color:var(--ln-muted)]">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Closing ---------------------------------------------- */}
      <section
        className="border-t border-[color:var(--ln-line)] bg-[color:var(--ln-canvas)]"
        aria-labelledby="download-closing-title"
      >
        <div className="landing-container py-12 tablet:py-16">
          <div className="max-w-2xl">
            <h2 id="download-closing-title" className="landing-title">
              پرسشی مانده؟
            </h2>
            <p className="landing-lead mt-3">
              اگر نسخهٔ موردنیاز شما در فهرست نیست یا در نصب به مشکلی برخوردید،
              با ما در میان بگذارید.
            </p>
            <div className="mt-6 flex flex-col gap-3 tablet:flex-row tablet:items-center">
              <Link
                href="/contact"
                className="landing-btn landing-btn--secondary w-full tablet:w-auto"
              >
                تماس با پشتیبانی
              </Link>
              <Link
                href="/pricing"
                className="landing-link inline-flex min-h-11 items-center gap-1.5 px-1 text-[13.5px] font-medium text-[color:var(--ln-ink-soft)] transition-colors hover:text-[color:var(--ln-cobalt)]"
              >
                مشاهدهٔ تعرفه‌ها
                <IconChevronLeft size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
