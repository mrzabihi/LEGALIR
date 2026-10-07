// ============================================================
// LEGALIR — Periodic history retention job (server-only)
// ============================================================
// The retention rule is enforced in three places so it can never be
// bypassed by a client:
//   1. opportunistically on every history read (see the history route),
//   2. here, on a timer, and
//   3. on demand via `runRetentionNow()`.
//
// The timer is started once per server process from `instrumentation.ts`
// (Next.js `register()`). A global guard makes repeated `start()` calls
// idempotent, so hot-reload in dev cannot stack intervals.
// ============================================================

import { purgeExpiredHistory } from "./retention";

/** How often the background sweep runs. */
const INTERVAL_MS = 60 * 60 * 1000; // hourly

const GLOBAL_KEY = "__legalirHistoryRetentionJob__";

interface JobState {
  timer: ReturnType<typeof setInterval>;
}

function jobState(): JobState | undefined {
  return (globalThis as Record<string, unknown>)[GLOBAL_KEY] as JobState | undefined;
}

/** Run one retention sweep immediately. Safe to call from anywhere. */
export function runRetentionNow(): { users: number; removed: number } {
  try {
    return purgeExpiredHistory();
  } catch (err) {
    console.error("[history-retention] sweep failed:", err);
    return { users: 0, removed: 0 };
  }
}

/**
 * Start the periodic retention job. Idempotent — a second call is a
 * no-op while a timer is already registered for this process.
 */
export function startHistoryRetentionJob(): void {
  if (jobState()) return;

  // Sweep once at startup so a long-idle server catches up immediately.
  runRetentionNow();

  const timer = setInterval(runRetentionNow, INTERVAL_MS);
  // Never keep the process alive just for this timer.
  if (typeof timer.unref === "function") timer.unref();

  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = { timer };
  console.log("[history-retention] job started (interval: 1h)");
}

/** Stop the job (used by tests). */
export function stopHistoryRetentionJob(): void {
  const state = jobState();
  if (!state) return;
  clearInterval(state.timer);
  Reflect.deleteProperty(globalThis, GLOBAL_KEY);
}
