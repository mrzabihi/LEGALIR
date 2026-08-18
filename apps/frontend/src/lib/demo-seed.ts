// ============================================================
// LEGALIR — Demo Content Seed & Query Layer (server-only)
// ============================================================
// Backs the v1.0.0 demo dataset for the «اسناد من», «قراردادهای من» and
// «حافظه» sections with one coherent persona: امیر رضایی (مدیر شرکت خدمات
// فنی و مهندسی رهام پارس). The seed is deterministic + idempotent (guarded
// by a `demo_meta` seed_version) so re-running never duplicates rows.
//
// The rows are persisted in .data/*.json using the exact API response shapes
// from @legalir/types, so the API routes can read and return them directly.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import type {
  V1DocumentDetail,
  DocumentJob,
  V1ContractDetail,
  V1ContractVersionDetail,
  V1ContractClause,
  V1ContractRiskAnalysis,
  V1MemoryItem,
} from "@legalir/types";

const DATA_DIR = path.resolve(process.cwd(), ".data");

export const DEMO_USER_MOBILE = "09120000003";
export const DEMO_SEED_VERSION = "legalir-demo-v3";

// ============================================================
// JSON-DB primitives (self-contained to avoid a circular import
// with db.ts, which imports this module).
// ============================================================

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readTable<T>(name: string): T[] {
  ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T[];
  } catch {
    return [];
  }
}

function writeTable<T>(name: string, data: T[]): void {
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2), "utf-8");
}

// ============================================================
// Demo relationship model (cross-resource)
// ============================================================

export interface DemoRelationship {
  id: string;
  userId: string;
  sourceType: "document" | "contract" | "memory" | "conversation";
  sourceId: string;
  targetType: "document" | "contract" | "memory" | "conversation";
  targetId: string;
  relation: string; // e.g. "generated-from", "analyzes", "references"
  relationFa: string;
}

// ============================================================
// Deterministic helper builders
// ============================================================

function completedJobs(documentId: string): DocumentJob[] {
  return [
    { id: `${documentId}-job-uploaded`, documentId, stage: "uploaded", status: "completed", progress: 100, errorCode: null },
    { id: `${documentId}-job-processing`, documentId, stage: "processing", status: "completed", progress: 100, errorCode: null },
    { id: `${documentId}-job-extracting`, documentId, stage: "extracting", status: "completed", progress: 100, errorCode: null },
    { id: `${documentId}-job-analyzing`, documentId, stage: "analyzing", status: "completed", progress: 100, errorCode: null },
  ];
}

function processingJobs(documentId: string): DocumentJob[] {
  return [
    { id: `${documentId}-job-uploaded`, documentId, stage: "uploaded", status: "completed", progress: 100, errorCode: null },
    { id: `${documentId}-job-processing`, documentId, stage: "processing", status: "completed", progress: 100, errorCode: null },
    { id: `${documentId}-job-extracting`, documentId, stage: "extracting", status: "running", progress: 62, errorCode: null },
    { id: `${documentId}-job-analyzing`, documentId, stage: "analyzing", status: "pending", progress: 0, errorCode: null },
  ];
}

function failedJobs(documentId: string): DocumentJob[] {
  return [
    { id: `${documentId}-job-uploaded`, documentId, stage: "uploaded", status: "completed", progress: 100, errorCode: null },
    { id: `${documentId}-job-processing`, documentId, stage: "processing", status: "completed", progress: 100, errorCode: null },
    { id: `${documentId}-job-extracting`, documentId, stage: "extracting", status: "failed", progress: 40, errorCode: "OCR_LOW_QUALITY" },
  ];
}

// ============================================================
// Documents
// ============================================================

const DOC_EMP = "doc-emp-001";
const DOC_CTR = "doc-ctr-001";
const DOC_NDA = "doc-nda-001";
const DOC_BOARD = "doc-board-001";
const DOC_LICENSE = "doc-license-001";
const DOC_CHECK = "doc-check-001";

const demoDocuments = (userId: string): V1DocumentDetail[] => [
  {
    id: DOC_EMP,
    userId,
    name: "قرارداد-کار-و-تعهدات-بیمه.pdf",
    mime: "application/pdf",
    sizeBytes: 161_000,
    status: "ready",
    storageKey: "demo-documents/قرارداد-کار-و-تعهدات-بیمه.pdf",
    createdAt: "2026-08-02T08:30:00Z",
    updatedAt: "2026-08-02T09:15:00Z",
    jobs: completedJobs(DOC_EMP),
    report: {
      documentId: DOC_EMP,
      summary: "در این قرارداد کار ۵ مورد نیازمند توجه شناسایی شد؛ شامل ۱ مورد بحرانی و ۲ مورد با ریسک بالا.",
      findings: [
        {
          id: "find-emp-1",
          documentId: DOC_EMP,
          title: "ابهام در دوره آزمایشی",
          severity: "high",
          locator: "ماده ۲، صفحه ۱",
          reason: "مدت دوره آزمایشی سه ماه تعیین شده اما معیارهای عینی «عدم تأیید عملکرد» برای فسخ در این دوره تعریف نشده است که می‌تواند زمینه اختلاف را فراهم کند.",
          recommendation: "شاخص‌های قابل سنجش عملکرد و فرایند ارزیابی دوره آزمایشی را به صورت شفاف در قرارداد قید کنید.",
          citation: null,
          confidence: 0.89,
        },
        {
          id: "find-emp-2",
          documentId: DOC_EMP,
          title: "حق بیمه تأمین اجتماعی",
          severity: "critical",
          locator: "ماده ۴، صفحه ۱",
          reason: "با وجود اشاره به تکلیف بیمه، سهم دقیق حق بیمه و مهلت واریز مشخص نشده است. طبق ماده ۳۹ قانون تأمین اجتماعی، عدم پرداخت حق بیمه مسئولیت کارفرما را به دنبال دارد.",
          recommendation: "سهم کارگر (۷٪)، کارفرما (۲۰٪) و دولت (۳٪) و مهلت واریز را به‌صراحت درج کنید.",
          citation: null,
          confidence: 0.93,
        },
        {
          id: "find-emp-3",
          documentId: DOC_EMP,
          title: "شرط عدم رقابت گسترده",
          severity: "high",
          locator: "ماده ۱۰، صفحه ۲",
          reason: "شرط عدم رقابت یک‌ساله پس از خاتمه، بدون تعیین محدوده جغرافیایی و موضوعی تنظیم شده و ممکن است خلاف آزادی اشتغال تلقی شود.",
          recommendation: "دامنه عدم رقابت را به فعالیت‌های مشخص و رقبای مستقیم محدود و برای آن جبران مالی پیش‌بینی کنید.",
          citation: null,
          confidence: 0.85,
        },
        {
          id: "find-emp-4",
          documentId: DOC_EMP,
          title: "ابهام در اضافه‌کاری",
          severity: "medium",
          locator: "ماده ۵، صفحه ۱",
          reason: "نرخ فوق‌العاده اضافه‌کاری و سقف ساعات اضافه‌کاری مطابق ماده ۵۹ قانون کار قید نشده است.",
          recommendation: "نرخ اضافه‌کاری (۴۰٪ بالاتر از مزد عادی) و سقف ساعات را صریحاً تعیین کنید.",
          citation: null,
          confidence: 0.8,
        },
        {
          id: "find-emp-5",
          documentId: DOC_EMP,
          title: "عدم ذکر سند مالیاتی",
          severity: "low",
          locator: "ماده ۳، صفحه ۱",
          reason: "نحوه ارائه حکم حقوقی و سازوکار کسر مالیات بر درآمد حقوق قید نشده است.",
          recommendation: "ترتیب صدور فیش حقوقی و کسر مالیات را مطابق قانون مالیات‌های مستقیم شفاف کنید.",
          citation: null,
          confidence: 0.72,
        },
      ],
      generatedAt: "2026-08-02T09:15:00Z",
      confidence: 0.84,
    },
    extractedText:
      "قرارداد کار و تعهدات بیمه تأمین اجتماعی\nاین قرارداد مطابق ماده ۷ قانون کار جمهوری اسلامی ایران و مقررات سازمان تأمین اجتماعی، فی‌مابین «شرکت خدمات فنی و مهندسی رهام پارس» به نمایندگی آقای امیر رضایی (کارفرما) و آقای سعید مرادی به شماره ملی ۰۰۷۹۸۵۴۳۲۱ (کارمند) منعقد می‌گردد. ماده ۱ موضوع قرارداد: اشتغال کارمند در سمت کارشناس ارشد شبکه و زیرساخت. ماده ۲ مدت قرارداد: یک سال شمسی از ۱۴۰۵/۰۳/۰۱ با سه ماه دوره آزمایشی. ماده ۳ حقوق و مزایا: ماهانه ۱۸۵/۰۰۰/۰۰۰ ریال. ماده ۴ بیمه تأمین اجتماعی...",
    previewUrl: "/demo-documents/قرارداد-کار-و-تعهدات-بیمه.pdf",
  },
  {
    id: DOC_CTR,
    userId,
    name: "قرارداد-پیمانکاری-خدمات-فنی.pdf",
    mime: "application/pdf",
    sizeBytes: 154_000,
    status: "ready",
    storageKey: "demo-documents/قرارداد-پیمانکاری-خدمات-فنی.pdf",
    createdAt: "2026-07-25T10:00:00Z",
    updatedAt: "2026-07-25T11:20:00Z",
    jobs: completedJobs(DOC_CTR),
    report: {
      documentId: DOC_CTR,
      summary: "در این قرارداد پیمانکاری ۳ مورد نیازمند توجه شناسایی شد؛ سطح کلی ریسک متوسط است.",
      findings: [
        {
          id: "find-ctr-1",
          documentId: DOC_CTR,
          title: "جریمه تأخیر نامشخص",
          severity: "medium",
          locator: "ماده ۷، صفحه ۲",
          reason: "جریمه تأخیر به‌صورت «یک‌دهم درصد از مبلغ قرارداد به ازای هر روز» تعیین شده اما سقف کلی جریمه تعیین نشده است.",
          recommendation: "سقف تجمیعی جریمه (مثلاً ۱۰٪ مبلغ قرارداد) را مشخص کنید.",
          citation: null,
          confidence: 0.82,
        },
        {
          id: "find-ctr-2",
          documentId: DOC_CTR,
          title: "سطح خدمات (SLA)",
          severity: "medium",
          locator: "ماده ۴، صفحه ۱",
          reason: "زمان پاسخگویی و رفع اشکال ذکر شده اما نحوه محاسبه «ساعت کاری» و مرجع رسیدگی به نقض SLA تعیین نشده است.",
          recommendation: "تعریف ساعت کاری، سازوکار ثبت تیکت و مرجع داوری فنی را شفاف کنید.",
          citation: null,
          confidence: 0.78,
        },
        {
          id: "find-ctr-3",
          documentId: DOC_CTR,
          title: "مالکیت مستندات",
          severity: "low",
          locator: "ماده ۵، صفحه ۱",
          reason: "مالکیت مستندات و گزارش‌های تولیدشده توسط پیمانکار مشخص نشده است.",
          recommendation: "مالکیت معنوی مستندات و تحویل آن‌ها در پایان قرارداد را قید کنید.",
          citation: null,
          confidence: 0.71,
        },
      ],
      generatedAt: "2026-07-25T11:20:00Z",
      confidence: 0.77,
    },
    extractedText:
      "قرارداد پیمانکاری خدمات فنی و پشتیبانی شبکه\nفی‌مابین «شرکت خدمات فنی و مهندسی رهام پارس» به نمایندگی آقای امیر رضایی (کارفرما) و «شرکت پشتیبانی شبکه داده‌گستر» به نمایندگی آقای بهنام صادقی (پیمانکار). ماده ۱ موضوع: ارائه خدمات پشتیبانی و نگهداری زیرساخت شبکه. ماده ۳ مبلغ: ۲/۴۰۰/۰۰۰/۰۰۰ ریال. ماده ۴ سطح خدمات: پاسخگویی ۴ ساعت و رفع ۲۴ ساعت کاری...",
    previewUrl: "/demo-documents/قرارداد-پیمانکاری-خدمات-فنی.pdf",
  },
  {
    id: DOC_NDA,
    userId,
    name: "توافقنامه-محرمانگی-NDA.pdf",
    mime: "application/pdf",
    sizeBytes: 154_000,
    status: "ready",
    storageKey: "demo-documents/توافقنامه-محرمانگی-NDA.pdf",
    createdAt: "2026-07-18T14:00:00Z",
    updatedAt: "2026-07-18T15:05:00Z",
    jobs: completedJobs(DOC_NDA),
    report: {
      documentId: DOC_NDA,
      summary: "توافقنامه محرمانگی با ۲ مورد نیازمند توجه شناسایی شد؛ سطح ریسک متوسط ارزیابی می‌شود.",
      findings: [
        {
          id: "find-nda-1",
          documentId: DOC_NDA,
          title: "دامنه اطلاعات محرمانه",
          severity: "medium",
          locator: "ماده ۱، صفحه ۱",
          reason: "تعریف اطلاعات محرمانه بسیار کلی است و مرز میان اطلاعات محرمانه و غیرمحرمانه به‌وضوح ترسیم نشده است.",
          recommendation: "فهرست مصداقی اطلاعات محرمانه و روش علامت‌گذاری آن‌ها را مشخص کنید.",
          citation: null,
          confidence: 0.81,
        },
        {
          id: "find-nda-2",
          documentId: DOC_NDA,
          title: "جبران خسارت",
          severity: "medium",
          locator: "ماده ۶، صفحه ۱",
          reason: "مکانیزم ارزیابی و جبران خسارت ناشی از نقض محرمانگی به‌صورت کلی ذکر شده و قابل اجرا نیست.",
          recommendation: "سازوکار تعیین خسارت، وجه التزام و مرجع صالح را شفاف کنید.",
          citation: null,
          confidence: 0.76,
        },
      ],
      generatedAt: "2026-07-18T15:05:00Z",
      confidence: 0.79,
    },
    extractedText:
      "توافقنامه عدم افشای اطلاعات (NDA)\nفی‌مابین «شرکت خدمات فنی و مهندسی رهام پارس» (افشاکننده) و «شرکت توسعه نرم‌افزار آریا» (گیرنده). ماده ۱ تعریف اطلاعات محرمانه. ماده ۲ تعهدات گیرنده. ماده ۳ مدت اعتبار: سه سال. ماده ۴ استثنائات. ماده ۵ بازگشت اطلاعات. ماده ۶ جبران خسارت. ماده ۷ حل اختلاف...",
    previewUrl: "/demo-documents/توافقنامه-محرمانگی-NDA.pdf",
  },
  {
    id: DOC_BOARD,
    userId,
    name: "صورتجلسه-هیئت-مدیره-رهام-پارس.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 88_000,
    status: "ready",
    storageKey: null,
    createdAt: "2026-07-12T09:00:00Z",
    updatedAt: "2026-07-12T10:00:00Z",
    jobs: completedJobs(DOC_BOARD),
    report: {
      documentId: DOC_BOARD,
      summary: "صورتجلسه هیئت‌مدیره با ۱ مورد کم‌اهمیت شناسایی شد؛ ریسک کلی پایین است.",
      findings: [
        {
          id: "find-board-1",
          documentId: DOC_BOARD,
          title: "امضای صورتجلسه",
          severity: "low",
          locator: "بخش پایانی، صفحه ۲",
          reason: "نام و سمت امضاکنندگان صورتجلسه به‌صورت کامل درج نشده و شماره مصوبه درج نگردیده است.",
          recommendation: "نام کامل، سمت و شماره مصوبه هر بند را ثبت کنید.",
          citation: null,
          confidence: 0.9,
        },
      ],
      generatedAt: "2026-07-12T10:00:00Z",
      confidence: 0.9,
    },
    extractedText:
      "صورتجلسه هیئت‌مدیره شرکت خدمات فنی و مهندسی رهام پارس\nموضوع: تصویب برنامه توسعه و بودجه سالانه. حاضرین: امیر رضایی (مدیرعامل و رئیس هیئت‌مدیره)، ...",
    previewUrl: null,
  },
  {
    id: DOC_LICENSE,
    userId,
    name: "درخواست-پروانه-کسب-و-مدارک.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 210_000,
    status: "processing",
    storageKey: null,
    createdAt: "2026-08-15T09:30:00Z",
    updatedAt: "2026-08-15T09:32:00Z",
    jobs: processingJobs(DOC_LICENSE),
    report: null,
    extractedText: null,
    previewUrl: null,
  },
  {
    id: DOC_CHECK,
    userId,
    name: "تصویر-چک-برگشتی.jpg",
    mime: "image/jpeg",
    sizeBytes: 1_240_000,
    status: "failed",
    storageKey: null,
    createdAt: "2026-08-14T13:00:00Z",
    updatedAt: "2026-08-14T13:02:00Z",
    jobs: failedJobs(DOC_CHECK),
    report: null,
    extractedText: null,
    previewUrl: null,
  },
];

// ============================================================
// Contracts
// ============================================================

const CNT_EMP = "cnt-emp-001";
const CNT_NDA = "cnt-nda-001";
const CNT_CTR = "cnt-ctr-001";
const CNT_PART = "cnt-part-001";
const CNT_SAAS = "cnt-saas-001";

const DISCLAIMER =
  "این متن به صورت خودکار توسط هوش مصنوعی LEGALIR تولید شده و صرفاً یک پیش‌نویس است. این متن نباید به عنوان سند قانونی نهایی تلقی شود. پیش از استفاده، حتماً آن را توسط یک وکیل متخصص بررسی و تأیید کنید. LEGALIR هیچ مسئولیتی در قبال استفاده از این پیش‌نویس بدون بررسی حقوقی ندارد.";

function clauses(
  id: string,
  items: [string, string, boolean, "essential" | "recommended" | "optional"][]
): V1ContractClause[] {
  return items.map(([title, content, isProtective, importance], i) => ({
    id: `${id}-cl-${i + 1}`,
    title,
    content,
    isProtective,
    importance,
  }));
}

const empClauses = clauses(CNT_EMP, [
  ["ماده ۱ - موضوع قرارداد", "اشتغال کارمند در سمت کارشناس ارشد شبکه و زیرساخت در واحد فنی شرکت.", false, "essential"],
  ["ماده ۲ - مدت قرارداد", "یک سال شمسی از ۱۴۰۵/۰۳/۰۱ با سه ماه دوره آزمایشی.", false, "essential"],
  ["ماده ۳ - حقوق و مزایا", "ماهیانه ۱۸۵/۰۰۰/۰۰۰ ریال به همراه مزایای قانونی.", false, "essential"],
  ["ماده ۴ - بیمه تأمین اجتماعی", "کارفرما مکلف به بیمه نمودن کارمند از تاریخ شروع به کار است.", true, "essential"],
  ["ماده ۵ - ساعات کار", "۴۴ ساعت در هفته مطابق ماده ۵۱ قانون کار.", false, "recommended"],
  ["ماده ۸ - اسرار و محرمانگی", "کارمند موظف به حفظ محرمانگی اطلاعات شرکت است.", true, "essential"],
]);

function empVersion(userId: string, n: number, salary: string, state: V1ContractVersionDetail["state"], date: string): V1ContractVersionDetail {
  return {
    id: `${CNT_EMP}-ver-${n}`,
    contractId: CNT_EMP,
    versionNumber: n,
    answers: {
      company_name: "شرکت خدمات فنی و مهندسی رهام پارس",
      employer_name: "امیر رضایی",
      employee_name: "سعید مرادی",
      employee_id: "۰۰۷۹۸۵۴۳۲۱",
      position: "کارشناس ارشد شبکه و زیرساخت",
      salary,
      start_date: "۱۴۰۵/۰۳/۰۱",
      probation_months: "۳",
      work_hours: "۴۴",
      benefits: "بیمه تأمین اجتماعی، بن کارگری، حق اولاد",
    },
    content: `قرارداد کار\nبین «شرکت خدمات فنی و مهندسی رهام پارس» به نمایندگی امیر رضایی (کارفرما) و سعید مرادی (کارمند) منعقد می‌گردد.\n\nماده ۱ - موضوع قرارداد: اشتغال در سمت کارشناس ارشد شبکه و زیرساخت.\nماده ۲ - مدت قرارداد: یک سال شمسی از ۱۴۰۵/۰۳/۰۱ با سه ماه دوره آزمایشی.\nماده ۳ - حقوق و مزایا: ماهیانه ${salary} ریال.\nماده ۴ - بیمه تأمین اجتماعی: کارفرما مکلف به بیمه نمودن کارمند است.\nماده ۵ - ساعات کار: ۴۴ ساعت در هفته.`,
    clauses: empClauses,
    state,
    createdAt: date,
  };
}

const empAnalysis: V1ContractRiskAnalysis = {
  contractId: CNT_EMP,
  overallRisk: "high",
  findings: [
    { id: "rf-emp-1", title: "ابهام در دوره آزمایشی", severity: "high", description: "معیار ارزیابی دوره آزمایشی شفاف نیست.", clauseRef: `${CNT_EMP}-cl-2`, suggestion: "شاخص‌های سنجش عملکرد را تعیین کنید." },
    { id: "rf-emp-2", title: "سهم حق بیمه نامشخص", severity: "critical", description: "سهم دقیق حق بیمه و مهلت واریز قید نشده است.", clauseRef: `${CNT_EMP}-cl-4`, suggestion: "سهم کارگر، کارفرما و دولت و مهلت واریز را درج کنید." },
    { id: "rf-emp-3", title: "شرط عدم رقابت گسترده", severity: "high", description: "دامنه عدم رقابت بدون محدوده جغرافیایی و موضوعی است.", clauseRef: null, suggestion: "محدوده و جبران مالی شرط عدم رقابت را تعیین کنید." },
  ],
  protectiveSuggestions: [
    { id: "ps-emp-1", title: "بند بیمه تأمین اجتماعی", content: "کارفرما متعهد است حداکثر ظرف پانزده روز از شروع کار، کارمند را نزد شعبه ذی‌ربط سازمان تأمین اجتماعی معرفی و حق بیمه سهم خود و کارمند را در مواعد قانونی پرداخت نماید.", isProtective: true, importance: "essential" },
    { id: "ps-emp-2", title: "بند محرمانگی", content: "کارمند متعهد است اطلاعات فنی و تجاری شرکت را محرمانه تلقی و از افشای آن خودداری نماید.", isProtective: true, importance: "recommended" },
  ],
  generatedAt: "2026-08-04T09:00:00Z",
};

const demoContracts = (userId: string): V1ContractDetail[] => [
  {
    id: CNT_EMP,
    userId,
    title: "قرارداد استخدام مدیر فنی",
    type: "employment",
    typeFa: "استخدام",
    category: "business",
    state: "under_review",
    currentVersionId: `${CNT_EMP}-ver-3`,
    currentVersionNumber: 3,
    versions: [
      empVersion(userId, 1, "۱۵۰/۰۰۰/۰۰۰", "generated", "2026-08-02T10:00:00Z"),
      empVersion(userId, 2, "۱۷۰/۰۰۰/۰۰۰", "generated", "2026-08-03T11:00:00Z"),
      empVersion(userId, 3, "۱۸۵/۰۰۰/۰۰۰", "under_review", "2026-08-04T09:00:00Z"),
    ],
    analysis: empAnalysis,
    attachments: [
      {
        id: "att-emp-law-001",
        fileName: "قانون-کار-مصوب-1369.pdf",
        title: "قانون کار جمهوری اسلامی ایران",
        kind: "law",
        kindFa: "قانون",
        uploadedAt: "2026-08-02T10:10:00Z",
        sections: [
          { id: "s-emp-law-1", title: "ماده ۷ — قرارداد کار", content: "قرارداد کار عبارت است از قرارداد کتبی یا شفاهی که به موجب آن کارگر در قبال دریافت حقالسعی، کاری را برای مدت موقت یا غیرموقت برای کارفرما انجام می‌دهد." },
          { id: "s-emp-law-2", title: "ماده ۲۴ — خاتمه قرارداد", content: "در صورت فسخ قرارداد کار، کارفرما مکلف به پرداخت کلیه حقوق و مزایای قانونی کارگر تا تاریخ خاتمه قرارداد می‌باشد." },
        ],
      },
      {
        id: "att-emp-reg-001",
        fileName: "قانون-تامین-اجتماعی-1354.pdf",
        title: "قانون تأمین اجتماعی مصوب ۱۳۵۴",
        kind: "law",
        kindFa: "قانون",
        uploadedAt: "2026-08-02T10:15:00Z",
        sections: [
          { id: "s-emp-reg-1", title: "ماده ۳۹ — حق بیمه", content: "حق بیمه ماهانه معادل سی درصد دستمزد مشمول بیمه است که هفت درصد آن سهم کارمند، بیست درصد سهم کارفرما و سه درصد سهم دولت می‌باشد." },
        ],
      },
    ],
    createdAt: "2026-08-02T10:00:00Z",
    updatedAt: "2026-08-04T09:00:00Z",
    disclaimer: DISCLAIMER,
  },
  {
    id: CNT_NDA,
    userId,
    title: "توافقنامه محرمانگی (NDA)",
    type: "nda",
    typeFa: "NDA",
    category: "business",
    state: "generated",
    currentVersionId: `${CNT_NDA}-ver-2`,
    currentVersionNumber: 2,
    versions: [
      {
        id: `${CNT_NDA}-ver-1`,
        contractId: CNT_NDA,
        versionNumber: 1,
        answers: { discloser: "شرکت خدمات فنی و مهندسی رهام پارس", recipient: "شرکت توسعه نرم‌افزار آریا", term_months: "۲۴" },
        content: "توافقنامه عدم افشای اطلاعات (NDA)\nماده ۱ - تعریف اطلاعات محرمانه.\nماده ۲ - تعهدات گیرنده.\nماده ۳ - مدت اعتبار: ۲۴ ماه.",
        clauses: clauses(CNT_NDA, [
          ["ماده ۱ - تعریف اطلاعات محرمانه", "شامل اطلاعات فنی، تجاری و مالی مبادله‌شده.", false, "essential"],
          ["ماده ۲ - تعهدات گیرنده", "گیرنده متعهد به استفاده در راستای پروژه و عدم افشا است.", true, "essential"],
          ["ماده ۳ - مدت اعتبار", "۲۴ ماه از تاریخ امضا.", false, "essential"],
        ]),
        state: "generated",
        createdAt: "2026-07-18T14:10:00Z",
      },
      {
        id: `${CNT_NDA}-ver-2`,
        contractId: CNT_NDA,
        versionNumber: 2,
        answers: { discloser: "شرکت خدمات فنی و مهندسی رهام پارس", recipient: "شرکت توسعه نرم‌افزار آریا", term_months: "۳۶" },
        content: "توافقنامه عدم افشای اطلاعات (NDA)\nماده ۱ - تعریف اطلاعات محرمانه.\nماده ۲ - تعهدات گیرنده.\nماده ۳ - مدت اعتبار: ۳۶ ماه.\nماده ۴ - استثنائات.\nماده ۵ - بازگشت اطلاعات.\nماده ۶ - جبران خسارت.\nماده ۷ - حل اختلاف.",
        clauses: clauses(CNT_NDA, [
          ["ماده ۱ - تعریف اطلاعات محرمانه", "شامل اطلاعات فنی، تجاری و مالی مبادله‌شده.", false, "essential"],
          ["ماده ۲ - تعهدات گیرنده", "گیرنده متعهد به استفاده در راستای پروژه و عدم افشا است.", true, "essential"],
          ["ماده ۳ - مدت اعتبار", "۳۶ ماه از تاریخ امضا.", false, "essential"],
          ["ماده ۵ - بازگشت اطلاعات", "گیرنده مکلف به استرداد اسناد و حذف نسخ الکترونیکی است.", true, "recommended"],
          ["ماده ۶ - جبران خسارت", "طرف خاطی مسئول جبران کلیه خسارات است.", true, "essential"],
        ]),
        state: "generated",
        createdAt: "2026-07-18T15:20:00Z",
      },
    ],
    analysis: {
      contractId: CNT_NDA,
      overallRisk: "medium",
      findings: [
        { id: "rf-nda-1", title: "دامنه اطلاعات محرمانه کلی است", severity: "medium", description: "مرز اطلاعات محرمانه و غیرمحرمانه روشن نیست.", clauseRef: `${CNT_NDA}-cl-1`, suggestion: "فهرست مصداقی ارائه دهید." },
        { id: "rf-nda-2", title: "جبران خسارت غیرقابل اجرا", severity: "medium", description: "سازوکار تعیین خسارت مشخص نیست.", clauseRef: `${CNT_NDA}-cl-6`, suggestion: "وجه التزام و مرجع صالح را تعیین کنید." },
      ],
      protectiveSuggestions: [],
      generatedAt: "2026-07-18T15:30:00Z",
    },
    attachments: [
      {
        id: "att-nda-law-001",
        fileName: "قانون-تجارت-الکترونیکی-1382.pdf",
        title: "قانون تجارت الکترونیکی مصوب ۱۳۸۲",
        kind: "law",
        kindFa: "قانون",
        uploadedAt: "2026-07-18T15:25:00Z",
        sections: [
          { id: "s-nda-law-1", title: "ماده ۶۴ — حفاظت از داده‌ها", content: "ارائه‌دهندگان خدمات الکترونیکی مکلف به حفظ محرمانگی اطلاعات کاربران می‌باشند." },
        ],
      },
    ],
    createdAt: "2026-07-18T14:00:00Z",
    updatedAt: "2026-07-18T15:20:00Z",
    disclaimer: DISCLAIMER,
  },
  {
    id: CNT_CTR,
    userId,
    title: "قرارداد پیمانکاری خدمات فنی",
    type: "contracting",
    typeFa: "پیمانکاری",
    category: "business",
    state: "approved",
    currentVersionId: `${CNT_CTR}-ver-3`,
    currentVersionNumber: 3,
    versions: [
      {
        id: `${CNT_CTR}-ver-1`,
        contractId: CNT_CTR,
        versionNumber: 1,
        answers: { employer: "شرکت رهام پارس", contractor: "شرکت داده‌گستر", amount: "۱/۸۰۰/۰۰۰/۰۰۰", start_date: "۱۴۰۵/۰۲/۰۱", sla_response: "۸", sla_resolve: "۴۸" },
        content: "قرارداد پیمانکاری خدمات فنی\nماده ۱ - موضوع.\nماده ۲ - مدت.\nماده ۳ - مبلغ: ۱/۸۰۰/۰۰۰/۰۰۰ ریال.\nماده ۴ - سطح خدمات: پاسخگویی ۸ ساعت و رفع ۴۸ ساعت.",
        clauses: clauses(CNT_CTR, [
          ["ماده ۱ - موضوع قرارداد", "ارائه خدمات پشتیبانی و نگهداری شبکه.", false, "essential"],
          ["ماده ۳ - مبلغ قرارداد", "۱/۸۰۰/۰۰۰/۰۰۰ ریال.", false, "essential"],
          ["ماده ۴ - سطح خدمات", "پاسخگویی ۸ ساعت و رفع ۴۸ ساعت کاری.", false, "recommended"],
        ]),
        state: "generated",
        createdAt: "2026-07-25T10:10:00Z",
      },
      {
        id: `${CNT_CTR}-ver-2`,
        contractId: CNT_CTR,
        versionNumber: 2,
        answers: { employer: "شرکت رهام پارس", contractor: "شرکت داده‌گستر", amount: "۲/۲۰۰/۰۰۰/۰۰۰", start_date: "۱۴۰۵/۰۲/۰۱", sla_response: "۶", sla_resolve: "۳۶" },
        content: "قرارداد پیمانکاری خدمات فنی\nماده ۱ - موضوع.\nماده ۲ - مدت.\nماده ۳ - مبلغ: ۲/۲۰۰/۰۰۰/۰۰۰ ریال.\nماده ۴ - سطح خدمات: پاسخگویی ۶ ساعت و رفع ۳۶ ساعت.",
        clauses: clauses(CNT_CTR, [
          ["ماده ۱ - موضوع قرارداد", "ارائه خدمات پشتیبانی و نگهداری شبکه.", false, "essential"],
          ["ماده ۳ - مبلغ قرارداد", "۲/۲۰۰/۰۰۰/۰۰۰ ریال.", false, "essential"],
          ["ماده ۴ - سطح خدمات", "پاسخگویی ۶ ساعت و رفع ۳۶ ساعت کاری.", false, "recommended"],
        ]),
        state: "under_review",
        createdAt: "2026-07-25T12:00:00Z",
      },
      {
        id: `${CNT_CTR}-ver-3`,
        contractId: CNT_CTR,
        versionNumber: 3,
        answers: { employer: "شرکت رهام پارس", contractor: "شرکت داده‌گستر", amount: "۲/۴۰۰/۰۰۰/۰۰۰", start_date: "۱۴۰۵/۰۲/۰۱", sla_response: "۴", sla_resolve: "۲۴" },
        content: "قرارداد پیمانکاری خدمات فنی\nماده ۱ - موضوع.\nماده ۲ - مدت: یک سال.\nماده ۳ - مبلغ: ۲/۴۰۰/۰۰۰/۰۰۰ ریال.\nماده ۴ - سطح خدمات: پاسخگویی ۴ ساعت و رفع ۲۴ ساعت کاری.\nماده ۵ - تعهدات پیمانکار.\nماده ۶ - تعهدات کارفرما.\nماده ۷ - خسارت و جریمه.\nماده ۸ - حل اختلاف.",
        clauses: clauses(CNT_CTR, [
          ["ماده ۱ - موضوع قرارداد", "ارائه خدمات پشتیبانی و نگهداری شبکه.", false, "essential"],
          ["ماده ۳ - مبلغ قرارداد", "۲/۴۰۰/۰۰۰/۰۰۰ ریال.", false, "essential"],
          ["ماده ۴ - سطح خدمات", "پاسخگویی ۴ ساعت و رفع ۲۴ ساعت کاری.", false, "recommended"],
          ["ماده ۷ - خسارت و جریمه", "جریمه تأخیر به ازای هر روز یک‌دهم درصد مبلغ قرارداد.", true, "recommended"],
        ]),
        state: "approved",
        createdAt: "2026-07-25T13:30:00Z",
      },
    ],
    analysis: {
      contractId: CNT_CTR,
      overallRisk: "medium",
      findings: [
        { id: "rf-ctr-1", title: "سقف جریمه تأخیر نامشخص", severity: "medium", description: "سقف تجمیعی جریمه تعیین نشده است.", clauseRef: `${CNT_CTR}-cl-4`, suggestion: "سقف ۱۰٪ مبلغ قرارداد را قید کنید." },
        { id: "rf-ctr-2", title: "نحوه محاسبه ساعت کاری", severity: "low", description: "تعریف ساعت کاری در SLA شفاف نیست.", clauseRef: null, suggestion: "تعریف ساعت کاری و مرجع داوری فنی را شفاف کنید." },
      ],
      protectiveSuggestions: [
        { id: "ps-ctr-1", title: "بند سقف جریمه", content: "مجموع جرایم تأخیر در هیچ حالتی از ده درصد مبلغ کل قرارداد تجاوز نخواهد کرد.", isProtective: true, importance: "essential" },
      ],
      generatedAt: "2026-07-25T13:40:00Z",
    },
    attachments: [],
    createdAt: "2026-07-25T10:00:00Z",
    updatedAt: "2026-07-25T13:30:00Z",
    disclaimer: DISCLAIMER,
  },
  {
    id: CNT_PART,
    userId,
    title: "قرارداد مشارکت تجاری",
    type: "partnership",
    typeFa: "شراکت",
    category: "personal",
    state: "generated",
    currentVersionId: `${CNT_PART}-ver-2`,
    currentVersionNumber: 2,
    versions: [
      {
        id: `${CNT_PART}-ver-1`,
        contractId: CNT_PART,
        versionNumber: 1,
        answers: { partner1: "امیر رضایی", partner2: "مهدی کریمی", share1: "۵۰", share2: "۵۰", subject: "راه‌اندازی کسب‌وکار خدمات فناوری اطلاعات" },
        content: "قرارداد مشارکت تجاری\nماده ۱ - موضوع.\nماده ۲ - سرمایه و سهم‌الشرکه: ۵۰٪ - ۵۰٪.\nماده ۳ - مدیریت.",
        clauses: clauses(CNT_PART, [
          ["ماده ۱ - موضوع قرارداد", "مشارکت در راه‌اندازی کسب‌وکار خدمات فناوری اطلاعات.", false, "essential"],
          ["ماده ۲ - سرمایه و سهم‌الشرکه", "سهم مساوی ۵۰٪ برای هر شریک.", false, "essential"],
        ]),
        state: "generated",
        createdAt: "2026-07-05T09:00:00Z",
      },
      {
        id: `${CNT_PART}-ver-2`,
        contractId: CNT_PART,
        versionNumber: 2,
        answers: { partner1: "امیر رضایی", partner2: "مهدی کریمی", share1: "۶۰", share2: "۴۰", subject: "راه‌اندازی کسب‌وکار خدمات فناوری اطلاعات" },
        content: "قرارداد مشارکت تجاری\nماده ۱ - موضوع.\nماده ۲ - سرمایه و سهم‌الشرکه: ۶۰٪ - ۴۰٪.\nماده ۳ - مدیریت.\nماده ۴ - تقسیم سود و زیان.\nماده ۵ - حل اختلاف.",
        clauses: clauses(CNT_PART, [
          ["ماده ۱ - موضوع قرارداد", "مشارکت در راه‌اندازی کسب‌وکار خدمات فناوری اطلاعات.", false, "essential"],
          ["ماده ۲ - سرمایه و سهم‌الشرکه", "سهم ۶۰٪ امیر رضایی و ۴۰٪ مهدی کریمی.", false, "essential"],
          ["ماده ۴ - تقسیم سود و زیان", "به نسبت سهم‌الشرکه طرفین.", false, "recommended"],
        ]),
        state: "generated",
        createdAt: "2026-07-06T10:00:00Z",
      },
    ],
    analysis: {
      contractId: CNT_PART,
      overallRisk: "low",
      findings: [
        { id: "rf-part-1", title: "ابهام در مدیریت", severity: "low", description: "نحوه اتخاذ تصمیمات مدیریتی مشخص نیست.", clauseRef: null, suggestion: "سازوکار تصمیم‌گیری و حق امضا را مشخص کنید." },
      ],
      protectiveSuggestions: [],
      generatedAt: "2026-07-06T10:30:00Z",
    },
    attachments: [
      {
        id: "att-part-law-001",
        fileName: "قانون-مدنی-عقد-شرکت.pdf",
        title: "قانون مدنی — باب شرکت (مواد ۵۷۱ تا ۶۰۶)",
        kind: "law",
        kindFa: "قانون",
        uploadedAt: "2026-07-05T09:10:00Z",
        sections: [
          { id: "s-part-law-1", title: "ماده ۵۷۱ — تعریف شرکت", content: "شرکت عبارت است از اجتماع حقوق مالکین متعدد در شیء واحد به نحو اشاعه." },
        ],
      },
    ],
    createdAt: "2026-07-05T09:00:00Z",
    updatedAt: "2026-07-06T10:00:00Z",
    disclaimer: DISCLAIMER,
  },
  {
    id: CNT_SAAS,
    userId,
    title: "قرارداد اشتراک نرم‌افزار",
    type: "saas",
    typeFa: "SaaS",
    category: "business",
    state: "draft",
    currentVersionId: null,
    currentVersionNumber: 0,
    versions: [],
    analysis: null,
    attachments: [],
    createdAt: "2026-08-15T10:00:00Z",
    updatedAt: "2026-08-15T10:00:00Z",
    disclaimer: DISCLAIMER,
  },
];

// ============================================================
// Memories
// ============================================================

const demoMemories = (userId: string): V1MemoryItem[] => [
  { id: "mem-001", userId, key: "نام کاربر", value: "امیر رضایی", category: "profile", categoryFa: "اطلاعات کاربر", sensitivity: "normal", sensitivityFa: "عادی", status: "active", createdAt: "2026-07-15T10:00:00Z", updatedAt: "2026-07-15T10:00:00Z", consentGiven: true, consentDate: "2026-07-15T10:00:00Z" },
  { id: "mem-002", userId, key: "شرکت", value: "شرکت خدمات فنی و مهندسی رهام پارس", category: "profile", categoryFa: "اطلاعات کاربر", sensitivity: "normal", sensitivityFa: "عادی", status: "active", createdAt: "2026-07-15T10:05:00Z", updatedAt: "2026-07-15T10:05:00Z", consentGiven: true, consentDate: "2026-07-15T10:05:00Z" },
  { id: "mem-003", userId, key: "ترجیح زبان پاسخ", value: "فارسی ساده و روان، با استناد به مواد قانونی", category: "preference", categoryFa: "تنظیمات برگزیده", sensitivity: "normal", sensitivityFa: "عادی", status: "active", createdAt: "2026-07-16T09:00:00Z", updatedAt: "2026-07-16T09:00:00Z", consentGiven: true, consentDate: "2026-07-16T09:00:00Z" },
  { id: "mem-004", userId, key: "قراردادهای فعال", value: "قرارداد استخدام مدیر فنی، پیمانکاری خدمات فنی و توافقنامه محرمانگی", category: "legal_context", categoryFa: "اطلاعات حقوقی", sensitivity: "sensitive", sensitivityFa: "حساس", status: "active", createdAt: "2026-07-25T14:00:00Z", updatedAt: "2026-07-25T14:00:00Z", consentGiven: true, consentDate: "2026-07-25T14:00:00Z" },
  { id: "mem-005", userId, key: "پرونده جاری", value: "اختلاف با پیمانکار شبکه درباره تأخیر در رفع اشکال — در حال مذاکره", category: "legal_context", categoryFa: "اطلاعات حقوقی", sensitivity: "highly_sensitive", sensitivityFa: "بسیار حساس", status: "active", createdAt: "2026-08-05T11:00:00Z", updatedAt: "2026-08-05T11:00:00Z", consentGiven: true, consentDate: "2026-08-05T11:00:00Z" },
  { id: "mem-006", userId, key: "محل دفتر شرکت", value: "تهران، خیابان ولیعصر، بالاتر از میدان ونک، برج رهام، طبقه ششم", category: "profile", categoryFa: "اطلاعات کاربر", sensitivity: "normal", sensitivityFa: "عادی", status: "active", createdAt: "2026-07-15T10:10:00Z", updatedAt: "2026-07-15T10:10:00Z", consentGiven: true, consentDate: "2026-07-15T10:10:00Z" },
  { id: "mem-007", userId, key: "تعهد بیمه تأمین اجتماعی", value: "کارفرما مکلف به بیمه کارکنان از تاریخ شروع به کار و پرداخت حق بیمه در مواعد قانونی است", category: "legal_context", categoryFa: "اطلاعات حقوقی", sensitivity: "normal", sensitivityFa: "عادی", status: "active", createdAt: "2026-08-02T09:30:00Z", updatedAt: "2026-08-02T09:30:00Z", consentGiven: true, consentDate: "2026-08-02T09:30:00Z" },
];

// ============================================================
// Conversations (seeded, linked to documents/contracts)
// ============================================================

interface DemoConversation {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  status: string;
  riskLevel: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DemoConversationMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  status: string;
  createdAt: string;
}

const demoConversations = (userId: string): DemoConversation[] => [
  { id: "conv-demo-001", userId, title: "بررسی قرارداد استخدام مدیر فنی", category: "employment", status: "active", riskLevel: "high", messageCount: 2, createdAt: "2026-08-04T08:50:00Z", updatedAt: "2026-08-04T09:00:00Z" },
  { id: "conv-demo-002", userId, title: "اختلاف با پیمانکار شبکه", category: "commerce", status: "active", riskLevel: "medium", messageCount: 2, createdAt: "2026-08-05T10:45:00Z", updatedAt: "2026-08-05T11:00:00Z" },
];

const demoConversationMessages = (_userId: string): Record<string, DemoConversationMessage[]> => ({
  "conv-demo-001": [
    { id: "msg-demo-001-1", conversationId: "conv-demo-001", role: "user", content: "قرارداد استخدام مدیر فنی را بررسی کن و ریسک‌های آن را بگو.", status: "sent", createdAt: "2026-08-04T08:50:00Z" },
    { id: "msg-demo-001-2", conversationId: "conv-demo-001", role: "assistant", content: "## خلاصه\nقرارداد استخدام مدیر فنی ۳ ریسک اصلی دارد: ابهام در دوره آزمایشی، نامشخص بودن سهم حق بیمه تأمین اجتماعی و گستردگی شرط عدم رقابت. مهم‌ترین مورد، سهم حق بیمه است که طبق ماده ۳۹ قانون تأمین اجتماعی باید صریحاً تعیین شود.", status: "completed", createdAt: "2026-08-04T09:00:00Z" },
  ],
  "conv-demo-002": [
    { id: "msg-demo-002-1", conversationId: "conv-demo-002", role: "user", content: "پیمانکار شبکه در رفع اشکال تأخیر داشته؛ چه اقدام قانونی می‌توانم انجام دهم؟", status: "sent", createdAt: "2026-08-05T10:45:00Z" },
    { id: "msg-demo-002-2", conversationId: "conv-demo-002", role: "assistant", content: "## خلاصه\nابتدا مفاد قرارداد پیمانکاری به‌ویژه بند سطح خدمات (SLA) و جریمه تأخیر را بررسی کنید. در صورت تخلف پیمانکار، می‌توانید پس از ارسال اخطار کتبی، جریمه مقرر را مطالبه و در نهایت به داوری یا دادگاه مراجعه کنید.", status: "completed", createdAt: "2026-08-05T11:00:00Z" },
  ],
});

// ============================================================
// Relationships
// ============================================================

const demoRelationships = (userId: string): DemoRelationship[] => [
  { id: "rel-001", userId, sourceType: "contract", sourceId: CNT_EMP, targetType: "document", targetId: DOC_EMP, relation: "generated-from", relationFa: "تولید شده از سند" },
  { id: "rel-002", userId, sourceType: "document", sourceId: DOC_EMP, targetType: "conversation", targetId: "conv-demo-001", relation: "analyzed-in", relationFa: "تحلیل شده در گفتگو" },
  { id: "rel-003", userId, sourceType: "contract", sourceId: CNT_CTR, targetType: "document", targetId: DOC_CTR, relation: "generated-from", relationFa: "تولید شده از سند" },
  { id: "rel-004", userId, sourceType: "document", sourceId: DOC_CTR, targetType: "conversation", targetId: "conv-demo-002", relation: "analyzed-in", relationFa: "تحلیل شده در گفتگو" },
  { id: "rel-005", userId, sourceType: "memory", sourceId: "mem-004", targetType: "contract", targetId: CNT_EMP, relation: "references", relationFa: "اشاره به قرارداد" },
  { id: "rel-006", userId, sourceType: "memory", sourceId: "mem-005", targetType: "contract", targetId: CNT_CTR, relation: "references", relationFa: "اشاره به قرارداد" },
  { id: "rel-007", userId, sourceType: "contract", sourceId: CNT_NDA, targetType: "document", targetId: DOC_NDA, relation: "generated-from", relationFa: "تولید شده از سند" },
];

// ============================================================
// Seed (idempotent)
// ============================================================

interface DemoMeta {
  version: string;
  userId: string;
  seededAt: string;
}

function getDemoMeta(): DemoMeta | undefined {
  return readTable<DemoMeta>("demo_meta")[0];
}

interface DemoUser {
  id: string;
  mobile: string;
  email: string | null;
  passwordHash: string;
  displayName: string | null;
  createdAt: string;
}

interface DemoProfile {
  user_id: string;
  displayName: string | null;
  city: string | null;
  occupation: string | null;
  avatarUrl: string | null;
  email: string | null;
  birthDate: string | null;
  gender: string | null;
  userType: string | null;
  province: string | null;
  legalInterests: string[] | null;
  primaryUseCase: string | null;
  completionPercent: number;
}

interface DemoSubscription {
  id: string;
  user_id: string;
  plan_code: string;
  plan_name_fa: string;
  amount: number;
  currency: string;
  status: string;
  status_fa: string;
  start_at: string;
  end_at: string;
  purchased_at: string;
  auto_renew: number;
}

/**
 * Align the demo user's identity with the coherent persona «امیر رضایی»
 * (manager of شرکت خدمات فنی و مهندسی رهام پارس): displayName, email,
 * a 100%-complete profile and an active Gold subscription. Idempotent —
 * only touches rows owned by `userId`, never other users.
 */
function seedDemoIdentity(userId: string): void {
  // 1) User displayName + email.
  const users = readTable<DemoUser>("users");
  const userIdx = users.findIndex((u) => u.id === userId);
  if (userIdx !== -1) {
    users[userIdx] = {
      ...users[userIdx]!,
      displayName: "امیر رضایی",
      email: "amir.rezaei@example.com",
    };
    writeTable("users", users);
  }

  // 2) Profile (100% completion — all 9 fields filled).
  const profile: DemoProfile = {
    user_id: userId,
    displayName: "امیر رضایی",
    city: "تهران",
    occupation: "مدیر فنی و مهندسی",
    avatarUrl: null,
    email: "amir.rezaei@example.com",
    birthDate: "1362-04-12",
    gender: "male",
    userType: "business",
    province: "تهران",
    legalInterests: ["قراردادها", "استخدام"],
    primaryUseCase: "legal_management",
    completionPercent: 100,
  };
  const profiles = readTable<DemoProfile>("profiles");
  const profIdx = profiles.findIndex((p) => p.user_id === userId);
  if (profIdx === -1) profiles.push(profile);
  else profiles[profIdx] = { ...profiles[profIdx]!, ...profile };
  writeTable("profiles", profiles);

  // 3) Subscriptions — coherent with the demo persona (active Gold + a
  //    prior expired Silver for history), replacing any stale plan codes.
  const subs = readTable<DemoSubscription>("subscriptions");
  const others = subs.filter((s) => s.user_id !== userId);
  const demoSubs: DemoSubscription[] = [
    {
      id: "subhist-001",
      user_id: userId,
      plan_code: "gold",
      plan_name_fa: "طلا",
      amount: 2000000,
      currency: "IRT",
      status: "active",
      status_fa: "فعال",
      start_at: "2026-07-01T00:00:00Z",
      end_at: "2026-10-01T00:00:00Z",
      purchased_at: "2026-07-01T00:00:00Z",
      auto_renew: 1,
    },
    {
      id: "subhist-002",
      user_id: userId,
      plan_code: "silver",
      plan_name_fa: "نقره",
      amount: 900000,
      currency: "IRT",
      status: "expired",
      status_fa: "منقضی",
      start_at: "2026-05-01T00:00:00Z",
      end_at: "2026-06-01T00:00:00Z",
      purchased_at: "2026-05-01T00:00:00Z",
      auto_renew: 0,
    },
  ];
  writeTable("subscriptions", [...others, ...demoSubs]);
}

export function seedDemoContent(userId: string): void {
  const meta = getDemoMeta();
  if (meta && meta.version === DEMO_SEED_VERSION && meta.userId === userId) return;

  writeTable<V1DocumentDetail>("documents", demoDocuments(userId));
  writeTable<V1ContractDetail>("contracts", demoContracts(userId));
  writeTable<V1MemoryItem>("memories", demoMemories(userId));
  writeTable<DemoRelationship>("relationships", demoRelationships(userId));

  // Conversations: append (never clobber other users' rows), idempotent by id.
  const convs = readTable<DemoConversation>("conversations");
  const demoConvs = demoConversations(userId);
  const withoutDemo = convs.filter((c) => !demoConvs.some((d) => d.id === c.id));
  writeTable<DemoConversation>("conversations", [...withoutDemo, ...demoConvs]);

  // Conversation messages live in a Record<conversationId, messages[]>.
  const msgsFile = path.join(DATA_DIR, "conversation-messages.json");
  const msgs: Record<string, unknown[]> = fs.existsSync(msgsFile)
    ? (() => { try { return JSON.parse(fs.readFileSync(msgsFile, "utf-8")); } catch { return {}; } })()
    : {};
  const demoMsgs = demoConversationMessages(userId);
  for (const [cid, messages] of Object.entries(demoMsgs)) {
    msgs[cid] = messages;
  }
  fs.writeFileSync(msgsFile, JSON.stringify(msgs, null, 2), "utf-8");

  seedDemoIdentity(userId);

  writeTable<DemoMeta>("demo_meta", [{ version: DEMO_SEED_VERSION, userId, seededAt: new Date().toISOString() }]);
}

// ============================================================
// Query layer (used by the API routes)
// ============================================================

export function listDemoDocuments(userId: string) {
  return readTable<V1DocumentDetail>("documents")
    .filter((d) => d.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDemoDocument(userId: string, id: string): V1DocumentDetail | undefined {
  return readTable<V1DocumentDetail>("documents").find((d) => d.id === id && d.userId === userId);
}

export function deleteDemoDocument(userId: string, id: string): boolean {
  const rows = readTable<V1DocumentDetail>("documents");
  const idx = rows.findIndex((d) => d.id === id && d.userId === userId);
  if (idx === -1) return false;
  rows.splice(idx, 1);
  writeTable("documents", rows);
  return true;
}

export function listDemoContracts(userId: string) {
  return readTable<V1ContractDetail>("contracts")
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDemoContract(userId: string, id: string): V1ContractDetail | undefined {
  return readTable<V1ContractDetail>("contracts").find((c) => c.id === id && c.userId === userId);
}

export function listDemoMemories(userId: string): V1MemoryItem[] {
  return readTable<V1MemoryItem>("memories")
    .filter((m) => m.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function updateDemoMemory(userId: string, id: string, updates: Partial<V1MemoryItem>): V1MemoryItem | undefined {
  const rows = readTable<V1MemoryItem>("memories");
  const idx = rows.findIndex((m) => m.id === id && m.userId === userId);
  if (idx === -1) return undefined;
  rows[idx] = { ...rows[idx]!, ...updates, updatedAt: new Date().toISOString() };
  writeTable("memories", rows);
  return rows[idx];
}

export function deleteDemoMemory(userId: string, id: string): boolean {
  const rows = readTable<V1MemoryItem>("memories");
  const idx = rows.findIndex((m) => m.id === id && m.userId === userId);
  if (idx === -1) return false;
  rows[idx] = { ...rows[idx]!, status: "deleted", updatedAt: new Date().toISOString() };
  writeTable("memories", rows);
  return true;
}

export function listDemoRelationships(userId: string, sourceType?: string, sourceId?: string): DemoRelationship[] {
  let rows = readTable<DemoRelationship>("relationships").filter((r) => r.userId === userId);
  if (sourceType && sourceId) {
    rows = rows.filter((r) => r.sourceType === sourceType && r.sourceId === sourceId);
  }
  return rows;
}
