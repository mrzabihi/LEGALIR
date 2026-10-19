// ============================================================
// LEGALIR — Judicial document-family routing (pure)
// ============================================================
// Which document a user needs (اظهارنامه / لایحه / دادخواست / شکواییه) is a
// LEGAL determination. This module therefore never decides — it produces a
// PROBABLE path from explicit textual signals, always marked as derived, and
// it says "undetermined" when the signals disagree or are absent.
//
// Rules that keep it honest:
//   • a derived suggestion is never "high" confidence;
//   • a user's explicit choice always wins (`basis: "user_choice"`);
//   • the civil/criminal boundary being unclear is a first-class answer
//     (`needsClarification`) rather than a coin flip;
//   • the reason and the triggering signals are shown to the user, so they can
//     disagree with the suggestion.
//
// No model call happens here — a model has no business deciding which legal
// instrument applies from a paragraph of prose.
// ============================================================

import type {
  JudicialConfidence,
  JudicialDocumentType,
  JudicialRouting,
} from "@legalir/types";

interface Signal {
  type: JudicialDocumentType;
  weight: number;
  /** Matched phrases, for the "why" line shown to the user. */
  phrases: string[];
  labelFa: string;
}

const SIGNAL_RULES: {
  type: JudicialDocumentType;
  weight: number;
  words: string[];
  labelFa: string;
}[] = [
  {
    type: "statement",
    weight: 2,
    labelFa: "ارسال اخطار رسمی به طرف مقابل",
    words: [
      "اظهارنامه",
      "اظهار نامه",
      "اخطار رسمی",
      "ابلاغ",
      "بابت چک",
      "وجه چک",
      "مطالبه وجه",
      "سفته",
      "دین",
      "طلب",
    ],
  },
  {
    type: "brief",
    weight: 2,
    labelFa: "ارائهٔ لایحه در پروندهٔ باز",
    words: [
      "لایحه",
      "پرونده",
      "شماره پرونده",
      "دادگاه",
      "دادنامه",
      "قرار",
      "دفاع",
      "خوانده",
      "خواهان",
      "دادگاه تجدیدنظر",
      "رسیدگی",
    ],
  },
  {
    type: "petition",
    weight: 2,
    labelFa: "طرح دعوای حقوقی",
    words: [
      "دادخواست",
      "طرح دعوا",
      "دعوای حقوقی",
      "الزام به",
      "خواسته",
      "بهای خواسته",
      "محکوم",
      "صلاحیت دادگاه",
    ],
  },
  {
    type: "complaint",
    weight: 2,
    labelFa: "طرح شکایت کیفری",
    words: [
      "شکواییه",
      "شکایت",
      "شاکی",
      "متهم",
      "مشتکی",
      "کلاهبرداری",
      "سرقت",
      "ضرب و جرح",
      "توهین",
      "کیفری",
      "دادسرا",
      "بازپرس",
    ],
  },
];

const CRIMINAL_HINTS = [
  "سرقت",
  "کلاهبرداری",
  "ضرب و جرح",
  "قتل",
  "توهین",
  "تهدید",
  "کیفری",
  "شکواییه",
  "شکایت",
  "دادسرا",
  "متهم",
];

const CIVIL_HINTS = [
  "چک",
  "سفته",
  "دین",
  "اجاره",
  "قرارداد",
  "مطالبه",
  "خسارت",
  "الزام به",
  "تخلیه",
  "وجه",
];

function normalizeText(s: string): string {
  return s.replace(/\u200c/g, " ").toLowerCase();
}

function collectSignals(narrative: string): Signal[] {
  const text = normalizeText(narrative);
  const out: Signal[] = [];
  for (const rule of SIGNAL_RULES) {
    const phrases = rule.words.filter((w) => text.includes(normalizeText(w)));
    if (phrases.length > 0) {
      out.push({
        type: rule.type,
        weight: rule.weight * phrases.length,
        phrases,
        labelFa: rule.labelFa,
      });
    }
  }
  return out;
}

/**
 * Derive a PROBABLE path from the narrative.
 *
 * `chosen` is the user's own explicit pick; when present it becomes the
 * routing basis and is never overridden by a derived guess.
 */
export function deriveJudicialRouting(
  narrative: string,
  chosen: JudicialDocumentType | null
): JudicialRouting {
  const now = new Date().toISOString();

  if (chosen) {
    return {
      suggested: chosen,
      basis: "user_choice",
      confidence: "high",
      reasonFa: "نوع سند را خود شما انتخاب کرده‌اید.",
      factorsFa: [],
      needsClarification: false,
      clarificationFa: null,
      decidedAt: now,
    };
  }

  const signals = collectSignals(narrative).sort((a, b) => b.weight - a.weight);
  const top = signals[0];
  const runnerUp = signals[1];

  // Nothing recognized — say so, and do not pretend to know.
  if (!top || top.weight === 0) {
    return {
      suggested: "undetermined",
      basis: "derived",
      confidence: "low",
      reasonFa:
        "هنوز نمی‌توان از شرح شما تشخیص داد کدام سند مناسب است. یک پرسش کوتاه می‌پرسیم تا مسیر را مشخص کنیم.",
      factorsFa: [],
      needsClarification: true,
      clarificationFa:
        "هدف شما از این درخواست کدام است: ارسال اخطار به طرف مقابل، ارائهٔ لایحه در پروندهٔ باز، طرح دعوای حقوقی، یا شکایت کیفری؟",
      decidedAt: now,
    };
  }

  // A near-tie means the text genuinely points both ways — ask, don't guess.
  const ambiguous = runnerUp !== undefined && top.weight - runnerUp.weight <= 1;

  const text = normalizeText(narrative);
  const criminalScore = CRIMINAL_HINTS.filter((w) => text.includes(w)).length;
  const civilScore = CIVIL_HINTS.filter((w) => text.includes(w)).length;
  const boundaryConfusing =
    criminalScore > 0 && civilScore > 0 && Math.abs(criminalScore - civilScore) <= 1;

  // Confidence never exceeds "medium" for a derived guess, and drops to "low"
  // when a competing signal exists.
  const confidence: JudicialConfidence = ambiguous ? "low" : "medium";
  const needsClarification = ambiguous || boundaryConfusing;

  const clarificationFa = boundaryConfusing
    ? "شرح شما هم نشانه‌های حقوقی دارد و هم کیفری. مشخص کنید موضوع یک مطالبهٔ مالی/قراردادی است یا یک واقعهٔ کیفری؟"
    : ambiguous
      ? "شرح شما به بیش از یک نوع سند اشاره دارد. کدام گزینه به وضعیت شما نزدیک‌تر است؟"
      : null;

  return {
    suggested: top.type,
    basis: "derived",
    confidence,
    reasonFa: `بر پایهٔ عبارت‌هایی که در شرح شما آمده، مسیر «${top.labelFa}» محتمل‌تر به نظر می‌رسد. این یک پیشنهاد است، نه تشخیص نهایی.`,
    factorsFa: top.phrases.slice(0, 4),
    needsClarification,
    clarificationFa,
    decidedAt: now,
  };
}

/** Persian label for the confidence, used beside the suggestion. */
export const JUDICIAL_CONFIDENCE_FA: Record<JudicialConfidence, string> = {
  low: "اطمینان کم",
  medium: "اطمینان متوسط",
  high: "انتخاب شما",
};
