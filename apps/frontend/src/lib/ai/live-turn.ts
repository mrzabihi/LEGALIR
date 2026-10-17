// ============================================================
// LEGALIR — Live chat turn (isomorphic, client-safe)
// ============================================================
// The single client-side model for ONE turn — the user message the user just
// sent plus the assistant reply it produces. It is what makes the
// conversation behave like a familiar messenger while staying honest to the
// backend, because every field it carries is either user input or a real
// backend event:
//
//   • the user message is shown the instant the user sends (status: sending)
//   • the assistant message is created on the FIRST real chunk and grows as
//     real chunks arrive (status: streaming) — never by a client-side timer
//   • on `done` it is reconciled to the server's persisted ids, attachments,
//     sections and references (status: completed)
//   • on failure the user message is kept with status: failed and a retry
//     that re-sends the SAME content — never a duplicate bubble
//   • on stop the partial reply received so far is kept
//
// Pure and framework-free so it runs in the browser and in unit tests.
// ============================================================

import type {
  Message,
  MessageStatus,
  ChatAttachmentRef,
  StructuredResponseSection,
  V1Reference,
  V1DocumentListItem,
} from "@legalir/types";
import type { StreamChunk, StreamDone } from "@/lib/ai/stream-client";

/** The streaming reply half of a turn. */
export interface LiveAssistantMessage {
  content: string;
  sections: StructuredResponseSection[];
  references: V1Reference[];
  status: MessageStatus;
  createdAt: string;
}

export interface LiveTurn {
  /** Local id for the optimistic user bubble (never persisted). */
  localUserId: string;
  conversationId: string;
  /** The exact text the user sent — reused verbatim on retry. */
  content: string;
  /** Documents selected in the composer for this turn (pre-send refs). */
  pendingAttachments: ChatAttachmentRef[];
  /** Server ids, filled when the turn is reconciled. */
  serverUserId: string | null;
  serverAssistantId: string | null;
  /** The persisted attachment refs for the user message (server-returned). */
  attachments: ChatAttachmentRef[];
  userStatus: MessageStatus;
  assistant: LiveAssistantMessage | null;
  /** The backend processing-run id for this turn (trace / restore). */
  runId: string | null;
  /** A user-safe error message, when the turn failed. */
  error: string | null;
  retryable: boolean;
  startedAt: string;
}

/** Narrow a document list item to the minimal attachment ref the UI renders
 *  before the server has confirmed the link. */
function documentToPendingRef(doc: V1DocumentListItem): ChatAttachmentRef {
  return {
    attachmentId: `pending:${doc.id}`,
    documentId: doc.id,
    name: doc.name,
    mime: doc.mime,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    riskLevel: doc.riskLevel ?? null,
    findingCount: doc.findingCount ?? 0,
    createdAt: doc.createdAt,
  };
}

/** Build the optimistic turn shown the moment the user sends. */
export function createLiveTurn(params: {
  conversationId: string;
  content: string;
  attachments?: V1DocumentListItem[];
}): LiveTurn {
  const now = new Date().toISOString();
  return {
    localUserId: `local-${crypto.randomUUID()}`,
    conversationId: params.conversationId,
    content: params.content,
    pendingAttachments: (params.attachments ?? []).map(documentToPendingRef),
    serverUserId: null,
    serverAssistantId: null,
    attachments: [],
    userStatus: "sending",
    assistant: null,
    runId: null,
    error: null,
    retryable: false,
    startedAt: now,
  };
}

/** Fold one real stream chunk into the turn, creating the assistant message
 *  on the first chunk. Never advances on a timer — only real text arrives. */
export function applyChunk(turn: LiveTurn, chunk: StreamChunk): LiveTurn {
  if (!chunk.text) return turn;
  const assistant: LiveAssistantMessage = turn.assistant
    ? { ...turn.assistant, content: turn.assistant.content + chunk.text }
    : {
        content: chunk.text,
        sections: [],
        references: [],
        status: "streaming",
        createdAt: new Date().toISOString(),
      };
  return {
    ...turn,
    userStatus: turn.userStatus === "sending" ? "sent" : turn.userStatus,
    assistant: { ...assistant, status: "streaming" },
  };
}

/** Record the backend processing-run id for this turn (from a pipeline event). */
export function applyRunId(turn: LiveTurn, runId: string): LiveTurn {
  if (!runId || turn.runId === runId) return turn;
  return { ...turn, runId };
}

/** Reconcile the turn with the server's `done` event — the user message is
 *  now truly persisted, and the assistant reply carries its real sections
 *  and references. */
export function completeTurn(turn: LiveTurn, done: StreamDone): LiveTurn {
  const assistant: LiveAssistantMessage = turn.assistant
    ? {
        ...turn.assistant,
        sections: done.sections.length > 0 ? done.sections : turn.assistant.sections,
        references:
          done.references.length > 0 ? done.references : turn.assistant.references,
        status: "completed",
      }
    : // No chunk ever arrived (unexpected) — keep a completed reply carrying
      // the server sections so the refetch can take over without a flash.
      {
        content: "",
        sections: done.sections,
        references: done.references,
        status: "completed",
        createdAt: new Date().toISOString(),
      };

  return {
    ...turn,
    serverUserId: done.userMessageId ?? turn.serverUserId,
    serverAssistantId: done.messageId ?? turn.serverAssistantId,
    attachments:
      done.userAttachments && done.userAttachments.length > 0
        ? done.userAttachments
        : turn.pendingAttachments,
    userStatus: "sent",
    runId: done.requestId ?? turn.runId,
    assistant,
    error: null,
    retryable: false,
  };
}

/** Mark the turn failed, keeping the user message so it can be retried. */
export function failTurn(
  turn: LiveTurn,
  message: string,
  retryable = true
): LiveTurn {
  return {
    ...turn,
    userStatus: "failed",
    assistant: turn.assistant
      ? { ...turn.assistant, status: "failed" }
      : turn.assistant,
    error: message,
    retryable,
  };
}

/** Mark the turn cancelled — any partial reply received so far is kept and
 *  the user message stays as sent (the backend records the cancellation). */
export function cancelTurn(turn: LiveTurn): LiveTurn {
  return {
    ...turn,
    userStatus: "sent",
    assistant: turn.assistant
      ? { ...turn.assistant, status: "completed" }
      : turn.assistant,
    error: null,
    retryable: false,
  };
}

// ============================================================
// Rendering helpers
// ============================================================

/** Project the turn to the user message + assistant message the workspace
 *  renders. The assistant appears only once streaming has begun. */
export function liveTurnMessages(turn: LiveTurn): Message[] {
  const out: Message[] = [];

  out.push({
    id: turn.serverUserId ?? turn.localUserId,
    conversationId: turn.conversationId,
    role: "user",
    content: turn.content,
    status: turn.userStatus,
    createdAt: turn.startedAt,
    attachments:
      turn.attachments.length > 0 ? turn.attachments : turn.pendingAttachments,
  });

  if (turn.assistant) {
    out.push({
      id: turn.serverAssistantId ?? `local-assistant-${turn.localUserId}`,
      conversationId: turn.conversationId,
      role: "assistant",
      content: turn.assistant.content,
      status: turn.assistant.status,
      createdAt: turn.assistant.createdAt,
      sections: turn.assistant.sections,
      references: turn.assistant.references,
    } as Message);
  }

  return out;
}

/**
 * Merge the persisted conversation messages with the live turn, dropping any
 * live item the server has already persisted (matched by server id). This is
 * what lets the refetch that follows `done` take over seamlessly — no
 * duplicated bubbles, no flash.
 */
export function mergeTurn(
  persisted: readonly Message[],
  turn: LiveTurn | null
): Message[] {
  if (!turn) return [...persisted];

  const persistedIds = new Set(persisted.map((m) => m.id));
  const extra = liveTurnMessages(turn).filter((m) => !persistedIds.has(m.id));

  // Persisted messages keep chronological order; this turn's still-unpersisted
  // remainder is appended.
  return [...persisted, ...extra];
}

/** True once the server has persisted both halves of the turn — the live
 *  state can then be dropped. */
export function isTurnFullyPersisted(
  turn: LiveTurn,
  persisted: readonly Message[]
): boolean {
  if (!turn.serverUserId || !turn.serverAssistantId) return false;
  const ids = new Set(persisted.map((m) => m.id));
  return ids.has(turn.serverUserId) && ids.has(turn.serverAssistantId);
}
