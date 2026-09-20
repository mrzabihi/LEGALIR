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

export interface ContractDefinition<TData = PropertyRentData | PropertySaleData> {
  id: ContractTypeId;
  domain: ContractDomain;
  /** Only property types are fully implemented today. */
  implemented: boolean;
  typeFa: string;
  categoryFa: string;
  descriptionFa: string;
  /** Emoji/icon key rendered in the Contract Center. */
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
    icon: "home",
    gradient: "from-primary to-primary-container",
    schemaVersion: 1,
    templateVersion: "rent-v1.0.0",
    roles: ["landlord", "tenant"],
    defaultInitiatorRole: "landlord",
    wizardSteps: RENT_STEPS,
    sections: RENT_SECTIONS,
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
    icon: "key",
    gradient: "from-secondary to-secondary-container",
    schemaVersion: 1,
    templateVersion: "sale-v1.0.0",
    roles: ["seller", "buyer"],
    defaultInitiatorRole: "seller",
    wizardSteps: SALE_STEPS,
    sections: SALE_SECTIONS,
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
    implemented: false,
    typeFa: "خرید و فروش خودرو",
    categoryFa: "خودرو",
    descriptionFa: "به‌زودی — تنظیم مبایعه‌نامه خودرو.",
    icon: "car",
    gradient: "from-tertiary to-tertiary-container",
    schemaVersion: 1,
    templateVersion: "vehicle-v0.0.0",
    roles: ["seller", "buyer"],
    defaultInitiatorRole: "seller",
    wizardSteps: [],
    sections: [],
    requiredDocuments: [],
    registrationPolicy: {
      officialRegistrationRequired: true,
      officialRegistrationOptional: false,
      explanationFa: "به‌زودی.",
      postSignState: "READY_FOR_OFFICIAL_REGISTRATION",
    },
    createDefaultData: createSaleData,
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
  }
}

/** The counterparty role for a given role within a contract type. */
export function counterpartyRole(typeId: ContractTypeId, role: PartyRole): PartyRole | null {
  const roles = getContractDefinition(typeId).roles;
  return roles.find((r) => r !== role) ?? null;
}
