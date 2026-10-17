// ============================================================
// LEGALIR — Contract Registry
// ============================================================
// The single extension point of the Contract Operating System.
// Every contract type registers a `ContractDefinition` here; the
// wizard, the completeness scorer, the template engine, the
// document checklist and the registration policy all read from the
// definition instead of branching on `typeId`.
//
// Adding a new domain (e.g. Vehicle) means adding one definition —
// no changes to the wizard shell, the API routes or the state
// machine. `VEHICLE_SALE` is registered as a stub today so the
// architecture is proven to be domain-agnostic.
// ============================================================

import type {
  ContractDomain,
  ContractTypeId,
  ContractDomainData,
  ContractFieldDescriptor,
  ContractFieldKind,
  GenericContractData,
  PropertyContractType,
  PropertyKind,
  PartyRole,
  PropertyRentData,
  PropertySaleData,
  WizardStepDescriptor,
  ContractDocumentCategory,
} from "@legalir/types";

// ------------------------------------------------------------
// Definition shape
// ------------------------------------------------------------

/** A section of the contract used for completeness scoring. */
export interface ContractSectionDefinition {
  key: string;
  labelFa: string;
  /** The wizard step that owns this section. */
  stepId: string;
  /** Dotted paths into the domain data that must be non-empty. */
  requiredPaths: string[];
}

/**
 * One declarative table inside a schema-driven clause.
 *
 * A step's fields are NOT dumped into one anonymous grid. Each table names
 * the fields it owns (in row order) and the exact headers it prints, so a
 * contract shows «مشخصات خودرو / مشخصه / شرح» and «حقوق و مزایا / شرح /
 * مبلغ» — not a generic two-column list of every answer in the step.
 *
 * The table is data, not template code: `template.ts` reads it, and the
 * screen sheet, the print sheet and the server PDF all draw the same rows.
 */
export interface ContractFieldTableRow {
  /**
   * Optional row label, overriding the field's own label. It is used only
   * where the document needs a different wording from the form («مبلغ
   * قرض» rather than the form's «مبلغ»); when omitted, the descriptor's
   * `labelFa` is printed, so the form and the sheet can never disagree.
   */
  labelFa?: string;
  /** The field whose formatted value fills the value cell. */
  key: string;
}

export interface ContractFieldTable {
  /** The wizard step that owns these fields. */
  stepId: string;
  /** Caption printed above the table. */
  captionFa: string;
  /** Two headers: the label column and the value column. */
  columnsFa: [string, string];
  /** Rows in print order. */
  rows: ContractFieldTableRow[];
}

/** A document the contract expects, with whether it blocks signing. */
export interface RequiredDocumentDefinition {
  category: ContractDocumentCategory;
  labelFa: string;
  /** When true, the contract cannot be signed without it. */
  required: boolean;
  /** Which party is expected to provide it. */
  provider: "initiator" | "counterparty" | "either";
}

/**
 * The registration policy for a contract type. This is data, not
 * code — the `RegistrationPolicyEngine` evaluates it. It exists so
 * that "Legalier finalized the contract" is never conflated with
 * "official ownership transfer completed".
 */
export interface RegistrationPolicy {
  /** Whether official registration is legally required for this type. */
  officialRegistrationRequired: boolean;
  /** Whether the parties may optionally register. */
  officialRegistrationOptional: boolean;
  /** Persian explanation shown to the user at finalize time. */
  explanationFa: string;
  /** The state the contract lands in after signing. */
  postSignState: "READY_FOR_OFFICIAL_REGISTRATION" | "FINALIZED";
}

/**
 * The electronic-signature policy for a contract type. Data, not code:
 * the sign route reads it to decide whether «تأیید و امضای الکترونیکی»
 * may be offered online at all. A notary-restricted type (a sale whose
 * ownership only moves at a notary office) may still be signed online,
 * but the policy marks it as needing a legal review before that is
 * enabled in a jurisdiction, and the UI surfaces the note.
 */
export interface SigningPolicy {
  /** Whether a signature may be given online for this type. */
  onlineSigningAllowed: boolean;
  /** Whether the official LEGALIR stamp needs Super-Admin sign-off. */
  officialStampRequired: boolean;
  /**
   * Whether this type's online signing is gated on a legal approval
   * because a notary/registration step is mandatory (sale, vehicle…).
   */
  requiresLegalApprovalForOnlineSigning: boolean;
  /** Persian note shown beside the signing options. */
  noteFa: string;
}

/** The policy used when a type does not declare one. */
export const DEFAULT_SIGNING_POLICY: SigningPolicy = {
  onlineSigningAllowed: true,
  officialStampRequired: false,
  requiresLegalApprovalForOnlineSigning: false,
  noteFa:
    "این امضا «تأیید و امضای الکترونیکی» است و جایگزین امضای دستی نیست؛ برای برخی قراردادها ثبت رسمی در دفتر اسناد رسمی الزامی است.",
};

export interface ContractDefinition<TData = ContractDomainData> {
  id: ContractTypeId;
  domain: ContractDomain;
  /** True when the type is fully implemented and shippable. */
  implemented: boolean;
  typeFa: string;
  categoryFa: string;
  descriptionFa: string;
  /**
   * The specific call to action on the template card — «تنظیم قرارداد
   * اجاره», not a generic «شروع». It names the exact document the user
   * is about to build, so the card answers "what happens if I click?".
   */
  ctaFa: string;
  /**
   * Extra Persian terms that should match this type in the Contracts
   * page search — synonyms and everyday words a user might type
   * («اجاره», «مستأجر», «خودرو», «محرمانگی»). The search normalises
   * both sides, so these need no diacritics or ZWNJ handling.
   */
  keywords: string[];
  /**
   * Marks a recently added contract type. Drives the «جدید» badge on the
   * template card — the UI never infers "new" from the title.
   */
  isNew?: boolean;
  /** Icon key rendered in the Contract Center. */
  icon: string;
  /** Tailwind gradient classes for the type card. */
  gradient: string;
  /** Bump when the domain data shape changes. */
  schemaVersion: number;
  /** Bump when the clause template changes. */
  templateVersion: string;
  /** The party roles this contract type involves. */
  roles: PartyRole[];
  /** The role the initiating user plays by default. */
  defaultInitiatorRole: PartyRole;
  /** Ordered wizard steps. */
  wizardSteps: WizardStepDescriptor[];
  /** Sections used for completeness scoring. */
  sections: ContractSectionDefinition[];
  /**
   * Field descriptors for schema-driven types. Property types render
   * bespoke step components and leave this empty; every other type is
   * rendered entirely from this list by the generic `SchemaStep`.
   */
  fields: ContractFieldDescriptor[];
  /**
   * Optional semantic tables for the rendered document. When present, the
   * listed fields print inside a named table (with its own headers) instead
   * of the generic label/value list; fields not listed keep the default
   * treatment. This is how a type gives its answers a document structure.
   */
  fieldTables?: ContractFieldTable[];
  /** Documents the contract expects. */
  requiredDocuments: RequiredDocumentDefinition[];
  /** Registration policy — never hard-coded in the UI. */
  registrationPolicy: RegistrationPolicy;
  /**
   * Electronic-signature policy. Optional — a type that omits it falls
   * back to `DEFAULT_SIGNING_POLICY`, so the policy layer stays
   * data-driven and a new type needs no imperative code.
   */
  signingPolicy?: SigningPolicy;
  /** Build a fresh, empty domain data object. */
  createDefaultData: (propertyKind: PropertyKind) => TData;
}

// ------------------------------------------------------------
// Shared defaults
// ------------------------------------------------------------

const EMPTY_ADDRESS = {
  province: "",
  city: "",
  district: "",
  neighborhood: "",
  street: "",
  alley: "",
  plaque: "",
  floor: "",
  unit: "",
  postalCode: "",
};

const EMPTY_DEED = {
  deedType: "single_page" as const,
  uniqueDeedId: "",
  deedNumber: "",
  serialNumber: "",
  mainPlaque: "",
  subPlaque: "",
  registrationDistrict: "",
  parcel: "",
  registrationZone: "",
  officialArea: null,
  ownerName: "",
  deedDate: null,
};

const EMPTY_GENERAL = {
  area: null,
  buildYear: null,
  floor: null,
  unitNumber: "",
  totalFloors: null,
  totalUnits: null,
  unitsPerFloor: null,
  bedrooms: null,
  orientation: "",
  renovationStatus: "",
  occupancyStatus: "",
};

const EMPTY_AMENITIES = {
  hasParking: false,
  parkingKind: null,
  parkingNumber: "",
  parkingFloor: "",
  hasStorage: false,
  storageNumber: "",
  storageArea: null,
  hasElevator: false,
  hasBalcony: false,
  balconyArea: null,
  restroomKind: null,
  restroomCount: null,
  bathroomCount: null,
  hasMasterBathroom: false,
  kitchenKind: null,
  kitchenCabinet: "",
  hasHood: false,
  hasStove: false,
  hasOven: false,
  hasDishwasher: false,
  heating: [] as string[],
  cooling: [] as string[],
  utilities: {
    water: "independent" as const,
    electricity: "independent" as const,
    gas: "independent" as const,
    telephone: "independent" as const,
    internet: "independent" as const,
  },
};

/** The default handover checklist, shared by rent and sale. */
export const DEFAULT_HANDOVER_ITEMS: { key: string; labelFa: string }[] = [
  { key: "walls", labelFa: "دیوارها و رنگ" },
  { key: "floor", labelFa: "کفپوش" },
  { key: "ceiling", labelFa: "سقف" },
  { key: "doors", labelFa: "درب‌ها و قفل" },
  { key: "windows", labelFa: "پنجره‌ها و شیشه" },
  { key: "kitchen", labelFa: "کابینت و صفحه کابینت" },
  { key: "bathroom", labelFa: "سرویس بهداشتی" },
  { key: "package", labelFa: "پکیج / موتورخانه" },
  { key: "electrical", labelFa: "تأسیسات برقی" },
  { key: "plumbing", labelFa: "تأسیسات آب و فاضلاب" },
];

export const DEFAULT_HANDOVER_METERS: { key: "electricity" | "gas" | "water"; labelFa: string }[] = [
  { key: "electricity", labelFa: "کنتور برق" },
  { key: "gas", labelFa: "کنتور گاز" },
  { key: "water", labelFa: "کنتور آب" },
];

export const DEFAULT_HANDOVER_KEYS: { key: string; labelFa: string }[] = [
  { key: "unit", labelFa: "کلید واحد" },
  { key: "building", labelFa: "کلید ساختمان" },
  { key: "parking", labelFa: "کلید پارکینگ" },
  { key: "storage", labelFa: "کلید انبار" },
  { key: "mailbox", labelFa: "کلید صندوق پست" },
];

function emptyHandover() {
  return {
    items: DEFAULT_HANDOVER_ITEMS.map((i) => ({
      key: i.key,
      labelFa: i.labelFa,
      state: "unrecorded" as const,
      note: "",
    })),
    meters: DEFAULT_HANDOVER_METERS.map((m) => ({
      key: m.key,
      labelFa: m.labelFa,
      meterNumber: "",
      value: "",
      photoDocumentId: null,
    })),
    keys: DEFAULT_HANDOVER_KEYS.map((k) => ({
      key: k.key,
      labelFa: k.labelFa,
      count: 0,
    })),
    notes: "",
  };
}

/**
 * The step immediately before review, shared by EVERY contract type.
 *
 * It captures three different things and keeps them apart: a free-form
 * note about the whole contract, the parties' extra agreed terms, and
 * requested changes tied to a section. None of it ever overwrites an
 * operative clause or an identity field — the template prints agreed
 * terms as their own clause and requests in a clearly non-operative
 * annex. The step is optional, so it contributes no completeness
 * section and can never block the review.
 */
const SUPPLEMENTARY_STEP: WizardStepDescriptor = {
  id: "supplementary",
  titleFa: "اطلاعات تکمیلی و تغییرات",
  descriptionFa: "یادداشت، توافقات خاص و درخواست تغییر — پیش از پیش‌نمایش",
  sections: [],
};

// ------------------------------------------------------------
// Property / Rent
// ------------------------------------------------------------

const RENT_STEPS: WizardStepDescriptor[] = [
  {
    id: "parties",
    titleFa: "طرفین قرارداد",
    descriptionFa: "مشخصات موجر و مستأجر و مدارک هویتی",
    sections: ["parties"],
  },
  {
    id: "property",
    titleFa: "مشخصات ملک",
    descriptionFa: "نشانی، متراژ، امکانات و وضعیت ملک",
    sections: ["property"],
  },
  {
    id: "ownership",
    titleFa: "مالکیت و سند",
    descriptionFa: "وضعیت سند مالکیت و اختیار موجر",
    sections: ["ownership"],
  },
  {
    id: "financial",
    titleFa: "شرایط مالی",
    descriptionFa: "ودیعه، اجاره‌بها و نحوه پرداخت",
    sections: ["financial"],
  },
  {
    id: "obligations",
    titleFa: "تعهدات و شرایط",
    descriptionFa: "پرداخت هزینه‌ها، قواعد استفاده و فسخ",
    sections: ["obligations"],
  },
  {
    id: "handover",
    titleFa: "تحویل ملک",
    descriptionFa: "وضعیت ملک، کنتورها و کلیدها",
    sections: ["handover"],
  },
  {
    id: "documents",
    titleFa: "مدارک",
    descriptionFa: "بارگذاری مدارک لازم",
    sections: ["documents"],
  },
  SUPPLEMENTARY_STEP,
  {
    id: "review",
    titleFa: "بازبینی و پیش‌نمایش",
    descriptionFa: "متن نهایی قرارداد را بررسی کنید",
    sections: [],
  },
];

const RENT_SECTIONS: ContractSectionDefinition[] = [
  {
    key: "parties",
    labelFa: "طرفین قرارداد",
    stepId: "parties",
    requiredPaths: ["parties"],
  },
  {
    key: "property",
    labelFa: "مشخصات ملک",
    stepId: "property",
    requiredPaths: [
      "data.address.province",
      "data.address.city",
      "data.address.street",
      "data.general.area",
      "data.propertyKind",
    ],
  },
  {
    key: "ownership",
    labelFa: "مالکیت و سند",
    stepId: "ownership",
    requiredPaths: ["data.deed.deedType", "data.deed.ownerName"],
  },
  {
    key: "financial",
    labelFa: "شرایط مالی",
    stepId: "financial",
    requiredPaths: ["data.terms.agreementKind", "data.durations.startDate", "data.durations.endDate"],
  },
  {
    key: "obligations",
    labelFa: "تعهدات و شرایط",
    stepId: "obligations",
    requiredPaths: ["data.costs.water", "data.usageRules.residentialOnly"],
  },
  {
    key: "handover",
    labelFa: "تحویل ملک",
    stepId: "handover",
    requiredPaths: ["data.handover.items"],
  },
  {
    key: "documents",
    labelFa: "مدارک",
    stepId: "documents",
    requiredPaths: ["documents"],
  },
];

const RENT_DOCUMENTS: RequiredDocumentDefinition[] = [
  { category: "deed", labelFa: "سند مالکیت ملک", required: true, provider: "initiator" },
  { category: "landlord_id", labelFa: "کارت ملی موجر", required: true, provider: "initiator" },
  { category: "tenant_id", labelFa: "کارت ملی مستأجر", required: true, provider: "counterparty" },
  { category: "electricity_bill", labelFa: "قبض برق", required: false, provider: "either" },
  { category: "water_bill", labelFa: "قبض آب", required: false, provider: "either" },
  { category: "gas_bill", labelFa: "قبض گاز", required: false, provider: "either" },
  { category: "handover_photo", labelFa: "تصاویر وضعیت ملک", required: false, provider: "either" },
];

function createRentData(propertyKind: PropertyKind): PropertyRentData {
  return {
    schemaVersion: 1,
    propertyKind,
    usage: "residential",
    address: { ...EMPTY_ADDRESS },
    deed: { ...EMPTY_DEED },
    general: { ...EMPTY_GENERAL },
    amenities: { ...EMPTY_AMENITIES, utilities: { ...EMPTY_AMENITIES.utilities } },
    villa: null,
    durations: {
      contractDate: null,
      startDate: null,
      handoverDate: null,
      endDate: null,
      durationMonths: null,
    },
    terms: {
      agreementKind: "deposit_and_rent",
      securityDeposit: { amount: 0, currency: "IRR" },
      monthlyRent: { amount: 0, currency: "IRR" },
      rentDueDay: null,
      landlordAccount: "",
      hasLatePenalty: false,
      latePenaltyPeriod: null,
      latePenaltyAmount: null,
      depositInstalments: false,
    },
    costs: {
      water: "tenant",
      electricity: "tenant",
      gas: "tenant",
      telephone: "tenant",
      internet: "tenant",
      buildingCharge: "tenant",
      currentExpenses: "tenant",
      majorRepairs: "landlord",
      utilityFailures: "landlord",
      misuseDamage: "tenant",
    },
    usageRules: {
      residentialOnly: true,
      allowChangeOfUse: false,
      allowSublet: false,
      allowPets: false,
      allowStructuralChanges: false,
      allowFacadeEquipment: false,
      parkingTerms: "",
      commonAreaTerms: "",
      maintenanceTerms: "",
      commonAreaDamageLiability: "",
    },
    termination: {
      grounds: {
        nonPayment: true,
        latePayment: true,
        unauthorizedUse: true,
        sublet: true,
        propertyDamage: true,
        earlyVacation: true,
        failureToVacate: true,
      },
      evictionPenaltyPeriod: null,
      evictionPenaltyAmount: null,
      depositReturnTerms: "",
      depositReturnTiming: "",
    },
    handover: emptyHandover(),
    customClauses: [],
  };
}

// ------------------------------------------------------------
// Property / Sale
// ------------------------------------------------------------

const SALE_STEPS: WizardStepDescriptor[] = [
  {
    id: "parties",
    titleFa: "طرفین معامله",
    descriptionFa: "مشخصات فروشنده و خریدار",
    sections: ["parties"],
  },
  {
    id: "property",
    titleFa: "مشخصات ملک",
    descriptionFa: "نشانی، متراژ و امکانات ملک",
    sections: ["property"],
  },
  {
    id: "ownership",
    titleFa: "مالکیت و وضعیت حقوقی",
    descriptionFa: "سند، رهن، بازداشت، وام و مستأجر",
    sections: ["ownership"],
  },
  {
    id: "financial",
    titleFa: "قیمت و نحوه پرداخت",
    descriptionFa: "ثمن معامله و برنامه پرداخت",
    sections: ["financial"],
  },
  {
    id: "registration",
    titleFa: "دفترخانه و ثبت رسمی",
    descriptionFa: "زمان، مکان و مدارک ثبت سند",
    sections: ["registration"],
  },
  {
    id: "obligations",
    titleFa: "تعهدات و جرائم",
    descriptionFa: "وجه التزام‌ها و تعهدات طرفین",
    sections: ["obligations"],
  },
  {
    id: "handover",
    titleFa: "تحویل ملک",
    descriptionFa: "وضعیت ملک، کنتورها و کلیدها",
    sections: ["handover"],
  },
  {
    id: "documents",
    titleFa: "مدارک",
    descriptionFa: "بارگذاری مدارک لازم",
    sections: ["documents"],
  },
  SUPPLEMENTARY_STEP,
  {
    id: "review",
    titleFa: "بازبینی و پیش‌نمایش",
    descriptionFa: "متن نهایی قرارداد را بررسی کنید",
    sections: [],
  },
];

const SALE_SECTIONS: ContractSectionDefinition[] = [
  { key: "parties", labelFa: "طرفین معامله", stepId: "parties", requiredPaths: ["parties"] },
  {
    key: "property",
    labelFa: "مشخصات ملک",
    stepId: "property",
    requiredPaths: [
      "data.address.province",
      "data.address.city",
      "data.address.street",
      "data.general.area",
      "data.propertyKind",
    ],
  },
  {
    key: "ownership",
    labelFa: "مالکیت و وضعیت حقوقی",
    stepId: "ownership",
    requiredPaths: [
      "data.deed.deedType",
      "data.deed.ownerName",
      "data.legalStatus.inMortgage",
      "data.legalStatus.seized",
      "data.legalStatus.hasLoan",
      "data.legalStatus.occupiedByTenant",
    ],
  },
  {
    key: "financial",
    labelFa: "قیمت و پرداخت",
    stepId: "financial",
    requiredPaths: ["data.terms.totalPrice"],
  },
  {
    key: "registration",
    labelFa: "دفترخانه و ثبت رسمی",
    stepId: "registration",
    requiredPaths: ["data.registration.agreedDate", "data.registration.notaryCity"],
  },
  {
    key: "obligations",
    labelFa: "تعهدات و جرائم",
    stepId: "obligations",
    requiredPaths: ["data.obligations.priorDebtsBearer"],
  },
  {
    key: "handover",
    labelFa: "تحویل ملک",
    stepId: "handover",
    requiredPaths: ["data.handover.items"],
  },
  { key: "documents", labelFa: "مدارک", stepId: "documents", requiredPaths: ["documents"] },
];

const SALE_DOCUMENTS: RequiredDocumentDefinition[] = [
  { category: "deed", labelFa: "سند مالکیت ملک", required: true, provider: "initiator" },
  { category: "seller_id", labelFa: "کارت ملی فروشنده", required: true, provider: "initiator" },
  { category: "buyer_id", labelFa: "کارت ملی خریدار", required: true, provider: "counterparty" },
  { category: "completion_certificate", labelFa: "پایان‌کار", required: false, provider: "initiator" },
  { category: "partition_minutes", labelFa: "صورت‌مجلس تفکیکی", required: false, provider: "initiator" },
  { category: "mortgage_release", labelFa: "مدارک فک رهن", required: false, provider: "initiator" },
  { category: "check_image", labelFa: "تصویر چک‌ها", required: false, provider: "either" },
  { category: "handover_photo", labelFa: "تصاویر وضعیت ملک", required: false, provider: "either" },
];

function createSaleData(propertyKind: PropertyKind): PropertySaleData {
  return {
    schemaVersion: 1,
    propertyKind,
    usage: "residential",
    address: { ...EMPTY_ADDRESS },
    deed: { ...EMPTY_DEED },
    general: { ...EMPTY_GENERAL },
    amenities: { ...EMPTY_AMENITIES, utilities: { ...EMPTY_AMENITIES.utilities } },
    villa: null,
    legalStatus: {
      inMortgage: "unknown",
      mortgageDetails: "",
      seized: "unknown",
      hasLoan: "unknown",
      loanDetails: "",
      occupiedByTenant: "unknown",
      tenantLeaseEnd: null,
      tenantDeposit: null,
      transferRestricted: "unknown",
      restrictionDetails: "",
    },
    extras: {
      hasCompletionCertificate: false,
      completionCertificateNumber: "",
      completionCertificateDate: null,
      hasPartitionMinutes: false,
      buildingViolations: "",
      buildingDebt: null,
    },
    terms: {
      totalPrice: { amount: 0, currency: "IRR" },
      pricePerSqm: null,
      hasSchedule: false,
    },
    registration: {
      agreedDate: null,
      agreedTime: "",
      notaryOfficeNumber: "",
      notaryCity: "",
      notaryAddress: "",
      amountAtRegistration: null,
      documentsResponsible: "seller",
      requiredDocuments: [],
    },
    obligations: {
      sellerNoShowPenalty: null,
      handoverDelayPenalty: null,
      sellerMustReleaseMortgage: true,
      priorDebtsBearer: "seller",
      includedEquipment: "",
      otherTerms: "",
    },
    handover: emptyHandover(),
    customClauses: [],
  };
}

// ------------------------------------------------------------
// Schema-driven types (vehicle, finance, services, business)
// ------------------------------------------------------------
// These types share ONE data shape (`GenericContractData`) and ONE
// wizard step component. Everything that distinguishes them — the
// fields, the steps, the documents, the registration policy — is
// declared here as data. Adding a type is adding a definition.

/** Build a fresh, empty generic data object. */
function createGenericData(): GenericContractData {
  return { schemaVersion: 1, values: {}, customClauses: [] };
}

/** A field descriptor with the shared defaults applied. */
function field(
  stepId: string,
  key: string,
  labelFa: string,
  kind: ContractFieldKind,
  extra: Partial<ContractFieldDescriptor> = {}
): ContractFieldDescriptor {
  return { key, labelFa, kind, stepId, ...extra };
}

/**
 * True when a field's `requiredWhen` gate is satisfied by the current
 * values. A field with no gate always applies.
 *
 * This is the ONE definition of "this branch applies". The completeness
 * scorer and the document renderer both call it, so a field can never
 * block a section while still rendering an irrelevant blank line — or
 * vice versa.
 */
export function fieldConditionHolds(
  values: Record<string, unknown>,
  gate: ContractFieldDescriptor["requiredWhen"]
): boolean {
  if (!gate) return true;
  const current = values[gate.key];
  // The stored value is untyped at this level; the gate itself carries the
  // allowed literals from the field descriptor.
  if (gate.oneOf) return (gate.oneOf as unknown[]).includes(current);
  if (gate.equals !== undefined) return current === gate.equals;
  return true;
}

/** A wizard step descriptor for a schema-driven type. */
function step(
  id: string,
  titleFa: string,
  descriptionFa: string,
  sections: string[],
  bankingFor?: PartyRole
): WizardStepDescriptor {
  return bankingFor
    ? { id, titleFa, descriptionFa, sections, bankingFor }
    : { id, titleFa, descriptionFa, sections };
}

/**
 * Build the completeness sections for a schema-driven type from its
 * field list: one section per step, requiring every `required` field
 * that belongs to it. This keeps the section definitions and the field
 * list from ever drifting apart.
 */
function sectionsFromFields(
  steps: WizardStepDescriptor[],
  fields: ContractFieldDescriptor[]
): ContractSectionDefinition[] {
  return steps
    .filter((s) => s.sections.length > 0)
    .map((s) => {
      const requiredPaths = fields
        .filter((f) => f.stepId === s.id && (f.required || f.requiredWhen))
        .map((f) => `values.${f.key}`);
      // The parties and documents steps carry no field descriptors —
      // their requirement is the special "parties"/"documents" path the
      // completeness scorer resolves against the aggregate.
      if (s.id === "parties") requiredPaths.unshift("parties");
      if (s.id === "documents") requiredPaths.unshift("documents");
      // A payment step that declares its recipient also requires that
      // party's bank details, stored on the party record.
      if (s.bankingFor) requiredPaths.push(`banking.${s.bankingFor}`);
      return {
        key: s.id,
        labelFa: s.titleFa,
        stepId: s.id,
        requiredPaths,
      };
    });
}

/** The shared "review" step every schema-driven type ends with. */
const REVIEW_STEP: WizardStepDescriptor = {
  id: "review",
  titleFa: "بازبینی و پیش‌نمایش",
  descriptionFa: "متن نهایی قرارداد را بررسی کنید",
  sections: [],
};

// --- Vehicle / Sale -------------------------------------------------

const VEHICLE_STEPS: WizardStepDescriptor[] = [
  step("parties", "طرفین معامله", "مشخصات فروشنده و خریدار خودرو", ["parties"]),
  step("vehicle", "مشخصات خودرو", "نوع، مدل، رنگ و شماره‌های شناسایی خودرو", ["vehicle"]),
  step("financial", "مبلغ و نحوه پرداخت", "قیمت، پیش‌پرداخت، مراحل پرداخت و حساب فروشنده", ["financial"], "seller"),
  step("obligations", "تعهدات و شرایط", "تخلفات، خسارت و شرایط فسخ", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
  SUPPLEMENTARY_STEP,
  REVIEW_STEP,
];

const VEHICLE_FIELDS: ContractFieldDescriptor[] = [
  field("vehicle", "vehicleType", "نوع خودرو", "text", { required: true, placeholderFa: "مثلاً سواری، وانت" }),
  field("vehicle", "brand", "برند / سازنده", "text", { required: true, placeholderFa: "مثلاً ایران‌خودرو" }),
  field("vehicle", "model", "مدل (سال ساخت)", "number", { required: true }),
  field("vehicle", "color", "رنگ", "text", { required: true }),
  field("vehicle", "vin", "شماره شاسی (VIN)", "text", { required: true }),
  field("vehicle", "engineNumber", "شماره موتور", "text", { required: true }),
  field("vehicle", "plateNumber", "شماره پلاک", "text", { required: true }),
  field("vehicle", "bodyNumber", "شماره بدنه", "text"),
  field("vehicle", "mileage", "کارکرد (کیلومتر)", "number"),
  field("vehicle", "condition", "وضعیت سلامت خودرو", "select", {
    required: true,
    options: [
      { value: "healthy", labelFa: "سالم و بدون ایراد" },
      { value: "minor_flaws", labelFa: "دارای ایراد جزئی" },
      { value: "damaged", labelFa: "تصادفی / نیازمند تعمیر" },
    ],
  }),
  field("vehicle", "flawsDescription", "شرح ایرادات و توضیحات", "textarea", {
    helperFa: "در صورت وجود هر ایراد فنی یا ظاهری، با جزئیات ذکر کنید.",
  }),
  field("vehicle", "extras", "امکانات اضافه", "textarea", {
    helperFa: "مثلاً سیستم صوتی، رینگ غیرفابریک، چراغ اضافه.",
  }),
  field("financial", "totalPrice", "قیمت کل خودرو", "money", { required: true }),
  field("financial", "downPayment", "مبلغ پیش‌پرداخت", "money"),
  field("financial", "beforeTransferAmount", "مبلغ قابل پرداخت پیش از ثبت سند", "money"),
  field("financial", "afterPlateAmount", "مبلغ قابل پرداخت پس از تعویض پلاک", "money"),
  field("financial", "paymentMethod", "روش پرداخت", "select", {
    required: true,
    options: [
      { value: "cash", labelFa: "وجه نقد" },
      { value: "card_to_card", labelFa: "کارت به کارت" },
      { value: "bank_transfer", labelFa: "حواله بانکی" },
      { value: "check", labelFa: "چک" },
      { value: "instalments", labelFa: "اقساطی" },
    ],
  }),
  field("financial", "instalmentCount", "تعداد اقساط", "number", {
    helperFa: "در صورت پرداخت اقساطی تکمیل کنید.",
  }),
  field("financial", "accountNumber", "شماره حساب مقصد", "text"),
  field("obligations", "notaryDate", "تاریخ توافقی حضور در دفتر اسناد رسمی", "date"),
  field("obligations", "violationsBearer", "مسئول تخلفات تا تاریخ انتقال سند", "select", {
    required: true,
    options: [
      { value: "seller", labelFa: "فروشنده" },
      { value: "buyer", labelFa: "خریدار" },
    ],
  }),
  field("obligations", "damageLiability", "مسئول خسارت تا تاریخ انتقال سند", "select", {
    required: true,
    options: [
      { value: "seller", labelFa: "فروشنده" },
      { value: "buyer", labelFa: "خریدار" },
    ],
  }),
  field("obligations", "penaltyAmount", "وجه التزام عدم انجام تعهد", "money"),
  field("obligations", "terminationTerms", "شرایط فسخ قرارداد", "textarea"),
];

const VEHICLE_DOCUMENTS: RequiredDocumentDefinition[] = [
  { category: "seller_id", labelFa: "کارت ملی فروشنده", required: true, provider: "initiator" },
  { category: "buyer_id", labelFa: "کارت ملی خریدار", required: true, provider: "counterparty" },
  { category: "other", labelFa: "سند و کارت خودرو", required: true, provider: "initiator" },
  { category: "other", labelFa: "گزارش کارشناسی خودرو", required: false, provider: "either" },
  { category: "check_image", labelFa: "تصویر چک‌ها", required: false, provider: "either" },
];

// --- Finance / Debt -------------------------------------------------

const DEBT_STEPS: WizardStepDescriptor[] = [
  step("parties", "طرفین قرارداد", "مشخصات طلبکار و بدهکار", ["parties"]),
  step("loan", "مبلغ و شرایط قرض", "مبلغ، تاریخ، شرایط بازپرداخت و حساب طلبکار", ["loan"], "lender"),
  step("guarantee", "تضمین و ضامن", "ضمانت‌نامه و مشخصات ضامن", ["guarantee"]),
  step("obligations", "تعهدات و فسخ", "وجه التزام تأخیر و شرایط فسخ", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
  SUPPLEMENTARY_STEP,
  REVIEW_STEP,
];

const DEBT_FIELDS: ContractFieldDescriptor[] = [
  field("loan", "amount", "مبلغ قرض", "money", { required: true }),
  field("loan", "loanDate", "تاریخ پرداخت قرض", "date", { required: true }),
  field("loan", "dueDate", "تاریخ سررسید بازپرداخت", "date", { required: true }),
  field("loan", "repaymentMethod", "نحوه بازپرداخت", "select", {
    required: true,
    options: [
      { value: "lump_sum", labelFa: "یک‌جا در سررسید" },
      { value: "instalments", labelFa: "اقساطی" },
    ],
  }),
  field("loan", "instalmentCount", "تعداد اقساط", "number", {
    helperFa: "در صورت بازپرداخت اقساطی تکمیل کنید.",
  }),
  field("loan", "instalments", "برنامهٔ اقساط", "repeatable", {
    requiredWhen: { key: "repaymentMethod", equals: "instalments" },
    addLabelFa: "افزودن قسط",
    helperFa: "سررسید و مبلغ هر قسط را جداگانه ثبت کنید؛ هر ردیف یک ردیف جدول چاپی است.",
    columns: [
      { key: "dueDate", labelFa: "سررسید", kind: "date" },
      { key: "amount", labelFa: "مبلغ قسط", kind: "money" },
      { key: "note", labelFa: "توضیح", kind: "text" },
    ],
  }),
  field("loan", "purpose", "موضوع و علت قرض", "textarea"),
  field("guarantee", "hasGuarantor", "آیا ضامن دارد؟", "toggle"),
  field("guarantee", "guarantorName", "نام و نام خانوادگی ضامن", "text", {
    helperFa: "در صورت وجود ضامن تکمیل کنید.",
  }),
  field("guarantee", "guarantorNationalId", "کد ملی ضامن", "text"),
  field("guarantee", "collateral", "وثیقه / تضمین", "textarea", {
    helperFa: "مثلاً سفته، چک، سند ملک.",
  }),
  field("obligations", "latePenalty", "وجه التزام تأخیر در بازپرداخت", "money"),
  field("obligations", "terminationTerms", "شرایط فسخ قرارداد", "textarea"),
];

const DEBT_DOCUMENTS: RequiredDocumentDefinition[] = [
  { category: "landlord_id", labelFa: "کارت ملی طلبکار", required: true, provider: "initiator" },
  { category: "tenant_id", labelFa: "کارت ملی بدهکار", required: true, provider: "counterparty" },
  { category: "check_image", labelFa: "تصویر چک / سفته", required: false, provider: "either" },
  { category: "other", labelFa: "سند وثیقه", required: false, provider: "either" },
];

// --- Services / Freelance -------------------------------------------

const FREELANCE_STEPS: WizardStepDescriptor[] = [
  step("parties", "طرفین قرارداد", "مشخصات کارفرما و فریلنسر", ["parties"]),
  step("project", "موضوع پروژه", "شرح خدمات، خروجی و زمان‌بندی", ["project"]),
  step("financial", "دستمزد و پرداخت", "مبلغ، بیعانه، مراحل پرداخت و حساب فریلنسر", ["financial"], "freelancer"),
  step("obligations", "تعهدات و فسخ", "تعهدات طرفین و شرایط فسخ", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
  SUPPLEMENTARY_STEP,
  REVIEW_STEP,
];

const FREELANCE_FIELDS: ContractFieldDescriptor[] = [
  field("project", "projectTitle", "عنوان پروژه", "text", { required: true }),
  field("project", "scope", "شرح خدمات و خروجی‌ها", "textarea", { required: true }),
  field("project", "startDate", "تاریخ شروع", "date", { required: true }),
  field("project", "deliveryDate", "تاریخ تحویل", "date", { required: true }),
  field("project", "revisionCount", "تعداد بازبینی مجاز", "number"),
  field("financial", "fee", "دستمزد کل", "money", { required: true }),
  field("financial", "advancePayment", "بیعانه", "money"),
  field("financial", "paymentMethod", "روش پرداخت", "select", {
    required: true,
    options: [
      { value: "bank_transfer", labelFa: "انتقال بانکی" },
      { value: "card_to_card", labelFa: "کارت به کارت" },
      { value: "cash", labelFa: "وجه نقد" },
    ],
  }),
  field("financial", "accountNumber", "شماره حساب فریلنسر", "text"),
  field("obligations", "confidentiality", "تعهد محرمانگی", "toggle"),
  field("obligations", "ipOwnership", "مالکیت معنوی خروجی", "select", {
    required: true,
    options: [
      { value: "client", labelFa: "کارفرما" },
      { value: "freelancer", labelFa: "فریلنسر" },
      { value: "shared", labelFa: "مشترک" },
    ],
  }),
  field("obligations", "latePenalty", "وجه التزام تأخیر در تحویل", "money"),
  field("obligations", "terminationTerms", "شرایط فسخ قرارداد", "textarea"),
];

const FREELANCE_DOCUMENTS: RequiredDocumentDefinition[] = [
  { category: "seller_id", labelFa: "کارت ملی کارفرما", required: true, provider: "initiator" },
  { category: "buyer_id", labelFa: "کارت ملی فریلنسر", required: true, provider: "counterparty" },
  { category: "other", labelFa: "نمونه کار / پیشنهادیه", required: false, provider: "either" },
];

// --- Business / NDA -------------------------------------------------

const NDA_STEPS: WizardStepDescriptor[] = [
  step("parties", "طرفین قرارداد", "مشخصات افشاکننده و دریافت‌کننده", ["parties"]),
  step("scope", "موضوع و دامنه محرمانگی", "هدف افشا و دسته‌های اطلاعات محرمانه", ["scope"]),
  step("terms", "مدت و استثناها", "مدت اعتبار و موارد مستثنی", ["terms"]),
  step("obligations", "تعهدات و ضمانت اجرا", "تعهدات طرفین و وجه التزام نقض", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
  SUPPLEMENTARY_STEP,
  REVIEW_STEP,
];

const NDA_FIELDS: ContractFieldDescriptor[] = [
  field("scope", "ndaKind", "نوع توافق محرمانگی", "select", {
    required: true,
    options: [
      { value: "unilateral", labelFa: "یک‌طرفه" },
      { value: "bilateral", labelFa: "دوجانبه" },
    ],
  }),
  field("scope", "purpose", "هدف از افشای اطلاعات", "textarea", { required: true }),
  field("scope", "confidentialCategories", "دسته‌های اطلاعات محرمانه", "textarea", {
    required: true,
    helperFa: "مثلاً فهرست مشتریان، قیمت‌گذاری، کد منبع، برنامه محصول.",
  }),
  field("terms", "startDate", "تاریخ شروع اعتبار", "date", { required: true }),
  field("terms", "durationMonths", "مدت اعتبار قرارداد (ماه)", "number", { required: true }),
  field("terms", "survivalMonths", "مدت بقای تعهد پس از خاتمه (ماه)", "number", {
    helperFa: "مدت ادامه تعهد عدم افشا پس از پایان همکاری.",
  }),
  field("terms", "exclusions", "موارد مستثنی از محرمانگی", "textarea", {
    helperFa: "اطلاعات عمومی، اطلاعات پیشین، دریافت از ثالث مجاز، افشای اجباری قانونی.",
  }),
  field("obligations", "returnOrDestroy", "روش بازگرداندن یا امحای اطلاعات", "select", {
    required: true,
    options: [
      { value: "return", labelFa: "بازگرداندن" },
      { value: "destroy", labelFa: "امحا با گواهی" },
      { value: "either", labelFa: "به انتخاب افشاکننده" },
    ],
  }),
  field("obligations", "penaltyAmount", "وجه التزام نقض تعهد", "money"),
  field("obligations", "governingLaw", "قانون حاکم", "select", {
    required: true,
    options: [
      { value: "iran", labelFa: "قوانین جمهوری اسلامی ایران" },
      { value: "other", labelFa: "سایر" },
    ],
  }),
  field("obligations", "disputeResolution", "مرجع حل اختلاف", "textarea", {
    helperFa: "مثلاً مذاکره، داوری مرکز داوری اتاق بازرگانی، مراجع قضایی.",
  }),
];

const NDA_DOCUMENTS: RequiredDocumentDefinition[] = [
  { category: "seller_id", labelFa: "کارت ملی / شناسه افشاکننده", required: true, provider: "initiator" },
  { category: "buyer_id", labelFa: "کارت ملی / شناسه دریافت‌کننده", required: true, provider: "counterparty" },
  { category: "other", labelFa: "فهرست تحویل اطلاعات محرمانه", required: false, provider: "either" },
];

// --- Business / SaaS ------------------------------------------------

const SAAS_STEPS: WizardStepDescriptor[] = [
  step("parties", "طرفین قرارداد", "مشخصات ارائه‌دهنده و مشتری", ["parties"]),
  step("service", "خدمت و سطح سرویس", "شرح سرویس، دسترس‌پذیری و پشتیبانی", ["service"]),
  step("financial", "اشتراک و پرداخت", "مبلغ اشتراک، دوره، روش پرداخت و حساب ارائه‌دهنده", ["financial"], "provider"),
  step("data", "داده و محرمانگی", "مالکیت داده، بازگرداندن و محرمانگی", ["data"]),
  step("obligations", "تعهدات و فسخ", "تعهدات طرفین، SLA و شرایط فسخ", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
  SUPPLEMENTARY_STEP,
  REVIEW_STEP,
];

const SAAS_FIELDS: ContractFieldDescriptor[] = [
  field("service", "serviceName", "نام سرویس / نرم‌افزار", "text", { required: true }),
  field("service", "serviceDescription", "شرح خدمت ارائه‌شده", "textarea", { required: true }),
  field("service", "availabilitySla", "تضمین دسترس‌پذیری (٪)", "number", {
    required: true,
    helperFa: "مثلاً ۹۹ درصد.",
  }),
  field("service", "supportHours", "ساعات پشتیبانی", "text", { required: true }),
  field("service", "dataCenterLocation", "محل مرکز داده", "text"),
  field("financial", "subscriptionFee", "مبلغ اشتراک", "money", { required: true }),
  field("financial", "billingPeriod", "دوره صورت‌حساب", "select", {
    required: true,
    options: [
      { value: "monthly", labelFa: "ماهانه" },
      { value: "quarterly", labelFa: "سه‌ماهه" },
      { value: "yearly", labelFa: "سالانه" },
    ],
  }),
  field("financial", "userCount", "تعداد کاربران مجاز", "number"),
  field("financial", "paymentMethod", "روش پرداخت", "select", {
    required: true,
    options: [
      { value: "bank_transfer", labelFa: "انتقال بانکی" },
      { value: "card", labelFa: "کارت بانکی" },
    ],
  }),
  field("data", "dataOwnership", "مالکیت داده‌های مشتری", "select", {
    required: true,
    options: [
      { value: "customer", labelFa: "مشتری" },
      { value: "provider", labelFa: "ارائه‌دهنده" },
    ],
  }),
  field("data", "dataReturnMethod", "روش بازگرداندن داده پس از خاتمه", "textarea", {
    required: true,
    helperFa: "قالب و شیوه تحویل داده‌ها به مشتری.",
  }),
  field("data", "confidentiality", "تعهد محرمانگی اطلاعات", "toggle"),
  field("obligations", "ipOwnership", "مالکیت فکری نرم‌افزار", "select", {
    required: true,
    options: [
      { value: "provider", labelFa: "ارائه‌دهنده" },
      { value: "customer", labelFa: "مشتری" },
    ],
  }),
  field("obligations", "uptimePenalty", "جریمه عدم تحقق SLA", "money"),
  field("obligations", "terminationNoticeDays", "مدت اطلاع پیش از فسخ (روز)", "number"),
  field("obligations", "terminationTerms", "شرایط فسخ قرارداد", "textarea"),
];

const SAAS_DOCUMENTS: RequiredDocumentDefinition[] = [
  { category: "seller_id", labelFa: "شناسه / کارت ملی ارائه‌دهنده", required: true, provider: "initiator" },
  { category: "buyer_id", labelFa: "شناسه / کارت ملی مشتری", required: true, provider: "counterparty" },
  { category: "other", labelFa: "سند SLA و سیاست حریم خصوصی", required: false, provider: "initiator" },
];

// --- Business / Startup ---------------------------------------------

const STARTUP_STEPS: WizardStepDescriptor[] = [
  step("parties", "بنیان‌گذاران و شرکا", "مشخصات بنیان‌گذاران و سرمایه‌گذاران", ["parties"]),
  step("company", "شرکت و نقش‌ها", "نام شرکت، نوع و نقش هر شریک", ["company"]),
  step("equity", "سهام و سرمایه", "سرمایه اولیه، درصد سهام و vesting", ["equity"]),
  step("governance", "مدیریت و تصمیم‌گیری", "نحوه تصمیم‌گیری و تقسیم سود و زیان", ["governance"]),
  step("exit", "خروج و انحلال", "شرایط خروج شریک و انحلال شرکت", ["exit"]),
  step("obligations", "محرمانگی و حل اختلاف", "عدم رقابت، مالکیت معنوی و حل اختلاف", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
  SUPPLEMENTARY_STEP,
  REVIEW_STEP,
];

const STARTUP_FIELDS: ContractFieldDescriptor[] = [
  field("company", "companyName", "نام شرکت / استارتاپ", "text", { required: true }),
  field("company", "companyType", "نوع شرکت", "select", {
    required: true,
    options: [
      { value: "llc", labelFa: "با مسئولیت محدود" },
      { value: "joint_stock", labelFa: "سهامی خاص" },
      { value: "cooperative", labelFa: "تعاونی" },
      { value: "not_registered", labelFa: "هنوز ثبت نشده" },
    ],
  }),
  field("company", "startupSummary", "توضیح مختصر استارتاپ", "textarea", { required: true }),
  field("company", "startDate", "تاریخ شروع قرارداد", "date", { required: true }),
  field("company", "roles", "نقش و مسئولیت هر شریک", "textarea", {
    required: true,
    helperFa: "مثلاً مدیرعامل، مدیر فنی، مدیر بازاریابی.",
  }),
  field("equity", "initialCapital", "سرمایه اولیه", "money", { required: true }),
  field("equity", "capitalKind", "نوع مشارکت مالی", "select", {
    required: true,
    options: [
      { value: "cash", labelFa: "نقدی" },
      { value: "equipment", labelFa: "تجهیزات" },
      { value: "ip", labelFa: "مالکیت معنوی" },
      { value: "mixed", labelFa: "ترکیبی" },
    ],
  }),
  field("equity", "shareSplit", "درصد سهام هر شریک", "textarea", {
    required: true,
    helperFa: "درصد سهام هر بنیان‌گذار را دقیق ذکر کنید.",
  }),
  field("equity", "hasVesting", "آیا شرایط vesting دارد؟", "toggle"),
  field("equity", "vestingTerms", "شرایط vesting", "textarea", {
    helperFa: "در صورت فعال بودن vesting تکمیل کنید.",
  }),
  field("governance", "decisionMaking", "نحوه تصمیم‌گیری", "select", {
    required: true,
    options: [
      { value: "consensus", labelFa: "اجماع" },
      { value: "majority", labelFa: "رأی اکثریت" },
      { value: "weighted", labelFa: "بر اساس درصد سهام" },
    ],
  }),
  field("governance", "profitLossSplit", "نحوه تقسیم سود و زیان", "textarea", { required: true }),
  field("exit", "exitTerms", "شرایط خروج شریک", "textarea", { required: true }),
  field("exit", "shareTransferTerms", "شرایط انتقال سهام", "textarea"),
  field("exit", "dissolutionTerms", "شرایط انحلال شرکت", "textarea"),
  field("obligations", "confidentiality", "تعهد محرمانگی", "toggle"),
  field("obligations", "nonCompete", "شرط عدم رقابت", "toggle"),
  field("obligations", "ipOwnership", "مالکیت معنوی دستاوردها", "select", {
    required: true,
    options: [
      { value: "company", labelFa: "شرکت" },
      { value: "founders", labelFa: "بنیان‌گذاران" },
    ],
  }),
  field("obligations", "disputeResolution", "نحوه حل اختلاف", "textarea", { required: true }),
];

const STARTUP_DOCUMENTS: RequiredDocumentDefinition[] = [
  { category: "seller_id", labelFa: "کارت ملی بنیان‌گذاران", required: true, provider: "initiator" },
  { category: "buyer_id", labelFa: "کارت ملی سرمایه‌گذار", required: true, provider: "counterparty" },
  { category: "other", labelFa: "اساسنامه / روزنامه رسمی", required: false, provider: "initiator" },
];

// --- Employment / Labor ---------------------------------------------
// «قرارداد کار» per the Iranian Labor Code (قانون کار جمهوری اسلامی ایران).
// Nine data steps plus the shared review step; the whole contract is
// rendered from the field list below by the generic `SchemaStep`, exactly
// like the other schema-driven types. Conditional requirements
// (`requiredWhen`) mirror the natural/legal-person employer split and the
// Iranian/foreign-national employee split, so the completeness scorer asks
// for the branch the user actually chose.

// Identity (name, national id / passport, address, mobile, employer kind
// and employee nationality) is recorded ONCE in the shared `parties`
// step. These steps therefore start with the deal terms — never a
// second copy of the same person's identity.

const EMPLOYMENT_STEPS: WizardStepDescriptor[] = [
  step(
    "parties",
    "طرفین قرارداد و نماینده",
    "کارفرمای حقیقی یا حقوقی، نمایندهٔ قانونی او و کارگر با تعیین تابعیت",
    ["parties"]
  ),
  step("job", "شغل و وظایف", "عنوان شغل، شرح وظایف، محل انجام کار و مدرک تحصیلی", ["job"]),
  step("term", "مدت و دورهٔ آزمایشی", "نوع قرارداد، تاریخ شروع و پایان و دورهٔ آزمایشی", ["term"]),
  step(
    "wages",
    "دستمزد، مزایا و پرداخت",
    "حقوق پایه، مزایا، نحوهٔ پرداخت و حساب بانکی دریافت‌کننده",
    ["wages"],
    "employee"
  ),
  step("hours", "ساعات کار و مرخصی", "ساعات کار هفتگی، تعطیلات و مرخصی", ["hours"]),
  step("insurance", "بیمه و مالیات", "تعهدات کارفرما در قبال تأمین اجتماعی و مالیات", ["insurance"]),
  step("obligations", "تعهدات و شروط خاص", "تعهدات متقابل، محرمانگی و شروط توافق‌شده", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
  SUPPLEMENTARY_STEP,
  REVIEW_STEP,
];

const EMPLOYMENT_FIELDS: ContractFieldDescriptor[] = [
  // --- شغل و وظایف ---
  field("job", "jobTitle", "عنوان شغل", "text", { required: true, placeholderFa: "مثلاً کارشناس حسابداری" }),
  field("job", "jobDuties", "شرح وظایف", "textarea", {
    required: true,
    helperFa: "مهم‌ترین وظایف و مسئولیت‌ها را فهرست کنید.",
  }),
  field("job", "jobWorkplace", "محل انجام کار", "text", { required: true }),
  field("job", "jobDepartment", "واحد / دپارتمان", "text"),
  field("job", "jobSupervisor", "سرپرست مستقیم", "text"),
  field("job", "employeeEducation", "آخرین مدرک تحصیلی کارگر", "text"),

  // --- مدت و دورهٔ آزمایشی ---
  field("term", "contractType", "نوع قرارداد", "select", {
    required: true,
    options: [
      { value: "definite", labelFa: "مدت موقت (معین)" },
      { value: "indefinite", labelFa: "مدت نامحدود (غیرموقت)" },
      { value: "task_based", labelFa: "برای انجام کار معین" },
    ],
    helperFa: "مطابق ماده ۷ قانون کار، قرارداد می‌تواند برای مدت موقت یا غیرموقت باشد.",
  }),
  field("term", "startDate", "تاریخ شروع قرارداد", "date", { required: true }),
  field("term", "endDate", "تاریخ پایان قرارداد", "date", {
    requiredWhen: { key: "contractType", oneOf: ["definite", "task_based"] },
  }),
  field("term", "probationMonths", "مدت دورهٔ آزمایشی (ماه)", "number", {
    helperFa: "دورهٔ آزمایشی طبق قانون کار تعیین می‌شود؛ مدت توافق‌شده را با احتیاط و مطابق مقررات وارد کنید.",
  }),
  field("term", "probationNote", "توضیح دورهٔ آزمایشی", "textarea", {
    helperFa: "شرایط تأیید یا خاتمهٔ همکاری در دورهٔ آزمایشی.",
  }),

  // --- دستمزد و مزایا ---
  field("wages", "baseSalary", "حقوق پایهٔ ماهانه", "money", {
    required: true,
    helperFa: "نباید از حداقل مزد مصوب شورای عالی کار (سال مربوط) کمتر باشد.",
  }),
  field("wages", "wagePeriod", "دورهٔ پرداخت دستمزد", "select", {
    required: true,
    options: [
      { value: "monthly", labelFa: "ماهانه" },
      { value: "daily", labelFa: "روزانه" },
      { value: "weekly", labelFa: "هفتگی" },
      { value: "hourly", labelFa: "ساعتی" },
      { value: "piece", labelFa: "کارمزدی (بر اساس تولید)" },
    ],
    helperFa: "روش پرداخت دستمزد را مطابق توافق طرفین و مقررات قانون کار انتخاب کنید.",
  }),
  field("wages", "paymentDay", "روز پرداخت در هر ماه", "number", {
    helperFa: "طبق قانون کار، دستمزد ماهانه در پایان ماه پرداخت می‌شود.",
  }),
  field("wages", "housingAllowance", "حق مسکن", "money"),
  field("wages", "foodAllowance", "حق خواربار (بن)", "money"),
  field("wages", "childAllowance", "حق اولاد", "money"),
  field("wages", "seniorityAllowance", "حق سنوات / پایهٔ سنوات", "money"),
  field("wages", "otherBenefits", "سایر مزایا و پرداخت‌ها", "textarea", {
    helperFa: "مثلاً پاداش، اضافه‌کاری، ایاب‌وذهاب، بیمهٔ تکمیلی.",
  }),
  // Bank details live on the employee party record (`bankingFor` above),
  // so they are never part of the public document or the employer's
  // counterparty link.

  // --- ساعات کار و مرخصی ---
  field("hours", "weeklyHours", "ساعات کار هفتگی", "number", {
    required: true,
    helperFa: "مطابق ماده ۵۱ قانون کار، ساعات کار نباید از ۴۴ ساعت در هفته بیشتر باشد.",
  }),
  field("hours", "dailyHours", "ساعات کار روزانه", "number"),
  field("hours", "workSchedule", "برنامهٔ کار روزانه / هفتگی", "textarea", { required: true }),
  field("hours", "restDay", "روز تعطیل هفتگی", "text", { placeholderFa: "مثلاً جمعه" }),
  field("hours", "annualLeaveDays", "مرخصی استحقاقی سالانه (روز)", "number", {
    helperFa: "مرخصی استحقاقی سالانه طبق قانون کار تعیین می‌شود.",
  }),
  field("hours", "remoteWork", "امکان دورکاری", "toggle"),

  // --- بیمه و مالیات ---
  field("insurance", "socialInsurance", "بیمهٔ تأمین اجتماعی کارگر", "select", {
    required: true,
    options: [
      { value: "yes", labelFa: "بله، کارفرما مکلف به بیمه کردن است" },
      { value: "no", labelFa: "خیر" },
    ],
    helperFa: "طبق قانون تأمین اجتماعی، کارفرما مکلف است کارگر را نزد سازمان تأمین اجتماعی بیمه کند.",
  }),
  field("insurance", "insuranceNumber", "شمارهٔ بیمهٔ کارگر", "text", {
    requiredWhen: { key: "socialInsurance", equals: "yes" },
  }),
  field("insurance", "taxWithholding", "کسر مالیات بر درآمد حقوق", "toggle", {
    helperFa: "مطابق قانون مالیات‌های مستقیم، کارفرما مکلف به کسر و ایصال مالیات بر درآمد حقوق است.",
  }),
  field("insurance", "payrollObligations", "تعهدات کارفرما در قبال تأمین اجتماعی", "textarea", {
    helperFa: "مهلت و آیین ارسال لیست بیمه و پرداخت حق بیمهٔ کارگر.",
  }),
  field("insurance", "additionalInsurance", "بیمهٔ تکمیلی / عمر و حوادث", "textarea"),

  // --- تعهدات و شروط خاص ---
  field("obligations", "mutualObligations", "تعهدات متقابل طرفین", "textarea", { required: true }),
  field("obligations", "confidentiality", "تعهد محرمانگی اطلاعات", "toggle"),
  field("obligations", "nonCompete", "شرط عدم رقابت", "toggle"),
  field("obligations", "ipOwnership", "مالکیت آثار و دستاوردهای شغلی", "select", {
    options: [
      { value: "employer", labelFa: "کارفرما" },
      { value: "employee", labelFa: "کارگر" },
      { value: "shared", labelFa: "مشترک" },
    ],
  }),
  field("obligations", "trainingBond", "تعهد بازپرداخت هزینهٔ آموزش", "toggle", {
    helperFa: "در صورت توافق بر آموزش تخصصی با هزینهٔ کارفرما.",
  }),
  field("obligations", "specialClauses", "شروط خاص توافق‌شده", "textarea", {
    helperFa: "هر شرط دیگری که طرفین بر آن توافق کرده‌اند، در چارچوب ماده ۱۰ قانون مدنی.",
  }),
  field("obligations", "terminationTerms", "شرایط خاتمه و فسخ قرارداد", "textarea"),
  field("obligations", "latePenalty", "وجه التزام تأخیر در انجام تعهد", "money"),
  field("obligations", "disputeResolution", "مرجع حل اختلاف", "textarea", {
    helperFa: "مثلاً هیئت‌های تشخیص و حل اختلاف ادارهٔ کار، داوری، مراجع قضایی.",
  }),
  field("obligations", "governingLaw", "قانون حاکم", "select", {
    required: true,
    options: [
      { value: "iran", labelFa: "قوانین جمهوری اسلامی ایران" },
      { value: "other", labelFa: "سایر" },
    ],
  }),
];

const EMPLOYMENT_DOCUMENTS: RequiredDocumentDefinition[] = [
  { category: "employer_id", labelFa: "کارت ملی کارفرما / نمایندهٔ او", required: true, provider: "initiator" },
  { category: "employee_id", labelFa: "کارت ملی کارگر", required: true, provider: "counterparty" },
  { category: "employee_passport", labelFa: "گذرنامه و پروانهٔ کار (اتباع خارجی)", required: false, provider: "either" },
  { category: "employment_resume", labelFa: "رزومه و سابقهٔ کاری", required: false, provider: "counterparty" },
  { category: "employment_education", labelFa: "مدارک تحصیلی", required: false, provider: "counterparty" },
  { category: "employment_medical", labelFa: "گواهی سلامت / آزمایش‌های بدو استخدام", required: false, provider: "either" },
  { category: "employment_order", labelFa: "ابلاغ / حکم کارگزینی", required: false, provider: "initiator" },
  { category: "other", labelFa: "سایر پیوست‌ها", required: false, provider: "either" },
];

// --- Commercial property -------------------------------------------
// Commercial property is schema-driven: the legal plumbing (parties,
// deed, mortgage/seizure, notary registration) mirrors the residential
// journeys, but the *commercial* substance — permitted use, business
// licence, fit-out obligations, VAT, opening/closure — is a field set
// of its own. Asking a shop tenant residential questions would be the
// exact "same text with a different title" failure the spec forbids.

const COMMERCIAL_KINDS = [
  { value: "office", labelFa: "دفتر کار / واحد اداری" },
  { value: "shop", labelFa: "مغازه / واحد تجاری" },
  { value: "warehouse", labelFa: "انبار" },
  { value: "industrial", labelFa: "کارگاه / واحد صنعتی" },
  { value: "other", labelFa: "سایر" },
];

const COMMERCIAL_RENT_STEPS: WizardStepDescriptor[] = [
  step("parties", "طرفین قرارداد", "مشخصات موجر و مستأجر تجاری و نمایندگان قانونی", ["parties"]),
  step("property", "مشخصات ملک تجاری", "نوع کاربری، متراژ و مشخصات مورد اجاره", ["property"]),
  step("licence", "مجوز و کاربری", "پروانهٔ کسب، کاربری مجاز و شرایط بهره‌برداری", ["licence"]),
  step("term", "مدت و تحویل", "تاریخ شروع و پایان، تحویل و تحویل‌دادن مجدد", ["term"]),
  step("financial", "اجاره‌بها و پرداخت", "ودیعه، اجاره‌بها، مالیات و حساب موجر", ["financial"], "landlord"),
  step("obligations", "تعهدات و فسخ", "تعهدات طرفین، تعمیرات، فسخ و تخلیه", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
  SUPPLEMENTARY_STEP,
  REVIEW_STEP,
];

const COMMERCIAL_RENT_FIELDS: ContractFieldDescriptor[] = [
  field("property", "commercialKind", "نوع ملک تجاری", "select", {
    required: true,
    options: COMMERCIAL_KINDS,
  }),
  field("property", "propertyAddress", "نشانی کامل ملک", "textarea", {
    required: true,
    placeholderFa: "استان، شهر، خیابان، پلاک و واحد",
  }),
  field("property", "usableArea", "متراژ قابل استفاده (مترمربع)", "number", { required: true }),
  field("property", "floorDescription", "طبقه و موقعیت واحد", "text"),
  field("property", "parkingSpaces", "تعداد پارکینگ اختصاصی", "number"),
  field("property", "currentCondition", "وضعیت فعلی و تجهیزات موجود", "textarea", {
    helperFa: "تجهیزات، ویترین، سیستم سرمایش و گرمایش و موارد تحویلی را بنویسید.",
  }),
  field("licence", "permittedUse", "کاربری مجاز مورد توافق", "textarea", {
    required: true,
    helperFa: "مثلاً فروش پوشاک، دفتر خدمات حسابداری؛ هر کاربری خارج از این محدوده نیازمند رضایت کتبی موجر است.",
  }),
  field("licence", "businessLicenceHolder", "مسئول اخذ پروانهٔ کسب", "select", {
    required: true,
    options: [
      { value: "tenant", labelFa: "مستأجر" },
      { value: "landlord", labelFa: "موجر" },
      { value: "both", labelFa: "هر دو (با تقسیم وظایف)" },
    ],
  }),
  field("licence", "licenceDeadlineDays", "مهلت اخذ پروانه از شروع قرارداد (روز)", "number"),
  field("licence", "signageTerms", "شرایط نصب تابلو و نمای بیرونی", "textarea"),
  field("licence", "fitOutTerms", "تعهدات آماده‌سازی و تغییرات داخلی", "textarea", {
    required: true,
    helperFa: "مجاز یا غیرمجاز بودن تغییرات، سازه، برق‌کشی و بازگرداندن وضعیت اولیه.",
  }),
  field("term", "startDate", "تاریخ شروع اجاره", "date", { required: true }),
  field("term", "endDate", "تاریخ پایان اجاره", "date", { required: true }),
  field("term", "renewalNoticeDays", "مهلت اعلام تمدید پیش از پایان (روز)", "number"),
  field("term", "handoverDate", "تاریخ تحویل کلید", "date"),
  field("financial", "depositAmount", "ودیعه / ضمانت", "money", { required: true }),
  field("financial", "monthlyRent", "اجاره‌بهای ماهانه", "money", { required: true }),
  field("financial", "rentDueDay", "روز سررسید اجاره در هر ماه", "number"),
  field("financial", "paymentMethod", "روش پرداخت", "select", {
    required: true,
    options: [
      { value: "bank_transfer", labelFa: "انتقال بانکی" },
      { value: "cheque", labelFa: "چک" },
      { value: "cash", labelFa: "نقدی" },
    ],
  }),
  field("financial", "vatTerms", "مالیات بر ارزش افزوده", "select", {
    required: true,
    options: [
      { value: "excluded", labelFa: "خارج از اجاره‌بها و بر عهدهٔ مستأجر" },
      { value: "included", labelFa: "شامل اجاره‌بها" },
      { value: "not_applicable", labelFa: "موضوعیت ندارد" },
    ],
  }),
  field("financial", "latePenaltyTerms", "شرط جریمهٔ تأخیر در پرداخت", "textarea"),
  field("obligations", "utilityBearer", "پرداخت آب، برق، گاز و شارژ", "select", {
    required: true,
    options: [
      { value: "tenant", labelFa: "مستأجر" },
      { value: "landlord", labelFa: "موجر" },
      { value: "split", labelFa: "تقسیم بر اساس نوع هزینه" },
    ],
  }),
  field("obligations", "repairBearer", "تعمیرات اساسی و سازه‌ای", "select", {
    required: true,
    options: [
      { value: "landlord", labelFa: "موجر" },
      { value: "tenant", labelFa: "مستأجر" },
    ],
  }),
  field("obligations", "subleaseAllowed", "واگذاری به غیر (واگذاری یا شرکت)", "toggle"),
  field("obligations", "earlyTerminationTerms", "شرایط فسخ پیش از موعد", "textarea"),
  field("obligations", "evictionTerms", "شرایط تخلیه و وجه التزام", "textarea"),
];

const COMMERCIAL_RENT_SECTIONS = sectionsFromFields(
  COMMERCIAL_RENT_STEPS,
  COMMERCIAL_RENT_FIELDS
);

const COMMERCIAL_RENT_DOCUMENTS: RequiredDocumentDefinition[] = [
  { category: "deed", labelFa: "سند مالکیت ملک تجاری", required: true, provider: "initiator" },
  { category: "landlord_id", labelFa: "کارت ملی / شناسهٔ موجر", required: true, provider: "initiator" },
  { category: "tenant_id", labelFa: "کارت ملی / شناسهٔ مستأجر", required: true, provider: "counterparty" },
  { category: "other", labelFa: "پروانهٔ کسب یا مجوز فعالیت", required: false, provider: "counterparty" },
  { category: "handover_photo", labelFa: "تصاویر وضعیت ملک هنگام تحویل", required: false, provider: "either" },
];

const COMMERCIAL_SALE_STEPS: WizardStepDescriptor[] = [
  step("parties", "طرفین معامله", "مشخصات فروشنده و خریدار و نمایندگان قانونی", ["parties"]),
  step("property", "مشخصات ملک تجاری", "نوع کاربری، متراژ و مشخصات ملک", ["property"]),
  step("legal", "وضعیت حقوقی و سند", "سند، رهن، بازداشت و محدودیت انتقال", ["legal"]),
  step("financial", "ثمن و پرداخت", "قیمت، پیش‌پرداخت، اقساط و حساب فروشنده", ["financial"], "seller"),
  step("registration", "ثبت رسمی", "دفترخانه، تاریخ حضور و مدارک انتقال", ["registration"]),
  step("obligations", "تعهدات و تحویل", "تخلیه، بدهی‌های قبلی و تجهیزات", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
  SUPPLEMENTARY_STEP,
  REVIEW_STEP,
];

const COMMERCIAL_SALE_FIELDS: ContractFieldDescriptor[] = [
  field("property", "commercialKind", "نوع ملک تجاری", "select", {
    required: true,
    options: COMMERCIAL_KINDS,
  }),
  field("property", "propertyAddress", "نشانی کامل ملک", "textarea", {
    required: true,
    placeholderFa: "استان، شهر، خیابان، پلاک و واحد",
  }),
  field("property", "usableArea", "متراژ قابل استفاده (مترمربع)", "number", { required: true }),
  field("property", "floorDescription", "طبقه و موقعیت واحد", "text"),
  field("property", "parkingSpaces", "تعداد پارکینگ اختصاصی", "number"),
  field("property", "includedEquipment", "تجهیزات و تأسیسات منتقل‌شده", "textarea"),
  field("legal", "deedNumber", "شمارهٔ سند مالکیت", "text", { required: true }),
  field("legal", "deedType", "نوع سند", "select", {
    required: true,
    options: [
      { value: "single_page", labelFa: "تک‌برگ" },
      { value: "booklet", labelFa: "دفترچه‌ای" },
      { value: "other", labelFa: "سایر" },
    ],
  }),
  field("legal", "inMortgage", "آیا ملک در رهن است؟", "toggle"),
  field("legal", "mortgageReleaseTerms", "شرایط فک رهن", "textarea", {
    requiredWhen: { key: "inMortgage", equals: true },
  }),
  field("legal", "seized", "آیا بازداشت یا محدودیت انتقال دارد؟", "toggle"),
  field("legal", "restrictionDetails", "شرح محدودیت", "textarea", {
    requiredWhen: { key: "seized", equals: true },
  }),
  field("legal", "occupiedByTenant", "آیا ملک در تصرف مستأجر است؟", "toggle"),
  field("legal", "tenantVacateDate", "تاریخ تخلیهٔ مستأجر", "date", {
    requiredWhen: { key: "occupiedByTenant", equals: true },
  }),
  field("financial", "totalPrice", "ثمن معامله", "money", { required: true }),
  field("financial", "downPayment", "پیش‌پرداخت", "money", { required: true }),
  field("financial", "hasInstalments", "پرداخت باقی ثمن به‌صورت اقساط است", "toggle"),
  field("financial", "instalmentTerms", "برنامهٔ اقساط", "repeatable", {
    requiredWhen: { key: "hasInstalments", equals: true },
    addLabelFa: "افزودن قسط",
    helperFa: "تعداد، مبلغ و سررسید هر قسط را جداگانه ثبت کنید.",
    columns: [
      { key: "dueDate", labelFa: "سررسید", kind: "date" },
      { key: "amount", labelFa: "مبلغ قسط", kind: "money" },
      { key: "note", labelFa: "توضیح", kind: "text" },
    ],
  }),
  field("financial", "paymentMethod", "روش پرداخت", "select", {
    required: true,
    options: [
      { value: "bank_transfer", labelFa: "انتقال بانکی" },
      { value: "cheque", labelFa: "چک" },
      { value: "cash", labelFa: "نقدی" },
    ],
  }),
  field("registration", "notaryOffice", "دفترخانهٔ اسناد رسمی", "text", { required: true }),
  field("registration", "registrationDate", "تاریخ توافقی تنظیم سند", "date", { required: true }),
  field("registration", "amountAtRegistration", "مبلغ قابل پرداخت هنگام تنظیم سند", "money"),
  field("registration", "documentsResponsible", "مسئول تهیهٔ مدارک", "select", {
    required: true,
    options: [
      { value: "seller", labelFa: "فروشنده" },
      { value: "buyer", labelFa: "خریدار" },
      { value: "both", labelFa: "هر دو" },
    ],
  }),
  field("obligations", "priorDebtsBearer", "تسویهٔ بدهی‌های قبلی", "select", {
    required: true,
    options: [
      { value: "seller", labelFa: "فروشنده" },
      { value: "buyer", labelFa: "خریدار" },
    ],
  }),
  field("obligations", "sellerNoShowPenalty", "وجه التزام عدم حضور فروشنده", "money"),
  field("obligations", "handoverDelayPenalty", "وجه التزام تأخیر در تخلیه و تحویل", "money"),
  field("obligations", "otherTerms", "سایر توافقات", "textarea"),
];

const COMMERCIAL_SALE_SECTIONS = sectionsFromFields(
  COMMERCIAL_SALE_STEPS,
  COMMERCIAL_SALE_FIELDS
);

const COMMERCIAL_SALE_DOCUMENTS: RequiredDocumentDefinition[] = [
  { category: "deed", labelFa: "سند مالکیت ملک تجاری", required: true, provider: "initiator" },
  { category: "seller_id", labelFa: "کارت ملی / شناسهٔ فروشنده", required: true, provider: "initiator" },
  { category: "buyer_id", labelFa: "کارت ملی / شناسهٔ خریدار", required: true, provider: "counterparty" },
  { category: "mortgage_release", labelFa: "مدارک فک رهن", required: false, provider: "initiator" },
  { category: "check_image", labelFa: "تصویر چک‌ها یا ضمانت‌نامه‌ها", required: false, provider: "either" },
  { category: "other", labelFa: "مجوز کاربری / پایان‌کار", required: false, provider: "initiator" },
];

// --- Cloud services (IaaS / PaaS / BaaS) ---------------------------
// One family, three registered types. The service model is decided
// BEFORE the form and is encoded in the type id, so the title, the
// field set, the tables and the clauses can never disagree about what
// was purchased.

const CLOUD_SHARED_STEPS: WizardStepDescriptor[] = [
  step("parties", "طرفین قرارداد", "مشخصات ارائه‌دهنده و مشتری", ["parties"]),
  step("service", "مشخصات خدمت", "منابع، محیط و محدودهٔ خدمت", ["service"]),
  step("sla", "سطح سرویس و پشتیبانی", "دسترس‌پذیری، پشتیبانی و امنیت", ["sla"]),
  step("financial", "هزینه و پرداخت", "مبلغ، دورهٔ صورت‌حساب و حساب ارائه‌دهنده", ["financial"], "provider"),
  step("data", "داده و محرمانگی", "مالکیت داده، نگهداری، بازگرداندن و حذف", ["data"]),
  step("obligations", "تعهدات و فسخ", "مسئولیت‌ها، جریمه و شرایط فسخ", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
  SUPPLEMENTARY_STEP,
  REVIEW_STEP,
];

function cloudServiceFields(model: "iaas" | "paas" | "baas"): ContractFieldDescriptor[] {
  const shared: ContractFieldDescriptor[] = [
    field("service", "serviceName", "نام خدمت", "text", { required: true }),
    field("service", "serviceDescription", "شرح خدمت ارائه‌شده", "textarea", { required: true }),
    field("service", "hostingRegion", "محل استقرار / منطقهٔ خدمت", "text", { required: true }),
    field("service", "contractStartDate", "تاریخ شروع خدمت", "date", { required: true }),
    field("service", "contractTermMonths", "مدت قرارداد (ماه)", "number", { required: true }),
  ];

  const modelSpecific: ContractFieldDescriptor[] =
    model === "iaas"
      ? [
          field("service", "computeSpec", "مشخصات منابع محاسباتی (CPU / RAM)", "textarea", {
            required: true,
            helperFa: "تعداد و نوع ماشین‌های مجازی، پردازنده و حافظهٔ اختصاص‌یافته.",
          }),
          field("service", "storageSpec", "ذخیره‌سازی (نوع و حجم)", "textarea", { required: true }),
          field("service", "networkSpec", "شبکه، پهنای باند و آدرس‌های اختصاصی", "textarea"),
          field("service", "osResponsibility", "مسئول مدیریت سیستم‌عامل و نرم‌افزار", "select", {
            required: true,
            options: [
              { value: "customer", labelFa: "مشتری" },
              { value: "provider", labelFa: "ارائه‌دهنده" },
            ],
          }),
          field("service", "backupPolicy", "سیاست پشتیبان‌گیری و بازیابی", "textarea"),
        ]
      : model === "paas"
        ? [
            field("service", "runtimeStack", "محیط اجرا / پلتفرم", "textarea", {
              required: true,
              helperFa: "زبان، نسخهٔ محیط اجرا و سرویس‌های مدیریت‌شدهٔ همراه.",
            }),
            field("service", "scalingPolicy", "سیاست مقیاس‌پذیری", "textarea", { required: true }),
            field("service", "deploymentMethod", "روش استقرار و انتشار نسخه", "text", { required: true }),
            field("service", "managedComponents", "اجزای مدیریت‌شده توسط ارائه‌دهنده", "textarea"),
            field("service", "customerWorkload", "محدودهٔ مسئولیت مشتری (برنامه و داده)", "textarea"),
          ]
        : [
            field("service", "backendServices", "سرویس‌های بک‌اند ارائه‌شده", "textarea", {
              required: true,
              helperFa: "پایگاه داده، احراز هویت، ذخیرهٔ فایل، صف پیام، API و مانند آن.",
            }),
            field("service", "databaseSpec", "مشخصات پایگاه داده", "textarea", { required: true }),
            field("service", "apiQuota", "سهمیهٔ فراخوانی API", "text", { required: true }),
            field("service", "storageQuota", "سهمیهٔ ذخیره‌سازی", "text"),
            field("service", "authServiceTerms", "شرایط سرویس احراز هویت و دسترسی", "textarea"),
          ];

  const sla: ContractFieldDescriptor[] = [
    field("sla", "availabilitySla", "تضمین دسترس‌پذیری (٪)", "number", {
      required: true,
      helperFa: "مثلاً ۹۹٫۵ درصد در هر ماه.",
    }),
    field("sla", "supportHours", "ساعات و کانال پشتیبانی", "text", { required: true }),
    field("sla", "responseTime", "زمان پاسخ اولیهٔ پشتیبانی", "text", { required: true }),
    field("sla", "maintenanceWindow", "بازهٔ نگهداری برنامه‌ریزی‌شده", "text"),
    field("sla", "securityMeasures", "اقدامات امنیتی و رمزنگاری", "textarea", { required: true }),
    field("sla", "uptimePenalty", "جریمهٔ عدم تحقق سطح سرویس", "money"),
  ];

  const financial: ContractFieldDescriptor[] = [
    field("financial", "subscriptionFee", "مبلغ خدمت", "money", { required: true }),
    field("financial", "billingPeriod", "دورهٔ صورت‌حساب", "select", {
      required: true,
      options: [
        { value: "monthly", labelFa: "ماهانه" },
        { value: "quarterly", labelFa: "سه‌ماهه" },
        { value: "yearly", labelFa: "سالانه" },
      ],
    }),
    field("financial", "usageBilling", "هزینهٔ مصرف مازاد", "textarea", {
      helperFa: "نحوهٔ محاسبهٔ مصرف بیش از سهمیهٔ قراردادی.",
    }),
    field("financial", "paymentMethod", "روش پرداخت", "select", {
      required: true,
      options: [
        { value: "bank_transfer", labelFa: "انتقال بانکی" },
        { value: "card", labelFa: "کارت بانکی" },
      ],
    }),
  ];

  const data: ContractFieldDescriptor[] = [
    field("data", "dataOwnership", "مالکیت داده‌های مشتری", "select", {
      required: true,
      options: [
        { value: "customer", labelFa: "مشتری" },
        { value: "provider", labelFa: "ارائه‌دهنده" },
      ],
    }),
    field("data", "dataLocation", "محل نگهداری داده", "text", { required: true }),
    field("data", "retentionPeriod", "مدت نگهداری داده پس از خاتمه", "text", { required: true }),
    field("data", "dataReturnMethod", "روش بازگرداندن داده", "textarea", { required: true }),
    field("data", "deletionPolicy", "سیاست حذف قطعی داده", "textarea", { required: true }),
    field("data", "confidentiality", "تعهد محرمانگی اطلاعات", "toggle"),
  ];

  const obligations: ContractFieldDescriptor[] = [
    field("obligations", "ipOwnership", "مالکیت فکری", "select", {
      required: true,
      options: [
        { value: "provider", labelFa: "ارائه‌دهنده" },
        { value: "customer", labelFa: "مشتری" },
      ],
    }),
    field("obligations", "customerObligations", "تعهدات مشتری", "textarea", {
      required: true,
      helperFa: "استفادهٔ مجاز، ممنوعیت‌ها و همکاری لازم.",
    }),
    field("obligations", "providerObligations", "تعهدات ارائه‌دهنده", "textarea", {
      required: true,
    }),
    field("obligations", "liabilityCap", "سقف مسئولیت", "money"),
    field("obligations", "terminationNoticeDays", "مدت اطلاع پیش از فسخ (روز)", "number"),
    field("obligations", "terminationTerms", "شرایط فسخ و تعلیق", "textarea"),
    field("obligations", "governingLaw", "قانون حاکم", "select", {
      required: true,
      options: [
        { value: "iran", labelFa: "قوانین جمهوری اسلامی ایران" },
        { value: "other", labelFa: "سایر (در توضیحات ذکر شود)" },
      ],
    }),
  ];

  return [...shared, ...modelSpecific, ...sla, ...financial, ...data, ...obligations];
}

const CLOUD_DOCUMENTS: RequiredDocumentDefinition[] = [
  { category: "seller_id", labelFa: "شناسه / کارت ملی ارائه‌دهنده", required: true, provider: "initiator" },
  { category: "buyer_id", labelFa: "شناسه / کارت ملی مشتری", required: true, provider: "counterparty" },
  { category: "other", labelFa: "سند سطح سرویس (SLA) و سیاست حریم خصوصی", required: false, provider: "initiator" },
];

// ------------------------------------------------------------
// Semantic document tables
// ------------------------------------------------------------
// Every schema-driven type groups its short answers into named tables with
// the headers that fit the document — never one generic «موضوع / شرح» grid
// for every contract. A table only prints the rows that are present (or
// required), so an empty table never reaches the sheet. Long free-text
// answers stay OUT of these tables and print as paragraphs beneath, because
// a multi-line clause is the wrong content for a table cell.

const VEHICLE_TABLES: ContractFieldTable[] = [
  {
    stepId: "vehicle",
    captionFa: "مشخصات فنی و شناسایی خودرو",
    columnsFa: ["مشخصه", "شرح"],
    rows: [
      { labelFa: "نوع خودرو", key: "vehicleType" },
      { labelFa: "برند / سازنده", key: "brand" },
      { labelFa: "مدل (سال ساخت)", key: "model" },
      { labelFa: "رنگ", key: "color" },
      { labelFa: "شماره پلاک", key: "plateNumber" },
      { labelFa: "شماره شاسی (VIN)", key: "vin" },
      { labelFa: "شماره موتور", key: "engineNumber" },
      { labelFa: "شماره بدنه", key: "bodyNumber" },
      { labelFa: "کارکرد (کیلومتر)", key: "mileage" },
      { labelFa: "وضعیت سلامت خودرو", key: "condition" },
    ],
  },
  {
    stepId: "financial",
    captionFa: "مبلغ معامله و ترتیب پرداخت",
    columnsFa: ["شرح", "مبلغ / ترتیب"],
    rows: [
      { labelFa: "قیمت کل خودرو", key: "totalPrice" },
      { labelFa: "مبلغ پیش‌پرداخت", key: "downPayment" },
      { labelFa: "پرداخت پیش از ثبت سند", key: "beforeTransferAmount" },
      { labelFa: "پرداخت پس از تعویض پلاک", key: "afterPlateAmount" },
      { labelFa: "روش پرداخت", key: "paymentMethod" },
      { labelFa: "تعداد اقساط", key: "instalmentCount" },
      { labelFa: "شماره حساب فروشنده", key: "accountNumber" },
    ],
  },
];

const DEBT_TABLES: ContractFieldTable[] = [
  {
    stepId: "loan",
    captionFa: "مبلغ و شرایط بازپرداخت قرض",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "مبلغ قرض", key: "amount" },
      { labelFa: "تاریخ انعقاد", key: "loanDate" },
      { labelFa: "سررسید بازپرداخت", key: "dueDate" },
      { labelFa: "روش بازپرداخت", key: "repaymentMethod" },
      { labelFa: "تعداد اقساط", key: "instalmentCount" },
    ],
  },
  {
    stepId: "guarantee",
    captionFa: "تضامین و ضمانت",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "وجود ضامن", key: "hasGuarantor" },
      { labelFa: "نام ضامن", key: "guarantorName" },
      { labelFa: "کد ملی ضامن", key: "guarantorNationalId" },
    ],
  },
  {
    stepId: "obligations",
    captionFa: "وجه التزام و شرایط فسخ",
    columnsFa: ["شرح", "مقدار"],
    rows: [{ labelFa: "وجه التزام تأخیر در بازپرداخت", key: "latePenalty" }],
  },
];

const FREELANCE_TABLES: ContractFieldTable[] = [
  {
    stepId: "project",
    captionFa: "زمان‌بندی و دامنهٔ پروژه",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "عنوان پروژه", key: "projectTitle" },
      { labelFa: "تاریخ شروع", key: "startDate" },
      { labelFa: "تاریخ تحویل", key: "deliveryDate" },
      { labelFa: "تعداد بازبینی مجاز", key: "revisionCount" },
    ],
  },
  {
    stepId: "financial",
    captionFa: "دستمزد و نحوهٔ پرداخت",
    columnsFa: ["شرح", "مبلغ / ترتیب"],
    rows: [
      { labelFa: "دستمزد کل", key: "fee" },
      { labelFa: "بیعانه", key: "advancePayment" },
      { labelFa: "روش پرداخت", key: "paymentMethod" },
      { labelFa: "شماره حساب فریلنسر", key: "accountNumber" },
    ],
  },
  {
    stepId: "obligations",
    captionFa: "تعهدات و وجه التزام",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "تعهد محرمانگی", key: "confidentiality" },
      { labelFa: "مالکیت معنوی خروجی", key: "ipOwnership" },
      { labelFa: "وجه التزام تأخیر در تحویل", key: "latePenalty" },
    ],
  },
];

const NDA_TABLES: ContractFieldTable[] = [
  {
    stepId: "terms",
    captionFa: "مدت اعتبار و بقای تعهد",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "تاریخ شروع اعتبار", key: "startDate" },
      { labelFa: "مدت اعتبار قرارداد (ماه)", key: "durationMonths" },
      { labelFa: "مدت بقای تعهد پس از خاتمه (ماه)", key: "survivalMonths" },
    ],
  },
  {
    stepId: "obligations",
    captionFa: "ضمانت اجرا و حل اختلاف",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "روش بازگرداندن یا امحای اطلاعات", key: "returnOrDestroy" },
      { labelFa: "وجه التزام نقض تعهد", key: "penaltyAmount" },
      { labelFa: "قانون حاکم", key: "governingLaw" },
    ],
  },
];

const SAAS_TABLES: ContractFieldTable[] = [
  {
    stepId: "service",
    captionFa: "مشخصات سرویس و سطح خدمات",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "نام سرویس / نرم‌افزار", key: "serviceName" },
      { labelFa: "تضمین دسترس‌پذیری (٪)", key: "availabilitySla" },
      { labelFa: "ساعات پشتیبانی", key: "supportHours" },
      { labelFa: "محل مرکز داده", key: "dataCenterLocation" },
    ],
  },
  {
    stepId: "financial",
    captionFa: "هزینهٔ اشتراک و صورت‌حساب",
    columnsFa: ["شرح", "مبلغ / ترتیب"],
    rows: [
      { labelFa: "مبلغ اشتراک", key: "subscriptionFee" },
      { labelFa: "دوره صورت‌حساب", key: "billingPeriod" },
      { labelFa: "تعداد کاربران", key: "userCount" },
      { labelFa: "روش پرداخت", key: "paymentMethod" },
    ],
  },
  {
    stepId: "data",
    captionFa: "داده‌ها و محرمانگی",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "مالکیت داده‌ها", key: "dataOwnership" },
      { labelFa: "روش بازگرداندن داده‌ها", key: "dataReturnMethod" },
      { labelFa: "محرمانگی", key: "confidentiality" },
    ],
  },
];

const EMPLOYMENT_TABLES: ContractFieldTable[] = [
  {
    stepId: "job",
    captionFa: "مشخصات شغل و محل کار",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "عنوان شغل", key: "jobTitle" },
      { labelFa: "محل کار", key: "jobWorkplace" },
      { labelFa: "واحد سازمانی", key: "jobDepartment" },
      { labelFa: "سرپرست مستقیم", key: "jobSupervisor" },
      { labelFa: "تحصیلات کارگر", key: "employeeEducation" },
    ],
  },
  {
    stepId: "term",
    captionFa: "نوع و مدت قرارداد کار",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { key: "contractType" },
      { key: "startDate" },
      { key: "endDate" },
      { key: "probationMonths" },
    ],
  },
  {
    stepId: "wages",
    captionFa: "حقوق، مزایا و نحوهٔ پرداخت",
    columnsFa: ["شرح", "مبلغ / ترتیب"],
    rows: [
      { labelFa: "حقوق پایه", key: "baseSalary" },
      { labelFa: "دورهٔ پرداخت", key: "wagePeriod" },
      { labelFa: "روز پرداخت", key: "paymentDay" },
      { labelFa: "حق مسکن", key: "housingAllowance" },
      { labelFa: "کمک‌هزینهٔ غذا", key: "foodAllowance" },
      { labelFa: "حق اولاد", key: "childAllowance" },
      { labelFa: "پایهٔ سنوات", key: "seniorityAllowance" },
    ],
  },
  {
    stepId: "hours",
    captionFa: "ساعات کار و مرخصی",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "ساعات کار هفتگی", key: "weeklyHours" },
      { labelFa: "ساعات کار روزانه", key: "dailyHours" },
      { labelFa: "برنامهٔ کاری", key: "workSchedule" },
      { labelFa: "روز تعطیل", key: "restDay" },
      { labelFa: "مرخصی سالانه (روز)", key: "annualLeaveDays" },
      { labelFa: "کار از راه دور", key: "remoteWork" },
    ],
  },
  {
    stepId: "insurance",
    captionFa: "بیمه و امور مالیاتی",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "بیمهٔ اجتماعی", key: "socialInsurance" },
      { labelFa: "شمارهٔ بیمه", key: "insuranceNumber" },
      { labelFa: "کسر مالیات", key: "taxWithholding" },
    ],
  },
];

const COMMERCIAL_RENT_TABLES: ContractFieldTable[] = [
  {
    stepId: "property",
    captionFa: "مشخصات ملک تجاری",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "نوع ملک تجاری", key: "commercialKind" },
      { labelFa: "نشانی ملک", key: "propertyAddress" },
      { labelFa: "مساحت قابل استفاده (مترمربع)", key: "usableArea" },
      { labelFa: "طبقه / موقعیت", key: "floorDescription" },
      { labelFa: "تعداد پارکینگ", key: "parkingSpaces" },
      { labelFa: "وضعیت فعلی ملک", key: "currentCondition" },
    ],
  },
  {
    stepId: "licence",
    captionFa: "کاربری مجاز و پروانهٔ کسب",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "کاربری مجاز", key: "permittedUse" },
      { labelFa: "مسئول اخذ پروانهٔ کسب", key: "businessLicenceHolder" },
      { labelFa: "مهلت اخذ پروانه (روز)", key: "licenceDeadlineDays" },
      { labelFa: "شرایط نصب تابلو", key: "signageTerms" },
    ],
  },
  {
    stepId: "term",
    captionFa: "مدت اجاره و تحویل",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "تاریخ شروع", key: "startDate" },
      { labelFa: "تاریخ پایان", key: "endDate" },
      { labelFa: "مهلت اعلام تمدید (روز)", key: "renewalNoticeDays" },
      { labelFa: "تاریخ تحویل ملک", key: "handoverDate" },
    ],
  },
  {
    stepId: "financial",
    captionFa: "ودیعه، اجاره‌بها و نحوهٔ پرداخت",
    columnsFa: ["شرح", "مبلغ / ترتیب"],
    rows: [
      { labelFa: "مبلغ ودیعه (رهن)", key: "depositAmount" },
      { labelFa: "اجاره‌بهای ماهانه", key: "monthlyRent" },
      { labelFa: "مهلت پرداخت اجاره در هر ماه", key: "rentDueDay" },
      { labelFa: "روش پرداخت", key: "paymentMethod" },
      { labelFa: "شرایط مالیات بر ارزش افزوده", key: "vatTerms" },
    ],
  },
  {
    stepId: "obligations",
    captionFa: "تعهدات بهره‌برداری و فسخ",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "مسئول پرداخت قبوض", key: "utilityBearer" },
      { labelFa: "مسئول تعمیرات", key: "repairBearer" },
      { labelFa: "واگذاری به غیر", key: "subleaseAllowed" },
    ],
  },
];

const COMMERCIAL_SALE_TABLES: ContractFieldTable[] = [
  {
    stepId: "property",
    captionFa: "مشخصات ملک تجاری",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "نوع ملک تجاری", key: "commercialKind" },
      { labelFa: "نشانی ملک", key: "propertyAddress" },
      { labelFa: "مساحت قابل استفاده (مترمربع)", key: "usableArea" },
      { labelFa: "طبقه / موقعیت", key: "floorDescription" },
      { labelFa: "تعداد پارکینگ", key: "parkingSpaces" },
    ],
  },
  {
    stepId: "legal",
    captionFa: "وضعیت حقوقی و ثبتی",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "شمارهٔ سند", key: "deedNumber" },
      { labelFa: "نوع سند", key: "deedType" },
      { labelFa: "وضعیت رهن", key: "inMortgage" },
      { labelFa: "شرایط فک رهن", key: "mortgageReleaseTerms" },
      { labelFa: "وضعیت بازداشت", key: "seized" },
      { labelFa: "وجود مستأجر", key: "occupiedByTenant" },
      { labelFa: "تاریخ تخلیه مستأجر", key: "tenantVacateDate" },
    ],
  },
  {
    stepId: "financial",
    captionFa: "ثمن معامله و برنامهٔ پرداخت",
    columnsFa: ["شرح", "مبلغ / ترتیب"],
    rows: [
      { labelFa: "ثمن معامله", key: "totalPrice" },
      { labelFa: "پیش‌پرداخت", key: "downPayment" },
      { labelFa: "پرداخت اقساطی", key: "hasInstalments" },
      { labelFa: "شرایط اقساط", key: "instalmentTerms" },
      { labelFa: "روش پرداخت", key: "paymentMethod" },
    ],
  },
  {
    stepId: "registration",
    captionFa: "دفترخانه و ثبت رسمی",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "دفتر اسناد رسمی", key: "notaryOffice" },
      { labelFa: "تاریخ ثبت", key: "registrationDate" },
      { labelFa: "مبلغ قابل پرداخت هنگام ثبت", key: "amountAtRegistration" },
      { labelFa: "مسئول تهیهٔ مدارک", key: "documentsResponsible" },
    ],
  },
  {
    stepId: "obligations",
    captionFa: "تعهدات و وجوه التزام",
    columnsFa: ["شرح", "مقدار"],
    rows: [
      { labelFa: "مسئول تسویهٔ بدهی‌های قبلی", key: "priorDebtsBearer" },
      { labelFa: "وجه التزام عدم حضور فروشنده", key: "sellerNoShowPenalty" },
      { labelFa: "وجه التزام تأخیر در تحویل", key: "handoverDelayPenalty" },
    ],
  },
];

/** One table set per cloud model, sharing the common sections. */
function cloudTables(model: "iaas" | "paas" | "baas"): ContractFieldTable[] {
  const modelRows: ContractFieldTableRow[] =
    model === "iaas"
      ? [
          { labelFa: "مشخصات منابع محاسباتی", key: "computeSpec" },
          { labelFa: "مشخصات ذخیره‌سازی", key: "storageSpec" },
          { labelFa: "مشخصات شبکه", key: "networkSpec" },
          { labelFa: "مسئولیت سیستم‌عامل", key: "osResponsibility" },
          { labelFa: "سیاست پشتیبان‌گیری", key: "backupPolicy" },
        ]
      : model === "paas"
        ? [
            { labelFa: "محیط اجرا (Runtime)", key: "runtimeStack" },
            { labelFa: "سیاست مقیاس‌پذیری", key: "scalingPolicy" },
            { labelFa: "روش استقرار", key: "deploymentMethod" },
            { labelFa: "اجزای مدیریت‌شده", key: "managedComponents" },
            { labelFa: "بار کاری مشتری", key: "customerWorkload" },
          ]
        : [
            { labelFa: "سرویس‌های بک‌اند", key: "backendServices" },
            { labelFa: "مشخصات پایگاه داده", key: "databaseSpec" },
            { labelFa: "سهمیهٔ API", key: "apiQuota" },
            { labelFa: "سهمیهٔ ذخیره‌سازی", key: "storageQuota" },
            { labelFa: "شرایط سرویس احراز هویت", key: "authServiceTerms" },
          ];

  return [
    {
      stepId: "service",
      captionFa: "مشخصات سرویس ابری و دامنهٔ خدمت",
      columnsFa: ["شرح", "مقدار"],
      rows: [
        { labelFa: "نام سرویس", key: "serviceName" },
        { labelFa: "منطقهٔ میزبانی", key: "hostingRegion" },
        { labelFa: "تاریخ شروع قرارداد", key: "contractStartDate" },
        { labelFa: "مدت قرارداد (ماه)", key: "contractTermMonths" },
        ...modelRows,
      ],
    },
    {
      stepId: "sla",
      captionFa: "سطح خدمات، پشتیبانی و امنیت",
      columnsFa: ["شرح", "مقدار"],
      rows: [
        { labelFa: "تضمین دسترس‌پذیری", key: "availabilitySla" },
        { labelFa: "ساعات پشتیبانی", key: "supportHours" },
        { labelFa: "زمان پاسخ‌دهی", key: "responseTime" },
        { labelFa: "پنجرهٔ نگهداری", key: "maintenanceWindow" },
        { labelFa: "اقدامات امنیتی", key: "securityMeasures" },
        { labelFa: "جریمهٔ کاهش دسترس‌پذیری", key: "uptimePenalty" },
      ],
    },
    {
      stepId: "financial",
      captionFa: "هزینهٔ سرویس و صورت‌حساب",
      columnsFa: ["شرح", "مبلغ / ترتیب"],
      rows: [
        { labelFa: "مبلغ اشتراک", key: "subscriptionFee" },
        { labelFa: "دورهٔ صورت‌حساب", key: "billingPeriod" },
        { labelFa: "صورت‌حساب مصرفی", key: "usageBilling" },
        { labelFa: "روش پرداخت", key: "paymentMethod" },
      ],
    },
    {
      stepId: "data",
      captionFa: "داده‌ها، محل نگهداری و محرمانگی",
      columnsFa: ["شرح", "مقدار"],
      rows: [
        { labelFa: "مالکیت داده‌ها", key: "dataOwnership" },
        { labelFa: "محل نگهداری داده", key: "dataLocation" },
        { labelFa: "مدت نگهداری", key: "retentionPeriod" },
        { labelFa: "روش بازگرداندن داده", key: "dataReturnMethod" },
        { labelFa: "سیاست حذف داده", key: "deletionPolicy" },
      ],
    },
    {
      stepId: "obligations",
      captionFa: "تعهدات، مسئولیت و خاتمه",
      columnsFa: ["شرح", "مقدار"],
      rows: [
        { labelFa: "مالکیت معنوی", key: "ipOwnership" },
        { labelFa: "سقف مسئولیت", key: "liabilityCap" },
        { labelFa: "مهلت اعلام خاتمه (روز)", key: "terminationNoticeDays" },
        { labelFa: "قانون حاکم", key: "governingLaw" },
      ],
    },
  ];
}

// ------------------------------------------------------------
// Registry
// ------------------------------------------------------------

const DEFINITIONS: Record<ContractTypeId, ContractDefinition> = {
  commercial_rent: {
    id: "commercial_rent",
    domain: "property",
    implemented: true,
    typeFa: "رهن و اجاره ملک تجاری",
    categoryFa: "املاک",
    descriptionFa:
      "تنظیم قرارداد اجارهٔ واحد تجاری با تعیین کاربری مجاز، ودیعه، اجاره‌بها و تعهدات بهره‌برداری.",
    ctaFa: "تنظیم اجاره‌نامهٔ ملک تجاری",
    keywords: ["اجاره", "تجاری", "مغازه", "دفتر", "انبار", "کارگاه", "واگذاری", "پروانه کسب", "رهن"],
    icon: "store",
    gradient: "from-primary to-primary-container",
    schemaVersion: 1,
    templateVersion: "commercial-rent-v1.0.0",
    roles: ["landlord", "tenant"],
    defaultInitiatorRole: "landlord",
    wizardSteps: COMMERCIAL_RENT_STEPS,
    sections: COMMERCIAL_RENT_SECTIONS,
    fields: COMMERCIAL_RENT_FIELDS,
    fieldTables: COMMERCIAL_RENT_TABLES,
    requiredDocuments: COMMERCIAL_RENT_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: false,
      officialRegistrationOptional: true,
      explanationFa:
        "اجارهٔ ملک تجاری با امضای طرفین معتبر است؛ ثبت رسمی در دفتر اسناد رسمی الزامی نیست ولی برای ضمانت اجرای بیشتر توصیه می‌شود. اخذ پروانهٔ کسب و رعایت کاربری مجاز مستقل از این قرارداد و بر عهدهٔ طرف مسئول در متن است.",
      postSignState: "FINALIZED",
    },
    createDefaultData: createGenericData,
  },
  commercial_sale: {
    id: "commercial_sale",
    domain: "property",
    implemented: true,
    typeFa: "خرید و فروش ملک تجاری",
    categoryFa: "املاک",
    descriptionFa:
      "تنظیم مبایعه‌نامهٔ ملک تجاری با تعیین ثمن، برنامهٔ پرداخت، وضعیت حقوقی و شرایط ثبت رسمی.",
    ctaFa: "تنظیم مبایعه‌نامهٔ تجاری",
    keywords: ["خرید", "فروش", "تجاری", "مغازه", "دفتر", "مبایعه", "سند", "ثمن", "دفترخانه"],
    icon: "store",
    gradient: "from-secondary to-secondary-container",
    schemaVersion: 1,
    templateVersion: "commercial-sale-v1.0.0",
    roles: ["seller", "buyer"],
    defaultInitiatorRole: "seller",
    wizardSteps: COMMERCIAL_SALE_STEPS,
    sections: COMMERCIAL_SALE_SECTIONS,
    fields: COMMERCIAL_SALE_FIELDS,
    fieldTables: COMMERCIAL_SALE_TABLES,
    requiredDocuments: COMMERCIAL_SALE_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: true,
      officialRegistrationOptional: false,
      explanationFa:
        "انتقال مالکیت ملک تجاری تنها با تنظیم سند رسمی در دفتر اسناد رسمی انجام می‌شود. نهایی‌شدن این مبایعه‌نامه در لِگال‌آی‌آر به‌معنای انتقال رسمی مالکیت نیست؛ پس از امضا، قرارداد در وضعیت «نیازمند ثبت رسمی» قرار می‌گیرد.",
      postSignState: "READY_FOR_OFFICIAL_REGISTRATION",
    },
    signingPolicy: {
      onlineSigningAllowed: false,
      officialStampRequired: true,
      requiresLegalApprovalForOnlineSigning: true,
      noteFa:
        "انتقال مالکیت ملک تجاری تنها با سند رسمی در دفتر اسناد رسمی معتبر است؛ بنابراین امضای آنلاین این قرارداد تا دریافت تأیید حقوقی فعلاً غیرفعال است. می‌توانید نسخهٔ چاپی را با امضای دستی تکمیل کنید.",
    },
    createDefaultData: createGenericData,
  },
  cloud_iaas: {
    id: "cloud_iaas",
    domain: "business",
    implemented: true,
    typeFa: "قرارداد خدمات ابری — زیرساخت به‌عنوان سرویس (IaaS)",
    categoryFa: "کسب‌وکار",
    descriptionFa:
      "تنظیم قرارداد اجارهٔ زیرساخت ابری: منابع محاسباتی، شبکه و ذخیره‌سازی، با تعیین سطح سرویس و مسئولیت‌ها.",
    ctaFa: "تنظیم قرارداد IaaS",
    keywords: ["ابری", "کلاد", "IaaS", "زیرساخت", "سرور", "ماشین مجازی", "ذخیره‌سازی", "SLA"],
    icon: "server",
    gradient: "from-tertiary to-tertiary-container",
    schemaVersion: 1,
    templateVersion: "cloud-iaas-v1.0.0",
    roles: ["provider", "customer"],
    defaultInitiatorRole: "provider",
    wizardSteps: CLOUD_SHARED_STEPS,
    sections: sectionsFromFields(CLOUD_SHARED_STEPS, cloudServiceFields("iaas")),
    fields: cloudServiceFields("iaas"),
    fieldTables: cloudTables("iaas"),
    requiredDocuments: CLOUD_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: false,
      officialRegistrationOptional: true,
      explanationFa:
        "قرارداد خدمات ابری با امضای طرفین معتبر است و ثبت رسمی الزامی ندارد. سطح سرویس، حفاظت از داده و شرایط فسخ باید در متن همین سند صریح باشد.",
      postSignState: "FINALIZED",
    },
    createDefaultData: createGenericData,
  },
  cloud_paas: {
    id: "cloud_paas",
    domain: "business",
    implemented: true,
    typeFa: "قرارداد خدمات ابری — بستر به‌عنوان سرویس (PaaS)",
    categoryFa: "کسب‌وکار",
    descriptionFa:
      "تنظیم قرارداد بستر توسعه و اجرای برنامه با تعیین محیط اجرا، مقیاس‌پذیری، سطح سرویس و مسئولیت‌ها.",
    ctaFa: "تنظیم قرارداد PaaS",
    keywords: ["ابری", "کلاد", "PaaS", "پلتفرم", "زمان اجرا", "استقرار", "مقیاس‌پذیری", "SLA"],
    icon: "server",
    gradient: "from-tertiary to-tertiary-container",
    schemaVersion: 1,
    templateVersion: "cloud-paas-v1.0.0",
    roles: ["provider", "customer"],
    defaultInitiatorRole: "provider",
    wizardSteps: CLOUD_SHARED_STEPS,
    sections: sectionsFromFields(CLOUD_SHARED_STEPS, cloudServiceFields("paas")),
    fields: cloudServiceFields("paas"),
    fieldTables: cloudTables("paas"),
    requiredDocuments: CLOUD_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: false,
      officialRegistrationOptional: true,
      explanationFa:
        "قرارداد خدمات ابری با امضای طرفین معتبر است و ثبت رسمی الزامی ندارد. سطح سرویس، حفاظت از داده و شرایط فسخ باید در متن همین سند صریح باشد.",
      postSignState: "FINALIZED",
    },
    createDefaultData: createGenericData,
  },
  cloud_baas: {
    id: "cloud_baas",
    domain: "business",
    implemented: true,
    typeFa: "قرارداد خدمات ابری — بک‌اند به‌عنوان سرویس (BaaS)",
    categoryFa: "کسب‌وکار",
    descriptionFa:
      "تنظیم قرارداد سرویس‌های آمادهٔ بک‌اند (پایگاه داده، احراز هویت، فایل و API) با تعیین سهمیه و سطح سرویس.",
    ctaFa: "تنظیم قرارداد BaaS",
    keywords: ["ابری", "کلاد", "BaaS", "بک‌اند", "پایگاه داده", "API", "احراز هویت", "ذخیره‌سازی", "SLA"],
    icon: "server",
    gradient: "from-tertiary to-tertiary-container",
    schemaVersion: 1,
    templateVersion: "cloud-baas-v1.0.0",
    roles: ["provider", "customer"],
    defaultInitiatorRole: "provider",
    wizardSteps: CLOUD_SHARED_STEPS,
    sections: sectionsFromFields(CLOUD_SHARED_STEPS, cloudServiceFields("baas")),
    fields: cloudServiceFields("baas"),
    fieldTables: cloudTables("baas"),
    requiredDocuments: CLOUD_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: false,
      officialRegistrationOptional: true,
      explanationFa:
        "قرارداد خدمات ابری با امضای طرفین معتبر است و ثبت رسمی الزامی ندارد. سطح سرویس، حفاظت از داده و شرایط فسخ باید در متن همین سند صریح باشد.",
      postSignState: "FINALIZED",
    },
    createDefaultData: createGenericData,
  },
  property_rent: {
    id: "property_rent",
    domain: "property",
    implemented: true,
    typeFa: "رهن و اجاره ملک مسکونی",
    categoryFa: "املاک",
    descriptionFa: "تنظیم قرارداد اجاره ملک مسکونی با تعیین ودیعه، اجاره‌بها و شرایط تحویل.",
    ctaFa: "تنظیم قرارداد اجاره",
    keywords: ["اجاره", "رهن", "مستأجر", "موجر", "ودیعه", "اجاره‌بها", "خانه", "آپارتمان", "مسکونی", "اجاره نامه"],
    icon: "home",
    gradient: "from-primary to-primary-container",
    schemaVersion: 1,
    templateVersion: "rent-v1.0.0",
    roles: ["landlord", "tenant"],
    defaultInitiatorRole: "landlord",
    wizardSteps: RENT_STEPS,
    sections: RENT_SECTIONS,
    fields: [],
    requiredDocuments: RENT_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: false,
      officialRegistrationOptional: true,
      explanationFa:
        "قرارداد اجاره با امضای طرفین معتبر است. ثبت رسمی در دفتر اسناد رسمی اختیاری است و برای اعتبار قرارداد الزامی نیست.",
      postSignState: "FINALIZED",
    },
    createDefaultData: createRentData,
  },
  property_sale: {
    id: "property_sale",
    domain: "property",
    implemented: true,
    typeFa: "خرید و فروش ملک مسکونی",
    categoryFa: "املاک",
    descriptionFa: "تنظیم مبایعه‌نامه ملک مسکونی با تعیین ثمن، برنامه پرداخت و شرایط ثبت رسمی.",
    ctaFa: "تنظیم مبایعه‌نامه ملک",
    keywords: ["خرید", "فروش", "مبایعه", "مبایعه‌نامه", "ملک", "خانه", "آپارتمان", "سند", "ثمن", "معامله"],
    icon: "key",
    gradient: "from-secondary to-secondary-container",
    schemaVersion: 1,
    templateVersion: "sale-v1.0.0",
    roles: ["seller", "buyer"],
    defaultInitiatorRole: "seller",
    wizardSteps: SALE_STEPS,
    sections: SALE_SECTIONS,
    fields: [],
    requiredDocuments: SALE_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: true,
      officialRegistrationOptional: false,
      explanationFa:
        "انتقال مالکیت ملک تنها با تنظیم سند رسمی در دفتر اسناد رسمی انجام می‌شود. نهایی‌شدن این مبایعه‌نامه در لِگال‌آی‌آر به‌معنای انتقال رسمی مالکیت نیست؛ پس از امضا، قرارداد در وضعیت «نیازمند ثبت رسمی» قرار می‌گیرد.",
      postSignState: "READY_FOR_OFFICIAL_REGISTRATION",
    },
    // A property sale transfers ownership ONLY at a notary office, so online
    // signature stays DISABLED here until a legal approval explicitly enables
    // it for the operating jurisdiction. This is data, not code — flipping it
    // on is a one-line change once legal signs off.
    signingPolicy: {
      onlineSigningAllowed: false,
      officialStampRequired: true,
      requiresLegalApprovalForOnlineSigning: true,
      noteFa:
        "انتقال مالکیت ملک تنها با سند رسمی در دفتر اسناد رسمی معتبر است؛ بنابراین امضای آنلاین این قرارداد تا دریافت تأیید حقوقی فعلاً غیرفعال است. می‌توانید نسخهٔ چاپی را با امضای دستی تکمیل کنید.",
    },
    createDefaultData: createSaleData,
  },
  vehicle_sale: {
    id: "vehicle_sale",
    domain: "vehicle",
    implemented: true,
    typeFa: "خرید و فروش خودرو",
    categoryFa: "خودرو",
    descriptionFa: "تنظیم قولنامه خودرو با مشخصات فنی، مبلغ معامله و شرایط انتقال سند.",
    ctaFa: "تنظیم قولنامه خودرو",
    keywords: ["خودرو", "ماشین", "اتومبیل", "قولنامه", "پلاک", "شاسی", "موتور", "خرید", "فروش", "سواری"],
    icon: "car",
    gradient: "from-tertiary to-tertiary-container",
    schemaVersion: 1,
    templateVersion: "vehicle-v1.0.0",
    roles: ["seller", "buyer"],
    defaultInitiatorRole: "seller",
    wizardSteps: VEHICLE_STEPS,
    sections: sectionsFromFields(VEHICLE_STEPS, VEHICLE_FIELDS),
    fields: VEHICLE_FIELDS,
    fieldTables: VEHICLE_TABLES,
    requiredDocuments: VEHICLE_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: true,
      officialRegistrationOptional: false,
      explanationFa:
        "انتقال مالکیت خودرو تنها با تنظیم سند رسمی در دفتر اسناد رسمی و تعویض پلاک انجام می‌شود. نهایی‌شدن این قولنامه در لِگال‌آی‌آر به‌معنای انتقال رسمی مالکیت نیست؛ پس از امضا، قرارداد در وضعیت «نیازمند ثبت رسمی» قرار می‌گیرد.",
      postSignState: "READY_FOR_OFFICIAL_REGISTRATION",
    },
    // A vehicle sale transfers ownership only at a notary office, so online
    // signature stays DISABLED until a legal approval enables it.
    signingPolicy: {
      onlineSigningAllowed: false,
      officialStampRequired: true,
      requiresLegalApprovalForOnlineSigning: true,
      noteFa:
        "انتقال مالکیت خودرو تنها با سند رسمی در دفتر اسناد رسمی و تعویض پلاک معتبر است؛ بنابراین امضای آنلاین این قولنامه تا دریافت تأیید حقوقی فعلاً غیرفعال است. می‌توانید نسخهٔ چاپی را با امضای دستی تکمیل کنید.",
    },
    createDefaultData: createGenericData,
  },
  debt: {
    id: "debt",
    domain: "finance",
    implemented: true,
    typeFa: "قرارداد قرض",
    categoryFa: "مالی",
    descriptionFa: "تنظیم قرارداد قرض پول با تعیین مبلغ، سررسید بازپرداخت و تضمین.",
    ctaFa: "تنظیم قرارداد قرض",
    keywords: ["قرض", "وام", "طلب", "بدهی", "بدهکار", "طلبکار", "ضامن", "سفته", "چک", "بازپرداخت"],
    icon: "coin",
    gradient: "from-primary to-primary-container",
    schemaVersion: 1,
    templateVersion: "debt-v1.0.0",
    roles: ["lender", "borrower"],
    defaultInitiatorRole: "lender",
    wizardSteps: DEBT_STEPS,
    sections: sectionsFromFields(DEBT_STEPS, DEBT_FIELDS),
    fields: DEBT_FIELDS,
    fieldTables: DEBT_TABLES,
    requiredDocuments: DEBT_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: false,
      officialRegistrationOptional: true,
      explanationFa:
        "قرارداد قرض با ایجاب و قبول و امضای طرفین معتبر است و ثبت رسمی الزامی نیست. برای ضمانت اجرای بیشتر می‌توانید آن را در دفتر اسناد رسمی ثبت کنید.",
      postSignState: "FINALIZED",
    },
    createDefaultData: createGenericData,
  },
  freelance: {
    id: "freelance",
    domain: "services",
    implemented: true,
    typeFa: "قرارداد فریلنسری",
    categoryFa: "خدمات",
    descriptionFa: "تنظیم قرارداد پروژه‌ای فریلنسری با شرح خدمات، دستمزد و زمان‌بندی تحویل.",
    ctaFa: "تنظیم قرارداد فریلنسری",
    keywords: ["فریلنس", "فریلنسری", "پروژه", "خدمات", "کارفرما", "پیمانکار", "دستمزد", "استخدام", "طراحی", "برنامه‌نویسی"],
    icon: "briefcase",
    gradient: "from-secondary to-secondary-container",
    schemaVersion: 1,
    templateVersion: "freelance-v1.0.0",
    roles: ["client", "freelancer"],
    defaultInitiatorRole: "client",
    wizardSteps: FREELANCE_STEPS,
    sections: sectionsFromFields(FREELANCE_STEPS, FREELANCE_FIELDS),
    fields: FREELANCE_FIELDS,
    fieldTables: FREELANCE_TABLES,
    requiredDocuments: FREELANCE_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: false,
      officialRegistrationOptional: true,
      explanationFa:
        "قرارداد فریلنسری با امضای طرفین لازم‌الاجرا می‌شود و ثبت رسمی الزامی ندارد. ثبت آن در دفتر اسناد رسمی اختیاری است.",
      postSignState: "FINALIZED",
    },
    createDefaultData: createGenericData,
  },
  nda: {
    id: "nda",
    domain: "business",
    implemented: true,
    typeFa: "توافقنامه محرمانگی (NDA)",
    categoryFa: "کسب‌وکار",
    descriptionFa: "تنظیم توافقنامه عدم افشای اطلاعات محرمانه، یک‌طرفه یا دوجانبه.",
    ctaFa: "تنظیم توافقنامه محرمانگی",
    keywords: ["محرمانگی", "محرمانه", "NDA", "عدم افشا", "افشا", "رازداری", "اطلاعات", "توافقنامه", "سری"],
    isNew: true,
    icon: "shield",
    gradient: "from-tertiary to-tertiary-container",
    schemaVersion: 1,
    templateVersion: "nda-v1.0.0",
    roles: ["discloser", "recipient"],
    defaultInitiatorRole: "discloser",
    wizardSteps: NDA_STEPS,
    sections: sectionsFromFields(NDA_STEPS, NDA_FIELDS),
    fields: NDA_FIELDS,
    fieldTables: NDA_TABLES,
    requiredDocuments: NDA_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: false,
      officialRegistrationOptional: true,
      explanationFa:
        "توافقنامه محرمانگی بر مبنای ماده ۱۰ قانون مدنی با امضای طرفین معتبر و لازم‌الاتباع است و ثبت رسمی الزامی ندارد.",
      postSignState: "FINALIZED",
    },
    createDefaultData: createGenericData,
  },
  saas: {
    id: "saas",
    domain: "business",
    implemented: true,
    typeFa: "قرارداد نرم‌افزار به‌عنوان سرویس (SaaS)",
    categoryFa: "کسب‌وکار",
    descriptionFa: "تنظیم قرارداد اشتراک نرم‌افزار با تعیین سطح سرویس، پرداخت و مالکیت داده.",
    ctaFa: "تنظیم قرارداد SaaS",
    keywords: ["نرم افزار", "نرم‌افزار", "سرویس", "اشتراک", "SaaS", "ابری", "کلاد", "پشتیبانی", "لایسنس", "داده"],
    isNew: true,
    icon: "cloud",
    gradient: "from-primary to-primary-container",
    schemaVersion: 1,
    templateVersion: "saas-v1.0.0",
    roles: ["provider", "customer"],
    defaultInitiatorRole: "provider",
    wizardSteps: SAAS_STEPS,
    sections: sectionsFromFields(SAAS_STEPS, SAAS_FIELDS),
    fields: SAAS_FIELDS,
    fieldTables: SAAS_TABLES,
    requiredDocuments: SAAS_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: false,
      officialRegistrationOptional: true,
      explanationFa:
        "قرارداد SaaS با امضای طرفین معتبر است و ثبت رسمی الزامی ندارد. ثبت آن در دفتر اسناد رسمی اختیاری است.",
      postSignState: "FINALIZED",
    },
    createDefaultData: createGenericData,
  },
  startup: {
    id: "startup",
    domain: "business",
    implemented: true,
    typeFa: "قرارداد مشارکت استارتاپ",
    categoryFa: "کسب‌وکار",
    descriptionFa: "تنظیم قرارداد بنیان‌گذاران با تعیین سهام، نقش‌ها، مدیریت و شرایط خروج.",
    ctaFa: "تنظیم قرارداد مشارکت",
    keywords: ["استارتاپ", "استارت آپ", "مشارکت", "سهام", "بنیان‌گذار", "شریک", "سرمایه‌گذار", "شرکت", "vesting", "خروج"],
    isNew: true,
    icon: "users",
    gradient: "from-secondary to-secondary-container",
    schemaVersion: 1,
    templateVersion: "startup-v1.0.0",
    roles: ["founder", "investor"],
    defaultInitiatorRole: "founder",
    wizardSteps: STARTUP_STEPS,
    sections: sectionsFromFields(STARTUP_STEPS, STARTUP_FIELDS),
    fields: STARTUP_FIELDS,
    requiredDocuments: STARTUP_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: false,
      officialRegistrationOptional: true,
      explanationFa:
        "قرارداد مشارکت استارتاپ با امضای شرکا لازم‌الاجرا می‌شود. ثبت تغییرات سهام و شرکت در مراجع قانونی مستقل از این سند است.",
      postSignState: "FINALIZED",
    },
    createDefaultData: createGenericData,
  },
  employment: {
    id: "employment",
    domain: "employment",
    implemented: true,
    typeFa: "قرارداد کار (استخدام)",
    categoryFa: "استخدام",
    descriptionFa:
      "تنظیم قرارداد کار میان کارفرما و کارگر بر پایهٔ قانون کار، با تعیین شغل، دستمزد، ساعات کار و تعهدات تأمین اجتماعی.",
    ctaFa: "تنظیم قرارداد استخدام",
    keywords: [
      "استخدام", "قرارداد کار", "کارفرما", "کارگر", "کارمند", "حقوق", "دستمزد", "بیمه",
      "تأمین اجتماعی", "دوره آزمایشی", "استخدام نامه", "کار", "نیروی انسانی", "استخدامی",
    ],
    isNew: true,
    icon: "briefcase",
    gradient: "from-primary to-primary-container",
    schemaVersion: 1,
    templateVersion: "employment-v1.0.0",
    roles: ["employer", "employee"],
    defaultInitiatorRole: "employer",
    wizardSteps: EMPLOYMENT_STEPS,
    sections: sectionsFromFields(EMPLOYMENT_STEPS, EMPLOYMENT_FIELDS),
    fields: EMPLOYMENT_FIELDS,
    fieldTables: EMPLOYMENT_TABLES,
    requiredDocuments: EMPLOYMENT_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: false,
      officialRegistrationOptional: true,
      explanationFa:
        "قرارداد کار مطابق ماده ۷ قانون کار با توافق طرفین منعقد می‌شود و ثبت رسمی در دفتر اسناد رسمی الزامی نیست؛ با این حال، کارفرما مکلف است حق بیمهٔ کارگر را نزد سازمان تأمین اجتماعی ایصال کند. نسخهٔ ثبت‌شده و دارای تاریخ در دفاتر کارگاه، مبنای معتبر احتساب سابقهٔ کار است.",
      postSignState: "FINALIZED",
    },
    createDefaultData: createGenericData,
  },
};

/** All registered definitions. */
export function allContractDefinitions(): ContractDefinition[] {
  return Object.values(DEFINITIONS);
}

/** Definitions that are fully implemented and shippable. */
export function implementedContractDefinitions(): ContractDefinition[] {
  return allContractDefinitions().filter((d) => d.implemented);
}

/** Look up a definition by type id. Throws for unknown ids. */
export function getContractDefinition(typeId: ContractTypeId): ContractDefinition {
  const def = DEFINITIONS[typeId];
  if (!def) throw new Error(`Unknown contract type: ${typeId}`);
  return def;
}

/** Look up a definition, or null when unknown. */
export function findContractDefinition(typeId: string): ContractDefinition | null {
  return DEFINITIONS[typeId as ContractTypeId] ?? null;
}

/**
 * The electronic-signature policy for a type. Falls back to the shared
 * default so every type has a policy without having to declare one.
 */
export function signingPolicyFor(typeId: ContractTypeId): SigningPolicy {
  return DEFINITIONS[typeId]?.signingPolicy ?? DEFAULT_SIGNING_POLICY;
}

/** True when the id is a registered, implemented contract type. */
export function isImplementedContractType(typeId: string): typeId is PropertyContractType {
  const def = findContractDefinition(typeId);
  return !!def && def.implemented;
}

/** The wizard step descriptor at `stepId`, or null. */
export function getWizardStep(
  typeId: ContractTypeId,
  stepId: string
): WizardStepDescriptor | null {
  return getContractDefinition(typeId).wizardSteps.find((s) => s.id === stepId) ?? null;
}

/** The first step id for a type. */
export function firstWizardStepId(typeId: ContractTypeId): string {
  return getContractDefinition(typeId).wizardSteps[0]?.id ?? "parties";
}

/** The step id that follows `stepId`, or null when it is the last. */
export function nextWizardStepId(typeId: ContractTypeId, stepId: string): string | null {
  const steps = getContractDefinition(typeId).wizardSteps;
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1]!.id;
}

/** The step id that precedes `stepId`, or null when it is the first. */
export function prevWizardStepId(typeId: ContractTypeId, stepId: string): string | null {
  const steps = getContractDefinition(typeId).wizardSteps;
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx <= 0) return null;
  return steps[idx - 1]!.id;
}

/** Persian label for a contract domain. */
export function domainLabelFa(domain: ContractDomain): string {
  switch (domain) {
    case "property":
      return "املاک";
    case "vehicle":
      return "خودرو";
    case "finance":
      return "مالی";
    case "services":
      return "خدمات";
    case "business":
      return "کسب‌وکار";
    case "employment":
      return "استخدام";
  }
}

/** Persian label for a party role within a contract type. */
export function partyRoleLabelFa(role: PartyRole): string {
  switch (role) {
    case "landlord":
      return "موجر";
    case "tenant":
      return "مستأجر";
    case "seller":
      return "فروشنده";
    case "buyer":
      return "خریدار";
    case "lender":
      return "طلبکار";
    case "borrower":
      return "بدهکار";
    case "client":
      return "کارفرما";
    case "freelancer":
      return "فریلنسر";
    case "discloser":
      return "افشاکننده اطلاعات";
    case "recipient":
      return "دریافت‌کننده اطلاعات";
    case "provider":
      return "ارائه‌دهنده سرویس";
    case "customer":
      return "مشتری";
    case "founder":
      return "بنیان‌گذار";
    case "investor":
      return "سرمایه‌گذار";
    case "employer":
      return "کارفرما";
    case "employee":
      return "کارگر / کارمند";
    case "legal_representative":
      return "نمایندهٔ قانونی";
  }
}

/** The counterparty role for a given role within a contract type. */
export function counterpartyRole(typeId: ContractTypeId, role: PartyRole): PartyRole | null {
  const roles = getContractDefinition(typeId).roles;
  return roles.find((r) => r !== role) ?? null;
}
