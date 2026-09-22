// ============================================================
// LEGALIR — LegalArticle renderer
// ============================================================
// A pure switch from the typed block list onto the block
// components. There is no content in this file — only the mapping —
// so adding a block kind is a two-line change and the article body
// stays data.
//
// Blocks that read better with room (timeline, card grids) render
// in a `wide` section; running prose stays at the reading measure.
// ============================================================

import React from "react";
import type { ArticleBlock, LegalArticleDoc } from "@/lib/blog/article-types";
import { LegalArticleSection } from "./legal-article-section";
import {
  LegalProvisionCard,
  LegalCaseCard,
  LegalQuote,
  LegalHighlight,
  LegalTimeline,
  LegalTakeaway,
  LegalCardList,
  LegalSourceReference,
} from "./blocks";

/** Blocks that break out to the visual width. */
const WIDE_KINDS: ArticleBlock["kind"][] = ["timeline", "cardList"];

function ArticleBlockView({ block }: { block: ArticleBlock }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <p
          className={
            block.lead
              ? "text-body-1 text-on-surface leading-loose text-justify"
              : "text-body-1 text-on-surface-variant leading-loose text-justify"
          }
        >
          {block.text}
        </p>
      );

    case "heading":
      return block.level === 2 ? (
        <h2
          id={block.id}
          className="scroll-mt-24 text-h2 text-primary-800 leading-snug pt-4"
        >
          {block.text}
        </h2>
      ) : (
        <h3
          id={block.id}
          className="scroll-mt-24 text-h3 text-primary-800 leading-snug pt-2"
        >
          {block.text}
        </h3>
      );

    case "provision":
      return <LegalProvisionCard block={block} />;
    case "case":
      return <LegalCaseCard block={block} />;
    case "quote":
      return <LegalQuote block={block} />;
    case "highlight":
      return <LegalHighlight block={block} />;
    case "timeline":
      return <LegalTimeline block={block} />;
    case "takeaway":
      return <LegalTakeaway block={block} />;
    case "cardList":
      return <LegalCardList block={block} />;
    case "source":
      return <LegalSourceReference block={block} />;
  }
}

export function LegalArticle({ doc }: { doc: LegalArticleDoc }) {
  return (
    <div className="space-y-6">
      {doc.blocks.map((block, i) => (
        <LegalArticleSection key={i} wide={WIDE_KINDS.includes(block.kind)}>
          <ArticleBlockView block={block} />
        </LegalArticleSection>
      ))}
    </div>
  );
}
