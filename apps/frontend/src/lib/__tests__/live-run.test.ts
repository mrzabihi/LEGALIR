import { describe, it, expect } from "vitest";
import {
  createLiveRun,
  applyPipelineEvent,
  completeLiveRun,
  failLiveRun,
  cancelLiveRun,
  isRunActive,
  activeStage,
} from "../ai/pipeline/live-run";
import type { PipelineProgress } from "../ai/stream-client";

// ============================================================
// Live processing-run projection — Unit Tests
// Pins the client-side state machine that folds backend pipeline
// events into a ProcessingRunView. The UI must never advance a step
// on its own, so these tests assert that only events move the run.
// ============================================================

function evt(p: Partial<PipelineProgress>): PipelineProgress {
  return {
    requestId: "req-1",
    stage: null,
    stageNumber: null,
    totalStages: null,
    status: null,
    ...p,
  };
}

describe("createLiveRun", () => {
  it("starts with Stage 1 active and the rest pending", () => {
    const run = createLiveRun("conv-1");
    expect(run.status).toBe("running");
    expect(run.currentStage).toBe("IDENTIFY");
    expect(run.steps).toHaveLength(5);
    expect(run.steps[0]!.status).toBe("ACTIVE");
    expect(run.steps.slice(1).every((s) => s.status === "PENDING")).toBe(true);
    expect(run.pendingQuestions).toEqual([]);
  });
});

describe("applyPipelineEvent", () => {
  it("advances a stage to COMPLETED on a completed event", () => {
    let run = createLiveRun("conv-1");
    run = applyPipelineEvent(run, evt({ stage: "IDENTIFY", status: "COMPLETED" }));
    expect(run.steps.find((s) => s.stage === "IDENTIFY")!.status).toBe("COMPLETED");
  });

  it("records the requestId from the first event that carries one", () => {
    let run = createLiveRun("conv-1");
    run = applyPipelineEvent(run, evt({ requestId: "req-42", stage: "IDENTIFY", status: "ACTIVE" }));
    expect(run.id).toBe("req-42");
  });

  it("enters the waiting state and keeps the questions", () => {
    let run = createLiveRun("conv-1");
    run = applyPipelineEvent(
      run,
      evt({
        stage: "UNDERSTAND",
        status: "WAITING",
        pendingQuestions: ["ملک مسکونی است یا تجاری؟"],
      })
    );
    expect(run.status).toBe("waiting");
    expect(run.pendingQuestions).toEqual(["ملک مسکونی است یا تجاری؟"]);
    expect(run.steps.find((s) => s.stage === "UNDERSTAND")!.status).toBe("WAITING");
  });

  it("resumes from waiting when a later stage starts", () => {
    let run = createLiveRun("conv-1");
    run = applyPipelineEvent(
      run,
      evt({ stage: "UNDERSTAND", status: "WAITING", pendingQuestions: ["سوال"] })
    );
    run = applyPipelineEvent(run, evt({ stage: "RESEARCH", status: "ACTIVE" }));
    expect(run.status).toBe("running");
    expect(run.pendingQuestions).toEqual([]);
  });

  it("records sourcesUsed on the RESEARCH step", () => {
    let run = createLiveRun("conv-1");
    run = applyPipelineEvent(run, evt({ stage: "RESEARCH", status: "COMPLETED", sourcesUsed: 3 }));
    expect(run.sourcesUsed).toBe(3);
    expect(run.steps.find((s) => s.stage === "RESEARCH")!.sourcesUsed).toBe(3);
  });

  it("marks the run failed with a user-safe message", () => {
    let run = createLiveRun("conv-1");
    run = applyPipelineEvent(
      run,
      evt({ stage: "RESEARCH", status: "FAILED", message: "منابع در دسترس نبود.", retryable: true })
    );
    expect(run.status).toBe("failed");
    expect(run.errorMessage).toBe("منابع در دسترس نبود.");
    expect(run.retryable).toBe(true);
  });

  it("does not mutate the previous run object", () => {
    const run = createLiveRun("conv-1");
    const before = run.steps[0]!.status;
    applyPipelineEvent(run, evt({ stage: "IDENTIFY", status: "COMPLETED" }));
    expect(run.steps[0]!.status).toBe(before);
  });
});

describe("terminal transitions", () => {
  it("completes the run and closes any active step", () => {
    let run = createLiveRun("conv-1");
    run = applyPipelineEvent(run, evt({ stage: "RESPOND", status: "ACTIVE" }));
    run = completeLiveRun(run);
    expect(run.status).toBe("completed");
    expect(run.steps.every((s) => s.status !== "ACTIVE")).toBe(true);
    expect(run.pendingQuestions).toEqual([]);
  });

  it("fails the run with a message", () => {
    const run = failLiveRun(createLiveRun("conv-1"), "خطا", false);
    expect(run.status).toBe("failed");
    expect(run.retryable).toBe(false);
  });

  it("cancels the run", () => {
    const run = cancelLiveRun(createLiveRun("conv-1"));
    expect(run.status).toBe("cancelled");
  });
});

describe("helpers", () => {
  it("reports active runs and finds the active stage", () => {
    const run = createLiveRun("conv-1");
    expect(isRunActive(run)).toBe(true);
    expect(activeStage(run)).toBe("IDENTIFY");
    expect(isRunActive(completeLiveRun(run))).toBe(false);
    expect(isRunActive(null)).toBe(false);
  });
});
