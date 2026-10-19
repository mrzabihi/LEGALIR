// ============================================================
// LEGALIR — Admin print controls (server-only)
// ============================================================
// Three persisted controls live here, all of them bound to the print
// output rather than to the screen:
//
//   contract-admin-messages   one ≤100-character message per contract,
//                             printed in red on the last contract page.
//   contract-contact-changes  append-only history of a destination
//                             number corrected before an invitation was
//                             sent, including the delivery outcome.
//
// The module also PLANS the annex pages and the signature images the
// PDF renderer must embed. Planning never silently drops a file: every
// attachment/signature that cannot be printed becomes a
// `ContractPrintIssue` the caller must surface before finalisation.
// ============================================================

import crypto from "node:crypto";
import type {
  ContractAdminMessage,
  ContractContactChange,
  ContractDocument,
  ContractPrintIssue,
  PropertyContract,
  SignatureParticipant,
} from "@legalir/types";
import { CONTRACT_ADMIN_MESSAGE_MAX } from "@legalir/types";
import { readTable, writeTable } from "@/lib/db";
import { resolveContractFile } from "./storage";

const T_MESSAGES = "contract-admin-messages";
const T_CONTACT_CHANGES = "contract-contact-changes";

// ------------------------------------------------------------
// Printable formats
// ------------------------------------------------------------
// PDF pages can be copied 1:1; PNG/JPEG can be embedded with their
// aspect ratio preserved. Everything else (DOCX, WEBP) is a hard
// error before finalisation — a contract that cannot print its annexes
// must not pretend it did.

export const PRINTABLE_ATTACHMENT_MIMES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

export const PRINTABLE_SIGNATURE_MIMES = ["image/png", "image/jpeg"] as const;

export function isPrintableAttachmentMime(mime: string): boolean {
  return (PRINTABLE_ATTACHMENT_MIMES as readonly string[]).includes(mime);
}

function isPrintableSignatureMime(mime: string): boolean {
  return (PRINTABLE_SIGNATURE_MIMES as readonly string[]).includes(mime);
}

/**
 * The formats a party's signature scan may use. Exported so the signing
 * route can refuse a scan the PDF renderer could never embed — the same
 * rule the print planner applies, applied at the moment of signing.
 */
export function isPrintableSignatureScan(mime: string): boolean {
  return isPrintableSignatureMime(mime);
}

function formatFa(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "PDF";
    case "image/png":
      return "PNG";
    case "image/jpeg":
      return "JPEG";
    case "image/webp":
      return "WEBP";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "Word (DOCX)";
    default:
      return mime || "نامشخص";
  }
}

// ------------------------------------------------------------
// The admin message
// ------------------------------------------------------------

/** Characters counted the way the UI counter counts them (code points). */
export function adminMessageLength(messageFa: string): number {
  return Array.from(messageFa).length;
}

export function getAdminMessage(contractId: string): ContractAdminMessage | null {
  return (
    readTable<ContractAdminMessage>(T_MESSAGES).find((m) => m.contractId === contractId) ?? null
  );
}

export type SetAdminMessageResult =
  | { ok: true; message: ContractAdminMessage | null }
  | { ok: false; code: "TOO_LONG"; errorFa: string };

/**
 * Upsert the printable message. An empty (or whitespace-only) message
 * REMOVES the row, so "no message" prints no marker and leaves no empty
 * reserved space on the last page.
 */
export function setAdminMessage(params: {
  contractId: string;
  messageFa: string;
  adminUserId: string;
  adminLabelFa: string;
}): SetAdminMessageResult {
  const messageFa = params.messageFa.trim();
  if (adminMessageLength(messageFa) > CONTRACT_ADMIN_MESSAGE_MAX) {
    return {
      ok: false,
      code: "TOO_LONG",
      errorFa: `متن پیام حداکثر ${CONTRACT_ADMIN_MESSAGE_MAX} کاراکتر می‌تواند باشد.`,
    };
  }

  const rows = readTable<ContractAdminMessage>(T_MESSAGES);
  const idx = rows.findIndex((m) => m.contractId === params.contractId);
  const now = new Date().toISOString();

  if (messageFa.length === 0) {
    if (idx !== -1) {
      rows.splice(idx, 1);
      writeTable(T_MESSAGES, rows);
    }
    return { ok: true, message: null };
  }

  if (idx === -1) {
    const row: ContractAdminMessage = {
      contractId: params.contractId,
      messageFa,
      adminUserId: params.adminUserId,
      adminLabelFa: params.adminLabelFa,
      createdAt: now,
      updatedAt: now,
    };
    rows.push(row);
    writeTable(T_MESSAGES, rows);
    return { ok: true, message: row };
  }

  const row: ContractAdminMessage = {
    ...rows[idx]!,
    messageFa,
    adminUserId: params.adminUserId,
    adminLabelFa: params.adminLabelFa,
    updatedAt: now,
  };
  rows[idx] = row;
  writeTable(T_MESSAGES, rows);
  return { ok: true, message: row };
}

// ------------------------------------------------------------
// Destination-number corrections
// ------------------------------------------------------------

export function listContactChanges(contractId: string): ContractContactChange[] {
  return readTable<ContractContactChange>(T_CONTACT_CHANGES)
    .filter((c) => c.contractId === contractId)
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

export function recordContactChange(params: {
  contractId: string;
  signatureRequestId: string | null;
  participantId: string | null;
  partyId: string | null;
  roleFa: string;
  nameFa: string;
  previousMobile: string;
  newMobile: string;
  reasonFa: string;
  adminUserId: string;
  adminLabelFa: string;
}): ContractContactChange {
  const row: ContractContactChange = {
    id: `cch-${crypto.randomUUID()}`,
    contractId: params.contractId,
    signatureRequestId: params.signatureRequestId,
    participantId: params.participantId,
    partyId: params.partyId,
    roleFa: params.roleFa,
    nameFa: params.nameFa,
    previousMobile: params.previousMobile,
    newMobile: params.newMobile,
    reasonFa: params.reasonFa,
    adminUserId: params.adminUserId,
    adminLabelFa: params.adminLabelFa,
    changedAt: new Date().toISOString(),
    deliveryStatus: null,
    deliveryChannel: null,
    deliveryDetail: null,
    deliveredAt: null,
  };
  const rows = readTable<ContractContactChange>(T_CONTACT_CHANGES);
  rows.push(row);
  writeTable(T_CONTACT_CHANGES, rows);
  return row;
}

/** Record the outcome of sending the link to the corrected number. */
export function recordContactChangeDelivery(
  changeId: string,
  params: {
    deliveryStatus: "SENT" | "FAILED";
    deliveryChannel: "sms" | "dev-console" | "none";
    deliveryDetail: string | null;
  }
): ContractContactChange | null {
  const rows = readTable<ContractContactChange>(T_CONTACT_CHANGES);
  const idx = rows.findIndex((c) => c.id === changeId);
  if (idx === -1) return null;
  const row: ContractContactChange = {
    ...rows[idx]!,
    deliveryStatus: params.deliveryStatus,
    deliveryChannel: params.deliveryChannel,
    deliveryDetail: params.deliveryDetail,
    deliveredAt: new Date().toISOString(),
  };
  rows[idx] = row;
  writeTable(T_CONTACT_CHANGES, rows);
  return row;
}

// ------------------------------------------------------------
// Annex pages — registration order, then unregistered uploads
// ------------------------------------------------------------

export interface ContractAnnexPlan {
  document: ContractDocument;
  /** «عنوان پیوست» printed above the annexed content. */
  titleFa: string;
  mime: string;
  /** Absolute file path, or null when the stored file is gone. */
  absolutePath: string | null;
}

export interface AnnexPlanResult {
  annexes: ContractAnnexPlan[];
  issues: ContractPrintIssue[];
}

/** `documentId → titleFa` for the annexes the user registered. */
function registeredAnnexTitles(contract: PropertyContract): Map<string, string> {
  const attachments = contract.data?.supplementary?.attachments ?? [];
  const map = new Map<string, string>();
  for (const attachment of attachments) {
    if (attachment.documentId) map.set(attachment.documentId, attachment.titleFa || attachment.fileName);
  }
  return map;
}

/**
 * The annexes the PDF must append, in REGISTRATION order. A
 * `contract_annex` upload that was never registered is appended after
 * the registered ones (oldest first) rather than dropped — the file is
 * part of the contract the moment it was uploaded.
 */
export function planContractAnnexes(params: {
  contract: PropertyContract;
  documents: ContractDocument[];
}): AnnexPlanResult {
  const registered = registeredAnnexTitles(params.contract);
  const annexDocs = params.documents.filter((d) => d.category === "contract_annex");

  const ordered: ContractAnnexPlan[] = [];
  const seen = new Set<string>();

  for (const [documentId, titleFa] of registered) {
    const document = annexDocs.find((d) => d.id === documentId);
    if (!document) {
      // Registered but the row is gone: the printed annex table already
      // promises this file, so the PDF must report it, not skip it.
      if (!seen.has(documentId)) {
        ordered.push({
          document: {
            id: documentId,
            contractId: params.contract.id,
            category: "contract_annex",
            fileName: titleFa,
            mime: "",
            sizeBytes: 0,
            storageKey: "",
            hash: "",
            description: "",
            photoCategory: null,
            uploadedBy: "",
            uploadedAt: "",
          },
          titleFa,
          mime: "",
          absolutePath: null,
        });
        seen.add(documentId);
      }
      continue;
    }
    if (seen.has(document.id)) continue;
    ordered.push({
      document,
      titleFa: titleFa || document.fileName,
      mime: document.mime,
      absolutePath: resolveContractFile(document.storageKey),
    });
    seen.add(document.id);
  }

  const orphans = annexDocs
    .filter((d) => !seen.has(d.id))
    .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  for (const document of orphans) {
    ordered.push({
      document,
      titleFa: document.fileName,
      mime: document.mime,
      absolutePath: resolveContractFile(document.storageKey),
    });
    seen.add(document.id);
  }

  const issues: ContractPrintIssue[] = [];
  for (const annex of ordered) {
    if (!annex.mime) continue; // already reported as a missing registered row below
    if (!isPrintableAttachmentMime(annex.mime)) {
      issues.push({
        code: "ATTACHMENT_UNPRINTABLE",
        documentId: annex.document.id,
        titleFa: annex.titleFa,
        messageFa: `پیوست «${annex.titleFa}» با قالب ${formatFa(
          annex.mime
        )} قابل چاپ در PDF نیست. آن را به PDF یا تصویر PNG/JPEG تبدیل کنید.`,
      });
      continue;
    }
    if (!annex.absolutePath) {
      issues.push({
        code: "ATTACHMENT_UNREADABLE",
        documentId: annex.document.id,
        titleFa: annex.titleFa,
        messageFa: `فایل پیوست «${annex.titleFa}» در مخزن اسناد یافت نشد و در PDF چاپ نمی‌شود.`,
      });
    }
  }

  return { annexes: ordered, issues };
}

// ------------------------------------------------------------
// Signature images — one per uploaded wet-ink scan
// ------------------------------------------------------------

export interface SignatureImagePlan {
  participant: SignatureParticipant;
  mime: string;
  absolutePath: string | null;
}

export interface SignatureImagePlanResult {
  images: SignatureImagePlan[];
  issues: ContractPrintIssue[];
}

/**
 * Resolve every participant's uploaded signature scan. OTP signatures
 * carry no image (the status text is their proof) and are not listed
 * here; a party that uploaded a scan gets an image in ITS OWN cell.
 */
export function planSignatureImages(params: {
  participants: SignatureParticipant[];
  documents: ContractDocument[];
}): SignatureImagePlanResult {
  const images: SignatureImagePlan[] = [];
  const issues: ContractPrintIssue[] = [];

  for (const participant of params.participants) {
    if (!participant.proofDocumentId) continue;
    const document = params.documents.find((d) => d.id === participant.proofDocumentId);
    if (!document) {
      issues.push({
        code: "SIGNATURE_UNREADABLE",
        documentId: participant.proofDocumentId,
        titleFa: participant.nameFa || participant.roleFa,
        messageFa: `تصویر امضای «${participant.nameFa || participant.roleFa}» در مخزن اسناد یافت نشد.`,
      });
      continue;
    }
    if (!isPrintableSignatureMime(document.mime)) {
      issues.push({
        code: "SIGNATURE_UNPRINTABLE",
        documentId: document.id,
        titleFa: participant.nameFa || participant.roleFa,
        messageFa: `تصویر امضای «${participant.nameFa || participant.roleFa}» با قالب ${formatFa(
          document.mime
        )} قابل درج در PDF نیست. آن را به PNG یا JPEG تبدیل کنید.`,
      });
      continue;
    }
    const absolutePath = resolveContractFile(document.storageKey);
    if (!absolutePath) {
      issues.push({
        code: "SIGNATURE_UNREADABLE",
        documentId: document.id,
        titleFa: participant.nameFa || participant.roleFa,
        messageFa: `فایل تصویر امضای «${participant.nameFa || participant.roleFa}» در مخزن اسناد یافت نشد.`,
      });
      continue;
    }
    images.push({ participant, mime: document.mime, absolutePath });
  }

  return { images, issues };
}

/** Every reason the current contract cannot print faithfully. */
export function contractPrintIssues(params: {
  contract: PropertyContract;
  documents: ContractDocument[];
  participants: SignatureParticipant[];
}): ContractPrintIssue[] {
  const annex = planContractAnnexes({ contract: params.contract, documents: params.documents });
  const signatures = planSignatureImages({
    participants: params.participants,
    documents: params.documents,
  });
  return [...annex.issues, ...signatures.issues];
}

/** True when nothing blocks a faithful print. */
export function canPrintFaithfully(issues: ContractPrintIssue[]): boolean {
  return issues.length === 0;
}
