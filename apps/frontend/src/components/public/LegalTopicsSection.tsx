// ============================================================
// LEGALIR — Landing · «موضوعات پرکاربرد حقوقی»
// ============================================================
// A client surface because the section carries a pointer- and scroll-reactive
// light. The photographic backdrop (a blurred legal editorial) is layered
// under a brand ivory scrim so the dark heading copy keeps WCAG AA; the topic
// cards are frosted glass and each casts a gold spotlight that tracks the
// cursor, while a section-wide glow drifts as the page scrolls — so the
// effect is alive on both desktop (pointer) and mobile (scroll).
//
// The topic data is NOT owned here — it is passed in from the server page so
// there stays a single source of truth for the copy.

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { IconCategory } from "@/lib/icons";

export interface LegalTopic {
  icon: string;
  title: string;
  description: string;
  keywords: string[];
}

export function LegalTopicsSection({ topics }: { topics: LegalTopic[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [reduced, setReduced] = useState(false);

  // Honour prefers-reduced-motion: the effect is decorative, so it must be
  // fully static (a calm centred glow) for anyone who asks for less motion.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Scroll-reactive ambient light — the section's viewport progress is mapped
  // to a CSS var the glow reads, so it stays lit even with no pointer (mobile).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || reduced) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      el.style.setProperty("--sec-progress", p.toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  // The section-wide glow tracks the pointer.
  function onSectionMove(e: React.MouseEvent<HTMLElement>) {
    const el = sectionRef.current;
    if (!el || reduced) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(2)}%`);
    el.style.setProperty("--my", `${(((e.clientY - r.top) / r.height) * 100).toFixed(2)}%`);
  }

  // The per-card spotlight tracks the pointer inside that card.
  function onCardMove(e: React.MouseEvent<HTMLElement>) {
    if (reduced) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--x", `${e.clientX - r.left}px`);
    el.style.setProperty("--y", `${e.clientY - r.top}px`);
  }

  return (
    <section
      ref={sectionRef}
      onMouseMove={onSectionMove}
      className="relative overflow-hidden px-4 py-20 tablet:py-24"
      style={
        {
          "--mx": "50%",
          "--my": "42%",
          "--sec-progress": "0.5",
        } as React.CSSProperties
      }
    >
      {/* Photographic backdrop — a blurred legal editorial under a brand ivory
          scrim. The scrim (not the image) is what keeps the dark heading copy
          at WCAG AA while the artwork still reads as a soft photograph. */}
      <div className="absolute inset-0" aria-hidden="true">
        <Image
          src="/assets/legalir-landing-topics.webp"
          alt=""
          fill
          sizes="100vw"
          className="scale-110 object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(252,246,232,0.94)_0%,rgba(252,246,232,0.72)_44%,rgba(252,246,232,0.88)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-10%,rgba(29,98,78,0.10),transparent_62%)]" />
      </div>

      {/* Section-wide ambient gold light — follows the pointer and drifts
          downward as the section scrolls through the viewport. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(560px circle at var(--mx) calc(var(--my) - (var(--sec-progress) - 0.5) * 30%), rgba(198,155,56,0.40), transparent 64%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/60 backdrop-blur-md border border-white/70 px-4 py-1.5 text-caption font-medium text-info-700 mb-4 shadow-elevation-1">
            <IconCategory size={16} className="text-info-600" />
            موضوعات حقوقی
          </div>
          <h2 className="text-h2 text-primary-800 mb-3">موضوعات پرکاربرد حقوقی</h2>
          <p className="text-body-1 text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            لیگالیر در حوزه‌های متنوع حقوقی آموزش داده شده است. هر حوزه شامل منابع قانونی،
            آرای قضایی و تحلیل تخصصی مرتبط می‌باشد.
          </p>
        </div>

        <div className="grid tablet:grid-cols-2 desktop:grid-cols-3 gap-5">
          {topics.map((topic) => (
            <Link
              key={topic.title}
              href="/auth/mobile?intent=chat"
              onMouseMove={onCardMove}
              className="group relative overflow-hidden rounded-large border border-white/60 bg-white/55 p-6 shadow-elevation-1 backdrop-blur-xl card-lift card-press transition-all duration-300 hover:border-white/80 hover:bg-white/70"
              style={{ "--x": "50%", "--y": "50%" } as React.CSSProperties}
            >
              {/* Pointer spotlight — a gold light that follows the cursor. */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden="true"
                style={{
                  background:
                    "radial-gradient(240px circle at var(--x) var(--y), rgba(198,155,56,0.30), transparent 60%)",
                }}
              />
              {/* Top hairline sheen — the glass edge catch-light. */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"
                aria-hidden="true"
              />

              <div className="relative flex items-start gap-4 mb-3">
                <span className="text-[32px] leading-none shrink-0" aria-hidden="true">
                  {topic.icon}
                </span>
                <div>
                  <h3 className="text-h3 text-primary-800 mb-1.5 group-hover:text-primary-600 transition-colors">
                    {topic.title}
                  </h3>
                  <p className="text-body-2 text-neutral-600 leading-relaxed">
                    {topic.description}
                  </p>
                </div>
              </div>

              <div className="relative flex items-center gap-1.5 flex-wrap">
                {topic.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-caption text-neutral-600 bg-white/60 backdrop-blur-md border border-white/70 rounded-full px-2.5 py-0.5"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
