// ============================================================
// LEGALIR — Centralized React Query Cache Keys
// ============================================================
// All query keys MUST be generated through this factory.
// This ensures consistent cache invalidation and prevents
// stale data caused by mismatched key patterns.
// ============================================================

import type {
  V1DocumentListParams,
  V1ContractListParams,
  V1ContractType,
} from "@legalir/types";

// --- Top-level domains as const arrays ---

export const queryKeys = {
  // --- Auth & User ---
  me: ["me"] as const,
  profile: ["me", "profile"] as const,
  preferences: ["preferences"] as const,

  // --- Dashboard ---
  dashboard: {
    summary: ["dashboard", "summary"] as const,
  },

  // --- Usage ---
  usage: {
    summary: ["usage", "summary"] as const,
  },
  profileUsage: ["profile", "usage"] as const,

  // --- Activities ---
  activities: {
    recent: (page: number, pageSize: number) =>
      ["activities", "recent", page, pageSize] as const,
  },

  // --- Plans & Subscription ---
  plans: ["v1", "plans"] as const,
  subscriptions: {
    current: ["v1", "subscriptions", "current"] as const,
    history: (page: number, pageSize: number) =>
      ["subscription-history", page, pageSize] as const,
    all: ["v1", "subscriptions"] as const,
  },
  entitlements: ["v1", "entitlements"] as const,
  usageV1: ["v1", "usage"] as const,

  // --- Checkout ---
  checkout: {
    intent: (intentId: string | null) =>
      ["v1", "checkout", "intents", intentId] as const,
  },

  // --- Conversations ---
  conversations: {
    list: (page: number, pageSize: number) =>
      ["conversations", page, pageSize] as const,
    all: ["conversations"] as const,
    detail: (id: string | undefined) => ["conversation", id] as const,
    references: (conversationId: string | undefined) =>
      ["conversation-references", conversationId] as const,
  },

  // --- AI Runs ---
  aiRuns: {
    detail: (id: string | undefined) => ["ai-run", id] as const,
    all: ["ai-run"] as const,
  },

  // --- Sources ---
  sources: {
    detail: (id: string | undefined) => ["source", id] as const,
    versions: (id: string | undefined) => ["source-versions", id] as const,
  },

  // --- Document Citations ---
  citations: {
    document: (documentId: string | undefined) =>
      ["document-citations", documentId] as const,
  },

  // --- Documents ---
  documents: {
    list: (params: V1DocumentListParams = {}) =>
      ["documents", "list", params] as const,
    allLists: ["documents", "list"] as const,
    detail: (id: string | undefined) =>
      ["documents", "detail", id] as const,
    status: (id: string | undefined) =>
      ["documents", "status", id] as const,
    analysis: (id: string | undefined) =>
      ["documents", "analysis", id] as const,
  },

  // --- Contracts ---
  contracts: {
    types: ["contract-types"] as const,
    questions: (typeId: V1ContractType | undefined) =>
      ["contract-questions", typeId] as const,
    list: (params: V1ContractListParams = {}) =>
      ["contracts", "list", params] as const,
    allLists: ["contracts", "list"] as const,
    detail: (id: string | undefined) =>
      ["contracts", "detail", id] as const,
    versions: (id: string | undefined) =>
      ["contracts", "versions", id] as const,
    analysis: (id: string | undefined) =>
      ["contracts", "analysis", id] as const,
    draft: (typeId: V1ContractType | undefined) =>
      ["contract-draft", typeId] as const,
  },

  // --- History ---
  history: (params: Record<string, unknown> = {}) =>
    ["history", params] as const,

  // --- Memory ---
  memories: {
    list: ["memories"] as const,
  },

  // --- Subscription History ---
  subscriptionHistory: (page: number, pageSize: number) =>
    ["subscription-history", page, pageSize] as const,
} as const;
