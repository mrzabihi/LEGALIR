// ============================================================
// LEGALIR — Legal Operating Platform Domain Types
// ============================================================
// Account types, RBAC roles & permissions, lawyer profiles,
// organizations, legal requests (state machine), intake schemas,
// case extensions and the lawyer-matching contracts.
//
// This module is ADDITIVE. The legacy `AccountType` ("individual" |
// "legal") in ./index.ts is preserved for backward compatibility and
// mapped onto the richer model below via `LEGACY_ACCOUNT_TYPE_MAP`.
// ============================================================

// ---------------------------------------------------------------------------
// Account types (PART 1)
// ---------------------------------------------------------------------------
// The account type describes the LEGAL NATURE of the holder. It is
// deliberately separate from the RBAC role: a BUSINESS account can hold
// COMPANY_OWNER, COMPANY_ADMIN or COMPANY_MEMBER roles, and a LAWYER
// account holds the LAWYER role.

export type PlatformAccountType = "PERSONAL" | "LAWYER" | "BUSINESS";

export const ACCOUNT_TYPE_FA: Record<PlatformAccountType, string> = {
  PERSONAL: "شخصی",
  LAWYER: "وکیل",
  BUSINESS: "کسب‌وکار / سازمان",
};

export const ACCOUNT_TYPE_DESCRIPTION_FA: Record<PlatformAccountType, string> = {
  PERSONAL: "برای امور حقوقی شخصی؛ مشاوره، قرارداد و پیگیری پرونده‌های فردی.",
  LAWYER: "برای وکلا و کارشناسان حقوقی؛ پروفایل حرفه‌ای، دریافت درخواست و مدیریت موکلان.",
  BUSINESS: "برای شرکت‌ها و سازمان‌ها؛ مدیریت تیمی، قراردادهای تجاری و امور حقوقی سازمانی.",
};

/**
 * Legacy → platform account type mapping. Existing rows store
 * "individual" | "legal"; they must keep working unchanged.
 */
export const LEGACY_ACCOUNT_TYPE_MAP: Record<string, PlatformAccountType> = {
  individual: "PERSONAL",
  legal: "BUSINESS",
  PERSONAL: "PERSONAL",
  LAWYER: "LAWYER",
  BUSINESS: "BUSINESS",
};

/** Normalize any stored account-type value to the platform model. */
export function normalizeAccountType(value: string | null | undefined): PlatformAccountType {
  if (!value) return "PERSONAL";
  return LEGACY_ACCOUNT_TYPE_MAP[value] ?? "PERSONAL";
}

/**
 * Persian labels for the LegalCategory slugs. Kept here (not in the UI) so
 * the marketplace, matching engine and intake wizard all render the same
 * wording for a category.
 */
export const LEGAL_CATEGORY_FA: Record<string, string> = {
  family: "خانواده",
  contract: "قرارداد",
  real_estate: "املاک",
  labor: "کار و تأمین اجتماعی",
  commerce: "تجارت",
  criminal: "کیفری",
  tax: "مالیاتی",
  companies: "شرکت‌ها",
  checks: "چک و اسناد تجاری",
  immigration: "مهاجرت",
  cyber: "جرائم رایانه‌ای",
  other: "سایر",
};

// ---------------------------------------------------------------------------
// RBAC roles & permissions (PART 1)
// ---------------------------------------------------------------------------

export type PlatformRole =
  | "USER"
  | "LAWYER"
  | "COMPANY_OWNER"
  | "COMPANY_ADMIN"
  | "COMPANY_MEMBER"
  | "SUPPORT"
  | "ADMIN"
  | "SUPER_ADMIN";

export const ROLE_FA: Record<PlatformRole, string> = {
  USER: "کاربر",
  LAWYER: "وکیل",
  COMPANY_OWNER: "مالک سازمان",
  COMPANY_ADMIN: "مدیر سازمان",
  COMPANY_MEMBER: "عضو سازمان",
  SUPPORT: "پشتیبان",
  ADMIN: "مدیر سیستم",
  SUPER_ADMIN: "مدیر ارشد",
};

/**
 * Permission keys. Authorization is ALWAYS enforced server-side; the
 * frontend only uses these to hide affordances.
 */
export type Permission =
  // Personal workspace
  | "case:read:own"
  | "case:write:own"
  | "contract:read:own"
  | "contract:write:own"
  | "document:read:own"
  | "document:write:own"
  | "consultation:create"
  | "lawyer:request"
  // Lawyer workspace
  | "lawyer:profile:write"
  | "lawyer:request:read:assigned"
  | "lawyer:request:respond"
  | "lawyer:case:read:assigned"
  | "lawyer:case:write:assigned"
  | "lawyer:message:send"
  // Organization workspace
  | "org:read"
  | "org:member:invite"
  | "org:member:manage"
  | "org:case:read:all"
  | "org:case:write:all"
  | "org:contract:read:all"
  | "org:contract:write:all"
  | "org:billing:manage"
  | "org:settings:manage"
  // Platform administration
  | "admin:users:read"
  | "admin:users:manage"
  | "admin:lawyer:verify"
  | "admin:knowledge:read"
  | "admin:knowledge:write"
  | "admin:audit:read"
  | "admin:system:manage";

/** The permission set granted to each role. */
export const ROLE_PERMISSIONS: Record<PlatformRole, Permission[]> = {
  USER: [
    "case:read:own",
    "case:write:own",
    "contract:read:own",
    "contract:write:own",
    "document:read:own",
    "document:write:own",
    "consultation:create",
    "lawyer:request",
  ],
  LAWYER: [
    "case:read:own",
    "case:write:own",
    "contract:read:own",
    "contract:write:own",
    "document:read:own",
    "document:write:own",
    "consultation:create",
    "lawyer:profile:write",
    "lawyer:request:read:assigned",
    "lawyer:request:respond",
    "lawyer:case:read:assigned",
    "lawyer:case:write:assigned",
    "lawyer:message:send",
  ],
  COMPANY_MEMBER: [
    "case:read:own",
    "case:write:own",
    "contract:read:own",
    "contract:write:own",
    "document:read:own",
    "document:write:own",
    "consultation:create",
    "lawyer:request",
    "org:read",
  ],
  COMPANY_ADMIN: [
    "case:read:own",
    "case:write:own",
    "contract:read:own",
    "contract:write:own",
    "document:read:own",
    "document:write:own",
    "consultation:create",
    "lawyer:request",
    "org:read",
    "org:member:invite",
    "org:member:manage",
    "org:case:read:all",
    "org:case:write:all",
    "org:contract:read:all",
    "org:contract:write:all",
    "org:settings:manage",
  ],
  COMPANY_OWNER: [
    "case:read:own",
    "case:write:own",
    "contract:read:own",
    "contract:write:own",
    "document:read:own",
    "document:write:own",
    "consultation:create",
    "lawyer:request",
    "org:read",
    "org:member:invite",
    "org:member:manage",
    "org:case:read:all",
    "org:case:write:all",
    "org:contract:read:all",
    "org:contract:write:all",
    "org:billing:manage",
    "org:settings:manage",
  ],
  SUPPORT: [
    "admin:users:read",
    "admin:audit:read",
  ],
  ADMIN: [
    "admin:users:read",
    "admin:users:manage",
    "admin:lawyer:verify",
    "admin:knowledge:read",
    "admin:knowledge:write",
    "admin:audit:read",
  ],
  SUPER_ADMIN: [
    "admin:users:read",
    "admin:users:manage",
    "admin:lawyer:verify",
    "admin:knowledge:read",
    "admin:knowledge:write",
    "admin:audit:read",
    "admin:system:manage",
  ],
};

/** True when the role's permission set includes `permission`. */
export function roleHasPermission(role: PlatformRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** True when the role is an organization-scoped role. */
export function isOrgRole(role: PlatformRole): boolean {
  return role === "COMPANY_OWNER" || role === "COMPANY_ADMIN" || role === "COMPANY_MEMBER";
}

/** True when the role is a platform-staff role. */
export function isStaffRole(role: PlatformRole): boolean {
  return role === "SUPPORT" || role === "ADMIN" || role === "SUPER_ADMIN";
}

// ---------------------------------------------------------------------------
// Lawyer profile (PART 2)
// ---------------------------------------------------------------------------

export type LawyerVerificationStatus =
  | "UNVERIFIED"
  | "PROFILE_SUBMITTED"
  | "DOCUMENTS_SUBMITTED"
  | "UNDER_REVIEW"
  | "VERIFIED"
  | "REJECTED"
  | "SUSPENDED";

export const LAWYER_VERIFICATION_FA: Record<LawyerVerificationStatus, string> = {
  UNVERIFIED: "تأیید نشده",
  PROFILE_SUBMITTED: "اطلاعات ثبت شده",
  DOCUMENTS_SUBMITTED: "مدارک ارسال شده",
  UNDER_REVIEW: "در حال بررسی",
  VERIFIED: "تأیید شده",
  REJECTED: "رد شده",
  SUSPENDED: "معلق",
};

/**
 * True when the lawyer has submitted their profile but no human
 * verification decision has been made yet. The lawyer platform is not
 * live, so a submitted profile must NEVER be presented as verified.
 */
export function isLawyerPendingVerification(status: LawyerVerificationStatus): boolean {
  return (
    status === "PROFILE_SUBMITTED" ||
    status === "DOCUMENTS_SUBMITTED" ||
    status === "UNDER_REVIEW"
  );
}

/**
 * How a lawyer's portrait was obtained. `demo` marks a synthetic/generated
 * portrait used for seeded profiles — it must never be presented as a real
 * photograph of the named person. `real` is a verified, consented upload.
 */
export type LawyerAvatarType = "demo" | "real";

/**
 * A lawyer's current availability for NEW consultation requests.
 *
 * Deliberately separate from `consultationCapacity`: a lawyer can be
 * ACTIVE with only 2 slots left, or ACTIVE with LIMITED intake. The
 * status answers "can I send a request at all?", the capacity answers
 * "how many slots are left?" — the booking system needs both.
 */
export type LawyerAvailabilityStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "FULL"
  | "LIMITED"
  | "AVAILABLE_SLOTS";

export const LAWYER_AVAILABILITY_FA: Record<LawyerAvailabilityStatus, string> = {
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  FULL: "ظرفیت تکمیل",
  LIMITED: "ظرفیت درخواست محدود",
  AVAILABLE_SLOTS: "ظرفیت مشاوره باز",
};

/** A legal specialty a lawyer practises. */
export interface LawyerSpecialty {
  /** Matches a LegalCategory slug where applicable. */
  category: string;
  /** Years of experience in this specialty. */
  yearsExperience: number;
  /** Optional free-text note. */
  note?: string | null;
}

/** A city/region the lawyer serves. */
export interface LawyerLocation {
  province: string;
  city: string;
  /** True when the lawyer accepts remote (online) engagements. */
  remote: boolean;
}

/** A language the lawyer can work in. */
export interface LawyerLanguage {
  code: string;
  labelFa: string;
  proficiency: "native" | "fluent" | "working";
}

/** Pricing in Toman. All amounts are integers (no decimals). */
export interface LawyerPricing {
  /** Consultation fee per session, in Toman. */
  consultationFeeToman: number;
  /** Length of a standard consultation session, in minutes. */
  consultationDurationMinutes?: number | null;
  /** Optional hourly rate, in Toman. */
  hourlyRateToman?: number | null;
  /** Optional fixed fee for contract review, in Toman. */
  contractReviewFeeToman?: number | null;
  /** True when the lawyer offers a free first consultation. */
  freeFirstConsultation: boolean;
}

/** Weekly availability window. Times are "HH:mm" in Asia/Tehran. */
export interface LawyerAvailabilitySlot {
  /** 0 = Saturday … 6 = Friday (Iranian week starts Saturday). */
  weekday: number;
  startTime: string;
  endTime: string;
}

/**
 * Performance metrics. These are DERIVED from real platform events
 * (accepted requests, completed cases, response times). No fabricated
 * win-rate is ever stored or displayed.
 */
export interface LawyerPerformance {
  /** Number of requests the lawyer has accepted. */
  acceptedRequests: number;
  /** Number of cases the lawyer has completed. */
  completedCases: number;
  /** Median first-response time in minutes (null when no data). */
  medianResponseMinutes: number | null;
  /** Average client rating (1–5), null when no reviews yet. */
  averageRating: number | null;
  /** Number of reviews the average is based on. */
  reviewCount: number;
}

export interface LawyerProfile {
  id: string;
  /** The owning user id. */
  userId: string;
  // --- Identity ---
  fullName: string;
  /** Iranian national bar (کانون وکلا) licence number. */
  licenseNumber: string | null;
  /** Year the licence was issued (Jalali). */
  licenseYear: number | null;
  bio: string;
  avatarUrl: string | null;
  /** Provenance of `avatarUrl` — demo portraits are never real photos. */
  avatarType: LawyerAvatarType;
  // --- Professional ---
  /** Short professional headline, e.g. «وکیل پایه یک دادگستری». */
  professionalTitle: string | null;
  /**
   * The professional activity type declared during onboarding. Optional —
   * legacy/seeded rows predate this field.
   */
  activityType?: LawyerActivityType | null;
  /**
   * The authority that issued the licence (e.g. کانون وکلای مرکز). Optional —
   * legacy/seeded rows predate this field.
   */
  licenseAuthority?: string | null;
  verificationStatus: LawyerVerificationStatus;
  /** ISO timestamp of the last verification decision. */
  verifiedAt: string | null;
  /** Reason shown to the lawyer when REJECTED/SUSPENDED. */
  verificationNote: string | null;
  specializations: LawyerSpecialty[];
  locations: LawyerLocation[];
  languages: LawyerLanguage[];
  pricing: LawyerPricing;
  availability: LawyerAvailabilitySlot[];
  performance: LawyerPerformance;
  /** Availability for NEW requests — independent of `consultationCapacity`. */
  availabilityStatus: LawyerAvailabilityStatus;
  /**
   * Open consultation slots. `null` means unlimited/unknown — the UI then
   * shows only the availability status. `0` means full.
   */
  consultationCapacity: number | null;
  /** True for seeded demo lawyers — clearly marked in the UI. */
  isDemo: boolean;
  /** Whether the lawyer is currently accepting new requests. */
  acceptingRequests: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Public-facing lawyer card for the marketplace list. */
export interface LawyerListItem {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  avatarType: LawyerAvatarType;
  /** Short professional headline shown under the name. */
  professionalTitle: string | null;
  verificationStatus: LawyerVerificationStatus;
  specializations: LawyerSpecialty[];
  locations: LawyerLocation[];
  languages: LawyerLanguage[];
  pricing: LawyerPricing;
  performance: LawyerPerformance;
  /** Availability for NEW requests — independent of `consultationCapacity`. */
  availabilityStatus: LawyerAvailabilityStatus;
  /** Open consultation slots; null = unlimited/unknown, 0 = full. */
  consultationCapacity: number | null;
  isDemo: boolean;
  acceptingRequests: boolean;
  /** Short bio excerpt for the card. */
  bioExcerpt: string;
}

export interface LawyerListResponse {
  items: LawyerListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/** A public review shown on a lawyer's profile. */
export interface LawyerReview {
  id: string;
  /** Display name of the reviewer (never the raw user id). */
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

/**
 * The full public lawyer profile. `performance` is always derived from
 * real events server-side; `reviews` are the most recent public reviews.
 */
export interface LawyerDetail {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  avatarType: LawyerAvatarType;
  professionalTitle: string | null;
  bio: string;
  licenseNumber: string | null;
  licenseYear: number | null;
  verificationStatus: LawyerVerificationStatus;
  verifiedAt: string | null;
  specializations: LawyerSpecialty[];
  locations: LawyerLocation[];
  languages: LawyerLanguage[];
  pricing: LawyerPricing;
  availability: LawyerAvailabilitySlot[];
  performance: LawyerPerformance;
  availabilityStatus: LawyerAvailabilityStatus;
  consultationCapacity: number | null;
  isDemo: boolean;
  acceptingRequests: boolean;
  reviews: LawyerReview[];
}

export interface LawyerListFilters {
  /** Legal category slug. */
  category?: string;
  province?: string;
  city?: string;
  /** Maximum consultation fee in Toman. */
  maxFeeToman?: number;
  /** Only lawyers accepting remote engagements. */
  remoteOnly?: boolean;
  /** Only verified lawyers. */
  verifiedOnly?: boolean;
  /** Free-text search over name and bio. */
  search?: string;
  sort?: "relevance" | "rating" | "experience" | "price_asc" | "price_desc";
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Lawyer matching engine (PART 4)
// ---------------------------------------------------------------------------

/** The inputs the matching engine ranks against. */
export interface MatchCriteria {
  category: string;
  province?: string | null;
  city?: string | null;
  /** Budget ceiling in Toman. */
  maxFeeToman?: number | null;
  /** Preferred language code. */
  language?: string | null;
  /** Whether the client needs remote service. */
  remote?: boolean;
  /** Free-text description of the matter, used for keyword scoring. */
  description?: string | null;
}

/** A single scored candidate with a transparent breakdown. */
export interface MatchCandidate {
  lawyer: LawyerListItem;
  /** Total weighted score (0–100). */
  score: number;
  /** Per-factor contributions, for explainability in the UI. */
  breakdown: MatchScoreBreakdown;
  /** Human-readable reasons the lawyer matched. */
  reasonsFa: string[];
}

export interface MatchScoreBreakdown {
  specialty: number;
  location: number;
  price: number;
  rating: number;
  experience: number;
  availability: number;
}

/** Weights are configurable, not hardcoded in the ranking loop. */
export interface MatchWeights {
  specialty: number;
  location: number;
  price: number;
  rating: number;
  experience: number;
  availability: number;
}

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  specialty: 40,
  location: 15,
  price: 15,
  rating: 15,
  experience: 10,
  availability: 5,
};

export interface MatchResult {
  /** The criteria the engine ranked against (echoed for transparency). */
  criteria: MatchCriteria;
  /** The top candidates, best first. The user chooses — never automatic. */
  candidates: MatchCandidate[];
  /** How many lawyers passed the hard filters. */
  eligibleCount: number;
  /** How many were excluded by hard filters. */
  excludedCount: number;
}

// ---------------------------------------------------------------------------
// Registration intent & onboarding (PART 19b)
// ---------------------------------------------------------------------------
// The registration intent is the ENTRY POINT a user chose at signup. It is
// deliberately separate from identity: a PERSONAL user may later create an
// organization, and a LAWYER is still a user. Authorization is NEVER derived
// from the intent — it comes from organization membership and RBAC roles.

export type RegistrationIntent = "PERSONAL" | "ORGANIZATION" | "LAWYER";

export const REGISTRATION_INTENT_FA: Record<RegistrationIntent, string> = {
  PERSONAL: "شخص حقیقی",
  ORGANIZATION: "شرکت / شخصیت حقوقی",
  LAWYER: "وکیل",
};

/**
 * Where the account originally came from. `LEGACY` marks rows that predate
 * the intent model (existing users) — they keep the current behaviour.
 * Used for analytics/UX only, never for authorization.
 */
export type RegistrationOrigin = RegistrationIntent | "LEGACY";

/** The onboarding track a user is on after account creation. */
export type OnboardingType = "PERSONAL" | "ORGANIZATION" | "LAWYER";

export type OnboardingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

/** The allowed registration intents — the server rejects anything else. */
export const ALLOWED_REGISTRATION_INTENTS: readonly RegistrationIntent[] = [
  "PERSONAL",
  "ORGANIZATION",
  "LAWYER",
] as const;

/** Normalize an untrusted client value to a valid intent, or null. */
export function normalizeRegistrationIntent(value: unknown): RegistrationIntent | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  return (ALLOWED_REGISTRATION_INTENTS as readonly string[]).includes(upper)
    ? (upper as RegistrationIntent)
    : null;
}

/** The onboarding track implied by a registration intent. */
export function onboardingTypeForIntent(intent: RegistrationIntent): OnboardingType {
  return intent;
}

// ---------------------------------------------------------------------------
// Organization (PART 19)
// ---------------------------------------------------------------------------

export type OrgMemberRole = "COMPANY_OWNER" | "COMPANY_ADMIN" | "COMPANY_MEMBER";

export const ORG_MEMBER_ROLE_FA: Record<OrgMemberRole, string> = {
  COMPANY_OWNER: "مالک / نماینده سازمان",
  COMPANY_ADMIN: "مدیر سازمان",
  COMPANY_MEMBER: "عضو سازمان",
};

/**
 * Lifecycle of a legal entity. V1 only reaches PROFILE_COMPLETE; the
 * verification states exist so a future review workflow does not require a
 * schema change.
 */
export type OrganizationStatus =
  | "DRAFT"
  | "PROFILE_INCOMPLETE"
  | "PROFILE_COMPLETE"
  | "PENDING_VERIFICATION"
  | "ACTIVE"
  | "REJECTED"
  | "SUSPENDED";

export const ORGANIZATION_STATUS_FA: Record<OrganizationStatus, string> = {
  DRAFT: "پیش‌نویس",
  PROFILE_INCOMPLETE: "اطلاعات ناقص",
  PROFILE_COMPLETE: "اطلاعات تکمیل شده",
  PENDING_VERIFICATION: "در انتظار تأیید",
  ACTIVE: "فعال",
  REJECTED: "رد شده",
  SUSPENDED: "معلق",
};

/** The legal nature of the entity (نوع شخصیت حقوقی). */
export type OrganizationLegalType =
  | "JOINT_STOCK"
  | "LIMITED_LIABILITY"
  | "PRIVATE_JOINT_STOCK"
  | "COOPERATIVE"
  | "SOLE_PROPRIETORSHIP"
  | "INSTITUTE"
  | "OTHER";

export const ORGANIZATION_LEGAL_TYPE_FA: Record<OrganizationLegalType, string> = {
  JOINT_STOCK: "سهامی عام",
  LIMITED_LIABILITY: "با مسئولیت محدود",
  PRIVATE_JOINT_STOCK: "سهامی خاص",
  COOPERATIVE: "تعاونی",
  SOLE_PROPRIETORSHIP: "شخصی / مالکیت فردی",
  INSTITUTE: "مؤسسه",
  OTHER: "سایر",
};

export interface Organization {
  id: string;
  name: string;
  /** Trade name (نام تجاری), when different from the registered name. */
  tradeName: string | null;
  /** The legal nature of the entity. */
  legalType: OrganizationLegalType | null;
  /** Iranian national ID (شناسه ملی) of the legal entity. */
  nationalId: string | null;
  /** Registration number (شماره ثبت). */
  registrationNumber: string | null;
  /** Economic code (کد اقتصادی). */
  economicCode: string | null;
  /** Registration date (ISO date), when supplied. */
  registrationDate: string | null;
  industry: string | null;
  province: string | null;
  city: string | null;
  /** Full street address (آدرس کامل). */
  address: string | null;
  /** Postal code (کد پستی). */
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  /** Lifecycle status. V1 reaches PROFILE_COMPLETE. */
  status: OrganizationStatus;
  /** The user who created the organization. */
  ownerUserId: string;
  /** Alias of `ownerUserId` kept explicit for the representative model. */
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrgMember {
  id: string;
  orgId: string;
  userId: string;
  role: OrgMemberRole;
  /** Job title within the organization. */
  title: string | null;
  status: "active" | "invited" | "suspended";
  invitedByUserId: string | null;
  joinedAt: string | null;
  createdAt: string;
}

export interface OrgMembership {
  org: Organization;
  member: OrgMember;
}

/**
 * A person authorized to sign on behalf of the organization. A signatory is
 * NOT necessarily a platform user — it is an official record (name, national
 * id, position, authority). Kept separate from `OrgMember` on purpose.
 */
export interface OrganizationAuthorizedSignatory {
  id: string;
  orgId: string;
  fullName: string;
  /** Iranian national code (کد ملی) of the signatory, when supplied. */
  nationalCode: string | null;
  /** Position within the organization (سمت). */
  position: string | null;
  /** The scope of authority (نوع اختیار). */
  authorityType: string | null;
  /** Contact phone, when supplied. */
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The representative who registered the organization. */
export interface OrganizationRepresentative {
  fullName: string;
  position: string | null;
  mobile: string | null;
}

// ---------------------------------------------------------------------------
// Lawyer onboarding (PART 19c)
// ---------------------------------------------------------------------------

/** The professional activity type a lawyer practises. */
export type LawyerActivityType =
  | "INDEPENDENT"
  | "LAW_FIRM"
  | "LEGAL_ADVISOR"
  | "ARBITRATOR"
  | "OTHER";

export const LAWYER_ACTIVITY_TYPE_FA: Record<LawyerActivityType, string> = {
  INDEPENDENT: "وکیل مستقل",
  LAW_FIRM: "مؤسسه / دفتر وکالت",
  LEGAL_ADVISOR: "مشاور حقوقی",
  ARBITRATOR: "داور",
  OTHER: "سایر",
};

/** The lawyer onboarding submission payload (server-validated). */
export interface LawyerOnboardingInput {
  fullName: string;
  professionalTitle: string | null;
  activityType: LawyerActivityType | null;
  licenseNumber: string | null;
  licenseAuthority: string | null;
  licenseYear: number | null;
  province: string | null;
  city: string | null;
  yearsExperience: number | null;
  bio: string | null;
  specializations: string[];
  avatarUrl: string | null;
}

/** The lawyer onboarding state returned to the client. */
export interface LawyerOnboardingState {
  status: OnboardingStatus;
  /** The submitted profile, when one exists. */
  profile: LawyerProfile | null;
  /** True when the profile was submitted but not yet verified. */
  pendingVerification: boolean;
}

// ---------------------------------------------------------------------------
// Onboarding routing (PART 19d)
// ---------------------------------------------------------------------------

/** The server-driven onboarding decision for the current user. */
export interface OnboardingState {
  type: OnboardingType;
  status: OnboardingStatus;
  /** Where the client should route the user next. */
  nextStep: "PERSONAL_PROFILE" | "ORGANIZATION" | "LAWYER" | "DASHBOARD";
  /** The user's active organization, when they have one. */
  organization: Organization | null;
  /** The user's role within that organization. */
  orgRole: OrgMemberRole | null;
}

// ---------------------------------------------------------------------------
// Legal request state machine (PART 7)
// ---------------------------------------------------------------------------

export type LegalRequestState =
  | "DRAFT"
  | "AI_INTAKE"
  | "AI_ANALYSIS_READY"
  | "LAWYER_REQUESTED"
  | "MATCHING"
  | "LAWYER_PROPOSED"
  | "LAWYER_SELECTED"
  | "WAITING_FOR_ACCEPTANCE"
  | "ACCEPTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "WAITING_FOR_CLIENT"
  | "WAITING_FOR_LAWYER"
  | "COMPLETED"
  | "CANCELLED"
  | "CLOSED";

export const LEGAL_REQUEST_STATE_FA: Record<LegalRequestState, string> = {
  DRAFT: "پیش‌نویس",
  AI_INTAKE: "در حال تکمیل اطلاعات",
  AI_ANALYSIS_READY: "تحلیل اولیه آماده است",
  LAWYER_REQUESTED: "درخواست وکیل ثبت شد",
  MATCHING: "در حال یافتن وکیل مناسب",
  LAWYER_PROPOSED: "وکلای پیشنهادی آماده است",
  LAWYER_SELECTED: "وکیل انتخاب شد",
  WAITING_FOR_ACCEPTANCE: "منتظر پذیرش وکیل",
  ACCEPTED: "پذیرفته شده",
  SCHEDULED: "زمان‌بندی شده",
  IN_PROGRESS: "در حال انجام",
  WAITING_FOR_CLIENT: "منتظر پاسخ شما",
  WAITING_FOR_LAWYER: "منتظر پاسخ وکیل",
  COMPLETED: "تکمیل شده",
  CANCELLED: "لغو شده",
  CLOSED: "بسته شده",
};

/**
 * Allowed transitions. The server rejects any transition not listed
 * here — the state machine is authoritative, not the UI.
 */
export const LEGAL_REQUEST_TRANSITIONS: Record<LegalRequestState, LegalRequestState[]> = {
  DRAFT: ["AI_INTAKE", "CANCELLED"],
  AI_INTAKE: ["AI_ANALYSIS_READY", "DRAFT", "CANCELLED"],
  AI_ANALYSIS_READY: ["LAWYER_REQUESTED", "AI_INTAKE", "CANCELLED"],
  LAWYER_REQUESTED: ["MATCHING", "CANCELLED"],
  MATCHING: ["LAWYER_PROPOSED", "LAWYER_REQUESTED", "CANCELLED"],
  LAWYER_PROPOSED: ["LAWYER_SELECTED", "MATCHING", "CANCELLED"],
  LAWYER_SELECTED: ["WAITING_FOR_ACCEPTANCE", "LAWYER_PROPOSED", "CANCELLED"],
  WAITING_FOR_ACCEPTANCE: ["ACCEPTED", "LAWYER_PROPOSED", "CANCELLED"],
  ACCEPTED: ["SCHEDULED", "IN_PROGRESS", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_CLIENT", "WAITING_FOR_LAWYER", "COMPLETED", "CANCELLED"],
  WAITING_FOR_CLIENT: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  WAITING_FOR_LAWYER: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: ["CLOSED"],
  CANCELLED: ["CLOSED"],
  CLOSED: [],
};

/** True when `to` is a legal next state from `from`. */
export function canTransitionLegalRequest(from: LegalRequestState, to: LegalRequestState): boolean {
  return LEGAL_REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

/** States in which the request is still active (not terminal). */
export const ACTIVE_LEGAL_REQUEST_STATES: LegalRequestState[] = [
  "DRAFT",
  "AI_INTAKE",
  "AI_ANALYSIS_READY",
  "LAWYER_REQUESTED",
  "MATCHING",
  "LAWYER_PROPOSED",
  "LAWYER_SELECTED",
  "WAITING_FOR_ACCEPTANCE",
  "ACCEPTED",
  "SCHEDULED",
  "IN_PROGRESS",
  "WAITING_FOR_CLIENT",
  "WAITING_FOR_LAWYER",
];

export interface LegalRequest {
  id: string;
  userId: string;
  /** The case this request belongs to (created when the request is accepted). */
  caseId: string | null;
  /** The conversation that seeded the request, if any. */
  conversationId: string | null;
  title: string;
  category: string;
  state: LegalRequestState;
  /** The structured intake answers. */
  intakeAnswers: Record<string, string>;
  /** The AI analysis produced from the intake, if any. */
  analysisId: string | null;
  /** The lawyer the client selected. */
  selectedLawyerId: string | null;
  /** The organization this request belongs to, when org-scoped. */
  orgId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegalRequestEvent {
  id: string;
  requestId: string;
  fromState: LegalRequestState | null;
  toState: LegalRequestState;
  /** Who caused the transition (user id, or "system"). */
  actorId: string;
  actorRole: PlatformRole | "system";
  note: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Legal intake schemas (PART 5)
// ---------------------------------------------------------------------------

export type IntakeFieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "select"
  | "multiselect"
  | "boolean"
  | "file";

export interface IntakeFieldOption {
  value: string;
  labelFa: string;
}

export interface IntakeField {
  key: string;
  labelFa: string;
  type: IntakeFieldType;
  required: boolean;
  placeholderFa?: string;
  helpFa?: string;
  options?: IntakeFieldOption[];
  /** Conditional display: only show when the referenced field equals the value. */
  showWhen?: { field: string; equals: string | string[] };
}

export interface IntakeStep {
  id: string;
  titleFa: string;
  descriptionFa?: string;
  fields: IntakeField[];
}

/**
 * A versioned questionnaire schema for one legal category. Schemas are
 * versioned so an in-flight draft can be resumed against the exact
 * schema it was started with.
 */
export interface IntakeSchema {
  category: string;
  version: number;
  titleFa: string;
  descriptionFa: string;
  steps: IntakeStep[];
}

export interface IntakeDraft {
  id: string;
  userId: string;
  category: string;
  schemaVersion: number;
  currentStep: number;
  answers: Record<string, string>;
  savedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Case extensions (PART 10)
// ---------------------------------------------------------------------------

/** A deadline on a case. Deadlines are ALWAYS user- or source-supplied. */
export interface CaseDeadline {
  id: string;
  caseId: string;
  title: string;
  /** ISO date. */
  dueAt: string;
  /** Where the deadline came from — never AI-invented. */
  source: "user" | "lawyer" | "legal_source" | "system";
  /** Optional citation id when source is legal_source. */
  sourceRef: string | null;
  /** True when a critical deadline still needs human confirmation. */
  needsConfirmation: boolean;
  completed: boolean;
  createdAt: string;
}

/** A document attached to a case. */
export interface CaseDocumentLink {
  id: string;
  caseId: string;
  documentId: string;
  addedByUserId: string;
  createdAt: string;
}

/** A contract attached to a case. */
export interface CaseContractLink {
  id: string;
  caseId: string;
  contractId: string;
  addedByUserId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Secure messaging (PART 8)
// ---------------------------------------------------------------------------

export interface MessageAttachment {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  /** Signed, expiring URL — never a public path. */
  url: string;
  expiresAt: string;
}

export interface SecureMessage {
  id: string;
  threadId: string;
  senderUserId: string;
  senderRole: PlatformRole;
  body: string;
  attachments: MessageAttachment[];
  readAt: string | null;
  createdAt: string;
}

export interface MessageThread {
  id: string;
  caseId: string;
  requestId: string | null;
  participantUserIds: string[];
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
}

/** Provider abstraction for voice/video. Feature-flagged. */
export interface CallProviderConfig {
  provider: "none" | "jitsi" | "livekit" | "custom";
  /** True only when the provider is actually configured. */
  enabled: boolean;
  /** Present only when enabled. */
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Audit log (PART 23)
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorRole: PlatformRole | "system";
  /** e.g. "legal_request.transition", "lawyer.verify". */
  action: string;
  entityType: string;
  entityId: string;
  /** Redacted, non-sensitive metadata. */
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Lawyer workspace (PART 24)
// ---------------------------------------------------------------------------
// The lawyer's own view of the platform. Everything here is DERIVED from
// real events — the requests assigned to the lawyer, the cases those
// requests produced, and the reviews clients left. Nothing is fabricated:
// a lawyer with no accepted requests sees zeros, not a synthetic win-rate.

/** One row in the lawyer's inbox: a request assigned to them. */
export interface LawyerInboxItem {
  requestId: string;
  title: string;
  category: string;
  state: LegalRequestState;
  /** The client's display name (never the raw user id). */
  clientName: string;
  /** True when the lawyer must act next (their turn). */
  awaitingLawyer: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A case the lawyer is working on, projected for their workspace. */
export interface LawyerCaseItem {
  caseId: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  /** ISO date of the nearest open deadline, if any. */
  nextDeadlineAt: string | null;
  openTasks: number;
  updatedAt: string;
}

/** The lawyer's own performance, derived from real events. */
export interface LawyerWorkspaceStats {
  /** Requests currently assigned and not yet terminal. */
  activeRequests: number;
  /** Requests awaiting the lawyer's response right now. */
  awaitingResponse: number;
  /** Cases the lawyer is working on. */
  activeCases: number;
  /** Deadlines due within the next 7 days across the lawyer's cases. */
  upcomingDeadlines: number;
  /** Derived performance (same shape as the public profile). */
  performance: LawyerPerformance;
}

/** The full lawyer workspace payload. */
export interface LawyerWorkspace {
  /** The lawyer's own profile, or null when they have not created one. */
  profile: LawyerProfile | null;
  stats: LawyerWorkspaceStats;
  inbox: LawyerInboxItem[];
  cases: LawyerCaseItem[];
}
