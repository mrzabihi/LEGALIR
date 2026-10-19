// ============================================================
// LEGALIR — Contextual chat tools registry (server-only)
// ============================================================
// One authority for the tools the composer can attach to a turn:
//   • the product-stable definitions (never admin-editable),
//   • the persisted admin settings row per tool (`chat_tool_settings`),
//   • the REAL capability check (does this server actually hold the source?),
//   • the per-service allowlist and the effect each tool has on retrieval.
//
// HONESTY RULE (§7, §12): `available` is never decided by a toggle alone.
// «آراء قضایی» is only available when the legal library genuinely contains a
// published precedent source (رأی وحدت رویه / تصمیم قضایی). An admin switch
// can hide a tool; it can never conjure a corpus.
// ============================================================

import type {
  ChatToolAdminView,
  ChatToolDefinition,
  ChatToolId,
  ChatToolSettings,
  ChatToolView,
} from "@legalir/types";
import { readTable, writeTable } from "@/lib/db";
import { isPubliclyVisible, readLegalLibrary } from "@/lib/legal-library-db";
import type { ServiceType } from "./service-context";

const SETTINGS_TABLE = "chat_tool_settings";

/** Product-stable definitions. Order and copy are the defaults an admin may override. */
export const CHAT_TOOL_DEFINITIONS: readonly ChatToolDefinition[] = [
  {
    id: "deep_analysis",
    labelFa: "تحلیل عمیق",
    descriptionFa: "بررسی چندلایه با استدلال کامل‌تر و منابع بیشتر",
    effectNoteFa: "پاسخ با تحلیل عمیق‌تر و منابع بیشتری ارائه می‌شود.",
    icon: "sparkle",
    order: 1,
    requiresSource: false,
  },
  {
    id: "legal_research",
    labelFa: "پژوهش حقوقی",
    descriptionFa: "جستجوی گسترده‌تر در قوانین و رویه‌های حقوقی",
    effectNoteFa: "جستجو در منابع گسترده‌تر انجام و یافته‌ها در پاسخ لحاظ می‌شود.",
    icon: "search",
    order: 2,
    requiresSource: false,
  },
  {
    id: "judicial_opinions",
    labelFa: "آراء قضایی",
    descriptionFa: "جستجو در آرای وحدت رویه و تصمیمات قضایی موجود",
    effectNoteFa: "فقط آرای موجود در کتابخانه حقوقی بررسی می‌شود.",
    icon: "gavel",
    order: 3,
    requiresSource: true,
  },
] as const;

const DEFINITION_BY_ID = new Map<ChatToolId, ChatToolDefinition>(
  CHAT_TOOL_DEFINITIONS.map((d) => [d.id, d])
);

export function isChatToolId(value: unknown): value is ChatToolId {
  return typeof value === "string" && DEFINITION_BY_ID.has(value as ChatToolId);
}

/** Every content type that counts as a real precedent source. */
const PRECEDENT_CONTENT_TYPES = new Set(["UNIFICATION_RULING", "JUDICIAL_DECISION"]);

/**
 * The honest capability check for «آراء قضایی»: the library must actually hold
 * at least one PUBLISHED precedent row. This reads the same table the
 * retriever reads, so availability can never be ahead of the corpus.
 */
export function judicialOpinionsCapability(): {
  available: boolean;
  sourceCount: number;
  reasonFa: string | null;
} {
  const library = readLegalLibrary();
  const sourceCount = library.items.filter(
    (item) => PRECEDENT_CONTENT_TYPES.has(item.sourceType) && isPubliclyVisible(item)
  ).length;
  if (sourceCount > 0) return { available: true, sourceCount, reasonFa: null };
  return {
    available: false,
    sourceCount: 0,
    reasonFa: "منبع معتبر رأی قضایی در کتابخانه حقوقی ثبت نشده است.",
  };
}

// ============================================================
// Persisted settings
// ============================================================

function defaultsFor(def: ChatToolDefinition): ChatToolSettings {
  return {
    toolId: def.id,
    // Tools ship enabled; the capability check still decides real availability.
    enabled: true,
    // Empty = allowed for every service. The admin narrows this per service.
    allowedServiceTypes: [],
    labelFa: def.labelFa,
    descriptionFa: def.descriptionFa,
    effectNoteFa: def.effectNoteFa,
    order: def.order,
    updatedBy: null,
    updatedAt: new Date(0).toISOString(),
  };
}

/**
 * Read the persisted rows, seeding any missing tool idempotently. Rows are
 * never deleted, so a future tool gains its defaults on first read and a
 * re-enabled tool keeps whatever an admin last configured.
 */
export function listToolSettings(): ChatToolSettings[] {
  const stored = readTable<ChatToolSettings>(SETTINGS_TABLE);
  const byId = new Map(stored.map((row) => [row.toolId, row]));
  const merged: ChatToolSettings[] = [];
  let changed = false;

  for (const def of CHAT_TOOL_DEFINITIONS) {
    const row = byId.get(def.id);
    if (!row) {
      merged.push(defaultsFor(def));
      changed = true;
      continue;
    }
    merged.push({
      ...defaultsFor(def),
      ...row,
      order: typeof row.order === "number" ? row.order : def.order,
    });
  }

  if (changed) writeTable(SETTINGS_TABLE, merged);
  return merged.sort((a, b) => a.order - b.order);
}

export interface ToolSettingPatch {
  enabled?: boolean;
  allowedServiceTypes?: string[];
  labelFa?: string;
  descriptionFa?: string;
  effectNoteFa?: string;
  order?: number;
}

/** Update one tool's admin settings. Returns null for an unknown tool id. */
export function updateToolSetting(
  toolId: string,
  patch: ToolSettingPatch,
  updatedBy: string | null
): ChatToolSettings | null {
  if (!isChatToolId(toolId)) return null;
  const rows = listToolSettings();
  const index = rows.findIndex((row) => row.toolId === toolId);
  if (index === -1) return null;

  const def = DEFINITION_BY_ID.get(toolId)!;
  const current = rows[index]!;
  const next: ChatToolSettings = {
    ...current,
    ...(typeof patch.enabled === "boolean" ? { enabled: patch.enabled } : {}),
    ...(Array.isArray(patch.allowedServiceTypes)
      ? {
          allowedServiceTypes: [
            ...new Set(patch.allowedServiceTypes.filter((s) => typeof s === "string")),
          ],
        }
      : {}),
    ...(typeof patch.labelFa === "string"
      ? { labelFa: patch.labelFa.trim() || def.labelFa }
      : {}),
    ...(typeof patch.descriptionFa === "string"
      ? { descriptionFa: patch.descriptionFa.trim() || def.descriptionFa }
      : {}),
    ...(typeof patch.effectNoteFa === "string"
      ? { effectNoteFa: patch.effectNoteFa.trim() || def.effectNoteFa }
      : {}),
    ...(typeof patch.order === "number" ? { order: patch.order } : {}),
    updatedBy,
    updatedAt: new Date().toISOString(),
  };
  rows[index] = next;
  writeTable(SETTINGS_TABLE, rows);
  return next;
}

// ============================================================
// Resolution
// ============================================================

function allowedForService(settings: ChatToolSettings, serviceType: ServiceType): boolean {
  return (
    settings.allowedServiceTypes.length === 0 ||
    settings.allowedServiceTypes.includes(serviceType)
  );
}

/**
 * Project every tool for one service, with the honest availability verdict.
 * `selected` is filtered to tools that are genuinely available for the service
 * — a stale or tampered selection degrades safely rather than erroring.
 */
export function resolveChatTools(
  serviceType: ServiceType,
  selected: readonly unknown[] = []
): { tools: ChatToolView[]; selected: ChatToolId[] } {
  const settings = listToolSettings();
  const capability = judicialOpinionsCapability();

  const tools: ChatToolView[] = settings.map((row) => {
    const def = DEFINITION_BY_ID.get(row.toolId)!;
    const allowedForSvc = allowedForService(row, serviceType);
    const capabilityOk = def.requiresSource ? capability.available : true;

    let unavailableReasonFa: string | null = null;
    if (!row.enabled) {
      unavailableReasonFa = "این ابزار توسط مدیر سامانه غیرفعال شده است.";
    } else if (!allowedForSvc) {
      unavailableReasonFa = "این ابزار برای این خدمت در دسترس نیست.";
    } else if (!capabilityOk) {
      unavailableReasonFa = capability.reasonFa;
    }

    return {
      id: def.id,
      labelFa: row.labelFa,
      descriptionFa: row.descriptionFa,
      effectNoteFa: row.effectNoteFa,
      icon: def.icon,
      order: row.order,
      requiresSource: def.requiresSource,
      enabled: row.enabled,
      allowedForService: allowedForSvc,
      available: unavailableReasonFa === null,
      unavailableReasonFa,
    };
  });

  const availableIds = new Set(tools.filter((t) => t.available).map((t) => t.id));
  const selectedValid = normalizeToolIds(selected).filter((id) => availableIds.has(id));
  return { tools, selected: selectedValid };
}

/** Admin projection: settings + the real capability verdict. */
export function listToolsForAdmin(): ChatToolAdminView[] {
  const settings = listToolSettings();
  const capability = judicialOpinionsCapability();
  return settings.map((row) => {
    const def = DEFINITION_BY_ID.get(row.toolId)!;
    const capabilityOk = def.requiresSource ? capability.available : true;
    return {
      ...row,
      available: capabilityOk,
      unavailableReasonFa: capabilityOk ? null : capability.reasonFa,
    };
  });
}

/** Dedupe + sort by the product order. Unknown ids are dropped. */
export function normalizeToolIds(ids: readonly unknown[] | undefined | null): ChatToolId[] {
  if (!ids) return [];
  const unique = new Set<ChatToolId>();
  for (const id of ids) {
    if (isChatToolId(id)) unique.add(id);
  }
  return [...unique].sort(
    (a, b) => DEFINITION_BY_ID.get(a)!.order - DEFINITION_BY_ID.get(b)!.order
  );
}

/**
 * Server-side validation for an incoming selection. The gateway never trusts
 * the client: unknown, disabled, service-disallowed or unavailable tools are
 * reported back so the request can be rejected or degraded honestly.
 */
export function validateToolSelection(
  serviceType: ServiceType,
  ids: readonly unknown[] | undefined | null
): {
  ok: boolean;
  valid: ChatToolId[];
  rejected: { id: string; reasonFa: string }[];
} {
  const { tools } = resolveChatTools(serviceType, []);
  const viewById = new Map(tools.map((t) => [t.id, t]));

  const rejected: { id: string; reasonFa: string }[] = [];
  for (const raw of ids ?? []) {
    if (typeof raw !== "string") {
      rejected.push({ id: String(raw), reasonFa: "شناسه ابزار نامعتبر است." });
      continue;
    }
    if (!isChatToolId(raw)) {
      rejected.push({ id: raw, reasonFa: "ابزار ناشناخته است." });
      continue;
    }
    const view = viewById.get(raw);
    if (!view || !view.available) {
      rejected.push({
        id: raw,
        reasonFa: view?.unavailableReasonFa ?? "این ابزار در دسترس نیست.",
      });
    }
  }

  // Deduplicate (a repeated bad id must not spam the client).
  const seen = new Set<string>();
  const uniqueRejected = rejected.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  // `valid` keeps only genuinely available tools, in product order.
  const rejectedIds = new Set(uniqueRejected.map((r) => r.id));
  const valid = normalizeToolIds(ids).filter(
    (id) => !rejectedIds.has(id) && viewById.get(id)?.available
  );

  return { ok: uniqueRejected.length === 0, valid, rejected: uniqueRejected };
}

// ============================================================
// Effect on retrieval + prompt
// ============================================================

/** The baseline retrieval the gateway used before tools existed. */
const BASE_MAX_SOURCES = 3;

export interface ToolRetrievalPlan {
  /** How many hits the main hybrid retrieval should return. */
  maxSources: number;
  /** Run an additional precedent-scoped pass and merge its hits. */
  includePrecedentPass: boolean;
  /** Short, honest Persian notes appended to the system prompt. */
  promptNotes: string[];
}

/**
 * Map a validated selection onto real backend behaviour. Combining tools
 * genuinely merges their effects — this is why multi-select is allowed.
 */
export function toolRetrievalPlan(toolIds: readonly ChatToolId[]): ToolRetrievalPlan {
  const plan: ToolRetrievalPlan = {
    maxSources: BASE_MAX_SOURCES,
    includePrecedentPass: false,
    promptNotes: [],
  };

  if (toolIds.includes("deep_analysis")) {
    plan.maxSources = Math.max(plan.maxSources, 5);
    plan.promptNotes.push(
      "حالت «تحلیل عمیق» فعال است: تحلیل را چندلایه، با فرضیات صریح، بررسی گزینه‌ها و ریسک‌ها ارائه کن و از تک‌پاسخ عجولانه پرهیز کن."
    );
  }
  if (toolIds.includes("legal_research")) {
    plan.maxSources = Math.max(plan.maxSources, 6);
    plan.promptNotes.push(
      "حالت «پژوهش حقوقی» فعال است: پیش از نتیجه‌گیری، دامنه منابع را گسترده‌تر بررسی کن و یافته‌های مرتبط را با ارجاع دقیق بیاور."
    );
  }
  if (toolIds.includes("judicial_opinions")) {
    plan.includePrecedentPass = true;
    plan.promptNotes.push(
      "حالت «آراء قضایی» فعال است: فقط آرای موجود در منابع بازیابی‌شده را استناد کن؛ اگر رأی مرتبطی یافت نشد، صریح بگو که در منابع فعلی رأی مرتبطی موجود نیست."
    );
  }

  return plan;
}
