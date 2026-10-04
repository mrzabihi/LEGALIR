// ============================================================
// LEGALIR — Legal article content model
// ============================================================
// A legal editorial article is authored as a typed list of section
// blocks, never as one giant JSX tree and never through a generic
// CMS. Each block maps to exactly one presentational component, so
// the renderer stays a pure switch and the content stays data.
//
// The block vocabulary is deliberately small and legal-specific:
//   paragraph  — running prose
//   heading    — H2/H3 with a stable anchor id (drives the TOC)
//   list       — a bulleted / numbered / checklist run of items
//   provision  — a statute article (e.g. ماده ۲۳۰ قانون مدنی)
//   case       — a ruling (e.g. رأی وحدت رویه ۸۰۵)
//   quote      — a verbatim holding pulled out of the flow
//   highlight  — a key statement / practical advice callout
//   timeline   — an ordered sequence of legal developments
//   takeaway   — the closing set of key points
//   cardList   — a numbered grid of effects / challenges / examples
//   table      — a real HTML table (e.g. the provisions index)
//   faq        — a question / answer list
//   cta        — a closing service call-to-action
//   source     — the references the article rests on
// ============================================================

/** A running paragraph of prose. `lead` marks the opening paragraph. */
export interface ArticleParagraphBlock {
  kind: "paragraph";
  text: string;
  lead?: boolean;
}

/** A section heading. `id` is the anchor the table of contents links to. */
export interface ArticleHeadingBlock {
  kind: "heading";
  level: 2 | 3;
  text: string;
  id: string;
}

/**
 * A run of parallel items — a bulleted list, a numbered list, or a
 * checklist. `ordered` renders an `<ol>`, `checklist` renders the
 * source's own ☐ boxes, and the default renders a `<ul>`.
 */
export interface ArticleListBlock {
  kind: "list";
  variant?: "bullet" | "ordered" | "checklist";
  /** Optional lead-in line shown above the list. */
  intro?: string;
  items: string[];
}

/** A statute article — the primary legal provision the article cites. */
export interface ArticleProvisionBlock {
  kind: "provision";
  /** e.g. «ماده ۲۳۰ قانون مدنی» */
  label: string;
  /** e.g. «قانون مدنی» */
  source: string;
  /** e.g. «۲۳۰» */
  number: string;
  /** A one-line gist shown above the body. */
  summary: string;
  /** The provision's substance, in the source's own words. */
  body: string;
}

/** A ruling — a decision that binds or guides the courts. */
export interface ArticleCaseBlock {
  kind: "case";
  /** e.g. «رأی وحدت رویه ۸۰۵» */
  label: string;
  /** e.g. «هیئت عمومی دیوان عالی کشور» */
  authority: string;
  /** e.g. «۱۶ دی‌ماه ۱۳۹۹» */
  date: string;
  /** e.g. «۸۰۵» */
  number: string;
  /** What the ruling holds. */
  holding: string;
}

/** A verbatim quotation pulled out of the running text. */
export interface ArticleQuoteBlock {
  kind: "quote";
  text: string;
  attribution?: string;
}

/** A key statement or practical-advice callout. */
export interface ArticleHighlightBlock {
  kind: "highlight";
  title?: string;
  text: string;
  tone?: "info" | "warning" | "success";
}

/** An ordered sequence of legal developments. */
export interface ArticleTimelineBlock {
  kind: "timeline";
  title?: string;
  steps: { title: string; description: string }[];
}

/** The closing set of key points. */
export interface ArticleTakeawayBlock {
  kind: "takeaway";
  title: string;
  points: string[];
}

/** A numbered grid of parallel items — effects, challenges or examples. */
export interface ArticleCardListBlock {
  kind: "cardList";
  variant: "effect" | "challenge" | "example";
  title: string;
  intro?: string;
  /** Badge style: a running number (default) or the source's own ✗ mark. */
  marker?: "number" | "cross";
  items: { title: string; text: string }[];
}

/** A real HTML table — e.g. the index of provisions a tenant should know. */
export interface ArticleTableBlock {
  kind: "table";
  title?: string;
  caption?: string;
  columns: string[];
  rows: string[][];
}

/** A question / answer list — the article's FAQ. */
export interface ArticleFaqBlock {
  kind: "faq";
  title?: string;
  items: { question: string; answer: string }[];
}

/** A closing service call-to-action. */
export interface ArticleCtaBlock {
  kind: "cta";
  title: string;
  text: string;
  /** The button label, e.g. «تنظیم پیش‌نویس قرارداد جدید». */
  cta: string;
  href: string;
}

/** The references the article rests on. */
export interface ArticleSourceBlock {
  kind: "source";
  title?: string;
  items: { title: string; type: string; note?: string }[];
}

export type ArticleBlock =
  | ArticleParagraphBlock
  | ArticleHeadingBlock
  | ArticleListBlock
  | ArticleProvisionBlock
  | ArticleCaseBlock
  | ArticleQuoteBlock
  | ArticleHighlightBlock
  | ArticleTimelineBlock
  | ArticleTakeawayBlock
  | ArticleCardListBlock
  | ArticleTableBlock
  | ArticleFaqBlock
  | ArticleCtaBlock
  | ArticleSourceBlock;

/**
 * The hero of a legal article — framing and the key facts.
 *
 * The H1 itself is NOT here: it is the post's own `titleFa`, so the
 * page title and the article title can never drift apart. `lead` is
 * the source deck's own title, shown as the descriptive line under
 * the H1.
 */
export interface ArticleHero {
  /** e.g. «تحلیل حقوقی» */
  eyebrow: string;
  /** The source deck's title, shown as the lead line. */
  lead: string;
  subtitle: string;
  /** The three framing facts shown as cards under the title. */
  meta: { label: string; value: string }[];
}

/** A complete legal article document. */
export interface LegalArticleDoc {
  slug: string;
  hero: ArticleHero;
  blocks: ArticleBlock[];
}

/** Every heading in the document, in order — the table of contents. */
export function articleHeadings(
  doc: LegalArticleDoc
): { id: string; text: string; level: 2 | 3 }[] {
  return doc.blocks
    .filter((b): b is ArticleHeadingBlock => b.kind === "heading")
    .map((b) => ({ id: b.id, text: b.text, level: b.level }));
}
