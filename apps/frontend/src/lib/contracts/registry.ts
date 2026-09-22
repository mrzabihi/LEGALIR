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

export interface ContractDefinition<TData = ContractDomainData> {
  id: ContractTypeId;
  domain: ContractDomain;
  /** True when the type is fully implemented and shippable. */
  implemented: boolean;
  typeFa: string;
  categoryFa: string;
  descriptionFa: string;
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
  /** Documents the contract expects. */
  requiredDocuments: RequiredDocumentDefinition[];
  /** Registration policy — never hard-coded in the UI. */
  registrationPolicy: RegistrationPolicy;
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

/** A wizard step descriptor for a schema-driven type. */
function step(
  id: string,
  titleFa: string,
  descriptionFa: string,
  sections: string[]
): WizardStepDescriptor {
  return { id, titleFa, descriptionFa, sections };
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
        .filter((f) => f.stepId === s.id && f.required)
        .map((f) => `values.${f.key}`);
      // The parties and documents steps carry no field descriptors —
      // their requirement is the special "parties"/"documents" path the
      // completeness scorer resolves against the aggregate.
      if (s.id === "parties") requiredPaths.unshift("parties");
      if (s.id === "documents") requiredPaths.unshift("documents");
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
  step("financial", "مبلغ و نحوه پرداخت", "قیمت، پیش‌پرداخت و مراحل پرداخت", ["financial"]),
  step("obligations", "تعهدات و شرایط", "تخلفات، خسارت و شرایط فسخ", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
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
  step("loan", "مبلغ و شرایط قرض", "مبلغ، تاریخ و شرایط بازپرداخت", ["loan"]),
  step("guarantee", "تضمین و ضامن", "ضمانت‌نامه و مشخصات ضامن", ["guarantee"]),
  step("obligations", "تعهدات و فسخ", "وجه التزام تأخیر و شرایط فسخ", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
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
  step("financial", "دستمزد و پرداخت", "مبلغ، بیعانه و مراحل پرداخت", ["financial"]),
  step("obligations", "تعهدات و فسخ", "تعهدات طرفین و شرایط فسخ", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
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
  step("financial", "اشتراک و پرداخت", "مبلغ اشتراک، دوره و روش پرداخت", ["financial"]),
  step("data", "داده و محرمانگی", "مالکیت داده، بازگرداندن و محرمانگی", ["data"]),
  step("obligations", "تعهدات و فسخ", "تعهدات طرفین، SLA و شرایط فسخ", ["obligations"]),
  step("documents", "مدارک", "بارگذاری مدارک لازم", ["documents"]),
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

// ------------------------------------------------------------
// Registry
// ------------------------------------------------------------

const DEFINITIONS: Record<ContractTypeId, ContractDefinition> = {
  property_rent: {
    id: "property_rent",
    domain: "property",
    implemented: true,
    typeFa: "رهن و اجاره ملک مسکونی",
    categoryFa: "املاک",
    descriptionFa: "تنظیم قرارداد اجاره ملک مسکونی با تعیین ودیعه، اجاره‌بها و شرایط تحویل.",
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
    createDefaultData: createSaleData,
  },
  vehicle_sale: {
    id: "vehicle_sale",
    domain: "vehicle",
    implemented: true,
    typeFa: "خرید و فروش خودرو",
    categoryFa: "خودرو",
    descriptionFa: "تنظیم قولنامه خودرو با مشخصات فنی، مبلغ معامله و شرایط انتقال سند.",
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
    requiredDocuments: VEHICLE_DOCUMENTS,
    registrationPolicy: {
      officialRegistrationRequired: true,
      officialRegistrationOptional: false,
      explanationFa:
        "انتقال مالکیت خودرو تنها با تنظیم سند رسمی در دفتر اسناد رسمی و تعویض پلاک انجام می‌شود. نهایی‌شدن این قولنامه در لِگال‌آی‌آر به‌معنای انتقال رسمی مالکیت نیست؛ پس از امضا، قرارداد در وضعیت «نیازمند ثبت رسمی» قرار می‌گیرد.",
      postSignState: "READY_FOR_OFFICIAL_REGISTRATION",
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
  }
}

/** The counterparty role for a given role within a contract type. */
export function counterpartyRole(typeId: ContractTypeId, role: PartyRole): PartyRole | null {
  const roles = getContractDefinition(typeId).roles;
  return roles.find((r) => r !== role) ?? null;
}
