// ============================================================
// LEGALIR — Admin AI provider lifecycle (hermetic)
// ============================================================
// Pins the provider-enable / model-catalogue behaviour the AI panel uses:
//   • a disabled provider NEVER serves traffic, even with a valid key;
//   • disabling the default leaves no default (the router says so rather
//     than pretending another provider took over);
//   • the declared catalogue always includes the model that is in use;
//   • a partial save keeps the stored lifecycle instead of re-enabling it;
//   • a key is never returned — only `hasKey` and a masked hint.
//
// `@/lib/db` and the secret store are mocked so the suite is hermetic: no
// real table is touched and no ciphertext is produced or read.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

interface FakeSecret {
  v: number;
  iv: string;
  tag: string;
  ciphertext: string;
  hint: string;
}

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  writes: 0,
  secretReady: true,
}));

vi.mock("@/lib/db", () => ({
  readTable: () => state.rows,
  writeTable: (_name: string, rows: unknown[]) => {
    state.rows = rows as Record<string, unknown>[];
    state.writes += 1;
  },
}));

vi.mock("@/lib/admin/secrets", () => ({
  isSecretStorageConfigured: () => state.secretReady,
  encryptSecret: (raw: string): FakeSecret | null =>
    state.secretReady
      ? { v: 1, iv: "iv", tag: "tag", ciphertext: `enc:${raw}`, hint: `••••${raw.slice(-4)}` }
      : null,
  decryptSecret: (stored: FakeSecret | null) =>
    stored ? stored.ciphertext.replace(/^enc:/, "") : null,
  maskSecret: (raw: string) => `••••${raw.slice(-4)}`,
}));

import {
  getAiProvider,
  listAiProviders,
  resolveProviderCredentials,
  resolveRuntimeAiConfig,
  saveAiProvider,
  setAiProviderEnabled,
} from "@/lib/admin/ai-providers";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    nameFa: "اوپن‌ای‌آی",
    kind: "openai" as const,
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    embeddingModel: null,
    timeoutMs: 30_000,
    maxOutputTokens: 2048,
    isDefault: true,
    updatedBy: "staff-1",
    ...overrides,
  };
}

function seeded(overrides: Record<string, unknown> = {}) {
  state.rows = [
    {
      id: "ai-prov-1",
      nameFa: "اوپن‌ای‌آی",
      kind: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      embeddingModel: null,
      timeoutMs: 30_000,
      maxOutputTokens: 2048,
      isDefault: true,
      isTestOverride: false,
      enabled: true,
      defaultModel: "gpt-4o-mini",
      availableModels: ["gpt-4o-mini", "gpt-4o"],
      configuration: {},
      lastTestAt: null,
      lastTestOk: null,
      lastTestLatencyMs: null,
      updatedBy: "staff-1",
      updatedAt: "2026-10-20T08:00:00.000Z",
      createdAt: "2026-10-20T08:00:00.000Z",
      secret: { v: 1, iv: "iv", tag: "tag", ciphertext: "enc:sk-abcd", hint: "••••abcd" },
      ...overrides,
    },
  ];
}

beforeEach(() => {
  state.rows = [];
  state.writes = 0;
  state.secretReady = true;
});

// ---------------------------------------------------------------------------
// Public projection — the key is never returned
// ---------------------------------------------------------------------------

describe("listAiProviders", () => {
  it("seeds the environment row when the table is empty", () => {
    const rows = listAiProviders();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("ai-env-default");
    expect(state.writes).toBe(1);
  });

  it("never returns the ciphertext — only hasKey and a masked hint", () => {
    seeded();
    const [p] = listAiProviders();
    expect(p).toMatchObject({ hasKey: true, keyHint: "••••abcd", status: "configured" });
    expect(JSON.stringify(p)).not.toContain("enc:");
    expect(JSON.stringify(p)).not.toContain("ciphertext");
  });

  it("defaults additive fields on READ so a legacy row needs no rewrite", () => {
    seeded({
      enabled: undefined,
      availableModels: undefined,
      defaultModel: undefined,
      configuration: undefined,
    });
    const [p] = listAiProviders();
    expect(p!.enabled).toBe(true);
    expect(p!.availableModels).toEqual(["gpt-4o-mini"]);
    expect(p!.defaultModel).toBe("gpt-4o-mini");
    expect(p!.configuration).toEqual({});
    expect(state.writes).toBe(0);
  });

  it("reports a disabled provider as disabled even when it holds a key", () => {
    seeded({ enabled: false });
    const [p] = listAiProviders();
    expect(p!.status).toBe("disabled");
    expect(p!.hasKey).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Save — catalogue + lifecycle
// ---------------------------------------------------------------------------

describe("saveAiProvider", () => {
  it("rejects an empty name, out-of-range timeout and out-of-range tokens", () => {
    expect(saveAiProvider(baseInput({ nameFa: "  " }))).toEqual({ error: "NAME_REQUIRED" });
    expect(saveAiProvider(baseInput({ timeoutMs: 500 }))).toEqual({ error: "INVALID_TIMEOUT" });
    expect(saveAiProvider(baseInput({ maxOutputTokens: 0 }))).toEqual({
      error: "INVALID_MAX_TOKENS",
    });
    expect(state.writes).toBe(0);
  });

  it("refuses to store a key when secret storage is not configured", () => {
    state.secretReady = false;
    expect(saveAiProvider(baseInput({ apiKey: "sk-1234" }))).toEqual({
      error: "SECRET_STORAGE_UNCONFIGURED",
    });
    expect(state.writes).toBe(0);
  });

  it("always includes the model in use in the declared catalogue", () => {
    const saved = saveAiProvider(
      baseInput({ model: "gpt-4o", availableModels: ["gpt-4o-mini", "gpt-4o-mini", ""] })
    );
    if ("error" in saved) throw new Error(saved.error);
    expect(getAiProvider(saved.id)!.availableModels).toEqual(["gpt-4o", "gpt-4o-mini"]);
  });

  it("drops secret-looking keys from the non-secret configuration", () => {
    const saved = saveAiProvider(
      baseInput({ configuration: { region: "eu", apiKey: "leak", token: "leak", note: " ok " } })
    );
    if ("error" in saved) throw new Error(saved.error);
    expect(getAiProvider(saved.id)!.configuration).toEqual({ region: "eu", note: "ok" });
  });

  it("keeps the stored lifecycle when a partial save omits `enabled`", () => {
    seeded({ enabled: false, isDefault: false });
    saveAiProvider(baseInput({ id: "ai-prov-1", enabled: undefined, isDefault: false }));
    expect(listAiProviders()[0]!.enabled).toBe(false);
  });

  it("cannot mark a disabled provider as the default router", () => {
    const saved = saveAiProvider(baseInput({ enabled: false, isDefault: true }));
    if ("error" in saved) throw new Error(saved.error);
    expect(saved.enabled).toBe(false);
    expect(saved.isDefault).toBe(false);
  });

  it("clears the default flag on every other provider when a new default is saved", () => {
    seeded();
    state.rows.push({ ...state.rows[0], id: "ai-prov-2", nameFa: "دومی", isDefault: false });
    saveAiProvider(baseInput({ id: "ai-prov-2", nameFa: "دومی", isDefault: true }));
    expect(listAiProviders().filter((p) => p.isDefault).map((p) => p.id)).toEqual(["ai-prov-2"]);
  });

  it("encrypts a new key and stores only the ciphertext", () => {
    const saved = saveAiProvider(baseInput({ apiKey: "sk-9999" }));
    if ("error" in saved) throw new Error(saved.error);
    const stored = state.rows.find((r) => r["id"] === saved.id)!;
    expect(stored["secret"]).toMatchObject({ ciphertext: "enc:sk-9999", hint: "••••9999" });
    expect(JSON.stringify(stored)).not.toContain('"sk-9999"');
  });
});

// ---------------------------------------------------------------------------
// Enable / disable
// ---------------------------------------------------------------------------

describe("setAiProviderEnabled", () => {
  it("toggles only the lifecycle flag and records who/when", () => {
    seeded();
    const res = setAiProviderEnabled("ai-prov-1", false, "staff-2");
    expect("error" in res).toBe(false);
    const row = state.rows[0]!;
    expect(row["enabled"]).toBe(false);
    expect(row["isDefault"]).toBe(false);
    expect(row["updatedBy"]).toBe("staff-2");
    // Limits, catalogue and the key are untouched by a lifecycle toggle.
    expect(row["model"]).toBe("gpt-4o-mini");
    expect(row["availableModels"]).toEqual(["gpt-4o-mini", "gpt-4o"]);
    expect(row["secret"]).not.toBeNull();
    expect(row["updatedAt"]).not.toBe("2026-10-20T08:00:00.000Z");
  });

  it("returns NOT_FOUND for an unknown provider without writing", () => {
    seeded();
    const before = state.writes;
    expect(setAiProviderEnabled("ghost", true, "staff-1")).toEqual({ error: "NOT_FOUND" });
    expect(state.writes).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Runtime routing — a disabled provider is never used
// ---------------------------------------------------------------------------

describe("resolveProviderCredentials", () => {
  it("returns null for a disabled provider even with a valid key", () => {
    seeded({ enabled: false });
    expect(resolveProviderCredentials("ai-prov-1")).toBeNull();
  });

  it("returns null when the key, URL or model is missing", () => {
    seeded({ secret: null });
    expect(resolveProviderCredentials("ai-prov-1")).toBeNull();
    seeded({ baseUrl: null });
    expect(resolveProviderCredentials("ai-prov-1")).toBeNull();
    seeded({ model: null });
    expect(resolveProviderCredentials("ai-prov-1")).toBeNull();
    expect(resolveProviderCredentials(null)).toBeNull();
  });

  it("decrypts the key for a live provider", () => {
    seeded();
    expect(resolveProviderCredentials("ai-prov-1")).toMatchObject({
      id: "ai-prov-1",
      apiKey: "sk-abcd",
      model: "gpt-4o-mini",
      timeoutMs: 30_000,
    });
  });
});

describe("resolveRuntimeAiConfig", () => {
  it("chooses the enabled default provider", () => {
    seeded();
    expect(resolveRuntimeAiConfig()).toMatchObject({
      providerId: "ai-prov-1",
      model: "gpt-4o-mini",
    });
  });

  it("skips a disabled default and picks the next enabled provider", () => {
    seeded({ enabled: false });
    state.rows.push({
      ...state.rows[0],
      id: "ai-prov-2",
      nameFa: "دومی",
      isDefault: false,
      enabled: true,
      secret: { v: 1, iv: "iv", tag: "tag", ciphertext: "enc:sk-efgh", hint: "••••efgh" },
    });
    expect(resolveRuntimeAiConfig()).toMatchObject({ providerId: "ai-prov-2" });
  });

  it("returns null when no provider is enabled — never a fabricated live config", () => {
    seeded({ enabled: false });
    expect(resolveRuntimeAiConfig()).toBeNull();
  });

  it("uses the operator's defaultModel for routing", () => {
    seeded({ defaultModel: "gpt-4o" });
    expect(resolveRuntimeAiConfig()!.model).toBe("gpt-4o");
  });
});
