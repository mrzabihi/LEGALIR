// ============================================================
// LEGALIR — Per-capability AI model bindings (server-only)
// ============================================================
// Owned table:
//   ai_service_bindings — one row per capability the operator configured
//                         explicitly. A capability with NO row follows the
//                         default provider, exactly as before this module
//                         existed — so an old data directory is untouched.
//
// A binding never stores a key. It stores WHICH provider runs a capability
// plus that capability's limits and knowledge scope; the key stays in
// `ai_providers` as an encrypted blob and is never returned by an API.
//
// Honesty rules enforced here:
//   • A binding pointing at a disabled/unconfigured provider is REPORTED as
//     degraded, never silently treated as in force.
//   • The impact of a change (runs, errors, last use, mock fallback) is
//     computed from REAL processing runs and returned BEFORE the save.
//   • Every save is audited with before/after plus the impact facts, so a
//     later reader sees what the operator was told when committing.
// ============================================================

import { readTable, writeTable } from "@/lib/db";
import { recordAudit } from "./audit";
import {
  getAiProvider,
  listAiProviders,
  resolveProviderCredentials,
  resolveRuntimeAiConfig,
} from "./ai-providers";
import { listRagSources } from "./rag";
import { SERVICE_CONTEXTS, isServiceType } from "@/lib/ai/service-context";
import { toPersianDigits } from "@/lib/persian-utils";
import type {
  AiBindingImpact,
  AiBindingStatus,
  AiServiceBinding,
  AiUsageBreakdown,
  AiUsageDayRow,
  AiUsageSplitRow,
  UsageTransaction,
} from "@legalir/types";

const TABLE = "ai_service_bindings";

/** The support assistant is a capability too — it is not a chat `ServiceType`. */
export const SUPPORT_CHAT_SERVICE_TYPE = "support_chat";
export const SUPPORT_CHAT_LABEL_FA = "چت پشتیبانی";

interface ChatRunRow {
  userMessageId?: string;
  serviceType?: string | null;
  status?: string;
  error?: string | null;
  createdAt: string;
}

/**
 * Every capability the panel binds. Chat services come from the SAME
 * vocabulary the gateway validates against, so a binding can never name a
 * capability the runtime does not know.
 */
export function listCapabilities(): { serviceType: string; labelFa: string }[] {
  const chat = Object.values(SERVICE_CONTEXTS).map((s) => ({
    serviceType: s.serviceType as string,
    labelFa: s.label,
  }));
  return [...chat, { serviceType: SUPPORT_CHAT_SERVICE_TYPE, labelFa: SUPPORT_CHAT_LABEL_FA }];
}

export function capabilityLabel(serviceType: string): string {
  return listCapabilities().find((c) => c.serviceType === serviceType)?.labelFa ?? serviceType;
}

export function isCapability(serviceType: string): boolean {
  return serviceType === SUPPORT_CHAT_SERVICE_TYPE || isServiceType(serviceType);
}

function blankBinding(serviceType: string): AiServiceBinding {
  return {
    id: `svc:${serviceType}`,
    serviceType,
    providerId: null,
    model: null,
    temperature: null,
    maxOutputTokens: null,
    timeoutMs: null,
    fallbackProviderId: null,
    knowledgeSourceIds: null,
    status: "active",
    updatedAt: "",
    updatedBy: null,
  };
}

/** Fill fields added later with their documented defaults — on READ only. */
function normalize(row: Partial<AiServiceBinding> & { serviceType: string }): AiServiceBinding {
  return {
    ...blankBinding(row.serviceType),
    ...row,
    id: row.id ?? `svc:${row.serviceType}`,
    knowledgeSourceIds: row.knowledgeSourceIds ?? null,
    status: row.status === "inactive" ? "inactive" : "active",
  };
}

function readBindings(): AiServiceBinding[] {
  return readTable<Partial<AiServiceBinding> & { serviceType: string }>(TABLE)
    .filter((r) => typeof r?.serviceType === "string" && isCapability(r.serviceType))
    .map(normalize);
}

/**
 * Every capability, whether or not it has a stored row. `configured` lets the
 * panel distinguish «explicitly set» from «follows the default provider».
 */
export function listServiceBindings(): (AiServiceBinding & { configured: boolean })[] {
  const byType = new Map(readBindings().map((b) => [b.serviceType, b]));
  return listCapabilities().map((c) => {
    const row = byType.get(c.serviceType);
    return { ...(row ?? blankBinding(c.serviceType)), configured: Boolean(row) };
  });
}

/** The stored binding for a capability, or null when it follows the default. */
export function getServiceBinding(serviceType: string | null | undefined): AiServiceBinding | null {
  if (!serviceType) return null;
  return readBindings().find((b) => b.serviceType === serviceType) ?? null;
}

// ---------------------------------------------------------------------------
// Impact preview
// ---------------------------------------------------------------------------

function runsForCapability(serviceType: string): ChatRunRow[] {
  return readTable<ChatRunRow>("chat-processing-runs").filter(
    (r) => (r.serviceType ?? "legal_consultation") === serviceType
  );
}

/**
 * What a change would do, computed from the runs that ACTUALLY executed for
 * this capability. Used both as the pre-save preview and, inside the save, as
 * the facts frozen into the audit trail.
 */
export function bindingImpact(params: {
  serviceType: string;
  providerId: string | null;
  model: string | null;
  rangeDays?: number;
  status?: AiBindingStatus;
}): AiBindingImpact {
  const rangeDays = params.rangeDays ?? 30;
  const since = new Date(Date.now() - rangeDays * 86_400_000).toISOString();

  const runs = runsForCapability(params.serviceType);
  const inWindow = runs.filter((r) => r.createdAt >= since);
  const errors = inWindow.filter((r) => Boolean(r.error)).length;
  const lastUsedAt = runs.reduce<string | null>(
    (latest, r) => (!latest || r.createdAt > latest ? r.createdAt : latest),
    null
  );

  const current = getServiceBinding(params.serviceType);
  const currentProvider = current?.providerId ? getAiProvider(current.providerId) : null;
  const nextProvider = params.providerId ? getAiProvider(params.providerId) : null;
  const effectiveStatus: AiBindingStatus | "unbound" = params.status ?? current?.status ?? "unbound";

  const nextIsMock = !params.providerId;
  const nextProviderDisabled = Boolean(params.providerId) && nextProvider?.status === "disabled";

  const impactFa: string[] = [];
  impactFa.push(
    inWindow.length > 0
      ? `این قابلیت در ${toPersianDigits(rangeDays)} روز گذشته ${toPersianDigits(inWindow.length)} درخواست اجرا کرده است؛ تغییر از درخواست بعدی اعمال می‌شود و پاسخ‌های ثبت‌شده بازنویسی نمی‌شوند.`
      : `این قابلیت در ${toPersianDigits(rangeDays)} روز گذشته درخواستی اجرا نکرده است؛ تغییر از نخستین درخواست بعدی اعمال می‌شود.`
  );
  if (errors > 0) impactFa.push(`${toPersianDigits(errors)} درخواست از این قابلیت با خطا پایان یافته است.`);
  if (effectiveStatus === "inactive") {
    impactFa.push(
      "این اتصال غیرفعال است؛ قابلیت به ارائه‌دهندهٔ پیش‌فرض بازمی‌گردد و تنظیمات اختصاصی اعمال نمی‌شود."
    );
  }
  if (nextIsMock) {
    impactFa.push(
      "بدون انتخاب ارائه‌دهنده، این قابلیت از ارائه‌دهندهٔ پیش‌فرض استفاده می‌کند؛ اگر هیچ ارائه‌دهندهٔ زنده‌ای آماده نباشد، پاسخ از شبیه‌ساز توسعه تولید می‌شود."
    );
  }
  if (nextProviderDisabled) {
    impactFa.push(
      `ارائه‌دهندهٔ «${nextProvider?.nameFa ?? params.providerId}» غیرفعال است؛ این قابلیت تا فعال‌شدن آن اجرا نمی‌شود.`
    );
  }
  if (nextProvider && !nextProvider.hasKey) {
    impactFa.push(
      `برای ارائه‌دهندهٔ «${nextProvider.nameFa}» کلید API ثبت نشده است؛ تا ثبت کلید، اتصال زنده برقرار نمی‌شود.`
    );
  }
  if (params.providerId && params.model) {
    const catalogue = nextProvider?.availableModels ?? [];
    if (catalogue.length > 0 && !catalogue.includes(params.model)) {
      impactFa.push(
        `مدل «${params.model}» در فهرست مدل‌های اعلام‌شدهٔ این ارائه‌دهنده نیست؛ یکی از مدل‌های فهرست را برگزینید.`
      );
    }
  }

  return {
    serviceType: params.serviceType,
    labelFa: capabilityLabel(params.serviceType),
    requests: inWindow.length,
    errors,
    lastUsedAt,
    currentProviderId: current?.providerId ?? null,
    currentProviderNameFa: currentProvider?.nameFa ?? null,
    currentModel: current?.model ?? null,
    currentStatus: effectiveStatus,
    nextProviderId: params.providerId,
    nextProviderNameFa: nextProvider?.nameFa ?? null,
    nextModel: params.model,
    nextIsMock,
    nextProviderDisabled,
    impactFa,
  };
}

// ---------------------------------------------------------------------------
// Validation + save
// ---------------------------------------------------------------------------

const TIMEOUT_MIN = 1_000;
const TIMEOUT_MAX = 120_000;
const MAX_TOKENS_MIN = 1;
const MAX_TOKENS_MAX = 200_000;

export interface SaveBindingInput {
  serviceType: string;
  providerId: string | null;
  model: string | null;
  temperature?: number | null;
  maxOutputTokens?: number | null;
  timeoutMs?: number | null;
  fallbackProviderId?: string | null;
  knowledgeSourceIds?: string[] | null;
  status?: AiBindingStatus;
  updatedBy: string;
}

export interface AuditMeta {
  actorRole: string;
  orgId?: string | null;
  ip?: string | null;
  requestId?: string | null;
}

export type SaveBindingResult =
  | { ok: true; binding: AiServiceBinding; impact: AiBindingImpact }
  | { ok: false; error: string; messageFa: string };

function bindingFacts(b: AiServiceBinding) {
  return {
    providerId: b.providerId,
    model: b.model,
    status: b.status,
    fallbackProviderId: b.fallbackProviderId,
    knowledgeSources: b.knowledgeSourceIds?.length ?? null,
  };
}

/**
 * Create or update a capability binding. Strict about anything that would
 * silently break execution; a null means «inherit».
 */
export function saveServiceBinding(input: SaveBindingInput, meta: AuditMeta): SaveBindingResult {
  if (!isCapability(input.serviceType)) {
    return {
      ok: false,
      error: "INVALID_CAPABILITY",
      messageFa: "قابلیت انتخاب‌شده شناخته نمی‌شود.",
    };
  }

  const providerId = input.providerId?.trim() || null;
  if (providerId && !getAiProvider(providerId)) {
    return { ok: false, error: "PROVIDER_NOT_FOUND", messageFa: "ارائه‌دهندهٔ انتخاب‌شده یافت نشد." };
  }

  const fallbackProviderId = input.fallbackProviderId?.trim() || null;
  if (fallbackProviderId && !getAiProvider(fallbackProviderId)) {
    return { ok: false, error: "PROVIDER_NOT_FOUND", messageFa: "ارائه‌دهندهٔ جایگزین یافت نشد." };
  }
  if (fallbackProviderId && fallbackProviderId === providerId) {
    return {
      ok: false,
      error: "FALLBACK_EQUALS_PRIMARY",
      messageFa: "ارائه‌دهندهٔ جایگزین باید با ارائه‌دهندهٔ اصلی متفاوت باشد.",
    };
  }

  const model = input.model?.trim() || null;
  if (model && providerId) {
    const catalogue = getAiProvider(providerId)?.availableModels ?? [];
    if (catalogue.length > 0 && !catalogue.includes(model)) {
      return {
        ok: false,
        error: "MODEL_NOT_IN_CATALOGUE",
        messageFa: "مدل انتخاب‌شده در فهرست مدل‌های این ارائه‌دهنده نیست.",
      };
    }
  }

  const timeoutMs = input.timeoutMs ?? null;
  if (timeoutMs !== null && (timeoutMs < TIMEOUT_MIN || timeoutMs > TIMEOUT_MAX)) {
    return { ok: false, error: "INVALID_TIMEOUT", messageFa: "مهلت اتصال باید بین ۱ تا ۱۲۰ ثانیه باشد." };
  }
  const maxOutputTokens = input.maxOutputTokens ?? null;
  if (
    maxOutputTokens !== null &&
    (maxOutputTokens < MAX_TOKENS_MIN || maxOutputTokens > MAX_TOKENS_MAX)
  ) {
    return {
      ok: false,
      error: "INVALID_MAX_TOKENS",
      messageFa: "حداکثر توکن خروجی باید بین ۱ تا ۲۰۰٬۰۰۰ باشد.",
    };
  }
  const temperature = input.temperature ?? null;
  if (temperature !== null && (temperature < 0 || temperature > 2)) {
    return { ok: false, error: "INVALID_TEMPERATURE", messageFa: "دمای مدل باید بین ۰ تا ۲ باشد." };
  }

  // A knowledge id must exist. Storing a dangling id would make the scope look
  // narrower than it is, so it is rejected instead.
  let knowledgeSourceIds: string[] | null = null;
  if (input.knowledgeSourceIds !== null && input.knowledgeSourceIds !== undefined) {
    const known = new Set(listRagSources().map((s) => s.id));
    const cleaned = Array.from(new Set(input.knowledgeSourceIds.filter((id) => known.has(id))));
    if (cleaned.length !== new Set(input.knowledgeSourceIds).size) {
      return {
        ok: false,
        error: "UNKNOWN_KNOWLEDGE_SOURCE",
        messageFa: "یکی از منابع دانش انتخاب‌شده یافت نشد.",
      };
    }
    // [] = answer without retrieval; null = every published source.
    knowledgeSourceIds = cleaned;
  }

  const rows = readBindings();
  const idx = rows.findIndex((b) => b.serviceType === input.serviceType);
  const before = idx >= 0 ? rows[idx]! : null;
  const status: AiBindingStatus =
    input.status === undefined ? (before?.status ?? "active") : input.status;

  const impact = bindingImpact({
    serviceType: input.serviceType,
    providerId,
    model,
    status,
  });

  const next: AiServiceBinding = {
    id: `svc:${input.serviceType}`,
    serviceType: input.serviceType,
    providerId,
    model,
    temperature,
    maxOutputTokens,
    timeoutMs,
    fallbackProviderId,
    knowledgeSourceIds,
    status,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };

  if (idx >= 0) rows[idx] = next;
  else rows.push(next);
  writeTable(TABLE, rows);

  const lifecycle =
    before && before.status !== next.status
      ? next.status === "active"
        ? "activate"
        : "deactivate"
      : null;

  recordAudit({
    actorUserId: input.updatedBy,
    actorRole: meta.actorRole,
    orgId: meta.orgId ?? null,
    action: lifecycle ? `ai.binding.${lifecycle}` : "ai.binding.update",
    resourceType: "ai_service_binding",
    resourceId: input.serviceType,
    before: before ? bindingFacts(before) : null,
    after: {
      ...bindingFacts(next),
      // Frozen impact facts: what the operator was told before committing.
      affectedRequests: impact.requests,
      affectedErrors: impact.errors,
    },
    ip: meta.ip ?? null,
    requestId: meta.requestId ?? null,
  });

  return { ok: true, binding: next, impact };
}

/** Remove a binding — the capability returns to the default provider. */
export function clearServiceBinding(
  serviceType: string,
  actorUserId: string,
  meta: AuditMeta
): boolean {
  const rows = readBindings();
  const before = rows.find((b) => b.serviceType === serviceType);
  if (!before) return false;
  writeTable(
    TABLE,
    rows.filter((b) => b.serviceType !== serviceType)
  );
  recordAudit({
    actorUserId,
    actorRole: meta.actorRole,
    orgId: meta.orgId ?? null,
    action: "ai.binding.clear",
    resourceType: "ai_service_binding",
    resourceId: serviceType,
    before: bindingFacts(before),
    after: null,
    ip: meta.ip ?? null,
    requestId: meta.requestId ?? null,
  });
  return true;
}

// ---------------------------------------------------------------------------
// Runtime resolution — what the gateway actually runs with
// ---------------------------------------------------------------------------

export interface EffectiveProvider {
  /** Where the effective config came from. */
  source: "binding" | "default" | "environment" | "mock";
  providerId: string | null;
  providerNameFa: string | null;
  model: string;
  apiKey: string | null;
  baseUrl: string;
  temperature: number | null;
  maxOutputTokens: number | null;
  timeoutMs: number | null;
  /** True when no live key backs this config. */
  mock: boolean;
  /** The stored binding that was consulted, when there is one. */
  binding: AiServiceBinding | null;
  /** Persian explanation when a binding exists but could not be honoured. */
  degradedReasonFa: string | null;
}

/**
 * Resolve the provider for one capability. Order:
 *   1. an ACTIVE binding whose provider is enabled and holds a key;
 *   2. that binding's fallback provider;
 *   3. the default admin provider;
 *   4. the environment, else the development mock.
 *
 * A skipped step records why, so the panel can show the truth instead of
 * claiming a binding is in force.
 */
export function resolveEffectiveProvider(
  serviceType: string | null | undefined,
  envConfig: { model: string; apiKey: string | null; baseUrl: string }
): EffectiveProvider {
  const binding = getServiceBinding(serviceType);
  let degradedReasonFa: string | null = null;

  if (binding && binding.status === "active") {
    const primary = resolveProviderCredentials(binding.providerId);
    if (primary) {
      return {
        source: "binding",
        providerId: primary.id,
        providerNameFa: primary.nameFa,
        model: binding.model ?? primary.model,
        apiKey: primary.apiKey,
        baseUrl: primary.baseUrl,
        temperature: binding.temperature,
        maxOutputTokens: binding.maxOutputTokens,
        timeoutMs: binding.timeoutMs,
        mock: false,
        binding,
        degradedReasonFa: null,
      };
    }
    const fallback = resolveProviderCredentials(binding.fallbackProviderId);
    if (fallback) {
      return {
        source: "binding",
        providerId: fallback.id,
        providerNameFa: fallback.nameFa,
        model: binding.model ?? fallback.model,
        apiKey: fallback.apiKey,
        baseUrl: fallback.baseUrl,
        temperature: binding.temperature,
        maxOutputTokens: binding.maxOutputTokens,
        timeoutMs: binding.timeoutMs,
        mock: false,
        binding,
        degradedReasonFa: `ارائه‌دهندهٔ اصلی این قابلیت در دسترس نیست؛ ارائه‌دهندهٔ جایگزین «${fallback.nameFa}» اجرا می‌شود.`,
      };
    }
    if (binding.providerId) {
      degradedReasonFa =
        "ارائه‌دهندهٔ این قابلیت غیرفعال است یا کلید/آدرس معتبر ندارد؛ ارائه‌دهندهٔ پیش‌فرض اجرا می‌شود.";
    }
  }

  const runtime = resolveRuntimeAiConfig();
  if (runtime) {
    const name = listAiProviders().find((p) => p.isDefault)?.nameFa ?? null;
    return {
      source: "default",
      providerId: null,
      providerNameFa: name,
      model: runtime.model,
      apiKey: runtime.apiKey,
      baseUrl: runtime.baseUrl,
      temperature: null,
      maxOutputTokens: null,
      timeoutMs: null,
      mock: false,
      binding: binding ?? null,
      degradedReasonFa,
    };
  }

  return {
    source: envConfig.apiKey ? "environment" : "mock",
    providerId: null,
    providerNameFa: null,
    model: envConfig.model || "legalir-mock-v1",
    apiKey: envConfig.apiKey,
    baseUrl: envConfig.baseUrl,
    temperature: null,
    maxOutputTokens: null,
    timeoutMs: null,
    mock: !envConfig.apiKey,
    binding: binding ?? null,
    degradedReasonFa,
  };
}

// ---------------------------------------------------------------------------
// Usage split — only from real recorded work
// ---------------------------------------------------------------------------

const UNKNOWN = "__unknown__";

/**
 * Split AI usage by provider, model, capability and day.
 *
 * Requests and errors come from `chat-processing-runs` (one run per user
 * message, so this is the request count the pipeline really executed).
 * Tokens and provider/model come from `usage_transactions`, joined to the run
 * through `relatedEntityId = run.userMessageId` — the only real link between
 * a settled charge and the capability that produced it.
 *
 * Anything that cannot be attributed is counted as unattributed rather than
 * guessed into a bucket.
 */
export function getAiUsageBreakdown(rangeDays = 30): AiUsageBreakdown {
  const since = new Date(Date.now() - rangeDays * 86_400_000).toISOString();

  const runs = readTable<ChatRunRow>("chat-processing-runs").filter((r) => r.createdAt >= since);
  const settled = readTable<UsageTransaction>("usage_transactions").filter(
    (t) =>
      t.createdAt >= since &&
      t.activityType === "AI_MESSAGE" &&
      t.status === "COMPLETED"
  );

  const runByMessage = new Map<string, ChatRunRow>();
  for (const r of runs) if (r.userMessageId) runByMessage.set(r.userMessageId, r);

  const providerNames = new Map(listAiProviders().map((p) => [p.id, p.nameFa]));

  const asRow = (key: string, labelFa: string): AiUsageSplitRow => ({
    key,
    labelFa,
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    errors: 0,
  });

  const byProvider = new Map<string, AiUsageSplitRow>();
  const byModel = new Map<string, AiUsageSplitRow>();
  const byService = new Map<string, AiUsageSplitRow>();
  const byDay = new Map<string, AiUsageDayRow>();

  const touch = (map: Map<string, AiUsageSplitRow>, key: string, labelFa: string) => {
    let row = map.get(key);
    if (!row) {
      row = asRow(key, labelFa);
      map.set(key, row);
    }
    return row;
  };

  // --- Requests + errors: the runs the pipeline really executed -----------
  let totalRequests = 0;
  for (const r of runs) {
    totalRequests += 1;
    const serviceType = r.serviceType ?? "legal_consultation";
    const svc = touch(byService, serviceType, capabilityLabel(serviceType));
    svc.requests += 1;
    if (r.error) svc.errors += 1;

    const date = r.createdAt.slice(0, 10);
    const day = byDay.get(date) ?? { date, requests: 0, totalTokens: 0 };
    day.requests += 1;
    byDay.set(date, day);
  }

  // --- Tokens + provider/model: the settled ledger, joined to its run -----
  let totalTokens = 0;
  let unattributedRequests = 0;
  let unattributedServiceRequests = 0;
  let attributedRequests = 0;

  for (const t of settled) {
    const input = t.inputTokens ?? 0;
    const output = t.outputTokens ?? 0;
    const tokens = input + output;
    totalTokens += tokens;

    // Prefer the configured provider ROW (what the operator bound). An older
    // row only names the wire protocol, which is a real fact but not a
    // provider the operator can point at — so it is labelled as such instead
    // of being conflated with a configured provider that shares its name.
    const providerRowId = t.providerId ?? null;
    const providerKey = providerRowId
      ? providerRowId
      : t.provider
        ? `protocol:${t.provider}`
        : null;

    if (providerKey) {
      attributedRequests += 1;
      const labelFa = providerRowId
        ? (providerNames.get(providerRowId) ?? providerRowId)
        : `پروتکل ${t.provider} (بدون ارائه‌دهندهٔ ثبت‌شده)`;
      const row = touch(byProvider, providerKey, labelFa);
      row.requests += 1;
      row.inputTokens += input;
      row.outputTokens += output;
      row.totalTokens += tokens;
    } else {
      unattributedRequests += 1;
    }

    if (t.model) {
      const row = touch(byModel, t.model, t.model);
      row.requests += 1;
      row.inputTokens += input;
      row.outputTokens += output;
      row.totalTokens += tokens;
    }

    const run = t.relatedEntityId ? runByMessage.get(t.relatedEntityId) : undefined;
    const serviceType = run?.serviceType ?? null;
    if (serviceType) {
      const row = touch(byService, serviceType, capabilityLabel(serviceType));
      row.inputTokens += input;
      row.outputTokens += output;
      row.totalTokens += tokens;
    } else {
      // The charge cannot be tied to a capability: keep its tokens in a row
      // that says so, so the totals stay reconciled.
      const row = touch(byService, UNKNOWN, "بدون قابلیت قابل‌شناسایی");
      row.inputTokens += input;
      row.outputTokens += output;
      row.totalTokens += tokens;
      unattributedServiceRequests += 1;
    }

    const date = t.createdAt.slice(0, 10);
    const day = byDay.get(date) ?? { date, requests: 0, totalTokens: 0 };
    day.totalTokens += tokens;
    byDay.set(date, day);
  }

  const sort = (a: AiUsageSplitRow, b: AiUsageSplitRow) => b.requests - a.requests || b.totalTokens - a.totalTokens;

  const serviceRows = Array.from(byService.values()).sort(sort);
  // A capability with tokens but no runs in the window (runs are capped at
  // 500) would otherwise look like zero usage; the ledger figure wins there.
  for (const row of serviceRows) {
    if (row.key === UNKNOWN) row.labelFa = "بدون قابلیت قابل‌شناسایی";
  }

  return {
    rangeDays,
    totalRequests,
    totalTokens,
    attributionAvailable: attributedRequests > 0,
    byProvider: Array.from(byProvider.values()).sort(sort),
    byModel: Array.from(byModel.values()).sort(sort),
    byService: serviceRows,
    byDay: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
    unattributedRequests,
    unattributedServiceRequests,
  };
}
