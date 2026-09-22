// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/documents
// ============================================================
// GET  — the documents attached to a contract the user owns.
// POST — upload one document (multipart/form-data).
//
// Files are written to the private contract storage root and are
// only ever served through the authorized download route; no public
// URL is produced. The category must be one the contract type
// declares, so the checklist cannot be polluted with stray rows.
// ============================================================

import type { ContractDocument, ContractDocumentCategory } from "@legalir/types";
import { SUPPORTED_DOCUMENT_MIMES, MAX_DOCUMENT_SIZE_BYTES } from "@legalir/types";
import {
  audit,
  badRequest,
  isErrorResponse,
  ok,
  refreshProgress,
  requireContract,
} from "@/lib/contracts/api-helpers";
import { insertContractDocument, listContractDocuments } from "@/lib/contracts/db";
import { getContractDefinition } from "@/lib/contracts/registry";
import { writeContractFile } from "@/lib/contracts/storage";
import { isEditable } from "@/lib/contracts/state-machine";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;
  return ok(listContractDocuments(ctx.contract.id));
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;
  if (!isEditable(contract.state)) {
    return badRequest("این قرارداد در وضعیت فعلی قابل ویرایش نیست.", "NOT_EDITABLE");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("بدنه درخواست نامعتبر است");
  }

  const file = form.get("file");
  const category = String(form.get("category") ?? "");
  const description = String(form.get("description") ?? "");
  const photoCategory = form.get("photoCategory");

  if (!(file instanceof File)) {
    return badRequest("فایلی انتخاب نشده است", "NO_FILE");
  }

  const def = getContractDefinition(contract.type);
  const allowed = def.requiredDocuments.map((d) => d.category);
  if (!allowed.includes(category as ContractDocumentCategory)) {
    return badRequest("دسته‌بندی سند برای این قرارداد معتبر نیست", "INVALID_CATEGORY");
  }

  if (!(SUPPORTED_DOCUMENT_MIMES as readonly string[]).includes(file.type)) {
    return badRequest("فرمت فایل پشتیبانی نمی‌شود", "UNSUPPORTED_FORMAT");
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return badRequest("حجم فایل بیش از حد مجاز است", "FILE_TOO_LARGE");
  }

  const documentId = `doc-${crypto.randomUUID()}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  let stored;
  try {
    stored = writeContractFile({
      contractId: contract.id,
      documentId,
      fileName: file.name,
      bytes,
    });
  } catch {
    return badRequest("ذخیره فایل ناموفق بود", "STORAGE_FAILED");
  }

  const doc: ContractDocument = {
    id: documentId,
    contractId: contract.id,
    category: category as ContractDocumentCategory,
    fileName: file.name,
    mime: file.type,
    sizeBytes: stored.sizeBytes,
    storageKey: stored.storageKey,
    hash: stored.hash,
    description,
    photoCategory: typeof photoCategory === "string" && photoCategory ? photoCategory : null,
    uploadedBy: userId,
    uploadedAt: new Date().toISOString(),
  };

  insertContractDocument(doc);
  refreshProgress(userId, contract.id);

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "document.uploaded",
    descriptionFa: `سند «${file.name}» بارگذاری شد.`,
    metadata: { category, documentId, hash: stored.hash },
  });

  return ok(doc, 201);
}
