import { describe, it, expect } from "vitest";
import {
  createInitialWorkflowState,
  detectIntent,
  generateMissingInfoQuestions,
  determineNextPhase,
  extractFacts,
  processWorkflowTurn,
  getWorkflowState,
  setWorkflowState,
  clearWorkflowState,
} from "../ai/workflow/engine";
import type { WorkflowState } from "../ai/workflow/engine";

// ============================================================
// Workflow Engine — Unit Tests
// Tests the AI workflow state machine: intent detection,
// fact extraction, phase transitions, and state persistence.
// Run with: npx vitest run src/lib/__tests__/workflow-engine.test.ts
// ============================================================

describe("createInitialWorkflowState", () => {
  it("returns a fresh DISCOVERY state with empty collections", () => {
    const state = createInitialWorkflowState();
    expect(state.phase).toBe("DISCOVERY");
    expect(state.domain).toBeNull();
    expect(state.intent).toBeNull();
    expect(state.collectedFacts).toEqual({});
    expect(state.pendingQuestions).toEqual([]);
    expect(state.answeredQuestions).toEqual([]);
    expect(state.riskLevel).toBeNull();
    expect(state.findings).toEqual([]);
    expect(state.recommendations).toEqual([]);
    expect(state.caseCreated).toBe(false);
    expect(state.caseId).toBeNull();
    expect(state.turnInPhase).toBe(0);
  });
});

// ============================================================
// Intent Detection
// ============================================================

describe("detectIntent", () => {
  it("detects contract dispute from Persian keywords", () => {
    const result = detectIntent(
      "پیمانکار من تعهدات قرارداد را انجام نداده و می‌خواهم فسخ کنم"
    );
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("contract_dispute");
    expect(result!.domain).toBe("contract");
    expect(result!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("detects employment dispute", () => {
    const result = detectIntent(
      "من از کار اخراج شدم و حقوق و مزایای من پرداخت نشده"
    );
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("employment_dispute");
    expect(result!.domain).toBe("employment");
  });

  it("detects divorce/family matter", () => {
    const result = detectIntent(
      "می‌خواهم برای طلاق اقدام کنم و مهریه و حضانت فرزندم را مشخص کنم"
    );
    expect(result).not.toBeNull();
    expect(result!.domain).toBe("family");
  });

  it("detects property dispute", () => {
    const result = detectIntent(
      "ملک من توسط همسایه تصرف شده و می‌خواهم خلع ید کنم"
    );
    expect(result).not.toBeNull();
    expect(result!.domain).toBe("property");
  });

  it("detects check/criminal matter", () => {
    const result = detectIntent(
      "یک چک برگشتی دارم و می‌خواهم شکایت کنم"
    );
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("check_dispute");
    expect(result!.domain).toBe("criminal");
  });

  it("detects tax consultation", () => {
    const result = detectIntent(
      "برای اظهارنامه مالیاتی امسال سوال دارم و می‌خواهم معافیت مالیاتی بگیرم"
    );
    expect(result).not.toBeNull();
    expect(result!.domain).toBe("tax");
  });

  it("returns null for insufficient keywords", () => {
    const result = detectIntent("سلام خوبی؟");
    expect(result).toBeNull();
  });

  it("returns null for empty text", () => {
    const result = detectIntent("");
    expect(result).toBeNull();
  });

  it("picks highest-confidence match when multiple domains overlap", () => {
    const result = detectIntent(
      "قرارداد اجاره من با مستأجر تمام شده و می‌خواهم تخلیه کنم"
    );
    expect(result).not.toBeNull();
    expect(result!.domain).toBe("property");
  });
});

// ============================================================
// Fact Extraction
// ============================================================

describe("extractFacts", () => {
  it("extracts monetary amounts", () => {
    const facts = extractFacts("مبلغ ۵۰ میلیون تومان خسارت خواسته شده", null);
    expect(facts["amount"]).toBe("۵۰ میلیون");
  });

  it("extracts Persian dates", () => {
    const facts = extractFacts("قرارداد در تاریخ ۱۴۰۲/۰۵/۱۲ منعقد شد", null);
    expect(facts["timeline"]).toBe("۱۴۰۲/۰۵/۱۲");
  });

  it("extracts party names with titles", () => {
    const facts = extractFacts("آقای احمدی و شرکت ساختمانی مهر", null);
    expect(facts["parties"]).toBe("آقای احمدی");
  });

  it("extracts city names", () => {
    const facts = extractFacts("این موضوع در تهران اتفاق افتاده", null);
    expect(facts["location"]).toBe("تهران");
  });

  it("detects document mentions", () => {
    const facts = extractFacts("من قرارداد و رسید پرداخت را دارم", null);
    expect(facts["documents"]).toBe("اشاره به مدارک شده است");
  });

  it("extracts multiple facts from a single message", () => {
    const facts = extractFacts(
      "آقای رضایی در مشهد مبلغ ۲۰۰ میلیون تومان از من طلب دارد و سند دارم",
      null
    );
    expect(facts["amount"]).toBe("۲۰۰ میلیون");
    expect(facts["parties"]).toBe("آقای رضایی");
    expect(facts["location"]).toBe("مشهد");
    expect(facts["documents"]).toBe("اشاره به مدارک شده است");
  });
});

// ============================================================
// Missing Info Questions
// ============================================================

describe("generateMissingInfoQuestions", () => {
  it("returns domain-filtered questions for contract domain", () => {
    const questions = generateMissingInfoQuestions("contract", {});
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.length).toBeLessThanOrEqual(4);
    const hasContractQ = questions.some((q) => q.includes("قرارداد"));
    expect(hasContractQ).toBe(true);
  });

  it("returns domain-filtered questions for family domain", () => {
    const questions = generateMissingInfoQuestions("family", {});
    const hasFamilyQ = questions.some((q) => q.includes("ازدواج") || q.includes("فرزند"));
    expect(hasFamilyQ).toBe(true);
  });

  it("skips already-collected facts", () => {
    const questions = generateMissingInfoQuestions("contract", {
      parties: "آقای احمدی",
      amount: "۵۰ میلیون",
    });
    const hasPartiesQ = questions.some((q) => q.includes("طرفین"));
    const hasAmountQ = questions.some((q) => q.includes("مبلغ"));
    expect(hasPartiesQ).toBe(false);
    expect(hasAmountQ).toBe(false);
  });

  it("returns max 4 questions", () => {
    const questions = generateMissingInfoQuestions("contract", {});
    expect(questions.length).toBeLessThanOrEqual(4);
  });

  it("returns generic questions when domain is null", () => {
    const questions = generateMissingInfoQuestions(null, {});
    expect(questions.length).toBeGreaterThan(0);
    const hasGenericQ = questions.some((q) => q.includes("طرفین"));
    expect(hasGenericQ).toBe(true);
  });
});

// ============================================================
// Phase Transitions
// ============================================================

describe("determineNextPhase", () => {
  it("stays in DISCOVERY on first turn without intent", () => {
    const state = createInitialWorkflowState();
    const result = determineNextPhase(state, "سلام", null);
    expect(result.nextPhase).toBe("DISCOVERY");
  });

  it("transitions to DATA_COLLECTION when intent is detected", () => {
    const state = createInitialWorkflowState();
    const intent = { intent: "contract_dispute", domain: "contract" as const, description: "", confidence: 0.7 };
    const result = determineNextPhase(state, "قرارداد من نقض شده", intent);
    expect(result.nextPhase).toBe("DATA_COLLECTION");
  });

  it("transitions to DATA_COLLECTION after 2 turns in DISCOVERY", () => {
    const state: WorkflowState = { ...createInitialWorkflowState(), turnInPhase: 2 };
    const result = determineNextPhase(state, "سلام", null);
    expect(result.nextPhase).toBe("DATA_COLLECTION");
  });

  it("transitions to ANALYSIS when enough facts collected", () => {
    const state: WorkflowState = {
      ...createInitialWorkflowState(),
      phase: "DATA_COLLECTION",
      collectedFacts: { parties: "x", timeline: "x", documents: "x", location: "x" },
    };
    const result = determineNextPhase(state, "", null);
    expect(result.nextPhase).toBe("ANALYSIS");
  });

  it("transitions to ANALYSIS after 3 turns in DATA_COLLECTION", () => {
    const state: WorkflowState = {
      ...createInitialWorkflowState(),
      phase: "DATA_COLLECTION",
      turnInPhase: 3,
    };
    const result = determineNextPhase(state, "", null);
    expect(result.nextPhase).toBe("ANALYSIS");
  });

  it("transitions ANALYSIS → RECOMMENDATION", () => {
    const state: WorkflowState = {
      ...createInitialWorkflowState(),
      phase: "ANALYSIS",
    };
    const result = determineNextPhase(state, "", null);
    expect(result.nextPhase).toBe("RECOMMENDATION");
  });

  it("transitions RECOMMENDATION → ACTION", () => {
    const state: WorkflowState = {
      ...createInitialWorkflowState(),
      phase: "RECOMMENDATION",
    };
    const result = determineNextPhase(state, "", null);
    expect(result.nextPhase).toBe("ACTION");
  });

  it("stays in ACTION", () => {
    const state: WorkflowState = {
      ...createInitialWorkflowState(),
      phase: "ACTION",
    };
    const result = determineNextPhase(state, "", null);
    expect(result.nextPhase).toBe("ACTION");
  });
});

// ============================================================
// Full Turn Processing
// ============================================================

describe("processWorkflowTurn", () => {
  it("processes a complete turn and returns updated state", () => {
    const state = createInitialWorkflowState();
    const result = processWorkflowTurn(
      state,
      "پیمانکار من ۵۰۰ میلیون تومان خسارت زده و قرارداد را نقض کرده",
      ""
    );

    expect(result.state.phase).toBe("DATA_COLLECTION");
    expect(result.state.domain).toBe("contract");
    expect(result.state.intent).toBe("contract_dispute");
    expect(result.phaseChanged).toBe(true);
    expect(result.previousPhase).toBe("DISCOVERY");
    expect(result.systemPrompt).toContain("جمع‌آوری اطلاعات");
  });

  it("accumulates facts across turns", () => {
    const state = createInitialWorkflowState();
    const turn1 = processWorkflowTurn(state, "آقای احمدی در تهران", "");
    const turn2 = processWorkflowTurn(turn1.state, "مبلغ ۱۰۰ میلیون تومان", "");

    expect(turn2.state.collectedFacts["parties"]).toBe("آقای احمدی");
    expect(turn2.state.collectedFacts["location"]).toBe("تهران");
    expect(turn2.state.collectedFacts["amount"]).toBe("۱۰۰ میلیون");
  });

  it("increments turnInPhase each turn", () => {
    const state = createInitialWorkflowState();
    const result = processWorkflowTurn(state, "سلام", "");
    expect(result.state.turnInPhase).toBe(1);
  });

  it("resets turnInPhase on phase change", () => {
    const state: WorkflowState = {
      ...createInitialWorkflowState(),
      phase: "DATA_COLLECTION",
      turnInPhase: 3,
    };
    const result = processWorkflowTurn(state, "اطلاعات تکمیلی", "");
    expect(result.state.phase).toBe("ANALYSIS");
    expect(result.state.turnInPhase).toBe(0);
  });

  it("suggests case creation in ACTION phase", () => {
    const state: WorkflowState = {
      ...createInitialWorkflowState(),
      phase: "ACTION",
    };
    const result = processWorkflowTurn(state, "می‌خواهم پرونده ایجاد کنم", "");
    expect(result.suggestCaseCreation).toBe(true);
  });

  it("does not suggest case creation if already created", () => {
    const state: WorkflowState = {
      ...createInitialWorkflowState(),
      phase: "ACTION",
      caseCreated: true,
    };
    const result = processWorkflowTurn(state, "", "");
    expect(result.suggestCaseCreation).toBe(false);
  });

  it("generates pending questions in DATA_COLLECTION phase", () => {
    const state: WorkflowState = {
      ...createInitialWorkflowState(),
      phase: "DATA_COLLECTION",
      domain: "contract",
    };
    const result = processWorkflowTurn(state, "قرارداد من نقض شده", "");
    expect(result.state.pendingQuestions.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Workflow State Persistence
// ============================================================

describe("workflow state persistence", () => {
  it("stores and retrieves workflow state by conversation ID", () => {
    const convId = "test-conv-1";
    clearWorkflowState(convId);

    const initial = getWorkflowState(convId);
    expect(initial.phase).toBe("DISCOVERY");

    const updated: WorkflowState = {
      ...initial,
      phase: "ANALYSIS",
      domain: "contract",
    };
    setWorkflowState(convId, updated);

    const retrieved = getWorkflowState(convId);
    expect(retrieved.phase).toBe("ANALYSIS");
    expect(retrieved.domain).toBe("contract");
  });

  it("clearWorkflowState removes state", () => {
    const convId = "test-conv-2";
    setWorkflowState(convId, {
      ...createInitialWorkflowState(),
      phase: "RECOMMENDATION",
    });
    clearWorkflowState(convId);

    const retrieved = getWorkflowState(convId);
    expect(retrieved.phase).toBe("DISCOVERY");
  });
});

// ============================================================
// End-to-End Scenario Tests
// ============================================================

describe("end-to-end workflow scenarios", () => {
  it("scenario 1: rental dispute — full workflow", () => {
    const convId = "e2e-rental";
    clearWorkflowState(convId);

    const t1 = processWorkflowTurn(
      getWorkflowState(convId),
      "مستأجر من اجاره را پرداخت نکرده و می‌خواهم تخلیه کنم. آقای محمدی در تهران.",
      ""
    );
    setWorkflowState(convId, t1.state);

    expect(t1.state.domain).toBe("property");
    expect(t1.state.phase).toBe("DATA_COLLECTION");
    expect(t1.phaseChanged).toBe(true);

    const t2 = processWorkflowTurn(
      getWorkflowState(convId),
      "مبلغ اجاره ماهی ۲۰ میلیون تومان است و ۳ ماه عقب افتاده",
      ""
    );
    setWorkflowState(convId, t2.state);

    expect(t2.state.collectedFacts["amount"]).toBeDefined();
    expect(t2.state.collectedFacts["parties"]).toBe("آقای محمدی");

    const t3 = processWorkflowTurn(
      getWorkflowState(convId),
      "قرارداد اجاره رسمی داریم و در مشهد است",
      ""
    );
    setWorkflowState(convId, t3.state);

    expect(t3.state.collectedFacts["location"]).toBe("تهران");
    expect(t3.state.collectedFacts["documents"]).toBeDefined();

    const t4 = processWorkflowTurn(
      getWorkflowState(convId),
      "بله مدارک کامل است",
      ""
    );
    setWorkflowState(convId, t4.state);

    expect(t4.state.phase).toBe("RECOMMENDATION");
    expect(t4.phaseChanged).toBe(true);

    const t5 = processWorkflowTurn(getWorkflowState(convId), "ادامه بده", "");
    setWorkflowState(convId, t5.state);
    expect(t5.state.phase).toBe("ACTION");
    expect(t5.suggestCaseCreation).toBe(true);

    clearWorkflowState(convId);
  });

  it("scenario 2: employment dispute — intent detection and fact collection", () => {
    const convId = "e2e-employment";
    clearWorkflowState(convId);

    const t1 = processWorkflowTurn(
      getWorkflowState(convId),
      "من از کار اخراج شدم و حقوق ۳ ماه آخر را نداده‌اند. شرکت فناوری نوین در اصفهان.",
      ""
    );
    setWorkflowState(convId, t1.state);

    expect(t1.state.domain).toBe("employment");
    expect(t1.state.intent).toBe("employment_dispute");
    expect(t1.state.collectedFacts["parties"]).toBe("شرکت فناوری");
    expect(t1.state.collectedFacts["location"]).toBe("اصفهان");

    clearWorkflowState(convId);
  });

  it("scenario 3: contract drafting — different intent path", () => {
    const convId = "e2e-contract";
    clearWorkflowState(convId);

    const t1 = processWorkflowTurn(
      getWorkflowState(convId),
      "نیاز به تنظیم قرارداد پیمانکاری دارم برای ساخت ساختمان",
      ""
    );
    setWorkflowState(convId, t1.state);

    expect(t1.state.domain).toBe("contract");
    expect(t1.state.intent).toBe("contract_drafting");

    clearWorkflowState(convId);
  });
});
