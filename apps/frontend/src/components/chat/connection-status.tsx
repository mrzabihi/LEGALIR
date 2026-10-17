"use client";

// ============================================================
// LEGALIR — ConnectionStatus
// ============================================================
// A small, unobtrusive indicator of the REAL state of the chat service
// (§6). It never guesses from `navigator.onLine` alone: the device being
// online does not prove the LEGALIR chat endpoint is reachable, so the dot
// is only green after a real, successful call to the existing health
// endpoint (GET /api/v1/ai/stream → { healthy }). It distinguishes three
// different truths:
//
//   offline              — the device itself reports no network
//   service-unavailable  — the network is up but the chat service is not
//   online               — a real health call just succeeded
//
// Request discipline (§6): a single in-flight check at a time, a hard
// timeout, a light background interval (only while the tab is visible), and
// a bounded exponential backoff after failures. A successful real chat turn
// can also mark the service reachable via `signalApiReachable()`, so the
// indicator updates from work the user already triggered — no extra polling.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { env } from "@legalir/config";
import { IconRefresh } from "@/lib/icons";

export type ConnectionState =
  | "checking"
  | "online"
  | "offline"
  | "service-unavailable";

/** Health endpoint path — the same gateway the chat stream uses. */
const HEALTH_PATH = "/api/v1/ai/stream";
const HEALTH_TIMEOUT_MS = 5000;
/** Light background re-check while the tab is visible (never aggressive). */
const AUTO_INTERVAL_MS = 90_000;
/** Minimum gap between two non-forced checks. */
const MIN_GAP_MS = 15_000;
/** Bounded backoff ceiling after consecutive failures. */
const MAX_BACKOFF_MS = 60_000;

// ------------------------------------------------------------
// Reachability bus
// ------------------------------------------------------------
// A real, successful API interaction (e.g. a completed stream turn) proves
// the service is reachable. Rather than poll for it, the turn tells every
// mounted indicator directly.

type Listener = () => void;
const reachableListeners = new Set<Listener>();

/** Announce that a real API call just succeeded. */
export function signalApiReachable(): void {
  for (const listener of reachableListeners) listener();
}

/** One real health probe. Resolves true only when the service answers OK. */
async function probeHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.apiBaseUrl || ""}${HEALTH_PATH}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { healthy?: boolean } | null;
    // The endpoint is the source of truth: reachable AND healthy.
    return body?.healthy === true;
  } catch {
    // A network error is not logged with any payload — nothing sensitive to
    // leak, and the state itself is the signal (§6).
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function useConnectionStatus(): {
  state: ConnectionState;
  recheck: () => void;
} {
  const [state, setState] = useState<ConnectionState>("checking");
  const inFlight = useRef(false);
  const failures = useRef(0);
  const nextAllowedAt = useRef(0);

  const runCheck = useCallback(async (force = false) => {
    if (typeof navigator === "undefined") return;
    // The device itself is offline — no point probing the service.
    if (!navigator.onLine) {
      setState("offline");
      return;
    }
    if (inFlight.current) return;
    if (!force && Date.now() < nextAllowedAt.current) return;

    inFlight.current = true;
    // Keep a known-good state stable while re-verifying (no flicker).
    setState((prev) => (prev === "online" ? prev : "checking"));

    const ok = await probeHealth();
    inFlight.current = false;

    if (ok) {
      failures.current = 0;
      nextAllowedAt.current = Date.now() + MIN_GAP_MS;
      setState("online");
      return;
    }

    failures.current += 1;
    const backoff = Math.min(MAX_BACKOFF_MS, 10_000 * 2 ** (failures.current - 1));
    nextAllowedAt.current = Date.now() + backoff;
    // Only an outage of the service if the device still reports a network.
    setState(navigator.onLine ? "service-unavailable" : "offline");
  }, []);

  useEffect(() => {
    void runCheck(true);

    const onOnline = () => {
      setState("checking");
      void runCheck(true);
    };
    const onOffline = () => setState("offline");
    const onReachable = () => {
      failures.current = 0;
      nextAllowedAt.current = Date.now() + MIN_GAP_MS;
      setState("online");
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void runCheck();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    reachableListeners.add(onReachable);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void runCheck();
    }, AUTO_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      reachableListeners.delete(onReachable);
      clearInterval(interval);
    };
  }, [runCheck]);

  return { state, recheck: useCallback(() => void runCheck(true), [runCheck]) };
}

const LABELS: Record<ConnectionState, string> = {
  checking: "در حال اتصال…",
  online: "اینترنت متصل",
  offline: "اینترنت قطع است",
  "service-unavailable": "سرویس چت در دسترس نیست",
};

const DOT_CLASS: Record<ConnectionState, string> = {
  checking: "bg-warning motion-safe:animate-pulse",
  online: "bg-success",
  offline: "bg-error",
  "service-unavailable": "bg-error",
};

/**
 * The indicator. Renders nothing until mounted so the server and the first
 * client paint agree (the real state is only knowable in the browser).
 */
export function ConnectionStatus() {
  const [mounted, setMounted] = useState(false);
  const { state, recheck } = useConnectionStatus();

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const canRetry = state === "offline" || state === "service-unavailable";

  return (
    <div
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-divider bg-surface-container px-2 py-1 text-caption text-muted"
      role="status"
      aria-live="polite"
    >
      <span
        className={["h-2 w-2 shrink-0 rounded-full", DOT_CLASS[state]].join(" ")}
        aria-hidden="true"
      />
      <span className="hidden whitespace-nowrap tablet:inline">{LABELS[state]}</span>
      {/* On narrow viewports only the dot shows; screen readers still get it. */}
      <span className="sr-only tablet:hidden">{LABELS[state]}</span>
      {canRetry && (
        <button
          type="button"
          onClick={recheck}
          className="ms-0.5 flex shrink-0 items-center gap-0.5 rounded-full px-1 text-caption text-primary transition-colors hover:underline"
        >
          <IconRefresh size={12} />
          تلاش دوباره
        </button>
      )}
    </div>
  );
}
