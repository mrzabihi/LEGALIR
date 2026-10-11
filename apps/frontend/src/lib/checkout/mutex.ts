// ============================================================
// LEGALIR — In-process async mutex (single-writer serialisation)
// ============================================================
// The JSON store (`lib/db.ts`) has no transactions and no row locks: every
// write rewrites a whole table. Two concurrent order commits could therefore
// interleave (both read the coupon usage table, both see spare capacity, both
// write) and oversell the last coupon slot.
//
// This serialises such critical sections within the ONE Node process that owns
// `.data/` (Next.js runs a single process for this app — no cluster, no
// separate workers in dev or `next start`). Critical sections that must be
// atomic (coupon capacity check + order write + usage write) run inside
// `withCheckoutLock`, so within this process they are strictly sequential.
//
// This is the honest, minimal mechanism the architecture allows. It is NOT a
// distributed lock: if the app were ever scaled to multiple processes they
// would need a shared lock (a real DB transaction). That limitation is called
// out in the delivery report.
// ============================================================

let chain: Promise<unknown> = Promise.resolve();

/**
 * Run `fn` exclusively: no other `withCheckoutLock` callback runs until it
 * settles. The chain advances whether `fn` resolves or rejects, so a thrown
 * error can never dead-lock the queue.
 */
export async function withCheckoutLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
