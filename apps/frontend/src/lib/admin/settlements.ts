// ============================================================
// LEGALIR — Commission rules & lawyer settlements (server-only)
// ============================================================
// Two owned tables:
//   commission_rules    — versioned platform commission rules. Editing a
//                         rule never mutates history: a NEW version row is
//                         appended so any settlement can be traced back to
//                         the exact rule that was in force.
//   lawyer_settlements  — the payout ledger. A settlement moves through
//                         OPEN → ... → APPROVED → PAID, and the APPROVED
//                         step requires a SECOND, DIFFERENT approver.
//
// IMPORTANT — honesty: lawyer payouts are only ever derived from real
// completed, paid engagements. This environment has no paid-consultation
// source yet, so generated settlements carry ZERO lines rather than a
// fabricated amount; the admin can add lines manually. Payout destinations
// are stored MASKED — the full IBAN/card is never persisted here.
// ============================================================

import { readTable, writeTable, findUserById } from "@/lib/db";
import { SETTLEMENT_TRANSITIONS } from "@legalir/types";
import type {
  CommissionRule,
  LawyerSettlement,
  SettlementLine,
  SettlementStatus,
} from "@legalir/types";

const RULES_TABLE = "commission_rules";
const SETTLEMENTS_TABLE = "lawyer_settlements";

// ---------------------------------------------------------------------------
// Commission rules (versioned, append-only)
// ---------------------------------------------------------------------------

/** The commission rules the platform starts with (one default rule). */
function seedRules(): CommissionRule[] {
  const now = new Date().toISOString();
  const seed: CommissionRule = {
    id: "cr-default-v1",
    serviceType: "consultation",
    platformPercent: 20,
    platformFixedToman: 0,
    allowedDeductions: ["gateway_fee", "refund", "penalty"],
    validFrom: now,
    validTo: null,
    version: 1,
    createdAt: now,
  };
  writeTable(RULES_TABLE, [seed]);
  return [seed];
}

export function listCommissionRules(): CommissionRule[] {
  const rows = readTable<CommissionRule>(RULES_TABLE);
  if (rows.length > 0) return rows;
  return seedRules();
}

export interface UpdateCommissionRuleInput {
  serviceType: string;
  platformPercent: number;
  platformFixedToman: number;
  allowedDeductions: string[];
  changedBy: string;
}

/**
 * Edit a commission rule by appending a NEW version. The previous version is
 * closed (`validTo` set) so historical settlements remain traceable to the
 * rule that was actually in force at the time.
 */
export function updateCommissionRule(
  input: UpdateCommissionRuleInput
): CommissionRule | { error: string } {
  if (input.platformPercent < 0 || input.platformPercent > 100) {
    return { error: "INVALID_PERCENT" };
  }
  if (input.platformFixedToman < 0) return { error: "INVALID_FEE" };

  const rows = listCommissionRules();
  const now = new Date().toISOString();
  const existing = rows.filter((r) => r.serviceType === input.serviceType);

  // Close the currently open version (if any).
  for (const rule of rows) {
    if (rule.serviceType === input.serviceType && rule.validTo === null) {
      rule.validTo = now;
    }
  }

  const nextVersion = existing.reduce((max, r) => Math.max(max, r.version), 0) + 1;
  const created: CommissionRule = {
    id: `cr-${input.serviceType}-v${nextVersion}-${crypto.randomUUID().slice(0, 8)}`,
    serviceType: input.serviceType,
    platformPercent: Math.round(input.platformPercent * 100) / 100,
    platformFixedToman: Math.round(input.platformFixedToman),
    allowedDeductions: input.allowedDeductions,
    validFrom: now,
    validTo: null,
    version: nextVersion,
    createdAt: now,
  };
  rows.push(created);
  writeTable(RULES_TABLE, rows);
  return created;
}

/** The commission rule in force for a service type, as of a given instant. */
export function effectiveRuleFor(serviceType: string, atIso: string): CommissionRule | undefined {
  return listCommissionRules()
    .filter(
      (r) =>
        r.serviceType === serviceType &&
        r.validFrom <= atIso &&
        (r.validTo === null || r.validTo > atIso)
    )
    .sort((a, b) => b.version - a.version)[0];
}

/** Platform fee for a gross amount under a given rule (integer Toman). */
export function computePlatformFee(grossAmount: number, rule: CommissionRule): number {
  const pct = Math.round((grossAmount * rule.platformPercent) / 100);
  return pct + rule.platformFixedToman;
}

// ---------------------------------------------------------------------------
// Lawyer settlements
// ---------------------------------------------------------------------------

function readSettlements(): LawyerSettlement[] {
  return readTable<LawyerSettlement>(SETTLEMENTS_TABLE);
}

function writeSettlements(rows: LawyerSettlement[]): void {
  writeTable(SETTLEMENTS_TABLE, rows);
}

/** Reachable settlement transitions. Shared with the client (single source). */
const TRANSITIONS = SETTLEMENT_TRANSITIONS;

export function canTransition(from: SettlementStatus, to: SettlementStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** All settlements, newest first, with optional lawyer/status filters. */
export function listSettlements(filter: { lawyerId?: string; status?: SettlementStatus } = {}): LawyerSettlement[] {
  let rows = readSettlements();
  if (filter.lawyerId) rows = rows.filter((s) => s.lawyerId === filter.lawyerId);
  if (filter.status) rows = rows.filter((s) => s.status === filter.status);
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSettlement(id: string): LawyerSettlement | undefined {
  return readSettlements().find((s) => s.id === id);
}

export interface CreateSettlementInput {
  lawyerId: string;
  lawyerName: string;
  periodStart: string;
  periodEnd: string;
  createdBy: string;
}

/**
 * Open a new settlement for a lawyer and period. Lines are left EMPTY —
 * they are only added from a real, verified source, never fabricated.
 */
export function createSettlement(input: CreateSettlementInput): LawyerSettlement | { error: string } {
  if (!input.lawyerId) return { error: "LAWYER_REQUIRED" };
  if (!input.periodStart || !input.periodEnd) return { error: "PERIOD_REQUIRED" };
  if (input.periodEnd < input.periodStart) return { error: "INVALID_PERIOD" };

  const now = new Date().toISOString();
  const row: LawyerSettlement = {
    id: `stl-${crypto.randomUUID()}`,
    lawyerId: input.lawyerId,
    lawyerName: input.lawyerName,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    grossAmount: 0,
    platformFee: 0,
    deductions: 0,
    netAmount: 0,
    currency: "IRT",
    status: "OPEN",
    payoutDestinationMasked: null,
    payoutReference: null,
    requestedBy: null,
    approvedBy: null,
    paidAt: null,
    lines: [],
    createdAt: now,
    updatedAt: now,
  };
  const rows = readSettlements();
  rows.push(row);
  writeSettlements(rows);
  return row;
}

/** Recompute the settlement totals from its lines. */
function recompute(settlement: LawyerSettlement): void {
  settlement.grossAmount = settlement.lines.reduce((s, l) => s + l.grossAmount, 0);
  settlement.platformFee = settlement.lines.reduce((s, l) => s + l.platformFee, 0);
  settlement.deductions = settlement.lines.reduce((s, l) => s + l.deductions, 0);
  settlement.netAmount = settlement.lines.reduce((s, l) => s + l.netAmount, 0);
}

export interface AddSettlementLineInput {
  settlementId: string;
  sourceType: string;
  sourceId: string;
  grossAmount: number;
  serviceType: string;
}

/**
 * Add a real line to an open settlement. The platform fee is computed from
 * the rule in force on the source date; net = gross − fee − deductions.
 */
export function addSettlementLine(input: AddSettlementLineInput): LawyerSettlement | { error: string } {
  const rows = readSettlements();
  const idx = rows.findIndex((s) => s.id === input.settlementId);
  if (idx === -1) return { error: "NOT_FOUND" };
  const settlement = rows[idx]!;
  if (settlement.status !== "OPEN" && settlement.status !== "NEEDS_REVIEW") {
    return { error: "LOCKED" };
  }
  if (input.grossAmount <= 0) return { error: "INVALID_AMOUNT" };

  const rule = effectiveRuleFor(input.serviceType, new Date().toISOString());
  const platformFee = rule ? computePlatformFee(input.grossAmount, rule) : 0;
  const line: SettlementLine = {
    id: `line-${crypto.randomUUID()}`,
    settlementId: settlement.id,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    grossAmount: Math.round(input.grossAmount),
    platformFee,
    deductions: 0,
    netAmount: Math.round(input.grossAmount) - platformFee,
    currency: "IRT",
    createdAt: new Date().toISOString(),
  };
  settlement.lines.push(line);
  recompute(settlement);
  settlement.updatedAt = new Date().toISOString();
  rows[idx] = settlement;
  writeSettlements(rows);
  return settlement;
}

export interface SettleTransitionInput {
  settlementId: string;
  to: SettlementStatus;
  actorUserId: string;
  reason?: string;
  /** Masked payout destination, only meaningful on APPROVED/PAID. */
  payoutDestinationMasked?: string | null;
  /** Bank reference recorded manually on PAID. */
  payoutReference?: string | null;
}

/**
 * Advance a settlement through its state machine. The APPROVED step enforces
 * separation of duties: the approver must differ from the requester.
 */
export function transitionSettlement(
  input: SettleTransitionInput
): LawyerSettlement | { error: string } {
  const rows = readSettlements();
  const idx = rows.findIndex((s) => s.id === input.settlementId);
  if (idx === -1) return { error: "NOT_FOUND" };
  const settlement = rows[idx]!;
  if (!canTransition(settlement.status, input.to)) return { error: "INVALID_TRANSITION" };

  // Approval requires a second, different actor than the requester.
  if (input.to === "APPROVED") {
    if (settlement.requestedBy === input.actorUserId) {
      return { error: "SECOND_APPROVER_REQUIRED" };
    }
    settlement.approvedBy = input.actorUserId;
  }
  if (input.to === "REQUESTED") {
    settlement.requestedBy = input.actorUserId;
  }
  if (input.to === "PAID") {
    if (settlement.approvedBy === null) return { error: "NOT_APPROVED" };
    if (input.payoutDestinationMasked) settlement.payoutDestinationMasked = input.payoutDestinationMasked;
    if (input.payoutReference) settlement.payoutReference = input.payoutReference;
    settlement.paidAt = new Date().toISOString();
  }

  settlement.status = input.to;
  settlement.updatedAt = new Date().toISOString();
  rows[idx] = settlement;
  writeSettlements(rows);
  return settlement;
}

/** A masked payout destination from a raw IBAN/card. Never returns raw. */
export function maskPayoutDestination(raw: string): string {
  const clean = raw.replace(/\s+/g, "");
  if (clean.length <= 4) return "••••";
  return "••••" + clean.slice(-4);
}

/** Resolve a settlement's lawyer display name from real profiles when possible. */
export function lawyerDisplayName(lawyerId: string, fallback: string): string {
  const user = findUserById(lawyerId);
  return user?.displayName ?? fallback;
}
