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
//   provision  — a statute article (e.g. ماده ۲۳۰ قانون مدنی)
//   case       — a ruling (e.g. رأی وحدت رویه ۸۰۵)
//   quote      — a verbatim holding pulled out of the flow
//   highlight  — a key statement / practical advice callout
//   timeline   — an ordered sequence of legal developments
//   takeaway   — the closing set of key points
//   cardList   — a numbered grid of effects / challenges / examples
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
  items: { title: string; text: string }[];
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
  | ArticleProvisionBlock
  | ArticleCaseBlock
  | ArticleQuoteBlock
  | ArticleHighlightBlock
  | ArticleTimelineBlock
  | ArticleTakeawayBlock
  | ArticleCardListBlock
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
