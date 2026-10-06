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
import type {
  SupportTicket,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@legalir/types";

const TABLE = "support_tickets";

/** Response-time targets (hours) per priority. */
export const SLA_HOURS: Record<SupportTicketPriority, number> = {
  urgent: 4,
  high: 8,
  normal: 24,
  low: 72,
};

function readTickets(): SupportTicket[] {
  return readTable<SupportTicket>(TABLE);
}

export interface SupportQuery {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assigneeUserId?: string;
  search?: string;
}

/** All tickets, newest first, with optional filters. */
export function listTickets(query: SupportQuery = {}): SupportTicket[] {
  let rows = readTickets();
  if (query.status) rows = rows.filter((t) => t.status === query.status);
  if (query.priority) rows = rows.filter((t) => t.priority === query.priority);
  if (query.assigneeUserId) rows = rows.filter((t) => t.assigneeUserId === query.assigneeUserId);
  if (query.search) {
    const q = query.search.toLowerCase();
    rows = rows.filter(
      (t) => t.subject.toLowerCase().includes(q) || t.requesterName.toLowerCase().includes(q)
    );
  }
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getTicket(id: string): SupportTicket | undefined {
  return readTickets().find((t) => t.id === id);
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
  return ticket;
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
  ticket.messages.push({
    id: `msg-${crypto.randomUUID()}`,
    ticketId: ticket.id,
    authorUserId: input.authorUserId,
    authorName: input.authorName,
    isBot: false,
    isInternal: Boolean(input.isInternal),
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
  });
  // A staff reply moves an open ticket into progress.
  if (ticket.status === "open") ticket.status = "in_progress";
  ticket.updatedAt = new Date().toISOString();
  rows[idx] = ticket;
  writeTable(TABLE, rows);
  return ticket;
}

export interface UpdateTicketInput {
  ticketId: string;
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assigneeUserId?: string | null;
}

/** Update a ticket's status/priority/assignee. Recomputes the SLA due date on priority change. */
export function updateTicket(input: UpdateTicketInput): SupportTicket | { error: string } {
  const rows = readTickets();
  const idx = rows.findIndex((t) => t.id === input.ticketId);
  if (idx === -1) return { error: "NOT_FOUND" };
  const ticket = rows[idx]!;
  if (input.priority && input.priority !== ticket.priority) {
    ticket.priority = input.priority;
    ticket.slaHours = SLA_HOURS[input.priority];
    ticket.dueAt = new Date(Date.now() + ticket.slaHours * 3_600_000).toISOString();
  }
  if (input.status) ticket.status = input.status;
  if (input.assigneeUserId !== undefined) ticket.assigneeUserId = input.assigneeUserId;
  ticket.updatedAt = new Date().toISOString();
  rows[idx] = ticket;
  writeTable(TABLE, rows);
  return ticket;
}

/** True when an open ticket is past its response SLA (derived, not stored). */
export function isOverdue(ticket: SupportTicket): boolean {
  if (!ticket.dueAt) return false;
  if (ticket.status === "resolved" || ticket.status === "closed") return false;
  return ticket.dueAt < new Date().toISOString();
}

/** Aggregate counts for the support dashboard header. */
export function supportCounts(): { byStatus: Record<string, number>; overdue: number } {
  const rows = readTickets();
  const byStatus: Record<string, number> = {};
  for (const t of rows) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  return { byStatus, overdue: rows.filter(isOverdue).length };
}
