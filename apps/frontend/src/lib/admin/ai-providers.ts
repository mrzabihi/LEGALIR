// ============================================================
// LEGALIR — Admin AI provider configuration (server-only)
// ============================================================
// Owned tables:
//   ai_providers        — provider configs. API keys are stored ONLY as an
//                         AES-256-GCM ciphertext (see ./secrets). No admin
//                         API ever returns a raw key — just `hasKey` + a
//                         masked `keyHint`.
//   ai_prompt_versions  — versioned prompt templates. Publishing a new
//                         version appends a row and deactivates the prior
//                         active row for that key (immutable history).
//
// The runtime AI stream resolves its provider through `resolveRuntimeAiConfig`
// which prefers an admin-configured provider, then falls back to the
// environment. Connection tests perform a REAL request; the development
// mock is reported honestly as not a live connection.
// ============================================================

import { readTable, writeTable } from "@/lib/db";
import {
  encryptSecret,
  decryptSecret,
  isSecretStorageConfigured,
  maskSecret,
  type EncryptedSecret,
} from "./secrets";
import type {
  AiProviderConfig,
  AiProviderKind,
  AiProviderStatus,
  AiPromptVersion,
  AiTestResult,
  AiUsageMetrics,
} from "@legalir/types";

const PROVIDERS_TABLE = "ai_providers";
const PROMPTS_TABLE = "ai_prompt_versions";

/** A stored provider row — the key is a ciphertext blob, never plaintext. */
interface StoredProvider extends Omit<AiProviderConfig, "hasKey" | "keyHint" | "status"> {
  secret: EncryptedSecret | null;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

function statusOf(row: StoredProvider): AiProviderStatus {
  return row.secret ? "configured" : "unconfigured";
}

/**
 * The effective status. `disabled` wins over everything: an operator turned
 * this provider off, so it must never serve traffic even with a valid key.
 */
function effectiveStatus(row: StoredProvider): AiProviderStatus {
  if (row.enabled === false) return "disabled";
  return statusOf(row);
}

/** Project a stored row for API/UI — strips the ciphertext, keeps a hint. */
function toPublic(row: StoredProvider): AiProviderConfig {
  const { secret, ...rest } = row;
  return {
    ...rest,
    // Additive fields are defaulted on READ so a legacy row needs no rewrite.
    enabled: row.enabled !== false,
    availableModels: row.availableModels ?? (row.model ? [row.model] : []),
    defaultModel: row.defaultModel ?? row.model ?? null,
    configuration: row.configuration ?? {},
    status: effectiveStatus(row),
    hasKey: secret !== null,
    keyHint: secret ? secret.hint : null,
  };
}

/**
 * Seed a provider row representing the CURRENT effective runtime config, so
 * the admin panel always reflects the truth of the environment (never a
 * fabricated "connected" state).
 */
function seedFromEnv(): StoredProvider[] {
  const now = new Date().toISOString();
  const providerRaw = (process.env["LEGALIR_AI_PROVIDER"] ?? "mock").toLowerCase();
  const baseUrl = process.env["LEGALIR_AI_BASE_URL"] ?? null;
  const model = process.env["LEGALIR_AI_MODEL"] ?? null;

  const isMock = providerRaw === "mock" || !providerRaw;
  const kind: AiProviderKind =
    providerRaw.includes("anthropic") ? "anthropic"
    : providerRaw.includes("azure") ? "azure"
    : providerRaw.includes("openrouter") ? "openrouter"
    : providerRaw.includes("openai") ? "openai"
    : "custom";

  const row: StoredProvider = {
    id: "ai-env-default",
    nameFa: isMock ? "ارائه‌دهنده شبیه‌ساز توسعه (Mock)" : "ارائه‌دهنده محیط (Environment)",
    kind,
    baseUrl,
    model,
    embeddingModel: null,
    timeoutMs: 30_000,
    maxOutputTokens: 2048,
    isDefault: true,
    isTestOverride: false,
    enabled: !isMock,
    defaultModel: model,
    availableModels: model ? [model] : [],
    configuration: {},
    lastTestAt: null,
    lastTestOk: null,
    lastTestLatencyMs: null,
    updatedBy: null,
    updatedAt: now,
    createdAt: now,
    // The env key is intentionally NOT imported into the store: an env key is
    // managed outside the admin panel, and copying it would duplicate a secret.
    secret: null,
  };
  writeTable(PROVIDERS_TABLE, [row]);
  return [row];
}

function readProviders(): StoredProvider[] {
  const rows = readTable<StoredProvider>(PROVIDERS_TABLE);
  if (rows.length > 0) return rows;
  return seedFromEnv();
}

/** True when the env-based provider has a key (reported honestly, never stored). */
function envHasKey(): boolean {
  return Boolean(process.env["LEGALIR_AI_API_KEY"] ?? process.env["AI_PROVIDER_API_KEY"]);
}

export function listAiProviders(): AiProviderConfig[] {
  return readProviders().map((row) => {
    const pub = toPublic(row);
    // Reflect the env key for the seeded row without ever importing it. A
    // provider the operator disabled stays `disabled` — an env key does not
    // overrule an explicit decision.
    if (row.id === "ai-env-default" && envHasKey() && row.enabled !== false) {
      return {
        ...pub,
        status: "configured" as AiProviderStatus,
        hasKey: true,
        keyHint: pub.keyHint ?? maskSecret(process.env["LEGALIR_AI_API_KEY"] ?? "env"),
      };
    }
    return pub;
  });
}

export function getAiProvider(id: string): AiProviderConfig | undefined {
  return listAiProviders().find((p) => p.id === id);
}

export function isSecretStorageReady(): boolean {
  return isSecretStorageConfigured();
}

export interface SaveProviderInput {
  id?: string;
  nameFa: string;
  kind: AiProviderKind;
  baseUrl: string | null;
  model: string | null;
  embeddingModel: string | null;
  timeoutMs: number;
  maxOutputTokens: number;
  isDefault: boolean;
  /** A new raw key to store (encrypted). Omitted = leave the existing key. */
  apiKey?: string | null;
  /** Explicitly clear the stored key. */
  clearKey?: boolean;
  updatedBy: string;
  /** When false the provider is kept but never serves traffic. */
  enabled?: boolean;
  /** The operator's declared model catalogue for this provider. */
  availableModels?: string[];
  defaultModel?: string | null;
  /** Free-form, non-secret settings. Known secret-looking keys are dropped. */
  configuration?: Record<string, string>;
}

/** Keys that look like a credential are rejected from `configuration`. */
const SECRETISH_CONFIG_KEYS = [
  "key",
  "apikey",
  "api_key",
  "secret",
  "token",
  "password",
  "authorization",
];

function cleanConfiguration(
  input: Record<string, string> | undefined
): Record<string, string> {
  if (!input) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v !== "string") continue;
    if (SECRETISH_CONFIG_KEYS.includes(k.toLowerCase())) continue;
    // A single non-blank line — settings are small labels, not documents.
    out[k.trim()] = v.trim().slice(0, 200);
  }
  return out;
}

/**
 * Create or update a provider. A supplied API key is encrypted at rest; when
 * secret storage is not configured the save is REJECTED rather than storing
 * the key in the clear.
 */
export function saveAiProvider(input: SaveProviderInput): AiProviderConfig | { error: string } {
  if (!input.nameFa.trim()) return { error: "NAME_REQUIRED" };
  if (input.timeoutMs < 1000 || input.timeoutMs > 120_000) return { error: "INVALID_TIMEOUT" };
  if (input.maxOutputTokens < 1 || input.maxOutputTokens > 200_000) return { error: "INVALID_MAX_TOKENS" };

  const wantsNewKey = typeof input.apiKey === "string" && input.apiKey.trim().length > 0;
  if (wantsNewKey && !isSecretStorageConfigured()) {
    return { error: "SECRET_STORAGE_UNCONFIGURED" };
  }

  const rows = readProviders();
  const now = new Date().toISOString();
  const idx = input.id ? rows.findIndex((r) => r.id === input.id) : -1;

  // A provider cannot be disabled AND be the default router — that would
  // leave production with no explicit provider while pretending it has one.
  const enabled = input.enabled !== false;
  const isDefault = input.isDefault && enabled;

  if (isDefault) {
    for (const r of rows) r.isDefault = false;
  }

  let secret: EncryptedSecret | null;
  if (input.clearKey) {
    secret = null;
  } else if (wantsNewKey) {
    secret = encryptSecret(input.apiKey!.trim());
    if (!secret) return { error: "SECRET_STORAGE_UNCONFIGURED" };
  } else {
    secret = idx >= 0 ? rows[idx]!.secret : null;
  }

  const model = input.model?.trim() || null;
  const defaultModel = input.defaultModel?.trim() || model;
  const catalogue = (input.availableModels ?? [])
    .map((m) => m.trim())
    .filter((m) => m.length > 0 && m.length <= 120);
  // The model in use must exist in the declared catalogue; the save adds it
  // rather than rejecting, because «model» is the field the form sets first.
  const availableModels = Array.from(
    new Set([...(defaultModel ? [defaultModel] : []), ...(model ? [model] : []), ...catalogue])
  );

  const base: StoredProvider = {
    id: input.id ?? `ai-${crypto.randomUUID()}`,
    nameFa: input.nameFa.trim(),
    kind: input.kind,
    baseUrl: input.baseUrl?.trim() || null,
    model,
    embeddingModel: input.embeddingModel?.trim() || null,
    timeoutMs: Math.round(input.timeoutMs),
    maxOutputTokens: Math.round(input.maxOutputTokens),
    isDefault,
    isTestOverride: false,
    // Additive lifecycle + catalogue. A legacy save that omits `enabled`
    // keeps the current state instead of silently re-enabling the provider.
    enabled: input.enabled === undefined ? (idx >= 0 ? rows[idx]!.enabled !== false : true) : enabled,
    defaultModel,
    availableModels,
    configuration: cleanConfiguration(input.configuration),
    lastTestAt: idx >= 0 ? rows[idx]!.lastTestAt : null,
    lastTestOk: idx >= 0 ? rows[idx]!.lastTestOk : null,
    lastTestLatencyMs: idx >= 0 ? rows[idx]!.lastTestLatencyMs : null,
    updatedBy: input.updatedBy,
    updatedAt: now,
    createdAt: idx >= 0 ? rows[idx]!.createdAt : now,
    secret,
  };

  if (idx >= 0) rows[idx] = base;
  else rows.push(base);
  writeTable(PROVIDERS_TABLE, rows);
  return toPublic(base);
}

/**
 * Toggle only the lifecycle flag. Kept separate from `saveAiProvider` so an
 * enable/disable click cannot accidentally reset the model, limits or key —
 * and so the audit trail records a distinct event.
 */
export function setAiProviderEnabled(
  id: string,
  enabled: boolean,
  updatedBy: string
): AiProviderConfig | { error: string } {
  const rows = readProviders();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return { error: "NOT_FOUND" };
  const row = rows[idx]!;
  row.enabled = enabled;
  // Disabling the default leaves no default; the router then falls back to
  // the environment, which is the honest state.
  if (!enabled) row.isDefault = false;
  row.updatedBy = updatedBy;
  row.updatedAt = new Date().toISOString();
  writeTable(PROVIDERS_TABLE, rows);
  return toPublic(row);
}

/**
 * The credentials for one provider, ready to build a live client — or null
 * when it cannot serve (disabled, missing key, missing URL/model).
 * The key is decrypted here and only here; the caller never persists it.
 */
export function resolveProviderCredentials(providerId: string | null): {
  id: string;
  nameFa: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxOutputTokens: number;
} | null {
  if (!providerId) return null;
  const row = readProviders().find((r) => r.id === providerId);
  if (!row || row.enabled === false) return null;
  if (!row.baseUrl || !row.model) return null;

  let key: string | null = null;
  if (row.secret) key = decryptSecret(row.secret);
  // The seeded environment row reports its key without importing it.
  if (!key && row.id === "ai-env-default") {
    key = process.env["LEGALIR_AI_API_KEY"] ?? process.env["AI_PROVIDER_API_KEY"] ?? null;
  }
  if (!key) return null;

  return {
    id: row.id,
    nameFa: row.nameFa,
    model: row.model,
    apiKey: key,
    baseUrl: row.baseUrl,
    timeoutMs: row.timeoutMs,
    maxOutputTokens: row.maxOutputTokens,
  };
}

/**
 * Live connection test. Performs a REAL network request against the provider
 * when a key + base URL exist. The development mock is reported honestly as
 * not being a live provider — never a fabricated success.
 */
export async function testAiProvider(id: string): Promise<AiTestResult> {
  const testedAt = new Date().toISOString();
  const rows = readProviders();
  const row = rows.find((r) => r.id === id);
  if (!row) {
    return { ok: false, messageFa: "ارائه‌دهنده یافت نشد", latencyMs: null, testedAt, model: null };
  }

  // Resolve the effective key (stored ciphertext, else env for the seed row).
  let key: string | null = null;
  if (row.secret) key = decryptSecret(row.secret);
  if (!key && row.id === "ai-env-default") key = process.env["LEGALIR_AI_API_KEY"] ?? process.env["AI_PROVIDER_API_KEY"] ?? null;

  const isMock = !key && (!row.baseUrl || row.baseUrl.includes("mock"));
  if (isMock) {
    const result: AiTestResult = {
      ok: false,
      messageFa: "ارائه‌دهنده فعلی «شبیه‌ساز توسعه» است و اتصال واقعی برقرار نمی‌شود؛ برای اتصال زنده، کلید و آدرس سرویس را تنظیم کنید.",
      latencyMs: null,
      testedAt,
      model: row.model,
    };
    applyTestResult(rows, id, result);
    return result;
  }

  if (!key) {
    const result: AiTestResult = {
      ok: false,
      messageFa: "کلید API تنظیم نشده است؛ اتصال قابل آزمون نیست.",
      latencyMs: null,
      testedAt,
      model: row.model,
    };
    applyTestResult(rows, id, result);
    return result;
  }
  if (!row.baseUrl) {
    const result: AiTestResult = {
      ok: false,
      messageFa: "آدرس سرویس (Base URL) تنظیم نشده است.",
      latencyMs: null,
      testedAt,
      model: row.model,
    };
    applyTestResult(rows, id, result);
    return result;
  }

  const started = Date.now();
  let result: AiTestResult;
  try {
    const res = await fetch(`${row.baseUrl.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(row.timeoutMs),
    });
    const latencyMs = Date.now() - started;
    result = res.ok
      ? { ok: true, messageFa: "اتصال برقرار شد.", latencyMs, testedAt, model: row.model }
      : { ok: false, messageFa: `سرویس پاسخ خطا داد (کد ${res.status}).`, latencyMs, testedAt, model: row.model };
  } catch (e) {
    const latencyMs = Date.now() - started;
    // Sanitize: never surface the key or a raw stack in the message.
    const reason = e instanceof Error && e.name === "TimeoutError"
      ? "اتصال در بازه زمانی مجاز برقرار نشد."
      : "برقراری اتصال به سرویس ناموفق بود.";
    result = { ok: false, messageFa: reason, latencyMs, testedAt, model: row.model };
  }
  applyTestResult(rows, id, result);
  return result;
}

function applyTestResult(rows: StoredProvider[], id: string, result: AiTestResult): void {
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return;
  rows[idx]!.lastTestAt = result.testedAt;
  rows[idx]!.lastTestOk = result.ok;
  rows[idx]!.lastTestLatencyMs = result.latencyMs;
  writeTable(PROVIDERS_TABLE, rows);
}

/**
 * The runtime provider override. Prefers an admin-configured provider with a
 * stored key; returns null when none is usable, so the caller falls back to
 * the environment (see `lib/ai/provider.ts`).
 */
export function resolveRuntimeAiConfig(): {
  provider: "openai-compatible";
  providerId: string;
  nameFa: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxOutputTokens: number;
} | null {
  const rows = readProviders().filter((r) => r.enabled !== false);
  const candidates = rows.filter((r) => r.secret && r.baseUrl && r.model);
  const chosen = candidates.find((r) => r.isDefault) ?? candidates[0];
  if (!chosen || !chosen.secret || !chosen.baseUrl || !chosen.model) return null;
  const key = decryptSecret(chosen.secret);
  if (!key) return null;
  return {
    provider: "openai-compatible",
    providerId: chosen.id,
    nameFa: chosen.nameFa,
    model: chosen.defaultModel ?? chosen.model,
    apiKey: key,
    baseUrl: chosen.baseUrl,
    timeoutMs: chosen.timeoutMs,
    maxOutputTokens: chosen.maxOutputTokens,
  };
}

// ---------------------------------------------------------------------------
// Prompt versions (immutable history)
// ---------------------------------------------------------------------------

const PROMPT_SEED: { key: string; labelFa: string; content: string; changelog: string }[] = [
  {
    key: "system.consult",
    labelFa: "دستور سیستمی مشاوره",
    content:
      "شما دستیار حقوقی لیگالیر هستید. فقط بر پایه منابع معتبر حقوقی ایران پاسخ دهید، منبع هر ادعا را ذکر کنید و در صورت نبود منبع کافی صریحاً اعلام کنید.",
    changelog: "نسخه اولیه",
  },
  {
    key: "developer.contract_review",
    labelFa: "بررسی قرارداد — دستور توسعه‌دهنده",
    content:
      "قرارداد را از منظر ریسک‌های حقوقی تحلیل کن: تعهدات، ضمانت‌ها، شرایط فسخ و مراجع حل اختلاف. خروجی را ساختارمند و همراه با ارجاع به ماده مرتبط ارائه کن.",
    changelog: "نسخه اولیه",
  },
];

function seedPrompts(): AiPromptVersion[] {
  const now = new Date().toISOString();
  const rows: AiPromptVersion[] = PROMPT_SEED.map((p) => ({
    id: `prompt-${p.key}-v1`,
    key: p.key,
    labelFa: p.labelFa,
    version: 1,
    content: p.content,
    isActive: true,
    changelog: p.changelog,
    createdBy: "system",
    createdAt: now,
  }));
  writeTable(PROMPTS_TABLE, rows);
  return rows;
}

export function listPromptVersions(key?: string): AiPromptVersion[] {
  let rows = readTable<AiPromptVersion>(PROMPTS_TABLE);
  if (rows.length === 0) rows = seedPrompts();
  const filtered = key ? rows.filter((p) => p.key === key) : rows;
  return filtered.sort((a, b) => (a.key === b.key ? b.version - a.version : a.key.localeCompare(b.key)));
}

export interface CreatePromptVersionInput {
  key: string;
  labelFa: string;
  content: string;
  changelog?: string | null;
  createdBy: string;
}

/** Append a NEW prompt version and deactivate the prior active one for that key. */
export function createPromptVersion(input: CreatePromptVersionInput): AiPromptVersion | { error: string } {
  if (!input.key.trim()) return { error: "KEY_REQUIRED" };
  if (!input.content.trim()) return { error: "CONTENT_REQUIRED" };

  const rows = listPromptVersions();
  const forKey = rows.filter((p) => p.key === input.key);
  const nextVersion = forKey.reduce((max, p) => Math.max(max, p.version), 0) + 1;
  for (const p of rows) {
    if (p.key === input.key && p.isActive) p.isActive = false;
  }
  const created: AiPromptVersion = {
    id: `prompt-${input.key}-v${nextVersion}-${crypto.randomUUID().slice(0, 8)}`,
    key: input.key,
    labelFa: input.labelFa.trim() || input.key,
    version: nextVersion,
    content: input.content,
    isActive: true,
    changelog: input.changelog?.trim() || null,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };
  rows.push(created);
  writeTable(PROMPTS_TABLE, rows);
  return created;
}

/** Roll back to an earlier version by re-activating it (history is kept). */
export function activatePromptVersion(id: string, actorUserId: string): AiPromptVersion | { error: string } {
  const rows = listPromptVersions();
  const target = rows.find((p) => p.id === id);
  if (!target) return { error: "NOT_FOUND" };
  for (const p of rows) {
    if (p.key === target.key) p.isActive = p.id === id;
  }
  target.changelog = `${target.changelog ?? ""}\nفعال‌سازی مجدد توسط ${actorUserId}`.trim();
  writeTable(PROMPTS_TABLE, rows);
  return target;
}

// ---------------------------------------------------------------------------
// Usage metrics (real telemetry)
// ---------------------------------------------------------------------------

interface ChatRunRow {
  id: string;
  status: string;
  requiresLawyerReview?: boolean;
  error?: string | null;
  totalLatencyMs?: number;
  stages?: Record<string, { status?: string }>;
  createdAt: string;
}

/**
 * AI usage metrics derived from REAL processing-run telemetry. Fields the
 * data cannot support (e.g. cost when no pricing is configured) are returned
 * as null rather than a fabricated number.
 */
export function getAiUsageMetrics(rangeDays = 30): AiUsageMetrics {
  const since = new Date(Date.now() - rangeDays * 86_400_000).toISOString();
  const runs = readTable<ChatRunRow>("chat-processing-runs").filter((r) => r.createdAt >= since);

  const totalRequests = runs.length;
  const successCount = runs.filter((r) => r.status === "completed").length;
  const errorCount = runs.filter((r) => Boolean(r.error)).length;
  const fallbackCount = runs.filter((r) =>
    Object.values(r.stages ?? {}).some((s) => s?.status === "FALLBACK" || s?.status === "SKIPPED")
  ).length;
  const needsReviewCount = runs.filter((r) => r.requiresLawyerReview).length;

  const latencies = runs
    .map((r) => r.totalLatencyMs)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);

  const percentile = (p: number): number | null =>
    latencies.length === 0
      ? null
      : latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))] ?? null;

  const tokensUsed = readTable<{ tokens_used?: number }>("usage_stats").reduce(
    (sum, u) => sum + (u.tokens_used ?? 0),
    0
  );

  return {
    totalRequests,
    successCount,
    errorCount,
    fallbackCount,
    // Account-wide token aggregate from usage stats (real, not per-window).
    totalTokens: tokensUsed,
    // No per-token pricing is configured → cost is honestly unavailable.
    estimatedCostToman: null,
    latencyP50Ms: percentile(50),
    latencyP95Ms: percentile(95),
    needsReviewCount,
  };
}
