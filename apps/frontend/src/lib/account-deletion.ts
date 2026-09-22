// ============================================================
// LEGALIR — Account Deletion (server-only)
// ============================================================
// Permanently removes every row that belongs to a user across all
// JSON tables. This is a real, irreversible purge — not a simulated
// one. Rows are matched by the user-scoping column each table uses
// (`id` for users, `userId` for camelCase tables, `user_id` for
// snake_case tables, and `case_id` for case children).
// ============================================================

import { readTable, writeTable } from "./db";
import type { StoredConversation } from "./db";
import { deleteMessages } from "./ai/store";

/** Tables scoped by a `user_id` column. */
const SNAKE_TABLES = [
  "profiles",
  "preferences",
  "activities",
  "subscriptions",
  "usage_stats",
  "reward_ledger",
  "cases",
] as const;

/** Tables scoped by a `userId` column. */
const CAMEL_TABLES = [
  "conversations",
  "documents",
  "contracts",
  "memories",
  "relationships",
  "contract-drafts",
] as const;

export interface DeleteAccountResult {
  ok: boolean;
  /** Number of rows removed, per table (for audit/logging). */
  removed: Record<string, number>;
}

/**
 * Delete a user and all of their data. Idempotent: deleting an
 * already-deleted user returns `ok: false` with an empty report.
 */
export function deleteAccount(userId: string): DeleteAccountResult {
  const removed: Record<string, number> = {};

  // 1. Conversation messages live in a separate keyed table — remove
  //    them first, while we can still enumerate the user's conversations.
  const conversations = readTable<StoredConversation>("conversations");
  const userConversations = conversations.filter((c) => c.userId === userId);
  for (const conv of userConversations) {
    deleteMessages(conv.id);
  }

  // 2. Case children (timeline + tasks) are scoped by case_id, so gather
  //    the user's case ids before the cases themselves are removed.
  const caseIds = new Set(
    readTable<{ id: string; user_id: string }>("cases")
      .filter((c) => c.user_id === userId)
      .map((c) => c.id)
  );
  for (const table of ["case_timeline", "case_tasks"] as const) {
    const rows = readTable<{ case_id: string }>(table);
    const kept = rows.filter((r) => !caseIds.has(r.case_id));
    if (kept.length !== rows.length) {
      removed[table] = rows.length - kept.length;
      writeTable(table, kept);
    }
  }

  // 3. Snake-case tables.
  for (const table of SNAKE_TABLES) {
    const rows = readTable<{ user_id: string }>(table);
    const kept = rows.filter((r) => r.user_id !== userId);
    if (kept.length !== rows.length) {
      removed[table] = rows.length - kept.length;
      writeTable(table, kept);
    }
  }

  // 4. Camel-case tables.
  for (const table of CAMEL_TABLES) {
    const rows = readTable<{ userId: string }>(table);
    const kept = rows.filter((r) => r.userId !== userId);
    if (kept.length !== rows.length) {
      removed[table] = rows.length - kept.length;
      writeTable(table, kept);
    }
  }

  // 5. Sessions.
  const sessions = readTable<{ userId: string }>("sessions");
  const keptSessions = sessions.filter((s) => s.userId !== userId);
  if (keptSessions.length !== sessions.length) {
    removed["sessions"] = sessions.length - keptSessions.length;
    writeTable("sessions", keptSessions);
  }

  // 6. The user row itself — last, so a partial failure never orphans data.
  const users = readTable<{ id: string }>("users");
  const keptUsers = users.filter((u) => u.id !== userId);
  const userExisted = keptUsers.length !== users.length;
  if (userExisted) {
    removed["users"] = 1;
    writeTable("users", keptUsers);
  }

  return { ok: userExisted, removed };
}
