// ============================================================
// LEGALIR — Environment Validation (Zod)
// Separates browser-safe (NEXT_PUBLIC_*) from server-only values.
// Uses bracket notation for process.env due to noUncheckedIndexedAccess.
// ============================================================

import { z } from "zod";

// --- Browser-safe values (prefixed NEXT_PUBLIC_, exposed to client) ---

export const browserEnvSchema = z.object({
  NEXT_PUBLIC_API_MODE: z
    .enum(["mock", "hybrid", "real-dev", "preview", "staging"])
    .default("mock"),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:8000"),
  NEXT_PUBLIC_FEATURE_DOCUMENT_ANALYSIS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  NEXT_PUBLIC_FEATURE_CONTRACT_WORKSPACE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  NEXT_PUBLIC_FEATURE_MEMORY: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  NEXT_PUBLIC_FEATURE_ENGLISH_LOCALE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  NEXT_PUBLIC_OTP_DEV_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type BrowserEnv = z.infer<typeof browserEnvSchema>;

// --- Server-only values (NOT prefixed, never exposed to client) ---

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SESSION_SECRET: z.string().min(32).optional(),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ENDPOINT: z.string().url().optional(),
  AI_PROVIDER_API_KEY: z.string().optional(),
  OTP_PROVIDER_API_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

// --- Parse helpers ---

const env = typeof process !== "undefined" ? process.env : {} as Record<string, string | undefined>;

export function validateBrowserEnv(): BrowserEnv {
  const raw = {
    NEXT_PUBLIC_API_MODE: env["NEXT_PUBLIC_API_MODE"],
    NEXT_PUBLIC_API_BASE_URL: env["NEXT_PUBLIC_API_BASE_URL"],
    NEXT_PUBLIC_FEATURE_DOCUMENT_ANALYSIS: env["NEXT_PUBLIC_FEATURE_DOCUMENT_ANALYSIS"],
    NEXT_PUBLIC_FEATURE_CONTRACT_WORKSPACE:
      env["NEXT_PUBLIC_FEATURE_CONTRACT_WORKSPACE"],
    NEXT_PUBLIC_FEATURE_MEMORY: env["NEXT_PUBLIC_FEATURE_MEMORY"],
    NEXT_PUBLIC_FEATURE_ENGLISH_LOCALE: env["NEXT_PUBLIC_FEATURE_ENGLISH_LOCALE"],
    NEXT_PUBLIC_OTP_DEV_MODE: env["NEXT_PUBLIC_OTP_DEV_MODE"],
  };

  const result = browserEnvSchema.safeParse(raw);

  if (!result.success) {
    if (env["NODE_ENV"] === "production") {
      console.error("Environment validation failed:", result.error.flatten().fieldErrors);
      throw new Error("Invalid environment configuration");
    }
    console.warn(
      "[env] Browser environment validation warnings:",
      result.error.flatten().fieldErrors
    );
    return browserEnvSchema.parse(raw);
  }

  return result.data;
}

export function validateServerEnv(): ServerEnv {
  const raw = {
    NODE_ENV: env["NODE_ENV"],
    SESSION_SECRET: env["SESSION_SECRET"],
    DATABASE_URL: env["DATABASE_URL"],
    REDIS_URL: env["REDIS_URL"],
    STORAGE_ACCESS_KEY: env["STORAGE_ACCESS_KEY"],
    STORAGE_SECRET_KEY: env["STORAGE_SECRET_KEY"],
    STORAGE_BUCKET: env["STORAGE_BUCKET"],
    STORAGE_ENDPOINT: env["STORAGE_ENDPOINT"],
    AI_PROVIDER_API_KEY: env["AI_PROVIDER_API_KEY"],
    OTP_PROVIDER_API_KEY: env["OTP_PROVIDER_API_KEY"],
  };

  return serverEnvSchema.parse(raw);
}
