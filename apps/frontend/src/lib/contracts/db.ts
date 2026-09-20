// ============================================================
// LEGALIR — Property Contract data layer
// ============================================================
// Persistence for the Contract Operating System. The core contract
// row is flat (id, user_id, domain, type, state, current_step,
// progress, versions, timestamps) while the domain-specific data
// lives in a versioned typed JSON column (`data`). Related
// collections (parties, versions, documents, approvals, audit,
// payments) live in their own tables keyed by contract_id.
//
// Every read/write is scoped by user_id at the call site — the API
// routes pass the session user, so a contract id from another user
// can never be loaded.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import type {
  ContractApproval,
  ContractAuditEntry,
  ContractDocument,
  ContractParty,
  ContractPayment,
  PropertyContractVersion,
  PropertyContract,
  PropertyContractState,
  PropertyRentData,
  PropertySaleData,
} from "@legalir/types";

const DB_DIR = path.resolve(process.cwd(), ".data");

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
}

// ------------------------------------------------------------
// Read cache
// ------------------------------------------------------------
// Every request used to re-read and re-parse whole JSON tables from
// disk (the session table alone is >100KB), which dominated request
// latency. Tables are only ever written through `writeTable` in this
// process, so an mtime+size check is enough to know the cached parse
// is still current — and `writeTable` primes the entry itself, so a
// write can never leave a stale parse behind.
const tableCache = new Map<string, { mtimeMs: number; size: number; data: unknown[] }>();

function readTable<T>(name: string): T[] {
  ensureDir();
  const file = path.join(DB_DIR, `${name}.json`);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    tableCache.delete(name);
    return [];
  }
  const cached = tableCache.get(name);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.data as T[];
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8")) as T[];
    tableCache.set(name, { mtimeMs: stat.mtimeMs, size: stat.size, data });
    return data;
  } catch {
    return [];
  }
}

function writeTable<T>(name: string, data: T[]): void {
  ensureDir();
  const file = path.join(DB_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  try {
    const stat = fs.statSync(file);
    tableCache.set(name, { mtimeMs: stat.mtimeMs, size: stat.size, data });
  } catch {
    tableCache.delete(name);
  }
}

// ------------------------------------------------------------
// Table names
// ------------------------------------------------------------

const T_CONTRACTS = "property-contracts";
const T_PARTIES = "contract-parties";
const T_VERSIONS = "contract-versions";
const T_DOCUMENTS = "contract-documents";
const T_APPROVALS = "contract-approvals";
const T_AUDIT = "contract-audit-logs";
const T_PAYMENTS = "contract-payments";

// ------------------------------------------------------------
// Contracts
// ------------------------------------------------------------

/** All contracts for a user, newest activity first. */
export function listContractsForUser(userId: string): PropertyContract[] {
  return readTable<PropertyContract>(T_CONTRACTS)
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** A single contract, scoped to its owner. Returns null for another user's id. */
export function getContractForUser(userId: string, contractId: string): PropertyContract | null {
  const row = readTable<PropertyContract>(T_CONTRACTS).find((c) => c.id === contractId);
  if (!row || row.userId !== userId) return null;
  return row;
}

/** A contract by id, ignoring ownership (server-internal use only). */
export function getContractById(contractId: string): PropertyContract | null {
  return readTable<PropertyContract>(T_CONTRACTS).find((c) => c.id === contractId) ?? null;
}

/** A contract by its public verification id (QR target). */
export function getContractByPublicId(publicVerificationId: string): PropertyContract | null {
  return (
    readTable<PropertyContract>(T_CONTRACTS).find(
      (c) => c.publicVerificationId === publicVerificationId
    ) ?? null
  );
}

export function insertContract(contract: PropertyContract): PropertyContract {
  const rows = readTable<PropertyContract>(T_CONTRACTS);
  rows.push(contract);
  writeTable(T_CONTRACTS, rows);
  return contract;
}

/**
 * Patch a contract, scoped to its owner. Returns the updated row, or
 * null when the contract does not exist or belongs to another user.
 */
export function updateContractForUser(
  userId: string,
  contractId: string,
  patch: Partial<PropertyContract>
): PropertyContract | null {
  const rows = readTable<PropertyContract>(T_CONTRACTS);
  const idx = rows.findIndex((c) => c.id === contractId && c.userId === userId);
  if (idx === -1) return null;
  const next: PropertyContract = {
    ...rows[idx]!,
    ...patch,
    id: rows[idx]!.id,
    userId: rows[idx]!.userId,
    updatedAt: new Date().toISOString(),
  };
  rows[idx] = next;
  writeTable(T_CONTRACTS, rows);
  return next;
}

/** Merge a partial domain-data patch into the contract's `data` column. */
export function mergeContractData(
  userId: string,
  contractId: string,
  dataPatch: Partial<PropertyRentData> | Partial<PropertySaleData>
): PropertyContract | null {
  const contract = getContractForUser(userId, contractId);
  if (!contract) return null;
  const merged = deepMerge(
    contract.data as unknown as Record<string, unknown>,
    dataPatch as unknown as Record<string, unknown>
  );
  return updateContractForUser(userId, contractId, {
    data: merged as unknown as PropertyRentData | PropertySaleData,
  });
}

/** Delete a contract and every related row, scoped to its owner. */
export function deleteContractForUser(userId: string, contractId: string): boolean {
  const rows = readTable<PropertyContract>(T_CONTRACTS);
  const target = rows.find((c) => c.id === contractId && c.userId === userId);
  if (!target) return false;
  writeTable(
    T_CONTRACTS,
    rows.filter((c) => c.id !== contractId)
  );
  writeTable(
    T_PARTIES,
    readTable<ContractParty>(T_PARTIES).filter((p) => p.contractId !== contractId)
  );
  writeTable(
    T_VERSIONS,
    readTable<PropertyContractVersion>(T_VERSIONS).filter((v) => v.contractId !== contractId)
  );
  writeTable(
    T_DOCUMENTS,
    readTable<ContractDocument>(T_DOCUMENTS).filter((d) => d.contractId !== contractId)
  );
  writeTable(
    T_APPROVALS,
    readTable<ContractApproval>(T_APPROVALS).filter((a) => a.contractId !== contractId)
  );
  writeTable(
    T_AUDIT,
    readTable<ContractAuditEntry>(T_AUDIT).filter((a) => a.contractId !== contractId)
  );
  writeTable(
    T_PAYMENTS,
    readTable<ContractPayment>(T_PAYMENTS).filter((p) => p.contractId !== contractId)
  );
  return true;
}

// ------------------------------------------------------------
// Parties
// ------------------------------------------------------------

export function listParties(contractId: string): ContractParty[] {
  return readTable<ContractParty>(T_PARTIES)
    .filter((p) => p.contractId === contractId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Upsert a party by (contractId, role) — one party per role. */
export function upsertParty(party: ContractParty): ContractParty {
  const rows = readTable<ContractParty>(T_PARTIES);
  const idx = rows.findIndex((p) => p.contractId === party.contractId && p.role === party.role);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx]!, ...party, id: rows[idx]!.id };
    writeTable(T_PARTIES, rows);
    return rows[idx]!;
  }
  rows.push(party);
  writeTable(T_PARTIES, rows);
  return party;
}

export function getParty(contractId: string, partyId: string): ContractParty | null {
  return (
    readTable<ContractParty>(T_PARTIES).find(
      (p) => p.contractId === contractId && p.id === partyId
    ) ?? null
  );
}

// ------------------------------------------------------------
// Versions
// ------------------------------------------------------------

export function listVersions(contractId: string): PropertyContractVersion[] {
  return readTable<PropertyContractVersion>(T_VERSIONS)
    .filter((v) => v.contractId === contractId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

export function getVersion(contractId: string, versionId: string): PropertyContractVersion | null {
  return (
    readTable<PropertyContractVersion>(T_VERSIONS).find(
      (v) => v.contractId === contractId && v.id === versionId
    ) ?? null
  );
}

export function insertVersion(version: PropertyContractVersion): PropertyContractVersion {
  const rows = readTable<PropertyContractVersion>(T_VERSIONS);
  rows.push(version);
  writeTable(T_VERSIONS, rows);
  return version;
}

/** The highest version number recorded for a contract (0 when none). */
export function latestVersionNumber(contractId: string): number {
  return listVersions(contractId).reduce((max, v) => Math.max(max, v.versionNumber), 0);
}

// ------------------------------------------------------------
// Documents
// ------------------------------------------------------------

export function listContractDocuments(contractId: string): ContractDocument[] {
  return readTable<ContractDocument>(T_DOCUMENTS)
    .filter((d) => d.contractId === contractId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function getContractDocument(contractId: string, documentId: string): ContractDocument | null {
  return (
    readTable<ContractDocument>(T_DOCUMENTS).find(
      (d) => d.contractId === contractId && d.id === documentId
    ) ?? null
  );
}

export function insertContractDocument(doc: ContractDocument): ContractDocument {
  const rows = readTable<ContractDocument>(T_DOCUMENTS);
  rows.push(doc);
  writeTable(T_DOCUMENTS, rows);
  return doc;
}

export function deleteContractDocument(contractId: string, documentId: string): boolean {
  const rows = readTable<ContractDocument>(T_DOCUMENTS);
  const next = rows.filter((d) => !(d.contractId === contractId && d.id === documentId));
  if (next.length === rows.length) return false;
  writeTable(T_DOCUMENTS, next);
  return true;
}

// ------------------------------------------------------------
// Approvals
// ------------------------------------------------------------

export function listApprovals(contractId: string): ContractApproval[] {
  return readTable<ContractApproval>(T_APPROVALS)
    .filter((a) => a.contractId === contractId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Insert or replace an approval by id. Callers reuse the existing id
 * when a party re-approves or signs the same version, so this must
 * upsert — a blind push would leave the stale row behind and the
 * approvals list would show the same party twice.
 */
export function insertApproval(approval: ContractApproval): ContractApproval {
  const rows = readTable<ContractApproval>(T_APPROVALS);
  const index = rows.findIndex((r) => r.id === approval.id);
  if (index >= 0) rows[index] = approval;
  else rows.push(approval);
  writeTable(T_APPROVALS, rows);
  return approval;
}

/**
 * Invalidate every approval tied to a version other than the current
 * one. Called whenever a new version is snapshotted, so no approval
 * can survive a content change.
 */
export function invalidateApprovalsForOtherVersions(
  contractId: string,
  currentVersionId: string
): number {
  const rows = readTable<ContractApproval>(T_APPROVALS);
  let changed = 0;
  for (const row of rows) {
    if (row.contractId !== contractId) continue;
    if (row.contractVersionId === currentVersionId) continue;
    if (row.status === "pending") continue;
    row.status = "pending";
    row.approvedAt = null;
    row.comment = "محتوا تغییر کرده است؛ تأیید قبلی باطل شد.";
    changed += 1;
  }
  if (changed > 0) writeTable(T_APPROVALS, rows);
  return changed;
}

// ------------------------------------------------------------
// Audit log
// ------------------------------------------------------------

export function listAudit(contractId: string): ContractAuditEntry[] {
  return readTable<ContractAuditEntry>(T_AUDIT)
    .filter((a) => a.contractId === contractId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function appendAudit(entry: ContractAuditEntry): ContractAuditEntry {
  const rows = readTable<ContractAuditEntry>(T_AUDIT);
  rows.push(entry);
  writeTable(T_AUDIT, rows);
  return entry;
}

// ------------------------------------------------------------
// Payments
// ------------------------------------------------------------

export function listPayments(contractId: string): ContractPayment[] {
  return readTable<ContractPayment>(T_PAYMENTS)
    .filter((p) => p.contractId === contractId)
    .sort((a, b) => a.sequence - b.sequence);
}

/** Replace the whole payment schedule for a contract. */
export function replacePayments(contractId: string, payments: ContractPayment[]): ContractPayment[] {
  const rows = readTable<ContractPayment>(T_PAYMENTS).filter((p) => p.contractId !== contractId);
  rows.push(...payments);
  writeTable(T_PAYMENTS, rows);
  return payments;
}

export function updatePayment(
  contractId: string,
  paymentId: string,
  patch: Partial<ContractPayment>
): ContractPayment | null {
  const rows = readTable<ContractPayment>(T_PAYMENTS);
  const idx = rows.findIndex((p) => p.contractId === contractId && p.id === paymentId);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx]!, ...patch, id: rows[idx]!.id, contractId };
  writeTable(T_PAYMENTS, rows);
  return rows[idx]!;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/** Deep-merge a partial patch into a nested object (arrays replace). */
function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (value === undefined) continue;
    const existing = result[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing !== null &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      result[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** A short, human-facing reference code, e.g. LGL-RENT-1405-000184. */
export function buildReferenceCode(
  type: "property_rent" | "property_sale",
  jalaliYear: number,
  sequence: number
): string {
  const kind = type === "property_rent" ? "RENT" : "SALE";
  return `LGL-${kind}-${jalaliYear}-${String(sequence).padStart(6, "0")}`;
}

/** Count existing contracts of a type, used to build the next sequence. */
export function countContractsOfType(type: "property_rent" | "property_sale"): number {
  return readTable<PropertyContract>(T_CONTRACTS).filter((c) => c.type === type).length;
}

/** True when the contract is in one of the given states. */
export function isInState(
  contract: PropertyContract,
  ...states: PropertyContractState[]
): boolean {
  return states.includes(contract.state);
}
