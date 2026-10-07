// ============================================================
// LEGALIR — Admin platform announcements (server-only)
// ============================================================
// The write-side store for admin-authored announcements. Delivery is NOT
// handled here: `deriveNotifications` (lib/db) reads this same `announcements`
// table and surfaces published rows in the user's real notification feed,
// so the content panel never invents a parallel inbox.
//
// Invariants:
//   • a draft is persisted but never delivered;
//   • publishing stamps `publishedAt` and is idempotent-safe (re-publishing
//     does not move the timestamp);
//   • retracting (→ draft) immediately removes it from every feed;
//   • text is trimmed and length-capped; empty input is rejected.

import { readTable, writeTable, findUserById } from "@/lib/db";
import type {
  AdminAnnouncement,
  AnnouncementAudience,
  AnnouncementStatus,
  CreateAnnouncementInput,
} from "@legalir/types";
import { ANNOUNCEMENT_AUDIENCES } from "@legalir/types";
import type { AnnouncementRow } from "@/lib/db";

const TABLE = "announcements";
const TITLE_MAX = 120;
const MESSAGE_MAX = 600;
const HREF_MAX = 300;

export type AnnouncementError =
  | "TITLE_REQUIRED"
  | "MESSAGE_REQUIRED"
  | "INVALID_AUDIENCE"
  | "NOT_FOUND";

/** Hydrate a stored row with the author's current display name. */
function hydrate(row: AnnouncementRow): AdminAnnouncement {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    href: row.href,
    actionLabel: row.actionLabel,
    audience: row.audience,
    status: row.status,
    createdBy: row.createdBy,
    createdByName: findUserById(row.createdBy)?.displayName ?? null,
    createdAt: row.createdAt,
    publishedAt: row.publishedAt,
  };
}

/** Every announcement, newest first (drafts included). */
export function listAnnouncements(): AdminAnnouncement[] {
  return readTable<AnnouncementRow>(TABLE)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(hydrate);
}

function isAudience(v: unknown): v is AnnouncementAudience {
  return typeof v === "string" && (ANNOUNCEMENT_AUDIENCES as readonly string[]).includes(v);
}

/**
 * Create an announcement. `publish` controls whether it goes live at once;
 * a draft is stored but withheld from every feed until published.
 */
export function createAnnouncement(
  input: CreateAnnouncementInput,
  actorUserId: string
): AdminAnnouncement | { error: AnnouncementError } {
  const title = (input.title ?? "").trim().slice(0, TITLE_MAX);
  const message = (input.message ?? "").trim().slice(0, MESSAGE_MAX);
  if (!title) return { error: "TITLE_REQUIRED" };
  if (!message) return { error: "MESSAGE_REQUIRED" };
  if (!isAudience(input.audience)) return { error: "INVALID_AUDIENCE" };

  const href = input.href ? input.href.trim().slice(0, HREF_MAX) || null : null;
  const actionLabel =
    href && input.actionLabel ? input.actionLabel.trim().slice(0, 60) || null : null;
  const now = new Date().toISOString();

  const row: AnnouncementRow = {
    id: crypto.randomUUID(),
    title,
    message,
    href,
    actionLabel,
    audience: input.audience,
    status: input.publish ? "published" : "draft",
    createdBy: actorUserId,
    createdAt: now,
    publishedAt: input.publish ? now : null,
  };

  const rows = readTable<AnnouncementRow>(TABLE);
  rows.push(row);
  writeTable(TABLE, rows);
  return hydrate(row);
}

/**
 * Move an announcement between `draft` and `published`. Publishing is
 * idempotent: an already-published row keeps its original `publishedAt`
 * (so its position in the feed does not jump). Retracting clears it.
 */
export function setAnnouncementStatus(
  id: string,
  status: AnnouncementStatus,
  _actorUserId: string
): AdminAnnouncement | { error: AnnouncementError } {
  const rows = readTable<AnnouncementRow>(TABLE);
  const row = rows.find((r) => r.id === id);
  if (!row) return { error: "NOT_FOUND" };

  if (status === "published" && !row.publishedAt) {
    row.publishedAt = new Date().toISOString();
  }
  row.status = status;
  writeTable(TABLE, rows);
  return hydrate(row);
}
