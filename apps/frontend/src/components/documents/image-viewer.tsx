// ============================================================
// LEGALIR — Image Viewer
// ============================================================
// Renders the real image with fit-to-screen / zoom / reset. The image
// is never stretched: it uses object-fit: contain at fit level and
// scales from its natural size when zoomed.
// ============================================================

"use client";

import React from "react";
import { IconButton } from "@legalir/ui";
import { IconFitWidth, IconZoomIn, IconZoomOut } from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import { PreviewError, PreviewLoading } from "./preview-states";

interface ImageViewerProps {
  fileUrl: string;
  fileName: string;
  downloadUrl?: string | null;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export function ImageViewer({ fileUrl, fileName, downloadUrl }: ImageViewerProps) {
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [zoom, setZoom] = React.useState(1);
  const [reloadKey, setReloadKey] = React.useState(0);

  const zoomIn = React.useCallback(
    () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2))),
    []
  );
  const zoomOut = React.useCallback(
    () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2))),
    []
  );
  const reset = React.useCallback(() => setZoom(1), []);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        reset();
      }
    },
    [zoomIn, zoomOut, reset]
  );

  if (status === "error") {
    return (
      <PreviewError
        message="تصویر بارگذاری نشد یا معتبر نیست."
        onRetry={() => {
          setStatus("loading");
          setReloadKey((k) => k + 1);
        }}
        downloadUrl={downloadUrl}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      {/* Toolbar */}
      <div
        className="flex items-center justify-end gap-1 rounded-large border border-divider bg-surface px-2 py-1.5"
        role="toolbar"
        aria-label="ابزارهای نمایش تصویر"
      >
        <IconButton label="کوچک‌نمایی" size="small" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}>
          <IconZoomOut />
        </IconButton>
        <span className="text-caption text-muted tabular-nums min-w-[48px] text-center">
          {toPersianNumber(Math.round(zoom * 100))}٪
        </span>
        <IconButton label="بزرگ‌نمایی" size="small" onClick={zoomIn} disabled={zoom >= MAX_ZOOM}>
          <IconZoomIn />
        </IconButton>
        <IconButton
          label="تناسب با صفحه"
          size="small"
          onClick={reset}
          className={zoom === 1 ? "text-primary" : ""}
        >
          <IconFitWidth />
        </IconButton>
      </div>

      {/* Image surface */}
      <div
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="overflow-auto rounded-large border border-divider bg-surface-container p-4 max-h-[75vh] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        aria-label={`نمایش تصویر ${fileName}`}
      >
        {status === "loading" && (
          <div className="w-full">
            <PreviewLoading aspectRatio="4 / 3" label="در حال بارگذاری تصویر…" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={reloadKey}
          src={fileUrl}
          alt={fileName}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          className={[
            "max-w-full object-contain transition-transform duration-200 ease-standard",
            status === "loading" ? "hidden" : "block",
          ].join(" ")}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
            maxHeight: zoom === 1 ? "70vh" : undefined,
          }}
        />
      </div>
    </div>
  );
}
