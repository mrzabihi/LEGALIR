// ============================================================
// LEGALIR — Consultation case room messaging (JSON tables)
// ============================================================
// Tables:
//   message_threads  — one thread per consultation request
//   secure_messages  — append-only messages in a thread
//
// This is deliberately NOT the AI chat. The AI chat (`conversations` /
// `conversation-messages`) is single-user and its `role` field encodes an
// AI turn. A consultation thread has two human participants — the client
// and the assigned lawyer — and every message records which of them sent
// it. The two systems never share storage.
//
// Access is case-scoped: a caller may only read a thread they participate
// in. That check lives in the route (which knows the request), not here —
// this module is a plain store.
// ============================================================

import { readTable, writeTable } from "./db";
import type { MessageThread, SecureMessage, PlatformRole } from "@legalir/types";

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

export function getThreadByRequestId(requestId: string): MessageThread | undefined {
  return readTable<MessageThread>("message_threads").find((t) => t.requestId === requestId);
}

export function getThreadById(id: string): MessageThread | undefined {
  return readTable<MessageThread>("message_threads").find((t) => t.id === id);
}

/**
 * Return the thread for a request, creating it on first use. Idempotent:
 * two concurrent callers converge on the same thread because the lookup
 * happens before the write and the id is derived from the request.
 */
export function getOrCreateThread(
  requestId: string,
  caseId: string | null,
  participantUserIds: string[]
): MessageThread {
  const existing = getThreadByRequestId(requestId);
  if (existing) return existing;

  const thread: MessageThread = {
    id: `thread-${crypto.randomUUID()}`,
    caseId: caseId ?? "",
    requestId,
    participantUserIds: [...new Set(participantUserIds)],
    lastMessageAt: null,
    unreadCount: 0,
    createdAt: new Date().toISOString(),
  };
  const rows = readTable<MessageThread>("message_threads");
  rows.push(thread);
  writeTable("message_threads", rows);
  return thread;
}

/** True when `userId` is a participant of the thread. */
export function isThreadParticipant(thread: MessageThread, userId: string): boolean {
  return thread.participantUserIds.includes(userId);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function listMessages(threadId: string): SecureMessage[] {
  return readTable<SecureMessage>("secure_messages")
    .filter((m) => m.threadId === threadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function appendMessage(params: {
  threadId: string;
  senderUserId: string;
  senderRole: PlatformRole;
  body: string;
}): SecureMessage {
  const message: SecureMessage = {
    id: `msg-${crypto.randomUUID()}`,
    threadId: params.threadId,
    senderUserId: params.senderUserId,
    senderRole: params.senderRole,
    body: params.body,
    attachments: [],
    readAt: null,
    createdAt: new Date().toISOString(),
  };

  const rows = readTable<SecureMessage>("secure_messages");
  rows.push(message);
  writeTable("secure_messages", rows);

  // Keep the thread's lastMessageAt in step so the list can sort by it.
  const threads = readTable<MessageThread>("message_threads");
  const idx = threads.findIndex((t) => t.id === params.threadId);
  if (idx !== -1) {
    threads[idx] = { ...threads[idx]!, lastMessageAt: message.createdAt };
    writeTable("message_threads", threads);
  }

  return message;
}

/**
 * Mark every message the given user did NOT send as read. Returns the
 * number of messages affected.
 */
export function markThreadRead(threadId: string, userId: string): number {
  const rows = readTable<SecureMessage>("secure_messages");
  const now = new Date().toISOString();
  let changed = 0;
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i]!;
    if (m.threadId !== threadId) continue;
    if (m.senderUserId === userId) continue;
    if (m.readAt) continue;
    rows[i] = { ...m, readAt: now };
    changed += 1;
  }
  if (changed > 0) writeTable("secure_messages", rows);
  return changed;
}

/** Count of unread messages in a thread for the given viewer. */
export function countUnread(threadId: string, userId: string): number {
  return listMessages(threadId).filter((m) => m.senderUserId !== userId && !m.readAt).length;
}
