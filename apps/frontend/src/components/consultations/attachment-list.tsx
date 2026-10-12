"use client";

// ============================================================
// LEGALIR — Consultation attachment list
// ============================================================
// The documents the client shared with the case. Each row links to the
// case-scoped stream route (owner OR assigned lawyer), never a public
// storage URL. Metadata only — bytes stream on demand.
// ============================================================

import { IconFile, IconDownload } from "@/lib/icons";
import type { ConsultationAttachmentView } from "@legalir/types";
import { toPersianNumber } from "@/lib/persian-utils";

/** Human-readable file size in Persian digits. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${toPersianNumber(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${toPersianNumber(Math.round(bytes / 1024))} کیلوبایت`;
  return `${toPersianNumber(Math.round((bytes / (1024 * 1024)) * 10) / 10)} مگابایت`;
}

export function AttachmentList({
  requestId,
  attachments,
}: {
  requestId: string;
  attachments: ConsultationAttachmentView[];
}) {
  if (attachments.length === 0) {
    return (
      <section className="rounded-large border border-divider bg-surface p-5">
        <h2 className="mb-3 text-h3 text-on-surface">پیوست‌ها</h2>
        <p className="text-body-2 text-muted">پیوستی برای این مشاوره ثبت نشده است.</p>
      </section>
    );
  }

  return (
    <section className="rounded-large border border-divider bg-surface p-5">
      <h2 className="mb-3 text-h3 text-on-surface">پیوست‌ها</h2>
      <ul className="space-y-2">
        {attachments.map((a) => (
          <li key={a.id}>
            <a
              href={`/api/v1/legal-requests/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(a.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-medium border border-divider px-3 py-2.5 transition hover:border-primary hover:bg-primary-container"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-medium bg-surface-container text-muted">
                <IconFile size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-2 text-on-surface">{a.name}</span>
                <span className="block text-caption text-muted">{formatSize(a.sizeBytes)}</span>
              </span>
              <IconDownload size={18} className="shrink-0 text-muted" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
