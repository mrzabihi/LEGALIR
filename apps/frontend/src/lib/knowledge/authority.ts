// ============================================================
// LEGALIR — Authority Hierarchy (server-only)
// ============================================================
// Not every legal source carries the same weight. When two sources
// disagree, the higher tier wins; when two sources are equally
// relevant, the higher tier ranks first.
//
//   1 CONSTITUTION  — the constitution itself
//   2 STATUTE       — laws passed by the legislature
//   3 REGULATION    — executive/administrative regulations
//   4 PRECEDENT     — binding judicial rulings
//   5 OPINION       — advisory opinions, doctrine, guides
//   6 USER_DOCUMENT — the user's own uploaded material
//
// The tier is DERIVED from the source's type — never stored twice, so
// it can never drift out of sync with the source itself.
// ============================================================

import type {
  AuthorityTier,
  LegalContentType,
  SourceStatus,
  SourceType,
  VerificationStatus,
} from "@legalir/types";

/** Tier order — lower number = higher authority. */
const TIER_RANK: Record<AuthorityTier, number> = {
  CONSTITUTION: 1,
  STATUTE: 2,
  REGULATION: 3,
  PRECEDENT: 4,
  OPINION: 5,
  USER_DOCUMENT: 6,
};

/** Persian label for each tier. */
const TIER_FA: Record<AuthorityTier, string> = {
  CONSTITUTION: "قانون اساسی",
  STATUTE: "قانون",
  REGULATION: "آیین‌نامه",
  PRECEDENT: "رویه قضایی",
  OPINION: "نظر حقوقی",
  USER_DOCUMENT: "سند کاربر",
};

/**
 * The retrieval weight of each tier. A higher tier contributes more to a
 * source's score, so an equally-matching statute outranks an opinion.
 */
const TIER_WEIGHT: Record<AuthorityTier, number> = {
  CONSTITUTION: 6,
  STATUTE: 5,
  REGULATION: 4,
  PRECEDENT: 3,
  OPINION: 2,
  USER_DOCUMENT: 1,
};

/** Map a Phase-8 `SourceType` to its authority tier. */
const SOURCE_TYPE_TIER: Record<SourceType, AuthorityTier> = {
  law: "STATUTE",
  regulation: "REGULATION",
  precedent: "PRECEDENT",
  directive: "REGULATION",
  opinion: "OPINION",
  user_document: "USER_DOCUMENT",
};

/** Map a Legal Library `LegalContentType` to its authority tier. */
const CONTENT_TYPE_TIER: Record<LegalContentType, AuthorityTier> = {
  LAW_ARTICLE: "STATUTE",
  REGULATION: "REGULATION",
  UNIFICATION_RULING: "PRECEDENT",
  JUDICIAL_DECISION: "PRECEDENT",
  LEGAL_GUIDE: "OPINION",
  HOW_TO: "OPINION",
  CHECKLIST: "OPINION",
  FAQ: "OPINION",
  LEGAL_TOOL: "OPINION",
  TEMPLATE_GUIDE: "OPINION",
  BLOG_ARTICLE: "OPINION",
  SOURCE: "OPINION",
};

/**
 * Resolve the authority tier of a source.
 *
 * A source whose title/authority names the constitution is promoted to
 * CONSTITUTION — the catalog stores it as a `law`, but it is the supreme
 * instrument and must outrank every ordinary statute.
 */
export function tierForSource(params: {
  sourceType: SourceType | LegalContentType;
  title?: string;
  authority?: string;
}): AuthorityTier {
  const haystack = `${params.title ?? ""} ${params.authority ?? ""}`;
  if (/قانون\s*اساسی/.test(haystack)) return "CONSTITUTION";

  const bySourceType = SOURCE_TYPE_TIER[params.sourceType as SourceType];
  if (bySourceType) return bySourceType;

  const byContentType = CONTENT_TYPE_TIER[params.sourceType as LegalContentType];
  if (byContentType) return byContentType;

  return "OPINION";
}

/** The Persian label for a tier. */
export function tierLabelFa(tier: AuthorityTier): string {
  return TIER_FA[tier];
}

/** The numeric rank of a tier (1 = highest authority). */
export function tierRank(tier: AuthorityTier): number {
  return TIER_RANK[tier];
}

/** The retrieval weight of a tier. */
export function tierWeight(tier: AuthorityTier): number {
  return TIER_WEIGHT[tier];
}

/** True when `a` outranks `b`. */
export function outranks(a: AuthorityTier, b: AuthorityTier): boolean {
  return TIER_RANK[a] < TIER_RANK[b];
}

/**
 * The verification bonus. An officially verified source is worth more than
 * an unverified one, so a verified opinion can still beat an unverified
 * statute when the lexical match is stronger.
 */
export function verificationWeight(status: VerificationStatus): number {
  switch (status) {
    case "VERIFIED_OFFICIAL":
      return 3;
    case "VERIFIED_SECONDARY":
      return 2;
    case "DEMO_VERIFIED":
      return 1;
    default:
      return 0;
  }
}

/**
 * The validity penalty. An expired or amended source is still citable but
 * must not outrank a currently-valid one.
 */
export function statusWeight(status: SourceStatus): number {
  switch (status) {
    case "valid":
      return 1;
    case "amended":
      return 0;
    case "expired":
      return -2;
    case "needs_review":
      return -1;
    default:
      return 0;
  }
}

/** All tiers, highest authority first. */
export const AUTHORITY_TIERS: AuthorityTier[] = (
  Object.keys(TIER_RANK) as AuthorityTier[]
).sort((a, b) => TIER_RANK[a] - TIER_RANK[b]);
