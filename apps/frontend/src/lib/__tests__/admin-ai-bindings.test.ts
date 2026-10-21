// ============================================================
// LEGALIR — Per-capability AI bindings (hermetic)
// ============================================================
// Pins the honesty contract the AI admin panel depends on:
//   • a capability without a row follows the default provider;
//   • a binding pointing at a missing/disabled/keyless provider is reported
//     as DEGRADED and execution falls through in a documented order;
//   • the impact preview is computed from real runs and the SAME facts are
//     frozen into the audit trail on save;
//   • the usage split attributes tokens only from settled ledger rows and
//     counts everything else as unattributed instead of guessing.
//
// `@/lib/db`, the audit sink and the provider resolver are mocked so the
// suite is hermetic — no real .data table is touched and no key is read.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

interface FakeProvider {
  id: string;
  nameFa: string;
  status: "active" | "disabled";
  enabled: boolean;
  hasKey: boolean;
  model: string;
  baseUrl: string;
  availableModels: string[];
  defaultModel: string | null;
  isDefault: boolean;
}

interface FakeCredentials {
  id: string;
  nameFa: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

const state = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  audits: [] as Record<string, unknown>[],
  providers: [] as FakeProvider[],
  credentials: {} as Record<string, FakeCredentials | null>,
  runtime: null as { model: string; apiKey: string; baseUrl: string } | null,
  ragSources: [] as { id: string }[],
}));

vi.mock("@/lib/db", () => ({
  readTable: (name: string) => state.tables[name] ?? [],
  writeTable: (name: string, rows: unknown[]) => {
    state.tables[name] = rows;
  },
}));

vi.mock("@/lib/admin/audit", () => ({
  recordAudit: (event: Record<string, unknown>) => {
    state.audits.push(event);
  },
}));

vi.mock("@/lib/admin/ai-providers", () => ({
  getAiProvider: (id: string) => state.providers.find((p) => p.id === id),
  listAiProviders: () => state.providers,
  resolveProviderCredentials: (id: string | null) => (id ? (state.credentials[id] ?? null) : null),
  resolveRuntimeAiConfig: () => state.runtime,
}));

vi.mock("@/lib/admin/rag", () => ({
  listRagSources: () => state.ragSources,
}));

import {
  SUPPORT_CHAT_SERVICE_TYPE,
  bindingImpact,
  clearServiceBinding,
  getAiUsageBreakdown,
  getServiceBinding,
  isCapability,
  listCapabilities,
  listServiceBindings,
  resolveEffectiveProvider,
  saveServiceBinding,
} from "@/lib/admin/ai-bindings";

const NOW = () => new Date().toISOString();
const META = { actorRole: "admin" as const };

function providerRow(overrides: Partial<FakeProvider> = {}): FakeProvider {
  return {
    id: "prov-openai",
    nameFa: "اوپن‌ای‌آی",
    status: "active",
    enabled: true,
    hasKey: true,
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    availableModels: ["gpt-4o-mini", "gpt-4o"],
    defaultModel: "gpt-4o-mini",
    isDefault: true,
    ...overrides,
  };
}

function credentials(id: string, overrides: Partial<FakeCredentials> = {}): FakeCredentials {
  return {
    id,
    nameFa: overrides.nameFa ?? `ارائه‌دهندهٔ ${id}`,
    model: overrides.model ?? "gpt-4o-mini",
    apiKey: overrides.apiKey ?? "sk-test",
    baseUrl: overrides.baseUrl ?? "https://api.openai.com/v1",
    timeoutMs: overrides.timeoutMs ?? 30_000,
    maxOutputTokens: overrides.maxOutputTokens ?? 2048,
  };
}

beforeEach(() => {
  state.tables = {};
  state.audits = [];
  state.providers = [providerRow()];
  state.credentials = { "prov-openai": credentials("prov-openai") };
  state.runtime = null;
  state.ragSources = [{ id: "law-civil-1" }, { id: "precedent-1" }];
});

// ---------------------------------------------------------------------------
// Capability vocabulary
// ---------------------------------------------------------------------------

describe("listCapabilities", () => {
  it("includes every chat service plus the support assistant", () => {
    const types = listCapabilities().map((c) => c.serviceType);
    expect(types).toContain("legal_consultation");
    expect(types).toContain("contract_review");
    expect(types).toContain(SUPPORT_CHAT_SERVICE_TYPE);
  });

  it("recognises support_chat as a capability but not junk", () => {
    expect(isCapability(SUPPORT_CHAT_SERVICE_TYPE)).toBe(true);
    expect(isCapability("not_a_service")).toBe(false);
  });
});

describe("listServiceBindings", () => {
  it("lists every capability as unconfigured before any save", () => {
    const rows = listServiceBindings();
    expect(rows.length).toBe(listCapabilities().length);
    expect(rows.every((r) => r.configured === false)).toBe(true);
    expect(rows[0]!.updatedAt).toBe("");
  });

  it("marks a stored row configured and ignores unknown service types", () => {
    state.tables["ai_service_bindings"] = [
      {
        serviceType: "contract_review",
        providerId: "prov-openai",
        model: "gpt-4o",
        status: "active",
        updatedAt: "2026-10-20T08:00:00.000Z",
        updatedBy: "staff-1",
      },
      { serviceType: "bogus_service", providerId: "x" },
    ];
    const row = listServiceBindings().find((r) => r.serviceType === "contract_review")!;
    expect(row.configured).toBe(true);
    expect(row.model).toBe("gpt-4o");
    expect(listServiceBindings().some((r) => r.serviceType === "bogus_service")).toBe(false);
  });
});

describe("getServiceBinding", () => {
  it("returns null for an absent capability or a null input", () => {
    expect(getServiceBinding(null)).toBeNull();
    expect(getServiceBinding("contract_review")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Impact preview
// ---------------------------------------------------------------------------

describe("bindingImpact", () => {
  it("counts only real runs for the capability and reports the last use", () => {
    state.tables["chat-processing-runs"] = [
      { userMessageId: "msg_1", serviceType: "contract_review", error: null, createdAt: NOW() },
      { userMessageId: "msg_2", serviceType: "contract_review", error: "timeout", createdAt: NOW() },
      { userMessageId: "msg_3", serviceType: "legal_consultation", error: null, createdAt: NOW() },
    ];
    const impact = bindingImpact({
      serviceType: "contract_review",
      providerId: "prov-openai",
      model: "gpt-4o-mini",
    });
    expect(impact.requests).toBe(2);
    expect(impact.errors).toBe(1);
    expect(impact.lastUsedAt).not.toBeNull();
    expect(impact.nextProviderNameFa).toBe("اوپن‌ای‌آی");
    expect(impact.impactFa.some((l) => l.includes("۲ درخواست"))).toBe(true);
  });

  it("says when a model is outside the announced catalogue", () => {
    const impact = bindingImpact({
      serviceType: "contract_review",
      providerId: "prov-openai",
      model: "gpt-9-imaginary",
    });
    expect(impact.impactFa.some((l) => l.includes("gpt-9-imaginary"))).toBe(true);
  });

  it("flags a provider with no key and one that is disabled", () => {
    state.providers = [providerRow({ hasKey: false })];
    const noKey = bindingImpact({
      serviceType: "contract_review",
      providerId: "prov-openai",
      model: null,
    });
    expect(noKey.impactFa.some((l) => l.includes("کلید API ثبت نشده"))).toBe(true);

    state.providers = [providerRow({ status: "disabled", enabled: false })];
    const disabled = bindingImpact({
      serviceType: "contract_review",
      providerId: "prov-openai",
      model: null,
    });
    expect(disabled.nextProviderDisabled).toBe(true);
    expect(disabled.impactFa.some((l) => l.includes("غیرفعال است"))).toBe(true);
  });

  it("says a null provider means the default provider (mock if nothing is live)", () => {
    const impact = bindingImpact({ serviceType: "contract_review", providerId: null, model: null });
    expect(impact.nextIsMock).toBe(true);
    expect(impact.impactFa.some((l) => l.includes("ارائه‌دهندهٔ پیش‌فرض"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Save / clear
// ---------------------------------------------------------------------------

describe("saveServiceBinding", () => {
  it("rejects an unknown capability without writing", () => {
    const res = saveServiceBinding(
      { serviceType: "nope", providerId: null, model: null, updatedBy: "staff-1" },
      META
    );
    expect(res).toEqual({ ok: false, error: "INVALID_CAPABILITY", messageFa: expect.any(String) });
    expect(state.tables["ai_service_bindings"]).toBeUndefined();
  });

  it("rejects a provider that does not exist", () => {
    const res = saveServiceBinding(
      { serviceType: "contract_review", providerId: "ghost", model: null, updatedBy: "staff-1" },
      META
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("PROVIDER_NOT_FOUND");
  });

  it("rejects a fallback equal to the primary provider", () => {
    const res = saveServiceBinding(
      {
        serviceType: "contract_review",
        providerId: "prov-openai",
        fallbackProviderId: "prov-openai",
        model: null,
        updatedBy: "staff-1",
      },
      META
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("FALLBACK_EQUALS_PRIMARY");
  });

  it("rejects a model outside the announced catalogue", () => {
    const res = saveServiceBinding(
      {
        serviceType: "contract_review",
        providerId: "prov-openai",
        model: "gpt-9-imaginary",
        updatedBy: "staff-1",
      },
      META
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("MODEL_NOT_IN_CATALOGUE");
  });

  it("rejects out-of-range limits and temperature", () => {
    const base = {
      serviceType: "contract_review",
      providerId: "prov-openai",
      model: "gpt-4o-mini",
      updatedBy: "staff-1",
    };
    const timeout = saveServiceBinding({ ...base, timeoutMs: 500 }, META);
    const tokens = saveServiceBinding({ ...base, maxOutputTokens: 500_000 }, META);
    const temp = saveServiceBinding({ ...base, temperature: 3 }, META);
    expect([timeout, tokens, temp].map((r) => (r.ok ? "ok" : r.error))).toEqual([
      "INVALID_TIMEOUT",
      "INVALID_MAX_TOKENS",
      "INVALID_TEMPERATURE",
    ]);
  });

  it("rejects a knowledge source that does not exist", () => {
    const res = saveServiceBinding(
      {
        serviceType: "contract_review",
        providerId: "prov-openai",
        model: "gpt-4o-mini",
        knowledgeSourceIds: ["law-civil-1", "ghost-source"],
        updatedBy: "staff-1",
      },
      META
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("UNKNOWN_KNOWLEDGE_SOURCE");
  });

  it("stores an explicit empty scope (retrieval off) and keeps it distinct from null", () => {
    const res = saveServiceBinding(
      {
        serviceType: "contract_review",
        providerId: "prov-openai",
        model: "gpt-4o-mini",
        knowledgeSourceIds: [],
        updatedBy: "staff-1",
      },
      META
    );
    expect(res.ok).toBe(true);
    expect(getServiceBinding("contract_review")?.knowledgeSourceIds).toEqual([]);
  });

  it("de-duplicates a knowledge scope and keeps one row per capability", () => {
    saveServiceBinding(
      {
        serviceType: "contract_review",
        providerId: "prov-openai",
        model: "gpt-4o-mini",
        knowledgeSourceIds: ["law-civil-1", "law-civil-1"],
        updatedBy: "staff-1",
      },
      META
    );
    saveServiceBinding(
      {
        serviceType: "contract_review",
        providerId: "prov-openai",
        model: "gpt-4o-mini",
        updatedBy: "staff-1",
      },
      META
    );
    expect(state.tables["ai_service_bindings"]!.length).toBe(1);
  });

  it("audits before/after plus the impact facts the operator was shown", () => {
    state.tables["chat-processing-runs"] = [
      { userMessageId: "m1", serviceType: "contract_review", createdAt: NOW() },
      { userMessageId: "m2", serviceType: "contract_review", error: "boom", createdAt: NOW() },
    ];
    const res = saveServiceBinding(
      {
        serviceType: "contract_review",
        providerId: "prov-openai",
        model: "gpt-4o-mini",
        updatedBy: "staff-1",
      },
      META
    );
    expect(res.ok).toBe(true);
    const event = state.audits[0]!;
    expect(event["action"]).toBe("ai.binding.update");
    expect(event["before"]).toBeNull();
    expect(event["after"]).toMatchObject({
      providerId: "prov-openai",
      model: "gpt-4o-mini",
      status: "active",
      affectedRequests: 2,
      affectedErrors: 1,
    });
  });

  it("labels a status transition as activate/deactivate in the audit", () => {
    saveServiceBinding(
      {
        serviceType: "contract_review",
        providerId: "prov-openai",
        model: "gpt-4o-mini",
        updatedBy: "staff-1",
      },
      META
    );
    saveServiceBinding(
      {
        serviceType: "contract_review",
        providerId: "prov-openai",
        model: "gpt-4o-mini",
        status: "inactive",
        updatedBy: "staff-1",
      },
      META
    );
    expect(state.audits[1]!["action"]).toBe("ai.binding.deactivate");
    expect(state.audits[1]!["before"]).toMatchObject({ status: "active" });
    expect(state.audits[1]!["after"]).toMatchObject({ status: "inactive" });
  });

  it("keeps the stored status when a partial save omits it", () => {
    saveServiceBinding(
      {
        serviceType: "contract_review",
        providerId: "prov-openai",
        model: "gpt-4o-mini",
        status: "inactive",
        updatedBy: "staff-1",
      },
      META
    );
    saveServiceBinding(
      {
        serviceType: "contract_review",
        providerId: "prov-openai",
        model: "gpt-4o-mini",
        updatedBy: "staff-1",
      },
      META
    );
    expect(getServiceBinding("contract_review")?.status).toBe("inactive");
  });
});

describe("clearServiceBinding", () => {
  it("returns false when nothing is bound", () => {
    expect(clearServiceBinding("contract_review", "staff-1", META)).toBe(false);
    expect(state.audits.length).toBe(0);
  });

  it("removes the row and audits the removal", () => {
    saveServiceBinding(
      {
        serviceType: "contract_review",
        providerId: "prov-openai",
        model: "gpt-4o-mini",
        updatedBy: "staff-1",
      },
      META
    );
    state.audits = [];
    expect(clearServiceBinding("contract_review", "staff-1", META)).toBe(true);
    expect(getServiceBinding("contract_review")).toBeNull();
    expect(state.audits[0]).toMatchObject({
      action: "ai.binding.clear",
      resourceId: "contract_review",
      after: null,
    });
  });
});

// ---------------------------------------------------------------------------
// Runtime resolution — the documented fall-through order
// ---------------------------------------------------------------------------

describe("resolveEffectiveProvider", () => {
  const env = { model: "env-model", apiKey: "env-key", baseUrl: "https://env" };

  function bind(providerId: string | null, extra: Record<string, unknown> = {}) {
    saveServiceBinding(
      {
        serviceType: "contract_review",
        providerId,
        model: "gpt-4o-mini",
        updatedBy: "staff-1",
        ...extra,
      },
      META
    );
  }

  it("uses an active binding whose provider holds credentials", () => {
    bind("prov-openai");
    const eff = resolveEffectiveProvider("contract_review", env);
    expect(eff.source).toBe("binding");
    expect(eff.providerId).toBe("prov-openai");
    expect(eff.apiKey).toBe("sk-test");
    expect(eff.mock).toBe(false);
    expect(eff.degradedReasonFa).toBeNull();
  });

  it("falls to the fallback provider and says so", () => {
    state.providers = [
      providerRow(),
      providerRow({ id: "prov-backup", nameFa: "پشتیبان", isDefault: false }),
    ];
    state.credentials = { "prov-backup": credentials("prov-backup", { nameFa: "پشتیبان" }) };
    bind("prov-openai", { fallbackProviderId: "prov-backup" });
    const eff = resolveEffectiveProvider("contract_review", env);
    expect(eff.source).toBe("binding");
    expect(eff.providerId).toBe("prov-backup");
    expect(eff.degradedReasonFa).toContain("پشتیبان");
  });

  it("falls to the default when neither primary nor fallback can serve", () => {
    state.credentials = {};
    state.runtime = { model: "default-model", apiKey: "default-key", baseUrl: "https://default" };
    bind("prov-openai");
    const eff = resolveEffectiveProvider("contract_review", env);
    expect(eff.source).toBe("default");
    expect(eff.model).toBe("default-model");
    expect(eff.degradedReasonFa).not.toBeNull();
    expect(eff.binding).not.toBeNull();
  });

  it("skips an inactive binding entirely", () => {
    state.runtime = { model: "default-model", apiKey: "default-key", baseUrl: "https://default" };
    bind("prov-openai", { status: "inactive" });
    const eff = resolveEffectiveProvider("contract_review", env);
    expect(eff.source).toBe("default");
    expect(eff.degradedReasonFa).toBeNull();
  });

  it("uses the environment, then the mock, when nothing is configured", () => {
    const live = resolveEffectiveProvider(null, env);
    expect(live.source).toBe("environment");
    expect(live.mock).toBe(false);

    const dry = resolveEffectiveProvider(null, { model: "", apiKey: null, baseUrl: "" });
    expect(dry.source).toBe("mock");
    expect(dry.mock).toBe(true);
    expect(dry.model).toBe("legalir-mock-v1");
  });
});

// ---------------------------------------------------------------------------
// Usage split — only real recorded work, unattributed counted honestly
// ---------------------------------------------------------------------------

describe("getAiUsageBreakdown", () => {
  const OLD = new Date(Date.now() - 400 * 86_400_000).toISOString();

  function run(userMessageId: string, serviceType: string, error: string | null = null) {
    return { userMessageId, serviceType, status: "completed", error, createdAt: NOW() };
  }

  function tx(overrides: Record<string, unknown> = {}) {
    return {
      id: `tx-${Math.random()}`,
      activityType: "AI_MESSAGE",
      status: "COMPLETED",
      providerId: "prov-openai",
      provider: "openai-compatible",
      model: "gpt-4o-mini",
      inputTokens: 120,
      outputTokens: 80,
      relatedEntityId: "msg_1",
      createdAt: NOW(),
      ...overrides,
    };
  }

  it("counts requests and errors from the runs that executed", () => {
    state.tables["chat-processing-runs"] = [
      run("msg_1", "contract_review"),
      run("msg_2", "contract_review", "timeout"),
      run("msg_3", "legal_consultation"),
    ];
    const out = getAiUsageBreakdown(30);
    expect(out.totalRequests).toBe(3);
    const review = out.byService.find((r) => r.key === "contract_review")!;
    expect(review.requests).toBe(2);
    expect(review.errors).toBe(1);
  });

  it("attributes tokens to the configured provider row, model and capability", () => {
    state.tables["chat-processing-runs"] = [run("msg_1", "contract_review")];
    state.tables["usage_transactions"] = [tx()];
    const out = getAiUsageBreakdown(30);
    expect(out.attributionAvailable).toBe(true);
    expect(out.totalTokens).toBe(200);
    expect(out.byProvider[0]).toMatchObject({
      key: "prov-openai",
      labelFa: "اوپن‌ای‌آی",
      totalTokens: 200,
      requests: 1,
    });
    expect(out.byModel[0]).toMatchObject({ key: "gpt-4o-mini", totalTokens: 200 });
    expect(out.byService.find((r) => r.key === "contract_review")?.totalTokens).toBe(200);
    expect(out.unattributedRequests).toBe(0);
    expect(out.unattributedServiceRequests).toBe(0);
  });

  it("labels a legacy protocol-only ledger row instead of guessing a provider", () => {
    state.tables["chat-processing-runs"] = [run("msg_1", "contract_review")];
    state.tables["usage_transactions"] = [tx({ providerId: null, provider: "openai" })];
    const out = getAiUsageBreakdown(30);
    expect(out.byProvider[0]!.key).toBe("protocol:openai");
    expect(out.byProvider[0]!.labelFa).toContain("پروتکل openai");
    expect(out.byProvider[0]!.labelFa).toContain("بدون ارائه‌دهندهٔ ثبت‌شده");
  });

  it("counts a charge with no provider as unattributed, not as a bucket", () => {
    state.tables["chat-processing-runs"] = [run("msg_1", "contract_review")];
    state.tables["usage_transactions"] = [tx({ providerId: null, provider: null })];
    const out = getAiUsageBreakdown(30);
    expect(out.unattributedRequests).toBe(1);
    expect(out.byProvider).toHaveLength(0);
    // Tokens still reconcile into the total and the model/day splits.
    expect(out.totalTokens).toBe(200);
  });

  it("counts a charge that cannot be tied to a run as an unattributed service", () => {
    state.tables["chat-processing-runs"] = [run("msg_1", "contract_review")];
    state.tables["usage_transactions"] = [tx({ relatedEntityId: "missing-message" })];
    const out = getAiUsageBreakdown(30);
    expect(out.unattributedServiceRequests).toBe(1);
    const unknown = out.byService.find((r) => r.key === "__unknown__")!;
    expect(unknown.labelFa).toBe("بدون قابلیت قابل‌شناسایی");
    expect(unknown.totalTokens).toBe(200);
  });

  it("ignores non-AI, non-completed and out-of-window ledger rows", () => {
    state.tables["chat-processing-runs"] = [
      run("msg_1", "contract_review"),
      { ...run("msg_5", "contract_review"), createdAt: OLD },
    ];
    state.tables["usage_transactions"] = [
      tx(),
      tx({ activityType: "DOCUMENT_ANALYSIS" }),
      tx({ status: "REFUNDED" }),
      tx({ createdAt: OLD }),
    ];
    const out = getAiUsageBreakdown(30);
    expect(out.totalRequests).toBe(1);
    expect(out.totalTokens).toBe(200);
    expect(out.byProvider[0]!.requests).toBe(1);
  });

  it("reports attribution unavailable when nothing settles", () => {
    state.tables["chat-processing-runs"] = [run("msg_1", "contract_review")];
    const out = getAiUsageBreakdown(7);
    expect(out.rangeDays).toBe(7);
    expect(out.attributionAvailable).toBe(false);
    expect(out.byProvider).toHaveLength(0);
    expect(out.byDay).toHaveLength(1);
  });
});
