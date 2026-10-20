// ============================================================
// LEGALIR — Landing · «موضوعات پرکاربرد حقوقی»
// ============================================================
// One calm topic grid. The previous version layered a blurred photograph,
// frosted-glass cards, a pointer-tracking spotlight and a scroll-reactive
// glow over the same six topics; on a phone that meant a `backdrop-filter`
// on every card plus a scroll listener running behind the smooth scroller,
// and none of it carried information. The redesign keeps only the content:
// one bordered card per topic, a keyword chip row, and the standard
// `.landing-card` hover (real pointers only).
//
// The topic data is NOT owned here — it is passed in from the server page so
// there stays a single source of truth for the copy.

import Link from "next/link";

export interface LegalTopic {
  icon: string;
  title: string;
  description: string;
  keywords: string[];
}

export function LegalTopicsSection({ topics }: { topics: LegalTopic[] }) {
  return (
    <section className="landing-section" aria-labelledby="legal-topics-title">
      <div className="landing-container">
        <header className="mx-auto max-w-2xl text-center" data-ln-reveal="0">
          <p className="landing-eyebrow justify-center">موضوعات حقوقی</p>
          <h2 id="legal-topics-title" className="landing-title mt-3">
            موضوعات پرکاربرد حقوقی
          </h2>
          <p className="landing-lead mx-auto mt-3 max-w-xl">
            لیگالیر در حوزه‌های متنوع حقوقی آموزش داده شده است. هر حوزه شامل منابع قانونی،
            آرای قضایی و تحلیل تخصصی مرتبط می‌باشد.
          </p>
        </header>

        <ul className="mt-10 grid gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
          {topics.map((topic, index) => (
            <li key={topic.title}>
              <Link
                href="/auth/mobile?intent=chat"
                data-ln-reveal={String(index % 3)}
                className="landing-card p-5"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ln-r-md)] bg-[color:var(--ln-gold-soft)] text-[19px] leading-none"
                    aria-hidden="true"
                  >
                    {topic.icon}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15.5px] font-semibold leading-8 text-[color:var(--ln-navy)]">
                      {topic.title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-7 text-[color:var(--ln-muted)]">
                      {topic.description}
                    </p>
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
                  {topic.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-[var(--ln-r-sm)] bg-[color:var(--ln-canvas)] px-2 py-0.5 text-[11.5px] leading-6 text-[color:var(--ln-ink-soft)]"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
