import { describe, it, expect } from "vitest";
import { browserEnvSchema, serverEnvSchema } from "@legalir/config";

describe("browserEnvSchema", () => {
  it("parses a minimal valid config with defaults", () => {
    const result = browserEnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_API_MODE).toBe("mock");
      expect(result.data.NEXT_PUBLIC_API_BASE_URL).toBe("http://localhost:8000");
      expect(result.data.NEXT_PUBLIC_FEATURE_DOCUMENT_ANALYSIS).toBe(true);
      expect(result.data.NEXT_PUBLIC_FEATURE_ENGLISH_LOCALE).toBe(false);
    }
  });

  it("rejects invalid API mode", () => {
    const result = browserEnvSchema.safeParse({ NEXT_PUBLIC_API_MODE: "invalid" });
    expect(result.success).toBe(false);
  });

  it("transforms string booleans", () => {
    const result = browserEnvSchema.safeParse({ NEXT_PUBLIC_FEATURE_MEMORY: "false" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_FEATURE_MEMORY).toBe(false);
    }
  });
});

describe("serverEnvSchema", () => {
  it("parses NODE_ENV", () => {
    const result = serverEnvSchema.safeParse({ NODE_ENV: "test" });
    expect(result.success).toBe(true);
  });

  it("requires minimum 32 chars for SESSION_SECRET if provided", () => {
    const resultShort = serverEnvSchema.safeParse({
      NODE_ENV: "development",
      SESSION_SECRET: "short",
    });
    expect(resultShort.success).toBe(false);

    const resultOk = serverEnvSchema.safeParse({
      NODE_ENV: "development",
      SESSION_SECRET: "a".repeat(32),
    });
    expect(resultOk.success).toBe(true);
  });
});
