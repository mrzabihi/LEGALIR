// ============================================================
// LEGALIR — Legal article block components
// ============================================================
// One presentational component per block kind. They are pure: no
// hooks, no state, no data fetching — so they render identically on
// the server (for SEO) and in tests.
//
// The visual language is translated from the source deck: a warm
// editorial surface, a bronze accent for legal authority, numbered
// cards for parallel items, and a rail for the timeline. Colours
// come from MD3 tokens only — no invented hex values.
// ============================================================

import React from "react";
import {
  IconLawBook,
  IconBalance,
  IconCheck,
  IconInfo,
  IconWarning,
  IconLinkSource,
} from "@/lib/icons";
import type {
  ArticleProvisionBlock,
  ArticleCaseBlock,
  ArticleQuoteBlock,
  ArticleHighlightBlock,
  ArticleTimelineBlock,
  ArticleTakeawayBlock,
  ArticleCardListBlock,
  ArticleSourceBlock,
} from "@/lib/blog/article-types";

// ------------------------------------------------------------
// LegalProvisionCard — a statute article
// ------------------------------------------------------------

export function LegalProvisionCard({ block }: { block: ArticleProvisionBlock }) {
  return (
    <figure className="my-8 rounded-large border border-secondary-200 bg-secondary-50/60 overflow-hidden">
      <figcaption className="flex items-center gap-3 px-5 py-3.5 border-b border-secondary-200/70 bg-secondary-100/50">
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-medium bg-secondary-700 text-white shrink-0">
          <IconLawBook size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-labelLarge text-secondary-900 truncate">
            {block.label}
          </span>
          <span className="block text-caption text-secondary-700/80">
            {block.summary}
          </span>
        </span>
        <span className="ms-auto text-h4 text-secondary-700/40 tabular-nums shrink-0">
          {block.number}
        </span>
      </figcaption>
      <blockquote className="px-5 py-5 text-body-1 text-on-surface leading-loose text-justify">
        {block.body}
      </blockquote>
    </figure>
  );
}

// ------------------------------------------------------------
// LegalCaseCard — a ruling
// ------------------------------------------------------------

export function LegalCaseCard({ block }: { block: ArticleCaseBlock }) {
  return (
    <figure className="my-8 rounded-large border border-primary-200 bg-primary-50/50 overflow-hidden">
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 border-b border-primary-200/70 bg-primary-100/40">
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-medium bg-primary-700 text-white shrink-0">
          <IconBalance size={18} />
        </span>
        <span className="text-labelLarge text-primary-900">{block.label}</span>
        <span className="ms-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-primary-700/80">
          <span>{block.authority}</span>
          <span aria-hidden="true" className="text-primary-300">•</span>
          <span className="tabular-nums">{block.date}</span>
        </span>
      </figcaption>
      <div className="px-5 py-5">
        <p className="text-caption text-primary-700/70 mb-2">حکم رأی</p>
        <p className="text-body-1 text-on-surface leading-loose text-justify">
          {block.holding}
        </p>
      </div>
    </figure>
  );
}

// ------------------------------------------------------------
// LegalQuote — a verbatim holding pulled out of the flow
// ------------------------------------------------------------

export function LegalQuote({ block }: { block: ArticleQuoteBlock }) {
  return (
    <blockquote className="my-8 border-s-4 border-secondary-500 ps-5 py-1">
      <p className="text-h4 text-primary-800 leading-loose text-justify">
        {block.text}
      </p>
      {block.attribution && (
        <footer className="mt-3 text-caption text-muted">
          — {block.attribution}
        </footer>
      )}
    </blockquote>
  );
}

// ------------------------------------------------------------
// LegalHighlight — a key statement / practical advice callout
// ------------------------------------------------------------

const HIGHLIGHT_TONES = {
  info: {
    wrap: "border-info-200 bg-info-50",
    icon: "bg-info-600 text-white",
    title: "text-info-800",
    Icon: IconInfo,
  },
  warning: {
    wrap: "border-warning-200 bg-warning-50",
    icon: "bg-warning-600 text-white",
    title: "text-warning-800",
    Icon: IconWarning,
  },
  success: {
    wrap: "border-success-200 bg-success-50",
    icon: "bg-success-600 text-white",
    title: "text-success-800",
    Icon: IconCheck,
  },
} as const;

export function LegalHighlight({ block }: { block: ArticleHighlightBlock }) {
  const tone = HIGHLIGHT_TONES[block.tone ?? "info"];
  const Icon = tone.Icon;
  return (
    <aside className={`my-8 rounded-large border p-5 ${tone.wrap}`} role="note">
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${tone.icon}`}
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          {block.title && (
            <p className={`text-labelLarge mb-1.5 ${tone.title}`}>{block.title}</p>
          )}
          <p className="text-body-2 text-on-surface leading-loose text-justify">
            {block.text}
          </p>
        </div>
      </div>
    </aside>
  );
}

// ------------------------------------------------------------
// LegalTimeline — an ordered sequence of legal developments
// ------------------------------------------------------------

export function LegalTimeline({ block }: { block: ArticleTimelineBlock }) {
  return (
    <section className="my-10" aria-label={block.title ?? "خط زمانی"}>
      {block.title && (
        <h3 className="text-titleMedium text-primary-800 mb-5">{block.title}</h3>
      )}

      {/* Desktop: a horizontal rail. Mobile: a vertical rail. */}
      <ol className="relative grid gap-6 tablet:grid-cols-3 tablet:gap-4">
        <span
          aria-hidden="true"
          className="absolute top-4 bottom-4 start-[15px] w-px bg-secondary-200 tablet:top-[15px] tablet:bottom-auto tablet:start-4 tablet:end-4 tablet:h-px tablet:w-auto"
        />
        {block.steps.map((step, i) => (
          <li key={step.title} className="relative flex gap-4 tablet:block">
            <span className="relative z-10 inline-flex items-center justify-center h-8 w-8 rounded-full bg-secondary-700 text-white text-labelSmall shrink-0 tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0 tablet:mt-4">
              <p className="text-labelLarge text-primary-800">{step.title}</p>
              <p className="text-body-2 text-muted leading-relaxed mt-1">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------
// LegalTakeaway — the closing set of key points
// ------------------------------------------------------------

export function LegalTakeaway({ block }: { block: ArticleTakeawayBlock }) {
  return (
    <section className="my-10 rounded-large border border-primary-200 bg-primary-50/40 p-6">
      <h3 className="text-titleMedium text-primary-800 mb-4">{block.title}</h3>
      <ul className="space-y-3">
        {block.points.map((point) => (
          <li key={point} className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-success-600 text-white shrink-0 mt-1">
              <IconCheck size={12} />
            </span>
            <span className="text-body-2 text-on-surface leading-loose">
              {point}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------
// LegalCardList — a numbered grid of effects / challenges / examples
// ------------------------------------------------------------

const CARD_LIST_VARIANTS = {
  effect: {
    badge: "bg-secondary-700 text-white",
    border: "border-secondary-200",
    hover: "hover:border-secondary-300",
    title: "text-primary-800",
  },
  challenge: {
    badge: "bg-warning-600 text-white",
    border: "border-warning-200",
    hover: "hover:border-warning-300",
    title: "text-warning-800",
  },
  example: {
    badge: "bg-primary-700 text-white",
    border: "border-primary-200",
    hover: "hover:border-primary-300",
    title: "text-primary-800",
  },
} as const;

export function LegalCardList({ block }: { block: ArticleCardListBlock }) {
  const v = CARD_LIST_VARIANTS[block.variant];
  return (
    <section className="my-10" aria-label={block.title}>
      <h3 className="text-titleMedium text-primary-800 mb-2">{block.title}</h3>
      {block.intro && (
        <p className="text-body-2 text-muted leading-relaxed mb-5">
          {block.intro}
        </p>
      )}
      <div className="grid gap-4 tablet:grid-cols-2">
        {block.items.map((item, i) => (
          <div
            key={item.title}
            className={`rounded-large border bg-surface p-5 transition-colors duration-medium1 ${v.border} ${v.hover}`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex items-center justify-center h-7 w-7 rounded-medium text-labelSmall shrink-0 tabular-nums ${v.badge}`}
              >
                {i + 1}
              </span>
              <h4 className={`text-labelLarge leading-snug ${v.title}`}>
                {item.title}
              </h4>
            </div>
            <p className="mt-3 text-body-2 text-on-surface-variant leading-loose text-justify">
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------
// LegalSourceReference — the references the article rests on
// ------------------------------------------------------------

export function LegalSourceReference({ block }: { block: ArticleSourceBlock }) {
  return (
    <section className="my-10" aria-label={block.title ?? "منابع"}>
      {block.title && (
        <h3 className="text-titleMedium text-primary-800 mb-4 flex items-center gap-2">
          <IconLinkSource size={20} className="text-secondary-600" />
          {block.title}
        </h3>
      )}
      <ul className="grid gap-3 tablet:grid-cols-2">
        {block.items.map((item) => (
          <li
            key={item.title}
            className="flex items-start gap-3 rounded-large border border-divider bg-surface p-4"
          >
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-medium bg-secondary-50 text-secondary-700 shrink-0">
              <IconLawBook size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-body-2 text-primary-800 font-medium leading-snug">
                {item.title}
              </span>
              <span className="block text-caption text-muted mt-0.5">
                {item.type}
                {item.note ? ` — ${item.note}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
