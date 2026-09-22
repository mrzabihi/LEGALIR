// ============================================================
// LEGALIR — Property contract demo seed
// ============================================================
// Seeds two realistic property contracts for the demo user so the
// Contract Center, the resume cards and the dashboards have real
// data on first load:
//
//   • a rent contract mid-wizard (parties + property filled, terms
//     still pending) — exercises the resume flow
//   • a sale contract further along (ready for review)
//
// Idempotent by a version marker, and append-only: it never clobbers
// contracts the user created themselves.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import type {
  ContractParty,
  PropertyContract,
  PropertyRentData,
  PropertySaleData,
} from "@legalir/types";
import { getContractDefinition } from "./registry";
import { computeCompleteness } from "./completeness";
import {
  insertContract,
  listContractsForUser,
  listParties,
  updateContractForUser,
  upsertParty,
} from "./db";
import { todayJalali } from "./dates";

const DATA_DIR = path.resolve(process.cwd(), ".data");
const SEED_VERSION = "legalir-property-contracts-v1";

interface SeedMeta {
  version: string;
  userId: string;
  seededAt: string;
}

function readMeta(): SeedMeta | null {
  const file = path.join(DATA_DIR, "property-contract-seed.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as SeedMeta;
  } catch {
    return null;
  }
}

function writeMeta(userId: string): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, "property-contract-seed.json"),
    JSON.stringify({ version: SEED_VERSION, userId, seededAt: new Date().toISOString() }, null, 2),
    "utf-8"
  );
}

function iso(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A realistic Tehran apartment address. */
function tehranAddress(neighborhood: string, street: string, plaque: string) {
  return {
    province: "تهران",
    city: "تهران",
    district: "منطقه ۳",
    neighborhood,
    street,
    alley: "کوچه بهار",
    plaque,
    floor: "۳",
    unit: "۷",
    postalCode: "1968" + plaque.padStart(4, "0"),
  };
}

function rentSeedData(): PropertyRentData {
  const def = getContractDefinition("property_rent");
  const base = def.createDefaultData("apartment") as PropertyRentData;
  return {
    ...base,
    address: tehranAddress("پاسداران", "خیابان گلستان", "۱۲"),
    deed: {
      ...base.deed,
      deedType: "single_page",
      deedNumber: "۴۵۲۱",
      mainPlaque: "۱۲",
      registrationDistrict: "۳",
      officialArea: 96,
      ownerName: "مریم محمدی",
      deedDate: iso(-3650),
    },
    general: {
      ...base.general,
      area: 96,
      buildYear: 1395,
      floor: 3,
      unitNumber: "۷",
      totalFloors: 5,
      totalUnits: 10,
      bedrooms: 2,
      orientation: "جنوبی",
      renovationStatus: "بازسازی‌شده",
      occupancyStatus: "خالی",
    },
    amenities: {
      ...base.amenities,
      hasParking: true,
      parkingKind: "exclusive",
      parkingNumber: "۱۲",
      hasStorage: true,
      storageNumber: "۵",
      hasElevator: true,
      hasBalcony: true,
      restroomKind: "european",
      restroomCount: 1,
      bathroomCount: 1,
      kitchenKind: "closed",
      hasHood: true,
      hasStove: true,
      hasOven: true,
      heating: ["پکیج"],
      cooling: ["کولر گازی"],
    },
    durations: {
      contractDate: iso(0),
      startDate: iso(7),
      handoverDate: iso(7),
      endDate: iso(372),
      durationMonths: 12,
    },
    terms: {
      ...base.terms,
      agreementKind: "deposit_and_rent",
      securityDeposit: { amount: 500_000_000 * 10, currency: "IRR" },
      monthlyRent: { amount: 25_000_000 * 10, currency: "IRR" },
      rentDueDay: 1,
      landlordAccount: "IR123456789012345678901234",
    },
  };
}

function saleSeedData(): PropertySaleData {
  const def = getContractDefinition("property_sale");
  const base = def.createDefaultData("apartment") as PropertySaleData;
  return {
    ...base,
    address: tehranAddress("سعادت‌آباد", "بلوار دریا", "۴۵"),
    deed: {
      ...base.deed,
      deedType: "single_page",
      deedNumber: "۸۸۹۰",
      mainPlaque: "۴۵",
      registrationDistrict: "۲",
      officialArea: 120,
      ownerName: "علی رضایی",
      deedDate: iso(-5000),
    },
    general: {
      ...base.general,
      area: 120,
      buildYear: 1390,
      floor: 2,
      unitNumber: "۳",
      totalFloors: 6,
      totalUnits: 12,
      bedrooms: 3,
      orientation: "شمالی",
      renovationStatus: "بازسازی‌نشده",
      occupancyStatus: "سکونت مالک",
    },
    amenities: {
      ...base.amenities,
      hasParking: true,
      parkingKind: "exclusive",
      hasStorage: true,
      hasElevator: true,
      hasBalcony: true,
      restroomKind: "both",
      restroomCount: 2,
      bathroomCount: 1,
      kitchenKind: "open",
      heating: ["پکیج"],
      cooling: ["کولر گازی"],
    },
    legalStatus: {
      inMortgage: "no",
      mortgageDetails: "",
      seized: "no",
      hasLoan: "no",
      loanDetails: "",
      occupiedByTenant: "no",
      tenantLeaseEnd: null,
      tenantDeposit: null,
      transferRestricted: "no",
      restrictionDetails: "",
    },
    terms: {
      totalPrice: { amount: 12_000_000_000 * 10, currency: "IRR" },
      pricePerSqm: { amount: 100_000_000 * 10, currency: "IRR" },
      hasSchedule: true,
    },
    registration: {
      agreedDate: iso(21),
      agreedTime: "۱۰:۳۰",
      notaryOfficeNumber: "۱۲۳",
      notaryCity: "تهران",
      notaryAddress: "خیابان ولیعصر، پلاک ۲۰۰",
      amountAtRegistration: { amount: 2_000_000_000 * 10, currency: "IRR" },
      documentsResponsible: "seller",
      requiredDocuments: ["سند مالکیت", "پایان‌کار", "کارت ملی"],
    },
    obligations: {
      sellerNoShowPenalty: { amount: 500_000_000 * 10, currency: "IRR" },
      handoverDelayPenalty: { amount: 100_000_000 * 10, currency: "IRR" },
      sellerMustReleaseMortgage: true,
      priorDebtsBearer: "seller",
      includedEquipment: "کولر گازی، پکیج، کابینت",
      otherTerms: "",
    },
  };
}

function buildParty(params: {
  contractId: string;
  role: ContractParty["role"];
  capacity: ContractParty["capacity"];
  isInitiator: boolean;
  firstName: string;
  lastName: string;
  fatherName: string;
  nationalId: string;
  mobile: string;
  address: string;
  dang: number;
}): ContractParty {
  return {
    id: `pty-${crypto.randomUUID()}`,
    contractId: params.contractId,
    role: params.role,
    capacity: params.capacity,
    identity: {
      firstName: params.firstName,
      lastName: params.lastName,
      fatherName: params.fatherName,
      nationalId: params.nationalId,
      birthCertificateNumber: "۱۲۳۴",
      birthCertificatePlace: "تهران",
      birthDate: iso(-14000),
      mobile: params.mobile,
      address: params.address,
      postalCode: "1968000000",
    },
    ownershipShare: { dang: params.dang, outOf: 6 },
    powerOfAttorney: null,
    isInitiator: params.isInitiator,
    createdAt: new Date().toISOString(),
  };
}

function buildContract(params: {
  userId: string;
  type: "property_rent" | "property_sale";
  title: string;
  data: PropertyRentData | PropertySaleData;
  currentStep: string;
  state: PropertyContract["state"];
  sequence: number;
}): PropertyContract {
  const def = getContractDefinition(params.type);
  const now = new Date().toISOString();
  const jy = todayJalali().jy;
  const kind = params.type === "property_rent" ? "RENT" : "SALE";
  return {
    id: `cnt-${crypto.randomUUID()}`,
    referenceCode: `LGL-${kind}-${jy}-${String(params.sequence).padStart(6, "0")}`,
    userId: params.userId,
    domain: "property",
    type: params.type,
    typeFa: def.typeFa,
    state: params.state,
    initiatorRole: def.defaultInitiatorRole,
    title: params.title,
    currentStep: params.currentStep,
    progress: 0,
    templateVersion: def.templateVersion,
    schemaVersion: def.schemaVersion,
    data: params.data,
    currentVersionId: null,
    currentVersionNumber: 0,
    finalVersionId: null,
    finalizedAt: null,
    publicVerificationId: `vrf-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Seed the demo property contracts for a user. Idempotent: runs once
 * per user per seed version, and never touches user-created rows.
 */
export function seedPropertyContracts(userId: string): void {
  const meta = readMeta();
  if (meta && meta.version === SEED_VERSION && meta.userId === userId) return;

  // Never duplicate if the user already has property contracts.
  if (listContractsForUser(userId).length > 0) {
    writeMeta(userId);
    return;
  }

  // --- Rent contract, mid-wizard (terms pending) ---
  const rent = buildContract({
    userId,
    type: "property_rent",
    title: "اجاره آپارتمان پاسداران",
    data: rentSeedData(),
    currentStep: "financial",
    state: "TERMS_PENDING",
    sequence: 1,
  });
  insertContract(rent);
  upsertParty(
    buildParty({
      contractId: rent.id,
      role: "landlord",
      capacity: "owner",
      isInitiator: true,
      firstName: "مریم",
      lastName: "محمدی",
      fatherName: "حسن",
      nationalId: "0079123456",
      mobile: "09120000003",
      address: "تهران، پاسداران، خیابان گلستان",
      dang: 6,
    })
  );
  upsertParty(
    buildParty({
      contractId: rent.id,
      role: "tenant",
      capacity: "owner",
      isInitiator: false,
      firstName: "رضا",
      lastName: "کریمی",
      fatherName: "محمد",
      nationalId: "0081234567",
      mobile: "09120000004",
      address: "تهران، سعادت‌آباد",
      dang: 0,
    })
  );

  // --- Sale contract, ready for review ---
  const sale = buildContract({
    userId,
    type: "property_sale",
    title: "فروش آپارتمان سعادت‌آباد",
    data: saleSeedData(),
    currentStep: "review",
    state: "READY_FOR_REVIEW",
    sequence: 2,
  });
  insertContract(sale);
  upsertParty(
    buildParty({
      contractId: sale.id,
      role: "seller",
      capacity: "owner",
      isInitiator: true,
      firstName: "علی",
      lastName: "رضایی",
      fatherName: "اکبر",
      nationalId: "0069876543",
      mobile: "09120000003",
      address: "تهران، سعادت‌آباد، بلوار دریا",
      dang: 6,
    })
  );
  upsertParty(
    buildParty({
      contractId: sale.id,
      role: "buyer",
      capacity: "owner",
      isInitiator: false,
      firstName: "سارا",
      lastName: "احمدی",
      fatherName: "ناصر",
      nationalId: "0074567890",
      mobile: "09120000005",
      address: "تهران، ونک",
      dang: 0,
    })
  );

  // Persist the real progress computed from the required fields.
  for (const contract of [rent, sale]) {
    const parties = listParties(contract.id);
    const progress = computeCompleteness(contract, parties, []).overall;
    updateContractForUser(userId, contract.id, { progress });
  }

  writeMeta(userId);
}
