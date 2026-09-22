// ============================================================
// LEGALIR — AI Gateway SSE Streaming Endpoint (server-only)
// ============================================================
// The single point through which the frontend reaches an AI provider.
// Provider credentials are read from server-only env vars and are never
// exposed to the browser (§16–§19).
//
//   Frontend → POST /api/v1/ai/stream  →  LEGALIR AI Gateway → Provider
//
// The response is Server-Sent Events framed as `data: {json}\n\n`.
// Events (status phases mirror AiRunStatus, §25):
//   { type: "status", status: "queued" | "retrieving" | "generating"
//                          | "validating" | "succeeded" | "failed" }
//   { type: "chunk", text: string, index: number }
//   { type: "done", messageId, sections, references }
//   { type: "error", code, message, retryable }
//   { type: "workflow", phase, domain, intent, phaseChanged, pendingQuestions, suggestCaseCreation }
// ============================================================

import { findSessionById, touchConversation } from "@/lib/db";
import {
  reserveUsage,
  completeUsage,
  reverseUsage,
  getUsageSummary,
} from "@/lib/usage/engine";
import { createAiProvider, readAiProviderConfig } from "@/lib/ai/provider";
import { retrieveGroundedSources, retrieveDocumentContext } from "@/lib/ai/grounding";
import { buildAnswerContract } from "@/lib/knowledge/answer-contract";
import { appendMessage, getMessages } from "@/lib/ai/store";
import {
  processWorkflowTurn,
  getWorkflowState,
  setWorkflowState,
  createInitialWorkflowState,
} from "@/lib/ai/workflow";
import type { WorkflowState } from "@/lib/ai/workflow";
import { classifyMessage } from "@/lib/ai/pipeline/classify";
import {
  createRun,
  completeStage,
  skipStage,
  waitStage,
  failStage,
  completeRun,
  cancelRun,
} from "@/lib/ai/pipeline/run";
import { stageNumber, TOTAL_STAGES } from "@/lib/ai/pipeline/stages";
import {
  linkAttachmentsToMessage,
  resolveAttachmentContext,
  getMessageAttachmentRefs,
} from "@/lib/ai/attachments";
import type {
  ChatAttachmentRef,
  ProcessingStage,
  StructuredResponseSection,
  V1Reference,
} from "@legalir/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// Request shape
// ============================================================

interface StreamRequestBody {
  conversationId: string;
  /** The new user message text. */
  content: string;
  /** Optional conversation_context from the entry service (§20). */
  context?: {
    serviceType?: string;
    category?: string;
    documentId?: string;
  };
  /**
   * Documents the user attached to this message. Each id must reference a
   * document the user owns — ownership is re-validated server-side and any
   * id the user does not own is dropped, never linked.
   */
  attachmentDocumentIds?: string[];
}

type Emit = (data: unknown) => void;

// ============================================================
// Helpers
// ============================================================

function getUser(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

function sse(data: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function markdownToSections(md: string): StructuredResponseSection[] {
  const sections: StructuredResponseSection[] = [];
  const lines = md.split(/\r?\n/);
  let current: { title: string; lines: string[] } | null = null;

  const flush = () => {
    if (current) {
      sections.push({
        id: `sec-${sections.length}`,
        title: current.title,
        content: current.lines.join("\n").trim(),
        order: sections.length + 1,
      });
      current = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    if (heading) {
      flush();
      current = { title: heading[1]!.trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else if (line.trim()) {
      current = { title: "پاسخ", lines: [line] };
    }
  }
  flush();

  return sections;
}

// ============================================================
// Streaming (abortable, status-emitting)
// ============================================================

/**
 * Emit a pipeline progress event. Every stage transition the UI sees comes
 * from here — the frontend never advances on a timer.
 */
function emitStage(
  emit: Emit,
  requestId: string,
  type: string,
  stage: ProcessingStage,
  extra: Record<string, unknown> = {}
): void {
  emit({
    type,
    requestId,
    stage,
    stageNumber: stageNumber(stage),
    totalStages: TOTAL_STAGES,
    ...extra,
  });
}

async function streamAssistant(
  emit: Emit,
  signal: AbortSignal,
  userId: string,
  body: StreamRequestBody,
  requestId: string,
  userMessageId: string,
  usageTransactionId: string
): Promise<void> {
  // Persist the user message first (§22 — no message loss).
  appendMessage(body.conversationId, {
    id: userMessageId,
    conversationId: body.conversationId,
    role: "user",
    content: body.content,
    status: "sent",
    createdAt: new Date().toISOString(),
  });

  // Link any attached documents to this message. The document is only
  // *referenced* — never copied. Ownership is enforced inside the linker,
  // so a crafted request cannot attach another user's document.
  const attachmentIds = body.attachmentDocumentIds ?? [];
  if (attachmentIds.length > 0) {
    linkAttachmentsToMessage({
      userId,
      conversationId: body.conversationId,
      messageId: userMessageId,
      documentIds: attachmentIds,
    });
  }

  // Bump the conversation so it surfaces at the top of the history list.
  touchConversation(userId, body.conversationId);

  // Open a processing run so every stage's latency is recorded.
  createRun({
    id: requestId,
    conversationId: body.conversationId,
    userId,
    userMessageId,
  });

  const provider = createAiProvider();

  // ----------------------------------------------------------
  // STAGE 1 — IDENTIFY (real classification)
  // ----------------------------------------------------------
  emitStage(emit, requestId, "stage.started", "IDENTIFY");
  const classification = classifyMessage(body.content, Boolean(body.context?.documentId));
  completeStage(requestId, "IDENTIFY", {
    legalCategory: classification.legalCategory,
    intent: classification.intent,
    confidence: classification.confidence,
  });
  emitStage(emit, requestId, "stage.completed", "IDENTIFY", {
    status: "COMPLETED",
  });

  // ----------------------------------------------------------
  // STAGE 2 — UNDERSTAND (structure the request; ask if unclear)
  // ----------------------------------------------------------
  emitStage(emit, requestId, "stage.started", "UNDERSTAND");
  const workflowState: WorkflowState =
    getWorkflowState(body.conversationId) ?? createInitialWorkflowState();

  // The workflow engine extracts facts and decides whether more information
  // is needed. It runs here — before retrieval — because the questions it
  // produces are what Stage 2 is actually doing.
  const turn = processWorkflowTurn(workflowState, body.content, "");
  setWorkflowState(body.conversationId, turn.state);

  const needsClarification =
    classification.requiresClarification && turn.state.pendingQuestions.length > 0;

  if (needsClarification) {
    // The pipeline does not fabricate an answer when it lacks information.
    // It records the wait and surfaces the questions to the user.
    waitStage(requestId, "UNDERSTAND", {
      pendingQuestions: turn.state.pendingQuestions,
    });
    emitStage(emit, requestId, "stage.waiting", "UNDERSTAND", {
      status: "WAITING",
      pendingQuestions: turn.state.pendingQuestions,
    });
  } else {
    completeStage(requestId, "UNDERSTAND", {
      collectedFacts: Object.keys(turn.state.collectedFacts).length,
    });
    emitStage(emit, requestId, "stage.completed", "UNDERSTAND", {
      status: "COMPLETED",
    });
  }

  // Emit workflow metadata so the frontend can show phase/pending questions.
  emit({
    type: "workflow",
    phase: turn.state.phase,
    domain: turn.state.domain,
    intent: turn.state.intent,
    phaseChanged: turn.phaseChanged,
    pendingQuestions: turn.state.pendingQuestions,
    suggestCaseCreation: turn.suggestCaseCreation,
  });

  // ----------------------------------------------------------
  // STAGE 3 — RESEARCH (real retrieval)
  // ----------------------------------------------------------
  let grounding: ReturnType<typeof retrieveGroundedSources> = {
    sources: [],
    contextBlock: "",
    references: [],
    contract: buildAnswerContract([]),
  };
  let retrievalFailed = false;

  if (!classification.requiresSources) {
    // A purely informational question needs no source lookup — mark the
    // stage skipped rather than pretending a search happened.
    skipStage(requestId, "RESEARCH");
    emitStage(emit, requestId, "stage.completed", "RESEARCH", {
      status: "SKIPPED",
    });
  } else {
    emitStage(emit, requestId, "stage.started", "RESEARCH");
    emit({ type: "retrieval.started", requestId, stage: "RESEARCH" });
    try {
      grounding = retrieveGroundedSources(body.content, 3);
      completeStage(requestId, "RESEARCH", { sourcesUsed: grounding.references.length });
      emit({
        type: "retrieval.completed",
        requestId,
        stage: "RESEARCH",
        sourcesUsed: grounding.references.length,
      });
      emitStage(emit, requestId, "stage.completed", "RESEARCH", {
        status: "COMPLETED",
        sourcesUsed: grounding.references.length,
      });
    } catch {
      // Retrieval failure must not be hidden — the answer will not claim to
      // be grounded, and the UI shows the stage as failed.
      retrievalFailed = true;
      failStage(requestId, "RESEARCH", "RETRIEVAL_FAILED");
      emitStage(emit, requestId, "stage.failed", "RESEARCH", {
        status: "FAILED",
        code: "RETRIEVAL_FAILED",
        message: "در حال حاضر امکان بررسی منابع حقوقی وجود نداشت.",
        retryable: true,
      });
    }
  }

  // Document grounding — when the chat is scoped to one of the user's
  // documents (e.g. a rental contract), inject its text + findings so the
  // AI can answer about that exact document.
  const docContext = retrieveDocumentContext(userId, body.context?.documentId);

  // Attachment grounding — the documents the user attached to THIS message.
  // Only the already-extracted text is injected (never the raw file), and
  // only for documents the user actually owns.
  const attachmentContext = resolveAttachmentContext(userId, attachmentIds);
  const attachmentBlock = attachmentContext.texts.length
    ? [
        "\n\n## اسناد پیوست‌شده توسط کاربر",
        ...attachmentContext.texts.map(
          (t) => `\n### ${t.name}\n${t.text.slice(0, 4000)}`
        ),
      ].join("\n")
    : "";

  // ----------------------------------------------------------
  // STAGE 4 — ANALYZE (compose the grounded analysis prompt)
  // ----------------------------------------------------------
  emitStage(emit, requestId, "stage.started", "ANALYZE");
  emit({ type: "analysis.started", requestId, stage: "ANALYZE" });

  const requiresLawyerReview =
    classification.initialRiskFlags.length > 0 ||
    classification.legalCategory === "criminal" ||
    classification.requiresCaseContext;

  // Compose the system prompt: workflow prompt + legal grounding + document
  // context + the answer contract. The contract carries the no-citation rule
  // when nothing was retrieved, so the model is never left to guess.
  const system = [
    turn.systemPrompt,
    grounding.contextBlock ? `\n\n${grounding.contextBlock}` : "",
    grounding.contract.instructionBlock
      ? `\n\n${grounding.contract.instructionBlock}`
      : "",
    docContext ? `\n\n${docContext.contextBlock}` : "",
    attachmentBlock,
    retrievalFailed
      ? "\n\nتوجه: در این نوبت امکان بررسی منابع حقوقی وجود نداشت. پاسخ را عمومی ارائه کن و صریحاً بگو که بررسی منابع انجام نشده است."
      : "",
  ].join("");

  completeStage(requestId, "ANALYZE", {
    requiresLawyerReview,
    attachmentsUsed: attachmentContext.documentIds.length,
  });
  emit({
    type: "analysis.completed",
    requestId,
    stage: "ANALYZE",
    requiresLawyerReview,
  });
  emitStage(emit, requestId, "stage.completed", "ANALYZE", {
    status: "COMPLETED",
    requiresLawyerReview,
  });

  // Build conversation history (the just-added user msg is passed
  // explicitly as the final turn, so exclude it from history).
  const history = getMessages(body.conversationId)
    .filter((m) => m.role !== "system" && m.id !== userMessageId)
    .slice(-8)
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

  // ----------------------------------------------------------
  // STAGE 5 — RESPOND (generate the answer)
  // ----------------------------------------------------------
  emitStage(emit, requestId, "stage.started", "RESPOND");
  emit({ type: "response.started", requestId, stage: "RESPOND" });

  let text = "";
  let index = 0;
  let providerUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimated: true };

  for await (const delta of provider.stream({
    system,
    messages: [...history, { role: "user" as const, content: body.content }],
    signal,
    onUsage: (usage) => {
      providerUsage = usage;
    },
  })) {
    text += delta;
    emit({ type: "status", status: "generating" });
    emit({ type: "response.delta", requestId, stage: "RESPOND", text: delta, index: index++ });
    emit({ type: "chunk", text: delta, index: index - 1 });
  }

  const sections = markdownToSections(text);

  const messageId = crypto.randomUUID();
  const references: V1Reference[] = grounding.references.map((r) => ({
    ...r,
    conversationId: body.conversationId,
    messageId,
  }));

  appendMessage(body.conversationId, {
    id: messageId,
    conversationId: body.conversationId,
    role: "assistant",
    content: text,
    status: "completed",
    sections,
    riskLevel: null,
    references,
    createdAt: new Date().toISOString(),
  });

  // The activity succeeded — commit the reservation and record the real
  // token usage reported by the provider (never an estimate).
  completeUsage(usageTransactionId, { tokens: providerUsage.totalTokens });

  completeStage(requestId, "RESPOND", { characters: text.length });
  emit({ type: "response.completed", requestId, stage: "RESPOND" });
  emitStage(emit, requestId, "stage.completed", "RESPOND", { status: "COMPLETED" });

  completeRun(requestId, {
    assistantMessageId: messageId,
    classification,
    sourcesUsed: grounding.references.length,
    requiresLawyerReview,
  });
  emit({
    type: "processing.completed",
    requestId,
    sourcesUsed: grounding.references.length,
    requiresLawyerReview,
  });

  // The user message's persisted attachment refs, so the UI can render the
  // attachment cards on the user bubble without a refetch.
  const userAttachments: ChatAttachmentRef[] =
    attachmentIds.length > 0 ? getMessageAttachmentRefs(userMessageId) : [];

  emit({
    type: "done",
    requestId,
    messageId,
    sections,
    references,
    userMessageId,
    userAttachments,
  });
}

// ============================================================
// Route handlers
// ============================================================

export async function POST(request: Request) {
  const userId = getUser(request);
  if (!userId) {
    return new Response(
      JSON.stringify({ code: "UNAUTHORIZED", message: "لطفا وارد شوید" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: StreamRequestBody;
  try {
    body = (await request.json()) as StreamRequestBody;
  } catch {
    return new Response(
      JSON.stringify({ code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!body.conversationId || !body.content || !body.content.trim()) {
    return new Response(
      JSON.stringify({ code: "VALIDATION_ERROR", message: "متن پیام الزامی است" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Reserve the activity's cost atomically BEFORE doing any work. The
  // reservation is idempotent per user message, so a retried stream can
  // never double-charge. On an internal failure the reservation is reversed.
  const userMessageId = crypto.randomUUID();
  const reservation = reserveUsage({
    userId,
    activity: "AI_MESSAGE",
    source: "chat",
    relatedEntityId: userMessageId,
    idempotencyKey: `chat:${userMessageId}`,
  });
  if (!reservation.ok || !reservation.transaction) {
    return new Response(
      JSON.stringify({
        code: reservation.code ?? "QUOTA_EXHAUSTED",
        message: reservation.messageFa || "سهمیه شما به پایان رسیده است.",
        usage: getUsageSummary(userId),
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }
  const usageTransactionId = reservation.transaction.id;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const abortController = new AbortController();
      let closed = false;

      const emit: Emit = (data) => {
        if (closed) return;
        try {
          controller.enqueue(sse(data));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener(
        "abort",
        () => {
          abortController.abort();
          close();
        },
        { once: true }
      );

      const requestId = crypto.randomUUID();

      try {
        emit({ type: "status", status: "queued" });
        emit({ type: "processing.started", requestId, totalStages: TOTAL_STAGES });

        await streamAssistant(
          emit,
          abortController.signal,
          userId,
          body,
          requestId,
          userMessageId,
          usageTransactionId
        );

        emit({ type: "status", status: "validating" });
        emit({ type: "status", status: "succeeded" });
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        if (isAbort) {
          // The user pressed stop — record the cancellation rather than a
          // failure, so the run history distinguishes the two.
          cancelRun(requestId);
        } else {
          // Internal failure — refund the reservation so the user's quota is
          // not burned for a request that produced nothing.
          reverseUsage(usageTransactionId);
          failStage(requestId, "RESPOND", "PROVIDER_UNAVAILABLE");
          emit({
            type: "error",
            code: "PROVIDER_UNAVAILABLE",
            message: "در حال حاضر اتصال به سرویس هوشمند امکان‌پذیر نیست.",
            retryable: true,
          });
          emit({ type: "status", status: "failed" });
        }
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// Health endpoint — reveals provider status without leaking secrets.
export async function GET() {
  const provider = createAiProvider();
  const health = await provider.health();
  const config = readAiProviderConfig();

  return new Response(
    JSON.stringify({
      provider: provider.name,
      model: provider.model,
      configured: provider.configured,
      healthy: health.ok,
      providerRequested: config.provider,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    }
  );
}
