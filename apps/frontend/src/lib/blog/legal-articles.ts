// ============================================================
// LEGALIR — Rich legal-article registry
// ============================================================
// The single lookup the blog route uses to decide whether a slug has a
// rich, typed legal-article document (rendered through the block
// system) or falls back to the legacy markdown body.
//
// Adding an article is one import and one map entry — the route never
// needs to know which slugs exist.
// ============================================================

import type { LegalArticleDoc } from "./article-types";
import { contractPenaltyClauseArticle } from "./contract-penalty-clause";
import { tenantRightsGuideArticle } from "./tenant-rights-guide";

const LEGAL_ARTICLES: Record<string, LegalArticleDoc> = {
  [contractPenaltyClauseArticle.slug]: contractPenaltyClauseArticle,
  [tenantRightsGuideArticle.slug]: tenantRightsGuideArticle,
};

/** Look up a rich legal article by slug. */
export function getLegalArticle(slug: string): LegalArticleDoc | undefined {
  return LEGAL_ARTICLES[slug];
}
