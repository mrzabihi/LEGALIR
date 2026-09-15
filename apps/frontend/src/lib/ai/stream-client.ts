// ============================================================
// LEGALIR — AI Streaming Client (browser)
// ============================================================
// Consumes the server-side SSE gateway (/api/v1/ai/stream).
// The browser only knows about the LEGALIR backend — no provider
// credentials or provider names reach the client.
// ============================================================

import { env } from "@legalir/config";
import type { StructuredResponseSection, V1Reference, V1DailyQuota } from "@legalir/types";

export interface StreamRequestContext {
  serviceType?: string;
  category?: string;
  documentId?: string;
}

export interface StreamRequest {
  conversationId: string;
  content: string;
  context?: StreamRequestContext;
}

export interface StreamChunk {
  text: string;
  index: number;
}

export interface StreamDone {
  messageId: string;
  sections: StructuredResponseSection[];
  references: V1Reference[];
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

export interface StreamCallbacks {
  onStatus?: (status: StreamStatus) => void;
  onChunk?: (chunk: StreamChunk) => void;
  onDone?: (done: StreamDone) => void;
  onError?: (error: { code: string; message: string; retryable: boolean; quota?: V1DailyQuota }) => void;
  onWorkflow?: (event: WorkflowEvent) => void;
}

interface SseEvent {
  type: string;
  status?: StreamStatus;
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
      // Quota exhaustion (429) carries a structured body with the live
      // quota so the UI can show the countdown-to-midnight modal.
      if (response.status === 429) {
        let quota: V1DailyQuota | undefined;
        let message = "سهمیه درخواست امروز شما به پایان رسیده است.";
        try {
          const body = (await response.json()) as { message?: string; quota?: V1DailyQuota };
          quota = body.quota;
          if (body.message) message = body.message;
        } catch {
          /* keep defaults */
        }
        callbacks.onError?.({ code: "QUOTA_EXHAUSTED", message, retryable: false, quota });
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

          switch (event.type) {
            case "status":
              if (event.status) callbacks.onStatus?.(event.status);
              break;
            case "chunk":
              callbacks.onChunk?.({ text: event.text ?? "", index: event.index ?? 0 });
              break;
            case "done":
              callbacks.onDone?.({
                messageId: event.messageId ?? "",
                sections: event.sections ?? [],
                references: event.references ?? [],
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
