// ============================================================
// LEGALIR — Admin support tickets (server-only)
// ============================================================
// Owned table: support_tickets. Each ticket carries its message thread.
// Requester mobile numbers are stored MASKED — the full number is never
// persisted here. An internal note (isInternal) is hidden from the
// requester in any future self-service surface.
// ============================================================

import { readTable, writeTable, findUserById } from "@/lib/db";
import { maskMobile } from "./orders";
import { matchesRow } from "@/lib/search/normalize";
import { ROLE_FA, roleHasPermission, type PlatformRole } from "@legalir/types";
import type {
  SupportAgent,
  SupportTicket,
  SupportTicketEvent,
  SupportTicketEventKind,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@legalir/types";

const TABLE = "support_tickets";
/** Append-only history of operator actions. Never rewritten in place. */
const EVENTS_TABLE = "support_ticket_events";

/** The permission that makes a staff member assignable/referable. */
export const SUPPORT_MANAGE_PERMISSION = "admin:support:manage";

/** Response-time targets (hours) per priority. */
export const SLA_HOURS: Record<SupportTicketPriority, number> = {
  urgent: 4,
  high: 8,
  normal: 24,
  low: 72,
};

interface UserRow {
  id: string;
  mobile: string;
  displayName: string | null;
  role?: string;
}

function readTickets(): SupportTicket[] {
  return readTable<SupportTicket>(TABLE);
}

/** The stored row minus the read-time decoration. */
function isActive(t: SupportTicket): boolean {
  return t.status !== "resolved" && t.status !== "closed";
}

/**
 * Resolve the assignee's display name. The name is DERIVED on read and never
 * persisted on the ticket, so renaming a staff member updates every ticket
 * they own instead of leaving a stale copy behind. A missing user (deleted
 * account) resolves to null rather than a fake name.
 */
function resolveAssignee(userId: string | null): string | null {
  if (!userId) return null;
  const user = findUserById(userId) as UserRow | undefined;
  // A DELETED account resolves to null, which the UI renders as
  // «کاربر حذفشده». A live account without a display name falls back to its
  // id — the same fallback the assignment picker uses — so the two surfaces
  // never describe the same person differently.
  if (!user) return null;
  return user.displayName ?? user.id;
}

/** The client-safe projection: the stored row plus its derived assignee name. */
function toTicket(t: SupportTicket): SupportTicket {
  return { ...t, assigneeName: resolveAssignee(t.assigneeUserId) };
}

export interface SupportQuery {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assigneeUserId?: string;
  /** true → only unassigned; false → only assigned. Absent → either. */
  unassigned?: boolean;
  /** true → only tickets past their SLA and still active. */
  overdue?: boolean;
  search?: string;
  /** `priority-desc` puts urgent first; `due` puts the nearest deadline first. */
  sort?: "updated" | "priority-desc" | "due";
}

const PRIORITY_RANK: Record<SupportTicketPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/** All tickets with optional filters, sorted per the caller's request. */
export function listTickets(query: SupportQuery = {}): SupportTicket[] {
  let rows = readTickets();
  if (query.status) rows = rows.filter((t) => t.status === query.status);
  if (query.priority) rows = rows.filter((t) => t.priority === query.priority);
  if (query.assigneeUserId) rows = rows.filter((t) => t.assigneeUserId === query.assigneeUserId);
  if (query.unassigned === true) rows = rows.filter((t) => !t.assigneeUserId);
  if (query.unassigned === false) rows = rows.filter((t) => Boolean(t.assigneeUserId));
  if (query.overdue === true) rows = rows.filter(isOverdue);
  if (query.search) {
    // Shared normalisation lane (Persian/Arabic digits + letter forms).
    rows = rows.filter((t) =>
      matchesRow(query.search!, { texts: [t.subject, t.requesterName, t.category, t.id] })
    );
  }

  const sorted = [...rows];
  if (query.sort === "priority-desc") {
    // Active tickets first (a closed urgent ticket is not work), then by
    // priority, then newest — deterministic for any two equal tickets.
    sorted.sort(
      (a, b) =>
        Number(isActive(b)) - Number(isActive(a)) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.updatedAt.localeCompare(a.updatedAt)
    );
  } else if (query.sort === "due") {
    // A ticket with no deadline sorts last; resolved/closed deadlines are
    // irrelevant, so they sink below every active deadline.
    const dueKey = (t: SupportTicket) =>
      !isActive(t) ? Number.POSITIVE_INFINITY : t.dueAt ? new Date(t.dueAt).getTime() : Number.POSITIVE_INFINITY;
    sorted.sort((a, b) => dueKey(a) - dueKey(b) || b.updatedAt.localeCompare(a.updatedAt));
  } else {
    sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return sorted.map(toTicket);
}

export function getTicket(id: string): SupportTicket | undefined {
  const t = readTickets().find((row) => row.id === id);
  return t ? toTicket(t) : undefined;
}

// ============================================================
// History (append-only)
// ============================================================

function readEvents(): SupportTicketEvent[] {
  return readTable<SupportTicketEvent>(EVENTS_TABLE);
}

/**
 * Append one history row. The trail is append-only: an event is never edited
 * or deleted, so the drawer's history is an audit record, not a view that a
 * later edit can rewrite.
 */
function recordEvent(event: Omit<SupportTicketEvent, "id">): void {
  const rows = readEvents();
  rows.push({ id: `tke-${crypto.randomUUID()}`, ...event });
  writeTable(EVENTS_TABLE, rows);
}

export interface TicketActor {
  userId: string;
  name: string;
}

/** One ticket's history, newest first (the order the drawer renders). */
export function listTicketEvents(ticketId: string): SupportTicketEvent[] {
  return readEvents()
    .filter((e) => e.ticketId === ticketId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

// ============================================================
// Assignment / referral
// ============================================================

/**
 * Every staff member who may own a ticket. Derived from the role→permission
 * matrix — the same source the API's own gate reads — so the picker can never
 * offer someone the server would then refuse to assign.
 */
export function listAssignableAgents(): SupportAgent[] {
  return readTable<UserRow>("users")
    .filter(
      (u) =>
        Boolean(u.role) && roleHasPermission(u.role as PlatformRole, SUPPORT_MANAGE_PERMISSION)
    )
    .map((u) => ({
      id: u.id,
      displayName: u.displayName ?? u.id,
      role: u.role!,
      roleFa: ROLE_FA[u.role as PlatformRole] ?? String(u.role),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "fa"));
}

export interface CreateTicketInput {
  subject: string;
  category: string;
  priority?: SupportTicketPriority;
  requesterUserId: string | null;
  requesterName: string;
  body: string;
  authorUserId: string;
  authorName: string;
}

/** Open a ticket with its first message. */
export function createTicket(input: CreateTicketInput): SupportTicket | { error: string } {
  if (!input.subject.trim()) return { error: "SUBJECT_REQUIRED" };
  if (!input.body.trim()) return { error: "BODY_REQUIRED" };

  const now = new Date().toISOString();
  const priority: SupportTicketPriority = input.priority ?? "normal";
  const slaHours = SLA_HOURS[priority];
  const requester = input.requesterUserId ? findUserById(input.requesterUserId) : undefined;

  const firstMessage: SupportTicketMessage = {
    id: `msg-${crypto.randomUUID()}`,
    ticketId: "",
    authorUserId: input.authorUserId,
    authorName: input.authorName,
    isBot: false,
    isInternal: false,
    body: input.body.trim(),
    createdAt: now,
  };
  const ticket: SupportTicket = {
    id: `tkt-${crypto.randomUUID()}`,
    subject: input.subject.trim(),
    category: input.category,
    priority,
    status: "open",
    requesterUserId: input.requesterUserId,
    requesterName: requester?.displayName ?? input.requesterName,
    requesterMobileMasked: requester ? maskMobile(requester.mobile) : null,
    assigneeUserId: null,
    // Derived on read (`toTicket`). The stored row never carries this field.
    assigneeName: null,
    slaHours,
    dueAt: new Date(Date.now() + slaHours * 3_600_000).toISOString(),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  firstMessage.ticketId = ticket.id;
  ticket.messages.push(firstMessage);

  const rows = readTickets();
  rows.push(ticket);
  writeTable(TABLE, rows);

  recordEvent({
    ticketId: ticket.id,
    kind: "created",
    at: now,
    actorUserId: input.authorUserId,
    actorName: input.authorName,
    from: null,
    to: "open",
    note: null,
  });
  return toTicket(ticket);
}

export interface AddMessageInput {
  ticketId: string;
  authorUserId: string;
  authorName: string;
  body: string;
  isInternal?: boolean;
}

/** Append a message to a ticket's thread. */
export function addMessage(input: AddMessageInput): SupportTicket | { error: string } {
  if (!input.body.trim()) return { error: "BODY_REQUIRED" };
  const rows = readTickets();
  const idx = rows.findIndex((t) => t.id === input.ticketId);
  if (idx === -1) return { error: "NOT_FOUND" };
  const ticket = rows[idx]!;
  const now = new Date().toISOString();
  ticket.messages.push({
    id: `msg-${crypto.randomUUID()}`,
    ticketId: ticket.id,
    authorUserId: input.authorUserId,
    authorName: input.authorName,
    isBot: false,
    isInternal: Boolean(input.isInternal),
    body: input.body.trim(),
    createdAt: now,
  });
  // A staff reply moves an open ticket into progress.
  if (ticket.status === "open") ticket.status = "in_progress";
  ticket.updatedAt = now;
  rows[idx] = ticket;
  writeTable(TABLE, rows);

  // The message itself lives in the thread; the trail only records that it
  // happened (and whether it was internal), never a second copy of the body.
  recordEvent({
    ticketId: ticket.id,
    kind: input.isInternal ? "internal_note" : "message",
    at: now,
    actorUserId: input.authorUserId,
    actorName: input.authorName,
    from: null,
    to: null,
    note: null,
  });
  return toTicket(ticket);
}

export interface UpdateTicketInput {
  ticketId: string;
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assigneeUserId?: string | null;
  /** Why the ticket was handed to that person; stored on the assignment event. */
  referralNote?: string | null;
  /** Who performed the change — required for the history trail. */
  actor: TicketActor;
}

/** Update a ticket's status/priority/assignee, recording each real change. */
export function updateTicket(input: UpdateTicketInput): SupportTicket | { error: string } {
  const rows = readTickets();
  const idx = rows.findIndex((t) => t.id === input.ticketId);
  if (idx === -1) return { error: "NOT_FOUND" };
  const ticket = rows[idx]!;
  const now = new Date().toISOString();

  // Validate before mutating: an unknown staff id must not be half-applied
  // after the status has already been written.
  if (input.assigneeUserId) {
    const assignable = listAssignableAgents().some((a) => a.id === input.assigneeUserId);
    if (!assignable) return { error: "INVALID_ASSIGNEE" };
  }

  const events: Omit<SupportTicketEvent, "id" | "ticketId" | "at" | "actorUserId" | "actorName">[] =
    [];

  if (input.priority && input.priority !== ticket.priority) {
    const from = ticket.priority;
    ticket.priority = input.priority;
    ticket.slaHours = SLA_HOURS[input.priority];
    ticket.dueAt = new Date(Date.now() + ticket.slaHours * 3_600_000).toISOString();
    events.push({ kind: "priority", from, to: input.priority, note: null });
  }
  if (input.status && input.status !== ticket.status) {
    const from = ticket.status;
    ticket.status = input.status;
    events.push({ kind: "status", from, to: input.status, note: null });
  }
  if (input.assigneeUserId !== undefined && input.assigneeUserId !== ticket.assigneeUserId) {
    const fromName = resolveAssignee(ticket.assigneeUserId);
    ticket.assigneeUserId = input.assigneeUserId;
    events.push({
      kind: "assignment",
      from: fromName,
      to: resolveAssignee(input.assigneeUserId),
      note: input.referralNote?.trim() || null,
    });
  }

  // A no-op edit must not reorder the list or reset the "last updated" clock.
  if (events.length === 0) return toTicket(ticket);

  ticket.updatedAt = now;
  rows[idx] = ticket;
  writeTable(TABLE, rows);

  for (const e of events) {
    recordEvent({
      ticketId: ticket.id,
      at: now,
      actorUserId: input.actor.userId,
      actorName: input.actor.name,
      ...e,
    });
  }
  return toTicket(ticket);
}

export interface AssignTicketInput {
  ticketId: string;
  /** null = return the ticket to the unassigned queue. */
  assigneeUserId: string | null;
  actor: TicketActor;
  note?: string | null;
}

/** Hand a ticket to a support agent (or back to the queue) with a reason. */
export function assignTicket(input: AssignTicketInput): SupportTicket | { error: string } {
  return updateTicket({
    ticketId: input.ticketId,
    assigneeUserId: input.assigneeUserId,
    referralNote: input.note ?? null,
    actor: input.actor,
  });
}

/** True when an open ticket is past its response SLA (derived, not stored). */
export function isOverdue(ticket: SupportTicket): boolean {
  if (!ticket.dueAt) return false;
  if (ticket.status === "resolved" || ticket.status === "closed") return false;
  return ticket.dueAt < new Date().toISOString();
}

/** Aggregate counts for the support dashboard header. */
export function supportCounts(): {
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  overdue: number;
  unassigned: number;
} {
  const rows = readTickets();
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const t of rows) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
  }
  return {
    byStatus,
    byPriority,
    overdue: rows.filter(isOverdue).length,
    // Only ACTIVE unassigned tickets are actionable work.
    unassigned: rows.filter((t) => isActive(t) && !t.assigneeUserId).length,
  };
}
