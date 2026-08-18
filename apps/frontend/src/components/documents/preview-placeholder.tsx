// ============================================================
// LEGALIR — Document Preview Placeholder
// Preview placeholder for future document viewer (Phase 9)
// ============================================================

"use client";

import { IconDocument, IconFile, IconDownload } from "@/lib/icons";
import { Button } from "@legalir/ui";

// ============================================================
// Helpers
// ============================================================

function getDocumentIcon(mime: string) {
  if (mime === "application/pdf") return IconDocument;
  return IconFile;
}

function getDocumentTypeLabel(mime: string): string {
  if (mime === "application/pdf") return "سند PDF";
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "سند Word";
  if (mime.startsWith("image/")) return "تصویر";
  return "سند";
}

// ============================================================
// PreviewPlaceholder component
// ============================================================

interface PreviewPlaceholderProps {
  documentName: string;
  mime: string;
  previewUrl: string | null;
  downloadUrl: string;
}

export function PreviewPlaceholder({
  documentName,
  mime,
  previewUrl,
  downloadUrl,
}: PreviewPlaceholderProps) {
  const DocIcon = getDocumentIcon(mime);
  const typeLabel = getDocumentTypeLabel(mime);
  const hasPreview = Boolean(previewUrl);

  return (
    <section aria-label="پیش‌نمایش سند" dir="rtl">
      <h3 className="text-labelLarge text-on-surface font-medium mb-3">
        پیش‌نمایش سند
      </h3>

      {hasPreview && previewUrl ? (
        <div className="flex flex-col gap-4">
          {/* Embedded PDF preview */}
          <div className="rounded-large border border-divider bg-surface overflow-hidden">
            <iframe
              src={previewUrl}
              title={`پیش‌نمایش ${documentName}`}
              className="w-full h-[520px]"
              loading="lazy"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 rounded-large border border-dashed border-divider bg-surface p-8 text-center">
          {/* Large icon */}
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-muted">
            <DocIcon size={40} />
          </div>

          {/* Document info */}
          <div>
            <h4
              className="text-body-2 text-on-surface font-medium truncate max-w-xs"
              title={documentName}
            >
              {documentName}
            </h4>
            <p className="text-caption text-muted mt-0.5">{typeLabel}</p>
          </div>

          {/* Notice */}
          <p className="text-caption text-muted max-w-sm">
            پیش‌نمایش برای این نوع سند در دسترس نیست
          </p>
        </div>
      )}

      {/* Download button */}
      <div className="flex justify-center mt-4">
        <Button
          variant="outlined"
          disabled={!hasPreview}
          aria-label={hasPreview ? "دانلود سند" : "دانلود سند در دسترس نیست"}
          endIcon={<IconDownload size={18} />}
          onClick={() => {
            window.location.href = downloadUrl;
          }}
        >
          دانلود سند
        </Button>
      </div>
    </section>
  );
}
