// ============================================================
// LEGALIR — AI Legal Workflow Agent (server-only)
// ============================================================
// State machine: DISCOVERY → DATA_COLLECTION → ANALYSIS → RECOMMENDATION → ACTION
// Detects user intent, classifies legal domain, identifies missing info,
// generates structured questions, and orchestrates the workflow pipeline.
// ============================================================

import type { CaseCategory, FollowUpAnswer, FollowUpQuestion } from "@legalir/types";
import { readConversations, writeConversations } from "@/lib/db";
import {
  UNKNOWN_ANSWER_FA,
  generateStructuredQuestions,
  structuredQuestionsToText,
} from "./questions";

// ============================================================
// Workflow State Machine
// ============================================================

export type WorkflowPhase =
  | "DISCOVERY"
  | "DATA_COLLECTION"
  | "ANALYSIS"
  | "RECOMMENDATION"
  | "ACTION";

export interface WorkflowState {
  phase: WorkflowPhase;
  domain: CaseCategory | null;
  intent: string | null;
  collectedFacts: Record<string, string>;
  pendingQuestions: string[];
  /** The structured projection of `pendingQuestions` (ids, reasons, options). */
  pendingFollowUps?: FollowUpQuestion[];
  answeredQuestions: string[];
  riskLevel: "low" | "medium" | "high" | "urgent" | null;
  findings: string[];
  recommendations: string[];
  caseCreated: boolean;
  caseId: string | null;
  turnInPhase: number;
}

export function createInitialWorkflowState(): WorkflowState {
  return {
    phase: "DISCOVERY",
    domain: null,
    intent: null,
    collectedFacts: {},
    pendingQuestions: [],
    answeredQuestions: [],
    riskLevel: null,
    findings: [],
    recommendations: [],
    caseCreated: false,
    caseId: null,
    turnInPhase: 0,
  };
}

// ============================================================
// Intent Detection
// ============================================================

interface IntentMatch {
  intent: string;
  domain: CaseCategory;
  keywords: string[];
  description: string;
}

const INTENT_PATTERNS: IntentMatch[] = [
  {
    intent: "contract_dispute",
    domain: "contract",
    keywords: ["قرارداد", "تعهد", "تخلف", "فسخ", "بند", "پیمانکار", "کارفرما", "تأخیر", "جریمه", "خسارت", "عدم انجام", "ایفای تعهد", "وجه التزام"],
    description: "اختلاف قراردادی — کاربر در مورد اجرا، تخلف یا فسخ یک قرارداد سوال دارد",
  },
  {
    intent: "contract_drafting",
    domain: "contract",
    keywords: ["تنظیم قرارداد", "نوشتن قرارداد", "پیش‌نویس", "نمونه قرارداد", "قالب قرارداد", "متن قرارداد"],
    description: "تنظیم قرارداد — کاربر نیاز به پیش‌نویس یا نمونه قرارداد دارد",
  },
  {
    intent: "contract_review",
    domain: "contract",
    keywords: ["بررسی قرارداد", "تحلیل قرارداد", "بازبینی", "ریسک قرارداد", "شروط نامتعارف"],
    description: "بررسی قرارداد — کاربر می‌خواهد یک قرارداد موجود تحلیل شود",
  },
  {
    intent: "employment_dispute",
    domain: "employment",
    keywords: ["کارگر", "کارمند", "اخراج", "حقوق", "مزایا", "بیمه", "اضافه‌کاری", "مرخصی", "بازنشستگی", "تأمین اجتماعی", "حق السعی", "بیکاری"],
    description: "اختلاف کارگری/کارمندی",
  },
  {
    intent: "employment_contract",
    domain: "employment",
    keywords: ["قرارداد کار", "استخدام", "استخدامی", "حکم کارگزینی", "دوره آزمایشی"],
    description: "قرارداد استخدام",
  },
  {
    intent: "property_dispute",
    domain: "property",
    keywords: ["ملک", "زمین", "آپارتمان", "سند", "ثبتی", "مالکیت", "تصرف", "غصب", "خلع ید", "تخلیه", "رهن", "اجاره", "مستأجر", "موجر", "سرقفلی"],
    description: "اختلاف ملکی",
  },
  {
    intent: "rental_dispute",
    domain: "property",
    keywords: ["اجاره", "مستأجر", "موجر", "رهن", "ودیعه", "تخلیه", "سرقفلی", "افزایش اجاره", "قرارداد اجاره"],
    description: "اختلاف اجاره",
  },
  {
    intent: "divorce",
    domain: "family",
    keywords: ["طلاق", "مهریه", "نفقه", "حضانت", "ملاقات", "تمکین", "ازدواج", "همسر", "زن", "شوهر", "عقد", "نکاح"],
    description: "طلاق و مسائل خانواده",
  },
  {
    intent: "inheritance",
    domain: "family",
    keywords: ["ارث", "وراثت", "میراث", "وصیت", "ترکه", "انحصار وراثت", "ورثه", "ماتَرَک", "تقسیم ارث"],
    description: "ارث و وصیت",
  },
  {
    intent: "company_dispute",
    domain: "business",
    keywords: ["شرکت", "سهام", "مجمع", "هیئت مدیره", "مدیرعامل", "اساسنامه", "شرکا", "شریک", "مشارکت", "تجاری", "ورشکستگی", "ثبت شرکت", "برند"],
    description: "اختلاف شرکتی/تجاری",
  },
  {
    intent: "criminal_defense",
    domain: "criminal",
    keywords: ["جرم", "شکایت", "شاکی", "متهم", "دادسرا", "بازپرس", "کیفرخواست", "مجازات", "حبس", "زندان", "کلاهبرداری", "سرقت", "ضرب", "جرح", "تهدید", "توهین", "افترا"],
    description: "دفاع کیفری",
  },
  {
    intent: "check_dispute",
    domain: "criminal",
    keywords: ["چک", "چک برگشتی", "چک بلامحل", "سفته", "برات", "ضمانت", "ضامن"],
    description: "چک و اسناد تجاری",
  },
  {
    intent: "debt_recovery",
    domain: "financial",
    keywords: ["بدهی", "طلب", "دین", "بدهکار", "طلبکار", "مطالبه", "وصول", "اعسار", "تقسیط", "اجراییه", "توقیف اموال"],
    description: "وصول طلب",
  },
  {
    intent: "banking_dispute",
    domain: "financial",
    keywords: ["بانک", "وام", "تسهیلات", "سود", "ربا", "جریمه دیرکرد", "حساب", "سپرده", "ضمانت‌نامه بانکی"],
    description: "اختلاف بانکی",
  },
  {
    intent: "tax_consultation",
    domain: "tax",
    keywords: ["مالیات", "مالیاتی", "معافیت", "اظهارنامه", "تشخیص", "ممیز", "دادرسی مالیاتی", "ارزش افزوده", "عملکرد", "تکلیفی", "عوارض"],
    description: "مشاوره مالیاتی",
  },
  {
    intent: "general_legal_question",
    domain: "other",
    keywords: ["قانون", "مقررات", "بخشنامه", "آیین نامه", "رأی", "رویه", "حق", "تکلیف", "مسئولیت", "دعوی", "دادخواست", "شکوییه", "لایحه", "وکیل", "دادگاه", "صلاحیت", "داوری"],
    description: "پرسش عمومی حقوقی",
  },
];

export interface IntentResult {
  intent: string;
  domain: CaseCategory;
  description: string;
  confidence: number;
}

export function detectIntent(text: string): IntentResult | null {
  const lower = text.toLowerCase();
  let bestMatch: IntentResult | null = null;
  let bestScore = 0;
  let bestMultiWordCount = 0;

  for (const pattern of INTENT_PATTERNS) {
    let score = 0;
    let multiWordCount = 0;
    for (const kw of pattern.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        const weight = kw.includes(" ") ? 2 : 1;
        score += weight;
        if (weight === 2) multiWordCount++;
      }
    }
    // Prefer higher score; on tie, prefer more multi-word (specific) matches
    if (score > bestScore || (score === bestScore && multiWordCount > bestMultiWordCount)) {
      bestScore = score;
      bestMultiWordCount = multiWordCount;
      bestMatch = {
        intent: pattern.intent,
        domain: pattern.domain,
        description: pattern.description,
        confidence: Math.min(score / 3, 1.0),
      };
    }
  }

  if (!bestMatch || bestScore < 2) return null;
  return bestMatch;
}

// ============================================================
// Missing Information Detection
// ============================================================

/**
 * The plain-text questions (kept for the system prompt and legacy callers).
 * The structured projection — ids, reasons and quick options — comes from
 * `generateStructuredQuestions`, which this delegates to so the two can never
 * drift apart.
 */
export function generateMissingInfoQuestions(
  domain: CaseCategory | null,
  collectedFacts: Record<string, string>
): string[] {
  return structuredQuestionsToText(generateStructuredQuestions(domain, collectedFacts));
}

// ============================================================
// Phase Transition Logic
// ============================================================

export interface PhaseTransition {
  nextPhase: WorkflowPhase;
  reason: string;
}

export function determineNextPhase(
  current: WorkflowState,
  _userMessage: string,
  intent: IntentResult | null
): PhaseTransition {
  const { phase, collectedFacts, turnInPhase } = current;

  switch (phase) {
    case "DISCOVERY": {
      if (intent && intent.confidence >= 0.5) {
        return { nextPhase: "DATA_COLLECTION", reason: `حوزه "${intent.domain}" با هدف "${intent.intent}" شناسایی شد.` };
      }
      if (turnInPhase >= 2) {
        return { nextPhase: "DATA_COLLECTION", reason: "جمع‌آوری اطلاعات تکمیلی آغاز می‌شود." };
      }
      return { nextPhase: "DISCOVERY", reason: "" };
    }
    case "DATA_COLLECTION": {
      const factCount = Object.keys(collectedFacts).length;
      if (factCount >= 4 || turnInPhase >= 3) {
        return { nextPhase: "ANALYSIS", reason: factCount >= 4 ? "اطلاعات کافی جمع‌آوری شد." : "تحلیل اولیه آغاز می‌شود." };
      }
      return { nextPhase: "DATA_COLLECTION", reason: "" };
    }
    case "ANALYSIS": {
      return { nextPhase: "RECOMMENDATION", reason: "تحلیل حقوقی تکمیل شد." };
    }
    case "RECOMMENDATION": {
      return { nextPhase: "ACTION", reason: "توصیه‌ها ارائه شد." };
    }
    case "ACTION": {
      return { nextPhase: "ACTION", reason: "" };
    }
    default:
      return { nextPhase: "DISCOVERY", reason: "" };
  }
}

// ============================================================
// Fact Extraction
// ============================================================

export function extractFacts(
  message: string,
  _domain: CaseCategory | null
): Record<string, string> {
  const facts: Record<string, string> = {};

  const amountMatch = message.match(/([\d۰-۹][\d۰-۹,]*)\s*(میلیون|هزار|ریال|تومان|میلیارد)/);
  if (amountMatch) facts["amount"] = amountMatch[0];

  const dateMatch = message.match(/۱۴[\d۰-۹][\d۰-۹]\/[\d۰-۹]{1,2}\/[\d۰-۹]{1,2}/);
  if (dateMatch) facts["timeline"] = dateMatch[0];

  const nameMatch = message.match(/(?:آقای|خانم|شرکت)\s+([^\s،,]+)/);
  if (nameMatch) facts["parties"] = nameMatch[0];

  const cityMatch = message.match(/(تهران|مشهد|اصفهان|شیراز|تبریز|کرج|اهواز|قم|کرمانشاه|ارومیه|رشت|زاهدان|همدان|یزد|اردبیل|بندرعباس|اراک)/);
  if (cityMatch) facts["location"] = cityMatch[0];

  if (/قرارداد|مدرک|سند|نامه|پیام|ایمیل|رسید|فاکتور/.test(message)) {
    facts["documents"] = "اشاره به مدارک شده است";
  }

  return facts;
}

// ============================================================
// Workflow System Prompt Builder
// ============================================================

const PHASE_PROMPTS: Record<WorkflowPhase, string> = {
  DISCOVERY: `شما در مرحله «شناسایی» هستید. وظایف شما:
1. حوزه حقوقی موضوع را تشخیص دهید.
2. هدف کاربر را مشخص کنید (مشاوره، تنظیم سند، بررسی قرارداد، طرح دعوی، یا حل اختلاف).
3. اگر اطلاعات کافی نیست، ۲-۳ سوال هدفمند بپرسید.
4. پاسخ را کوتاه و متمرکز نگه دارید (حداکثر ۳-۴ جمله).`,

  DATA_COLLECTION: `شما در مرحله «جمع‌آوری اطلاعات» هستید. وظایف شما:
1. اطلاعات کلیدی را برای تحلیل حقوقی جمع‌آوری کنید.
2. سوالات خود را یکی یکی و به ترتیب اولویت بپرسید.
3. پس از دریافت هر پاسخ، آن را تأیید کنید و سوال بعدی را بپرسید.
4. اطلاعات جمع‌آوری شده را در قالب خلاصه کوتاه ارائه دهید.
5. وقتی اطلاعات کافی شد، اعلام کنید آماده تحلیل هستید.`,

  ANALYSIS: `شما در مرحله «تحلیل حقوقی» هستید. وظایف شما:
1. تحلیل حقوقی دقیق و مستند ارائه دهید.
2. از ساختار زیر استفاده کنید:
   - **خلاصه**: مرور کوتاه موضوع
   - **چارچوب حقوقی**: قوانین و مقررات مرتبط با استناد دقیق
   - **تحلیل**: بررسی ابعاد مختلف و نقاط قوت و ضعف
   - **ریسک‌ها**: شناسایی و اولویت‌بندی ریسک‌ها
3. به منابع معتبر استناد کنید و از ذکر مواد قانونی ساختگی خودداری کنید.
4. سطح ریسک کلی را مشخص کنید.`,

  RECOMMENDATION: `شما در مرحله «توصیه‌های عملی» هستید. وظایف شما:
1. اقدامات پیشنهادی را به ترتیب اولویت ارائه دهید.
2. برای هر اقدام مشخص کنید: عنوان، اولویت، شرح، مهلت پیشنهادی، مدارک مورد نیاز.
3. مسیرهای جایگزین را معرفی کنید (مذاکره، داوری، دادگاه).
4. جمع‌بندی از بهترین مسیر پیشنهادی ارائه دهید.`,

  ACTION: `شما در مرحله «اقدام» هستید. وظایف شما:
1. به کاربر کمک کنید اقدامات توصیه شده را عملی کند.
2. گزینه‌های زیر را پیشنهاد دهید:
   - **ایجاد پرونده**: ثبت پرونده حقوقی در LEGALIR
   - **تنظیم سند**: ایجاد پیش‌نویس اظهارنامه، لایحه یا دادخواست
   - **مشاوره با وکیل**: ارجاع به وکیل متخصص
   - **بررسی قرارداد**: بارگذاری و تحلیل قرارداد
3. از کاربر بپرسید کدام اقدام را می‌خواهد انجام دهد.`,
};

export function buildWorkflowSystemPrompt(
  state: WorkflowState,
  groundingBlock: string
): string {
  const domainLabels: Record<string, string> = {
    family: "خانواده", contract: "قرارداد", property: "املاک",
    employment: "کار و استخدام", business: "تجارت و شرکت‌ها",
    criminal: "کیفری", financial: "مالی و بانکی", tax: "مالیات", other: "سایر",
  };

  const parts: string[] = [
    "تو «دستیار تخصصی حقوقی لیگالیر» هستی؛ یک دستیار حقوقی فارسی‌زبان برای نظام حقوقی ایران.",
    "تو در حال انجام یک فرایند ساختاریافته ۵ مرحله‌ای هستی: شناسایی → جمع‌آوری اطلاعات → تحلیل → توصیه → اقدام.",
    "",
    PHASE_PROMPTS[state.phase],
  ];

  if (state.domain) {
    parts.push(`\nحوزه حقوقی: «${domainLabels[state.domain] || state.domain}»`);
  }

  if (Object.keys(state.collectedFacts).length > 0) {
    parts.push("\nاطلاعات جمع‌آوری شده:");
    for (const [key, value] of Object.entries(state.collectedFacts)) {
      parts.push(`- ${key}: ${value}`);
    }
  }

  if (state.pendingQuestions.length > 0) {
    parts.push("\nسوالات در انتظار پاسخ:");
    state.pendingQuestions.forEach((q, i) => { parts.push(`${i + 1}. ${q}`); });
  }

  if (groundingBlock) parts.push(`\n${groundingBlock}`);

  parts.push(
    "",
    "قوانین کلی:",
    "- پاسخ به زبان فارسی، رسمی و ساختاریافته باشد.",
    "- فقط به منابع معتبر استناد کن. اگر منبع معتبر نداری، صریحاً بگو.",
    "- این مشاوره رسمی یا نظر قطعی قضایی نیست.",
    `- در پایان پاسخ، مرحله فعلی را مشخص کن: «مرحله ${state.phase === "DISCOVERY" ? "۱" : state.phase === "DATA_COLLECTION" ? "۲" : state.phase === "ANALYSIS" ? "۳" : state.phase === "RECOMMENDATION" ? "۴" : "۵"}/۵: ${state.phase === "DISCOVERY" ? "شناسایی" : state.phase === "DATA_COLLECTION" ? "جمع‌آوری اطلاعات" : state.phase === "ANALYSIS" ? "تحلیل حقوقی" : state.phase === "RECOMMENDATION" ? "توصیه‌های عملی" : "اقدام"}»`
  );

  return parts.join("\n");
}

// ============================================================
// Workflow Orchestrator
// ============================================================

export interface WorkflowTurnResult {
  state: WorkflowState;
  systemPrompt: string;
  phaseChanged: boolean;
  previousPhase: WorkflowPhase;
  suggestCaseCreation: boolean;
}

export function processWorkflowTurn(
  currentState: WorkflowState,
  userMessage: string,
  groundingBlock: string,
  followUpAnswers: readonly FollowUpAnswer[] = []
): WorkflowTurnResult {
  const previousPhase = currentState.phase;
  const state: WorkflowState = {
    ...currentState,
    collectedFacts: { ...currentState.collectedFacts },
    pendingQuestions: [...currentState.pendingQuestions],
    pendingFollowUps: [...(currentState.pendingFollowUps ?? [])],
    answeredQuestions: [...currentState.answeredQuestions],
    findings: [...currentState.findings],
    recommendations: [...currentState.recommendations],
    turnInPhase: currentState.turnInPhase + 1,
  };

  // Structured answers carried with the message become collected facts, so
  // the exact question is never asked again (§8). An honest «اطلاع ندارم» is
  // recorded as a fact too — the engine must not re-ask it later.
  applyFollowUpAnswers(state, followUpAnswers);

  let intent: IntentResult | null = null;
  if (state.phase === "DISCOVERY") {
    intent = detectIntent(userMessage);
    if (intent && intent.confidence >= 0.5) {
      state.intent = intent.intent;
      state.domain = intent.domain;
    }
  }

  const newFacts = extractFacts(userMessage, state.domain);
  for (const [key, value] of Object.entries(newFacts)) {
    if (!state.collectedFacts[key]) state.collectedFacts[key] = value;
  }

  if (state.phase === "DATA_COLLECTION") {
    state.pendingFollowUps = generateStructuredQuestions(state.domain, state.collectedFacts);
    state.pendingQuestions = structuredQuestionsToText(state.pendingFollowUps);
  }

  const transition = determineNextPhase(state, userMessage, intent);
  const phaseChanged = transition.nextPhase !== state.phase;

  if (phaseChanged) {
    state.phase = transition.nextPhase;
    state.turnInPhase = 0;
  }

  const systemPrompt = buildWorkflowSystemPrompt(state, groundingBlock);
  const suggestCaseCreation = state.phase === "ACTION" && !state.caseCreated;

  return { state, systemPrompt, phaseChanged, previousPhase, suggestCaseCreation };
}

/**
 * Record structured answers as facts. An empty or unknown-id answer is
 * ignored; an explicitly skipped answer is stored as «اطلاع ندارم» so the
 * question is not asked again.
 */
export function applyFollowUpAnswers(
  state: WorkflowState,
  answers: readonly FollowUpAnswer[]
): void {
  for (const answer of answers) {
    const id = typeof answer?.id === "string" ? answer.id.trim() : "";
    if (!id) continue;
    const raw = typeof answer.value === "string" ? answer.value.trim() : "";
    const value = raw || UNKNOWN_ANSWER_FA;
    if (!state.collectedFacts[id]) state.collectedFacts[id] = value;
    if (!state.answeredQuestions.includes(id)) state.answeredQuestions.push(id);
  }
  if (answers.length > 0) {
    const answeredIds = new Set(state.answeredQuestions);
    const stillPending = (state.pendingFollowUps ?? []).filter((q) => !answeredIds.has(q.id));
    state.pendingFollowUps = stillPending;
    // The text projection follows the structured one so the prompt and the UI
    // can never disagree about what is still open.
    if (stillPending.length !== state.pendingQuestions.length) {
      state.pendingQuestions = structuredQuestionsToText(stillPending);
    }
  }
}

// ============================================================
// Workflow State Persistence
// ============================================================
// In-memory for the life of the process, and mirrored onto the conversation
// row (`.data/conversations.json`) so a refresh, a new tab or a server
// restart restores the same phase, facts and open questions (§11).

const workflowStore = new Map<string, WorkflowState>();

export function getWorkflowState(conversationId: string): WorkflowState {
  const cached = workflowStore.get(conversationId);
  if (cached) return cached;
  const stored = readPersistedWorkflow(conversationId);
  if (stored) {
    workflowStore.set(conversationId, stored);
    return stored;
  }
  return createInitialWorkflowState();
}

export function setWorkflowState(conversationId: string, state: WorkflowState): void {
  workflowStore.set(conversationId, state);
  writePersistedWorkflow(conversationId, state);
}

export function clearWorkflowState(conversationId: string): void {
  workflowStore.delete(conversationId);
  writePersistedWorkflow(conversationId, null);
}

/**
 * The persisted state is only written for a conversation row that exists, so
 * a unit test's synthetic id never creates data. Reads are unchanged — a
 * missing row is simply "no persisted state".
 */
function readPersistedWorkflow(conversationId: string): WorkflowState | null {
  const row = readConversations().find((c) => c.id === conversationId);
  return (row?.workflow as WorkflowState | undefined) ?? null;
}

function writePersistedWorkflow(conversationId: string, state: WorkflowState | null): void {
  const rows = readConversations();
  const row = rows.find((c) => c.id === conversationId);
  if (!row) return;
  row.workflow = state;
  writeConversations(rows);
}