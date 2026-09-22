// ============================================================
// LEGALIR — Document Preview Card
// ============================================================
// The in-page preview surface on /documents/[id]. It shows a REAL
// preview of the stored file — the first PDF page or the actual image
// — and the whole surface is a link into the full viewer.
//
// The card is deliberately light: for PDFs it rasterises only page 1,
// so a large document never loads every page just to show a thumbnail.
// ============================================================

"use client";

import React from "react";
import Link from "next/link";
import { IconExpandMore } from "@/lib/icons";
import { formatFileSize } from "@/lib/persian-utils";
import { previewTypeLabel } from "@/lib/document-preview";
import { useDocumentPreview } from "@/hooks/useDocuments";
import { PdfThumbnail } from "./pdf-viewer";
import { PreviewError, PreviewLoading } from "./preview-states";
import { UnsupportedPreview } from "./unsupported-preview";

// ============================================================
// Card shell — one clickable surface with a hover overlay
// ============================================================

interface PreviewCardShellProps {
  href: string;
  fileName: string;
  typeLabel: string;
  sizeBytes: number;
  children: React.ReactNode;
  /** When false the card is not a link (unsupported / unavailable). */
  interactive?: boolean;
}

function PreviewCardShell({
  href,
  fileName,
  typeLabel,
  sizeBytes,
  children,
  interactive = true,
}: PreviewCardShellProps) {
  const meta = (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-divider bg-surface">
      <div className="min-w-0">
        <p className="text-body-2 text-on-surface font-medium truncate" title={fileName}>
          {fileName}
        </p>
        <p className="text-caption text-muted mt-0.5">
          {typeLabel} • {formatFileSize(sizeBytes)}
        </p>
      </div>
      {interactive && (
        <span className="shrink-0 text-muted" aria-hidden="true">
          <IconExpandMore size={20} />
        </span>
      )}
    </div>
  );

  const surface = (
    <div className="relative overflow-hidden rounded-large border border-divider bg-surface shadow-elevation-1 transition-shadow duration-200 ease-standard group-hover:shadow-elevation-3">
      <div className="relative">{children}</div>

      {/* Hover / focus overlay — desktop only; mobile taps the card. */}
      {interactive && (
        <div
          className="pointer-events-none absolute inset-0 hidden desktop:flex items-center justify-center opacity-0 transition-opacity duration-200 ease-standard group-hover:bg-scrim/40 group-hover:opacity-100 group-focus-visible:bg-scrim/40 group-focus-visible:opacity-100"
          aria-hidden="true"
        >
          <span className="rounded-full bg-surface px-4 py-2 text-labelLarge text-on-surface shadow-elevation-2">
            مشاهده کامل
          </span>
        </div>
      )}

      {meta}
    </div>
  );

  if (!interactive) return surface;

  return (
    <Link
      href={href}
      className="group block rounded-large focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      aria-label={`مشاهده کامل ${fileName}`}
    >
      {surface}
    </Link>
  );
}

// ============================================================
// DocumentPreviewCard
// ============================================================

interface DocumentPreviewCardProps {
  documentId: string;
  /** Fallback metadata while the preview descriptor loads. */
  fileName: string;
  mime: string;
  sizeBytes: number;
}

export function DocumentPreviewCard({
  documentId,
  fileName,
  mime,
  sizeBytes,
}: DocumentPreviewCardProps) {
  const { data: preview, isLoading, isError, refetch } = useDocumentPreview(documentId);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);

  // Measure the surface so the PDF page can be fitted to it.
  React.useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [preview?.kind]);

  const resolvedName = preview?.name ?? fileName;
  const resolvedMime = preview?.mime ?? mime;
  const resolvedSize = preview?.sizeBytes ?? sizeBytes;
  const typeLabel = previewTypeLabel(resolvedMime, resolvedName);
  const viewerHref = `/documents/${documentId}/preview`;

  // --- Loading ---
  if (isLoading) {
    return (
      <section aria-label="پیش‌نمایش سند" dir="rtl">
        <h3 className="text-labelLarge text-on-surface font-medium mb-3">پیش‌نمایش سند</h3>
        <PreviewLoading aspectRatio="3 / 4" />
      </section>
    );
  }

  // --- Error ---
  if (isError || !preview) {
    return (
      <section aria-label="پیش‌نمایش سند" dir="rtl">
        <h3 className="text-labelLarge text-on-surface font-medium mb-3">پیش‌نمایش سند</h3>
        <PreviewError
          compact
          onRetry={() => refetch()}
          downloadUrl={`/api/v1/documents/${documentId}/download`}
        />
      </section>
    );
  }

  // --- Unsupported type ---
  if (preview.kind === "unsupported") {
    return (
      <section aria-label="پیش‌نمایش سند" dir="rtl">
        <h3 className="text-labelLarge text-on-surface font-medium mb-3">پیش‌نمایش سند</h3>
        <UnsupportedPreview
          compact
          fileName={resolvedName}
          mime={resolvedMime}
          downloadUrl={preview.downloadUrl}
        />
      </section>
    );
  }

  // --- Supported type, but the stored bytes are missing ---
  if (!preview.fileUrl) {
    return (
      <section aria-label="پیش‌نمایش سند" dir="rtl">
        <h3 className="text-labelLarge text-on-surface font-medium mb-3">پیش‌نمایش سند</h3>
        <PreviewError
          compact
          message="فایل این سند در دسترس نیست."
          onRetry={() => refetch()}
          downloadUrl={preview.downloadUrl}
        />
      </section>
    );
  }

  // --- Real preview ---
  return (
    <section aria-label="پیش‌نمایش سند" dir="rtl">
      <h3 className="text-labelLarge text-on-surface font-medium mb-3">پیش‌نمایش سند</h3>
      <PreviewCardShell
        href={viewerHref}
        fileName={resolvedName}
        typeLabel={typeLabel}
        sizeBytes={resolvedSize}
      >
        <div ref={surfaceRef} className="w-full">
          {preview.kind === "pdf" ? (
            width > 0 ? (
              <PdfThumbnail fileUrl={preview.fileUrl} width={width} />
            ) : (
              <div className="w-full aspect-[3/4] bg-surface-container animate-pulse" aria-hidden="true" />
            )
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.fileUrl}
              alt={resolvedName}
              className="w-full max-h-[420px] object-contain bg-surface-container"
            />
          )}
        </div>
      </PreviewCardShell>
    </section>
  );
}
