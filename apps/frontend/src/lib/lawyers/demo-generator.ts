// ============================================================
// LEGALIR — Deterministic demo-lawyer generator
// ============================================================
// Produces a large, realistic demo roster (~230 on top of the 20 curated
// profiles) WITHOUT hand-writing every row. Everything is derived from the
// `@legalir/types` taxonomy + geography catalogues through a seeded PRNG, so
// the same seed always yields the same roster — the seed stays idempotent and
// tests can assert on stable ids.
//
// This module is PURE: it generates in-memory specs and avatar data-URIs and
// performs NO file I/O. `lawyer-seed.ts` turns the specs into DB rows.
//
// All data is SYNTHETIC: names are common Persian names, licence numbers and
// ratings are fabricated, and every profile is flagged `isDemo`. No real
// personal information is produced.
// ============================================================

import {
  LAWYER_TAXONOMY,
  LAWYER_SERVICES,
  LAWYER_JURISDICTIONS,
  IRAN_PROVINCES,
  LAWYER_PROFESSIONAL_RANKS,
  LAWYER_ORGANIZATION_TYPES,
  taxonomyChildren,
  taxonomyLabel,
  type LawyerAvailabilityStatus,
  type LawyerGender,
  type LawyerOrganizationType,
  type LawyerProfessionalRank,
  type LawyerLicenseStatus,
  type LawyerMarketplaceVisibility,
} from "@legalir/types";

/** How many generated profiles the roster adds beyond the curated set. */
export const GENERATED_LAWYER_COUNT = 230;

/** The PRNG seed — bumping it reshuffles the whole generated roster. */
const ROSTER_SEED = 0x1e9a17;

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — small, fast, stable across platforms
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tiny seeded-random helper bound to one PRNG instance. */
class Rng {
  private readonly next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  /** Float in [0, 1). */
  float(): number {
    return this.next();
  }
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }
  /** Pick a uniformly random element. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }
  /** Pick from a weighted list (weights need not sum to 1). */
  weighted<T>(entries: readonly { value: T; weight: number }[]): T {
    const total = entries.reduce((s, e) => s + e.weight, 0);
    let r = this.next() * total;
    for (const e of entries) {
      r -= e.weight;
      if (r <= 0) return e.value;
    }
    return entries[entries.length - 1]!.value;
  }
  /** Pick `count` distinct elements. */
  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    const n = Math.min(count, pool.length);
    for (let i = 0; i < n; i++) {
      out.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0]!);
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Name pools (common Persian names — synthetic pairing, not real people)
// ---------------------------------------------------------------------------

const MALE_FIRST = [
  "علی", "محمد", "حسین", "رضا", "امیر", "مهدی", "سعید", "حسن", "احمد", "محسن",
  "بهرام", "کامران", "کاوه", "آرش", "فرهاد", "سیاوش", "بابک", "داریوش", "کوروش", "پرویز",
  "ناصر", "فریبرز", "منوچهر", "جمشید", "اردشیر", "آبتین", "آریا", "بردیا", "پویا", "پیمان",
  "تورج", "جهانگیر", "حامد", "حمید", "خشایار", "رامین", "سامان", "سینا", "شاهین", "شهاب",
  "صادق", "طاها", "عباس", "عرفان", "فرشاد", "فرشید", "فرزاد", "فربد", "کیوان", "مازیار",
  "مجید", "محمدرضا", "مسعود", "میلاد", "نادر", "نیما", "وحید", "هومن", "یاسر", "یوسف",
  "امین", "امیرحسین", "بهزاد", "پرهام", "پیام", "جواد", "سجاد", "سروش", "سلمان", "شایان",
  "عادل", "علیرضا", "فرید", "کامبیز", "متین", "محمدحسین", "مرتضی", "مهدیار", "میثم", "هادی",
  "ایمان", "بهنام", "پدرام", "پوریا", "تیمور", "حبیب", "رستم", "سهراب", "سیامک", "شروین",
];

const FEMALE_FIRST = [
  "فاطمه", "زهرا", "مریم", "سارا", "نرگس", "الهام", "ناهید", "مینا", "پریسا", "شیرین",
  "بهاره", "نگار", "محدثه", "مهدیه", "نسرین", "سمیرا", "لیلا", "رویا", "آزاده", "شهرزاد",
  "فرشته", "مهسا", "مرجان", "ملیحه", "نازنین", "هدیه", "یاسمن", "آرزو", "افسانه", "اکرم",
  "بهناز", "پریا", "ترانه", "حدیث", "حمیرا", "خدیجه", "رباب", "زینب", "سپیده", "سحر",
  "سمانه", "سودابه", "شادی", "شکوفه", "صبا", "طاهره", "عاطفه", "غزاله", "فریبا", "فرزانه",
  "کبری", "گلناز", "لادن", "محبوبه", "معصومه", "منیره", "مهرناز", "نازیلا", "ندا", "نعیمه",
  "نورا", "هاله", "هستی", "هما", "یگانه", "آناهیتا", "آیدا", "بهار", "پگاه", "دلارام",
  "رها", "شبنم", "طرلان", "عسل", "غزل", "کیمیا", "نگین", "نیلوفر", "ویدا", "پرستو",
];

const LAST_NAMES = [
  "احمدی", "محمدی", "حسینی", "رضایی", "موسوی", "کریمی", "صادقی", "جعفری", "نوری", "قاسمی",
  "کاظمی", "مرادی", "نیکنام", "سلطانی", "عبدالهی", "فرسایی", "ساکی", "شکری", "صالح", "گنجی",
  "اسمعیلی", "شریفی", "تهرانی", "یزدانی", "ذبیحی", "رحیمی", "زارع", "بیات", "تقوی", "ثابتی",
  "جلالی", "حیدری", "خسروی", "درویش", "رستمی", "زاهدی", "سالاری", "شمس", "صفری", "طاهری",
  "عباسی", "غفاری", "فتحی", "قربانی", "کیانی", "گلستانی", "لطفی", "مهدوی", "نظری", "وحیدی",
  "هاشمی", "یاری", "اکبری", "امینی", "بابایی", "پورمحمدی", "چراغی", "حاجی‌زاده", "دهقان", "رجبی",
  "زینالی", "سپهری", "شاکری", "صالحی", "ضیایی", "طالبی", "عزیزی", "غلامی", "فراهانی", "قنبری",
  "کاشانی", "کرمانی", "لاجوردی", "محمودی", "نجفی", "همتی", "یاوری", "اصغری", "افشار", "بهرامی",
  "پناهی", "جوانمردی", "حبیبی", "خلیلی", "زمانی", "سرافراز", "شفیعی", "صابری", "طهماسبی", "عارفی",
  "غیاثی", "فرهادی", "قادری", "کریمیان", "مبارکی", "نجاتی", "هوشمند", "یوسفی", "آقایی", "اردلان",
  "بختیاری", "پرتوی", "توکلی", "جمالی", "حقیقی", "خالقی", "داوودی", "رشیدی", "سعیدی", "شریعتی",
  "صدر", "عطایی", "فاضلی", "قوامی", "کرمی", "مقدم", "ناصری", "واعظی", "هدایتی", "یزدان‌پرست",
];

// ---------------------------------------------------------------------------
// Spec shape
// ---------------------------------------------------------------------------

export interface GeneratedEducation {
  degreeFa: string;
  institutionFa: string;
  graduationYear: number | null;
  fieldFa: string | null;
}

export interface GeneratedExperience {
  roleFa: string;
  organizationFa: string;
  startYear: number | null;
  endYear: number | null;
  descriptionFa: string | null;
}

export interface GeneratedLawyerSpec {
  id: string;
  fullName: string;
  gender: LawyerGender;
  professionalTitle: string;
  professionalRank: LawyerProfessionalRank;
  organizationType: LawyerOrganizationType;
  licenseStatus: LawyerLicenseStatus;
  licenseNumber: string;
  /** Jalali licence year. */
  licenseYear: number;
  licenseAuthority: string;
  bio: string;
  /** Taxonomy node ids — `specialtyIds[0]` is the primary. */
  specialtyIds: string[];
  primarySpecialtyId: string;
  province: string;
  city: string;
  remote: boolean;
  consultationFeeToman: number;
  consultationDurationMinutes: number;
  hourlyRateToman: number;
  contractReviewFeeToman: number;
  freeFirstConsultation: boolean;
  availabilityStatus: LawyerAvailabilityStatus;
  consultationCapacity: number | null;
  acceptingRequests: boolean;
  acceptingClients: boolean;
  visibility: LawyerMarketplaceVisibility;
  featured: boolean;
  yearsExperience: number;
  serviceIds: string[];
  jurisdictionIds: string[];
  education: GeneratedEducation[];
  experience: GeneratedExperience[];
  /** Target average rating the seeded reviews should land near (4.1–5.0). */
  targetRating: number;
  /** Number of review rows to seed for this lawyer. */
  reviewCount: number;
  /** Deterministic avatar hue seed. */
  avatarSeed: number;
  /** True when the profile should be seeded as UNVERIFIED (admin REVIEW queue). */
  unverified: boolean;
}

// ---------------------------------------------------------------------------
// Taxonomy helpers
// ---------------------------------------------------------------------------

const DOMAIN_WEIGHTS: Record<string, number> = {
  family: 11,
  criminal: 10,
  property_real_estate: 9,
  contracts: 8,
  commercial: 7,
  labor: 7,
  finance_banking: 6,
  technology_cyber: 5,
  tax: 4,
  intellectual_property: 4,
  enforcement: 4,
  inheritance: 3,
  immigration: 3,
  insurance: 3,
  medical: 3,
  transportation: 3,
  administrative: 3,
  international: 2,
  energy_resources: 2,
  sports_culture: 1,
};

/** Nodes eligible to be a lawyer's PRIMARY specialty (searchable depths). */
const PRIMARY_CANDIDATES = LAWYER_TAXONOMY.filter(
  (n) => n.type === "SUB_SPECIALTY" || n.type === "LEGAL_ISSUE" || n.type === "SPECIALTY"
);

/** Choose a domain slug with product-realistic weighting. */
function pickDomain(rng: Rng): string {
  return rng.weighted(
    Object.entries(DOMAIN_WEIGHTS).map(([value, weight]) => ({ value, weight }))
  );
}

/** A primary specialty node id inside `domainId` (falls back to the domain). */
function pickPrimaryInDomain(rng: Rng, domainId: string): string {
  const inDomain = PRIMARY_CANDIDATES.filter(
    (n) => n.id === domainId || n.id.startsWith(domainId + ".")
  );
  if (inDomain.length === 0) return domainId;
  // Prefer deeper nodes (SUB_SPECIALTY / LEGAL_ISSUE) so search is specific.
  const deep = inDomain.filter((n) => n.type !== "SPECIALTY");
  return rng.pick(deep.length > 0 ? deep : inDomain).id;
}

/** 0–3 secondary specialties, mostly adjacent, sometimes cross-domain. */
function pickSecondaries(rng: Rng, primaryId: string): string[] {
  const out: string[] = [];
  const segments = primaryId.split(".");
  const siblings = segments.flatMap((_, i) => taxonomyChildren(segments.slice(0, i + 1).join(".")));
  const count = rng.int(0, 3);
  for (let i = 0; i < count; i++) {
    const id =
      rng.chance(0.7) && siblings.length > 0
        ? rng.pick(siblings).id
        : rng.pick(PRIMARY_CANDIDATES).id;
    if (id !== primaryId && !out.includes(id)) out.push(id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Experience bands & ratings
// ---------------------------------------------------------------------------

const EXPERIENCE_BANDS = [
  { min: 1, max: 3, weight: 18 },
  { min: 4, max: 7, weight: 26 },
  { min: 8, max: 12, weight: 26 },
  { min: 13, max: 18, weight: 20 },
  { min: 19, max: 28, weight: 10 },
];

const JALALI_NOW = 1405;

// ---------------------------------------------------------------------------
// Availability & status distribution
// ---------------------------------------------------------------------------

/** Statuses a VERIFIED lawyer can carry (mostly ACTIVE). */
function pickAvailability(rng: Rng): {
  status: LawyerAvailabilityStatus;
  capacity: number | null;
  accepting: boolean;
  acceptingClients: boolean;
} {
  const roll = rng.float();
  if (roll < 0.6) {
    return {
      status: rng.chance(0.5) ? "ACTIVE" : "AVAILABLE_SLOTS",
      capacity: rng.chance(0.5) ? null : rng.int(4, 12),
      accepting: true,
      acceptingClients: true,
    };
  }
  if (roll < 0.78) {
    return { status: "LIMITED", capacity: rng.int(1, 3), accepting: true, acceptingClients: true };
  }
  if (roll < 0.88) {
    return { status: "FULL", capacity: 0, accepting: false, acceptingClients: false };
  }
  if (roll < 0.96) {
    return { status: "INACTIVE", capacity: null, accepting: false, acceptingClients: false };
  }
  return { status: "SUSPENDED", capacity: null, accepting: false, acceptingClients: false };
}

// ---------------------------------------------------------------------------
// Bio & title templates
// ---------------------------------------------------------------------------

const TITLE_BY_DOMAIN: Record<string, string> = {
  family: "وکیل دعاوی خانواده",
  criminal: "وکیل دعاوی کیفری",
  property_real_estate: "وکیل دعاوی ملکی",
  contracts: "مشاور قراردادها",
  commercial: "مشاور حقوق شرکت‌ها و تجارت",
  labor: "وکیل کار و تأمین اجتماعی",
  finance_banking: "وکیل دعاوی بانکی و مالی",
  technology_cyber: "وکیل فناوری و جرائم رایانه‌ای",
  tax: "وکیل دعاوی مالیاتی",
  intellectual_property: "وکیل مالکیت فکری",
  enforcement: "وکیل اجرای احکام",
  inheritance: "وکیل ارث و وصیت",
  immigration: "وکیل مهاجرت",
  insurance: "وکیل دعاوی بیمه",
  medical: "وکیل دعاوی پزشکی",
  transportation: "وکیل حوادث و حمل‌ونقل",
  administrative: "وکیل دعاوی اداری",
  international: "وکیل حقوق بین‌الملل",
  energy_resources: "مشاور حقوق انرژی و منابع",
  sports_culture: "مشاور حقوق ورزش و فرهنگ",
};

const CLOSINGS = [
  "پیگیری پرونده تا حصول نتیجه با گزارش‌دهی منظم.",
  "نگاه راه‌حل‌محور و شفاف در ارائهٔ گزینه‌های حقوقی.",
  "تأکید بر پیشگیری از اختلاف و تنظیم دقیق اسناد.",
  "همراهی گام‌به‌گام موکل از مشاورهٔ اولیه تا اجرا.",
  "پاسخ‌گویی سریع و بررسی دقیق مدارک پرونده.",
];

function buildBio(
  rng: Rng,
  title: string,
  primaryId: string,
  secondaryIds: string[],
  city: string,
  years: number
): string {
  const primary = taxonomyLabel(primaryId);
  const secondary = secondaryIds.map(taxonomyLabel).filter(Boolean).slice(0, 2);
  const focus = secondary.length > 0 ? `${primary}، ${secondary.join(" و ")}` : primary;
  return `${title} با ${years} سال سابقهٔ حرفهٔ وکالت در ${city}. تمرکز بر ${focus}. ${rng.pick(CLOSINGS)}`;
}

// ---------------------------------------------------------------------------
// Education & experience
// ---------------------------------------------------------------------------

const DEGREES = ["کارشناسی حقوق", "کارشناسی ارشد حقوق", "دکتری حقوق خصوصی", "کارشناسی ارشد حقوق کیفری"];
const INSTITUTES = [
  "دانشگاه تهران", "دانشگاه شهید بهشتی", "دانشگاه علامه طباطبایی", "دانشگاه علوم قضایی",
  "دانشگاه فردوسی مشهد", "دانشگاه اصفهان", "دانشگاه شیراز", "دانشگاه تبریز",
];
const PRIOR_ROLES = ["کارشناس حقوقی", "مشاور حقوقی", "دادیار", "کارآموز وکالت", "وکیل پایه دو"];

function buildEducation(rng: Rng, gradYear: number): GeneratedEducation[] {
  const count = rng.chance(0.4) ? 2 : 1;
  const out: GeneratedEducation[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      degreeFa: rng.pick(DEGREES),
      institutionFa: rng.pick(INSTITUTES),
      graduationYear: gradYear + i * rng.int(2, 4),
      fieldFa: null,
    });
  }
  return out;
}

function buildExperience(rng: Rng, licenseYear: number): GeneratedExperience[] {
  if (!rng.chance(0.6)) return [];
  const count = rng.chance(0.5) ? 2 : 1;
  const out: GeneratedExperience[] = [];
  for (let i = 0; i < count; i++) {
    const start = licenseYear - (i + 1) * rng.int(1, 3);
    out.push({
      roleFa: rng.pick(PRIOR_ROLES),
      organizationFa: rng.pick(INSTITUTES),
      startYear: start > 0 ? start : null,
      endYear: i === 0 ? licenseYear : null,
      descriptionFa: null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Geography (weighted toward the big provinces)
// ---------------------------------------------------------------------------

const PROVINCE_WEIGHTS: Record<string, number> = {
  tehran: 30, isfahan: 9, fars: 8, razavi_khorasan: 9, east_azerbaijan: 6,
  khuzestan: 5, gilan: 4, mazandaran: 4, alborz: 4, qom: 3, west_azerbaijan: 3,
  kerman: 2, yazd: 2, kermanshah: 2, golestan: 2, hormozgan: 2,
  sistan_baluchestan: 1, hamadan: 2, markazi: 2, ardabil: 1,
};

function pickGeography(rng: Rng): { province: string; city: string } {
  const province = rng.weighted(
    IRAN_PROVINCES.map((p) => ({ value: p, weight: PROVINCE_WEIGHTS[p.slug] ?? 1 }))
  );
  // Bias toward the province capital (first city) for realism.
  const city = rng.chance(0.6) ? province.cities[0]! : rng.pick(province.cities);
  return { province: province.nameFa, city };
}

// ---------------------------------------------------------------------------
// Fee model (Toman) — scales with experience
// ---------------------------------------------------------------------------

function pickFees(
  rng: Rng,
  years: number
): {
  consultationFeeToman: number;
  consultationDurationMinutes: number;
  hourlyRateToman: number;
  contractReviewFeeToman: number;
  freeFirstConsultation: boolean;
} {
  const tier = years <= 3 ? 0 : years <= 7 ? 1 : years <= 12 ? 2 : 3;
  const base = [600_000, 900_000, 1_200_000, 1_500_000][tier]!;
  const consultationFeeToman = base + rng.int(0, 6) * 50_000;
  return {
    consultationFeeToman,
    consultationDurationMinutes: rng.pick([30, 45, 45, 60]),
    hourlyRateToman: Math.round(consultationFeeToman * 1.7),
    contractReviewFeeToman: Math.round(consultationFeeToman * 2.6),
    freeFirstConsultation: rng.chance(0.35),
  };
}

// ---------------------------------------------------------------------------
// Avatar (deterministic SVG data-URI — distinct hue + gender-aware silhouette)
// ---------------------------------------------------------------------------

/**
 * A deterministic, synthetic avatar as an inline SVG data-URI. Distinct per
 * `seed` (hue) and gender-aware — never a real photograph. Stored on
 * `profile.avatarUrl` so both the public profile and the admin panel read the
 * SAME source; an admin can later override it via the avatar endpoint.
 */
export function demoAvatarDataUri(seed: number, gender: LawyerGender): string {
  const hue = seed % 360;
  const bg = `hsl(${hue} 46% 90%)`;
  const fg = `hsl(${(hue + 24) % 360} 40% 46%)`;
  const hair = gender === "FEMALE" ? `<ellipse cx="60" cy="48" rx="25" ry="30" fill="${fg}"/>` : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">` +
    `<rect width="120" height="120" fill="${bg}"/>` +
    hair +
    `<circle cx="60" cy="46" r="19" fill="${fg}"/>` +
    `<path d="M22 120c0-21 17-35 38-35s38 14 38 35z" fill="${fg}"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate `count` deterministic demo-lawyer specs. Ids start at
 * `demo-lawyer-021` so the 20 curated profiles keep their numbers.
 */
export function generateDemoLawyerSpecs(count: number = GENERATED_LAWYER_COUNT): GeneratedLawyerSpec[] {
  const rng = new Rng(ROSTER_SEED);
  const out: GeneratedLawyerSpec[] = [];

  for (let i = 0; i < count; i++) {
    const index = i + 21;
    const gender: LawyerGender = rng.chance(0.55) ? "MALE" : "FEMALE";
    const first = gender === "MALE" ? rng.pick(MALE_FIRST) : rng.pick(FEMALE_FIRST);
    const fullName = `${first} ${rng.pick(LAST_NAMES)}`;

    const domainId = pickDomain(rng);
    const primarySpecialtyId = pickPrimaryInDomain(rng, domainId);
    const secondary = pickSecondaries(rng, primarySpecialtyId);
    const specialtyIds = [primarySpecialtyId, ...secondary];

    const band = rng.weighted(EXPERIENCE_BANDS.map((b) => ({ value: b, weight: b.weight })));
    const yearsExperience = rng.int(band.min, band.max);

    const { province, city } = pickGeography(rng);
    const fees = pickFees(rng, yearsExperience);

    const availability = pickAvailability(rng);
    const unverified = rng.chance(0.035);
    const featured = !unverified && availability.accepting && rng.chance(0.09);

    const professionalRank: LawyerProfessionalRank =
      yearsExperience < 3
        ? rng.weighted([
            { value: "TRAINEE" as LawyerProfessionalRank, weight: 3 },
            { value: "BASE_TWO" as LawyerProfessionalRank, weight: 1 },
          ])
        : rng.weighted([
            { value: "BASE_ONE" as LawyerProfessionalRank, weight: 8 },
            { value: "BASE_TWO" as LawyerProfessionalRank, weight: 2 },
          ]);

    const organizationType: LawyerOrganizationType = rng.weighted(
      LAWYER_ORGANIZATION_TYPES.map((t) => ({
        value: t,
        weight: t === "BAR" ? 7 : t === "JUDICIARY_CENTER" ? 3 : 1,
      }))
    );

    const licenseYear = Math.max(1370, JALALI_NOW - yearsExperience);
    const licenseNumber = String(rng.int(10_000, 99_999));
    const licenseAuthority =
      organizationType === "JUDICIARY_CENTER"
        ? "مرکز وکلای قوهٔ قضائیه"
        : organizationType === "BAR"
          ? "کانون وکلای دادگستری"
          : "سایر مراجع";

    const licenseStatus: LawyerLicenseStatus =
      availability.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";

    const title = TITLE_BY_DOMAIN[domainId] ?? "وکیل دادگستری";
    const bio = buildBio(rng, title, primarySpecialtyId, secondary, city, yearsExperience);

    const serviceIds = rng.sample(
      LAWYER_SERVICES.map((s) => s.id),
      rng.int(2, 6)
    );

    const jurisdictionIds = rng.sample(LAWYER_JURISDICTIONS.map((j) => j.id), rng.int(1, 4));

    // Ratings: the bulk land in 4.1–5.0; a small tail sits below 4.0.
    const targetRating = rng.chance(0.08)
      ? Math.round((rng.float() * 0.9 + 3.0) * 10) / 10
      : Math.round((rng.float() * 0.9 + 4.1) * 10) / 10;
    const reviewCount = availability.status === "INACTIVE" ? rng.int(0, 3) : rng.int(0, 42);

    out.push({
      id: `demo-lawyer-${String(index).padStart(3, "0")}`,
      fullName,
      gender,
      professionalTitle: title,
      professionalRank,
      organizationType,
      licenseStatus,
      licenseNumber,
      licenseYear,
      licenseAuthority,
      bio,
      specialtyIds,
      primarySpecialtyId,
      province,
      city,
      remote: rng.chance(0.78),
      ...fees,
      availabilityStatus: availability.status,
      consultationCapacity: availability.capacity,
      acceptingRequests: availability.accepting,
      acceptingClients: availability.acceptingClients,
      visibility: unverified ? "UNLISTED" : "PUBLIC",
      featured,
      yearsExperience,
      serviceIds,
      jurisdictionIds,
      education: buildEducation(rng, licenseYear),
      experience: buildExperience(rng, licenseYear),
      targetRating,
      reviewCount,
      avatarSeed: rng.int(0, 359),
      unverified,
    });
  }

  return out;
}

/** The professional ranks the generator can emit (for tests/facets). */
export const GENERATED_RANKS = LAWYER_PROFESSIONAL_RANKS;

/**
 * Seeded review ratings that average close to `target`. The average is
 * derived from these rows at read time — never stored separately — so the
 * displayed rating is always honest.
 */
export function ratingsForTarget(target: number, count: number, rng: () => number): number[] {
  if (count <= 0) return [];
  const out: number[] = [];
  const lower = Math.max(1, Math.round(target) - 1);
  const upper = Math.min(5, Math.round(target));
  for (let i = 0; i < count; i++) {
    const r = rng();
    let value: number;
    if (r < 0.6) value = upper;
    else if (r < 0.85) value = lower;
    else if (r < 0.95) value = Math.max(1, upper - 2);
    else value = Math.min(5, upper + 1);
    out.push(value);
  }
  return out;
}
