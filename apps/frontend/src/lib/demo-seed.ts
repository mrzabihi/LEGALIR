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
  V1ContractDraft,
  V1ContractGenerateResponse,
  V1ContractType,
} from "@legalir/types";
import {
  LAW_SEED_VERSION,
  buildLawDocuments,
  buildLawMemories,
} from "./law-catalog";

const DATA_DIR = path.resolve(process.cwd(), ".data");

export const DEMO_USER_MOBILE = "09120000003";
export const DEMO_SEED_VERSION = "legalir-demo-v4";

// ============================================================
// JSON-DB primitives (self-contained to avoid a circular import
// with db.ts, which imports this module).
// ============================================================

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// mtime+size keyed cache. These tables are read on nearly every API
// request (conversation-messages.json alone is ~240 KB), and re-parsing
// the whole file per call dominated request latency. The stat is cheap;
// a hit skips the read + JSON.parse entirely.
const tableCache = new Map<string, { mtimeMs: number; size: number; data: unknown[] }>();

function readTable<T>(name: string): T[] {
  ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    tableCache.delete(name);
    return [];
  }
  const cached = tableCache.get(name);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.data as T[];
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8")) as T[];
    tableCache.set(name, { mtimeMs: stat.mtimeMs, size: stat.size, data });
    return data;
  } catch {
    return [];
  }
}

function writeTable<T>(name: string, data: T[]): void {
  ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  try {
    const stat = fs.statSync(file);
    tableCache.set(name, { mtimeMs: stat.mtimeMs, size: stat.size, data });
  } catch {
    tableCache.delete(name);
  }
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
const DOC_RENT = "doc-rent-001";

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
  {
    id: DOC_RENT,
    userId,
    name: "قرارداد-اجاره-مسکونی.pdf",
    mime: "application/pdf",
    sizeBytes: 148_000,
    status: "ready",
    storageKey: "demo-documents/قرارداد-اجاره-مسکونی.pdf",
    createdAt: "2026-08-20T10:00:00Z",
    updatedAt: "2026-08-20T11:10:00Z",
    jobs: completedJobs(DOC_RENT),
    report: {
      documentId: DOC_RENT,
      summary: "در این قرارداد اجاره مسکونی ۴ مورد نیازمند توجه شناسایی شد؛ شامل ۱ مورد با ریسک بالا و ۲ مورد متوسط.",
      findings: [
        {
          id: "find-rent-1",
          documentId: DOC_RENT,
          title: "مبلغ ودیعه و اجاره بدون سقف افزایش",
          severity: "high",
          locator: "ماده ۳، صفحه ۱",
          reason: "مبلغ ودیعه ۵۰۰ میلیون ریال و اجاره ماهانه ۸۵ میلیون ریال تعیین شده اما سقف افزایش سالانه اجاره مطابق نرخ تورم و ماده ۴ قانون روابط موجر و مستأجر ۱۳۷۶ قید نشده است.",
          recommendation: "سقف افزایش سالانه اجاره را به نرخ تورم اعلامی بانک مرکزی یا سقف قانونی پیوند دهید.",
          citation: null,
          confidence: 0.88,
        },
        {
          id: "find-rent-2",
          documentId: DOC_RENT,
          title: "شرط فسخ یک‌طرفه به نفع موجر",
          severity: "high",
          locator: "ماده ۸، صفحه ۲",
          reason: "به موجر حق فسخ یک‌طرفه بدون دلیل موجه و بدون مهلت اخطار داده شده که خلاف اصل لزوم قراردادها و حقوق مستأجر است.",
          recommendation: "شرایط فسخ را به موارد قانونی (عدم پرداخت اجاره، تخریب ملک) محدود و مهلت اخطار تعیین کنید.",
          citation: null,
          confidence: 0.9,
        },
        {
          id: "find-rent-3",
          documentId: DOC_RENT,
          title: "مسئولیت تعمیرات مبهم",
          severity: "medium",
          locator: "ماده ۶، صفحه ۱",
          reason: "تقسیم مسئولیت تعمیرات جزئی و اساسی بین موجر و مستأجر مشخص نشده و به «توافق طرفین» ارجاع داده شده است.",
          recommendation: "تعمیرات اساسی (سازه، تأسیسات) بر عهده موجر و تعمیرات جزئی بر عهده مستأجر قید شود.",
          citation: null,
          confidence: 0.82,
        },
        {
          id: "find-rent-4",
          documentId: DOC_RENT,
          title: "عدم ذکر مهلت تخلیه و تحویل ملک",
          severity: "medium",
          locator: "ماده ۹، صفحه ۲",
          reason: "مهلت تخلیه پس از پایان مدت و نحوه تحویل ملک (بازدید، صورت‌جلسه) مشخص نشده است.",
          recommendation: "مهلت تخلیه، شرط بازدید پایانی و تنظیم صورت‌جلسه تحویل را صریحاً درج کنید.",
          citation: null,
          confidence: 0.79,
        },
      ],
      generatedAt: "2026-08-20T11:10:00Z",
      confidence: 0.85,
    },
    extractedText:
      "قرارداد اجاره مسکونی\nاین قرارداد فی‌مابین آقای حسین کاظمی (موجر) و خانم زهرا محمدی (مستأجر) منعقد می‌گردد. ماده ۱ موضوع اجاره: یک واحد آپارتمان مسکونی به مساحت ۹۵ متر مربع واقع در تهران، خیابان ولیعصر، پلاک ۱۲۴، واحد ۳. ماده ۲ مدت اجاره: یک سال شمسی از ۱۴۰۵/۰۶/۰۱ تا ۱۴۰۶/۰۵/۳۱. ماده ۳ مبلغ اجاره: ودیعه ۵۰۰/۰۰۰/۰۰۰ ریال و اجاره ماهانه ۸۵/۰۰۰/۰۰۰ ریال که در ابتدای هر ماه پرداخت می‌شود. ماده ۴ نحوه پرداخت: از طریق واریز به حساب بانکی موجر. ماده ۵ استفاده از ملک: صرفاً برای سکونت. ماده ۶ تعمیرات: تعمیرات جزئی بر عهده مستأجر و تعمیرات اساسی بر عهده موجر، مگر توافق طرفین. ماده ۷ بیمه: ملک توسط موجر بیمه می‌شود. ماده ۸ فسخ: موجر حق فسخ یک‌طرفه قرارداد را در صورت تخلف مستأجر دارد. ماده ۹ تخلیه: پس از پایان مدت، مستأجر موظف به تخلیه ملک است.",
    previewUrl: "/demo-documents/قرارداد-اجاره-مسکونی.pdf",
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

// ============================================================
// Demo Cases (3 cases with timeline + tasks)
// ============================================================

import type { DbCase, DbCaseTimelineEvent, DbCaseTask } from "./case-db";

function demoCases(userId: string): { cases: DbCase[]; timeline: DbCaseTimelineEvent[]; tasks: DbCaseTask[] } {
  const case1Id = "case-demo-001";
  const case2Id = "case-demo-002";
  const case3Id = "case-demo-003";

  const cases: DbCase[] = [
    {
      id: case1Id,
      user_id: userId,
      title: "اختلاف با پیمانکار شبکه درباره تأخیر در رفع اشکال",
      description: "پیمانکار شبکه (شرکت داده‌گستر) در رفع اشکال زیرساخت شبکه تأخیر داشته و طبق بند SLA قرارداد باید جریمه پرداخت کند. نیاز به بررسی قرارداد و ارسال اخطار قانونی داریم.",
      category: "contract",
      status: "ACTIVE",
      priority: "high",
      created_at: "2026-08-05T10:00:00Z",
      updated_at: "2026-08-20T10:00:00Z",
    },
    {
      id: case2Id,
      user_id: userId,
      title: "بررسی قرارداد استخدام مدیر فنی جدید",
      description: "قرارداد استخدام آقای سعید مرادی به عنوان کارشناس ارشد شبکه تنظیم شده و نیاز به بررسی حقوقی از نظر بیمه تأمین اجتماعی، دوره آزمایشی و شرط عدم رقابت دارد.",
      category: "employment",
      status: "UNDER_REVIEW",
      priority: "medium",
      created_at: "2026-08-02T08:30:00Z",
      updated_at: "2026-08-15T14:00:00Z",
    },
    {
      id: case3Id,
      user_id: userId,
      title: "مشاوره مالیاتی شرکت رهام پارس",
      description: "بررسی وضعیت مالیاتی شرکت برای سال ۱۴۰۵، محاسبه مالیات بر درآمد و بررسی معافیت‌های مالیاتی قابل اعمال برای شرکت‌های فنی و مهندسی.",
      category: "tax",
      status: "DRAFT",
      priority: "low",
      created_at: "2026-08-18T09:00:00Z",
      updated_at: "2026-08-18T09:00:00Z",
    },
  ];

  const timeline: DbCaseTimelineEvent[] = [
    {
      id: "tl-001-1", case_id: case1Id, event_type: "case_created",
      title: "ایجاد پرونده", description: "پرونده اختلاف با پیمانکار شبکه ایجاد شد",
      metadata: {}, created_at: "2026-08-05T10:00:00Z",
    },
    {
      id: "tl-001-2", case_id: case1Id, event_type: "document_uploaded",
      title: "بارگذاری قرارداد پیمانکاری", description: "قرارداد پیمانکاری خدمات فنی و پشتیبانی شبکه بارگذاری و تحلیل شد",
      metadata: { documentId: "doc-ctr-001" }, created_at: "2026-08-05T11:00:00Z",
    },
    {
      id: "tl-001-3", case_id: case1Id, event_type: "ai_analysis_completed",
      title: "تحلیل هوش مصنوعی تکمیل شد", description: "تحلیل قرارداد نشان داد بند SLA و جریمه تأخیر به نفع کارفرما قابل استناد است",
      metadata: { confidence: 0.85 }, created_at: "2026-08-06T09:00:00Z",
    },
    {
      id: "tl-001-4", case_id: case1Id, event_type: "note_added",
      title: "یادداشت جلسه با پیمانکار", description: "جلسه با نماینده پیمانکار برگزار شد. پیمانکار علت تأخیر را مشکل تأمین قطعه اعلام کرد و درخواست مهلت ۱۰ روزه داد.",
      metadata: {}, created_at: "2026-08-12T14:00:00Z",
    },
    {
      id: "tl-002-1", case_id: case2Id, event_type: "case_created",
      title: "ایجاد پرونده", description: "پرونده بررسی قرارداد استخدام ایجاد شد",
      metadata: {}, created_at: "2026-08-02T08:30:00Z",
    },
    {
      id: "tl-002-2", case_id: case2Id, event_type: "document_uploaded",
      title: "بارگذاری پیش‌نویس قرارداد", description: "پیش‌نویس قرارداد استخدام مدیر فنی بارگذاری شد",
      metadata: { documentId: "doc-emp-001" }, created_at: "2026-08-02T09:00:00Z",
    },
    {
      id: "tl-002-3", case_id: case2Id, event_type: "ai_analysis_completed",
      title: "تحلیل قرارداد تکمیل شد", description: "۵ مورد نیازمند توجه شناسایی شد: ۱ مورد بحرانی (حق بیمه)، ۲ مورد با ریسک بالا",
      metadata: { confidence: 0.84, findingsCount: 5 }, created_at: "2026-08-02T09:15:00Z",
    },
    {
      id: "tl-003-1", case_id: case3Id, event_type: "case_created",
      title: "ایجاد پرونده", description: "پرونده مشاوره مالیاتی ایجاد شد",
      metadata: {}, created_at: "2026-08-18T09:00:00Z",
    },
  ];

  const tasks: DbCaseTask[] = [
    {
      id: "task-001-1", case_id: case1Id, title: "ارسال اخطار کتبی به پیمانکار",
      description: "اخطار رسمی با استناد به بند SLA و جریمه تأخیر قرارداد تنظیم و ارسال شود",
      status: "done", priority: "high", due_date: "2026-08-10T00:00:00Z",
      created_at: "2026-08-05T10:30:00Z", updated_at: "2026-08-09T16:00:00Z",
    },
    {
      id: "task-001-2", case_id: case1Id, title: "محاسبه جریمه تأخیر",
      description: "مبلغ جریمه بر اساس بند قرارداد (یک‌دهم درصد به ازای هر روز) محاسبه شود",
      status: "in_progress", priority: "high", due_date: "2026-08-22T00:00:00Z",
      created_at: "2026-08-10T09:00:00Z", updated_at: "2026-08-20T10:00:00Z",
    },
    {
      id: "task-001-3", case_id: case1Id, title: "بررسی گزینه‌های قانونی جایگزین",
      description: "در صورت عدم همکاری پیمانکار، گزینه‌های داوری و طرح دعوی بررسی شود",
      status: "todo", priority: "medium", due_date: "2026-08-30T00:00:00Z",
      created_at: "2026-08-15T11:00:00Z", updated_at: "2026-08-15T11:00:00Z",
    },
    {
      id: "task-002-1", case_id: case2Id, title: "اصلاح بند بیمه تأمین اجتماعی",
      description: "سهم دقیق حق بیمه (کارگر ۷٪، کارفرما ۲۰٪، دولت ۳٪) و مهلت واریز در قرارداد درج شود",
      status: "done", priority: "high", due_date: "2026-08-05T00:00:00Z",
      created_at: "2026-08-02T09:30:00Z", updated_at: "2026-08-04T15:00:00Z",
    },
    {
      id: "task-002-2", case_id: case2Id, title: "تعیین شاخص‌های ارزیابی دوره آزمایشی",
      description: "معیارهای عینی سنجش عملکرد در دوره ۳ ماهه آزمایشی تعریف و به قرارداد اضافه شود",
      status: "in_progress", priority: "medium", due_date: "2026-08-25T00:00:00Z",
      created_at: "2026-08-05T10:00:00Z", updated_at: "2026-08-15T14:00:00Z",
    },
    {
      id: "task-002-3", case_id: case2Id, title: "محدودسازی شرط عدم رقابت",
      description: "دامنه عدم رقابت به فعالیت‌های مشخص و رقبای مستقیم محدود و جبران مالی پیش‌بینی شود",
      status: "todo", priority: "medium", due_date: "2026-09-01T00:00:00Z",
      created_at: "2026-08-05T10:00:00Z", updated_at: "2026-08-05T10:00:00Z",
    },
    {
      id: "task-003-1", case_id: case3Id, title: "جمع‌آوری اسناد مالی سال ۱۴۰۴",
      description: "اظهارنامه مالیاتی، ترازنامه، سود و زیان و اسناد هزینه‌های قابل قبول مالیاتی",
      status: "todo", priority: "medium", due_date: "2026-09-15T00:00:00Z",
      created_at: "2026-08-18T09:00:00Z", updated_at: "2026-08-18T09:00:00Z",
    },
    {
      id: "task-003-2", case_id: case3Id, title: "بررسی معافیت‌های مالیاتی شرکت‌های فنی",
      description: "ماده ۱۳۲ قانون مالیات‌های مستقیم و معافیت‌های مناطق کمتر توسعه‌یافته بررسی شود",
      status: "todo", priority: "low", due_date: "2026-09-30T00:00:00Z",
      created_at: "2026-08-18T09:00:00Z", updated_at: "2026-08-18T09:00:00Z",
    },
  ];

  return { cases, timeline, tasks };
}

export function seedDemoCases(userId: string): void {
  const { cases, timeline, tasks } = demoCases(userId);

  const existingCases = readTable<DbCase>("cases");
  const existingIds = new Set(existingCases.map((c) => c.id));
  const newCases = cases.filter((c) => !existingIds.has(c.id));
  if (newCases.length > 0) writeTable("cases", [...existingCases, ...newCases]);

  const existingTimeline = readTable<DbCaseTimelineEvent>("case_timeline");
  const existingTlIds = new Set(existingTimeline.map((e) => e.id));
  const newTimeline = timeline.filter((e) => !existingTlIds.has(e.id));
  if (newTimeline.length > 0) writeTable("case_timeline", [...existingTimeline, ...newTimeline]);

  const existingTasks = readTable<DbCaseTask>("case_tasks");
  const existingTaskIds = new Set(existingTasks.map((t) => t.id));
  const newTasks = tasks.filter((t) => !existingTaskIds.has(t.id));
  if (newTasks.length > 0) writeTable("case_tasks", [...existingTasks, ...newTasks]);
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
// Law content seed (16 official law files) — append-only & idempotent
// ============================================================

interface LawMeta {
  version: string;
  userId: string;
  seededAt: string;
}

function getLawMeta(): LawMeta | undefined {
  return readTable<LawMeta>("law_meta")[0];
}

/**
 * Seed the 16 official law files as اسناد rows and حافظه legal_context
 * items. Append-only: never clobbers existing (user) rows, and guarded by
 * `law_meta` version so re-running the dev server never duplicates.
 */
export function seedLawContent(userId: string): void {
  const meta = getLawMeta();
  if (meta && meta.version === LAW_SEED_VERSION && meta.userId === userId) return;

  // Documents: append law documents not already present (by id).
  const lawDocs = buildLawDocuments(userId);
  const existingDocs = readTable<V1DocumentDetail>("documents");
  const docIds = new Set(existingDocs.map((d) => d.id));
  const newDocs = lawDocs.filter((d) => !docIds.has(d.id));
  if (newDocs.length > 0) {
    writeTable<V1DocumentDetail>("documents", [...existingDocs, ...newDocs]);
  }

  // Memories: append law memories not already present (by id).
  const lawMems = buildLawMemories(userId);
  const existingMems = readTable<V1MemoryItem>("memories");
  const memIds = new Set(existingMems.map((m) => m.id));
  const newMems = lawMems.filter((m) => !memIds.has(m.id));
  if (newMems.length > 0) {
    writeTable<V1MemoryItem>("memories", [...existingMems, ...newMems]);
  }

  writeTable<LawMeta>("law_meta", [
    { version: LAW_SEED_VERSION, userId, seededAt: new Date().toISOString() },
  ]);
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

/**
 * Create a new document row in the JSON DB (upload flow). The document starts
 * in the "processing" state with an empty job list; the analysis pipeline is
 * simulated by the frontend. Returns the created V1DocumentDetail.
 */
export function createDemoDocument(
  userId: string,
  input: { name: string; mime: string; sizeBytes: number }
): V1DocumentDetail {
  const rows = readTable<V1DocumentDetail>("documents");
  const now = new Date().toISOString();
  const doc: V1DocumentDetail = {
    id: `doc-${crypto.randomUUID()}`,
    userId,
    name: input.name,
    mime: input.mime,
    sizeBytes: input.sizeBytes,
    status: "processing",
    storageKey: null,
    createdAt: now,
    updatedAt: now,
    jobs: [],
    report: null,
    extractedText: null,
    previewUrl: null,
  };
  rows.push(doc);
  writeTable("documents", rows);
  return doc;
}

/**
 * Record where an uploaded document's bytes were stored. Called by the
 * upload-complete route once the file has been written to disk, so the
 * preview/file/download routes can resolve it.
 */
export function setDemoDocumentStorageKey(
  userId: string,
  id: string,
  storageKey: string
): V1DocumentDetail | undefined {
  const rows = readTable<V1DocumentDetail>("documents");
  const idx = rows.findIndex((d) => d.id === id && d.userId === userId);
  if (idx === -1) return undefined;
  rows[idx] = { ...rows[idx]!, storageKey, updatedAt: new Date().toISOString() };
  writeTable("documents", rows);
  return rows[idx];
}

/**
 * Update a document's status (e.g. processing → ready after upload completes).
 * Returns the updated row, or undefined if the document is not found.
 */
export function updateDemoDocumentStatus(
  userId: string,
  id: string,
  status: V1DocumentDetail["status"]
): V1DocumentDetail | undefined {
  const rows = readTable<V1DocumentDetail>("documents");
  const idx = rows.findIndex((d) => d.id === id && d.userId === userId);
  if (idx === -1) return undefined;
  rows[idx] = { ...rows[idx]!, status, updatedAt: new Date().toISOString() };
  writeTable("documents", rows);
  return rows[idx];
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

export function createDemoMemory(
  userId: string,
  input: { key: string; value: string; category?: V1MemoryItem["category"] }
): V1MemoryItem {
  const now = new Date().toISOString();
  const category = input.category ?? "legal_context";
  const categoryFa =
    category === "profile"
      ? "اطلاعات کاربر"
      : category === "preference"
        ? "تنظیمات برگزیده"
        : "اطلاعات حقوقی";
  const item: V1MemoryItem = {
    id: crypto.randomUUID(),
    userId,
    key: input.key.trim(),
    value: input.value.trim(),
    category,
    categoryFa,
    sensitivity: category === "legal_context" ? "normal" : "normal",
    sensitivityFa: "عادی",
    status: "active",
    createdAt: now,
    updatedAt: now,
    consentGiven: true,
    consentDate: now,
  };
  const rows = readTable<V1MemoryItem>("memories");
  rows.push(item);
  writeTable("memories", rows);
  return item;
}

export function listDemoRelationships(userId: string, sourceType?: string, sourceId?: string): DemoRelationship[] {
  let rows = readTable<DemoRelationship>("relationships").filter((r) => r.userId === userId);
  if (sourceType && sourceId) {
    rows = rows.filter((r) => r.sourceType === sourceType && r.sourceId === sourceId);
  }
  return rows;
}

/**
 * Remove every relationship row that references a resource, in either
 * direction (as source or target). Called when a document or contract is
 * deleted so no dangling edges are left behind. Scoped to the owner.
 */
export function deleteDemoRelationshipsFor(userId: string, resourceId: string): void {
  const rows = readTable<DemoRelationship>("relationships");
  const next = rows.filter(
    (r) =>
      !(
        r.userId === userId &&
        (((r.sourceType === "document" || r.sourceType === "contract") &&
          r.sourceId === resourceId) ||
          ((r.targetType === "document" || r.targetType === "contract") &&
            r.targetId === resourceId))
      )
  );
  if (next.length !== rows.length) writeTable("relationships", next);
}

// ============================================================
// Contract create / update / generate (mutates .data/contracts.json)
// ============================================================
// These back the "قرارداد جدید" wizard so a user-created contract is
// persisted and appears in the list/detail, then "generated" into a
// version + content (a deterministic template, not a real LLM call).

export interface CreateDemoContractResult {
  id: string;
  typeId: V1ContractType;
  title: string;
  typeFa: string;
  category: "personal" | "business";
  state: "collecting";
  createdAt: string;
}

export function createDemoContract(
  userId: string,
  typeId: V1ContractType,
  title: string
): CreateDemoContractResult {
  const typeFa =
    typeId === "lease" ? "اجاره"
    : typeId === "sale_purchase" ? "خرید و فروش"
    : typeId === "loan" ? "قرض"
    : typeId === "partnership" ? "شراکت"
    : typeId === "nda" ? "NDA"
    : typeId === "employment" ? "استخدام"
    : typeId === "saas" ? "SaaS"
    : typeId === "contracting" ? "پیمانکاری"
    : "سرمایه‌گذاری";
  const category: "personal" | "business" =
    typeId === "lease" || typeId === "sale_purchase" || typeId === "loan" || typeId === "partnership"
      ? "personal"
      : "business";

  const id = `cnt-${typeId}-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const contract: V1ContractDetail = {
    id,
    userId,
    title,
    type: typeId,
    typeFa,
    category,
    state: "collecting",
    currentVersionId: null,
    currentVersionNumber: 0,
    versions: [],
    analysis: null,
    attachments: [],
    createdAt: now,
    updatedAt: now,
    disclaimer: DISCLAIMER,
  };

  const rows = readTable<V1ContractDetail>("contracts");
  rows.push(contract);
  writeTable("contracts", rows);

  return { id, typeId, title, typeFa, category, state: "collecting", createdAt: now };
}

export function updateDemoContract(
  userId: string,
  id: string,
  updates: { title?: string; state?: V1ContractDetail["state"]; answers?: Record<string, string> }
): V1ContractDetail | undefined {
  const rows = readTable<V1ContractDetail>("contracts");
  const idx = rows.findIndex((c) => c.id === id && c.userId === userId);
  if (idx === -1) return undefined;

  const existing = rows[idx]!;
  const merged: V1ContractDetail = {
    ...existing,
    ...(updates.title !== undefined ? { title: updates.title } : {}),
    ...(updates.state !== undefined ? { state: updates.state } : {}),
    updatedAt: new Date().toISOString(),
  };

  // If answers were provided, attach them to the latest version (or create v1).
  if (updates.answers && merged.versions.length > 0) {
    const last = merged.versions[merged.versions.length - 1]!;
    last.answers = { ...last.answers, ...updates.answers };
    merged.updatedAt = new Date().toISOString();
  }

  rows[idx] = merged;
  writeTable("contracts", rows);
  return merged;
}

/** Build a deterministic draft contract from the wizard answers. */
function buildGeneratedContent(title: string, typeFa: string, answers: Record<string, string>): string {
  const lines: string[] = [`${title}`, "", "ماده ۱ - طرفین قرارداد"];
  const partyKeys = Object.keys(answers).filter((k) => k.includes("name") || k.includes("party") || k.includes("employer") || k.includes("employee"));
  if (partyKeys.length > 0) {
    lines.push(partyKeys.map((k) => `${answers[k]}`).join(" و ") + " طرفین این قرارداد می‌باشند.");
  } else {
    lines.push("طرفین این قرارداد به شرح ذیل معرفی می‌شوند.");
  }
  lines.push("", "ماده ۲ - موضوع قرارداد");
  lines.push(`موضوع این قرارداد، ${typeFa} بر اساس توافقات فی‌مابین طرفین است.`);
  lines.push("", "ماده ۳ - شرایط و تعهدات");
  const other = Object.entries(answers).filter(([k]) => !partyKeys.includes(k));
  if (other.length > 0) {
    for (const [k, v] of other) lines.push(`- ${k}: ${v}`);
  } else {
    lines.push("- شرایط و تعهدات طرفین مطابق توافقات صورت‌گرفته اجرا می‌گردد.");
  }
  lines.push("", "ماده ۴ - حل اختلاف");
  lines.push("در صورت بروز اختلاف، طرفین ابتدا به مذاکره و در صورت عدم حصول نتیجه به مرجع صالح قضایی مراجعه خواهند نمود.");
  return lines.join("\n");
}

export function generateDemoContract(
  userId: string,
  id: string
): V1ContractGenerateResponse | undefined {
  const rows = readTable<V1ContractDetail>("contracts");
  const idx = rows.findIndex((c) => c.id === id && c.userId === userId);
  if (idx === -1) return undefined;

  const existing = rows[idx]!;
  const now = new Date().toISOString();
  const versionNumber = existing.versions.length + 1;

  // Prefer the answers captured on the contract's latest version; fall back
  // to the wizard draft (which holds the answers until generation completes).
  let answers = existing.versions[existing.versions.length - 1]?.answers ?? {};
  if (Object.keys(answers).length === 0) {
    const draft = getDemoContractDraft(userId, existing.type);
    if (draft) answers = draft.answers;
  }

  const content = buildGeneratedContent(existing.title, existing.typeFa, answers);

  const version: V1ContractVersionDetail = {
    id: `${id}-ver-${versionNumber}`,
    contractId: id,
    versionNumber,
    answers,
    content,
    clauses: [
      { id: `${id}-cl-1`, title: "ماده ۱ - طرفین قرارداد", content: "مشخصات طرفین قرارداد.", isProtective: false, importance: "essential" },
      { id: `${id}-cl-2`, title: "ماده ۲ - موضوع قرارداد", content: `موضوع قرارداد ${existing.typeFa} است.`, isProtective: false, importance: "essential" },
      { id: `${id}-cl-3`, title: "ماده ۴ - حل اختلاف", content: "ارجاع اختلاف به مذاکره و سپس مرجع صالح.", isProtective: true, importance: "recommended" },
    ],
    state: "generated",
    createdAt: now,
  };

  const merged: V1ContractDetail = {
    ...existing,
    state: "generated",
    currentVersionId: version.id,
    currentVersionNumber: versionNumber,
    versions: [...existing.versions, version],
    updatedAt: now,
  };

  rows[idx] = merged;
  writeTable("contracts", rows);

  return {
    id,
    state: "generated",
    currentVersionId: version.id,
    versionNumber,
    content,
    clauses: version.clauses,
  };
}

// ============================================================
// Contract drafts (mutates .data/contract-drafts.json)
// ============================================================

export function getDemoContractDraft(userId: string, typeId: string): V1ContractDraft | null {
  const rows = readTable<(V1ContractDraft & { userId: string })>("contract-drafts");
  const existing = rows.find((d) => d.userId === userId && d.typeId === typeId);
  if (!existing) return null;
  const { userId: _u, ...draft } = existing;
  return draft;
}

export function saveDemoContractDraft(
  userId: string,
  typeId: string,
  currentStep: number,
  answers: Record<string, string>
): V1ContractDraft {
  const rows = readTable<(V1ContractDraft & { userId: string })>("contract-drafts");
  const idx = rows.findIndex((d) => d.userId === userId && d.typeId === typeId);
  const now = new Date().toISOString();

  const draft: V1ContractDraft & { userId: string } = {
    id: `draft-${typeId}`,
    userId,
    contractId: null,
    typeId: typeId as V1ContractType,
    currentStep,
    answers,
    savedAt: now,
    createdAt: idx >= 0 ? rows[idx]!.createdAt : now,
    updatedAt: now,
  };

  if (idx >= 0) rows[idx] = draft;
  else rows.push(draft);
  writeTable("contract-drafts", rows);

  const { userId: _u, ...out } = draft;
  return out;
}

export function deleteDemoContractDraft(userId: string, typeId: string): boolean {
  let rows = readTable<(V1ContractDraft & { userId: string })>("contract-drafts");
  const before = rows.length;
  rows = rows.filter((d) => !(d.userId === userId && d.typeId === typeId));
  if (rows.length === before) return false;
  writeTable("contract-drafts", rows);
  return true;
}
