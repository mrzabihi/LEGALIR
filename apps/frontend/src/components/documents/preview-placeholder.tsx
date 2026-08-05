// ============================================================
// LEGALIR — Document Preview Placeholder
// Preview placeholder for future document viewer (Phase 9)
// ============================================================

"use client";

import { IconDocument, IconFile, IconDownload } from "@/lib/icons";
import { Button, Tooltip } from "@legalir/ui";

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
}

export function PreviewPlaceholder({
  documentName,
  mime,
}: PreviewPlaceholderProps) {
  const DocIcon = getDocumentIcon(mime);
  const typeLabel = getDocumentTypeLabel(mime);

  return (
    <section aria-label="پیش‌نمایش سند" dir="rtl">
      <h3 className="text-labelLarge text-on-surface font-medium mb-3">
        پیش‌نمایش سند
      </h3>

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
          پیش‌نمایش سند در نسخه‌های آینده فعال خواهد شد
        </p>

        {/* Download placeholder button */}
        <Tooltip content="به زودی">
          <Button
            variant="outlined"
            disabled
            aria-label="دانلود سند - به زودی"
            endIcon={<IconDownload size={18} />}
          >
            دانلود سند
          </Button>
        </Tooltip>
      </div>
    </section>
  );
}
