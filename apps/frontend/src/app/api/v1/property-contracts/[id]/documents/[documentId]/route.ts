// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/documents/[documentId]
// ============================================================
// GET    — stream the stored bytes (inline for preview, attachment
//          when `?download=1`). The contract is resolved through the
//          owner-scoped guard first, so a leaked storage key is
//          useless without a session that owns the contract.
// DELETE — remove the row and its bytes.
// ============================================================

import { NextResponse } from "next/server";
import {
  audit,
  isErrorResponse,
  notFound,
  ok,
  refreshProgress,
  requireContract,
} from "@/lib/contracts/api-helpers";
import {
  deleteContractDocument,
  getContractDocument,
} from "@/lib/contracts/db";
import { deleteContractFile, resolveContractFile } from "@/lib/contracts/storage";
import { isEditable } from "@/lib/contracts/state-machine";

type Params = { params: Promise<{ id: string; documentId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id, documentId } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const doc = getContractDocument(ctx.contract.id, documentId);
  if (!doc) return notFound("سند یافت نشد");

  const absolute = resolveContractFile(doc.storageKey);
  if (!absolute) return notFound("فایل سند یافت نشد");

  const fs = await import("node:fs");
  const bytes = fs.readFileSync(absolute);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const disposition = download ? "attachment" : "inline";

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": doc.mime || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id, documentId } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;
  if (!isEditable(contract.state)) {
    return notFound("این قرارداد در وضعیت فعلی قابل ویرایش نیست.");
  }

  const doc = getContractDocument(contract.id, documentId);
  if (!doc) return notFound("سند یافت نشد");

  deleteContractFile(doc.storageKey);
  deleteContractDocument(contract.id, documentId);
  refreshProgress(userId, contract.id);

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "document.deleted",
    descriptionFa: `سند «${doc.fileName}» حذف شد.`,
    metadata: { category: doc.category, documentId },
  });

  return ok({ id: documentId, deleted: true });
}
