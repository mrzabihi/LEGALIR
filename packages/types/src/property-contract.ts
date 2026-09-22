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
export type ContractDomain = "property" | "vehicle" | "finance" | "services" | "business";

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
  | "startup";

/** Every contract type the engine knows about (extend as domains land). */
export type ContractTypeId = PropertyContractType | SchemaContractType;

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
  | "investor"; // سرمایه‌گذار

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
// Schema-driven contract data (vehicle, finance, services, business)
// ------------------------------------------------------------
// The bespoke property journeys have their own typed sub-objects. The
// remaining contract types are described entirely by their registry
// definition, so they share ONE generic data shape: a flat map of
// field key → value, plus the same custom-clause list. This keeps the
// wizard, the completeness scorer and the template engine generic —
// adding a type means adding a definition, never a new data type.

/** A single value captured by a schema-driven field. */
export type GenericFieldValue = string | number | boolean | null;

export interface GenericContractData {
  schemaVersion: 1;
  /** Field key → value, keyed by the definition's field descriptors. */
  values: Record<string, GenericFieldValue>;
  /** Free-form custom clauses added by the user. */
  customClauses: CustomClause[];
}

/** The input control a schema-driven field renders. */
export type ContractFieldKind =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "date"
  | "select"
  | "toggle";

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
  type: ContractTypeId;
  /** Only meaningful for property types; ignored otherwise. */
  propertyKind?: PropertyKind;
  initiatorRole: PartyRole;
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
  state?: PropertyContractState;
  data?: Partial<PropertyRentData> | Partial<PropertySaleData> | Partial<GenericContractData>;
}

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
  | "INTEGRITY_FAILED";

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
}

// ------------------------------------------------------------
// Review comments (§11, §34)
// ------------------------------------------------------------

export type ReviewCommentKind = "comment" | "change_request" | "approval_note";

export interface ContractReviewComment {
  id: string;
  contractId: string;
  contractVersionId: string;
  /** The party who wrote it, when known. */
  partyId: string | null;
  /** Display label, e.g. «موجر» or «وکیل». */
  authorLabelFa: string;
  /** Who authored it — a party, a lawyer, or the AI. */
  authorKind: "party" | "lawyer" | "ai" | "system";
  kind: ReviewCommentKind;
  body: string;
  /** Optional clause reference the comment is anchored to. */
  clauseRef: string | null;
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
// Lifecycle aggregate (what the workspace renders)
// ------------------------------------------------------------

export interface ContractLifecycleView {
  stage: ContractLifecycleStage;
  steps: LifecycleStepView[];
  registrationStatus: ContractRegistrationStatus;
  registrationStatusFa: string;
  /** The active signature request, when one exists. */
  signatureRequest: SignatureRequestDetail | null;
  /** The active lawyer review, when one exists. */
  lawyerReview: LawyerReviewRequestDetail | null;
  /** The most recent AI review, when one exists. */
  aiReview: AiContractReview | null;
  /** Review comments on the current version. */
  comments: ContractReviewComment[];
  /** True when the contract may be prepared for signature right now. */
  canPrepareForSignature: boolean;
  /** True when a signature may be given right now. */
  canSign: boolean;
  /** True when the contract may be finalized right now. */
  canFinalize: boolean;
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
