// ============================================================
// LEGALIR — Hero visual: a document being read structurally
// ============================================================
// The brief asks the hero for "a visual element related to the understanding
// and analysis of legal documents". This is that element, and it is CODE —
// no stock photo and no third-party illustration — so it inherits the brand
// palette exactly and cannot go stale against the product.
//
// What it depicts is the product's actual claim, nothing more: a legal
// document whose clauses are being segmented, each segment anchored to a
// source. The article references below are NOT new claims — they are the same
// citations the page already prints in its sample-questions section
// (ماده ۴۹۴ و ۲۳۰ قانون مدنی، ماده ۵۲۲ آیین دادرسی مدنی), reused here so the
// visual and the rest of the page can never disagree.
//
// Motion: one slow highlight sweep crosses the clause rows once on entry.
// It is decorative, stops entirely under `prefers-reduced-motion`, and the
// visual is fully legible without it.
//
// It is a SERVER component — no state, no effects, no client bundle cost.

interface HeroAnalysisVisualProps {
  className?: string;
}

/** The clause bands. `weight` drives the drawn line width, so the sheet reads
 *  like real Persian body copy (ragged, with a short final line) rather than
 *  a stack of equal bars. */
const CLAUSES = [
  { weight: 100, cited: false },
  { weight: 92, cited: true },
  { weight: 97, cited: false },
  { weight: 64, cited: true },
];

/** Reused from the page's own sample citations — not new legal assertions. */
const SOURCES = ["ماده ۴۹۴ قانون مدنی", "ماده ۲۳۰ قانون مدنی", "ماده ۵۲۲ آیین دادرسی"];

export function HeroAnalysisVisual({ className = "" }: HeroAnalysisVisualProps) {
  return (
    <div
      aria-hidden="true"
      // `tablet:pb-10` reserves the band the floating caption sits in, so the
      // caption can never cover the source chips at the foot of the sheet.
      className={`relative isolate select-none tablet:pb-10 ${className}`}
      // Decorative: the hero's copy already states the same thing in words,
      // so nothing here is needed by assistive tech.
    >
      {/* One soft brand glow behind the sheet. Static — painted once and never
          animated, so it costs no compositor work after paint. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(58% 58% at 78% 22%, rgba(29,98,78,0.55), transparent 70%)," +
            "radial-gradient(46% 46% at 16% 88%, rgba(198,155,56,0.22), transparent 72%)",
        }}
      />

      {/* The sheet. Solid, bordered, one elevation step — no glass stack. */}
      <div className="relative overflow-hidden rounded-[var(--ln-r-lg)] border border-white/[0.12] bg-[#101a22] shadow-[0_28px_60px_-32px_rgba(0,0,0,0.85)]">
        {/* Sheet header: a filing label and a status pill. */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <span className="text-[11px] font-medium leading-5 text-white/45">
            سند حقوقی · در حال بررسی
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--ln-green)]/20 px-2 py-0.5 text-[10.5px] font-medium leading-5 text-[#7FD3B4]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7FD3B4]" />
            تحلیل ساختاریافته
          </span>
        </div>

        {/* Clause rows. Each row is a marker rail + drawn copy lines. */}
        <div className="relative px-4 py-4">
          {/* The single sweep. `motion-reduce:hidden` keeps it out of
              reduced-motion entirely rather than merely shortening it. */}
          <span className="ln-sweep pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-[color:var(--ln-gold)]/[0.12] to-transparent motion-reduce:hidden" />

          <ul className="relative space-y-3.5">
            {CLAUSES.map((clause, index) => (
              <li key={index} className="flex items-start gap-2.5">
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    clause.cited ? "bg-[color:var(--ln-gold)]" : "bg-white/25"
                  }`}
                />
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span
                    className={`block h-1.5 rounded-full ${
                      clause.cited ? "bg-white/30" : "bg-white/16"
                    }`}
                    style={{ width: `${clause.weight}%` }}
                  />
                  <span
                    className="block h-1.5 rounded-full bg-white/10"
                    style={{ width: `${Math.max(38, clause.weight - 26)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>

          {/* Source anchors — the point of the whole picture. */}
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
            {SOURCES.map((source) => (
              <span
                key={source}
                className="rounded-[6px] bg-white/[0.06] px-2 py-1 text-[10px] leading-4 text-white/55"
              >
                {source}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* A small floating attribution card, deliberately offset so the
          composition is not a single centred rectangle. It sits in the
          reserved bottom band, clear of the chips. */}
      <div className="absolute bottom-0 start-4 hidden items-center gap-2 rounded-[var(--ln-r-md)] border border-white/[0.12] bg-[#16242c] px-3 py-2 shadow-[0_16px_32px_-20px_rgba(0,0,0,0.9)] tablet:flex">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--ln-gold)]/15 text-[10px] font-bold text-[color:var(--ln-gold)]">
          {CLAUSES.filter((c) => c.cited).length}
        </span>
        <span className="text-[10.5px] leading-4 text-white/60">بند با ارجاع به منبع</span>
      </div>
    </div>
  );
}
