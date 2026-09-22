// ============================================================
// LEGALIR — Wizard step: documents
// ============================================================
// The checklist is declared by the contract definition, not by this
// component: each required document gets an upload slot, and the
// required ones block signing until they are present. Uploads go
// straight to the contract's own authorized endpoint; previews are
// streamed from the same owner-scoped route, so no public URL is
// ever produced.
// ============================================================

"use client";

import React, { useRef, useState } from "react";
import { Button, Dialog } from "@legalir/ui";
import { IconUpload, IconDelete, IconDocument, IconFile } from "@/lib/icons";
import { useWizard } from "../wizard-context";
import { SectionCard, Notice } from "../primitives";
import { getContractDefinition } from "@/lib/contracts/registry";
import {
  useDeleteContractDocument,
  useUploadContractDocument,
} from "@/hooks/usePropertyContracts";
import { contractDocumentUrl } from "@/lib/api/property-contracts";
import type { ContractDocument, ContractDocumentCategory } from "@legalir/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
}

/** Inline preview streamed from the owner-scoped contract route. */
function DocumentPreview({ contractId, doc }: { contractId: string; doc: ContractDocument }) {
  const url = contractDocumentUrl(contractId, doc.id);

  if (doc.mime.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={doc.fileName} className="w-full rounded-medium border border-divider" />
    );
  }
  if (doc.mime === "application/pdf") {
    return (
      <iframe
        src={url}
        title={doc.fileName}
        className="w-full h-[70vh] rounded-medium border border-divider"
      />
    );
  }
  return (
    <div className="rounded-medium border border-divider bg-surface-container-low p-6 text-center">
      <IconDocument className="w-10 h-10 mx-auto text-muted" />
      <p className="text-body-2 text-on-surface mt-2">
        پیش‌نمایش این فرمت در مرورگر پشتیبانی نمی‌شود.
      </p>
      <p className="text-caption text-muted mt-1">برای مشاهده، فایل را دانلود کنید.</p>
    </div>
  );
}

/** One upload slot for a document category. */
function DocumentSlot({
  contractId,
  category,
  labelFa,
  required,
  providerFa,
  documents,
  editable,
}: {
  contractId: string;
  category: ContractDocumentCategory;
  labelFa: string;
  required: boolean;
  providerFa: string;
  documents: ContractDocument[];
  editable: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadContractDocument();
  const remove = useDeleteContractDocument();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ContractDocument | null>(null);

  const existing = documents.filter((d) => d.category === category);

  async function onPick(file: File) {
    setError(null);
    try {
      await upload.mutateAsync({ id: contractId, file, category });
    } catch (e) {
      setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود");
    }
  }

  return (
    <div className="rounded-medium border border-divider bg-surface-container-low p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-2 text-on-surface flex items-center gap-2">
            {labelFa}
            {required ? (
              <span className="text-labelSmall rounded-small bg-error-50 text-error px-1.5 py-0.5">
                الزامی
              </span>
            ) : (
              <span className="text-labelSmall rounded-small bg-surface-container px-1.5 py-0.5 text-muted">
                اختیاری
              </span>
            )}
          </p>
          <p className="text-caption text-muted mt-0.5">تهیه‌کننده: {providerFa}</p>
        </div>
        {editable && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<IconUpload className="w-4 h-4" />}
            loading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            بارگذاری
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="application/pdf,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onPick(file);
        }}
      />

      {error && <p className="text-caption text-error">{error}</p>}

      {existing.length === 0 ? (
        <p className="text-caption text-muted">فایلی بارگذاری نشده است.</p>
      ) : (
        <ul className="space-y-1.5">
          {existing.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-small bg-surface px-2.5 py-2"
            >
              <button
                type="button"
                onClick={() => setPreview(doc)}
                className="min-w-0 flex items-center gap-2 text-right hover:underline"
              >
                <IconFile className="w-4 h-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-body-2 text-on-surface truncate">{doc.fileName}</span>
                  <span className="block text-caption text-muted">{formatSize(doc.sizeBytes)}</span>
                </span>
              </button>
              {editable && (
                <button
                  type="button"
                  aria-label={`حذف ${doc.fileName}`}
                  onClick={() => remove.mutate({ id: contractId, documentId: doc.id })}
                  className="shrink-0 text-muted hover:text-error"
                >
                  <IconDelete className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.fileName}
        maxWidth="lg"
        actions={
          preview ? (
            <a
              href={contractDocumentUrl(contractId, preview.id, true)}
              className="text-labelLarge text-primary hover:underline"
            >
              دانلود فایل
            </a>
          ) : undefined
        }
      >
        {preview && <DocumentPreview contractId={contractId} doc={preview} />}
      </Dialog>
    </div>
  );
}

const PROVIDER_FA: Record<string, string> = {
  initiator: "شما",
  counterparty: "طرف مقابل",
  either: "هر یک از طرفین",
};

export function DocumentsStep() {
  const { contract, editable } = useWizard();
  const def = getContractDefinition(contract.type);
  const documents = contract.documents;

  const requiredMissing = def.requiredDocuments.filter(
    (d) => d.required && !documents.some((doc) => doc.category === d.category)
  );

  return (
    <div className="space-y-4">
      <Notice tone={requiredMissing.length === 0 ? "success" : "info"} title="مدارک لازم">
        {requiredMissing.length === 0
          ? "همه مدارک الزامی بارگذاری شده است."
          : `${requiredMissing.length} مدرک الزامی باقی مانده است: ${requiredMissing
              .map((d) => d.labelFa)
              .join("، ")}`}
      </Notice>

      <SectionCard title="چک‌لیست مدارک" description="هر مدرک را در جای خود بارگذاری کنید">
        <div className="space-y-3">
          {def.requiredDocuments.map((d) => (
            <DocumentSlot
              key={d.category}
              contractId={contract.id}
              category={d.category}
              labelFa={d.labelFa}
              required={d.required}
              providerFa={PROVIDER_FA[d.provider] ?? d.provider}
              documents={documents}
              editable={editable}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
