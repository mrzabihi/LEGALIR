// ============================================================
// LEGALIR — /api/v1/admin/contracts/[id]/evidence
// ============================================================
// Administrative evidence upload. When a signature was given OUTSIDE
// the platform — a wet-ink signature on a printed copy, witnessed by an
// operator — an admin records the supporting evidence here.
//
// This is EVIDENCE, not a signature:
//   • it NEVER changes a participant's status and NEVER advances the
//     contract state. An admin cannot sign on a party's behalf (§).
//   • the file is stored in the PRIVATE contract storage root — no
//     public URL is ever produced.
//   • the upload is bound to the CURRENT version hash in the audit
//     metadata, so the evidence names the exact version it supports.
//
// GET  — the evidence documents recorded for a contract.
// POST — upload one evidence file (multipart/form-data).
// ============================================================

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ContractDocument } from "@legalir/types";
import { SUPPORTED_DOCUMENT_MIMES, MAX_DOCUMENT_SIZE_BYTES } from "@legalir/types";
import { requirePermission } from "@/lib/rbac";
import { findUserById } from "@/lib/db";
import { recordAudit } from "@/lib/admin/audit";
import { adminError, requestMeta } from "@/lib/admin/http";
import {
  getContractById,
  getVersion,
  insertContractDocument,
  listContractDocuments,
} from "@/lib/contracts/db";
import { writeContractFile } from "@/lib/contracts/storage";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requirePermission(request, "admin:contracts:review");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  const evidence = listContractDocuments(contract.id).filter(
    (d) => d.category === "wet_ink_evidence"
  );

  return NextResponse.json({
    data: {
      contractId: contract.id,
      currentVersionId: contract.currentVersionId,
      evidence: evidence.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        mime: d.mime,
        sizeBytes: d.sizeBytes,
        hash: d.hash,
        description: d.description,
        uploadedAt: d.uploadedAt,
      })),
    },
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = requirePermission(request, "admin:contracts:review");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const contract = getContractById(id);
  if (!contract) return adminError(404, "NOT_FOUND", "قرارداد یافت نشد");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
  }

  const file = form.get("file");
  const description = String(form.get("description") ?? "").trim();

  if (!(file instanceof File)) {
    return adminError(400, "NO_FILE", "شاهدی بارگذاری نشده است");
  }
  if (description.length < 3) {
    return adminError(400, "REASON_REQUIRED", "توضیح شاهد امضای دستی الزامی است");
  }
  if (!(SUPPORTED_DOCUMENT_MIMES as readonly string[]).includes(file.type)) {
    return adminError(400, "UNSUPPORTED_FORMAT", "فرمت فایل پشتیبانی نمی‌شود");
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return adminError(400, "FILE_TOO_LARGE", "حجم فایل بیش از حد مجاز است");
  }

  const currentVersion = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;

  const documentId = `doc-${crypto.randomUUID()}`;
  let stored;
  try {
    stored = writeContractFile({
      contractId: contract.id,
      documentId,
      fileName: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
  } catch {
    return adminError(500, "STORAGE_FAILED", "ذخیره فایل ناموفق بود");
  }

  const doc: ContractDocument = {
    id: documentId,
    contractId: contract.id,
    category: "wet_ink_evidence",
    fileName: file.name,
    mime: file.type,
    sizeBytes: stored.sizeBytes,
    storageKey: stored.storageKey,
    hash: stored.hash,
    description,
    photoCategory: null,
    uploadedBy: auth.ctx.userId,
    uploadedAt: new Date().toISOString(),
  };
  insertContractDocument(doc);

  const actor = findUserById(auth.ctx.userId);
  const actorName = actor?.displayName?.trim() || "مدیر لیگالیر";

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: "contract.wet_ink_evidence.recorded",
    resourceType: "property_contract",
    resourceId: contract.id,
    reason: description,
    // The evidence is bound to the exact version hash it supports; the
    // contract state and every participant status are UNCHANGED.
    before: { state: contract.state, documentHash: currentVersion?.documentHash ?? null },
    after: {
      state: contract.state,
      documentHash: currentVersion?.documentHash ?? null,
      evidenceDocumentId: documentId,
      evidenceHash: stored.hash,
    },
    ...requestMeta(request),
  });

  return NextResponse.json({
    data: {
      evidence: {
        id: doc.id,
        fileName: doc.fileName,
        hash: doc.hash,
        sizeBytes: doc.sizeBytes,
        documentHash: currentVersion?.documentHash ?? null,
      },
      recordedByLabelFa: actorName,
      // No status change: this is evidence only (§ requirement).
      stateChanged: false,
    },
  });
}
