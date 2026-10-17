// ============================================================
// LEGALIR — Legal path discovery: analysis engine (server-only)
// ============================================================
// Produces the structured analysis behind «از کجا شروع کنم؟». It reuses the
// SAME provider abstraction the chat stream and the admin content generator
// use (`lib/ai/content.generateContentText` → `lib/ai/provider`), so an
// operator's provider configured on /admin/ai takes effect here too.
//
// IMPORTANT: server-only. It reads provider credentials indirectly (through
// the provider module) and must never be imported from a client component.
//
// It is deliberately defensive — the user's request must never be lost:
//   · the model is called ONLY when the `ai_consultation` capability is
//     enabled for the caller (otherwise we skip the cost entirely);
//   · the call is bounded by a timeout and a small retry-free budget;
//   · a disabled provider, an error, a timeout, or a schema-invalid reply
//     ALL fall back to the deterministic rules analysis;
//   · identical inputs are served from a short-lived in-memory cache so a
//     refresh / re-render never re-bills the model.
// ============================================================

import {
  buildAnalysisFromModel,
  buildDiscoveryPrompt,
  buildRulesAnalysis,
  DISCOVERY_SYSTEM_PROMPT,
  parseDiscoveryJson,
  type DiscoveryInput,
} from "./discovery";
import { generateContentText } from "@/lib/ai/content";
import { currentEnvironment, isFlagEnabled } from "@/lib/admin/flags";
import { getUsageSummary } from "@/lib/usage/engine";
import { INTENT_FLAG_KEY, type IntakeIntent } from "./start-request";
import type { LegalRequestDiscovery } from "@legalir/types";

/** How the analysis is gated for a specific caller. */
export interface DiscoveryContext {
  userId: string;
  orgId: string | null;
}

/** Milliseconds before a model call is abandoned in favour of the rules. */
const MODEL_TIMEOUT_MS = 12_000;

/** How long an analysis is reused for identical input, so re-renders are free. */
const CACHE_TTL_MS = 5 * 60_000;

/** Bounded cache size — the flow is low-frequency; this only guards memory. */
const CACHE_MAX = 200;

/**
 * A stable 0–99 bucket for the caller, so a percentage rollout treats the same
 * user consistently. Mirrors the capabilities endpoint's bucketing exactly.
 */
function rolloutBucket(userId: string): number {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 100;
}

/**
 * The capability gate for a caller: whether a given flag key is enabled for
 * their plan/org. Used both to decide whether to call the model at all and to
 * clamp the recommended paths to real, currently-enabled services.
 */
function resolveGate(ctx: DiscoveryContext): (flagKey: string) => boolean {
  const env = currentEnvironment();
  const planCode = getUsageSummary(ctx.userId).planCode ?? "free";
  const bucket = rolloutBucket(ctx.userId);
  return (flagKey: string) => isFlagEnabled(flagKey, { env, planCode, orgId: ctx.orgId, bucket });
}

/** A cheap, non-cryptographic key for the cache (no PII leaves the process). */
function cacheKey(input: DiscoveryInput, gateSignature: string): string {
  const raw = [
    input.text,
    input.intent ?? "",
    input.category ?? "",
    input.hasDocument ? "1" : "0",
    gateSignature,
  ].join("\u0000");
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = (h * 33) ^ raw.charCodeAt(i);
  return `${(h >>> 0).toString(36)}-${raw.length}`;
}

const cache = new Map<string, { value: LegalRequestDiscovery; expiresAt: number }>();

function readCache(key: string): LegalRequestDiscovery | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function writeCache(key: string, value: LegalRequestDiscovery): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Drop any cached analysis (used after a re-analysis or in tests). */
export function clearDiscoveryCache(): void {
  cache.clear();
}

/** Run the model, bounded by a timeout; returns raw text or null on failure. */
async function runModel(input: DiscoveryInput): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const result = await generateContentText({
      system: DISCOVERY_SYSTEM_PROMPT,
      prompt: buildDiscoveryPrompt(input),
      signal: controller.signal,
    });
    return result.text;
  } catch {
    // Provider error / timeout / abort — the caller falls back to the rules.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the analysis for a discovery request. Always resolves to a valid
 * `LegalRequestDiscovery`: the model when it is enabled and answers in the
 * expected shape, the deterministic rules otherwise.
 */
export async function analyzeDiscovery(
  input: DiscoveryInput,
  ctx: DiscoveryContext
): Promise<LegalRequestDiscovery> {
  const isEnabled = resolveGate(ctx);

  // Only spend a model call when the AI capability is really on for this user.
  const aiEnabled = isEnabled("ai_consultation");
  if (!aiEnabled) {
    return buildRulesAnalysis(input, isEnabled);
  }

  const key = cacheKey(input, "ai");
  const cached = readCache(key);
  if (cached) return cached;

  const rawText = await runModel(input);
  if (rawText) {
    const parsed = parseDiscoveryJson(rawText);
    const fromModel = parsed ? buildAnalysisFromModel(parsed, input, isEnabled) : null;
    if (fromModel) {
      writeCache(key, fromModel);
      return fromModel;
    }
  }

  // Model disabled, failed, timed out, or returned an invalid shape: the rules
  // analysis still carries the user's text forward and offers real paths.
  const fallback = buildRulesAnalysis(input, isEnabled);
  writeCache(key, fallback);
  return fallback;
}

/** Re-exported so the route can validate the incoming intent without drift. */
export type { IntakeIntent };
export { INTENT_FLAG_KEY };
