// ============================================================
// LEGALIR — Demo Lawyer Seed (server-only)
// ============================================================
// Seeds 10 clearly-marked demo lawyers (isDemo: true) across the
// LegalCategory slugs so the marketplace and the matching engine have
// realistic data in dev. Every row is VERIFIED and carries a synthetic
// `userId` (demo-user-*) that never collides with a real account.
//
// Idempotent: guarded by a `lawyer_meta` seed_version, and rows are
// upserted by id so re-running the dev server never duplicates.
//
// IMPORTANT: performance metrics are NOT stored here — they are derived
// at read time by computePerformance() from real requests/reviews. The
// `performance` field below is a zeroed placeholder that the read path
// overwrites. No fabricated win-rate is ever seeded.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import type {
  LawyerProfile,
  LawyerPerformance,
  LawyerAvailabilityStatus,
  LawyerAvatarType,
} from "@legalir/types";

/**
 * Mirrors LawyerReviewRow in lawyer-db.ts. Declared locally to keep this
 * module free of a circular import with db.ts (which imports this file).
 */
interface LawyerReviewRow {
  id: string;
  lawyerId: string;
  authorUserId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), ".data");

export const LAWYER_SEED_VERSION = "legalir-lawyers-v4";

// ---------------------------------------------------------------------------
// JSON-DB primitives (self-contained to avoid a circular import with db.ts)
// ---------------------------------------------------------------------------

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readTable<T>(name: string): T[] {
  ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T[];
  } catch {
    return [];
  }
}

function writeTable<T>(name: string, data: T[]): void {
  ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

interface LawyerMeta {
  version: string;
  seededAt: string;
}

function getLawyerMeta(): LawyerMeta | undefined {
  return readTable<LawyerMeta>("lawyer_meta")[0];
}

// ---------------------------------------------------------------------------
// Placeholder performance — overwritten by computePerformance() on read.
// ---------------------------------------------------------------------------

const ZERO_PERFORMANCE: LawyerPerformance = {
  acceptedRequests: 0,
  completedCases: 0,
  medianResponseMinutes: null,
  averageRating: null,
  reviewCount: 0,
};

const SEEDED_AT = "2026-08-01T08:00:00.000Z";

// ---------------------------------------------------------------------------
// Demo lawyers
// ---------------------------------------------------------------------------

interface DemoLawyerSpec {
  id: string;
  fullName: string;
  /** Short professional headline shown under the name on the card. */
  professionalTitle: string;
  licenseNumber: string;
  licenseYear: number;
  bio: string;
  specializations: { category: string; yearsExperience: number }[];
  province: string;
  city: string;
  remote: boolean;
  consultationFeeToman: number;
  /** Standard consultation length in minutes. */
  consultationDurationMinutes: number;
  hourlyRateToman: number;
  contractReviewFeeToman: number;
  freeFirstConsultation: boolean;
  /**
   * Availability for NEW requests. Kept independent of `consultationCapacity`
   * so the card can show «فعال» alongside «۲ ظرفیت باقی‌مانده».
   */
  availabilityStatus: LawyerAvailabilityStatus;
  /** Open consultation slots; null = unlimited/unknown, 0 = full. */
  consultationCapacity: number | null;
  acceptingRequests: boolean;
  /**
   * Synthetic demo portrait filename under /assets/lawyers/. These are
   * generated portraits — never real photographs of the named people.
   */
  avatarFile: string;
}

// ---------------------------------------------------------------------------
// Demo lawyers
// ---------------------------------------------------------------------------
// Nine profiles chosen so every availability state is visible in the UI:
//   علی ذبیحی      REJECTED               — rated 4.5 / 12 reviews
//   مهدیه فرسایی   LIMITED (2)
//   حسام ساکی      ACTIVE (unlimited)
//   محدثه رضایی    INACTIVE
//   ناهید عبدالهی  AVAILABLE_SLOTS (10)
//   علی شکری       FULL (0)
//   فربد صالح      AVAILABLE_SLOTS (8)    — criminal defence
//   فرشین گنجی     AVAILABLE_SLOTS (6)    — immigration, rated 1.0 / 5
//   مهدی اسمعیلی   AVAILABLE_SLOTS (5)    — labour, in-person only
//
// Names are real, but every professional detail (specialty, experience,
// licence, rating) is DEMO DATA. All nine are `isDemo: true` and are never
// presented as verified practitioners.
// ---------------------------------------------------------------------------

const DEMO_LAWYERS: DemoLawyerSpec[] = [
  {
    id: "demo-lawyer-01",
    fullName: "علی ذبیحی",
    professionalTitle: "مشاور حقوق کسب‌وکار",
    licenseNumber: "۱۲۳۴۵",
    licenseYear: 1390,
    bio: "مشاور حقوقی کسب‌وکار با تمرکز بر قراردادهای تجاری، حقوق شرکت‌ها و ساختاردهی معاملات. همراهی استارتاپ‌ها و شرکت‌های در حال رشد از مرحله مذاکره تا انعقاد قرارداد.",
    specializations: [
      { category: "contract", yearsExperience: 12 },
      { category: "companies", yearsExperience: 10 },
      { category: "commerce", yearsExperience: 9 },
    ],
    province: "تهران",
    city: "تهران",
    remote: true,
    consultationFeeToman: 1_500_000,
    consultationDurationMinutes: 60,
    hourlyRateToman: 2_500_000,
    contractReviewFeeToman: 4_000_000,
    freeFirstConsultation: false,
    // Removed from the marketplace by LEGALIR review — the card renders the
    // red «رد شده توسط کانون وکلای لیگالیر» treatment instead of a CTA.
    availabilityStatus: "REJECTED",
    consultationCapacity: null,
    acceptingRequests: false,
    avatarFile: "lawyer-demo-ali-zabihi.webp",
  },
  {
    id: "demo-lawyer-02",
    fullName: "مهدیه فرسایی",
    professionalTitle: "وکیل خانواده و املاک",
    licenseNumber: "۲۲۸۷۱",
    licenseYear: 1392,
    bio: "وکیل دعاوی خانواده و املاک؛ طلاق توافقی، حضانت فرزند، الزام به تنظیم سند رسمی و اختلافات مالک و مستأجر. رویکردی آرام و راه‌حل‌محور در پرونده‌های خانوادگی.",
    specializations: [
      { category: "family", yearsExperience: 11 },
      { category: "contract", yearsExperience: 8 },
      { category: "real_estate", yearsExperience: 7 },
    ],
    province: "تهران",
    city: "تهران",
    remote: true,
    consultationFeeToman: 1_100_000,
    consultationDurationMinutes: 45,
    hourlyRateToman: 1_900_000,
    contractReviewFeeToman: 2_800_000,
    freeFirstConsultation: true,
    availabilityStatus: "LIMITED",
    consultationCapacity: 2,
    acceptingRequests: true,
    avatarFile: "lawyer-demo-mahdieh-farsaei.webp",
  },
  {
    id: "demo-lawyer-03",
    fullName: "حسام ساکی",
    professionalTitle: "وکیل فناوری و جرائم سایبری",
    licenseNumber: "۳۱۰۹۲",
    licenseYear: 1396,
    bio: "وکیل حقوق فناوری؛ تنظیم و بازبینی قراردادهای نرم‌افزاری و SaaS، ثبت و حمایت از دارایی‌های فکری دیجیتال و پیگیری پرونده‌های جرائم سایبری.",
    specializations: [
      { category: "technology", yearsExperience: 7 },
      { category: "software", yearsExperience: 6 },
      { category: "cyber", yearsExperience: 5 },
      { category: "saas", yearsExperience: 4 },
    ],
    province: "تهران",
    city: "تهران",
    remote: true,
    consultationFeeToman: 900_000,
    consultationDurationMinutes: 45,
    hourlyRateToman: 1_600_000,
    contractReviewFeeToman: 2_400_000,
    freeFirstConsultation: true,
    availabilityStatus: "ACTIVE",
    consultationCapacity: null,
    acceptingRequests: true,
    avatarFile: "lawyer-demo-hesam-saki.webp",
  },
  {
    id: "demo-lawyer-04",
    fullName: "محدثه رضایی",
    professionalTitle: "کارشناس حقوق دیجیتال",
    licenseNumber: "۳۹۰۱۱",
    licenseYear: 1400,
    bio: "کارشناس حقوق دیجیتال و ثبت برند؛ مشاوره در زمینه ثبت علامت تجاری، قراردادهای محتوایی و حقوق داده. در حال حاضر مشاوره جدید نمی‌پذیرد.",
    specializations: [
      { category: "digital", yearsExperience: 3 },
      { category: "brand", yearsExperience: 3 },
      { category: "contract", yearsExperience: 2 },
    ],
    province: "تهران",
    city: "تهران",
    remote: true,
    consultationFeeToman: 600_000,
    consultationDurationMinutes: 30,
    hourlyRateToman: 1_100_000,
    contractReviewFeeToman: 1_600_000,
    freeFirstConsultation: true,
    availabilityStatus: "INACTIVE",
    consultationCapacity: null,
    acceptingRequests: false,
    avatarFile: "lawyer-demo-mohadeseh-rezaei.webp",
  },
  {
    id: "demo-lawyer-05",
    fullName: "ناهید عبدالهی",
    professionalTitle: "مشاور حقوق شرکت‌ها و تجارت",
    licenseNumber: "۱۵۶۳۳",
    licenseYear: 1394,
    bio: "مشاور حقوق شرکت‌ها و تجارت؛ ثبت و تغییرات شرکت، افزایش سرمایه، دعاوی سهامداران و قراردادهای تجاری. همراهی شرکت‌های دانش‌بنیان در مسیر رشد.",
    specializations: [
      { category: "companies", yearsExperience: 9 },
      { category: "commerce", yearsExperience: 8 },
      { category: "contract", yearsExperience: 7 },
    ],
    province: "تهران",
    city: "تهران",
    remote: true,
    consultationFeeToman: 1_300_000,
    consultationDurationMinutes: 60,
    hourlyRateToman: 2_200_000,
    contractReviewFeeToman: 3_200_000,
    freeFirstConsultation: false,
    availabilityStatus: "AVAILABLE_SLOTS",
    consultationCapacity: 10,
    acceptingRequests: true,
    avatarFile: "lawyer-demo-nahid-abdollahi.webp",
  },
  {
    id: "demo-lawyer-06",
    fullName: "علی شکری",
    professionalTitle: "وکیل مالیاتی و شرکت‌ها",
    licenseNumber: "۱۹۸۷۶",
    licenseYear: 1386,
    bio: "وکیل حقوق مالیاتی و شرکت‌ها؛ تنظیم لایحه اعتراض به برگ تشخیص، حل اختلاف با سازمان امور مالیاتی و مشاوره ساختار مالی شرکت‌ها. ظرفیت مشاوره این دوره تکمیل شده است.",
    specializations: [
      { category: "tax", yearsExperience: 15 },
      { category: "companies", yearsExperience: 12 },
      { category: "commerce", yearsExperience: 10 },
    ],
    province: "تهران",
    city: "تهران",
    remote: false,
    consultationFeeToman: 1_400_000,
    consultationDurationMinutes: 60,
    hourlyRateToman: 2_300_000,
    contractReviewFeeToman: 3_400_000,
    freeFirstConsultation: false,
    availabilityStatus: "FULL",
    consultationCapacity: 0,
    acceptingRequests: false,
    avatarFile: "lawyer-demo-ali-shokri.webp",
  },
  {
    id: "demo-lawyer-07",
    fullName: "فربد صالح",
    professionalTitle: "وکیل جنایی",
    licenseNumber: "۲۷۴۵۸",
    licenseYear: 1393,
    bio: "وکیل دعاوی کیفری؛ دفاع در پرونده‌های سرقت، کلاهبرداری، ضرب و جرح و جرائم اقتصادی، همراهی در مرحله تحقیقات مقدماتی و تنظیم لایحه دفاعیه در دادگاه کیفری.",
    specializations: [
      { category: "criminal", yearsExperience: 10 },
      { category: "cyber", yearsExperience: 6 },
      { category: "checks", yearsExperience: 5 },
    ],
    province: "تهران",
    city: "تهران",
    remote: true,
    consultationFeeToman: 1_200_000,
    consultationDurationMinutes: 45,
    hourlyRateToman: 2_000_000,
    contractReviewFeeToman: 2_600_000,
    freeFirstConsultation: true,
    availabilityStatus: "AVAILABLE_SLOTS",
    consultationCapacity: 8,
    acceptingRequests: true,
    avatarFile: "lawyer-demo-farbod-saleh.webp",
  },
  {
    id: "demo-lawyer-08",
    fullName: "فرشین گنجی",
    professionalTitle: "وکیل مهاجرت",
    licenseNumber: "۳۳۱۲۰",
    licenseYear: 1395,
    bio: "وکیل مهاجرت؛ پرونده‌های اقامت، ویزای کاری و تحصیلی، تابعیت و درخواست پناهندگی. آماده‌سازی مدارک، تنظیم لایحه و پیگیری پرونده در مراجع مهاجرتی.",
    specializations: [
      { category: "immigration", yearsExperience: 8 },
      { category: "contract", yearsExperience: 5 },
    ],
    province: "تهران",
    city: "تهران",
    remote: true,
    consultationFeeToman: 1_000_000,
    consultationDurationMinutes: 45,
    hourlyRateToman: 1_800_000,
    contractReviewFeeToman: 2_200_000,
    freeFirstConsultation: true,
    availabilityStatus: "AVAILABLE_SLOTS",
    consultationCapacity: 6,
    acceptingRequests: true,
    avatarFile: "lawyer-demo-farshin-ganji.webp",
  },
  {
    id: "demo-lawyer-09",
    fullName: "مهدی اسمعیلی",
    professionalTitle: "وکیل کار و تأمین اجتماعی",
    licenseNumber: "۲۹۰۴۷",
    licenseYear: 1391,
    bio: "وکیل دعاوی کار و تأمین اجتماعی؛ مطالبه حقوق و مزایا، سنوات و عیدی، بیمه بیکاری، کمیسیون‌های تشخیص و حل اختلاف و بازنشستگی. مشاوره فقط به صورت حضوری در دفتر تهران.",
    specializations: [
      { category: "labor", yearsExperience: 12 },
      { category: "contract", yearsExperience: 7 },
    ],
    province: "تهران",
    city: "تهران",
    // In-person only — no online consultation.
    remote: false,
    consultationFeeToman: 950_000,
    consultationDurationMinutes: 45,
    hourlyRateToman: 1_700_000,
    contractReviewFeeToman: 2_000_000,
    freeFirstConsultation: false,
    availabilityStatus: "AVAILABLE_SLOTS",
    consultationCapacity: 5,
    acceptingRequests: true,
    avatarFile: "lawyer-demo-mehdi-esmaeili.webp",
  },
];

const PERSIAN_LANGUAGE = { code: "fa", labelFa: "فارسی", proficiency: "native" as const };
const ENGLISH_LANGUAGE = { code: "en", labelFa: "انگلیسی", proficiency: "fluent" as const };

/** Standard weekly availability: Sat–Wed 09:00–17:00, Thu 09:00–13:00. */
const STANDARD_AVAILABILITY = [
  { weekday: 0, startTime: "09:00", endTime: "17:00" },
  { weekday: 1, startTime: "09:00", endTime: "17:00" },
  { weekday: 2, startTime: "09:00", endTime: "17:00" },
  { weekday: 3, startTime: "09:00", endTime: "17:00" },
  { weekday: 4, startTime: "09:00", endTime: "13:00" },
];

/** Demo portraits are synthetic — never real photographs of the named people. */
const DEMO_AVATAR_TYPE: LawyerAvatarType = "demo";

function buildProfile(spec: DemoLawyerSpec): LawyerProfile {
  return {
    id: spec.id,
    userId: `demo-user-${spec.id}`,
    fullName: spec.fullName,
    professionalTitle: spec.professionalTitle,
    licenseNumber: spec.licenseNumber,
    licenseYear: spec.licenseYear,
    bio: spec.bio,
    avatarUrl: `/assets/lawyers/${spec.avatarFile}`,
    avatarType: DEMO_AVATAR_TYPE,
    verificationStatus: "VERIFIED",
    verifiedAt: SEEDED_AT,
    verificationNote: null,
    specializations: spec.specializations.map((s) => ({
      category: s.category,
      yearsExperience: s.yearsExperience,
      note: null,
    })),
    locations: [{ province: spec.province, city: spec.city, remote: spec.remote }],
    languages: [PERSIAN_LANGUAGE, ENGLISH_LANGUAGE],
    pricing: {
      consultationFeeToman: spec.consultationFeeToman,
      consultationDurationMinutes: spec.consultationDurationMinutes,
      hourlyRateToman: spec.hourlyRateToman,
      contractReviewFeeToman: spec.contractReviewFeeToman,
      freeFirstConsultation: spec.freeFirstConsultation,
    },
    availability: STANDARD_AVAILABILITY,
    performance: ZERO_PERFORMANCE,
    availabilityStatus: spec.availabilityStatus,
    consultationCapacity: spec.consultationCapacity,
    isDemo: true,
    acceptingRequests: spec.acceptingRequests,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  };
}

// ---------------------------------------------------------------------------
// Demo reviews
// ---------------------------------------------------------------------------
// علی ذبیحی carries 4.5 / 12 reviews and فرشین گنجی 1.0 / 5, so the rated,
// low-rated AND unrated card states are all visible. These are DEMO reviews
// — the author is a synthetic demo user, never a real account.
// ---------------------------------------------------------------------------

interface DemoReviewSpec {
  lawyerId: string;
  /** 1–5 ratings; the average is derived from these, never stored. */
  ratings: number[];
  /** Optional per-review comments; falls back to the shared pool. */
  comments?: string[];
}

const DEMO_REVIEWS: DemoReviewSpec[] = [
  { lawyerId: "demo-lawyer-01", ratings: [5, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 4] },
  {
    lawyerId: "demo-lawyer-08",
    ratings: [1, 1, 1, 1, 1],
    comments: [
      "متأسفانه پیگیری پرونده بسیار کند بود و پاسخ‌گویی به‌موقع نداشتند.",
      "مشاوره کوتاه و کلی بود و به جزئیات پرونده من وارد نشدند.",
      "هزینه مشاوره با کیفیت دریافتی هم‌خوانی نداشت.",
      "چند بار برای پیگیری تماس گرفتم و پاسخ روشنی نگرفتم.",
      "انتظار داشتم مدارک را دقیق‌تر بررسی کنند؛ راضی نبودم.",
    ],
  },
];

const DEMO_REVIEW_COMMENTS = [
  "مشاوره دقیق و کاربردی بود، قرارداد را کامل بازبینی کردند.",
  "پاسخ‌گویی سریع و توضیحات شفاف. راضی بودم.",
  "نکات مهمی را مطرح کردند که خودم متوجه نشده بودم.",
  "برخورد حرفه‌ای و صبورانه در توضیح گزینه‌ها.",
];

function buildDemoReviews(): LawyerReviewRow[] {
  const rows: LawyerReviewRow[] = [];
  for (const spec of DEMO_REVIEWS) {
    spec.ratings.forEach((rating, i) => {
      rows.push({
        id: `demo-review-${spec.lawyerId}-${i + 1}`,
        lawyerId: spec.lawyerId,
        authorUserId: `demo-user-reviewer-${i + 1}`,
        rating,
        comment:
          spec.comments?.[i] ?? DEMO_REVIEW_COMMENTS[i % DEMO_REVIEW_COMMENTS.length]!,
        createdAt: SEEDED_AT,
      });
    });
  }
  return rows;
}

/**
 * Seed the demo lawyers. Upserts by id (never clobbers a real lawyer row
 * that happens to share an id — demo ids are namespaced `demo-lawyer-*`).
 */
export function seedDemoLawyers(): void {
  const meta = getLawyerMeta();
  if (meta && meta.version === LAWYER_SEED_VERSION) return;

  // Drop stale demo rows from an earlier seed version, then upsert the
  // current set. Real (non-demo) profiles are never touched.
  const existing = readTable<LawyerProfile>("lawyer_profiles");
  const byId = new Map(existing.filter((l) => !l.isDemo).map((l) => [l.id, l]));
  for (const spec of DEMO_LAWYERS) {
    byId.set(spec.id, buildProfile(spec));
  }
  writeTable<LawyerProfile>("lawyer_profiles", [...byId.values()]);

  // Demo reviews are upserted by id so re-seeding never duplicates them.
  const existingReviews = readTable<LawyerReviewRow>("lawyer_reviews");
  const reviewsById = new Map(existingReviews.map((r) => [r.id, r]));
  for (const row of buildDemoReviews()) reviewsById.set(row.id, row);
  writeTable<LawyerReviewRow>("lawyer_reviews", [...reviewsById.values()]);

  writeTable<LawyerMeta>("lawyer_meta", [
    { version: LAWYER_SEED_VERSION, seededAt: new Date().toISOString() },
  ]);
}
