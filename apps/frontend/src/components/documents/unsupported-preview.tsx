// ============================================================
// LEGALIR — Unsupported Preview
// ============================================================
// Fallback surface for file types we cannot render in-page (DOCX,
// XLSX, …). It never pretends to preview: it states the limitation
// and offers the download, which is the only real action available.
// ============================================================

"use client";

import React from "react";
import { Button } from "@legalir/ui";
import { IconDownload, IconFile } from "@/lib/icons";
import { previewTypeLabel } from "@/lib/document-preview";

interface UnsupportedPreviewProps {
  fileName: string;
  mime: string;
  downloadUrl?: string | null;
  /** Compact variant for the in-page card. */
  compact?: boolean;
}

export function UnsupportedPreview({
  fileName,
  mime,
  downloadUrl,
  compact = false,
}: UnsupportedPreviewProps) {
  const typeLabel = previewTypeLabel(mime, fileName);

  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-3 rounded-large border border-dashed border-divider bg-surface text-center",
        compact ? "p-6" : "p-10 min-h-[320px]",
      ].join(" ")}
      role="status"
    >
      <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-muted">
        <IconFile size={32} />
      </div>
      <div>
        <p className="text-body-1 text-on-surface font-medium truncate max-w-xs" title={fileName}>
          {fileName}
        </p>
        <p className="text-caption text-muted mt-0.5">{typeLabel}</p>
      </div>
      <p className="text-caption text-muted max-w-sm">
        پیش‌نمایش این نوع فایل در حال حاضر پشتیبانی نمی‌شود.
      </p>
      {downloadUrl && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<IconDownload size={16} />}
          onClick={() => {
            window.location.href = downloadUrl;
          }}
        >
          دانلود فایل
        </Button>
      )}
    </div>
  );
}

