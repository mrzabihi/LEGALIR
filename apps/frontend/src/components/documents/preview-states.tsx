// ============================================================
// LEGALIR — Shared preview loading / error surfaces
// ============================================================
// One skeleton and one error surface reused by the preview card and
// the full viewer, so a loading or failed preview always looks the
// same and never shows an empty white box.
// ============================================================

"use client";

import React from "react";
import { Button, Skeleton } from "@legalir/ui";
import { IconDownload, IconRetry, IconWarning } from "@/lib/icons";

// ============================================================
// Loading
// ============================================================

interface PreviewLoadingProps {
  /** Aspect ratio of the placeholder surface, e.g. "3 / 4". */
  aspectRatio?: string;
  label?: string;
}

export function PreviewLoading({
  aspectRatio = "3 / 4",
  label = "در حال بارگذاری پیش‌نمایش…",
}: PreviewLoadingProps) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-large border border-divider bg-surface-container"
      style={{ aspectRatio }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Skeleton variant="rectangular" width="100%" height="100%" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ============================================================
// Error
// ============================================================

interface PreviewErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  downloadUrl?: string | null;
  /** Compact variant for the in-page card. */
  compact?: boolean;
}

export function PreviewError({
  title = "پیش‌نمایش فایل بارگذاری نشد.",
  message = "ممکن است فایل در دسترس نباشد یا اتصال قطع شده باشد.",
  onRetry,
  downloadUrl,
  compact = false,
}: PreviewErrorProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-3 rounded-large border border-divider bg-surface text-center",
        compact ? "p-6" : "p-10 min-h-[320px]",
      ].join(" ")}
      role="alert"
    >
      <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center text-error">
        <IconWarning size={28} />
      </div>
      <div>
        <p className="text-body-1 text-on-surface font-medium">{title}</p>
        <p className="text-caption text-muted mt-1 max-w-sm">{message}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {onRetry && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<IconRetry size={16} />}
            onClick={onRetry}
          >
            تلاش دوباره
          </Button>
        )}
        {downloadUrl && (
          <Button
            variant="text"
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
    </div>
  );
}
