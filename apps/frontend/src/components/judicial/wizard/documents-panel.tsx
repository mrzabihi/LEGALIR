// ============================================================
// LEGALIR — Judicial documents stage
// ============================================================
// The step-3 surface. It deliberately reuses the product's ONE document
// system instead of inventing an upload path for this feature:
//
//   • new files go through the existing initiate/complete upload pair and land
//     in «اسناد من» like every other document;
//   • the picker lists the caller's OWN ready documents, each linked by id;
//   • the server resolves name/mime/size itself, so an id placed in the body
//     can never reach another user's file (a foreign id is a 404).
//
// Every row states its role, and unlinking is a soft unlink — the document
// itself is untouched in «اسناد من».
// ============================================================

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Select, snackbar } from "@legalir/ui";
import type {
  JudicialAttachment,
  JudicialAttachmentRole,
  JudicialReadyDocumentRef,
} from "@legalir/types";
import { JUDICIAL_ATTACHMENT_ROLE_FA } from "@legalir/types";
import { IconClose, IconFile, IconUpload, IconWarning } from "@/lib/icons";
import { UploadZone } from "@/components/documents/upload-zone";
import { useCompleteUpload, useInitiateUpload } from "@/hooks/useDocuments";
import {
  judicialKeys,
  useJudicialDocuments,
  useLinkJudicialDocument,
  useSetJudicialReadyDocument,
  useUnlinkJudicialDocument,
} from "@/hooks/useJudicial";
import { formatFileSize, toPersianDate } from "@/lib/persian-utils";

const ROLE_OPTIONS = (
  Object.entries(JUDICIAL_ATTACHMENT_ROLE_FA) as [JudicialAttachmentRole, string][]
).map(([value, label]) => ({ value, label }));

export interface DocumentsPanelProps {
  requestId: string;
  /** True on the ready-document start path — that flow needs ONE document. */
  readyDocumentPath: boolean;
  readyDocument: JudicialReadyDocumentRef | null;
  onContinue: () => void;
}

export function DocumentsPanel({
  requestId,
  readyDocumentPath,
  readyDocument,
  onContinue,
}: DocumentsPanelProps) {
  const picker = useJudicialDocuments(requestId);
  const link = useLinkJudicialDocument(requestId);
  const unlink = useUnlinkJudicialDocument(requestId);
  const setReady = useSetJudicialReadyDocument(requestId);
  const initiate = useInitiateUpload();
  const complete = useCompleteUpload();
  const qc = useQueryClient();

  const [role, setRole] = useState<JudicialAttachmentRole>("evidence");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const linked = picker.data?.linked ?? [];
  const available = picker.data?.available ?? [];
  const ready = picker.data?.readyDocument ?? readyDocument;

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const initiated = await initiate.mutateAsync({
        name: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });
      await complete.mutateAsync({ id: initiated.id, file });
      // The judicial picker reads the same `documents` rows, so refresh it —
      // the new file becomes selectable without a page reload.
      await qc.invalidateQueries({
        queryKey: judicialKeys.documents(requestId),
      });
      snackbar.show({ message: "فایل بارگذاری شد.", variant: "success" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "بارگذاری فایل ناموفق بود.";
      setError(message);
      snackbar.show({ message, variant: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function attach(documentId: string) {
    setError(null);
    try {
      await link.mutateAsync({ documentId, role });
    } catch (e) {
      setError(e instanceof Error ? e.message : "پیوست مدرک ناموفق بود.");
    }
  }

  async function detach(attachment: JudicialAttachment) {
    setError(null);
    try {
      await unlink.mutateAsync(attachment.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف پیوست ناموفق بود.");
    }
  }

  if (picker.isLoading) {
    return (
      <section className="animate-pulse space-y-3 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4">
        <div className="h-5 w-40 rounded bg-surface-container" />
        <div className="h-24 rounded-medium bg-surface-container" />
      </section>
    );
  }

  if (picker.isError) {
    return (
      <section className="rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4">
        <p className="flex items-center gap-2 text-body-2 text-on-surface">
          <IconWarning size={18} className="text-warning" />
          فهرست مدارک خوانده نشد.
        </p>
        <Button
          variant="outlined"
          size="small"
          className="mt-2"
          onClick={() => void picker.refetch()}
        >
          تلاش مجدد
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="judicial-documents-title"
      className="space-y-4 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5"
    >
      <div>
        <h2 id="judicial-documents-title" className="text-titleMedium text-on-surface">
          مدارک و مستندات
        </h2>
        <p className="mt-1 text-body-2 leading-6 text-on-surface-variant">
          {readyDocumentPath
            ? "در این مسیر، سند آمادهٔ خود را انتخاب می‌کنید. هیچ متنی توسط لیگالیر تولید نمی‌شود."
            : "هر فایل یا سند موجود خود را می‌توانید به این درخواست پیوست کنید. سند به «اسناد من» شما ارجاع داده می‌شود و نسخهٔ جداگانه‌ای ساخته نمی‌شود."}
        </p>
      </div>

      {/* Attached — role, size and unlink. */}
      {linked.length > 0 && (
        <ul className="space-y-2">
          {linked.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-start justify-between gap-3 rounded-medium border border-[color:var(--color-outline-variant)] p-3"
            >
              <div className="flex min-w-0 items-start gap-2">
                <IconFile
                  size={18}
                  className="mt-0.5 shrink-0 text-on-surface-variant"
                />
                <div className="min-w-0">
                  <p className="truncate text-labelLarge text-on-surface">
                    {attachment.name}
                  </p>
                  <p className="mt-0.5 text-caption text-on-surface-variant">
                    {JUDICIAL_ATTACHMENT_ROLE_FA[attachment.role]}
                    {" · "}
                    {formatFileSize(attachment.sizeBytes)}
                    {" · "}
                    پیوست در {toPersianDate(attachment.linkedAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void detach(attachment)}
                disabled={unlink.isPending}
                aria-label={`حذف پیوست ${attachment.name}`}
                className="shrink-0 rounded-full p-2 text-on-surface-variant hover:bg-surface-container hover:text-error disabled:opacity-40"
              >
                <IconClose size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Ready-document path — exactly one document is chosen here. */}
      {readyDocumentPath && (
        <div className="rounded-medium bg-surface-container-low p-3">
          <Select
            label="سند آمادهٔ شما"
            value={ready?.documentId ?? ""}
            onChange={(e) => {
              const documentId = e.target.value;
              if (!documentId) return;
              void setReady.mutateAsync(documentId).catch((err: unknown) => {
                setError(
                  err instanceof Error ? err.message : "انتخاب سند آماده ناموفق بود."
                );
              });
            }}
            fullWidth
            options={[
              { value: "", label: "انتخاب کنید" },
              ...available.map((d) => ({
                value: d.id,
                label: `${d.name} (${formatFileSize(d.sizeBytes)})`,
              })),
            ]}
            supportingText={
              ready
                ? "این سند مبنای تأیید نهایی شما خواهد بود. تا زمانی که خودتان تأیید نکنید، چیزی نهایی نمی‌شود."
                : "سندی را انتخاب کنید که می‌خواهید در این درخواست بازبینی و تأیید شود."
            }
          />
        </div>
      )}

      {/* Add a new file — the SAME upload pipeline as the rest of the product. */}
      <div>
        <h3 className="mb-2 text-titleSmall text-on-surface">افزودن فایل تازه</h3>
        <UploadZone onFile={(file) => void handleFile(file)} disabled={uploading} />
        {uploading && (
          <p className="mt-2 text-caption text-on-surface-variant">
            در حال بارگذاری و پردازش فایل…
          </p>
        )}
      </div>

      {/* Pick one of my existing documents. */}
      {available.length > 0 && (
        <div>
          <h3 className="mb-2 text-titleSmall text-on-surface">از اسناد موجود من</h3>
          <div className="mb-2 max-w-xs">
            <Select
              label="نقش مدرک"
              value={role}
              onChange={(e) => setRole(e.target.value as JudicialAttachmentRole)}
              fullWidth
              options={ROLE_OPTIONS}
              supportingText="نقش هر مدرک در پیش‌نویس ذکر می‌شود."
            />
          </div>
          <ul className="space-y-2">
            {available.map((doc) => {
              const notReady = doc.status !== "ready";
              return (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-medium border border-[color:var(--color-outline-variant)] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-labelLarge text-on-surface">{doc.name}</p>
                    <p className="mt-0.5 text-caption text-on-surface-variant">
                      {formatFileSize(doc.sizeBytes)}
                      {" · "}
                      {doc.status === "ready"
                        ? "آمادهٔ استفاده"
                        : doc.status === "processing"
                          ? "در حال پردازش"
                          : "پردازش ناموفق"}
                    </p>
                  </div>
                  {doc.alreadyLinked ? (
                    <span className="shrink-0 text-caption text-on-surface-variant">
                      پیوست شده
                    </span>
                  ) : (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => void attach(doc.id)}
                      disabled={notReady || link.isPending}
                      loading={link.isPending}
                    >
                      {notReady ? "هنوز آماده نیست" : "پیوست"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {available.length === 0 && linked.length === 0 && (
        <p className="text-body-2 text-on-surface-variant">
          هنوز مدرکی در حساب شما نیست. فایل تازه‌ای اضافه کنید تا اینجا نمایش داده
          شود.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-medium bg-error-container px-3 py-2 text-body-2 text-error"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={onContinue}
          disabled={readyDocumentPath && !ready}
          startIcon={<IconUpload size={16} />}
        >
          ادامه به جمع‌بندی
        </Button>
        <span className="text-caption text-on-surface-variant">
          {linked.length.toLocaleString("fa-IR")} مدرک پیوست شده است.
        </span>
      </div>
    </section>
  );
}
