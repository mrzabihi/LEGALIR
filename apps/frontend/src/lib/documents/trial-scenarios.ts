// ============================================================
// LEGALIR — Trial scenarios for document review (trial mode)
// ============================================================
// The «بررسی اسناد» page has two clearly separated states:
//
//   1. REAL analysis — available only when a model provider is actually
//      configured and responsive (see `@/hooks/useAiStatus`). Nothing here
//      is used on that path.
//   2. TRIAL mode — this module. Coherent, hand-authored sample data so a
//      user can see the result/chat/lawyer UI even before a model is
//      connected.
//
// HONESTY RULES (mirrors spec §1 / §10):
//   • Every scenario is a DEMO. It is the *user's own document* that is
//     never claimed to have been analysed — the trial report belongs to the
//     scenario, not to the uploaded file, and every surface that renders it
//     must carry {TRIAL_LABEL_FA}.
//   • Legal references use ONLY real project sources (the same law files the
//     knowledge base serves — see `lib/law-catalog.ts`), with real article
//     locators and the real excerpts. No article number is invented. Where a
//     finding has no verified source, `citation` stays null and the UI says
//     so honestly rather than guessing.
//   • Canned answers are scoped to their scenario and labelled trial; they
//     are never presented as the model's answer.
//
// This module is pure data (no fs, no network) so it is safe to import from
// client components — exactly like `lib/law-catalog.ts`.
// ============================================================

import type { Citation, LegalSource, RiskReport } from "@legalir/types";

/** The one label every trial surface must show. */
export const TRIAL_LABEL_FA = "نمونهٔ آزمایشی";

/** The one sentence every trial surface must show. */
export const TRIAL_DISCLAIMER_FA =
  "این یک دادهٔ نمایشی برای تست محصول است و تحلیل حقوقی معتبر به‌شمار نمی‌رود.";

// ============================================================
// Real, verified sources (subset of the project's law catalog)
// ------------------------------------------------------------
// These mirror `LAW_SOURCES` in `lib/law-catalog.ts` — the same law files the
// knowledge base exposes. Excerpts are the real catalog excerpts. Adding a
// source here without a corresponding real catalog entry would be fabrication,
// so the set is deliberately small and verifiable.
// ============================================================

/** Timestamp stamped on the fixtures — trial reports are generated, not live. */
const FIXTURE_RETRIEVED_AT = "2026-10-01T00:00:00.000Z";

const REAL_SOURCES = {
  /** ماده ۲۳۰ قانون مدنی — وجه التزام / شرط کیفری. */
  penaltyClause: {
    id: "law-penalty-clause",
    type: "law",
    title: "وجه التزام (شرط کیفری) — ماده ۲۳۰ قانون مدنی",
    authority: "مجلس شورای ملی",
    validFrom: "1307-02-18",
    validTo: null,
    status: "valid",
    jurisdiction: "جمهوری اسلامی ایران",
    retrievedAt: FIXTURE_RETRIEVED_AT,
  } satisfies LegalSource,

  /** قانون آیین دادرسی مدنی — صلاحیت و رسیدگی دادگاه‌ها. */
  civilProcedure: {
    id: "law-civil-procedure",
    type: "law",
    title: "قانون آیین دادرسی دادگاه‌های عمومی و انقلاب (در امور مدنی)",
    authority: "مجلس شورای اسلامی",
    validFrom: "1379-01-21",
    validTo: null,
    status: "valid",
    jurisdiction: "جمهوری اسلامی ایران",
    retrievedAt: FIXTURE_RETRIEVED_AT,
  } satisfies LegalSource,

  /** قانون اساسی — حق دادخواهی (اصل ۳۴). */
  constitution: {
    id: "law-constitution",
    type: "law",
    title: "قانون اساسی جمهوری اسلامی ایران",
    authority: "مجلس خبرگان قانون اساسی",
    validFrom: "1358-08-24",
    validTo: null,
    status: "valid",
    jurisdiction: "جمهوری اسلامی ایران",
    retrievedAt: FIXTURE_RETRIEVED_AT,
  } satisfies LegalSource,
} as const;

/** Real, verbatim-or-near excerpts taken from the project law catalog. */
const REAL_EXCERPTS = {
  penaltyClause:
    "اگر در ضمن معامله شرط شده باشد که در صورت تخلف، متخلف مبلغی به عنوان خسارت تأدیه نماید، حاکم نمی‌تواند او را به بیشتر یا کمتر از آنچه ملزم شده است محکوم کند.",
  civilProcedure:
    "ماده ۳: قضات دادگاه‌ها موظف‌اند موافق قوانین به دعاوی رسیدگی کرده، حکم صادر نمایند.",
  constitution:
    "اصل ۳۴: دادخواهی حق مسلّم هر فرد است و هر کس می‌تواند به منظور دادخواهی به دادگاه‌های صالح رجوع نماید.",
} as const;

type RealSourceKey = keyof typeof REAL_SOURCES;

/** Build a citation whose source is a real, catalogued legal source. */
function cite(
  id: string,
  sourceKey: RealSourceKey,
  locator: string,
  quoteKey: keyof typeof REAL_EXCERPTS
): Citation {
  const source = REAL_SOURCES[sourceKey];
  return {
    id,
    sourceId: source.id,
    locator,
    quote: REAL_EXCERPTS[quoteKey],
    source: { ...source },
  };
}

// ============================================================
// Scenario shape
// ============================================================

export type TrialScenarioId = "lease" | "car" | "contracting" | "nda";

export const TRIAL_SCENARIO_IDS: TrialScenarioId[] = [
  "lease",
  "car",
  "contracting",
  "nda",
];

/** A clickable trial question and its scenario-scoped canned answer. */
export interface TrialScenarioQuestion {
  /** The chip the user can tap. */
  questionFa: string;
  /** The canned answer shown as a trial assistant message. */
  answerFa: string;
}

export interface TrialScenario {
  id: TrialScenarioId;
  /** Short name of the scenario («اجاره‌نامهٔ مسکونی»). */
  titleFa: string;
  /** A file-name-like label of the SAMPLE document (never the user's file). */
  docLabelFa: string;
  /** One-line explanation of what the scenario demonstrates. */
  descriptionFa: string;
  /** Sample document text — the text the trial findings point into. */
  extractedText: string;
  /** The trial analysis (belongs to the scenario, not the user's document). */
  report: RiskReport;
  /** Trial questions whose answers are scoped to this scenario. */
  questions: TrialScenarioQuestion[];
}

/** The documentId prefix that marks every trial finding in the UI. */
export const TRIAL_DOCUMENT_PREFIX = "trial:";

/** True when a document id belongs to a trial scenario, not a real document. */
export function isTrialDocumentId(id: string | null | undefined): boolean {
  return !!id && id.startsWith(TRIAL_DOCUMENT_PREFIX);
}

/** Build the trial document id for a scenario. */
export function trialDocumentId(id: TrialScenarioId): string {
  return `${TRIAL_DOCUMENT_PREFIX}${id}`;
}

// ============================================================
// Scenario 1 — قرارداد اجارهٔ مسکونی
// ============================================================

const LEASE: TrialScenario = {
  id: "lease",
  titleFa: "اجاره‌نامهٔ مسکونی",
  docLabelFa: "اجاره‌نامه واحد مسکونی.pdf",
  descriptionFa:
    "قراردادی با شرط فسخ یک‌طرفه، جریمهٔ نامتناسب و ابهام در تمدید و تسویهٔ ودیعه.",
  extractedText: `قرارداد اجاره واحد مسکونی

بین موجر و مستأجر به شرح زیر توافق شد:

بند ۱ — مورد اجاره: یک باب واحد مسکونی به مساحت ۸۵ مترمربع.
بند ۲ — مدت اجاره: یک سال شمسی از تاریخ ۱۴۰۴/۰۷/۰۱.
بند ۳ — ودیعه: مبلغ ۵۰۰٬۰۰۰٬۰۰۰ ریال، قابل استرداد پس از تخلیه.
بند ۴ — اجاره‌بها: ماهانه ۳۰٬۰۰۰٬۰۰۰ ریال، پرداخت در ابتدای هر ماه.
بند ۵ — پرداخت قبوض آب، برق و گاز بر عهدهٔ مستأجر است.
بند ۶ — تعمیرات جزئی بر عهدهٔ مستأجر و تعمیرات اساسی بر عهدهٔ موجر است.
بند ۷ — در صورت تخلیه پیش از پایان مدت از سوی مستأجر، کل ودیعه به‌عنوان وجه التزام به موجر تعلق می‌گیرد.
بند ۸ — موجر می‌تواند در هر زمان با اخطار کتبی یک‌هفته‌ای قرارداد را فسخ کند.`,
  report: {
    documentId: trialDocumentId("lease"),
    summary:
      "این اجاره‌نامه از نظر شرایط فسخ، تمدید و تسویهٔ ودیعه چند نکتهٔ پرریسک دارد. مهم‌ترین آن، تعیین کل ودیعه به‌عنوان وجه التزام در فرض تخلیهٔ پیش از موعد است که ریسک مالی سنگینی برای مستأجر ایجاد می‌کند.",
    generatedAt: "2026-10-01T00:00:00.000Z",
    confidence: 74,
    findings: [
      {
        id: "trial-lease-f1",
        documentId: trialDocumentId("lease"),
        title: "تعیین کل ودیعه به‌عنوان وجه التزام",
        severity: "high",
        locator: "بند ۷",
        reason:
          "سند کل ودیعه را در فرض تخلیهٔ پیش از پایان مدت، وجه التزام قرار داده است. طبق ماده ۲۳۰ قانون مدنی، وقتی وجه التزام مقرر شود دادگاه نمی‌تواند متخلف را به کم‌تر از آن محکوم کند؛ پس این مبلغ بدون امکان تعدیل، به زیان مستأجر قابل مطالبه است.",
        recommendation:
          "مبلغ وجه التزام را متناسب و محدود تعیین کنید و آن را به تخلف از یک تعهد معین (مثلاً تخلیه بدون اخطار یک‌ماهه) مقید نمایید، نه به هر تخلیهٔ پیش از موعد.",
        citation: cite("cite-lease-230", "penaltyClause", "ماده ۲۳۰ قانون مدنی", "penaltyClause"),
        confidence: 80,
        kind: "contractual_risk",
      },
      {
        id: "trial-lease-f2",
        documentId: trialDocumentId("lease"),
        title: "حق فسخ یک‌طرفه و بدون دلیل برای موجر",
        severity: "high",
        locator: "بند ۸",
        reason:
          "موجر در هر زمان و تنها با اخطار یک‌هفته‌ای حق فسخ دارد؛ این شرط امنیت تصرف مستأجر را از بین می‌برد و تعادل قرارداد را بر هم می‌زند.",
        recommendation:
          "حق فسخ را متقابل کنید و آن را به تخلف طرف مقابل یا شرایط معین (مثل عدم پرداخت اجاره) محدود نمایید.",
        citation: null,
        confidence: 72,
        kind: "contractual_risk",
      },
      {
        id: "trial-lease-f3",
        documentId: trialDocumentId("lease"),
        title: "نحوهٔ تعدیل اجاره‌بها در تمدید مشخص نشده",
        severity: "medium",
        locator: "",
        reason:
          "برای سال‌های بعد مبلغ اجاره و شیوهٔ تعدیل آن تعیین نشده است؛ این ابهام می‌تواند در زمان تمدید به اختلاف منجر شود.",
        recommendation:
          "شیوهٔ تعدیل سالانه (توافق طرفین یا شاخص رسمی) را در متن قرارداد ذکر کنید.",
        citation: null,
        confidence: 66,
        kind: "incomplete_info",
      },
      {
        id: "trial-lease-f4",
        documentId: trialDocumentId("lease"),
        title: "شرایط تسویه و استرداد ودیعه روشن نیست",
        severity: "medium",
        locator: "بند ۳",
        reason:
          "مهلت بازرسی ملک و شرایط کسر بابت خسارت و زمان استرداد ودیعه در پایان مدت تعیین نشده است.",
        recommendation:
          "مهلت مشخص برای بازرسی ملک، شرایط کسر بابت خسارت و مهلت پرداخت ودیعه تعیین کنید.",
        citation: null,
        confidence: 64,
        kind: "incomplete_info",
      },
    ],
  },
  questions: [
    {
      questionFa: "جریمهٔ تخلیهٔ پیش از موعد در این قرارداد قانونی است؟",
      answerFa:
        "طبق ماده ۲۳۰ قانون مدنی، اگر شرط وجه التزام در قرارداد آمده باشد دادگاه نمی‌تواند متخلف را به بیش یا کم‌تر از مبلغ مقرر محکوم کند؛ پس با امضای بند ۷، کل ودیعه به‌عنوان وجه التزام قابل مطالبه است. توصیه می‌شود مبلغ را متناسب تعیین و به تخلف از یک تعهد معین مقید کنید.",
    },
    {
      questionFa: "آیا موجر می‌تواند یک‌طرفه قرارداد را فسخ کند؟",
      answerFa:
        "در اجاره‌نامهٔ با مدت معین، قرارداد نسبت به مدت توافق‌شده الزام‌آور است. شرط فسخ یک‌طرفهٔ موجر (بند ۸) تعادل قرارداد را بر هم می‌زند؛ بهتر است حق فسخ متقابل و مشروط به تخلف یا شرط معین شود.",
    },
    {
      questionFa: "وظیفهٔ تعمیرات بر عهدهٔ کیست؟",
      answerFa:
        "بر اساس بند ۶، تعمیرات جزئی بر عهدهٔ مستأجر و تعمیرات اساسی بر عهدهٔ موجر است. برای شفافیت، چند نمونهٔ «جزئی» و «اساسی» و مهلت انجام تعمیر را در قرارداد ذکر کنید.",
    },
    {
      questionFa: "برای استرداد ودیعه چه نکاتی را اضافه کنم؟",
      answerFa:
        "مهلت بازرسی ملک پس از تخلیه، شرایط کسر بابت خسارت و مهلت پرداخت ودیعه را صریح قید کنید تا در پایان مدت اختلاف پیش نیاید.",
    },
  ],
};

// ============================================================
// Scenario 2 — مبایعه‌نامهٔ خودرو
// ============================================================

const CAR: TrialScenario = {
  id: "car",
  titleFa: "مبایعه‌نامهٔ خودرو",
  docLabelFa: "مبایعه‌نامه خودرو.pdf",
  descriptionFa:
    "معاملهٔ خودرو با پرداخت اقساطی؛ ابهام در انتقال سند، مشخصات خودرو و وجه التزام تأخیر.",
  extractedText: `مبایعه‌نامه خودرو

بین فروشنده و خریدار به شرح زیر توافق شد:

بند ۱ — مورد معامله: یک دستگاه خودرو سواری، رنگ سفید، مدل ۱۳۹۸.
بند ۲ — قیمت کل: مبلغ ۴٬۵۰۰٬۰۰۰٬۰۰۰ ریال.
بند ۳ — پرداخت: ۱٬۰۰۰٬۰۰۰٬۰۰۰ ریال نقد و باقی‌مانده در دو قسط ظرف دو ماه.
بند ۴ — در صورت تأخیر در پرداخت هر قسط، خریدار ماهانه ۵٪ مبلغ قسط را به‌عنوان وجه التزام می‌پردازد.
بند ۵ — انتقال سند رسمی خودرو پس از تسویهٔ کامل انجام می‌شود.
بند ۶ — خلافی و جرائم تا تاریخ تحویل بر عهدهٔ فروشنده و پس از آن بر عهدهٔ خریدار است.
بند ۷ — بیمه و مالیات خودرو بر عهدهٔ خریدار است.`,
  report: {
    documentId: trialDocumentId("car"),
    summary:
      "این مبایعه‌نامه از نظر شرایط انتقال سند و مشخصات دقیق خودرو ناقص است و در کنار آن، وجه التزام تأخیر پرداخت سنگین تعیین شده است. پیش از امضا، این موارد باید تکمیل و تعدیل شوند.",
    generatedAt: "2026-10-01T00:00:00.000Z",
    confidence: 71,
    findings: [
      {
        id: "trial-car-f1",
        documentId: trialDocumentId("car"),
        title: "وجه التزام تأخیر پرداخت نامتناسب (۵٪ ماهانه)",
        severity: "high",
        locator: "بند ۴",
        reason:
          "پنج درصد ماهانه بر مبلغ قسط، در طول یک سال مبلغ قابل‌توجهی می‌شود. طبق ماده ۲۳۰ قانون مدنی این شرط الزام‌آور است و دادگاه نمی‌تواند آن را کاهش دهد.",
        recommendation:
          "نرخ را به مبلغی منطقی و متناسب با خسارت واقعی کاهش دهید و سقف کل وجه التزام را مشخص کنید.",
        citation: cite("cite-car-230", "penaltyClause", "ماده ۲۳۰ قانون مدنی", "penaltyClause"),
        confidence: 78,
        kind: "contractual_risk",
      },
      {
        id: "trial-car-f2",
        documentId: trialDocumentId("car"),
        title: "عدم تصریح به مهلت و شرایط انتقال سند",
        severity: "high",
        locator: "بند ۵",
        reason:
          "زمان و شرایط انتقال قطعی سند و تعهد فروشنده به رفع هرگونه توقیف یا رهن پیش از انتقال مشخص نشده است.",
        recommendation:
          "مهلت دقیق انتقال سند و تعهد فروشنده به رفع توقیف/رهن و تسویهٔ تعهدات پیشین را قید کنید.",
        citation: null,
        confidence: 76,
        kind: "incomplete_info",
      },
      {
        id: "trial-car-f3",
        documentId: trialDocumentId("car"),
        title: "مشخصات هویتی خودرو (شاسی و موتور) درج نشده",
        severity: "high",
        locator: "بند ۱",
        reason:
          "بدون شمارهٔ شاسی، شمارهٔ موتور و شمارهٔ پلاک، مورد معامله دقیقاً قابل تعیین نیست و امکان جابه‌جایی وجود دارد.",
        recommendation:
          "شمارهٔ شاسی، شمارهٔ موتور و شمارهٔ پلاک را در متن معامله قید کنید.",
        citation: null,
        confidence: 74,
        kind: "incomplete_info",
      },
      {
        id: "trial-car-f4",
        documentId: trialDocumentId("car"),
        title: "لحظهٔ دقیق تحویل و انتقال تعهدات مبهم است",
        severity: "medium",
        locator: "بند ۶",
        reason:
          "تقسیم خلافی و بیمه بر مبنای «تاریخ تحویل» است، اما تاریخ و ساعت دقیق تحویل مشخص نشده است.",
        recommendation:
          "تاریخ و ساعت دقیق تحویل و صورت‌جلسهٔ وضعیت ظاهری خودرو را تنظیم و ضمیمه کنید.",
        citation: null,
        confidence: 65,
        kind: "contractual_risk",
      },
    ],
  },
  questions: [
    {
      questionFa: "اگر خریدار قسط را پرداخت نکند، چه اقدامی می‌توانم بکنم؟",
      answerFa:
        "طبق ماده ۲۳۰ قانون مدنی می‌توانید وجه التزام مقرر در بند ۴ را مطالبه کنید؛ همین قانون به دادگاه اجازهٔ کاهش آن را نمی‌دهد، پس بهتر است نرخ از ابتدا متناسب تعیین شود. برای اصل مبلغ قسط نیز می‌توانید دادخواست مطالبهٔ وجه طرح کنید.",
    },
    {
      questionFa: "انتقال سند رسمی خودرو چگونه انجام می‌شود؟",
      answerFa:
        "انتقال قطعی در دفتر اسناد رسمی و با حضور طرفین انجام می‌شود. بهتر است مهلت آن و تعهد فروشنده به رفع توقیف/رهن پیش از انتقال را در بند ۵ ذکر کنید.",
    },
    {
      questionFa: "برای امنیت بیشتر معامله چه بندی اضافه کنم؟",
      answerFa:
        "تعهد فروشنده به رفع توقیف، جریمهٔ روزشمار تأخیر در انتقال سند، صورت‌جلسهٔ وضعیت خودرو و ضمانت (چک یا سفته) برای پرداخت اقساط را اضافه کنید.",
    },
    {
      questionFa: "چطور مطمئن شوم خودرو توقیف یا در رهن نیست؟",
      answerFa:
        "پیش از پرداخت، وضعیت توقیف و رهن و مالکیت فروشنده را استعلام کنید و مطابقت شمارهٔ شاسی و موتور با سند را بررسی نمایید. تا زمان انتقال رسمی، مبلغ عمده را پرداخت نکنید.",
    },
  ],
};

// ============================================================
// Scenario 3 — قرارداد خدمات پیمانکاری
// ============================================================

const CONTRACTING: TrialScenario = {
  id: "contracting",
  titleFa: "قرارداد خدمات پیمانکاری",
  docLabelFa: "قرارداد خدمات پیمانکاری.pdf",
  descriptionFa:
    "قرارداد خدمات فنی با شرط نامعتبر حل اختلاف، پرداخت مبهم و نبود جریمهٔ متناسب.",
  extractedText: `قرارداد خدمات پیمانکاری

بین کارفرما و پیمانکار به شرح زیر منعقد شد:

بند ۱ — موضوع: اجرای خدمات فنی و پشتیبانی نرم‌افزار.
بند ۲ — مدت: شش ماه از تاریخ ۱۴۰۴/۰۸/۰۱.
بند ۳ — مبلغ قرارداد: ۳۰٬۰۰۰٬۰۰۰٬۰۰۰ ریال.
بند ۴ — پرداخت: در چهار مرحله و بر اساس تأیید کارفرما.
بند ۵ — در صورت تأخیر پیمانکار، کارفرما می‌تواند قرارداد را فسخ کند.
بند ۶ — خروجی‌ها و مستندات متعلق به کارفرما است.
بند ۷ — پیمانکار متعهد است سطح خدمات را طبق نظر کارفرما تأمین کند.
بند ۸ — در صورت بروز اختلاف، طرفین حق مراجعه به دادگاه ندارند و حل اختلاف منحصراً با نظر کارفرما است.`,
  report: {
    documentId: trialDocumentId("contracting"),
    summary:
      "این قرارداد خدمات، یک ایراد حقوقی جدی (سلب حق مراجعه به دادگاه) و چند ابهام قراردادی در پرداخت، جریمهٔ تأخیر و سطح خدمات دارد. بند ۸ باید پیش از امضا اصلاح شود.",
    generatedAt: "2026-10-01T00:00:00.000Z",
    confidence: 77,
    findings: [
      {
        id: "trial-contract-f1",
        documentId: trialDocumentId("contracting"),
        title: "سلب حق مراجعه به دادگاه در حل اختلاف",
        severity: "critical",
        locator: "بند ۸",
        reason:
          "سپردن حل‌وفصل اختلاف به‌صورت یک‌طرفه به کارفرما و سلب حق مراجعه به دادگاه، با حق دادخواهی مقرر در اصل ۳۴ قانون اساسی مغایر است.",
        recommendation:
          "شرط داوری معتبر یا ارجاع به مرجع صالح قانونی را جایگزین کنید و حق مراجعه به دادگاه را حفظ نمایید.",
        citation: cite("cite-contract-constitution", "constitution", "اصل ۳۴ قانون اساسی", "constitution"),
        confidence: 85,
        kind: "conflict_with_law",
      },
      {
        id: "trial-contract-f2",
        documentId: trialDocumentId("contracting"),
        title: "شرایط پرداخت مبهم و وابسته به تأیید یک‌طرفه",
        severity: "high",
        locator: "بند ۴",
        reason:
          "بدون معیار عینی برای تأیید هر مرحله، پرداخت کاملاً به صلاحدید کارفرما وابسته است و راهی برای اعتراض به عدم تأیید پیش‌بینی نشده است.",
        recommendation:
          "معیارهای عینی تأیید هر مرحله و مهلت پرداخت را تعریف کنید و برای عدم تأیید، مسیر اعتراض بگذارید.",
        citation: null,
        confidence: 75,
        kind: "contractual_risk",
      },
      {
        id: "trial-contract-f3",
        documentId: trialDocumentId("contracting"),
        title: "نبود وجه التزام متناسب برای تأخیر طرفین",
        severity: "high",
        locator: "بند ۵",
        reason:
          "برای تأخیر پیمانکار وجه التزامی تعیین نشده و در مقابل، تأخیر پرداخت کارفرما هم بی‌ضمانت است. طبق ماده ۲۳۰ قانون مدنی، تعیین وجه التزام توافقی راه را برای مطالبهٔ خسارت روشن می‌کند.",
        recommendation:
          "جریمهٔ تأخیر متناسب با سقف مشخص را برای هر دو طرف پیش‌بینی کنید تا تعهدات متقابل و متعادل شوند.",
        citation: cite("cite-contract-230", "penaltyClause", "ماده ۲۳۰ قانون مدنی", "penaltyClause"),
        confidence: 73,
        kind: "contractual_risk",
      },
      {
        id: "trial-contract-f4",
        documentId: trialDocumentId("contracting"),
        title: "دامنهٔ مالکیت معنوی و حقوق پیمانکار روشن نیست",
        severity: "medium",
        locator: "بند ۶",
        reason:
          "واگذاری کلی خروجی‌ها به کارفرما، بدون تفکیک ابزارها و کتابخانه‌های پایهٔ پیمانکار، می‌تواند به اختلاف دربارهٔ حق استفادهٔ پیمانکار منجر شود.",
        recommendation:
          "دامنهٔ مالکیت را تفکیک کنید: کد و مستندات سفارشی برای کارفرما، ابزارها و کتابخانه‌های پایه برای پیمانکار.",
        citation: null,
        confidence: 68,
        kind: "incomplete_info",
      },
      {
        id: "trial-contract-f5",
        documentId: trialDocumentId("contracting"),
        title: "شاخص‌های سطح خدمات (SLA) بدون معیار عینی",
        severity: "medium",
        locator: "بند ۷",
        reason:
          "«طبق نظر کارفرما» معیار عینی ندارد و می‌تواند مبنای اختلاف در ارزیابی عملکرد شود.",
        recommendation:
          "شاخص‌های کمی پایداری، زمان پاسخ و پشتیبانی را با اعداد مشخص تعریف کنید.",
        citation: null,
        confidence: 66,
        kind: "incomplete_info",
      },
    ],
  },
  questions: [
    {
      questionFa: "آیا شرط «حل اختلاف فقط با نظر کارفرما» معتبر است؟",
      answerFa:
        "خیر؛ این شرط با حق دادخواهی در اصل ۳۴ قانون اساسی مغایر است. بهتر است یک شرط داوری معتبر یا ارجاع به دادگاه صالح را جایگزین کنید.",
    },
    {
      questionFa: "برای جریمهٔ تأخیر چه سقفی مناسب است؟",
      answerFa:
        "طبق ماده ۲۳۰ قانون مدنی وجه التزام الزام‌آور است و دادگاه نمی‌تواند آن را کاهش دهد؛ بنابراین مبلغ یا درصد را متناسب و با سقف کل روشن تعیین کنید و آن را برای هر دو طرف پیش‌بینی نمایید.",
    },
    {
      questionFa: "مالکیت معنوی خروجی‌ها را چطور تنظیم کنم؟",
      answerFa:
        "کد و مستندات سفارشی متعلق به کارفرما و ابزارها و کتابخانه‌های پایهٔ پیمانکار باقی بماند؛ این تفکیک را صریح در قرارداد بنویسید.",
    },
    {
      questionFa: "شرایط پرداخت را چطور شفاف‌تر کنم؟",
      answerFa:
        "هر مرحله را به یک تحویل قابل اندازه‌گیری و یک مهلت پرداخت مشخص گره بزنید و برای فرض عدم تأیید، مسیر اعتراض و مرجع رسیدگی تعیین کنید.",
    },
  ],
};

// ============================================================
// Scenario 4 — تعهدنامهٔ محرمانگی (NDA)
// ============================================================

const NDA: TrialScenario = {
  id: "nda",
  titleFa: "تعهدنامهٔ محرمانگی (NDA)",
  docLabelFa: "تعهدنامه محرمانگی.pdf",
  descriptionFa:
    "NDA با دامنهٔ اطلاعات نامحدود، مدت بدون پایان، نبود جریمهٔ نقض و مرجع اختلاف نامشخص.",
  extractedText: `تعهدنامه محرمانگی (NDA)

بین افشاکننده و دریافت‌کننده در خصوص حفاظت از اطلاعات محرمانه:

بند ۱ — اطلاعات محرمانه شامل کلیهٔ اطلاعات فنی، تجاری، مالی و هر اطلاعات دیگری است که افشاکننده ارائه می‌کند.
بند ۲ — دریافت‌کننده متعهد است اطلاعات محرمانه را محرمانه نگه دارد و صرفاً برای موضوع همکاری استفاده کند.
بند ۳ — تعهد محرمانگی به‌صورت نامحدود و بدون محدودیت زمانی ادامه دارد.
بند ۴ — دریافت‌کننده مسئول هرگونه افشای اطلاعات است.
بند ۵ — هیچ جریمه یا خسارت مشخصی برای نقض تعهد پیش‌بینی نشده است.
بند ۶ — مرجع حل اختلاف تعیین نشده است.`,
  report: {
    documentId: trialDocumentId("nda"),
    summary:
      "این تعهدنامهٔ محرمانگی دامنهٔ اطلاعات را بسیار گسترده و بدون استثنا تعریف کرده، مدت تعهد را نامحدود گذاشته و برای نقض تعهد، جریمه و مرجع اختلاف مشخصی تعیین نکرده است.",
    generatedAt: "2026-10-01T00:00:00.000Z",
    confidence: 70,
    findings: [
      {
        id: "trial-nda-f1",
        documentId: trialDocumentId("nda"),
        title: "دامنهٔ اطلاعات محرمانه بیش‌ازحد گسترده و بدون استثنا",
        severity: "high",
        locator: "بند ۱",
        reason:
          "شمول «هر اطلاعات دیگری» و نبود استثناهای مرسوم (اطلاعات عمومی، اطلاع پیشین، افشای الزامی قانونی) تعهد را نامتقارن و اجرای آن را دشوار می‌کند.",
        recommendation:
          "استثناهای استاندارد محرمانگی و الزام افشا به حکم قانون را در متن تعهدنامه ذکر کنید.",
        citation: null,
        confidence: 72,
        kind: "contractual_risk",
      },
      {
        id: "trial-nda-f2",
        documentId: trialDocumentId("nda"),
        title: "مدت تعهد نامحدود",
        severity: "medium",
        locator: "بند ۳",
        reason:
          "تعهد نامحدود زمانی در عمل غیرمنصفانه و دشوار است؛ رویهٔ متعارف، تعیین مدتی معقول پس از پایان همکاری است.",
        recommendation:
          "مدت معقول (مثلاً دو تا پنج سال) پس از خاتمهٔ همکاری را تعیین کنید.",
        citation: null,
        confidence: 68,
        kind: "contractual_risk",
      },
      {
        id: "trial-nda-f3",
        documentId: trialDocumentId("nda"),
        title: "نبود وجه التزام برای نقض تعهد محرمانگی",
        severity: "high",
        locator: "بند ۵",
        reason:
          "برای نقض تعهد محرمانگی جریمه‌ای تعیین نشده است؛ با تعیین وجه التزام توافقی، مطالبهٔ خسارت روشن‌تر می‌شود و طبق ماده ۲۳۰ قانون مدنی مبلغ توافق‌شده برای دادگاه الزام‌آور است.",
        recommendation:
          "مبلغ ثابت یا فرمول خسارت متناسب با اهمیت اطلاعات را در تعهدنامه تعیین کنید.",
        citation: cite("cite-nda-230", "penaltyClause", "ماده ۲۳۰ قانون مدنی", "penaltyClause"),
        confidence: 76,
        kind: "incomplete_info",
      },
      {
        id: "trial-nda-f4",
        documentId: trialDocumentId("nda"),
        title: "مرجع حل اختلاف تعیین نشده",
        severity: "medium",
        locator: "بند ۶",
        reason:
          "در نبود شرط داوری معتبر، اختلاف در صلاحیت دادگاه‌های عمومی مطرح می‌شود و مسیر رسیدگی از ابتدا روشن نیست.",
        recommendation:
          "شرط داوری معتبر یا تعیین صریح مرجع صالح را در تعهدنامه ذکر کنید.",
        citation: cite("cite-nda-proc", "civilProcedure", "ماده ۳ آیین دادرسی مدنی", "civilProcedure"),
        confidence: 64,
        kind: "incomplete_info",
      },
    ],
  },
  questions: [
    {
      questionFa: "مدت تعهد محرمانگی چقدر باید باشد؟",
      answerFa:
        "تعهد نامحدود زمانی در عمل غیرمنصفانه است؛ معمولاً مدتی معقول (دو تا پنج سال پس از پایان همکاری) توافق می‌شود و اطلاعات عمومی یا اطلاع پیشین از دامنهٔ تعهد خارج می‌گردد.",
    },
    {
      questionFa: "اگر طرف مقابل محرمانگی را نقض کند چه خسارتی قابل مطالبه است؟",
      answerFa:
        "اگر وجه التزام تعیین نشده باشد باید خسارت واقعی و اثبات‌شده مطالبه شود که کار سختی است. بهتر است مبلغ یا فرمول وجه التزام را در قرارداد بگنجانید؛ طبق ماده ۲۳۰ قانون مدنی مبلغ توافق‌شده الزام‌آور است.",
    },
    {
      questionFa: "چه اطلاعاتی باید محرمانه تلقی شود؟",
      answerFa:
        "دامنهٔ کنونی (بند ۱) بسیار گسترده است. اطلاعات محرمانه را دقیق تعریف کنید و استثناهای مرسوم (اطلاعات عمومی، اطلاع پیشین، افشای الزامی قانونی) را اضافه نمایید.",
    },
    {
      questionFa: "برای حل اختلاف چه بندی اضافه کنم؟",
      answerFa:
        "یک شرط داوری معتبر یا تعیین صریح مرجع صالح را اضافه کنید تا در صورت اختلاف، مسیر رسیدگی از ابتدا روشن باشد.",
    },
  ],
};

// ============================================================
// Registry
// ============================================================

export const TRIAL_SCENARIOS: TrialScenario[] = [LEASE, CAR, CONTRACTING, NDA];

const SCENARIO_BY_ID: Record<TrialScenarioId, TrialScenario> = {
  lease: LEASE,
  car: CAR,
  contracting: CONTRACTING,
  nda: NDA,
};

/** Look up a scenario by id. */
export function getTrialScenario(id: string | null | undefined): TrialScenario | undefined {
  if (!id) return undefined;
  return isTrialScenarioId(id) ? SCENARIO_BY_ID[id] : undefined;
}

/** Type guard for a scenario id. */
export function isTrialScenarioId(value: string | null | undefined): value is TrialScenarioId {
  return !!value && (TRIAL_SCENARIO_IDS as string[]).includes(value);
}
