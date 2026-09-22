// ============================================================
// LEGALIR — Live processing-run projection (isomorphic, client-safe)
// ============================================================
// Builds and advances a `ProcessingRunView` from the pipeline SSE events.
// This is the client-side mirror of the server's `toRunView`: the UI holds
// one run object and folds each backend event into it, so the timeline is
// always a projection of real backend state — never a client-side timer.
//
// Kept free of server imports so it can run in the browser and in tests.
// ============================================================

import { PROCESSING_STAGES } from "@legalir/types";
import type {
  ProcessingRunView,
  ProcessingStage,
  ProcessingStageView,
  StageStatus,
} from "@legalir/types";
import { STAGE_CONFIG } from "./stages";
import type { PipelineProgress } from "@/lib/ai/stream-client";

/** A fresh run, with Stage 1 active — mirrors the server's `createRun`. */
export function createLiveRun(conversationId: string): ProcessingRunView {
  const steps: ProcessingStageView[] = PROCESSING_STAGES.map((stage) => ({
    stage,
    order: STAGE_CONFIG[stage].order,
    status: stage === "IDENTIFY" ? "ACTIVE" : "PENDING",
    startedAt: null,
    completedAt: null,
  }));

  return {
    id: "",
    conversationId,
    status: "running",
    currentStage: "IDENTIFY",
    steps,
    pendingQuestions: [],
    sourcesUsed: 0,
    requiresLawyerReview: false,
    errorMessage: null,
    retryable: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

/**
 * Fold one pipeline event into the run, returning a new run. Pure — the
 * caller replaces its state with the result.
 */
export function applyPipelineEvent(
  run: ProcessingRunView,
  p: PipelineProgress
): ProcessingRunView {
  const next: ProcessingRunView = {
    ...run,
    steps: run.steps.map((s) => ({ ...s })),
  };

  if (p.requestId) next.id = p.requestId;

  if (p.stage && p.status) {
    next.currentStage = p.stage;
    next.steps = next.steps.map((s) =>
      s.stage === p.stage ? { ...s, status: p.status as StageStatus } : s
    );
  }

  if (typeof p.sourcesUsed === "number") {
    next.sourcesUsed = p.sourcesUsed;
    next.steps = next.steps.map((s) =>
      s.stage === "RESEARCH" ? { ...s, sourcesUsed: p.sourcesUsed } : s
    );
  }

  if (typeof p.requiresLawyerReview === "boolean") {
    next.requiresLawyerReview = p.requiresLawyerReview;
  }

  if (p.pendingQuestions) {
    next.pendingQuestions = p.pendingQuestions;
  }

  // A stage entering WAITING puts the whole run into the waiting state; a
  // later stage starting clears it (the user answered and the run resumed).
  if (p.status === "WAITING") {
    next.status = "waiting";
  } else if (p.status === "ACTIVE" && next.status === "waiting") {
    next.status = "running";
    next.pendingQuestions = [];
  }

  if (p.status === "FAILED") {
    next.status = "failed";
    next.errorMessage = p.message ?? "در پردازش درخواست مشکلی ایجاد شد.";
    next.retryable = p.retryable ?? true;
    next.completedAt = new Date().toISOString();
  }

  return next;
}

/** Mark a run completed (the stream's `done` event). */
export function completeLiveRun(run: ProcessingRunView): ProcessingRunView {
  return {
    ...run,
    status: "completed",
    pendingQuestions: [],
    steps: run.steps.map((s) =>
      s.status === "ACTIVE" ? { ...s, status: "COMPLETED" as StageStatus } : s
    ),
    completedAt: new Date().toISOString(),
  };
}

/** Mark a run failed with a user-safe message. */
export function failLiveRun(
  run: ProcessingRunView,
  message: string,
  retryable = true
): ProcessingRunView {
  return {
    ...run,
    status: "failed",
    errorMessage: message,
    retryable,
    completedAt: new Date().toISOString(),
  };
}

/** Mark a run cancelled (the user pressed stop). */
export function cancelLiveRun(run: ProcessingRunView): ProcessingRunView {
  return {
    ...run,
    status: "cancelled",
    pendingQuestions: [],
    completedAt: new Date().toISOString(),
  };
}

/** True when the run is still in flight (not terminal). */
export function isRunActive(run: ProcessingRunView | null): boolean {
  return run?.status === "running" || run?.status === "waiting";
}

/** The stage currently being worked on, or null when none is active. */
export function activeStage(run: ProcessingRunView): ProcessingStage | null {
  return run.steps.find((s) => s.status === "ACTIVE")?.stage ?? null;
}
