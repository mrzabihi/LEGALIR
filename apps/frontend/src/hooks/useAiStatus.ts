"use client";

// ============================================================
// LEGALIR — AI connectivity status (browser)
// ============================================================
// Reads the REAL provider state from the gateway's health endpoint
// (`GET /api/v1/ai/stream`). This is the single source the document
// review page uses to decide between the two clearly separated states:
//
//   configured === true   → REAL analysis is possible (when the model is
//                           also reachable, i.e. `healthy`).
//   configured === false  → no model is connected. The page must NOT show
//                           fabricated analysis and must offer the trial
//                           scenarios instead.
//
// Nothing is faked here: if the endpoint cannot be reached we surface an
// error and the page treats "unknown" honestly (never as "connected").
// ============================================================

import { useQuery } from "@tanstack/react-query";

export interface AiStatus {
  /** Provider the server would use ("mock" | "openai-compatible"). */
  provider: string;
  model: string;
  /** True when real credentials are configured (false for the dev mock). */
  configured: boolean;
  /** True when the provider answered its health probe. */
  healthy: boolean;
  /** The provider the environment requested, regardless of a fallback. */
  providerRequested: string;
}

async function fetchAiStatus(signal: AbortSignal): Promise<AiStatus> {
  const res = await fetch("/api/v1/ai/stream", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    throw new Error(`AI status ${res.status}`);
  }
  return (await res.json()) as AiStatus;
}

/**
 * The honest connectivity signal for the AI gateway. `isError` means the
 * status could not be determined — callers must treat that as "not
 * confirmed connected", never as connected.
 */
export function useAiStatus() {
  return useQuery({
    queryKey: ["ai", "status"],
    queryFn: ({ signal }) => fetchAiStatus(signal),
    staleTime: 30_000,
    retry: 1,
  });
}
