// ============================================================
// LEGALIR — Pipeline run persistence (server-only)
// ============================================================
// Records one ChatProcessingRun per user message, with a per-stage status
// and latency. This is what makes the pipeline measurable: it answers
// "where is LEGALIR slow — retrieval, analysis, or response generation?"
//
// Stored in .data/chat-processing-runs.json through the shared JSON-DB
// primitives so it participates in the same mtime cache as every other
// table. Additive: no existing table is touched.
// ============================================================

import { readTable, writeTable } from "@/lib/db";
import { PROCESSING_STAGES } from "@legalir/types";
import type {
  ChatProcessingRun,
  ChatProcessingStage,
  ProcessingRunView,
  ProcessingStage,
  ProcessingStageView,
  StageStatus,
} from "@legalir/types";
import { STAGE_CONFIG } from "./stages";

const TABLE = "chat-processing-runs";

/** How many runs to retain — enough for benchmarking without unbounded growth. */
const MAX_RUNS = 500;

function emptyStage(stage: ProcessingStage): ChatProcessingStage {
  return {
    stage,
    status: "PENDING",
    startedAt: null,
    completedAt: null,
    latencyMs: null,
    metadata: {},
  };
}

function emptyStages(): Record<ProcessingStage, ChatProcessingStage> {
  const stages = {} as Record<ProcessingStage, ChatProcessingStage>;
  for (const s of PROCESSING_STAGES) stages[s] = emptyStage(s);
  return stages;
}

/** Create a new run in the `running` state, with Stage 1 already active. */
export function createRun(params: {
  id: string;
  conversationId: string;
  userId: string;
  userMessageId: string;
}): ChatProcessingRun {
  const now = new Date().toISOString();
  const stages = emptyStages();
  stages.IDENTIFY = { ...stages.IDENTIFY, status: "ACTIVE", startedAt: now };

  const run: ChatProcessingRun = {
    id: params.id,
    conversationId: params.conversationId,
    userId: params.userId,
    userMessageId: params.userMessageId,
    assistantMessageId: null,
    status: "running",
    currentStage: "IDENTIFY",
    stages,
    classification: null,
    sourcesUsed: 0,
    requiresLawyerReview: false,
    pendingQuestions: [],
    error: null,
    createdAt: now,
    startedAt: now,
    completedAt: null,
    totalLatencyMs: null,
  };

  const rows = readTable<ChatProcessingRun>(TABLE);
  rows.push(run);
  // Trim oldest runs once the cap is exceeded.
  const trimmed = rows.length > MAX_RUNS ? rows.slice(rows.length - MAX_RUNS) : rows;
  writeTable(TABLE, trimmed);
  return run;
}

export function getRun(id: string): ChatProcessingRun | undefined {
  return readTable<ChatProcessingRun>(TABLE).find((r) => r.id === id);
}

/**
 * The most recent run for a conversation, or undefined when none exists.
 * Used to restore the progress timeline after a refresh (§37, §43).
 */
export function getLatestRunForConversation(
  conversationId: string
): ChatProcessingRun | undefined {
  const runs = readTable<ChatProcessingRun>(TABLE).filter(
    (r) => r.conversationId === conversationId
  );
  if (runs.length === 0) return undefined;
  return runs.reduce((latest, r) =>
    r.createdAt.localeCompare(latest.createdAt) > 0 ? r : latest
  );
}

/**
 * Project a run to its user-safe view. Drops `metadata`, `classification`
 * and `userId` so no internal detail can leak to the browser, and maps the
 * internal error code to a human-readable Persian message.
 */
export function toRunView(run: ChatProcessingRun): ProcessingRunView {
  const steps: ProcessingStageView[] = PROCESSING_STAGES.map((stage) => {
    const s = run.stages[stage];
    const view: ProcessingStageView = {
      stage,
      order: STAGE_CONFIG[stage].order,
      status: s?.status ?? "PENDING",
      startedAt: s?.startedAt ?? null,
      completedAt: s?.completedAt ?? null,
    };
    if (stage === "RESEARCH" && run.sourcesUsed > 0) {
      view.sourcesUsed = run.sourcesUsed;
    }
    if (s?.status === "WAITING") view.requiresUserAction = true;
    return view;
  });

  return {
    id: run.id,
    conversationId: run.conversationId,
    status: run.status,
    currentStage: run.currentStage,
    steps,
    pendingQuestions: run.pendingQuestions ?? [],
    sourcesUsed: run.sourcesUsed,
    requiresLawyerReview: run.requiresLawyerReview,
    errorMessage: run.error ? userFacingError(run.error) : null,
    retryable: run.error === "PROVIDER_UNAVAILABLE" || run.error === "RETRIEVAL_FAILED",
    createdAt: run.createdAt,
    completedAt: run.completedAt,
  };
}

/** Map an internal error code to a user-safe Persian message (§40, §78). */
function userFacingError(code: string): string {
  switch (code) {
    case "RETRIEVAL_FAILED":
      return "در حال حاضر امکان بررسی منابع حقوقی وجود نداشت.";
    case "PROVIDER_UNAVAILABLE":
      return "در حال حاضر اتصال به سرویس هوشمند امکان‌پذیر نیست.";
    default:
      return "در پردازش درخواست مشکلی ایجاد شد.";
  }
}

/** Apply a partial update to a run and persist it. */
export function updateRun(
  id: string,
  patch: Partial<ChatProcessingRun>
): ChatProcessingRun | undefined {
  const rows = readTable<ChatProcessingRun>(TABLE);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return undefined;
  const next = { ...rows[idx]!, ...patch };
  rows[idx] = next;
  writeTable(TABLE, rows);
  return next;
}

/**
 * Mark a stage as started. Also sets it as the run's current stage and
 * closes out any earlier stage that is still ACTIVE (so a stage can never
 * be left dangling when the pipeline moves on).
 */
export function startStage(
  id: string,
  stage: ProcessingStage,
  metadata: Record<string, unknown> = {}
): ChatProcessingRun | undefined {
  const run = getRun(id);
  if (!run) return undefined;

  const now = new Date().toISOString();
  const stages = { ...run.stages };

  for (const s of PROCESSING_STAGES) {
    if (stages[s].status === "ACTIVE" && s !== stage) {
      stages[s] = {
        ...stages[s],
        status: "COMPLETED",
        completedAt: now,
        latencyMs: latencyFrom(stages[s].startedAt, now),
      };
    }
  }

  stages[stage] = {
    ...stages[stage],
    status: "ACTIVE",
    startedAt: stages[stage].startedAt ?? now,
    metadata: { ...stages[stage].metadata, ...metadata },
  };

  return updateRun(id, { stages, currentStage: stage, status: "running" });
}

/** Mark a stage as completed and record its latency. */
export function completeStage(
  id: string,
  stage: ProcessingStage,
  metadata: Record<string, unknown> = {}
): ChatProcessingRun | undefined {
  const run = getRun(id);
  if (!run) return undefined;

  const now = new Date().toISOString();
  const prev = run.stages[stage];
  const stages = {
    ...run.stages,
    [stage]: {
      ...prev,
      status: "COMPLETED" as StageStatus,
      startedAt: prev.startedAt ?? now,
      completedAt: now,
      latencyMs: latencyFrom(prev.startedAt ?? now, now),
      metadata: { ...prev.metadata, ...metadata },
    },
  };

  return updateRun(id, { stages });
}

/** Mark a stage as skipped (not needed for this request). */
export function skipStage(id: string, stage: ProcessingStage): ChatProcessingRun | undefined {
  const run = getRun(id);
  if (!run) return undefined;
  const stages = {
    ...run.stages,
    [stage]: { ...run.stages[stage], status: "SKIPPED" as StageStatus },
  };
  return updateRun(id, { stages });
}

/** Mark a stage as waiting on the user (clarification needed). */
export function waitStage(
  id: string,
  stage: ProcessingStage,
  metadata: Record<string, unknown> = {}
): ChatProcessingRun | undefined {
  const run = getRun(id);
  if (!run) return undefined;
  const questions = Array.isArray(metadata["pendingQuestions"])
    ? (metadata["pendingQuestions"] as string[])
    : run.pendingQuestions;
  const stages = {
    ...run.stages,
    [stage]: {
      ...run.stages[stage],
      status: "WAITING" as StageStatus,
      metadata: { ...run.stages[stage].metadata, ...metadata },
    },
  };
  return updateRun(id, {
    stages,
    status: "waiting",
    currentStage: stage,
    pendingQuestions: questions,
  });
}

/** Mark a stage as failed and fail the whole run. */
export function failStage(
  id: string,
  stage: ProcessingStage,
  error: string
): ChatProcessingRun | undefined {
  const run = getRun(id);
  if (!run) return undefined;
  const now = new Date().toISOString();
  const stages = {
    ...run.stages,
    [stage]: {
      ...run.stages[stage],
      status: "FAILED" as StageStatus,
      completedAt: now,
      latencyMs: latencyFrom(run.stages[stage].startedAt, now),
    },
  };
  return updateRun(id, {
    stages,
    status: "failed",
    currentStage: stage,
    error,
    pendingQuestions: [],
    completedAt: now,
    totalLatencyMs: latencyFrom(run.startedAt, now),
  });
}

/** Complete the whole run. */
export function completeRun(
  id: string,
  patch: Partial<ChatProcessingRun> = {}
): ChatProcessingRun | undefined {
  const run = getRun(id);
  if (!run) return undefined;
  const now = new Date().toISOString();
  return updateRun(id, {
    ...patch,
    status: "completed",
    pendingQuestions: [],
    completedAt: now,
    totalLatencyMs: latencyFrom(run.startedAt, now),
  });
}

/** Cancel a run (user pressed stop). */
export function cancelRun(id: string): ChatProcessingRun | undefined {
  const run = getRun(id);
  if (!run) return undefined;
  const now = new Date().toISOString();
  return updateRun(id, {
    status: "cancelled",
    completedAt: now,
    totalLatencyMs: latencyFrom(run.startedAt, now),
  });
}

function latencyFrom(startedAt: string | null, endedAt: string): number | null {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, end - start);
}
