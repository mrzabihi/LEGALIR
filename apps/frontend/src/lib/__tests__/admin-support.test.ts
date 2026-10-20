// ============================================================
// LEGALIR — Admin support desk · assignment, history, filters (hermetic)
// ============================================================
// Covers the §4 additions to the support desk:
//
//   • listTickets  — search / unassigned / overdue / priority+due sorting
//   • updateTicket — records only REAL changes, validates the assignee,
//                    never reopens a no-op edit
//   • assignTicket — referral note lands on the assignment event
//   • listTicketEvents / listAssignableAgents / supportCounts
//
// The JSON store is replaced with an in-memory table map that clones on read
// and write, mirroring the file-backed store's independence between calls.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({ tables: new Map<string, unknown[]>() }));

vi.mock("@/lib/db", () => ({
  readTable: (name: string) => structuredClone(h.tables.get(name) ?? []),
  writeTable: (name: string, rows: unknown[]) => {
    h.tables.set(name, structuredClone(rows));
  },
  findUserById: (id: string) =>
    (h.tables.get("users") as Record<string, unknown>[] | undefined)?.find(
      (u) => u["id"] === id
    ),
}));

import type { SupportTicket, SupportTicketEvent } from "@legalir/types";
import {
  SLA_HOURS,
  assignTicket,
  createTicket,
  getTicket,
  isOverdue,
  listAssignableAgents,
  listTicketEvents,
  listTickets,
  supportCounts,
  updateTicket,
} from "@/lib/admin/support";

const ACTOR = { userId: "admin-1", name: "مدیر پشتیبانی" };
const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = "2099-01-01T00:00:00.000Z";

function ticket(over: Partial<SupportTicket> & { id: string }): SupportTicket {
  return {
    subject: "موضوع",
    category: "general",
    priority: "normal",
    status: "open",
    requesterUserId: null,
    requesterName: "کاربر",
    requesterMobileMasked: null,
    assigneeUserId: null,
    assigneeName: null,
    slaHours: SLA_HOURS.normal,
    dueAt: FUTURE,
    messages: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function seedTickets(rows: SupportTicket[]): void {
  h.tables.set("support_tickets", rows);
}

beforeEach(() => {
  h.tables.clear();
  h.tables.set("users", [
    { id: "admin-1", mobile: "09120000000", displayName: "مدیر پشتیبانی", role: "SUPER_ADMIN" },
    { id: "agent-1", mobile: "09120000001", displayName: "کارشناس پشتیبانی", role: "SUPPORT" },
    { id: "plain-1", mobile: "09120000002", displayName: "کاربر عادی", role: "USER" },
    // A staff role WITHOUT admin:support:manage.
    { id: "fin-1", mobile: "09120000003", displayName: "کارشناس مالی", role: "ADMIN_FINANCE" },
  ]);
  h.tables.set("support_ticket_events", []);
});

// ============================================================
// listTickets — filters + sorting
// ============================================================

describe("listTickets — real filters and deterministic sorting", () => {
  it("searches subject, requester, category and id", () => {
    seedTickets([
      ticket({ id: "tkt-1", subject: "خطای پرداخت", requesterName: "سارا" }),
      ticket({ id: "tkt-2", subject: "مشکل ورود", category: "auth" }),
    ]);

    expect(listTickets({ search: "پرداخت" }).map((t) => t.id)).toEqual(["tkt-1"]);
    expect(listTickets({ search: "سارا" }).map((t) => t.id)).toEqual(["tkt-1"]);
    expect(listTickets({ search: "auth" }).map((t) => t.id)).toEqual(["tkt-2"]);
    expect(listTickets({ search: "tkt-2" }).map((t) => t.id)).toEqual(["tkt-2"]);
  });

  it("treats absent, true and false `unassigned` as three distinct states", () => {
    seedTickets([
      ticket({ id: "a", assigneeUserId: null }),
      ticket({ id: "b", assigneeUserId: "agent-1" }),
    ]);

    expect(listTickets().map((t) => t.id).sort()).toEqual(["a", "b"]);
    expect(listTickets({ unassigned: true }).map((t) => t.id)).toEqual(["a"]);
    expect(listTickets({ unassigned: false }).map((t) => t.id)).toEqual(["b"]);
  });

  it("`overdue` returns only ACTIVE tickets past their deadline", () => {
    seedTickets([
      ticket({ id: "late-open", status: "open", dueAt: PAST }),
      ticket({ id: "late-closed", status: "closed", dueAt: PAST }),
      ticket({ id: "on-time", status: "open", dueAt: FUTURE }),
    ]);
    expect(listTickets({ overdue: true }).map((t) => t.id)).toEqual(["late-open"]);
  });

  it("sorts urgent first among active tickets, closed work last", () => {
    seedTickets([
      ticket({ id: "low", priority: "low" }),
      ticket({ id: "urgent-closed", priority: "urgent", status: "closed" }),
      ticket({ id: "urgent-open", priority: "urgent" }),
      ticket({ id: "high", priority: "high" }),
    ]);
    expect(listTickets({ sort: "priority-desc" }).map((t) => t.id)).toEqual([
      "urgent-open",
      "high",
      "low",
      "urgent-closed",
    ]);
  });

  it("sorts by nearest deadline and sinks closed/infinite ones last", () => {
    seedTickets([
      ticket({ id: "far", dueAt: "2030-01-01T00:00:00.000Z" }),
      ticket({ id: "near", dueAt: "2026-06-01T00:00:00.000Z" }),
      ticket({ id: "closed", dueAt: "2025-01-01T00:00:00.000Z", status: "closed" }),
      ticket({ id: "none", dueAt: null }),
    ]);
    expect(listTickets({ sort: "due" }).map((t) => t.id)).toEqual([
      "near",
      "far",
      "closed",
      "none",
    ]);
  });

  it("decorates every row with the assignee's live display name", () => {
    seedTickets([ticket({ id: "tkt-1", assigneeUserId: "agent-1" })]);
    expect(listTickets()[0]!.assigneeName).toBe("کارشناس پشتیبانی");
  });

  it("resolves a deleted assignee to null rather than a stale name", () => {
    seedTickets([ticket({ id: "tkt-1", assigneeUserId: "ghost" })]);
    const row = listTickets()[0]!;
    expect(row.assigneeName).toBeNull();
    expect(row.assigneeUserId).toBe("ghost");
  });

  it("falls back to the id for a LIVE account with no display name", () => {
    // Seeded staff rows in the real store can have a null displayName. That
    // person is not "deleted", so the ticket must not claim they are — it
    // shows the same id fallback the assignment picker shows.
    (h.tables.get("users") as Record<string, unknown>[]).push({
      id: "agent-noname",
      mobile: "09120000009",
      displayName: null,
      role: "SUPPORT",
    });
    seedTickets([ticket({ id: "tkt-1", assigneeUserId: "agent-noname" })]);

    expect(listTickets()[0]!.assigneeName).toBe("agent-noname");
    expect(listAssignableAgents().find((a) => a.id === "agent-noname")!.displayName).toBe(
      "agent-noname"
    );
  });
});

// ============================================================
// History — append-only, real changes only
// ============================================================

describe("history — every real change is recorded, no-ops are not", () => {
  it("records creation with its actor", () => {
    const t = createTicket({
      subject: "سوال",
      category: "general",
      requesterUserId: null,
      requesterName: "کاربر",
      body: "سلام",
      authorUserId: "agent-1",
      authorName: "کارشناس پشتیبانی",
    });
    if ("error" in t) throw new Error("unexpected error");

    const events = listTicketEvents(t.id);
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe("created");
    expect(events[0]!.actorName).toBe("کارشناس پشتیبانی");
    expect(events[0]!.to).toBe("open");
  });

  it("records a status change with its from→to", () => {
    seedTickets([ticket({ id: "tkt-1", status: "open" })]);
    updateTicket({ ticketId: "tkt-1", status: "resolved", actor: ACTOR });

    const [event] = listTicketEvents("tkt-1");
    expect(event!.kind).toBe("status");
    expect(event!.from).toBe("open");
    expect(event!.to).toBe("resolved");
  });

  it("records priority AND the recomputed SLA deadline", () => {
    seedTickets([ticket({ id: "tkt-1", priority: "normal" })]);
    const res = updateTicket({ ticketId: "tkt-1", priority: "urgent", actor: ACTOR });
    if ("error" in res) throw new Error("unexpected error");

    expect(res.slaHours).toBe(SLA_HOURS.urgent);
    // The deadline is future-dated from the new target, not the old one.
    expect(new Date(res.dueAt!).getTime()).toBeGreaterThan(Date.now());
    expect(listTicketEvents("tkt-1")[0]!.kind).toBe("priority");
  });

  it("a no-op edit writes nothing and does not bump `updatedAt`", () => {
    seedTickets([ticket({ id: "tkt-1", status: "open", priority: "normal" })]);
    const before = getTicket("tkt-1")!;
    const res = updateTicket({
      ticketId: "tkt-1",
      status: "open",
      priority: "normal",
      actor: ACTOR,
    });
    if ("error" in res) throw new Error("unexpected error");

    expect(res.updatedAt).toBe(before.updatedAt);
    expect(listTicketEvents("tkt-1")).toEqual([]);
  });

  it("returns history newest-first", () => {
    seedTickets([ticket({ id: "tkt-1" })]);
    h.tables.set("support_ticket_events", [
      { id: "e1", ticketId: "tkt-1", kind: "created", at: "2026-01-01T00:00:00.000Z", actorUserId: "a", actorName: "الف", from: null, to: "open", note: null },
      { id: "e2", ticketId: "tkt-1", kind: "status", at: "2026-03-01T00:00:00.000Z", actorUserId: "a", actorName: "الف", from: "open", to: "resolved", note: null },
      { id: "e3", ticketId: "tkt-1", kind: "status", at: "2026-02-01T00:00:00.000Z", actorUserId: "a", actorName: "الف", from: "open", to: "waiting", note: null },
    ] as SupportTicketEvent[]);

    expect(listTicketEvents("tkt-1").map((e) => e.id)).toEqual(["e2", "e3", "e1"]);
  });

  it("scopes the trail to the requested ticket", () => {
    seedTickets([ticket({ id: "a" }), ticket({ id: "b" })]);
    updateTicket({ ticketId: "a", status: "resolved", actor: ACTOR });
    updateTicket({ ticketId: "b", status: "waiting", actor: ACTOR });

    expect(listTicketEvents("a")).toHaveLength(1);
    expect(listTicketEvents("a")[0]!.to).toBe("resolved");
  });
});

// ============================================================
// Assignment / referral
// ============================================================

describe("assignment — only eligible agents, with an auditable reason", () => {
  it("offers exactly the roles holding admin:support:manage", () => {
    const ids = listAssignableAgents().map((a) => a.id);
    expect(ids).toContain("admin-1");
    expect(ids).toContain("agent-1");
    // A regular user and a staff role without the support permission are NOT
    // assignable — the picker can never offer a target the server rejects.
    expect(ids).not.toContain("plain-1");
    expect(ids).not.toContain("fin-1");
  });

  it("refuses an ineligible assignee WITHOUT applying the other changes", () => {
    seedTickets([ticket({ id: "tkt-1", status: "open" })]);
    const res = updateTicket({
      ticketId: "tkt-1",
      status: "resolved",
      assigneeUserId: "plain-1",
      actor: ACTOR,
    });
    expect(res).toEqual({ error: "INVALID_ASSIGNEE" });

    // The status must NOT have been written: validation precedes mutation.
    expect(getTicket("tkt-1")!.status).toBe("open");
    expect(listTicketEvents("tkt-1")).toEqual([]);
  });

  it("records the referral note on the assignment event", () => {
    seedTickets([ticket({ id: "tkt-1" })]);
    const res = assignTicket({
      ticketId: "tkt-1",
      assigneeUserId: "agent-1",
      note: "نیازمند بررسی قرارداد",
      actor: ACTOR,
    });
    if ("error" in res) throw new Error("unexpected error");

    const [event] = listTicketEvents("tkt-1");
    expect(event!.kind).toBe("assignment");
    expect(event!.from).toBeNull();
    expect(event!.to).toBe("کارشناس پشتیبانی");
    expect(event!.note).toBe("نیازمند بررسی قرارداد");
  });

  it("records un-assignment back to the queue", () => {
    seedTickets([ticket({ id: "tkt-1", assigneeUserId: "agent-1" })]);
    const res = assignTicket({ ticketId: "tkt-1", assigneeUserId: null, actor: ACTOR });
    if ("error" in res) throw new Error("unexpected error");

    expect(res.assigneeUserId).toBeNull();
    const [event] = listTicketEvents("tkt-1");
    expect(event!.from).toBe("کارشناس پشتیبانی");
    expect(event!.to).toBeNull();
  });

  it("404s for an unknown ticket", () => {
    expect(updateTicket({ ticketId: "nope", status: "closed", actor: ACTOR })).toEqual({
      error: "NOT_FOUND",
    });
  });
});

// ============================================================
// Counts
// ============================================================

describe("supportCounts — the header reflects the real queue", () => {
  it("counts by status AND priority, plus overdue and active-unassigned", () => {
    seedTickets([
      ticket({ id: "a", status: "open", priority: "urgent", dueAt: PAST }),
      ticket({ id: "b", status: "open", priority: "urgent", assigneeUserId: "agent-1" }),
      ticket({ id: "c", status: "closed", priority: "low", dueAt: PAST }),
    ]);
    const counts = supportCounts();

    expect(counts.byStatus["open"]).toBe(2);
    expect(counts.byStatus["closed"]).toBe(1);
    expect(counts.byPriority["urgent"]).toBe(2);
    // Only `a` is an ACTIVE overdue ticket.
    expect(counts.overdue).toBe(1);
    // Only `a` is active and unowned; `c` is closed.
    expect(counts.unassigned).toBe(1);
  });

  it("keeps isOverdue false for resolved/closed tickets", () => {
    expect(isOverdue(ticket({ id: "x", status: "resolved", dueAt: PAST }))).toBe(false);
    expect(isOverdue(ticket({ id: "y", status: "open", dueAt: PAST }))).toBe(true);
    expect(isOverdue(ticket({ id: "z", status: "open", dueAt: null }))).toBe(false);
  });
});
