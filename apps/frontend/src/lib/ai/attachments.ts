// ============================================================
// LEGALIR — Chat Document Attachments (server-only)
// ============================================================
// Links documents a user already owns to a chat message. The document is
// NEVER copied or re-uploaded — this module only persists a reference row:
//
//     Document  ←  MessageAttachment  →  Message
//
// Ownership is enforced here, on the server, so a crafted request can never
// attach another user's document to a conversation.
// ============================================================

import { readTable, writeTable } from "@/lib/db";
import { getDemoDocument } from "@/lib/demo-seed";
import {
  MAX_CHAT_ATTACHMENTS,
  type ChatAttachmentRef,
  type MessageAttachment,
  type RiskLevel,
  type V1DocumentListItem,
} from "@legalir/types";

const TABLE = "message_attachments";

/** Same severity roll-up the documents list uses, so risk badges agree. */
function overallRisk(severities: RiskLevel[]): RiskLevel {
  if (severities.includes("critical")) return "critical";
  if (severities.includes("high")) return "high";
  if (severities.includes("medium")) return "medium";
  return "low";
}

/** Project a stored document row into the client-facing attachment ref. */
function toRef(
  row: MessageAttachment,
  doc: {
    id: string;
    name: string;
    mime: string;
    sizeBytes: number;
    status: ChatAttachmentRef["status"];
    report: { findings?: { severity: RiskLevel }[] } | null;
  }
): ChatAttachmentRef {
  const severities = (doc.report?.findings ?? []).map((f) => f.severity);
  return {
    attachmentId: row.id,
    documentId: doc.id,
    name: doc.name,
    mime: doc.mime,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    riskLevel: doc.report ? overallRisk(severities) : null,
    findingCount: doc.report?.findings?.length ?? 0,
    createdAt: row.createdAt,
  };
}

// ============================================================
// Persistence primitives
// ============================================================

function allAttachments(): MessageAttachment[] {
  return readTable<MessageAttachment>(TABLE);
}

function saveAttachments(rows: MessageAttachment[]): void {
  writeTable(TABLE, rows);
}

// ============================================================
// Linking
// ============================================================

export interface LinkResult {
  /** Attachment rows that were created (or already existed). */
  linked: MessageAttachment[];
  /** Document ids that were rejected because the user does not own them. */
  rejected: string[];
}

/**
 * Link a set of documents to a message. Every document id is validated
 * against the *requesting user's* own documents; ids the user does not own
 * are silently dropped and reported in `rejected` — they are never linked.
 *
 * Idempotent: re-linking the same document to the same message is a no-op.
 * Enforces MAX_CHAT_ATTACHMENTS.
 */
export function linkAttachmentsToMessage(params: {
  userId: string;
  conversationId: string;
  messageId: string;
  documentIds: string[];
}): LinkResult {
  const { userId, conversationId, messageId } = params;

  // De-duplicate while preserving order, then cap.
  const unique = Array.from(new Set(params.documentIds.filter(Boolean)));
  const capped = unique.slice(0, MAX_CHAT_ATTACHMENTS);

  const existing = allAttachments();
  const linked: MessageAttachment[] = [];
  const rejected: string[] = [];

  for (const documentId of capped) {
    // Ownership check — the document must belong to this user.
    const doc = getDemoDocument(userId, documentId);
    if (!doc) {
      rejected.push(documentId);
      continue;
    }

    const already = existing.find(
      (a) => a.messageId === messageId && a.documentId === documentId
    );
    if (already) {
      linked.push(already);
      continue;
    }

    const row: MessageAttachment = {
      id: `att-${crypto.randomUUID()}`,
      messageId,
      conversationId,
      documentId,
      userId,
      createdAt: new Date().toISOString(),
    };
    existing.push(row);
    linked.push(row);
  }

  // Any ids beyond the cap are reported as rejected (not silently ignored).
  for (const documentId of unique.slice(MAX_CHAT_ATTACHMENTS)) {
    rejected.push(documentId);
  }

  if (linked.length > 0) saveAttachments(existing);
  return { linked, rejected };
}

// ============================================================
// Reading
// ============================================================

/** Raw attachment rows for a message, in creation order. */
export function getMessageAttachments(messageId: string): MessageAttachment[] {
  return allAttachments()
    .filter((a) => a.messageId === messageId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Raw attachment rows for every message in a conversation. */
export function getConversationAttachments(conversationId: string): MessageAttachment[] {
  return allAttachments().filter((a) => a.conversationId === conversationId);
}

/** Drop every attachment link for a conversation (used on delete). */
export function deleteConversationAttachments(conversationId: string): void {
  const rows = allAttachments();
  const next = rows.filter((a) => a.conversationId !== conversationId);
  if (next.length !== rows.length) saveAttachments(next);
}

/**
 * Hydrate attachment rows into client-facing refs (document metadata only).
 * Rows whose document has since been deleted are dropped.
 */
export function hydrateAttachments(rows: MessageAttachment[]): ChatAttachmentRef[] {
  const refs: ChatAttachmentRef[] = [];
  for (const row of rows) {
    const doc = getDemoDocument(row.userId, row.documentId);
    if (!doc) continue;
    refs.push(toRef(row, doc));
  }
  return refs;
}

/** Hydrated refs for a single message. */
export function getMessageAttachmentRefs(messageId: string): ChatAttachmentRef[] {
  return hydrateAttachments(getMessageAttachments(messageId));
}

/**
 * Hydrated refs grouped by message id — used to decorate a conversation's
 * message list in one pass.
 */
export function getAttachmentRefsByMessage(
  conversationId: string
): Record<string, ChatAttachmentRef[]> {
  const grouped: Record<string, ChatAttachmentRef[]> = {};
  for (const row of getConversationAttachments(conversationId)) {
    const doc = getDemoDocument(row.userId, row.documentId);
    if (!doc) continue;
    (grouped[row.messageId] ??= []).push(toRef(row, doc));
  }
  return grouped;
}

// ============================================================
// Recent documents (attach picker source)
// ============================================================

/**
 * The user's most recent documents, newest first, for the attach picker.
 * Metadata only — never the file bytes.
 */
export function listRecentDocuments(userId: string, limit = 12): V1DocumentListItem[] {
  return readTable<{
    id: string;
    userId: string;
    name: string;
    mime: string;
    sizeBytes: number;
    status: V1DocumentListItem["status"];
    createdAt: string;
    updatedAt: string;
    report: { findings?: { severity: RiskLevel }[] } | null;
  }>("documents")
    .filter((d) => d.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map((d) => {
      const severities = (d.report?.findings ?? []).map((f) => f.severity);
      return {
        id: d.id,
        name: d.name,
        mime: d.mime,
        sizeBytes: d.sizeBytes,
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        riskLevel: d.report ? overallRisk(severities) : null,
        findingCount: d.report?.findings?.length ?? 0,
      };
    });
}

// ============================================================
// AI context
// ============================================================

export interface AttachmentContext {
  /** Document ids that were valid and owned by the user. */
  documentIds: string[];
  /** Extracted text of each attached document, for prompt grounding. */
  texts: { documentId: string; name: string; text: string }[];
}

/**
 * Resolve the AI context for a set of attachment document ids. Only documents
 * owned by the user are included. Uses the document's already-extracted text
 * (from the existing analysis pipeline) rather than re-reading raw bytes, so
 * the full file is never blindly injected into the prompt.
 */
export function resolveAttachmentContext(
  userId: string,
  documentIds: string[]
): AttachmentContext {
  const unique = Array.from(new Set(documentIds.filter(Boolean)));
  const documentIdsOut: string[] = [];
  const texts: AttachmentContext["texts"] = [];

  for (const documentId of unique) {
    const doc = getDemoDocument(userId, documentId);
    if (!doc) continue;
    documentIdsOut.push(documentId);
    const text = doc.extractedText?.trim();
    if (text) {
      texts.push({ documentId, name: doc.name, text });
    }
  }

  return { documentIds: documentIdsOut, texts };
}
