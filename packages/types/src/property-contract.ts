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

/** The top-level contract domain. Only `property` is implemented today. */
export type ContractDomain = "property" | "vehicle";

/** Contract types within the property domain. */
export type PropertyContractType = "property_rent" | "property_sale";

/** Every contract type the engine knows about (extend as domains land). */
export type ContractTypeId = PropertyContractType | "vehicle_sale";

/** Which side of the deal the initiating user is on. */
export type PartyRole =
  | "landlord" // موجر
  | "tenant" // مستأجر
  | "seller" // فروشنده
  | "buyer"; // خریدار

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
  | "READY_TO_SIGN"
  | "PARTIALLY_SIGNED"
  | "SIGNED"
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
  READY_TO_SIGN: "آماده امضا",
  PARTIALLY_SIGNED: "امضای ناقص",
  SIGNED: "امضا شده",
  READY_FOR_OFFICIAL_REGISTRATION: "نیازمند ثبت رسمی",
  FINALIZED: "نهایی‌شده",
  CANCELLED: "لغو‌شده",
  ARCHIVED: "بایگانی‌شده",
};

/** Allowed state transitions. `FINALIZED`/`CANCELLED`/`ARCHIVED` are terminal-ish. */
export const CONTRACT_STATE_TRANSITIONS: Record<PropertyContractState, PropertyContractState[]> = {
  DRAFT: ["PARTIES_PENDING", "PROPERTY_PENDING", "DOCUMENTS_PENDING", "TERMS_PENDING", "READY_FOR_REVIEW", "CANCELLED"],
  PARTIES_PENDING: ["DRAFT", "PROPERTY_PENDING", "TERMS_PENDING", "READY_FOR_REVIEW", "CANCELLED"],
  PROPERTY_PENDING: ["DRAFT", "PARTIES_PENDING", "DOCUMENTS_PENDING", "TERMS_PENDING", "READY_FOR_REVIEW", "CANCELLED"],
  DOCUMENTS_PENDING: ["DRAFT", "PROPERTY_PENDING", "TERMS_PENDING", "READY_FOR_REVIEW", "CANCELLED"],
  TERMS_PENDING: ["DRAFT", "PROPERTY_PENDING", "DOCUMENTS_PENDING", "READY_FOR_REVIEW", "CANCELLED"],
  READY_FOR_REVIEW: ["DRAFT", "COUNTERPARTY_REVIEW", "READY_TO_SIGN", "CANCELLED"],
  COUNTERPARTY_REVIEW: ["CHANGES_REQUESTED", "READY_TO_SIGN", "CANCELLED"],
  CHANGES_REQUESTED: ["DRAFT", "READY_FOR_REVIEW", "COUNTERPARTY_REVIEW", "CANCELLED"],
  READY_TO_SIGN: ["PARTIALLY_SIGNED", "SIGNED", "CHANGES_REQUESTED", "CANCELLED"],
  PARTIALLY_SIGNED: ["SIGNED", "CHANGES_REQUESTED", "CANCELLED"],
  SIGNED: ["READY_FOR_OFFICIAL_REGISTRATION", "FINALIZED", "CANCELLED"],
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

export interface PartyIdentity {
  firstName: string;
  lastName: string;
  fatherName: string;
  /** 10-digit Iranian national id. */
  nationalId: string;
  /** شناسنامه number. */
  birthCertificateNumber: string;
  birthCertificatePlace: string;
  /** ISO date (Gregorian) or null. */
  birthDate: string | null;
  mobile: string;
  address: string;
  postalCode: string;
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
  /** Present for owner/attorney parties. */
  ownershipShare: OwnershipShare | null;
  /** When capacity is `attorney`, the power-of-attorney details. */
  powerOfAttorney: PowerOfAttorney | null;
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
}

// ------------------------------------------------------------
// Custom clauses
// ------------------------------------------------------------

export interface CustomClause {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

// ------------------------------------------------------------
// Versions, approvals, audit
// ------------------------------------------------------------

export interface ContractVersionSnapshot {
  /** The full contract data at snapshot time. */
  data: PropertyRentData | PropertySaleData;
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
  method: "otp" | "explicit_consent";
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

export interface PropertyContract {
  id: string;
  /** Human-facing id, e.g. LGL-RENT-1405-000184. */
  referenceCode: string;
  userId: string;
  domain: ContractDomain;
  type: PropertyContractType;
  typeFa: string;
  state: PropertyContractState;
  /** The user's role in this contract. */
  initiatorRole: PartyRole;
  title: string;
  /** Current wizard step id. */
  currentStep: string;
  /** 0–100, computed from real field completeness. */
  progress: number;
  templateVersion: string;
  schemaVersion: number;
  /** The working (mutable) data. */
  data: PropertyRentData | PropertySaleData;
  currentVersionId: string | null;
  currentVersionNumber: number;
  finalVersionId: string | null;
  finalizedAt: string | null;
  /** Public id used by the QR verification page. */
  publicVerificationId: string;
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
}

// ------------------------------------------------------------
// API request/response shapes
// ------------------------------------------------------------

export interface PropertyContractCreateRequest {
  type: PropertyContractType;
  propertyKind: PropertyKind;
  initiatorRole: PartyRole;
  title?: string;
}

export interface PropertyContractCreateResponse {
  id: string;
  referenceCode: string;
  type: PropertyContractType;
  state: PropertyContractState;
  currentStep: string;
  createdAt: string;
}

export interface PropertyContractUpdateRequest {
  title?: string;
  currentStep?: string;
  state?: PropertyContractState;
  data?: Partial<PropertyRentData> | Partial<PropertySaleData>;
}

export interface PropertyContractListItem {
  id: string;
  referenceCode: string;
  domain: ContractDomain;
  type: PropertyContractType;
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
  updatedAt: string;
  createdAt: string;
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
}
