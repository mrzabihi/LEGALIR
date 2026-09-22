// ============================================================
// LEGALIR — AI Streaming Client (browser)
// ============================================================
// Consumes the server-side SSE gateway (/api/v1/ai/stream).
// The browser only knows about the LEGALIR backend — no provider
// credentials or provider names reach the client.
// ============================================================

import { env } from "@legalir/config";
import type {
  StructuredResponseSection,
  V1Reference,
  ProcessingStage,
  StageStatus,
  ChatAttachmentRef,
  SubscriptionUsageSummary,
} from "@legalir/types";

export interface StreamRequestContext {
  serviceType?: string;
  category?: string;
  documentId?: string;
}

export interface StreamRequest {
  conversationId: string;
  content: string;
  context?: StreamRequestContext;
  /** Documents attached to this message (references to owned documents). */
  attachmentDocumentIds?: string[];
}

export interface StreamChunk {
  text: string;
  index: number;
}

export interface StreamDone {
  messageId: string;
  sections: StructuredResponseSection[];
  references: V1Reference[];
  /** The processing run id for this turn (matches the persisted run). */
  requestId?: string;
  /** The persisted user message id (carries the attachments). */
  userMessageId?: string;
  /** The user message's persisted attachment refs. */
  userAttachments?: ChatAttachmentRef[];
}

export type StreamStatus =
  | "queued"
  | "retrieving"
  | "generating"
  | "validating"
  | "succeeded"
  | "failed";

export interface WorkflowEvent {
  phase: string;
  domain: string | null;
  intent: string | null;
  phaseChanged: boolean;
  pendingQuestions: string[];
  suggestCaseCreation: boolean;
}

/**
 * A pipeline progress update derived from a backend event. The UI advances
 * its stage indicator purely from these — there is no client-side timer.
 */
export interface PipelineProgress {
  requestId: string;
  /** The stage this event concerns. */
  stage: ProcessingStage | null;
  /** 1-based stage number, when the event carries one. */
  stageNumber: number | null;
  totalStages: number | null;
  /** New status for the stage, when the event implies one. */
  status: StageStatus | null;
  /** Present on retrieval.completed. */
  sourcesUsed?: number;
  /** Present on analysis.completed. */
  requiresLawyerReview?: boolean;
  /** Present on stage.waiting — the questions the user must answer. */
  pendingQuestions?: string[];
  /** Present on stage.failed. */
  code?: string;
  message?: string;
  retryable?: boolean;
}

export interface StreamCallbacks {
  onStatus?: (status: StreamStatus) => void;
  onChunk?: (chunk: StreamChunk) => void;
  onDone?: (done: StreamDone) => void;
  onError?: (error: {
    code: string;
    message: string;
    retryable: boolean;
    /** The live usage summary, present on a quota-exhaustion (429) response. */
    usage?: SubscriptionUsageSummary;
  }) => void;
  onWorkflow?: (event: WorkflowEvent) => void;
  /** Fired for every pipeline progress event. */
  onPipeline?: (progress: PipelineProgress) => void;
}

interface SseEvent {
  type: string;
  status?: StreamStatus | StageStatus;
  text?: string;
  index?: number;
  messageId?: string;
  sections?: StructuredResponseSection[];
  references?: V1Reference[];
  code?: string;
  message?: string;
  retryable?: boolean;
  phase?: string;
  domain?: string | null;
  intent?: string | null;
  phaseChanged?: boolean;
  pendingQuestions?: string[];
  suggestCaseCreation?: boolean;
  requestId?: string;
  stage?: ProcessingStage;
  stageNumber?: number;
  totalStages?: number;
  sourcesUsed?: number;
  requiresLawyerReview?: boolean;
  userMessageId?: string;
  userAttachments?: ChatAttachmentRef[];
}

/** Event types that carry pipeline progress. */
const PIPELINE_EVENT_TYPES = new Set([
  "processing.started",
  "stage.started",
  "stage.completed",
  "stage.waiting",
  "stage.failed",
  "retrieval.started",
  "retrieval.completed",
  "analysis.started",
  "analysis.completed",
  "response.started",
  "response.completed",
  "processing.completed",
]);

/** Map an event type to the stage status it implies. */
function statusForEvent(type: string): StageStatus | null {
  switch (type) {
    case "stage.started":
    case "retrieval.started":
    case "analysis.started":
    case "response.started":
      return "ACTIVE";
    case "stage.completed":
    case "retrieval.completed":
    case "analysis.completed":
    case "response.completed":
      return "COMPLETED";
    case "stage.waiting":
      return "WAITING";
    case "stage.failed":
      return "FAILED";
    default:
      return null;
  }
}

function basePath(): string {
  return env.apiBaseUrl || "";
}

/**
 * Streams an AI response for a message. Returns an abort function.
 * Emits typed errors on network/HTTP failure so the caller can show a
 * graceful fallback state (§27).
 */
export function streamChat(
  request: StreamRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): () => void {
  const controller = new AbortController();

  const abortFromParent = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", abortFromParent, { once: true });
  }

  (async () => {
    let response: Response;
    try {
      response = await fetch(`${basePath()}/api/v1/ai/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        credentials: "include",
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) return;
      callbacks.onError?.({
        code: "NETWORK_ERROR",
        message: "در حال حاضر اتصال به سرویس هوشمند امکان‌پذیر نیست.",
        retryable: true,
      });
      return;
    }

    if (!response.ok) {
      // Quota exhaustion (429) carries a structured body with the engine's
      // usage summary so the UI can show the countdown-to-midnight modal and
      // the exact reason (daily credit vs a period service quota).
      if (response.status === 429) {
        let usage: SubscriptionUsageSummary | undefined;
        let code = "QUOTA_EXHAUSTED";
        let message = "سهمیه درخواست امروز شما به پایان رسیده است.";
        try {
          const body = (await response.json()) as {
            code?: string;
            message?: string;
            usage?: SubscriptionUsageSummary;
          };
          usage = body.usage;
          if (body.code) code = body.code;
          if (body.message) message = body.message;
        } catch {
          /* keep defaults */
        }
        callbacks.onError?.({ code, message, retryable: false, usage });
        return;
      }
      callbacks.onError?.({
        code: `HTTP_${response.status}`,
        message: "در حال حاضر اتصال به سرویس هوشمند امکان‌پذیر نیست.",
        retryable: response.status >= 500,
      });
      return;
    }

    if (!response.body) {
      callbacks.onError?.({
        code: "EMPTY_RESPONSE",
        message: "پاسخی از سرویس هوشمند دریافت نشد.",
        retryable: true,
      });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame
            .split("\n")
            .find((l) => l.startsWith("data:"))
            ?.slice(5)
            .trim();
          if (!line) continue;

          let event: SseEvent;
          try {
            event = JSON.parse(line) as SseEvent;
          } catch {
            continue;
          }

          // Pipeline progress events are handled before the switch so the
          // stage indicator advances on every backend transition.
          if (PIPELINE_EVENT_TYPES.has(event.type)) {
            callbacks.onPipeline?.({
              requestId: event.requestId ?? "",
              stage: event.stage ?? null,
              stageNumber: event.stageNumber ?? null,
              totalStages: event.totalStages ?? null,
              status: statusForEvent(event.type),
              sourcesUsed: event.sourcesUsed,
              requiresLawyerReview: event.requiresLawyerReview,
              pendingQuestions: event.pendingQuestions,
              code: event.code,
              message: event.message,
              retryable: event.retryable,
            });
            // response.delta is not in the set above; fall through for the
            // remaining event types below.
          }

          switch (event.type) {
            case "status":
              if (event.status) callbacks.onStatus?.(event.status as StreamStatus);
              break;
            case "chunk":
              callbacks.onChunk?.({ text: event.text ?? "", index: event.index ?? 0 });
              break;
            case "done":
              callbacks.onDone?.({
                messageId: event.messageId ?? "",
                sections: event.sections ?? [],
                references: event.references ?? [],
                requestId: event.requestId,
                userMessageId: event.userMessageId,
                userAttachments: event.userAttachments,
              });
              break;
            case "error":
              callbacks.onError?.({
                code: event.code ?? "UNKNOWN",
                message: event.message ?? "خطای نامشخص",
                retryable: event.retryable ?? true,
              });
              break;
            case "workflow":
              callbacks.onWorkflow?.({
                phase: event.phase ?? "DISCOVERY",
                domain: event.domain ?? null,
                intent: event.intent ?? null,
                phaseChanged: event.phaseChanged ?? false,
                pendingQuestions: event.pendingQuestions ?? [],
                suggestCaseCreation: event.suggestCaseCreation ?? false,
              });
              break;
          }
        }
      }
    } catch {
      if (controller.signal.aborted) return;
      callbacks.onError?.({
        code: "STREAM_ERROR",
        message: "اتصال در حین دریافت پاسخ قطع شد.",
        retryable: true,
      });
    }
  })();

  return () => controller.abort();
}
