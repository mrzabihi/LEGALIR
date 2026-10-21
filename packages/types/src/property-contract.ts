// ============================================================
// LEGALIR — Property Contract Builder types
// ============================================================
// The domain model for the Property Contract Builder. Two journeys
// share this file because they share ~70% of their shape (parties,
// property, documents, handover, versions, approvals, audit) while
// keeping their own terms/payment models.
//
// Design rules:
//  - Money is stored canonically as an integer in RIAL (IRR). The UI
//    renders Toman; conversion happens in exactly one utility.
//  - Dates are stored as ISO strings (Gregorian) so they are sortable
//    and machine-readable; the UI renders Jalali.
//  - Property-specific data lives in a versioned, typed sub-object
//    (`PropertyRentData` / `PropertySaleData`) rather than 100 flat
//    columns, so new domains can be added without touching the core.
// ============================================================

// ------------------------------------------------------------
// Domain + type identity
// ------------------------------------------------------------

/** The top-level contract domain. */
export type ContractDomain =
  | "property"
  | "vehicle"
  | "finance"
  | "services"
  | "business"
  | "employment";

/** Contract types within the property domain (the fully bespoke journeys). */
export type PropertyContractType = "property_rent" | "property_sale";

/**
 * Contract types served by the schema-driven engine: they share one
 * generic wizard step and one generic data shape, and are described
 * entirely by their registry definition.
 */
export type SchemaContractType =
  | "vehicle_sale"
  | "debt"
  | "freelance"
  | "nda"
  | "saas"
  | "startup"
  | "employment"
  // Commercial property is schema-driven rather than a bespoke property
  // journey: the deed/legal-status questions overlap heavily with the
  // residential flows, but the commercial specifics (permitted use,
  // business licence, VAT, fit-out) are their own field set.
  | "commercial_rent"
  | "commercial_sale"
  // Cloud services are ONE family split by service model. Each model is a
  // separate registered type so the service model is recorded in the
  // document title/specs and can never drift from the collected fields.
  | "cloud_iaas"
  | "cloud_paas"
  | "cloud_baas";

/** Every contract type the engine knows about (extend as domains land). */
export type ContractTypeId = PropertyContractType | SchemaContractType;

/**
 * The cloud service model a cloud contract covers. Each model is also a
 * registered contract type (`cloud_iaas` | `cloud_paas` | `cloud_baas`)
 * so the choice is a first-class fact recorded in the document title and
 * specs — never a free-text note that could drift from the fields shown.
 */
export type CloudServiceModel = "iaas" | "paas" | "baas";

export const CLOUD_SERVICE_MODEL_LABELS_FA: Record<CloudServiceModel, string> = {
  iaas: "زیرساخت به‌عنوان سرویس (IaaS)",
  paas: "بستر به‌عنوان سرویس (PaaS)",
  baas: "بک‌اند به‌عنوان سرویس (BaaS)",
};

/** A one-line plain-Persian description of what each model delivers. */
export const CLOUD_SERVICE_MODEL_DESCRIPTIONS_FA: Record<CloudServiceModel, string> = {
  iaas: "اجارهٔ منابع محاسباتی، شبکه و ذخیره‌سازی؛ مدیریت سیستم‌عامل و نرم‌افزار بر عهدهٔ مشتری است.",
  paas: "بستر توسعه و اجرای برنامه؛ ارائه‌دهنده زیرساخت و میان‌افزار را مدیریت می‌کند و مشتری برنامهٔ خود را مستقر می‌کند.",
  baas: "سرویس‌های آمادهٔ بک‌اند (پایگاه داده، احراز هویت، فایل، API) که مشتری در برنامهٔ خود مصرف می‌کند.",
};

/** The registered contract type for a cloud service model. */
export function cloudContractTypeFor(model: CloudServiceModel): ContractTypeId {
  return `cloud_${model}` as ContractTypeId;
}

/** The service model behind a cloud contract type, or null for other types. */
export function cloudServiceModelFor(typeId: string): CloudServiceModel | null {
  if (typeId === "cloud_iaas") return "iaas";
  if (typeId === "cloud_paas") return "paas";
  if (typeId === "cloud_baas") return "baas";
  return null;
}

/** Which side of the DOCUMENT the initiating user drafts from. */
export type ContractInitiatorSide = "first" | "second";

export const CONTRACT_INITIATOR_SIDE_LABELS_FA: Record<ContractInitiatorSide, string> = {
  first: "طرف اول",
  second: "طرف دوم",
};

/** Which side of the deal the initiating user is on. */
export type PartyRole =
  | "landlord" // موجر
  | "tenant" // مستأجر
  | "seller" // فروشنده
  | "buyer" // خریدار
  | "lender" // طلبکار / قرض‌دهنده
  | "borrower" // بدهکار / قرض‌گیرنده
  | "client" // کارفرما
  | "freelancer" // فریلنسر
  | "discloser" // افشاکننده اطلاعات
  | "recipient" // دریافت‌کننده اطلاعات
  | "provider" // ارائه‌دهنده سرویس
  | "customer" // مشتری
  | "founder" // بنیان‌گذار
  | "investor" // سرمایه‌گذار
  | "employer" // کارفرما
  | "employee" // کارگر / کارمند (نیروی کار)
  /**
   * The natural person who signs on behalf of a legal-entity party. It is
   * NOT part of a contract type's `roles` list — it is created only when a
   * party is a legal entity, and `representativeOfPartyId` points back at
   * that entity. Keeping it a distinct role lets the entity and the person
   * coexist as two rows while every existing role-driven consumer is
   * unaffected.
   */
  | "legal_representative";

/** The legal capacity a party acts in. */
export type PartyCapacity =
  | "owner" // مالک
  | "attorney" // وکیل مالک
  | "legal_representative"; // نماینده قانونی

/** Property kinds supported by both journeys. */
export type PropertyKind = "apartment" | "house" | "villa";

/** Residential only in this release. */
export type PropertyUsage = "residential";

// ------------------------------------------------------------
// State machine
// ------------------------------------------------------------

/**
 * The explicit lifecycle of a property contract. Transitions are
 * declared in `CONTRACT_STATE_TRANSITIONS` and enforced server-side.
 */
export type PropertyContractState =
  | "DRAFT"
  | "PARTIES_PENDING"
  | "PROPERTY_PENDING"
  | "DOCUMENTS_PENDING"
  | "TERMS_PENDING"
  | "READY_FOR_REVIEW"
  | "COUNTERPARTY_REVIEW"
  | "CHANGES_REQUESTED"
  | "PENDING_ADMIN_REVIEW"
  | "ADMIN_APPROVED"
  | "REJECTED"
  | "READY_TO_SIGN"
  | "PARTIALLY_SIGNED"
  | "SIGNED"
  | "AMENDMENT_IN_PROGRESS"
  | "READY_FOR_OFFICIAL_REGISTRATION"
  | "FINALIZED"
  | "CANCELLED"
  | "ARCHIVED";

export const PROPERTY_CONTRACT_STATE_LABELS: Record<PropertyContractState, string> = {
  DRAFT: "پیش‌نویس",
  PARTIES_PENDING: "در انتظار اطلاعات طرفین",
  PROPERTY_PENDING: "در انتظار مشخصات ملک",
  DOCUMENTS_PENDING: "در انتظار مدارک",
  TERMS_PENDING: "در انتظار شرایط مالی",
  READY_FOR_REVIEW: "آماده بررسی",
  COUNTERPARTY_REVIEW: "نزد طرف مقابل",
  CHANGES_REQUESTED: "درخواست اصلاح",
  PENDING_ADMIN_REVIEW: "در انتظار تأیید ادمین",
  ADMIN_APPROVED: "تأییدشده برای صدور",
  REJECTED: "ردشده",
  READY_TO_SIGN: "آماده امضا",
  PARTIALLY_SIGNED: "امضای ناقص",
  SIGNED: "امضا شده",
  AMENDMENT_IN_PROGRESS: "اصلاحیه در حال تنظیم / امضای مجدد",
  READY_FOR_OFFICIAL_REGISTRATION: "نیازمند ثبت رسمی",
  FINALIZED: "نهایی‌شده",
  CANCELLED: "لغو‌شده",
  ARCHIVED: "بایگانی‌شده",
};

/**
 * Allowed state transitions. `FINALIZED`/`CANCELLED`/`ARCHIVED` are terminal-ish.
 *
 * The compulsory admin-approval gate sits between review and signature:
 * `READY_FOR_REVIEW → PENDING_ADMIN_REVIEW → ADMIN_APPROVED → READY_TO_SIGN`.
 * A signature is never issued before an approval bound to the exact current
 * version exists, so this edge is the machine-level half of that invariant;
 * the sign route enforces the other half (an approval for the current hash).
 */
export const CONTRACT_STATE_TRANSITIONS: Record<PropertyContractState, PropertyContractState[]> = {
  DRAFT: ["PARTIES_PENDING", "PROPERTY_PENDING", "DOCUMENTS_PENDING", "TERMS_PENDING", "READY_FOR_REVIEW", "CANCELLED"],
  PARTIES_PENDING: ["DRAFT", "PROPERTY_PENDING", "TERMS_PENDING", "READY_FOR_REVIEW", "CANCELLED"],
  PROPERTY_PENDING: ["DRAFT", "PARTIES_PENDING", "DOCUMENTS_PENDING", "TERMS_PENDING", "READY_FOR_REVIEW", "CANCELLED"],
  DOCUMENTS_PENDING: ["DRAFT", "PROPERTY_PENDING", "TERMS_PENDING", "READY_FOR_REVIEW", "CANCELLED"],
  TERMS_PENDING: ["DRAFT", "PROPERTY_PENDING", "DOCUMENTS_PENDING", "READY_FOR_REVIEW", "CANCELLED"],
  READY_FOR_REVIEW: ["DRAFT", "COUNTERPARTY_REVIEW", "PENDING_ADMIN_REVIEW", "READY_TO_SIGN", "CANCELLED"],
  COUNTERPARTY_REVIEW: ["CHANGES_REQUESTED", "PENDING_ADMIN_REVIEW", "READY_TO_SIGN", "CANCELLED"],
  CHANGES_REQUESTED: ["DRAFT", "READY_FOR_REVIEW", "COUNTERPARTY_REVIEW", "CANCELLED"],
  PENDING_ADMIN_REVIEW: ["ADMIN_APPROVED", "CHANGES_REQUESTED", "REJECTED", "CANCELLED"],
  ADMIN_APPROVED: ["READY_TO_SIGN", "PENDING_ADMIN_REVIEW", "CHANGES_REQUESTED", "CANCELLED"],
  REJECTED: ["DRAFT", "CANCELLED", "ARCHIVED"],
  READY_TO_SIGN: ["PARTIALLY_SIGNED", "SIGNED", "CHANGES_REQUESTED", "PENDING_ADMIN_REVIEW", "CANCELLED"],
  PARTIALLY_SIGNED: ["SIGNED", "CHANGES_REQUESTED", "AMENDMENT_IN_PROGRESS", "CANCELLED"],
  SIGNED: ["AMENDMENT_IN_PROGRESS", "READY_FOR_OFFICIAL_REGISTRATION", "FINALIZED", "CANCELLED"],
  // A signed contract is never edited in place. A Super-Admin amendment
  // moves it here; the new text then walks the normal review/sign path
  // again while the previously signed version stays immutable.
  AMENDMENT_IN_PROGRESS: ["DRAFT", "READY_FOR_REVIEW", "READY_TO_SIGN", "CANCELLED"],
  READY_FOR_OFFICIAL_REGISTRATION: ["FINALIZED", "CANCELLED"],
  FINALIZED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: [],
};

// ------------------------------------------------------------
// Money
// ------------------------------------------------------------

/**
 * A canonical monetary amount. `amount` is an integer in the smallest
 * unit of `currency` (for IRR that is the rial). Never store a
 * formatted string as the source of truth.
 */
export interface Money {
  /** Integer amount in the smallest unit of `currency`. */
  amount: number;
  /** ISO-4217 code. IRR (rial) is the canonical storage currency. */
  currency: "IRR";
}

// ------------------------------------------------------------
// Parties
// ------------------------------------------------------------

/**
 * The legal form of a party. A `natural` person is identified by name and
 * national id (or passport); a `legal` person is a company/institution
 * identified by its registered name and registration/national id and is
 * represented by a separate natural-person party.
 */
export type PartyPersonKind = "natural" | "legal";

/**
 * A natural person's nationality branch. It decides which identity fields
 * are required: an Iranian needs a national id, a foreign national needs a
 * passport and must NOT be forced to provide an Iranian national id.
 */
export type PartyNationality = "iranian" | "foreign";

export const PARTY_PERSON_KIND_LABELS_FA: Record<PartyPersonKind, string> = {
  natural: "شخص حقیقی",
  legal: "شخص حقوقی (شرکت / مؤسسه)",
};

export const PARTY_NATIONALITY_LABELS_FA: Record<PartyNationality, string> = {
  iranian: "ایرانی",
  foreign: "اتباع خارجی",
};

/**
 * Bank details used to pay this party. Stored on the party, but NEVER
 * copied into a version snapshot, the immutable PDF or any public route —
 * only the owner and the back office may read it.
 */
export interface PartyBankingInfo {
  bankName: string;
  /** حساب number, digits only. */
  accountNumber: string;
  /** شبا — `IR` followed by 24 digits. */
  iban: string;
  /** 16-digit card number. */
  cardNumber: string;
}

export interface PartyIdentity {
  firstName: string;
  lastName: string;
  fatherName: string;
  /**
   * 10-digit Iranian national id. Required for an Iranian natural person;
   * optional (and never mandatory) for a foreign national.
   */
  nationalId: string;
  /** شناسنامه number. */
  birthCertificateNumber: string;
  birthCertificatePlace: string;
  /** ISO date (Gregorian) or null. */
  birthDate: string | null;
  mobile: string;
  address: string;
  postalCode: string;

  // --- Legal entity (personKind = "legal") ---
  /** Registered name of the company/institution. */
  companyName?: string;
  /** شمارهٔ ثبت company registration number. */
  companyRegistrationNumber?: string;
  /** شناسهٔ ملی company national id (11 digits). */
  companyNationalId?: string;
  /** کد اقتصادی. */
  economicCode?: string;

  // --- Foreign natural person (nationality = "foreign") ---
  /** Country of nationality, free text (e.g. «افغانستان»). */
  nationalityCountryFa?: string;
  passportNumber?: string;
  /** ISO date (Gregorian) the passport expires. */
  passportExpiry?: string | null;
  /** Place of birth (برای اتباع خارجی). */
  birthPlace?: string;
  /** Gregorian birth date for a foreign national, ISO `YYYY-MM-DD`. */
  birthDateGregorian?: string | null;
  /** پروانهٔ کار number, where a work permit is legally required. */
  workPermitNumber?: string;
  /** ISO date the work permit expires. */
  workPermitExpiry?: string | null;
}

/** A party's ownership share, expressed in sixths (دانگ) of the property. */
export interface OwnershipShare {
  /** Number of دانگ held, 0–6. */
  dang: number;
  /** Denominator, always 6 for دانگ. */
  outOf: 6;
}

export interface ContractParty {
  id: string;
  contractId: string;
  role: PartyRole;
  capacity: PartyCapacity;
  identity: PartyIdentity;
  /**
   * Whether this party is a natural person or a legal entity. Defaults to
   * `natural` for parties created before this field existed.
   */
  personKind: PartyPersonKind;
  /**
   * Nationality branch of a natural person. Ignored for a legal entity
   * (the entity has an Iranian registration by definition in this release).
   */
  nationality: PartyNationality;
  /**
   * For a party acting as the authorised representative of a legal entity,
   * the id of that entity's party row. Null for every other party. This is
   * the link that lets the document say «شرکت … به نمایندگی آقای …» without
   * duplicating the representative's identity anywhere else.
   */
  representativeOfPartyId: string | null;
  /** The representative's position, e.g. «مدیرعامل». */
  representativePositionFa: string;
  /** Present for owner/attorney parties. */
  ownershipShare: OwnershipShare | null;
  /** When capacity is `attorney`, the power-of-attorney details. */
  powerOfAttorney: PowerOfAttorney | null;
  /**
   * Payment details. Private: never written into a version snapshot, the
   * immutable PDF or any public/token route.
   */
  banking: PartyBankingInfo | null;
  /** True for the party who created the contract. */
  isInitiator: boolean;
  createdAt: string;
}

export interface PowerOfAttorney {
  number: string;
  date: string | null;
  notaryOffice: string;
  /** حدود اختیار — free text scope of authority. */
  scope: string;
}

// ------------------------------------------------------------
// Property — shared
// ------------------------------------------------------------

export type DeedType = "single_page" | "booklet" | "other" | "none";

export interface PropertyAddress {
  province: string;
  city: string;
  district: string;
  neighborhood: string;
  street: string;
  alley: string;
  plaque: string;
  floor: string;
  unit: string;
  postalCode: string;
}

export interface PropertyDeed {
  deedType: DeedType;
  /** شناسه یکتای سند (حدنگار). */
  uniqueDeedId: string;
  deedNumber: string;
  serialNumber: string;
  /** پلاک ثبتی اصلی. */
  mainPlaque: string;
  /** پلاک ثبتی فرعی. */
  subPlaque: string;
  /** بخش ثبتی. */
  registrationDistrict: string;
  /** قطعه. */
  parcel: string;
  /** حوزه ثبتی. */
  registrationZone: string;
  /** مساحت رسمی سند (m²). */
  officialArea: number | null;
  ownerName: string;
  deedDate: string | null;
}

export type ParkingKind = "exclusive" | "shared" | "obstructing";
export type UtilityStatus = "independent" | "shared" | "none";
export type RestroomKind = "iranian" | "european" | "both";
export type KitchenKind = "open" | "closed";

export interface PropertyAmenities {
  hasParking: boolean;
  parkingKind: ParkingKind | null;
  parkingNumber: string;
  parkingFloor: string;
  hasStorage: boolean;
  storageNumber: string;
  storageArea: number | null;
  hasElevator: boolean;
  hasBalcony: boolean;
  balconyArea: number | null;
  restroomKind: RestroomKind | null;
  restroomCount: number | null;
  bathroomCount: number | null;
  hasMasterBathroom: boolean;
  kitchenKind: KitchenKind | null;
  kitchenCabinet: string;
  hasHood: boolean;
  hasStove: boolean;
  hasOven: boolean;
  hasDishwasher: boolean;
  /** Multi-select of heating systems. */
  heating: string[];
  /** Multi-select of cooling systems. */
  cooling: string[];
  utilities: {
    water: UtilityStatus;
    electricity: UtilityStatus;
    gas: UtilityStatus;
    telephone: UtilityStatus;
    internet: UtilityStatus;
  };
}

export interface PropertyGeneral {
  area: number | null;
  buildYear: number | null;
  floor: number | null;
  unitNumber: string;
  totalFloors: number | null;
  totalUnits: number | null;
  unitsPerFloor: number | null;
  bedrooms: number | null;
  /** جهت ملک — e.g. شمالی، جنوبی. */
  orientation: string;
  /** وضعیت بازسازی. */
  renovationStatus: string;
  /** وضعیت سکونت فعلی. */
  occupancyStatus: string;
}

/** Villa-only extras. */
export interface VillaDetails {
  landArea: number | null;
  buildingArea: number | null;
  yardArea: number | null;
  roofGarden: boolean;
  pool: boolean;
  sauna: boolean;
  jacuzzi: boolean;
  pergola: boolean;
  greenSpace: boolean;
  exclusiveFloors: number | null;
  buildingPermit: string;
}

// ------------------------------------------------------------
// Handover condition (rent + sale)
// ------------------------------------------------------------

export type ConditionState = "intact" | "flawed" | "needs_repair" | "unrecorded";

export interface HandoverItem {
  /** Stable key, e.g. "walls", "floor", "package". */
  key: string;
  labelFa: string;
  state: ConditionState;
  note: string;
}

export interface MeterReading {
  key: "electricity" | "gas" | "water";
  labelFa: string;
  meterNumber: string;
  value: string;
  photoDocumentId: string | null;
}

export interface HandoverKeyItem {
  key: string;
  labelFa: string;
  count: number;
}

export interface HandoverRecord {
  items: HandoverItem[];
  meters: MeterReading[];
  keys: HandoverKeyItem[];
  notes: string;
}

// ------------------------------------------------------------
// Documents
// ------------------------------------------------------------

export type ContractDocumentCategory =
  | "deed" // سند مالکیت
  | "landlord_id" // کارت ملی موجر
  | "tenant_id" // کارت ملی مستأجر
  | "seller_id"
  | "buyer_id"
  | "power_of_attorney" // وکالت‌نامه
  | "electricity_bill"
  | "water_bill"
  | "gas_bill"
  | "previous_contract"
  | "handover_photo" // تصاویر ملک
  | "completion_certificate" // پایان‌کار
  | "partition_minutes" // صورت‌مجلس تفکیکی
  | "mortgage_release" // مدارک فک رهن
  | "check_image" // تصویر چک
  | "signed_scan" // نسخه امضاشدهٔ دستی (اسکن)
  | "employer_id" // کارت ملی / شناسهٔ کارفرما
  | "employee_id" // کارت ملی / شناسهٔ کارگر
  | "employee_passport" // گذرنامهٔ کارگر غیرایرانی (به‌همراه مجوز کار و اقامت)
  | "employment_resume" // رزومه / سوابق کاری
  | "employment_education" // مدارک تحصیلی
  | "employment_order" // ابلاغ/حکم کار یا پیش‌نویس توافق
  | "employment_medical" // گواهی سلامت / طب کار
  | "final_pdf" // نسخهٔ نهایی قرارداد (PDF مهرشدهٔ سرور)
  | "wet_ink_evidence" // مستند امضای دستی خارج از سامانه (شاهد برون‌سازمانی)
  | "contract_annex" // پیوست قرارداد — فایلی که کاربر خودش به‌عنوان بخشی از قرارداد ضمیمه می‌کند
  | "other";

export interface ContractDocument {
  id: string;
  contractId: string;
  category: ContractDocumentCategory;
  /** Original client filename. */
  fileName: string;
  mime: string;
  sizeBytes: number;
  /** Storage key inside the private document root. */
  storageKey: string;
  /** SHA-256 of the bytes, hex. */
  hash: string;
  /** Optional caption (used for handover photos). */
  description: string;
  /** Handover photo category, when applicable. */
  photoCategory: string | null;
  uploadedBy: string;
  uploadedAt: string;
}

// ------------------------------------------------------------
// Payments
// ------------------------------------------------------------

export type PaymentMethod = "bank_transfer" | "card" | "check" | "sadad_check" | "other";
/** Named `ContractPaymentStatus` to avoid colliding with the legacy checkout `PaymentStatus`. */
export type ContractPaymentStatus = "pending" | "paid" | "overdue" | "cancelled";

export interface CheckDetails {
  bank: string;
  checkNumber: string;
  /** شناسه صیادی. */
  sadadId: string;
  dueDate: string | null;
  imageDocumentId: string | null;
}

export interface ContractPayment {
  id: string;
  contractId: string;
  /** Ordering within the schedule. */
  sequence: number;
  labelFa: string;
  amount: Money;
  /** ISO date the payment is due, or null for "on event". */
  dueDate: string | null;
  /** Human condition, e.g. «هنگام تحویل ملک». */
  conditionFa: string;
  method: PaymentMethod;
  status: ContractPaymentStatus;
  check: CheckDetails | null;
  note: string;
}

// ------------------------------------------------------------
// Terms — rent
// ------------------------------------------------------------

export type RentAgreementKind = "deposit_and_rent" | "full_deposit" | "rent_only";

export interface RentTerms {
  agreementKind: RentAgreementKind;
  /** ودیعه / رهن. */
  securityDeposit: Money;
  /** اجاره‌بها ماهانه. */
  monthlyRent: Money;
  /** Day of month rent is due (1–31). */
  rentDueDay: number | null;
  /** موجر destination account (شبا/کارت). */
  landlordAccount: string;
  /** Whether a late-payment penalty applies. */
  hasLatePenalty: boolean;
  latePenaltyPeriod: "daily" | "monthly" | null;
  latePenaltyAmount: Money | null;
  /** Whether the deposit is paid in instalments. */
  depositInstalments: boolean;
}

export interface RentDurations {
  /** تاریخ عقد قرارداد. */
  contractDate: string | null;
  /** تاریخ شروع اجاره. */
  startDate: string | null;
  /** تاریخ تحویل ملک. */
  handoverDate: string | null;
  /** تاریخ پایان اجاره. */
  endDate: string | null;
  /** Computed from start/end; stored for convenience. */
  durationMonths: number | null;
}

/** Who bears each recurring cost. */
export type CostBearer = "landlord" | "tenant" | "other";

export interface RentCosts {
  water: CostBearer;
  electricity: CostBearer;
  gas: CostBearer;
  telephone: CostBearer;
  internet: CostBearer;
  buildingCharge: CostBearer;
  currentExpenses: CostBearer;
  majorRepairs: CostBearer;
  utilityFailures: CostBearer;
  misuseDamage: CostBearer;
}

export interface RentUsageRules {
  residentialOnly: boolean;
  allowChangeOfUse: boolean;
  allowSublet: boolean;
  allowPets: boolean;
  allowStructuralChanges: boolean;
  allowFacadeEquipment: boolean;
  parkingTerms: string;
  commonAreaTerms: string;
  maintenanceTerms: string;
  commonAreaDamageLiability: string;
}

export interface RentTermination {
  /** Whether each breach ground is enabled. */
  grounds: {
    nonPayment: boolean;
    latePayment: boolean;
    unauthorizedUse: boolean;
    sublet: boolean;
    propertyDamage: boolean;
    earlyVacation: boolean;
    failureToVacate: boolean;
  };
  /** وجه التزام عدم تخلیه. */
  evictionPenaltyPeriod: "daily" | "monthly" | null;
  evictionPenaltyAmount: Money | null;
  /** Conditions for returning the deposit. */
  depositReturnTerms: string;
  /** When the deposit is returned. */
  depositReturnTiming: string;
}

export interface PropertyRentData {
  schemaVersion: 1;
  propertyKind: PropertyKind;
  usage: PropertyUsage;
  address: PropertyAddress;
  deed: PropertyDeed;
  general: PropertyGeneral;
  amenities: PropertyAmenities;
  villa: VillaDetails | null;
  durations: RentDurations;
  terms: RentTerms;
  costs: RentCosts;
  usageRules: RentUsageRules;
  termination: RentTermination;
  handover: HandoverRecord;
  /** Free-form custom clauses added by the user. */
  customClauses: CustomClause[];
  /**
   * Notes and requested changes, kept apart from the contract text.
   * Optional: contracts drafted before this field existed stay valid and
   * hash identically until the user actually enters something here.
   */
  supplementary?: ContractSupplementary;
}

// ------------------------------------------------------------
// Terms — sale
// ------------------------------------------------------------

export type LegalStatusAnswer = "yes" | "no" | "unknown";

export interface SaleLegalStatus {
  /** آیا ملک در رهن است؟ */
  inMortgage: LegalStatusAnswer;
  mortgageDetails: string;
  /** آیا ملک بازداشت است؟ */
  seized: LegalStatusAnswer;
  /** آیا ملک دارای وام است؟ */
  hasLoan: LegalStatusAnswer;
  loanDetails: string;
  /** آیا ملک در اختیار مستأجر است؟ */
  occupiedByTenant: LegalStatusAnswer;
  tenantLeaseEnd: string | null;
  tenantDeposit: Money | null;
  /** آیا محدودیتی برای انتقال وجود دارد؟ */
  transferRestricted: LegalStatusAnswer;
  restrictionDetails: string;
}

export interface SaleExtras {
  hasCompletionCertificate: boolean;
  completionCertificateNumber: string;
  completionCertificateDate: string | null;
  hasPartitionMinutes: boolean;
  /** وضعیت خلافی ساختمانی. */
  buildingViolations: string;
  /** بدهی ساختمان. */
  buildingDebt: Money | null;
}

export interface SaleTerms {
  /** ثمن معامله — total price. */
  totalPrice: Money;
  /** Price per m², computed for UX only. */
  pricePerSqm: Money | null;
  /** Whether the price is paid in a schedule. */
  hasSchedule: boolean;
}

export interface SaleRegistration {
  /** تاریخ توافقی حضور در دفترخانه. */
  agreedDate: string | null;
  agreedTime: string;
  notaryOfficeNumber: string;
  notaryCity: string;
  notaryAddress: string;
  /** مبلغ قابل پرداخت هنگام تنظیم سند. */
  amountAtRegistration: Money | null;
  /** مسئول تهیه مدارک. */
  documentsResponsible: "seller" | "buyer" | "both";
  /** Checklist of documents the seller must prepare. */
  requiredDocuments: string[];
}

export interface SaleObligations {
  /** جریمه عدم حضور فروشنده در دفترخانه. */
  sellerNoShowPenalty: Money | null;
  /** وجه التزام تأخیر در تحویل. */
  handoverDelayPenalty: Money | null;
  /** آیا فروشنده متعهد به فک رهن قبل از انتقال است؟ */
  sellerMustReleaseMortgage: boolean;
  /** تسویه بدهی‌های قبلی بر عهده چه کسی است؟ */
  priorDebtsBearer: "seller" | "buyer" | "other";
  /** تجهیزات همراه ملک. */
  includedEquipment: string;
  /** سایر توافقات. */
  otherTerms: string;
}

export interface PropertySaleData {
  schemaVersion: 1;
  propertyKind: PropertyKind;
  usage: PropertyUsage;
  address: PropertyAddress;
  deed: PropertyDeed;
  general: PropertyGeneral;
  amenities: PropertyAmenities;
  villa: VillaDetails | null;
  legalStatus: SaleLegalStatus;
  extras: SaleExtras;
  terms: SaleTerms;
  registration: SaleRegistration;
  obligations: SaleObligations;
  handover: HandoverRecord;
  customClauses: CustomClause[];
  /** Notes and requested changes, kept apart from the contract text. */
  supplementary?: ContractSupplementary;
}

// ------------------------------------------------------------
// Schema-driven contract data (vehicle, finance, services, business)
// ------------------------------------------------------------
// The bespoke property journeys have their own typed sub-objects. The
// remaining contract types are described entirely by their registry
// definition, so they share ONE generic data shape: a flat map of
// field key → value, plus the same custom-clause list. This keeps the
// wizard, the completeness scorer and the template engine generic —
// adding a type means adding a definition, never a new data type.

/**
 * One row of a repeating field (an instalment, an item, a per-party
 * obligation). Keys are the column keys declared on the descriptor.
 */
export type GenericRepeatRow = Record<string, string | number | Money | null>;

/** A single value captured by a schema-driven field. */
export type GenericFieldValue = string | number | boolean | GenericRepeatRow[] | null;

export interface GenericContractData {
  schemaVersion: 1;
  /** Field key → value, keyed by the definition's field descriptors. */
  values: Record<string, GenericFieldValue>;
  /** Free-form custom clauses added by the user. */
  customClauses: CustomClause[];
  /** Notes and requested changes, kept apart from the contract text. */
  supplementary?: ContractSupplementary;
}

/** The input control a schema-driven field renders. */
export type ContractFieldKind =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "date"
  | "select"
  | "toggle"
  /** A user-managed list of rows, edited with add/edit/delete controls. */
  | "repeatable";

/**
 * One column of a `repeatable` field. The same declaration drives the
 * form controls AND the printed table, so a column can never be asked
 * for and then silently dropped from the document.
 */
export interface ContractRepeatColumn {
  key: string;
  labelFa: string;
  /** Input control for the cell. Defaults to `text`. */
  kind?: "text" | "number" | "money" | "date";
  placeholderFa?: string;
}

/** One field in a schema-driven contract type. */
export interface ContractFieldDescriptor {
  /** Stable key into `GenericContractData.values`. */
  key: string;
  labelFa: string;
  kind: ContractFieldKind;
  /** The wizard step this field belongs to. */
  stepId: string;
  /** Options for `select`. */
  options?: { value: string; labelFa: string }[];
  placeholderFa?: string;
  helperFa?: string;
  /** True when the field must be filled for the section to complete. */
  required?: boolean;
  /**
   * Conditional requirement: the field is required ONLY when the condition
   * holds. Used for the employer/employee splits (natural person vs. legal
   * entity, Iranian vs. foreign national) so the completeness scorer demands
   * exactly the branch the user chose.
   */
  requiredWhen?: { key: string; equals?: GenericFieldValue; oneOf?: GenericFieldValue[] };
  /** Required for `repeatable`: the columns of the row, in print order. */
  columns?: ContractRepeatColumn[];
  /** Label of the "add another row" button for `repeatable`. */
  addLabelFa?: string;
}

// ------------------------------------------------------------
// Custom clauses
// ------------------------------------------------------------

/**
 * What the entry IS. An `agreement` is a real extra term the parties add
 * to their contract and prints as an operative clause. A `change_request`
 * is a proposal/note about the draft: it never rewrites an operative
 * clause or identity data, and the document prints it only in a clearly
 * labelled, non-operative annex.
 */
export type CustomClauseKind = "agreement" | "change_request";

export interface CustomClause {
  id: string;
  /** Defaults to `agreement` when absent (older stored drafts). */
  kind?: CustomClauseKind;
  title: string;
  body: string;
  /**
   * The wizard step the entry relates to (e.g. `financial`), so a change
   * request can point at the exact section it asks to amend. Resolved back
   * to the section title at render time.
   */
  sectionRef?: string;
  createdAt: string;
}

// ------------------------------------------------------------
// Supplementary information and requested changes
// ------------------------------------------------------------
// What the user wants to add or change is captured SEPARATELY from the
// contract text. It is never merged into a clause, never overwrites an
// identity field, and always prints in its own clearly-labelled annex —
// so a reader (and the reviewer) can tell authored contract terms from a
// request that has not yet been accepted.

/**
 * One file the user attaches to the contract as «پیوست قرارداد».
 *
 * An annex is part of the agreement, not a note about it: the bytes are
 * stored as a private `contract_annex` document (so the version snapshot's
 * documents manifest carries its hash), and this entry is the printable
 * description of that same file. The two are kept in step by the documents
 * API — deleting the document removes the entry.
 */
export interface ContractSupplementaryAttachment {
  /** The stored `contract_annex` document this annex describes. */
  documentId: string;
  /** عنوان پیوست — the label printed in the annex table. */
  titleFa: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
  /** SHA-256 of the bytes, so the printed annex is traceable to the file. */
  hash: string;
  addedAt: string;
}

/**
 * Free-form notes that belong to no single clause. Requested changes are
 * NOT duplicated here — they live in `customClauses` with
 * `kind: "change_request"` and a `sectionRef`, so there is exactly one
 * list of entries and one place they persist.
 */
export interface ContractSupplementary {
  notes: string;
  /**
   * ISO timestamp of the user's explicit «تأیید یادداشت و ادامه».
   * Only a confirmed note is treated as final by the wizard; the field is
   * additive, so drafts written before it existed stay readable.
   */
  noteConfirmedAt?: string | null;
  /**
   * Files the user registered as contract annexes (`category:
   * contract_annex`). Additive and optional, so older drafts stay valid
   * and hash identically until an annex is actually added.
   */
  attachments?: ContractSupplementaryAttachment[];
  /**
   * ISO timestamp of «تأیید پیوست‌ها». Any change to the annex list clears
   * it, so a confirmation always refers to the annexes now on screen.
   */
  attachmentsConfirmedAt?: string | null;
  /**
   * ISO timestamp of «تأیید و ادامه به بازبینی» on the supplementary step.
   * The review step reads it to know the material was acknowledged.
   */
  confirmedAt?: string | null;
}

// ------------------------------------------------------------
// Versions, approvals, audit
// ------------------------------------------------------------

export interface ContractVersionSnapshot {
  /** The full contract data at snapshot time. */
  data: ContractDomainData;
  parties: ContractParty[];
  payments: ContractPayment[];
  /** Manifest of attached documents (ids + hashes), not the bytes. */
  documentsManifest: { id: string; category: ContractDocumentCategory; hash: string; fileName: string }[];
}

/** Named `PropertyContractVersion` to avoid colliding with the legacy workspace `ContractVersion`. */
export interface PropertyContractVersion {
  id: string;
  contractId: string;
  versionNumber: number;
  snapshot: ContractVersionSnapshot;
  templateVersion: string;
  schemaVersion: number;
  /** SHA-256 over the canonical snapshot JSON. */
  documentHash: string;
  createdBy: string;
  createdAt: string;
}

export type ApprovalStatus = "pending" | "approved" | "changes_requested" | "rejected";

export interface ContractApproval {
  id: string;
  contractId: string;
  contractVersionId: string;
  partyId: string;
  status: ApprovalStatus;
  /** Free-text comment when requesting changes. */
  comment: string;
  /** How the approval was given. */
  method: "otp" | "explicit_consent" | "physical";
  approvedAt: string | null;
  createdAt: string;
}

export interface ContractAuditEntry {
  id: string;
  contractId: string;
  actorId: string;
  actorLabel: string;
  action: string;
  /** Human-readable Persian description. */
  descriptionFa: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ------------------------------------------------------------
// The contract aggregate
// ------------------------------------------------------------

/**
 * The union of every domain data shape. Property types carry their own
 * typed sub-objects; every other type carries `GenericContractData`.
 */
export type ContractDomainData = PropertyRentData | PropertySaleData | GenericContractData;

export interface PropertyContract {
  id: string;
  /** Human-facing id, e.g. LGL-RENT-1405-000184. */
  referenceCode: string;
  userId: string;
  domain: ContractDomain;
  type: ContractTypeId;
  typeFa: string;
  state: PropertyContractState;
  /** The user's role in this contract. */
  initiatorRole: PartyRole;
  /**
   * Which side of the document the drafting user is on, expressed in the
   * document's own «طرف اول / طرف دوم» ordering. This is NOT derivable
   * from `initiatorRole` (a drafter can be either side), so it is stored
   * explicitly and reused by the preview, the invites and party status.
   */
  initiatorSide: ContractInitiatorSide;
  title: string;
  /** Current wizard step id. */
  currentStep: string;
  /** 0–100, computed from real field completeness. */
  progress: number;
  templateVersion: string;
  schemaVersion: number;
  /** The working (mutable) data. */
  data: ContractDomainData;
  currentVersionId: string | null;
  currentVersionNumber: number;
  finalVersionId: string | null;
  finalizedAt: string | null;
  /** Public id used by the QR verification page. */
  publicVerificationId: string;
  /**
   * The case this contract belongs to, when created from a case.
   * Optional and additive — contracts created before case linkage
   * existed simply have no case.
   */
  caseId?: string | null;
  /**
   * §2.7 — a dev-only end-to-end sample contract. It runs the REAL
   * lifecycle (draft version → admin approval → signature request) with
   * fake parties and a non-delivering transport, and is labelled
   * «نمونه آزمایشی» everywhere it appears. Optional and additive, so
   * contracts stored before this flag existed stay valid.
   */
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A contract row plus its related collections, as returned by the detail API. */
export interface PropertyContractDetail extends PropertyContract {
  parties: ContractParty[];
  payments: ContractPayment[];
  documents: ContractDocument[];
  versions: PropertyContractVersion[];
  approvals: ContractApproval[];
  auditLog: ContractAuditEntry[];
}

// ------------------------------------------------------------
// Wizard step descriptors (schema-driven)
// ------------------------------------------------------------

export interface WizardStepDescriptor {
  id: string;
  titleFa: string;
  descriptionFa: string;
  /** Section keys this step owns, used for completeness scoring. */
  sections: string[];
  /** Steps that must be complete before this one is reachable. */
  requires?: string[];
  /**
   * When set, this step also collects the bank details of the named
   * party (the payment recipient). The data is stored on the party
   * record — not in the contract values — so it can be withheld from
   * the public preview and the counterparty's signing link.
   */
  bankingFor?: PartyRole;
}

// ------------------------------------------------------------
// API request/response shapes
// ------------------------------------------------------------

export interface PropertyContractCreateRequest {
  type: ContractTypeId;
  /** Only meaningful for property types; ignored otherwise. */
  propertyKind?: PropertyKind;
  initiatorRole: PartyRole;
  /** Which party the drafter is; defaults to the first declared role. */
  initiatorSide?: ContractInitiatorSide;
  title?: string;
  /** Link the new contract to a case the user owns. */
  caseId?: string;
}

export interface PropertyContractCreateResponse {
  id: string;
  referenceCode: string;
  type: ContractTypeId;
  state: PropertyContractState;
  currentStep: string;
  createdAt: string;
}

export interface PropertyContractUpdateRequest {
  title?: string;
  currentStep?: string;
  initiatorSide?: ContractInitiatorSide;
  state?: PropertyContractState;
  data?: Partial<PropertyRentData> | Partial<PropertySaleData> | Partial<GenericContractData>;
}

/**
 * The AI-review axis of a contract, computed server-side from the
 * stored `AiContractReview` rows and the current version. It is
 * deliberately separate from `state` (the document lifecycle): a
 * contract whose text is ready can still be un-reviewed, and a
 * contract whose text changed after a review is `needs_re_review`.
 *
 * `needs_re_review` is the load-bearing one — the stored result
 * describes a version that no longer exists and must never be shown as
 * the current verdict.
 */
export type ContractAnalysisStatus =
  | "not_reviewed"
  | "running"
  | "ready"
  | "needs_re_review"
  | "error";

export interface PropertyContractListItem {
  id: string;
  referenceCode: string;
  domain: ContractDomain;
  type: ContractTypeId;
  typeFa: string;
  title: string;
  state: PropertyContractState;
  stateFa: string;
  progress: number;
  /** Short location summary, e.g. «پاسداران، تهران». */
  locationFa: string;
  /** Names of the two primary parties, for the card. */
  partySummaryFa: string;
  currentStep: string;
  currentStepTitleFa: string;
  /** The AI-review axis. Defaults to `not_reviewed` when never run. */
  analysisStatus: ContractAnalysisStatus;
  /** ISO timestamp of the last completed AI review, or null. */
  lastAnalyzedAt: string | null;
  /** True when the contract is filed away (ARCHIVED / CANCELLED). */
  archived: boolean;
  /** ISO timestamp of the last export, or null. An event, not a state. */
  exportedAt: string | null;
  updatedAt: string;
  createdAt: string;
  /**
   * How the caller reached this contract. Omitted/`owner` means they own
   * it; `assigned` means it was referred to them for legal review, so the
   * card is labelled as a referral and opens read-only.
   */
  access?: "owner" | "assigned";
  /** The review request that grants `assigned` access, when applicable. */
  referralId?: string | null;
}

export interface PropertyContractListResponse {
  items: PropertyContractListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ContractCompletenessSection {
  key: string;
  labelFa: string;
  percent: number;
  missing: string[];
}

export interface ContractCompleteness {
  overall: number;
  sections: ContractCompletenessSection[];
  /** Blocking issues that prevent signing. */
  blockers: { sectionKey: string; labelFa: string; stepId: string }[];
}

export interface ContractFinalizeResponse {
  id: string;
  state: PropertyContractState;
  finalVersionId: string;
  finalizedAt: string;
  documentHash: string;
  publicVerificationId: string;
}

export interface ContractVerificationInfo {
  referenceCode: string;
  typeFa: string;
  versionNumber: number;
  documentHash: string;
  finalizedAt: string;
  statusFa: string;
  /** Party display names only — never national ids or addresses. */
  partyNames: string[];
  /**
   * True when this final version carries the LEGALIR review stamp — i.e.
   * a bound admin approval existed at finalize time. Public-safe.
   */
  reviewed: boolean;
  /** The stamp text, present only when `reviewed`. Never a court/notary seal. */
  stampLabelFa?: string;
  /** ISO date of the review decision, when reviewed. */
  reviewedAt?: string;
  /** The verifying office/person label, when reviewed. Not a court or notary. */
  reviewingOfficeFa?: string;
  /** A short public review id, when reviewed. Never a raw token. */
  reviewId?: string;
}

// ------------------------------------------------------------
// Admin contract queue (the operator-facing projection)
// ------------------------------------------------------------
// One row per contract in the admin review/list surface. It carries
// only what an operator needs to triage — never the full document body
// or the parties' national ids.

export interface AdminContractListItem {
  id: string;
  referenceCode: string;
  type: ContractTypeId;
  typeFa: string;
  title: string;
  state: PropertyContractState;
  stateFa: string;
  progress: number;
  /** The owner's display name. */
  ownerLabelFa: string;
  /** Short party summary, e.g. «مریم محمدی و رضا کریمی». */
  partySummaryFa: string;
  /** The current admin-review status, when a review exists. */
  adminReviewStatus: ContractAdminReviewStatus | null;
  adminReviewStatusFa: string | null;
  /** True when the current version carries a valid, bound admin approval. */
  adminApproved: boolean;
  currentVersionNumber: number;
  finalizedAt: string | null;
  /**
   * §2.4 — the newest signature request's status, so the queue shows
   * signing progress without opening each contract. `null` until the
   * owner sends the first request.
   */
  signatureStatus: SignatureRequestStatus | null;
  signatureStatusFa: string | null;
  /** How many of the request's participants have signed. */
  signedCount: number;
  participantCount: number;
  /** §2.7 — true for the dev-only sample contract («نمونه آزمایشی»). */
  isSample: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface AdminContractListResponse {
  items: AdminContractListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  /** Counts by admin-review status, for the queue tabs. */
  counts: { pending: number; approved: number; rejected: number; changesRequested: number };
  /**
   * The contract types actually present in the queue, so the type filter
   * only ever offers a value that can return rows.
   */
  types: { value: string; labelFa: string }[];
}

/** A request body for an admin review action. */
export interface AdminContractReviewActionRequest {
  action: ContractAdminReviewAction;
  /** Required for reject and request_info; ignored otherwise. */
  reason?: string;
}

// ============================================================
// UNIVERSAL CONTRACT LIFECYCLE ENGINE
// ============================================================
// Everything below is DOMAIN-AGNOSTIC. The contract type defines the
// CONTENT; this layer defines what happens AFTER the content exists:
//
//   PREVIEW → REVIEW → REVISION → SIGNATURE → FINAL → AUDIT
//
// Nothing here branches on `type === "property_rent"` and nothing
// hardcodes a party role. A new contract type inherits the whole
// lifecycle by registering a definition.
// ============================================================

// ------------------------------------------------------------
// Lifecycle stage (the 5-step stepper)
// ------------------------------------------------------------

/**
 * The user-facing lifecycle stage. Derived from the contract's real
 * state + completeness — never from "which button was clicked".
 */
export type ContractLifecycleStage =
  | "INFO" // اطلاعات
  | "PREVIEW" // پیش‌نمایش
  | "REVIEW" // بررسی
  | "SIGNATURE" // امضا
  | "COMPLETE"; // تکمیل

export const LIFECYCLE_STAGE_LABELS_FA: Record<ContractLifecycleStage, string> = {
  INFO: "اطلاعات",
  PREVIEW: "پیش‌نمایش",
  REVIEW: "بررسی",
  SIGNATURE: "امضا",
  COMPLETE: "تکمیل",
};

/** Ordered stages, index + 1 is the step number. */
export const LIFECYCLE_STAGES: readonly ContractLifecycleStage[] = [
  "INFO",
  "PREVIEW",
  "REVIEW",
  "SIGNATURE",
  "COMPLETE",
] as const;

export type LifecycleStageStatus = "done" | "active" | "pending";

export interface LifecycleStepView {
  stage: ContractLifecycleStage;
  labelFa: string;
  status: LifecycleStageStatus;
  /** True when the user may jump to this stage right now. */
  reachable: boolean;
}

// ------------------------------------------------------------
// Registration status — SEPARATE from signature status (§87–90)
// ------------------------------------------------------------
// FULLY_SIGNED ≠ OFFICIALLY_REGISTERED. A sale contract that is fully
// signed in Legalier has NOT transferred ownership; that only happens
// at the notary office. These two axes are never collapsed.

export type ContractRegistrationStatus =
  | "NOT_REQUIRED" // ثبت رسمی لازم نیست
  | "PENDING" // نیازمند ثبت رسمی
  | "SCHEDULED" // وقت دفترخانه تعیین شده
  | "REGISTERED" // ثبت رسمی انجام شد
  | "NOT_APPLICABLE"; // قرارداد لغو/بایگانی شده

export const REGISTRATION_STATUS_FA: Record<ContractRegistrationStatus, string> = {
  NOT_REQUIRED: "ثبت رسمی لازم نیست",
  PENDING: "نیازمند ثبت رسمی",
  SCHEDULED: "وقت دفترخانه تعیین شده",
  REGISTERED: "ثبت رسمی انجام شد",
  NOT_APPLICABLE: "موضوعیت ندارد",
};

// ------------------------------------------------------------
// Signature provider abstraction (§22)
// ------------------------------------------------------------
// OTP_SIGNATURE is the only provider implemented today. The union is
// open so CERTIFICATE_SIGNATURE / EXTERNAL_SIGNATURE can land without
// touching the lifecycle engine.

export type SignatureProviderId =
  | "OTP_SIGNATURE"
  | "CERTIFICATE_SIGNATURE"
  | "EXTERNAL_SIGNATURE";

/**
 * The legal weight of a signature. This drives the wording shown to
 * the user — an OTP signature must NEVER be labelled «امضای
 * الکترونیکی مطمئن» or «امضای دیجیتال رسمی».
 */
export type SignatureAssuranceLevel =
  | "ELECTRONIC_CONFIRMATION" // تأیید و امضای الکترونیکی
  | "SECURE_ELECTRONIC" // امضای الکترونیکی مطمئن (certificate-backed)
  | "QUALIFIED"; // امضای دیجیتال رسمی

export const SIGNATURE_ASSURANCE_LABELS_FA: Record<SignatureAssuranceLevel, string> = {
  ELECTRONIC_CONFIRMATION: "تأیید و امضای الکترونیکی",
  SECURE_ELECTRONIC: "امضای الکترونیکی مطمئن",
  QUALIFIED: "امضای دیجیتال رسمی",
};

// ------------------------------------------------------------
// Signature request / participant / event
// ------------------------------------------------------------

export type SignatureRequestStatus =
  | "DRAFT"
  | "SENT"
  | "PARTIALLY_SIGNED"
  | "COMPLETED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED";

export const SIGNATURE_REQUEST_STATUS_FA: Record<SignatureRequestStatus, string> = {
  DRAFT: "آماده ارسال",
  SENT: "ارسال‌شده",
  PARTIALLY_SIGNED: "امضای ناقص",
  COMPLETED: "تکمیل‌شده",
  DECLINED: "رد‌شده",
  EXPIRED: "منقضی‌شده",
  CANCELLED: "لغو‌شده",
};

export type SignatureParticipantStatus =
  | "PENDING"
  | "VIEWED"
  | "SIGNED"
  | "DECLINED";

export const SIGNATURE_PARTICIPANT_STATUS_FA: Record<SignatureParticipantStatus, string> = {
  PENDING: "در انتظار",
  VIEWED: "مشاهده‌شده",
  SIGNED: "امضا‌شده",
  DECLINED: "رد‌شده",
};

/**
 * HOW a participant signed. An OTP signature is proven by a one-time
 * code; a physical signature is wet-ink on a printed copy, proven by an
 * uploaded scan. They carry different assurance and are never conflated.
 */
export type SignatureSignMethod = "OTP_ELECTRONIC" | "PHYSICAL_WET_INK";

export const SIGNATURE_SIGN_METHOD_FA: Record<SignatureSignMethod, string> = {
  OTP_ELECTRONIC: "امضای الکترونیکی (کد یک‌بارمصرف پیامکی)",
  PHYSICAL_WET_INK: "امضای دستی روی نسخه چاپی",
};

/**
 * One participant in a signature request. A participant is either a
 * registered party (`partyId`) or a guest signer identified only by
 * mobile (`guestMobile`) — the engine treats both identically.
 */
export interface SignatureParticipant {
  id: string;
  signatureRequestId: string;
  contractId: string;
  /** The contract party, when the signer is a registered party. */
  partyId: string | null;
  /** The role label shown to the user, resolved from the registry. */
  roleFa: string;
  /**
   * The signer's name, resolved from their party record when they are a
   * registered party (company name for a legal entity, first + last name
   * for a natural person; the representative's own name for a
   * representative row). Empty for a guest signer, whose only identity is
   * their mobile. The drafter sees this next to the destination number
   * before an invitation is sent.
   */
  nameFa: string;
  /** Masked mobile for display, e.g. 0912***0003. */
  mobileMasked: string;
  /**
   * The signer's mobile, needed to deliver the OTP. This is the
   * signer's identity, not a secret — the OTP itself is never stored.
   */
  mobile: string;
  status: SignatureParticipantStatus;
  /** ISO timestamp the participant first opened the document. */
  viewedAt: string | null;
  signedAt: string | null;
  /** How the signature was applied, when signed. */
  signedMethod: SignatureSignMethod | null;
  /** The uploaded wet-ink scan (a ContractDocument id), when physical. */
  proofDocumentId: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  createdAt: string;
}

/**
 * An immutable audit event for a signature request. Every state change
 * appends one — this is the tamper-evident trail DocuSign/Adobe model.
 */
export type SignatureEventType =
  | "REQUEST_CREATED"
  | "REQUEST_SENT"
  | "INVITATION_SENT"
  /** Delivery to this recipient failed; the invitation exists but the link never arrived. */
  | "INVITATION_FAILED"
  | "INVITATION_REVOKED"
  | "DOCUMENT_VIEWED"
  | "OTP_REQUESTED"
  | "OTP_FAILED"
  | "OTP_VERIFIED"
  | "SIGNED"
  | "DECLINED"
  | "REQUEST_COMPLETED"
  | "REQUEST_EXPIRED"
  | "REQUEST_CANCELLED"
  | "INTEGRITY_FAILED"
  /** An admin recorded HOW they verified a signature the party gave. */
  | "ADMIN_ATTESTATION";

// ------------------------------------------------------------
// Admin attestations (§ signature stage)
// ------------------------------------------------------------
// An admin may VERIFY a signature the party themselves gave — an OTP
// they watched arrive, a wet-ink scan they checked, a call they made.
// An attestation is evidence about a signature; it can never create
// one, change a participant's status, or advance the contract state.
// The origin is always explicit: `party_link` means the party confirmed
// through their own dedicated link; every other value means an admin
// verified it out-of-band.

export type SignatureAttestationChannel =
  /** The party confirmed through their own dedicated LEGALIR link. */
  | "party_link"
  /** The admin watched the OTP arrive / the party typed it on a call. */
  | "sms_otp_observed"
  /** A printed copy was signed by hand and the scan checked. */
  | "wet_ink_verified"
  /** Oral confirmation on a recorded/verified call. */
  | "phone_call";

export interface SignatureAttestation {
  id: string;
  contractId: string;
  signatureRequestId: string;
  participantId: string;
  /** The frozen version the attested signature is bound to. */
  contractVersionId: string;
  documentHash: string | null;
  channel: SignatureAttestationChannel;
  /** Mandatory: what the admin actually saw or checked. */
  noteFa: string;
  adminUserId: string;
  adminLabelFa: string;
  createdAt: string;
}

export const SIGNATURE_ATTESTATION_CHANNEL_FA: Record<SignatureAttestationChannel, string> = {
  party_link: "تأیید مستقیم طرف از طریق لینک اختصاصی",
  sms_otp_observed: "بررسی ادمین — کد پیامکی مشاهده شد",
  wet_ink_verified: "بررسی ادمین — امضای دستی روی نسخهٔ چاپی",
  phone_call: "بررسی ادمین — تأیید تلفنی",
};

export interface SignatureEvent {
  id: string;
  signatureRequestId: string;
  contractId: string;
  participantId: string | null;
  type: SignatureEventType;
  /** Human-readable Persian description. */
  descriptionFa: string;
  /** The exact version this event refers to. */
  contractVersionId: string | null;
  /** SHA-256 of the version at the time of the event. */
  documentHash: string | null;
  /** How the signer was authenticated, e.g. "OTP_SMS". */
  authMethod: string | null;
  /** Coarse client fingerprint (never the raw IP). */
  clientFingerprint: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * A signature request bound to ONE immutable contract version. The
 * request can never outlive the version it was created for: a content
 * change invalidates it.
 */
export interface SignatureRequest {
  id: string;
  contractId: string;
  /** The frozen version every signature in this request binds to. */
  contractVersionId: string;
  /** SHA-256 of that version, re-verified before every signature. */
  documentHash: string;
  provider: SignatureProviderId;
  assuranceLevel: SignatureAssuranceLevel;
  status: SignatureRequestStatus;
  /** ISO timestamp the request expires (default 72h after send). */
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** A signature request plus its participants and event trail. */
export interface SignatureRequestDetail extends SignatureRequest {
  participants: SignatureParticipant[];
  events: SignatureEvent[];
}

// ------------------------------------------------------------
// Invitations (§25–28)
// ------------------------------------------------------------
// The raw token is returned ONCE, at creation. Only its SHA-256 hash
// is persisted, so a database leak cannot be replayed.

export type InvitationStatus = "ACTIVE" | "USED" | "REVOKED" | "EXPIRED";

export interface SignatureInvitation {
  id: string;
  contractId: string;
  signatureRequestId: string;
  participantId: string;
  /** SHA-256 of the raw token. The raw token is never stored. */
  tokenHash: string;
  /** Masked recipient for display. */
  recipientMasked: string;
  status: InvitationStatus;
  /** When true the recipient must verify identity before viewing. */
  verifyBeforeView: boolean;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  /**
   * The transport that actually carried the invitation. `dev-console`
   * means the message reached the server log, NOT a phone; `none` means
   * delivery failed and the invitation must be resent.
   */
  deliveryChannel?: "sms" | "dev-console" | "none";
  /** The recorded delivery outcome for this recipient. */
  deliveryStatus?: "SENT" | "FAILED";
  /** When the latest delivery attempt was made. */
  lastSentAt?: string | null;
}

// ------------------------------------------------------------
// Review comments (§11, §34)
// ------------------------------------------------------------

export type ReviewCommentKind = "comment" | "change_request" | "approval_note";

/**
 * Where a note may be seen. `internal` notes belong to the drafter's own
 * workspace and never travel to a counterparty, the public signer page or
 * the PDF; `parties` notes are shared feedback. Neither ever becomes a
 * clause or an approval.
 */
export type ReviewCommentVisibility = "internal" | "parties";

export interface ContractReviewComment {
  id: string;
  contractId: string;
  contractVersionId: string;
  /** The party who wrote it, when known. */
  partyId: string | null;
  /** Display label, e.g. «موجر» or «وکیل». */
  authorLabelFa: string;
  /** Who authored it — the drafter, a party, a lawyer, or the AI. */
  authorKind: "drafter" | "party" | "lawyer" | "ai" | "system";
  /** Defaults to `internal` for notes created before this field existed. */
  visibility?: ReviewCommentVisibility;
  kind: ReviewCommentKind;
  body: string;
  /** Optional clause reference the comment is anchored to. */
  clauseRef: string | null;
  /**
   * The comment this one replies to. `null`/absent means a top-level
   * comment. A reply always belongs to the same contract AND the same
   * version as its parent, so a thread can never span two revisions.
   */
  parentId?: string | null;
  createdAt: string;
}

// ------------------------------------------------------------
// Lawyer review (§45–62)
// ------------------------------------------------------------

export type LawyerReviewMode = "BLOCKING" | "NON_BLOCKING";

export type LawyerReviewState =
  | "REQUESTED"
  | "MATCHING"
  | "AWAITING_ACCEPTANCE"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED";

export const LAWYER_REVIEW_STATE_FA: Record<LawyerReviewState, string> = {
  REQUESTED: "درخواست ثبت شد",
  MATCHING: "در حال یافتن وکیل",
  AWAITING_ACCEPTANCE: "در انتظار پذیرش وکیل",
  ACCEPTED: "پذیرفته‌شده",
  IN_PROGRESS: "در حال بررسی",
  COMPLETED: "بررسی تکمیل شد",
  DECLINED: "رد‌شده",
  EXPIRED: "منقضی‌شده",
  CANCELLED: "لغو‌شده",
};

export type LawyerReviewFindingSeverity = "info" | "low" | "medium" | "high" | "critical";

export type LawyerReviewFindingKind =
  | "risk" // ریسک حقوقی
  | "missing_clause" // بند ناقص
  | "ambiguous" // ابهام
  | "unfair_term" // شرط نامتعارف
  | "suggestion"; // پیشنهاد بهبود

/**
 * One finding from a lawyer's review. A lawyer NEVER edits the
 * contract silently: a finding is a suggestion the user accepts or
 * rejects, and accepting it creates a NEW version.
 */
export interface LawyerReviewFinding {
  id: string;
  lawyerReviewRequestId: string;
  contractId: string;
  contractVersionId: string;
  kind: LawyerReviewFindingKind;
  severity: LawyerReviewFindingSeverity;
  titleFa: string;
  bodyFa: string;
  /** The clause this finding refers to, when anchored. */
  clauseRef: string | null;
  /** The lawyer's proposed replacement text, when applicable. */
  proposedText: string | null;
  /** The user's decision on the suggestion. */
  decision: "pending" | "accepted" | "rejected";
  decidedAt: string | null;
  createdAt: string;
}

/**
 * A lawyer review request. The SLA is STORED, not hardcoded, and the
 * clock starts at ACCEPTED — not at request time.
 */
export interface LawyerReviewRequest {
  id: string;
  contractId: string;
  contractVersionId: string;
  documentHash: string;
  /** The user who requested the review. */
  requestedBy: string;
  /** The matched lawyer, once one accepts. */
  lawyerId: string | null;
  lawyerNameFa: string | null;
  mode: LawyerReviewMode;
  state: LawyerReviewState;
  /** The legal category used for matching. */
  category: string;
  /** SLA in hours, measured from ACCEPTED. */
  slaHours: number;
  /** ISO timestamp the SLA clock started (set on ACCEPTED). */
  slaStartedAt: string | null;
  /** ISO timestamp the SLA is due. */
  slaDueAt: string | null;
  /** The lawyer's summary opinion, when completed. */
  summaryFa: string | null;
  /** True when the lawyer's opinion blocks signing (BLOCKING mode). */
  blocksSigning: boolean;
  requestedAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A lawyer review request plus its findings. */
export interface LawyerReviewRequestDetail extends LawyerReviewRequest {
  findings: LawyerReviewFinding[];
}

// ------------------------------------------------------------
// AI review (§63–70)
// ------------------------------------------------------------
// The AI review is NOT a separate chat. It attaches the contract to
// the EXISTING Legalier conversation by reference and asks the
// existing pipeline. The result is clearly labelled as AI analysis,
// never as a lawyer's opinion.

export interface AiContractReview {
  id: string;
  contractId: string;
  contractVersionId: string;
  /** The conversation the review was run in. */
  conversationId: string;
  /** The assistant message that carries the analysis. */
  messageId: string | null;
  /** Which party's perspective the analysis was written from. */
  perspectiveRoleFa: string;
  /** The AI's summary, clearly labelled as AI analysis. */
  summaryFa: string;
  /** Citation locators the analysis relied on. */
  citations: { locator: string; title: string }[];
  /** Always true — the UI must render the AI-vs-lawyer distinction. */
  isAiAnalysis: boolean;
  createdAt: string;
}

// ------------------------------------------------------------
// Compulsory admin review & approval (§6 / §7)
// ------------------------------------------------------------
// A generated contract MUST pass an internal LEGALIR admin approval
// before a final version is stamped or a signature is issued. An
// approval is bound to the EXACT version hash it was given for: if the
// content changes afterwards the approval no longer holds and the
// contract must return to the queue.

export type ContractAdminReviewStatus =
  | "PENDING" // در انتظار تأیید ادمین
  | "APPROVED" // تأییدشده برای صدور
  | "REJECTED" // ردشده
  | "CHANGES_REQUESTED" // نیازمند اصلاح
  | "CANCELLED"; // لغو بررسی

export const CONTRACT_ADMIN_REVIEW_STATUS_FA: Record<ContractAdminReviewStatus, string> = {
  PENDING: "در انتظار تأیید ادمین",
  APPROVED: "تأییدشده برای صدور",
  REJECTED: "ردشده",
  CHANGES_REQUESTED: "نیازمند اصلاح",
  CANCELLED: "لغو‌شده",
};

export type ContractAdminReviewAction =
  | "approve" // تأیید برای صدور نهایی
  | "reject" // رد و بازگرداندن همراه با دلیل
  | "request_info" // درخواست اطلاعات یا اصلاح مشخص
  | "cancel"; // لغو بررسی با علت

/**
 * A single immutable entry in an admin review's history. Every action —
 * including a re-review after a change — is appended, never overwritten,
 * so the audit trail of who approved exactly what, and when, survives.
 */
export interface ContractAdminReviewEvent {
  id: string;
  /** The review this event belongs to. */
  reviewId: string;
  action: ContractAdminReviewAction;
  actorId: string;
  actorLabel: string;
  /** The admin's free-text reason or note. Required for reject/request_info. */
  reasonFa: string;
  /** The version hash the action was recorded against. */
  contractVersionId: string | null;
  documentHash: string | null;
  createdAt: string;
}

/**
 * An admin review bound to a contract version. `documentHash` is the
 * hash of the version the decision was made for — an approval with a
 * `documentHash` that no longer matches the current version is stale.
 */
export interface ContractAdminReview {
  id: string;
  contractId: string;
  contractVersionId: string | null;
  documentHash: string | null;
  status: ContractAdminReviewStatus;
  /** The admin who made the current decision, when one has been made. */
  reviewerId: string | null;
  reviewerLabelFa: string | null;
  /** Public-safe identifier of the reviewer shown beside the stamp, e.g. «B.R». */
  reviewerInitials: string | null;
  /** The office/person verifying, shown beside the stamp. Never a court or notary. */
  reviewingOfficeFa: string;
  reasonFa: string;
  submittedAt: string;
  decidedAt: string | null;
  /** ISO timestamp after which the review is no longer valid, if set. */
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractAdminReviewDetail extends ContractAdminReview {
  events: ContractAdminReviewEvent[];
}

// ------------------------------------------------------------
// The review stamp (§7)
// ------------------------------------------------------------
// The stamp is a VISUAL mark of LEGALIR's internal review. It is never
// presented as a court, notary, registry or government seal, and it is
// only ever drawn on an admin-approved FINAL version. A draft or a
// rejected contract carries the unapproved-draft watermark instead.

/** The exact stamp text — never paraphrased. */
export const CONTRACT_REVIEW_STAMP_TEXT = "لیـــــــگالیر - بررسی شد";

/** The watermark shown on any not-yet-approved contract. */
export const CONTRACT_DRAFT_WATERMARK_FA = "پیش‌نویس ـ تأییدنشده";

/** The blue tone of the review stamp (ink-like), as an RGB triple 0–255. */
export const CONTRACT_REVIEW_STAMP_RGB: readonly [number, number, number] = [28, 78, 156];

/** The footer note that must accompany the stamp wherever it is shown. */
export const CONTRACT_REVIEW_STAMP_DISCLAIMER_FA =
  "این مهر نشان‌دهندهٔ بررسی داخلی لیگالیر است و به‌معنای مهر دادگاه، دفترخانه، سازمان ثبت یا تأیید قطعی حقوقی نیست.";

// ------------------------------------------------------------
// The official LEGALIR stamp approval (§7 — Super Admin only)
// ------------------------------------------------------------
// The internal review approval (`ContractAdminReview`) authorises that a
// version MAY be issued. The official STAMP is a SEPARATE, stronger act:
// only a Super Admin may authorise it, it MUST carry a reason, and it is
// bound to BOTH the exact version hash AND the exact bytes of the stamp
// master. If either the contract content or the stamp master changes, the
// approval no longer holds and the stamp must be re-authorised. The
// original stamp file is never modified — a change is a new version.

/** The lifecycle of a stamp approval for one contract version. */
// ------------------------------------------------------------
// Amendments (§10)
// ------------------------------------------------------------
// After any party signs, the signed text is immutable. A Super Admin —
// and only a Super Admin — may open an amendment: it preserves the prior
// version, records why the text changed, shows a diff, notifies the
// parties and, when the change is substantive, sends the new version for
// re-approval and re-signature. The old document is NEVER rewritten.

export type ContractAmendmentStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "APPLIED"
  | "REJECTED"
  | "CANCELLED";

export const CONTRACT_AMENDMENT_STATUS_FA: Record<ContractAmendmentStatus, string> = {
  DRAFT: "در حال تنظیم",
  PENDING_APPROVAL: "در انتظار تأیید",
  APPROVED: "تأییدشده",
  APPLIED: "اعمال‌شده",
  REJECTED: "ردشده",
  CANCELLED: "لغو‌شده",
};

export interface ContractAmendmentEvent {
  id: string;
  amendmentId: string;
  action: "created" | "updated" | "approved" | "rejected" | "applied" | "cancelled" | "notified";
  actorId: string;
  actorLabelFa: string;
  descriptionFa: string;
  createdAt: string;
}

export interface ContractAmendment {
  id: string;
  contractId: string;
  /** Monotonic per contract: amendment 1, 2, … */
  sequence: number;
  status: ContractAmendmentStatus;
  /**
   * The signed version the amendment departs from. It is preserved
   * forever and remains downloadable/verifiable.
   */
  baseVersionId: string | null;
  baseDocumentHash: string | null;
  /** The new version produced by the amendment, once applied. */
  newVersionId: string | null;
  /** Why the text is changing — mandatory. */
  reasonFa: string;
  /** Human-readable summary of the change. */
  changeSummaryFa: string;
  /** Per-clause differences, stored so the UI can show them. */
  diff: { clauseRef: string; beforeFa: string; afterFa: string }[];
  /**
   * True when the change is substantive: the parties must re-approve and
   * re-sign. False for a clerical note that alters no effective term.
   */
  substantive: boolean;
  /** Whether parties were notified by SMS. */
  notifiedAt: string | null;
  createdById: string;
  createdByLabelFa: string;
  approvedById: string | null;
  approvedByLabelFa: string | null;
  approvedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  events: ContractAmendmentEvent[];
}

export type ContractStampStatus =
  | "PENDING" // درخواست مهر ثبت شده، در انتظار تأیید مدیر ارشد
  | "APPLIED" // مهر تأیید و اعمال شد
  | "REJECTED" // درخواست مهر رد شد
  | "CANCELLED"; // درخواست مهر لغو شد

export const CONTRACT_STAMP_STATUS_FA: Record<ContractStampStatus, string> = {
  PENDING: "در انتظار تأیید مدیر ارشد",
  APPLIED: "مهر لیگالیر اعمال شد",
  REJECTED: "درخواست مهر رد شد",
  CANCELLED: "درخواست مهر لغو شد",
};

/** The action recorded in a stamp request's history. */
export type ContractStampAction =
  | "request"
  | "apply"
  | "reject"
  | "cancel"
  /**
   * The signer-notification attempt that follows an applied stamp. It is
   * recorded separately so a failed SMS is visible in the trail even
   * though the stamp itself was validly applied.
   */
  | "notify";

/**
 * One immutable entry in a stamp request's history. Every action is
 * appended, never overwritten, so the trail of who authorised exactly
 * which stamp for exactly which version survives.
 */
export interface ContractStampEvent {
  id: string;
  stampRequestId: string;
  action: ContractStampAction;
  actorId: string;
  actorLabel: string;
  reasonFa: string;
  /** The version hash the action was recorded against. */
  documentHash: string | null;
  /** The stamp-master hash in force when the action was taken. */
  stampAssetSha256: string | null;
  createdAt: string;
}

/**
 * A stamp approval bound to a contract version AND the stamp master.
 * `documentHash` is the version hash; `stampAssetSha256` is the hash of
 * the exact stamp image. Both must still match for the stamp to be drawn.
 */
export interface ContractStampRequest {
  id: string;
  contractId: string;
  contractVersionId: string | null;
  documentHash: string | null;
  /** Version label of the stamp master, e.g. "legalir-review-stamp-1". */
  stampAssetVersion: string;
  /** SHA-256 of the stamp master at approval time. */
  stampAssetSha256: string | null;
  status: ContractStampStatus;
  /** Who requested the stamp, when requested by a non-Super-Admin. */
  requestedById: string | null;
  requestedByLabelFa: string | null;
  /** The Super Admin who applied the stamp. */
  approvedById: string | null;
  approvedByLabelFa: string | null;
  /** The mandatory reason recorded with the decision. */
  reasonFa: string;
  requestedAt: string;
  decidedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractStampRequestDetail extends ContractStampRequest {
  events: ContractStampEvent[];
}

/** The stamp master's public-safe integrity metadata (never a path/bytes). */
export interface ContractStampAssetInfo {
  available: boolean;
  version: string;
  sha256: string | null;
  sizeBytes: number | null;
}

/**
 * The POST body for a stamp decision. `notify` is deliberately excluded:
 * it is a RECORDED outcome appended by the apply path after the SMS
 * adapter reports back, never an action a caller may invoke.
 */
export interface ContractStampActionRequest {
  action: Exclude<ContractStampAction, "notify">;
  /** MANDATORY — the stamp is an official act, so the record says why. */
  reason: string;
  /** Defaults to the single PENDING request when omitted. */
  stampRequestId?: string;
}

/** The `GET /api/v1/admin/contracts/[id]/stamp` payload. */
export interface ContractStampContextResponse {
  contract: {
    id: string;
    referenceCode: string;
    /** The contract's own title, so a confirmation names the right document. */
    title: string;
    typeFa: string;
    state: PropertyContractState;
  };
  currentVersion: {
    id: string;
    versionNumber: number;
    documentHash: string;
  } | null;
  stampAsset: ContractStampAssetInfo;
  /** TRUE when the current version carries a valid internal review. */
  reviewed: boolean;
  /**
   * §4 — the signature state of the CURRENT version, read from the real
   * request bound to its hash. The final-approval button is only offered
   * when this is `ready`, so an unsigned contract can never be stamped.
   */
  signatures: {
    ready: boolean;
    /** Why approval is blocked, in the operator's words. Null when ready. */
    reasonFa: string | null;
  };
  /** The `CONTRACT_STAMP_ENABLED` capability, read from the server. */
  featureEnabled: boolean;
  /**
   * The server's own verdict on each action, with the ordered list of
   * unmet preconditions in the operator's words. The panel renders this
   * instead of re-deriving the rules, so a disabled button always has a
   * real, server-authoritative reason attached to it.
   */
  eligibility: ContractStampEligibility;
  /** TRUE when a valid stamp is already applied to the current version. */
  applied: boolean;
  appliedRequest: ContractStampRequestDetail | null;
  requests: ContractStampRequestDetail[];
}

/** The REAL per-party delivery outcome after an applied stamp. */
export interface ContractStampNotification {
  participantId: string;
  roleFa: string;
  delivered: boolean;
  /** The transport that actually carried the message, when delivered. */
  channel: "sms" | "dev-console" | null;
  failureReasonFa: string | null;
}

/**
 * §4 — the outcome of freezing the signed content when the official seal
 * is applied. The final version IS the version the parties signed, so
 * `finalVersionId` names the same frozen snapshot the signatures bind to.
 */
export type ContractStampFinalization =
  | {
      ok: true;
      finalVersionId: string;
      documentHash: string;
      state: PropertyContractState;
      /** ISO-8601 UTC. */
      finalizedAt: string;
      /** TRUE when the sealed A4 artifact was rendered and stored. */
      artifactStored: boolean;
    }
  | { ok: false; code: string; messageFa: string };

/** The `POST /api/v1/admin/contracts/[id]/stamp` payload. */
export interface ContractStampDecisionResponse {
  stampRequest: ContractStampRequestDetail;
  applied: boolean;
  notifications: ContractStampNotification[];
  /**
   * Present only on `apply`: the contract is finalized in the SAME act,
   * because a contract is not final until LEGALIR approves it.
   */
  finalization: ContractStampFinalization | null;
}

// ------------------------------------------------------------
// Stamp eligibility — WHY an action is or is not available
// ------------------------------------------------------------
// The panel used to derive availability on its own, so a disabled button
// could be explained by nothing at all. The server now evaluates the exact
// same rules it enforces and returns the verdict, each unmet precondition
// carrying a stable code and the operator's own words. The panel renders
// THAT — it never re-derives a rule, so the button and the API can never
// disagree about what is allowed.

/** A precondition that is not met for the requested stamp action. */
export type ContractStampBlockCode =
  /** The `CONTRACT_STAMP_ENABLED` capability is off. */
  | "FEATURE_DISABLED"
  /** The contract has no frozen version, so there is nothing to seal. */
  | "NO_VERSION"
  /** The stamp master image is missing on disk. */
  | "STAMP_ASSET_MISSING"
  /** The current version has no valid LEGALIR review bound to its hash. */
  | "NOT_REVIEWED"
  /** No signature request is bound to the current version hash. */
  | "SIGNATURES_REQUIRED"
  /** A signature request exists but was given for a different content hash. */
  | "SIGNATURES_STALE"
  /** A valid seal is already applied to the current version. */
  | "ALREADY_STAMPED"
  /** An open request already exists for this version. */
  | "PENDING_REQUEST"
  /** `apply`/`reject`/`cancel` was requested with no open request. */
  | "NO_PENDING_REQUEST"
  /** The caller does not hold `admin:contracts:stamp:manage`. */
  | "NOT_MANAGER";

/** One unmet precondition, in the operator's words. */
export interface ContractStampBlocker {
  code: ContractStampBlockCode;
  messageFa: string;
}

/** The server's verdict on every stamp action for one contract. */
export interface ContractStampEligibility {
  canRequest: boolean;
  canApply: boolean;
  canReject: boolean;
  canCancel: boolean;
  /** Ordered: the FIRST entry is the one the operator should fix next. */
  blockers: ContractStampBlocker[];
  /**
   * The action the panel should offer when nothing is blocking — `null`
   * when the contract already reached its terminal stamp state.
   */
  nextAction: "request" | "apply" | "reject" | "cancel" | "none";
}

// ------------------------------------------------------------
// Contract stages — the lifecycle table in the admin drawer
// ------------------------------------------------------------
// Every row is DERIVED from real rows (the type's own sections, the admin
// review, the registration record, the signature request, the frozen
// version, the seal). Nothing is a fixed template for all contract types:
// the data stages come from the contract type's own section definitions.

export type ContractStageStatus =
  | "done" // مرحله تمام شده
  | "active" // مرحلهٔ جاری
  | "pending" // هنوز شروع نشده
  | "blocked" // منتظر پیش‌شرط دیگر
  | "needs_fix" // نیازمند اصلاح
  | "rejected" // ردشده
  | "skipped"; // در این مسیر لازم نبود

export const CONTRACT_STAGE_STATUS_FA: Record<ContractStageStatus, string> = {
  done: "تکمیل‌شده",
  active: "در حال انجام",
  pending: "در انتظار",
  blocked: "منتظر پیش‌شرط",
  needs_fix: "نیازمند اصلاح",
  rejected: "ردشده",
  skipped: "لازم نبود",
};

/**
 * The real action a stage detail offers. Each maps to an operation that
 * already exists on the server — no stage invents a button with no effect.
 */
export type ContractStageActionId =
  | "review_decision"
  | "resend_invitations"
  | "register_self_final"
  | "view_final_pdf"
  | "stamp_action";

export interface ContractStageAction {
  id: ContractStageActionId;
  labelFa: string;
  /** False when the actor's permission or the stage state forbids it. */
  enabled: boolean;
  /** Why it is unavailable, in the operator's words. Null when enabled. */
  reasonFa: string | null;
}

/** One stage row in the admin lifecycle table. */
export interface ContractStageRow {
  /** Stable key, e.g. `section:parties`, `review`, `signature`, `stamp`. */
  key: string;
  /** 1-based position in the table. */
  index: number;
  titleFa: string;
  status: ContractStageStatus;
  statusFa: string;
  /** The role/person now responsible for this stage. */
  responsibleFa: string;
  /** ISO-8601 of the last change to this stage, when one happened. */
  updatedAt: string | null;
  /** The newest recorded reason/comment attached to this stage. */
  noteFa: string | null;
  /** Section completion, for data stages only. */
  percent: number | null;
  /** Required items still missing (data stages only). */
  missingFa: string[];
  /** A short explanation of the current status. */
  detailFa: string | null;
  actions: ContractStageAction[];
}

/** The whole table plus the pointer to where the contract is right now. */
export interface ContractStagesView {
  rows: ContractStageRow[];
  /** Key of the row the contract currently sits on, when one is active. */
  currentKey: string | null;
  /** Number of rows that are done or skipped, for the header summary. */
  doneCount: number;
  totalCount: number;
}

// ------------------------------------------------------------
// The legal-basis report (§2)
// ------------------------------------------------------------
// A NON-BINDING annex that lists, per clause, the real provisions the
// catalogued clause template rests on. It is never part of the operative
// contract text and never presented as a substitute for legal advice.
// A provision only appears here when a human legal review has approved
// that citation; an unreviewed or unknown provision is never guessed and
// simply omitted.

/** The mandatory framing line for the legal-basis annex. */
export const CONTRACT_LEGAL_BASIS_DISCLAIMER_FA =
  "این پیوست صرفاً «مبنای حقوقی و گزارش بررسی» است، بخشی از متن تعهدآور قرارداد نیست و جایگزین نظر وکیل یا مشاورهٔ حقوقی نیست.";

/**
 * Whether a clause↔provision citation has passed legal review.
 *
 *   reviewed       — a human legal reviewer confirmed the mapping;
 *   pending        — catalogued but not yet reviewed; never presented as final;
 *   needs_revision — a reviewer flagged the mapping as unsound and it must be
 *                    corrected before it can be printed as reviewed.
 */
export type ContractLegalCitationStatus = "reviewed" | "pending" | "needs_revision";

/** One reviewed provision a clause rests on. */
export interface ContractLegalCitation {
  /** The exact, curated provision locator, e.g. «ماده ۲۳۰ قانون مدنی». */
  articleFa: string;
  /** The law the provision belongs to. */
  lawTitleFa: string;
  /** Why this clause rests on the provision (one line). */
  noteFa: string;
  /** Review state of THIS citation mapping. */
  status: ContractLegalCitationStatus;
  /** Link into the official law catalog (`LAW_SOURCES[].id`), when one exists. */
  lawSourceId: string | null;
  /**
   * §7 — the exact name of the reviewed source this mapping was taken from
   * (e.g. «قانون مدنی — مصوب ۱۳۰۷ با اصلاحات»). Populated from the stored
   * `ContractLegalClauseRecord`; absent on a seed-only citation.
   */
  sourceNameFa?: string;
  /** §7 — the stored record's content version this citation was read from. */
  contentVersion?: number;
  /** §7 — when a human legal reviewer confirmed the mapping (ISO-8601 UTC). */
  reviewedAt?: string | null;
}

/**
 * §7 — one stored, versioned legal-review record for a clause of a contract
 * type. This is the ADMIN-EDITABLE source of the annex: the in-code catalog
 * is only the seed; the moment a reviewer saves a record, this row becomes
 * authoritative for that (type, clause) pair.
 */
export interface ContractLegalClauseRecord {
  id: string;
  contractType: ContractTypeId;
  clauseId: string;
  /** The name of the reviewed legal source. */
  sourceNameFa: string;
  /** Link into the official law catalog, when one exists. */
  lawSourceId: string | null;
  /** The exact article locator — only ever a provision the reviewer confirmed. */
  articleFa: string;
  /** Why the clause rests on this provision. */
  noteFa: string;
  /** Monotonic content version; every save increments it. */
  contentVersion: number;
  status: ContractLegalCitationStatus;
  /** ISO-8601 UTC, set when the reviewer saved the record. */
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewedByLabelFa: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The framing line for the pre-sign tips annex (non-binding, no acknowledgement). */
export const CONTRACT_PRE_SIGN_TIPS_DISCLAIMER_FA =
  "این نکات جنبهٔ اطلاع‌رسانی دارند، بخشی از متن تعهدآور قرارداد نیستند، تأیید جداگانه‌ای لازم ندارند و جایگزین مشاورهٔ حقوقی نیستند.";

/**
 * §7 — a «before you sign, know this» tip for a contract type. It is shown
 * OUTSIDE the contract text, is never acknowledged, and is printed as its own
 * non-binding annex in the draft and the final document.
 */
export interface ContractPreSignTip {
  id: string;
  contractType: ContractTypeId;
  /** Display order inside the type's tips list. */
  order: number;
  titleFa: string;
  bodyFa: string;
  /** The reviewed source the tip rests on. */
  sourceNameFa: string;
  contentVersion: number;
  status: ContractLegalCitationStatus;
  /** ISO-8601 UTC. */
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewedByLabelFa: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The citations attached to a single rendered clause. */
export interface ContractLegalBasisSection {
  clauseId: string;
  clauseHeadingFa: string;
  citations: ContractLegalCitation[];
}

/** The assembled legal-basis annex for one contract version. */
export interface ContractLegalBasisReport {
  disclaimerFa: string;
  /** Clauses carrying at least one reviewed citation. */
  citedClauseCount: number;
  /** Operative clauses with no catalogued provision (rest on the parties' agreement). */
  uncitedClauseCount: number;
  sections: ContractLegalBasisSection[];
  /** True when at least one citation is still awaiting legal review. */
  hasPendingCitations: boolean;
  /**
   * §7 — operative clauses with NO reviewed citation. They are NOT published
   * as definitively grounded: the annex flags them for legal review instead.
   */
  flaggedClauses: { clauseId: string; clauseHeadingFa: string }[];
}

// ------------------------------------------------------------
// Lifecycle aggregate (what the workspace renders)
// ------------------------------------------------------------

export interface ContractLifecycleView {
  stage: ContractLifecycleStage;
  steps: LifecycleStepView[];
  registrationStatus: ContractRegistrationStatus;
  registrationStatusFa: string;
  /** The active signature request, when one exists. */
  signatureRequest: SignatureRequestDetail | null;
  /**
   * The invitations issued for that request. Each row carries the REAL
   * delivery outcome (`deliveryStatus` / `deliveryChannel`), so the
   * drafter can see per recipient whether the link reached a phone, only
   * the dev console, or failed and needs resending.
   */
  invitations: SignatureInvitation[];
  /** The active lawyer review, when one exists. */
  lawyerReview: LawyerReviewRequestDetail | null;
  /** The most recent AI review, when one exists. */
  aiReview: AiContractReview | null;
  /** The current admin review, when one exists. */
  adminReview: ContractAdminReview | null;
  /**
   * True when the contract's CURRENT version carries a valid, bound
   * LEGALIR admin approval. This is the same hash-bound check the sign
   * and finalize routes enforce; the preview reads it to decide whether
   * to show the review stamp or the unapproved-draft watermark.
   */
  adminApproved: boolean;
  /**
   * True when the CURRENT version carries a valid, bound OFFICIAL stamp
   * (Super Admin, applied AFTER every required signature). This is the
   * second, stronger gate than `adminApproved`: the seal/hologram may
   * only be drawn when this is true, and it becomes false automatically
   * if the version hash or the stamp master changes.
   */
  stamped: boolean;
  /**
   * The Super-Admin decision behind the current stamp, shown beside the
   * seal as a SEPARATE axis from the party signatures. Null when the
   * current version carries no valid stamp.
   */
  officialStamp: {
    approvedByLabelFa: string | null;
    approvedAt: string | null;
    /** The opinion recorded with the approval (mandatory, audited). */
    reasonFa: string;
    /** The version hash the stamp is bound to. */
    documentHash: string | null;
  } | null;
  /** Review comments on the current version. */
  comments: ContractReviewComment[];
  /**
   * §7 — the type's «before you sign, know this» tips. They belong to the
   * contract TYPE, not to the text, and are never acknowledged: the drafter
   * reads them beside the preview and they print as a separate non-binding
   * annex in both the draft and the final version.
   */
  preSignTips: ContractPreSignTip[];
  /** True when the contract may be prepared for signature right now. */
  canPrepareForSignature: boolean;
  /** True when a signature may be given right now. */
  canSign: boolean;
  /** True when the contract may be finalized right now. */
  canFinalize: boolean;
  /**
   * True when the contract may be submitted to the admin review queue.
   * Requires a frozen current version and no newer un-reviewed content.
   */
  canSubmitForAdminReview: boolean;
  /**
   * The registration record bound to the CURRENT version hash, when one
   * exists. This is how every surface tells «بررسی‌شده توسط لیگالیر»
   * apart from «ثبت نهایی بدون بررسی» — never from the contract state,
   * which is identical for both paths.
   */
  registration: ContractRegistrationRecord | null;
  /** True only when `registration.reviewedByLegalir` is true. */
  reviewedByLegalir: boolean;
  /**
   * True when the contract may take the «ثبت نهایی» path right now: a
   * frozen version exists, no admin review is in flight or approved, and
   * the state transition into the signature stage is legal.
   */
  canSelfFinalize: boolean;
  /** Attachments/ signatures that cannot appear in the printed output. */
  printIssues: ContractPrintIssue[];
  /** The admin's 100-character printable message, when recorded. */
  adminMessage: ContractAdminMessage | null;
  /**
   * §T7 — everything the STORED final PDF contains besides the contract
   * text, so the on-screen A4 sheet can mirror it: the same signature
   * scans in the same cells, the same annex files in registration order,
   * the same red admin message, the same amber unreviewed notice and the
   * same authenticity facts. Derived from the real files; `null` when a
   * file cannot be resolved (the accompanying print issue says why).
   */
  printMirror: ContractPrintMirror;
}

/** One uploaded signature scan, as the preview must draw it. */
export interface ContractPrintMirrorSignature {
  /** The rendered role label — the same key the signature table uses. */
  roleFa: string;
  nameFa: string;
  /** Owner-scoped URL of the uploaded scan; null for OTP signatures. */
  href: string | null;
  /** True when the uploaded file cannot be printed (reported in printIssues). */
  unprintable: boolean;
}

/** One annex file, in the exact order the PDF appends it. */
export interface ContractPrintMirrorAnnex {
  documentId: string;
  titleFa: string;
  fileName: string;
  mime: string;
  /** Owner-scoped URL; null when the stored file is gone. */
  href: string | null;
  /** True when the format cannot be embedded in a PDF (reported in printIssues). */
  unprintable: boolean;
}

export interface ContractPrintMirror {
  signatures: ContractPrintMirrorSignature[];
  annexes: ContractPrintMirrorAnnex[];
  /** The red message printed on the last contract page, or null. */
  adminMessage: string | null;
  /** Registration-path facts for the «تأییدیهٔ اصالت» page. */
  authenticity: {
    path: ContractRegistrationPath;
    reviewedByLegalir: boolean;
    registeredAt: string | null;
    registeredByLabelFa: string | null;
    reviewId: string | null;
    reviewedAt: string | null;
    stampApplied: boolean;
    stampSha256: string | null;
    hologramApplied: boolean;
  } | null;
  /** The amber unreviewed notice drawn in place of the blue review mark. */
  selfFinal: {
    actorLabelFa: string | null;
    registeredAt: string;
    reasonFa: string;
  } | null;
}

// ------------------------------------------------------------
// Lifecycle API request/response shapes
// ------------------------------------------------------------

export interface SignatureRequestCreateRequest {
  /** Restrict the request to specific parties; omit for all. */
  partyIds?: string[];
  /** Guest signers identified only by mobile. */
  guests?: { roleFa: string; mobile: string }[];
  /** Hours until the request expires. Defaults to 72. */
  expiresInHours?: number;
}

export interface SignatureRequestCreateResponse {
  request: SignatureRequestDetail;
  /** Raw invitation tokens, returned ONCE. Never persisted in the clear. */
  invitations: { participantId: string; token: string; expiresAt: string }[];
}

export interface SignatureOtpRequestResponse {
  sent: boolean;
  mobileMasked: string;
  expiresAt: string;
  /** Remaining attempts before the challenge is destroyed. */
  remainingAttempts: number;
}

export interface SignatureOtpVerifyRequest {
  participantId: string;
  code: string;
  /** The consent checkbox — must be explicitly true, never prechecked. */
  consentGiven: boolean;
  /** The version of the consent text the user agreed to. */
  consentVersion: string;
  /** Client-generated key so a retried request cannot double-sign. */
  idempotencyKey?: string;
}

export interface SignatureOtpVerifyResponse {
  participant: SignatureParticipant;
  request: SignatureRequestDetail;
  allSigned: boolean;
  /** The assurance level actually applied — drives the UI wording. */
  assuranceLevel: SignatureAssuranceLevel;
}

export interface LawyerReviewCreateRequest {
  mode: LawyerReviewMode;
  category: string;
  /** SLA in hours. Defaults to the platform default (48). */
  slaHours?: number;
  note?: string;
}

export interface AiReviewCreateRequest {
  /** The party perspective to analyse from. */
  perspectiveRole?: PartyRole;
  /** An existing conversation to attach to; a new one is created when omitted. */
  conversationId?: string;
  question?: string;
}

export interface ReviewCommentCreateRequest {
  body: string;
  kind?: ReviewCommentKind;
  clauseRef?: string;
  partyId?: string;
}

// ------------------------------------------------------------
// Final registration — the TWO paths (reviewed / self-final)
// ------------------------------------------------------------
// A contract may reach the signature stage in exactly one of two ways:
//
//   1. «ارسال برای بررسی در لیگالیر» — LEGALIR's legal team reviews the
//      frozen version, and the approval is bound to its hash.
//   2. «ثبت نهایی» — the parties register the contract directly. No
//      review happened, and NO surface may claim otherwise.
//
// The record is the audit proof of which path was taken. It is bound to
// a version HASH for the same reason approvals are: a content change
// produces a new hash, and the old registration no longer authorises
// signature or finalization.

export type ContractRegistrationPath = "legalir_review" | "self_final";

export const CONTRACT_REGISTRATION_PATH_FA: Record<ContractRegistrationPath, string> = {
  legalir_review: "ارسال برای بررسی در لیگالیر",
  self_final: "ثبت نهایی بدون بررسی لیگالیر",
};

export interface ContractRegistrationRecord {
  id: string;
  contractId: string;
  contractVersionId: string;
  documentHash: string;
  path: ContractRegistrationPath;
  /**
   * TRUE only when LEGALIR actually reviewed the bound version. A
   * `self_final` record is always false, and an admin's manual advance
   * does not turn a false into a true.
   */
  reviewedByLegalir: boolean;
  /** The admin review this record points at, when path=legalir_review. */
  adminReviewId: string | null;
  /** Why this path was chosen (user confirmation or the admin's reason). */
  reasonFa: string;
  actorId: string;
  actorLabelFa: string;
  actorKind: "party" | "admin";
  createdAt: string;
}

// ------------------------------------------------------------
// Admin print message — the red card on the last contract page
// ------------------------------------------------------------

/** Hard limit for the printable admin message, in characters. */
export const CONTRACT_ADMIN_MESSAGE_MAX = 100;

export interface ContractAdminMessage {
  contractId: string;
  messageFa: string;
  adminUserId: string;
  adminLabelFa: string;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------
// Signature-link contact correction (admin, before sending)
// ------------------------------------------------------------

export interface ContractContactChange {
  id: string;
  contractId: string;
  signatureRequestId: string | null;
  participantId: string | null;
  partyId: string | null;
  roleFa: string;
  nameFa: string;
  /** Canonical E.164 numbers, as stored on the participant. */
  previousMobile: string;
  newMobile: string;
  reasonFa: string;
  adminUserId: string;
  adminLabelFa: string;
  changedAt: string;
  /** The outcome of the invitation send that followed the change. */
  deliveryStatus: "SENT" | "FAILED" | null;
  deliveryChannel: "sms" | "dev-console" | "none" | null;
  deliveryDetail: string | null;
  deliveredAt: string | null;
}

// ------------------------------------------------------------
// Print readiness — what the PDF/print output can honestly include
// ------------------------------------------------------------
// A file the platform accepts for upload is not automatically printable:
// DOCX and WEBP cannot be embedded into the generated PDF. The server
// reports that BEFORE finalization so neither a party nor an admin is
// surprised by a silently missing attachment.

export type ContractPrintIssueCode =
  | "ATTACHMENT_UNPRINTABLE"
  | "ATTACHMENT_UNREADABLE"
  | "SIGNATURE_UNPRINTABLE"
  | "SIGNATURE_UNREADABLE";

export interface ContractPrintIssue {
  code: ContractPrintIssueCode;
  /** The stored document the issue concerns, when there is one. */
  documentId: string | null;
  /** Human label of the affected annex/signature. */
  titleFa: string;
  /** Clear Persian explanation, shown to the user and the admin. */
  messageFa: string;
}
