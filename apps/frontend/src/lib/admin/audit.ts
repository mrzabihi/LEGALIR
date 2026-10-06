// ============================================================
// LEGALIR — Admin audit log (append-only, server-only)
// ============================================================
// Every sensitive admin action is recorded here. The log is append-only:
// there is no update or delete path. Before/after snapshots are passed
// through `redactForAudit` so secrets, tokens, passwords and long free-text
// can never be written to the trail.
// ============================================================

import { readTable, writeTable } from "@/lib/db";
import type { AdminAuditEntry, AuditResult } from "@legalir/types";

const TABLE = "admin_audit_log";

/** Field names that must NEVER be persisted in an audit snapshot. */
const FORBIDDEN_KEYS = [
  "password",
  "passwordhash",
  "otp",
  "otpcode",
  "token",
  "secret",
  "apikey",
  "api_key",
  "key",
  "authorization",
  "cookie",
  "nationalcode",
  "cardnumber",
  "iban",
  "accountnumber",
  "cvv",
];

const MAX_VALUE_CHARS = 500;

/**
 * Strip forbidden keys and cap value length. Nested objects are walked so a
 * secret nested inside a config blob is also removed. Returns a new object —
 * the caller's data is never mutated.
 */
export function redactForAudit(input: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!input) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (FORBIDDEN_KEYS.includes(k.toLowerCase())) {
      out[k] = "[redacted]";
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactForAudit(v as Record<string, unknown>);
    } else if (typeof v === "string" && v.length > MAX_VALUE_CHARS) {
      out[k] = v.slice(0, MAX_VALUE_CHARS) + "…";
    } else {
      out[k] = v;
    }
  }
  return out;
}

export interface AuditInput {
  actorUserId: string;
  actorRole: string;
  orgId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  result?: AuditResult;
  reason?: string | null;
  requestId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
}

/** Append one audit entry. Returns the written row. */
export function recordAudit(input: AuditInput): AdminAuditEntry {
  const entry: AdminAuditEntry = {
    id: `aud-${crypto.randomUUID()}`,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    orgId: input.orgId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    result: input.result ?? "success",
    reason: input.reason ?? null,
    requestId: input.requestId ?? null,
    before: redactForAudit(input.before),
    after: redactForAudit(input.after),
    ip: input.ip ?? null,
    createdAt: new Date().toISOString(),
  };
  const rows = readTable<AdminAuditEntry>(TABLE);
  rows.push(entry);
  writeTable(TABLE, rows);
  return entry;
}

export interface AuditQuery {
  actorUserId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  result?: AuditResult;
  /** Free-text over action + resourceId. */
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Read the audit trail, newest first, with filtering and pagination. */
export function listAudit(query: AuditQuery = {}): {
  items: AdminAuditEntry[];
  total: number;
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 25));

  let rows = readTable<AdminAuditEntry>(TABLE);
  if (query.actorUserId) rows = rows.filter((r) => r.actorUserId === query.actorUserId);
  if (query.action) rows = rows.filter((r) => r.action === query.action);
  if (query.resourceType) rows = rows.filter((r) => r.resourceType === query.resourceType);
  if (query.resourceId) rows = rows.filter((r) => r.resourceId === query.resourceId);
  if (query.result) rows = rows.filter((r) => r.result === query.result);
  if (query.search) {
    const q = query.search.toLowerCase();
    rows = rows.filter(
      (r) => r.action.toLowerCase().includes(q) || r.resourceId.toLowerCase().includes(q)
    );
  }
  rows = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total, page, pageSize };
}
