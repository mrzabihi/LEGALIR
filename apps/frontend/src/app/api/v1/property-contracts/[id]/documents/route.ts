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

import type {
  ContractDocument,
  ContractDocumentCategory,
  ContractSupplementary,
  ContractSupplementaryAttachment,
} from "@legalir/types";
import { SUPPORTED_DOCUMENT_MIMES, MAX_DOCUMENT_SIZE_BYTES } from "@legalir/types";
import {
  audit,
  badRequest,
  isErrorResponse,
  ok,
  refreshProgress,
  requireContract,
  requireContractRead,
} from "@/lib/contracts/api-helpers";
import {
  getContractForUser,
  insertContractDocument,
  listContractDocuments,
  mergeContractData,
} from "@/lib/contracts/db";
import { getContractDefinition } from "@/lib/contracts/registry";
import { writeContractFile } from "@/lib/contracts/storage";
import { isEditable } from "@/lib/contracts/state-machine";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  // Attachments are part of what a referred lawyer must be able to read to
  // review the contract; the upload handler below stays owner-only.
  const ctx = requireContractRead(request, id);
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
  // The type's own checklist, plus the user's annex slot. `contract_annex`
  // is deliberately available for EVERY type: a «پیوست قرارداد» is a file
  // the user chooses to make part of their agreement, not a checklist item
  // the type declares.
  const allowed: ContractDocumentCategory[] = [
    ...def.requiredDocuments.map((d) => d.category),
    "contract_annex",
  ];
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

  // A «پیوست قرارداد» is part of the agreement, so the printable annex list
  // is written into the contract's own domain data at the same moment the
  // bytes are stored. The version snapshot therefore carries BOTH the file
  // hash (documents manifest) and the label the contract prints — the two
  // can never drift apart.
  if (doc.category === "contract_annex") {
    registerAnnex(userId, contract.id, doc, String(form.get("titleFa") ?? ""));
  }

  refreshProgress(userId, contract.id);

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: doc.category === "contract_annex" ? "document.annex.uploaded" : "document.uploaded",
    descriptionFa:
      doc.category === "contract_annex"
        ? `پیوست قرارداد «${file.name}» ثبت شد.`
        : `سند «${file.name}» بارگذاری شد.`,
    metadata: { category, documentId, hash: stored.hash },
  });

  return ok(
    doc.category === "contract_annex"
      ? { ...doc, annexTitleFa: annexTitleOf(doc, String(form.get("titleFa") ?? "")) }
      : doc,
    201
  );
}

/** The printed label of an annex: the user's title, else the file name. */
function annexTitleOf(doc: ContractDocument, titleFa: string): string {
  const title = titleFa.trim();
  return title.length > 0 ? title : doc.fileName;
}

/**
 * Append the annex entry to `data.supplementary`. Any edit to the list
 * invalidates the earlier «تأیید پیوست‌ها» confirmation, so a confirmation
 * always refers to exactly the annexes now on screen.
 */
function registerAnnex(
  userId: string,
  contractId: string,
  doc: ContractDocument,
  titleFa: string
): void {
  const current = getContractForUser(userId, contractId);
  if (!current) return;
  const supplementary: ContractSupplementary = current.data.supplementary ?? { notes: "" };
  const entry: ContractSupplementaryAttachment = {
    documentId: doc.id,
    titleFa: annexTitleOf(doc, titleFa),
    fileName: doc.fileName,
    mime: doc.mime,
    sizeBytes: doc.sizeBytes,
    hash: doc.hash,
    addedAt: doc.uploadedAt,
  };
  mergeContractData(userId, contractId, {
    supplementary: {
      ...supplementary,
      attachments: [...(supplementary.attachments ?? []), entry],
      attachmentsConfirmedAt: null,
      confirmedAt: null,
    },
  } as never);
}
