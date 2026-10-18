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
  ContractDocument,
  ContractParty,
  PropertyContract,
  PropertyRentData,
  SignatureInvitation,
} from "@legalir/types";
import { getContractDefinition } from "./registry";
import {
  getContractById,
  getVersion,
  insertContract,
  insertContractDocument,
  listContractDocuments,
  listContractsForUser,
  listParties,
  mergeContractData,
  updateContractForUser,
  upsertParty,
} from "./db";
import { writeContractFile } from "./storage";
import { createVersion } from "./snapshot";
import {
  appendAdminReviewEvent,
  createPendingReview,
  currentVersionApproval,
  updateAdminReview,
} from "./admin-review";
import {
  activeSignatureRequest,
  appendSignatureEvent,
  insertInvitation,
  latestSignatureRequest,
  listParticipants,
} from "./signature/db";
import {
  createSignatureRequest,
  requestOtpForParticipant,
  verifyOtpForParticipant,
  type SignContext,
} from "./signature/workflow";
import { DEV_OTP } from "./signature/otp-provider";
import { smsConfigured } from "../sms/gateway";
import { isContractFeatureEnabled } from "./feature-flags";
import {
  appendStampEvent,
  createPendingStampRequest,
  isCurrentVersionStamped,
  updateStampRequest,
} from "./stamp-review";
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
    // One recorded condition, so the handover checklist is a real record
    // rather than the untouched `unrecorded` scaffold. The remaining items
    // may legitimately stay unrecorded — the same rule the wizard applies.
    handover: {
      ...(base.handover ?? {}),
      items: (base.handover?.items ?? []).map((item, index) =>
        index === 0
          ? {
              ...item,
              state: "intact" as const,
              note: "وضعیت ملک در تحویل نمونه ثبت شد.",
            }
          : item
      ),
    },
  } as PropertyRentData;
}

/** A tiny, real PNG so the sample's document rows point at actual bytes. */
const SAMPLE_DOCUMENT_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/**
 * Attach the contract type's REQUIRED documents, so the sample's admin
 * record is complete instead of permanently flagging «مدارک» as missing.
 * The rows are real: the bytes are written to the private contract
 * storage and the download route can serve them. Nothing leaves the
 * machine — this is the dev document root.
 */
function seedSampleDocuments(contractId: string, userId: string): void {
  const def = getContractDefinition("property_rent");
  const existing = new Set(listContractDocuments(contractId).map((d) => d.category));
  for (const required of def.requiredDocuments.filter((d) => d.required)) {
    if (existing.has(required.category)) continue;
    insertSampleDocument(contractId, userId, {
      category: required.category,
      fileName: `${required.category}-sample.png`,
      description: "نمونهٔ ساختگی برای نمایش چک‌لیست مدارک (محیط توسعه).",
    });
  }
  seedSampleAnnex(contractId, userId);
}

/** Write one sample file row; returns the stored row or null on failure. */
function insertSampleDocument(
  contractId: string,
  userId: string,
  params: {
    category: ContractDocument["category"];
    fileName: string;
    description: string;
  }
): ContractDocument | null {
  const documentId = `doc-${crypto.randomUUID()}`;
  let stored;
  try {
    stored = writeContractFile({
      contractId,
      documentId,
      fileName: params.fileName,
      bytes: SAMPLE_DOCUMENT_BYTES,
    });
  } catch {
    return null;
  }
  const doc: ContractDocument = {
    id: documentId,
    contractId,
    category: params.category,
    fileName: params.fileName,
    mime: "image/png",
    sizeBytes: stored.sizeBytes,
    storageKey: stored.storageKey,
    hash: stored.hash,
    description: params.description,
    photoCategory: null,
    uploadedBy: userId,
    uploadedAt: new Date().toISOString(),
  };
  insertContractDocument(doc);
  return doc;
}

/**
 * A real «پیوست قرارداد» for the sample: the file row AND the printable
 * annex entry, so the dev sample demonstrates both halves of the feature.
 * Idempotent — a sample that already has an annex is left alone.
 */
function seedSampleAnnex(contractId: string, userId: string): void {
  const contract = getContractById(contractId);
  if (!contract) return;
  const existing = contract.data.supplementary?.attachments ?? [];
  if (existing.length > 0) {
    // A previous build may have stored the file without the entry (or the
    // reverse); repair only when the document row is genuinely missing.
    const present = new Set(listContractDocuments(contractId).map((d) => d.id));
    const stillValid = existing.filter((a) => present.has(a.documentId));
    if (stillValid.length === existing.length) return;
    mergeContractData(userId, contractId, {
      supplementary: {
        ...(contract.data.supplementary ?? { notes: "" }),
        attachments: stillValid,
        attachmentsConfirmedAt: null,
      },
    } as never);
    return;
  }

  const doc = insertSampleDocument(contractId, userId, {
    category: "contract_annex",
    fileName: "annex-equipment-sample.png",
    description: "پیوست نمونهٔ ساختگی (محیط توسعه).",
  });
  if (!doc) return;
  const supplementary = contract.data.supplementary ?? { notes: "" };
  mergeContractData(userId, contractId, {
    supplementary: {
      ...supplementary,
      attachments: [
        ...(supplementary.attachments ?? []),
        {
          documentId: doc.id,
          titleFa: "فهرست تجهیزات تحویلی (نمونه)",
          fileName: doc.fileName,
          mime: doc.mime,
          sizeBytes: doc.sizeBytes,
          hash: doc.hash,
          addedAt: doc.uploadedAt,
        },
      ],
      attachmentsConfirmedAt: new Date().toISOString(),
    },
  } as never);
}

function sampleParty(params: {
  contractId: string;
  role: ContractParty["role"];
  isInitiator: boolean;
  firstName: string;
  lastName: string;
  mobile: string;
  nationalId: string;
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
      nationalId: params.nationalId,
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

/** Request states where a sample still has work left to do. */
const OPEN_REQUEST_STATES: readonly string[] = ["DRAFT", "SENT", "PARTIALLY_SIGNED"];

/**
 * Take a sample to the end of its lifecycle: every party signs through the
 * REAL OTP path, then the official seal is recorded once the parties have
 * signed — the same two preconditions the admin stamp route enforces.
 *
 * Idempotent and safe to re-run: signed participants are skipped, and a
 * version that already carries a valid stamp is left alone. It exists so a
 * sample seeded by an earlier build (or interrupted mid-flow) does not stay
 * forever at «ارسال‌شده» with nothing to inspect in the admin panel.
 */
async function completeSampleLifecycle(
  contract: PropertyContract,
  userId: string
): Promise<void> {
  // §2.7 — completing the lifecycle drives the REAL OTP workflow, which
  // delivers through the active gateway. With a real gateway configured
  // that would turn a dev seed into a text to a stranger's phone, so the
  // seed deliberately stops where the invitation was prepared and leaves
  // the request open for an operator to drive by hand.
  if (smsConfigured()) return;

  const label = "سامانهٔ نمونه (توسعه)";
  const ctxFor = (current: PropertyContract): SignContext => ({
    contract: current,
    actor: { userId, actorLabel: label },
    ownerId: userId,
    fingerprint: "dev-sample-seed",
  });

  const request = latestSignatureRequest(contract.id);
  if (request && OPEN_REQUEST_STATES.includes(request.status)) {
    for (const participant of listParticipants(request.id)) {
      if (participant.status === "SIGNED") continue;
      const current = getContractById(contract.id);
      if (!current) return;
      const ctx = ctxFor(current);
      // The OTP is requested and verified through the shipped workflow, so
      // the recorded signature is a real one (dev-console delivery, fixed
      // dev code) rather than a hand-written row.
      const issued = await requestOtpForParticipant(ctx, {
        participantId: participant.id,
      });
      if (!issued.ok) continue;
      verifyOtpForParticipant(ctx, {
        participantId: participant.id,
        code: DEV_OTP,
        consentGiven: true,
      });
    }
  }

  // §2.6 — the seal and hologram only draw when an APPLIED stamp request is
  // bound to the CURRENT version hash and the stamp master. Never fabricate
  // one: this mirrors the route's gates (review approval, all parties
  // signed, asset hash unchanged).
  if (!isContractFeatureEnabled("CONTRACT_STAMP_ENABLED")) return;
  const current = getContractById(contract.id);
  if (!current) return;
  const version = current.currentVersionId
    ? getVersion(current.id, current.currentVersionId)
    : null;
  const documentHash = version?.documentHash ?? null;
  if (!currentVersionApproval(current, documentHash)) return;
  if (isCurrentVersionStamped(current, documentHash)) return;
  const completed = latestSignatureRequest(current.id);
  if (!completed || completed.status !== "COMPLETED") return;

  const reasonFa = "درج مهر نمونهٔ آزمایشی پس از امضای همهٔ طرفین (محیط توسعه).";
  const stamp = createPendingStampRequest({
    contractId: current.id,
    contractVersionId: version?.id ?? null,
    documentHash,
    requestedById: userId,
    requestedByLabelFa: label,
    reasonFa,
  });
  appendStampEvent({
    stampRequestId: stamp.id,
    action: "request",
    actorId: userId,
    actorLabel: label,
    reasonFa,
    documentHash,
    stampAssetSha256: stamp.stampAssetSha256,
  });
  const appliedAt = new Date().toISOString();
  updateStampRequest(stamp.id, {
    status: "APPLIED",
    approvedById: userId,
    approvedByLabelFa: label,
    reasonFa,
    decidedAt: appliedAt,
    appliedAt,
  });
  appendStampEvent({
    stampRequestId: stamp.id,
    action: "apply",
    actorId: userId,
    actorLabel: label,
    reasonFa,
    documentHash,
    stampAssetSha256: stamp.stampAssetSha256,
  });
}

/**
 * Seed the dev sample contract. A no-op outside development. When the owner
 * already has one, it is COMPLETED instead of skipped: an older or
 * interrupted seed is finished so the demonstration data is always
 * inspectable end to end.
 */
export function seedSampleContract(userId: string): void {
  if (process.env.NODE_ENV !== "development") return;

  const existing = listContractsForUser(userId).find((c) => c.isSample);
  if (existing) {
    // Idempotent repair for a sample seeded by an older build. Frozen
    // versions are immutable snapshots and are never touched: only the
    // live working record is brought up to the current seed's shape, so
    // the admin completeness panel stops reporting a fixture as broken.
    try {
      repairSampleWorkingRecord(existing, userId);
    } catch {
      /* a repair must never break the boot */
    }
    void completeSampleLifecycle(existing, userId).catch((error: unknown) => {
      // Never fatal, but never silent either: a broken sample should be
      // visible in the dev log rather than leaving a half-filled fixture.
      console.warn("[legalir:sample-contract] lifecycle completion failed", error);
    });
    return;
  }

  // Two fake parties. The numbers are reserved-looking sample mobiles and
  // are NEVER dialled — no gateway is called anywhere in this module.
  // Checksum-valid but fictitious national IDs: the fee is the standard
  // check digit over a reserved-looking 9-digit body, so the party rows
  // pass the same validation a real party must pass rather than being
  // exempted from it. They belong to nobody.
  const parties = [
    {
      role: "landlord" as const,
      first: "نمونه",
      last: "موجر",
      mobile: "09120000091",
      nationalId: "1112345671",
    },
    {
      role: "tenant" as const,
      first: "نمونه",
      last: "مستاجر",
      mobile: "09120000092",
      nationalId: "2223456782",
    },
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
          nationalId: p.nationalId,
        })
      );
    });
    driveSampleFlow(contract, userId);
  } catch {
    // A dev seed must never break the app it is preparing data for. The
    // real flows and their tests are the proof of correctness; this is
    // convenience data.
    return;
  }

  // Now that the invitations exist, drive the rest of the lifecycle — the
  // signatures go through the shipped OTP workflow and the seal is only
  // recorded after every party has signed.
  const seeded = getContractById(contract.id);
  if (seeded) {
    void completeSampleLifecycle(seeded, userId).catch((error: unknown) => {
      console.warn("[legalir:sample-contract] lifecycle completion failed", error);
    });
  }
}

/**
 * Bring an older sample's LIVE working record up to the current seed:
 * the required documents (additive), a recorded handover condition and
 * checksum-valid national IDs.
 *
 * Frozen versions are snapshots and are deliberately left alone — the
 * approved version, the signatures and the seal stay bound to the exact
 * bytes that were signed. Only the working record is repaired, which is
 * what the completeness panel reads.
 */
function repairSampleWorkingRecord(contract: PropertyContract, userId: string): void {
  seedSampleDocuments(contract.id, userId);

  const handover = (contract.data as { handover?: { items?: { state?: string }[] } })
    .handover;
  const recorded = (handover?.items ?? []).some(
    (item) => Boolean(item.state) && item.state !== "unrecorded"
  );
  if (!recorded && handover?.items?.length) {
    // Only the handover block is rewritten — the seed's other answers,
    // the note and its confirmation times stay exactly as they are.
    updateContractForUser(userId, contract.id, {
      data: {
        ...(contract.data as unknown as Record<string, unknown>),
        handover: {
          ...handover,
          items: handover.items.map((item, index) =>
            index === 0
              ? { ...item, state: "intact", note: "وضعیت ملک در تحویل نمونه ثبت شد." }
              : item
          ),
        },
      },
    } as Partial<PropertyContract>);
  }

  // The national IDs are validated with the same rule a real party must
  // pass. The values are fictitious and belong to nobody; the frozen
  // snapshot keeps whatever it was signed with.
  const parties = listParties(contract.id);
  const fixed: Record<string, string> = {
    landlord: "1112345671",
    tenant: "2223456782",
  };
  for (const party of parties) {
    const nationalId = fixed[party.role];
    if (!nationalId) continue;
    if (party.identity.nationalId === nationalId) continue;
    upsertParty({ ...party, identity: { ...party.identity, nationalId } });
  }
}

/**
 * Freeze the version, approve it and open the signature request — the
 * same three steps the real builder performs, in the same order. Used by
 * both the first seed and the one-off repair of a stale sample.
 *
 * Documents must already be attached: the version hash covers their
 * manifest, so a document added afterwards makes the version stale.
 */
function driveSampleFlow(contract: PropertyContract, userId: string): void {
  seedSampleDocuments(contract.id, userId);

  // v1 — the draft that goes to review. Its hash is what the approval
  // binds to, and re-freezing the same content in `createSignatureRequest`
  // reproduces that exact hash.
  //
  // Re-read AFTER the documents are seeded: the annex entry and the
  // document manifest were written to the store, and `createVersion`
  // snapshots the object it is HANDED. Passing the pre-seed object would
  // freeze a contract that never included those annexes, and the version
  // frozen at signature time (which re-reads the store) would then hash
  // differently — exactly the drift the sample test guards against.
  const seededContract = getContractById(contract.id) ?? contract;
  const { version: draft } = createVersion(seededContract, userId);

  const reasonFa = "تأیید خودکار نمونهٔ آزمایشی برای اجرای کامل جریان.";
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
    reasonFa,
    contractVersionId: draft.id,
    documentHash: draft.documentHash,
  });
  updateAdminReview(review.id, {
    status: "APPROVED",
    reviewerId: userId,
    reviewerLabelFa: "سامانهٔ نمونه (توسعه)",
    reviewerInitials: "ن.آ",
    reasonFa,
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
}
