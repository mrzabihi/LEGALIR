// ============================================================
// LEGALIR — Pipeline Stage 1: IDENTIFY (real classification)
// ============================================================
// Turns the raw user message into a structured classification. This is the
// real work behind Stage 1 — the stage only completes once this function
// has returned, never on a timer.
//
// The output is internal: it drives which later stages actually run and is
// recorded on the processing run for debugging/benchmarking. It is never
// rendered raw to the user.
// ============================================================

import type { PipelineClassification } from "@legalir/types";
import { detectIntent } from "@/lib/ai/workflow";

/** Intents that imply the answer must be grounded in retrieved sources. */
const SOURCE_REQUIRING_INTENTS = new Set([
  "contract_dispute",
  "contract_review",
  "employment_dispute",
  "property_dispute",
  "rental_dispute",
  "divorce",
  "inheritance",
  "company_dispute",
  "criminal_defense",
  "check_dispute",
  "debt_recovery",
  "banking_dispute",
  "tax_consultation",
]);

/** Intents that are about a document the user supplied. */
const DOCUMENT_INTENTS = new Set(["contract_review", "contract_drafting"]);

/** Intents that are about an ongoing matter rather than a general question. */
const CASE_INTENTS = new Set([
  "contract_dispute",
  "employment_dispute",
  "property_dispute",
  "rental_dispute",
  "divorce",
  "inheritance",
  "company_dispute",
  "criminal_defense",
  "check_dispute",
  "debt_recovery",
  "banking_dispute",
]);

/** Risk markers that push a matter toward human lawyer review. */
const RISK_MARKERS: { pattern: RegExp; flag: string }[] = [
  { pattern: /کیفری|جرم|بازداشت|حبس|زندان|شکایت کیفری|کلاهبرداری|سرقت/, flag: "criminal_exposure" },
  { pattern: /مهلت|فوری|اضطرار|توقیف|بازداشت اموال|اجراییه/, flag: "deadline_or_seizure" },
  { pattern: /میلیارد|میلیون تومان|ارزش بالا/, flag: "high_value" },
  { pattern: /طلاق|مهریه|حضانت|نفقه/, flag: "family_sensitivity" },
];

/** Entity extraction — lightweight, deterministic, no model call. */
function extractEntities(text: string): string[] {
  const entities: string[] = [];

  const amount = text.match(/([\d۰-۹][\d۰-۹,]*)\s*(میلیون|میلیارد|هزار|ریال|تومان)/);
  if (amount) entities.push(`amount:${amount[0]}`);

  const date = text.match(/۱۴[\d۰-۹][\d۰-۹]\/[\d۰-۹]{1,2}\/[\d۰-۹]{1,2}/);
  if (date) entities.push(`date:${date[0]}`);

  const party = text.match(/(?:آقای|خانم|شرکت|آقا|خانوم)\s+([^\s،,]+)/);
  if (party) entities.push(`party:${party[0]}`);

  const city = text.match(
    /(تهران|مشهد|اصفهان|شیراز|تبریز|کرج|اهواز|قم|کرمانشاه|ارومیه|رشت|زاهدان|همدان|یزد|اردبیل|بندرعباس|اراک)/
  );
  if (city) entities.push(`location:${city[0]}`);

  return entities;
}

/**
 * Classify a user message. Always returns a classification — a message that
 * matches no known intent falls back to a general legal question so the
 * pipeline can still proceed.
 */
export function classifyMessage(
  text: string,
  hasDocumentContext: boolean
): PipelineClassification {
  const intent = detectIntent(text);
  const legalCategory = intent?.domain ?? "other";
  const intentKey = intent?.intent ?? "general_legal_question";
  const confidence = intent?.confidence ?? 0;

  const initialRiskFlags = RISK_MARKERS.filter((m) => m.pattern.test(text)).map((m) => m.flag);

  // A short, purely informational question ("سفته چیست؟") does not need a
  // multi-step intake — only matters that describe a real situation do.
  const isInformational =
    intentKey === "general_legal_question" && text.trim().split(/\s+/).length <= 8;

  const requiresSources = SOURCE_REQUIRING_INTENTS.has(intentKey) || !isInformational;
  const requiresDocumentContext = hasDocumentContext || DOCUMENT_INTENTS.has(intentKey);
  const requiresCaseContext = CASE_INTENTS.has(intentKey);
  const requiresClarification = !isInformational && confidence < 0.5;

  return {
    legalCategory,
    intent: intentKey,
    requiresSources,
    requiresDocumentContext,
    requiresCaseContext,
    requiresClarification,
    detectedEntities: extractEntities(text),
    initialRiskFlags,
    confidence,
  };
}
