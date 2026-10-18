// ============================================================
// LEGALIR — Dev-only END-TO-END sample contract (§2.7)
// ============================================================
// One contract that exercises the WHOLE lifecycle with fake parties, so
// the admin panel (and the owner workspace) can be inspected end to end
// without touching a real customer:
//
//   draft version (v1) → submitted for admin review → APPROVED (bound to
//   v1's hash) → signature request opened on the frozen final version
//   (v2, same hash as v1) → one invitation per party, recorded as
//   `dev-console` delivery.
//
// Rules this module keeps:
//
//   • DEV ONLY. It refuses to run unless NODE_ENV is `development`, so a
//     production build can never seed it.
//   • NO REAL SMS. Invitations are written with `deliveryChannel:
//     "dev-console"` and never call the SMS gateway — configuring a real
//     gateway must not turn a seed into a message to a stranger's phone.
//   • IDEMPOTENT. One sample per owner; re-running the dev seed is a no-op.
//   • LABELLED. `isSample: true` plus the «نمونه آزمایشی» title marker, so
//     it can never be mistaken for a real contract.
// ============================================================

import crypto from "node:crypto";
import type {
  ContractParty,
  PropertyContract,
  PropertyRentData,
  SignatureInvitation,
} from "@legalir/types";
import { getContractDefinition } from "./registry";
import { getContractById, insertContract, listContractsForUser, upsertParty } from "./db";
import { createVersion } from "./snapshot";
import {
  appendAdminReviewEvent,
  createPendingReview,
  updateAdminReview,
} from "./admin-review";
import {
  activeSignatureRequest,
  appendSignatureEvent,
  insertInvitation,
  listParticipants,
} from "./signature/db";
import { createSignatureRequest } from "./signature/workflow";
import { todayJalali } from "./dates";

/** The label every surface must show next to a sample contract. */
export const SAMPLE_CONTRACT_LABEL_FA = "نمونه آزمایشی";
/** The title marker, so the row is recognisable even without the badge. */
export const SAMPLE_CONTRACT_TITLE = "اجاره‌نامهٔ نمونهٔ آزمایشی (داده‌های ساختگی)";

const SAMPLE_REFERENCE_PREFIX = "LGL-SAMPLE";

function iso(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Fully populated rent data — every required field, so completeness is 100. */
function sampleRentData(): PropertyRentData {
  const def = getContractDefinition("property_rent");
  const base = def.createDefaultData("apartment") as PropertyRentData;
  return {
    ...base,
    address: {
      province: "تهران",
      city: "تهران",
      district: "منطقه ۳",
      neighborhood: "نمونه",
      street: "خیابان نمونه",
      alley: "کوچهٔ نمونه",
      plaque: "۱",
      floor: "۲",
      unit: "۳",
      postalCode: "1968000000",
    },
    deed: {
      ...base.deed,
      deedType: "single_page",
      deedNumber: "۹۹۹۹",
      mainPlaque: "۱",
      registrationDistrict: "۳",
      officialArea: 90,
      ownerName: "نمونهٔ مالک",
      deedDate: iso(-3650),
    },
    general: {
      ...base.general,
      area: 90,
      buildYear: 1395,
      floor: 2,
      unitNumber: "۳",
      totalFloors: 4,
      totalUnits: 8,
      bedrooms: 2,
      orientation: "جنوبی",
      renovationStatus: "بازسازی‌شده",
      occupancyStatus: "خالی",
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
      landlordAccount: "IR000000000000000000000000",
    },
    // §2.1/§2.2 — a requested change, an agreed clause and a confirmed
    // note, so the admin record has something real to show.
    customClauses: [
      {
        id: "cc-sample-1",
        kind: "agreement",
        title: "بند توافقی نمونه",
        body: "این بند صرفاً برای نمایش بخش «تغییرات و بندهای افزوده» است.",
        sectionRef: "financial",
        createdAt: new Date().toISOString(),
      },
      {
        id: "cc-sample-2",
        kind: "change_request",
        title: "درخواست تغییر نمونه",
        body: "افزودن امکان تمدید تلفنی — این یک درخواست تغییر است، نه یک شرط توافق‌شده.",
        createdAt: new Date().toISOString(),
      },
    ],
    supplementary: {
      notes:
        "این یادداشت نمونه است و در پایان سند، جدا از مواد قرارداد چاپ می‌شود. داده‌های این قرارداد ساختگی هستند.",
      noteConfirmedAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
    },
  } as PropertyRentData;
}

function sampleParty(params: {
  contractId: string;
  role: ContractParty["role"];
  isInitiator: boolean;
  firstName: string;
  lastName: string;
  mobile: string;
}): ContractParty {
  return {
    id: `pty-${crypto.randomUUID()}`,
    contractId: params.contractId,
    role: params.role,
    capacity: "owner",
    identity: {
      firstName: params.firstName,
      lastName: params.lastName,
      fatherName: "نمونه",
      nationalId: "0000000000",
      birthCertificateNumber: "0000",
      birthCertificatePlace: "تهران",
      birthDate: iso(-14000),
      mobile: params.mobile,
      address: "تهران، نمونه",
      postalCode: "1968000000",
    },
    personKind: "natural",
    nationality: "iranian",
    representativeOfPartyId: null,
    representativePositionFa: "",
    ownershipShare: null,
    powerOfAttorney: null,
    banking: null,
    isInitiator: params.isInitiator,
    createdAt: new Date().toISOString(),
  };
}

function buildSampleContract(userId: string): PropertyContract {
  const def = getContractDefinition("property_rent");
  const now = new Date().toISOString();
  return {
    id: `cnt-${crypto.randomUUID()}`,
    referenceCode: `${SAMPLE_REFERENCE_PREFIX}-${todayJalali().jy}`,
    userId,
    domain: "property",
    type: "property_rent",
    typeFa: def.typeFa,
    state: "READY_TO_SIGN",
    initiatorRole: def.defaultInitiatorRole,
    initiatorSide: "first",
    title: SAMPLE_CONTRACT_TITLE,
    currentStep: "signature",
    progress: 100,
    templateVersion: def.templateVersion,
    schemaVersion: def.schemaVersion,
    data: sampleRentData(),
    currentVersionId: null,
    currentVersionNumber: 0,
    finalVersionId: null,
    finalizedAt: null,
    publicVerificationId: `vrf-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    isSample: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Seed the dev sample contract. A no-op outside development and a no-op
 * once the owner already has one.
 */
export function seedSampleContract(userId: string): void {
  if (process.env.NODE_ENV !== "development") return;
  if (listContractsForUser(userId).some((c) => c.isSample)) return;

  // Two fake parties. The numbers are reserved-looking sample mobiles and
  // are NEVER dialled — no gateway is called anywhere in this module.
  const parties = [
    { role: "landlord" as const, first: "نمونه", last: "موجر", mobile: "09120000091" },
    { role: "tenant" as const, first: "نمونه", last: "مستاجر", mobile: "09120000092" },
  ];

  // SAFETY: the contract row is inserted BEFORE any party references it, so
  // a failed seed can never leave parties pointing at a missing contract.
  const contract = insertContract(buildSampleContract(userId));

  try {
    parties.forEach((p, i) => {
      upsertParty(
        sampleParty({
          contractId: contract.id,
          role: p.role,
          isInitiator: i === 0,
          firstName: p.first,
          lastName: p.last,
          mobile: p.mobile,
        })
      );
    });

    // v1 — the draft that goes to review. Its hash is what the approval
    // binds to, and re-freezing the same content in `createSignatureRequest`
    // reproduces that exact hash.
    const { version: draft } = createVersion(contract, userId);

    const review = createPendingReview({
      contractId: contract.id,
      contractVersionId: draft.id,
      documentHash: draft.documentHash,
    });
    appendAdminReviewEvent({
      reviewId: review.id,
      action: "approve",
      actorId: userId,
      actorLabel: "سامانهٔ نمونه (توسعه)",
      reasonFa: "تأیید خودکار نمونهٔ آزمایشی برای اجرای کامل جریان.",
      contractVersionId: draft.id,
      documentHash: draft.documentHash,
    });
    updateAdminReview(review.id, {
      status: "APPROVED",
      reviewerId: userId,
      reviewerLabelFa: "سامانهٔ نمونه (توسعه)",
      reviewerInitials: "ن.آ",
      reasonFa: "تأیید خودکار نمونهٔ آزمایشی برای اجرای کامل جریان.",
      decidedAt: new Date().toISOString(),
    });

    // The real workflow: freezes the final version, opens the request and
    // creates one participant per party. It must see the contract as it is
    // NOW — `createVersion` wrote the new version id to the store, not to
    // the in-memory object, and the approval gate reads that id.
    const current = getContractById(contract.id) ?? contract;
    const response = createSignatureRequest(
      {
        contract: current,
        actor: { userId, actorLabel: "سامانهٔ نمونه (توسعه)" },
        ownerId: userId,
        fingerprint: "dev-sample-seed",
      },
      { action: "create_request" }
    );
    if (!response.ok) return;

    const request = activeSignatureRequest(contract.id);
    if (!request) return;
    const participants = listParticipants(request.id);
    const expiresAt = new Date(Date.now() + 72 * 3600_000).toISOString();

    // NO SMS. The transport is recorded as `dev-console` because that is
    // honestly what happened: a link was generated and logged, not sent.
    for (const participant of participants) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const invitation: SignatureInvitation = {
        id: `sinv-${crypto.randomUUID()}`,
        contractId: contract.id,
        signatureRequestId: request.id,
        participantId: participant.id,
        tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
        recipientMasked: participant.mobileMasked,
        status: "ACTIVE",
        verifyBeforeView: false,
        expiresAt,
        usedAt: null,
        revokedAt: null,
        createdAt: new Date().toISOString(),
        deliveryChannel: "dev-console",
        deliveryStatus: "SENT",
        lastSentAt: new Date().toISOString(),
      };
      insertInvitation(invitation);
      appendSignatureEvent({
        signatureRequestId: request.id,
        contractId: contract.id,
        participantId: participant.id,
        type: "INVITATION_SENT",
        descriptionFa: `دعوت‌نامهٔ نمونه برای ${participant.roleFa} در کنسول توسعه ثبت شد (بدون ارسال پیامک واقعی).`,
        contractVersionId: request.contractVersionId,
        documentHash: request.documentHash,
        metadata: { channel: "dev-console", sample: true },
      });
    }
  } catch {
    // A dev seed must never break the app it is preparing data for. The
    // real flows and their tests are the proof of correctness; this is
    // convenience data.
  }
}
