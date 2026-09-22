// ============================================================
// LEGALIR — Legal Intelligence Pipeline: stage configuration
// ============================================================
// The single source of truth for the five pipeline stages and their
// user-facing Persian copy. Components must read labels from here rather
// than hardcoding strings, so the copy can be reviewed in one place.
//
// These are NOT court stages. They describe LEGALIR's internal process for
// turning a user message into a grounded legal answer.
// ============================================================

import { PROCESSING_STAGES, type ProcessingStage } from "@legalir/types";

export interface StageConfig {
  stage: ProcessingStage;
  /** 1-based position, matching the user-facing «مرحله N از ۵». */
  order: number;
  /** Short stage title, e.g. «بررسی منابع». */
  label: string;
  /** One-line description of what is happening right now. */
  description: string;
}

export const STAGE_CONFIG: Record<ProcessingStage, StageConfig> = {
  IDENTIFY: {
    stage: "IDENTIFY",
    order: 1,
    label: "شناسایی مسئله",
    description: "در حال تشخیص موضوع درخواست شما",
  },
  UNDERSTAND: {
    stage: "UNDERSTAND",
    order: 2,
    label: "تکمیل اطلاعات",
    description: "در حال بررسی جزئیات و اطلاعات لازم",
  },
  RESEARCH: {
    stage: "RESEARCH",
    order: 3,
    label: "بررسی منابع",
    description: "در حال بررسی قوانین و منابع مرتبط",
  },
  ANALYZE: {
    stage: "ANALYZE",
    order: 4,
    label: "تحلیل حقوقی",
    description: "در حال تطبیق اطلاعات شما با منابع حقوقی",
  },
  RESPOND: {
    stage: "RESPOND",
    order: 5,
    label: "آماده‌سازی پاسخ",
    description: "در حال آماده‌سازی پاسخ و اقدام بعدی",
  },
};

export const TOTAL_STAGES = PROCESSING_STAGES.length;

/** Ordered stage configs, index 0 = stage 1. */
export const STAGE_ORDER: StageConfig[] = PROCESSING_STAGES.map((s) => STAGE_CONFIG[s]);

/** 1-based stage number for a stage key. */
export function stageNumber(stage: ProcessingStage): number {
  return STAGE_CONFIG[stage].order;
}

/** The stage that follows `stage`, or null when it is the last one. */
export function nextStage(stage: ProcessingStage): ProcessingStage | null {
  const idx = PROCESSING_STAGES.indexOf(stage);
  if (idx < 0 || idx >= PROCESSING_STAGES.length - 1) return null;
  return PROCESSING_STAGES[idx + 1]!;
}
