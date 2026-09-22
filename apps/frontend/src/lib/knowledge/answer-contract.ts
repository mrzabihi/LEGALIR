// ============================================================
// LEGALIR — Answer Contract (server-only)
// ============================================================
// The contract every grounded answer must honour. It is built from the
// retrieval result and injected into the system prompt, so the model is
// told — explicitly and structurally — what it may and may not cite.
//
// The NO-CITATION RULE is the load-bearing part:
//
//   When no citable source was retrieved, the model MUST NOT invent a
//   citation, MUST NOT reference an article number, and MUST say plainly
//   that it could not verify the answer against a source.
//
// This is enforced by the contract, not by hoping the model behaves.
// ============================================================

import type { AnswerContract, RetrievalHit } from "@legalir/types";
import { tierRank } from "./authority";

/** The rule the model must follow when there is nothing to cite. */
export const NO_CITATION_RULE = [
  "قاعده استناد:",
  "در این پاسخ هیچ منبع حقوقی تأییدشده‌ای در دسترس نبود.",
  "بنابراین:",
  "• هیچ ماده، تبصره، رأی یا سندی را استناد نکن و شماره‌ای برای آن نساز.",
  "• از عباراتی مانند «طبق ماده …» یا «بر اساس رأی …» استفاده نکن.",
  "• صریحاً بگو که پاسخ بر پایه بررسی منابع حقوقی تأییدشده نیست و کاربر باید برای اقدام رسمی با وکیل مشورت کند.",
].join("\n");

/** The instruction block when sources WERE retrieved. */
function groundedInstruction(hits: RetrievalHit[]): string {
  const topTier = hits[0]?.provenance.tierFa ?? "";
  return [
    "قاعده استناد:",
    `در این پاسخ ${hits.length} منبع حقوقی تأییدشده در دسترس است (بالاترین اعتبار: ${topTier}).`,
    "بنابراین:",
    "• فقط به همین منابع استناد کن و شماره منبع را دقیقاً مطابق فهرست بالا بیاور.",
    "• اگر پاسخ در این منابع نیست، آن را به‌عنوان نظر عمومی و نه استناد حقوقی بیان کن.",
    "• در تعارض میان دو منبع، منبع با اعتبار بالاتر (قانون اساسی > قانون > آیین‌نامه > رویه قضایی > نظر حقوقی) مقدم است.",
  ].join("\n");
}

/**
 * Build the answer contract from the retrieved hits.
 *
 * @param hits the fused retrieval hits (already ranked)
 */
export function buildAnswerContract(hits: RetrievalHit[]): AnswerContract {
  const grounded = hits.length > 0;

  if (!grounded) {
    return {
      grounded: false,
      sourceCount: 0,
      topTier: null,
      contextBlock: "",
      instructionBlock: NO_CITATION_RULE,
      noCitationRule: NO_CITATION_RULE,
    };
  }

  const contextBlock = [
    "منابع حقوقی مرتبط (برای استناد در پاسخ):",
    ...hits.map((h, i) => {
      const locator = h.provenance.locator ? ` — ${h.provenance.locator}` : "";
      return `${i + 1}. ${h.title}${locator} — ${h.provenance.authority} (${h.provenance.tierFa})\n${h.excerpt ?? h.summary}`;
    }),
  ].join("\n\n");

  // The highest-authority tier among the hits (rank 1 = highest).
  const topTier = hits.reduce(
    (best, h) =>
      tierRank(h.provenance.tier) < tierRank(best) ? h.provenance.tier : best,
    hits[0]!.provenance.tier
  );

  return {
    grounded: true,
    sourceCount: hits.length,
    topTier,
    contextBlock,
    instructionBlock: groundedInstruction(hits),
    noCitationRule: NO_CITATION_RULE,
  };
}
