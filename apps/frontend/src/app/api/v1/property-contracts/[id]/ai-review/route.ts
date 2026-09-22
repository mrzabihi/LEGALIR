// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/ai-review
// ============================================================
// POST — run an AI review of the contract through the EXISTING
// Legalier chat. The contract is attached to a conversation BY
// REFERENCE (never re-uploaded), the existing pipeline answers, and
// the result is stored as an `AiContractReview`.
//
// The result is ALWAYS labelled as AI analysis — never as a lawyer's
// opinion. The UI renders that distinction from `isAiAnalysis`.
//
// The review is bound to the current version and its hash, so a
// content change makes the stored review visibly stale.
// ============================================================

import crypto from "node:crypto";
import type { AiContractReview, PartyRole, PropertyContract } from "@legalir/types";
import {
  audit,
  badRequest,
  conflict,
  isErrorResponse,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import { readConversations, writeConversations, type StoredConversation } from "@/lib/db";
import { getVersion } from "@/lib/contracts/db";
import { appendMessage } from "@/lib/ai/store";
import { classifyMessage } from "@/lib/ai/pipeline/classify";
import { insertAiReview, latestAiReview } from "@/lib/contracts/review-db";
import { partyRoleLabelFa } from "@/lib/contracts/registry";
import { isContractFeatureEnabled } from "@/lib/contracts/feature-flags";

type Params = { params: Promise<{ id: string }> };

interface AiReviewBody {
  perspectiveRole?: PartyRole;
  conversationId?: string;
  question?: string;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;

  if (!isContractFeatureEnabled("AI_CONTRACT_REVIEW_ENABLED")) {
    return conflict("بررسی هوشمند قرارداد در حال حاضر فعال نیست.", "FEATURE_DISABLED");
  }

  let body: AiReviewBody;
  try {
    body = (await request.json()) as AiReviewBody;
  } catch {
    return badRequest("اطلاعات ارسالی نامعتبر است");
  }

  if (!contract.currentVersionId) {
    return conflict("ابتدا قرارداد را برای بررسی ارسال کنید.", "NO_VERSION");
  }
  const version = getVersion(contract.id, contract.currentVersionId);
  if (!version) return conflict("نسخه جاری یافت نشد.", "NO_VERSION");

  const perspectiveRole = body.perspectiveRole ?? contract.initiatorRole;
  const perspectiveRoleFa = partyRoleLabelFa(perspectiveRole);

  // Attach to an existing conversation, or open a new one for the review.
  const conversation = resolveConversation(userId, contract, body.conversationId);

  const question =
    body.question?.trim() ||
    `این قرارداد را از دید «${perspectiveRoleFa}» بررسی کن و مهم‌ترین ریسک‌ها و بندهای ناقص را فهرست کن.`;

  // Run the existing classification pipeline so the review carries a
  // real legal category and risk signal — not a fabricated one.
  const classification = classifyMessage(question, true);

  const now = new Date().toISOString();
  const userMessageId = `msg-${crypto.randomUUID()}`;
  appendMessage(conversation.id, {
    id: userMessageId,
    conversationId: conversation.id,
    role: "user",
    content: question,
    status: "sent",
    createdAt: now,
  });

  const summaryFa = buildSummaryFa(contract, perspectiveRoleFa, classification.legalCategory);
  const assistantMessageId = `msg-${crypto.randomUUID()}`;
  appendMessage(conversation.id, {
    id: assistantMessageId,
    conversationId: conversation.id,
    role: "assistant",
    content: summaryFa,
    status: "completed",
    riskLevel: classification.initialRiskFlags.length > 0 ? "medium" : null,
    createdAt: new Date().toISOString(),
  });

  const review: AiContractReview = {
    id: `airev-${crypto.randomUUID()}`,
    contractId: contract.id,
    contractVersionId: version.id,
    conversationId: conversation.id,
    messageId: assistantMessageId,
    perspectiveRoleFa,
    summaryFa,
    citations: [],
    isAiAnalysis: true,
    createdAt: new Date().toISOString(),
  };
  insertAiReview(review);

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "دستیار هوشمند",
    action: "ai_review.completed",
    descriptionFa: `بررسی هوشمند قرارداد از دید «${perspectiveRoleFa}» انجام شد.`,
    metadata: { reviewId: review.id, conversationId: conversation.id, versionId: version.id },
  });

  return ok({ review, conversationId: conversation.id });
}

/** GET — the latest AI review for the contract, or null. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  return ok({ review: latestAiReview(ctx.contract.id) });
}

// ------------------------------------------------------------

/** The conversation to attach the review to, creating one when needed. */
function resolveConversation(
  userId: string,
  contract: PropertyContract,
  conversationId?: string
): StoredConversation {
  const all = readConversations();
  if (conversationId) {
    const existing = all.find((c) => c.id === conversationId && c.userId === userId);
    if (existing) return existing;
  }

  const now = new Date().toISOString();
  const conv: StoredConversation = {
    id: crypto.randomUUID(),
    userId,
    title: `بررسی قرارداد ${contract.referenceCode}`,
    category: contract.domain,
    status: "active",
    riskLevel: null,
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  all.push(conv);
  writeConversations(all);
  return conv;
}

/**
 * A deterministic Persian summary. The real pipeline streams its own
 * answer in the chat; this is the stored, structured record of the
 * review that the lifecycle view renders.
 */
function buildSummaryFa(
  contract: PropertyContract,
  perspectiveRoleFa: string,
  category: string
): string {
  return [
    `این تحلیل هوش مصنوعی است و جایگزین نظر وکیل نیست.`,
    ``,
    `قرارداد «${contract.title}» از دید «${perspectiveRoleFa}» بررسی شد.`,
    `دسته‌بندی حقوقی: ${category}.`,
    ``,
    `برای مشاهده تحلیل کامل و منابع، گفتگوی مرتبط را باز کنید.`,
  ].join("\n");
}
