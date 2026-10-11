// ============================================================
// LEGALIR — Server idempotency store (JSON table)
// ============================================================
// The client generates one Idempotency-Key per logical mutation attempt
// (see lib/api/idempotency.ts) and REUSES it on a network retry. This module
// is the server half of that contract: it memoizes the first successful
// response so a double-click, a retried fetch or a refreshed tab can never
// create a second consultation request (or a second lawyer decision).
//
// Table: idempotency_keys
//   { key, scope, actorId, status, body, createdAt }
//
// The key is scoped by (scope, actorId) so one user can never replay another
// user's stored response, and a key minted for `create` can never collide
// with a key minted for `respond`.
// ============================================================

import { readTable, writeTable } from "@/lib/db";

const TABLE = "idempotency_keys";

// ---------------------------------------------------------------------------
// In-process serialisation of the check-execute-write section
// ---------------------------------------------------------------------------
// `lib/db.ts` has no transactions: `readTable` copies and `writeTable` rewrites
// the whole table. Without a lock, two concurrent same-key requests (the exact
// double-click this module exists for) both read before either writes, both miss
// and BOTH run the handler — minting two requests / two cases. A stale writer can
// also clobber a concurrent different-key row, so a later retry re-executes.
//
// This serialises the critical section within the ONE Node process that owns
// `.data/` (the app runs a single process — no cluster/workers in dev or `next
// start`), the same honest mechanism `lib/checkout/mutex.ts` uses. It is NOT a
// distributed lock; a multi-process deployment would need a real DB transaction.
let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Rows older than this are pruned — mirrors the documented 24h contract. */
const TTL_MS = 24 * 60 * 60 * 1000;

/** The header the client uses to carry the key. Kept in sync with lib/api/idempotency.ts. */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

interface IdempotencyRow {
  key: string;
  scope: string;
  actorId: string;
  status: number;
  body: unknown;
  createdAt: string;
}

export interface IdempotentOutcome<T> {
  status: number;
  body: T;
  /** True when the stored first response was replayed instead of re-running. */
  replayed: boolean;
}

/**
 * Run `handler` at most once per (scope, actorId, Idempotency-Key).
 *
 * · No key header → the handler runs normally (older clients / genuinely new
 *   operations are unaffected).
 * · Key seen before → the stored first response is replayed, `replayed: true`.
 * · Key not seen → the handler runs; a 2xx outcome is memoized.
 *
 * Only 2xx outcomes are memoized: a failed validation must stay retryable
 * with a corrected body under the same key.
 */
export async function runIdempotent<T>(
  request: Request,
  scope: string,
  actorId: string,
  handler: () => Promise<{ status: number; body: T }>
): Promise<IdempotentOutcome<T>> {
  const raw = request.headers.get(IDEMPOTENCY_HEADER);
  const key = raw && raw.trim().length > 0 ? raw.trim() : null;
  if (!key) {
    // No key → nothing to dedupe; a genuinely new operation is never blocked.
    const out = await handler();
    return { ...out, replayed: false };
  }

  // The whole check → execute → memoize section is serialised, so two
  // concurrent requests carrying the SAME key cannot both miss and both run.
  return withLock(async () => {
    const now = Date.now();
    const rows = readTable<IdempotencyRow>(TABLE).filter(
      (r) => now - Date.parse(r.createdAt) < TTL_MS
    );

    const hit = rows.find(
      (r) => r.key === key && r.scope === scope && r.actorId === actorId
    );
    if (hit) {
      return { status: hit.status, body: hit.body as T, replayed: true };
    }

    const out = await handler();
    if (out.status >= 200 && out.status < 300) {
      rows.push({
        key,
        scope,
        actorId,
        status: out.status,
        body: out.body,
        createdAt: new Date().toISOString(),
      });
      writeTable(TABLE, rows);
    }
    return { ...out, replayed: false };
  });
}
