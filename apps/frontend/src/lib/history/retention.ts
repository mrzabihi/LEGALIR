// ============================================================
// LEGALIR — Active-history retention (server-only)
// ============================================================
// Two INDEPENDENT limits apply to a user's ACTIVE history:
//   • at most 100 items, and
//   • items older than 31 days are purged.
// Crossing either limit is enough. Exactly 100 items is fine — only the
// 101st triggers the count rule.
//
// Archived items are exempt from BOTH limits and are never counted.
//
// Retention is measured from `retention_started_at` (falling back to the
// creation time on legacy rows), NOT from `created_at`, so restoring an
// old item from the archive gives it a fresh window instead of deleting
// it immediately.
//
// Scope of a purge: only the HISTORY entry is removed. For a
// conversation the history entry IS the conversation, so the chat and
// its messages go with it. For documents / contracts / cases /
// subscriptions the underlying record is an independent entity the user
// still reaches from its own section, so only the mirrored history row
// is dropped — retention never deletes a file or a case.
// ============================================================

import {
  readTable,
  writeTable,
  readConversations,
  writeConversations,
  type ActivityRow,
  type StoredConversation,
} from "@/lib/db";
import { deleteMessages } from "@/lib/ai/store";
import { deleteConversationAttachments } from "@/lib/ai/attachments";

export const RETENTION_MAX_ITEMS = 100;
export const RETENTION_MAX_AGE_DAYS = 31;
const RETENTION_MAX_AGE_MS = RETENTION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

/** The retention window start for an activity row (legacy rows fall back to creation). */
export function activityRetentionStart(row: ActivityRow): string {
  return row.retention_started_at ?? row.created_at;
}

/** The retention window start for a conversation (legacy rows fall back to creation). */
export function conversationRetentionStart(conv: StoredConversation): string {
  return conv.retentionStartedAt ?? conv.createdAt;
}

interface ActiveEntry {
  id: string;
  kind: "activity" | "conversation";
  retentionStart: string;
}

/**
 * Compute which active items a user's history must drop, given the two
 * independent limits. Pure — no writes — so it is directly testable.
 *
 * Deterministic order: oldest retention start first, ties broken by id,
 * so the same input always yields the same removals.
 */
export function selectExpiredEntries(
  entries: ActiveEntry[],
  now: Date = new Date()
): ActiveEntry[] {
  const cutoff = now.getTime() - RETENTION_MAX_AGE_MS;

  // Age rule — anything whose window started before the cutoff.
  const agedOut = entries.filter((e) => new Date(e.retentionStart).getTime() < cutoff);
  const survivors = entries.filter((e) => new Date(e.retentionStart).getTime() >= cutoff);

  // Count rule — only when strictly more than the cap remain.
  const ordered = [...survivors].sort((a, b) => {
    const byStart = a.retentionStart.localeCompare(b.retentionStart);
    return byStart !== 0 ? byStart : a.id.localeCompare(b.id);
  });
  const overflow =
    ordered.length > RETENTION_MAX_ITEMS ? ordered.slice(0, ordered.length - RETENTION_MAX_ITEMS) : [];

  return [...agedOut, ...overflow];
}

/**
 * Enforce the retention limits for a single user. Removes the selected
 * history entries (cascading a conversation's messages/attachments) and
 * returns the removed ids.
 */
export function enforceRetentionForUser(userId: string, now: Date = new Date()): string[] {
  const activities = readTable<ActivityRow>("activities").filter(
    (r) => r.user_id === userId && !r.archived
  );
  const conversations = readConversations().filter(
    (c) => c.userId === userId && c.status !== "archived"
  );

  const entries: ActiveEntry[] = [
    ...activities.map((r) => ({
      id: r.id,
      kind: "activity" as const,
      retentionStart: activityRetentionStart(r),
    })),
    ...conversations.map((c) => ({
      id: c.id,
      kind: "conversation" as const,
      retentionStart: conversationRetentionStart(c),
    })),
  ];

  const expired = selectExpiredEntries(entries, now);
  if (expired.length === 0) return [];

  const expiredActivityIds = new Set(
    expired.filter((e) => e.kind === "activity").map((e) => e.id)
  );
  const expiredConversationIds = new Set(
    expired.filter((e) => e.kind === "conversation").map((e) => e.id)
  );

  if (expiredActivityIds.size > 0) {
    const rows = readTable<ActivityRow>("activities");
    writeTable(
      "activities",
      rows.filter((r) => !(r.user_id === userId && expiredActivityIds.has(r.id)))
    );
  }

  if (expiredConversationIds.size > 0) {
    const all = readConversations();
    writeConversations(all.filter((c) => !(c.userId === userId && expiredConversationIds.has(c.id))));
    for (const id of expiredConversationIds) {
      deleteMessages(id);
      deleteConversationAttachments(id);
    }
  }

  return expired.map((e) => e.id);
}

/**
 * Run retention for every user that has active history. This is the body
 * of the periodic cleanup job; it is also safe to call opportunistically
 * (e.g. on history read) because it is idempotent.
 */
export function purgeExpiredHistory(now: Date = new Date()): { users: number; removed: number } {
  const userIds = new Set<string>();
  for (const r of readTable<ActivityRow>("activities")) {
    if (!r.archived) userIds.add(r.user_id);
  }
  for (const c of readConversations()) {
    if (c.status !== "archived") userIds.add(c.userId);
  }

  let removed = 0;
  for (const userId of userIds) {
    removed += enforceRetentionForUser(userId, now).length;
  }
  return { users: userIds.size, removed };
}
