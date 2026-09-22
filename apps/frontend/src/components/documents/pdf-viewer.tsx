// ============================================================
// LEGALIR — PDF Viewer (pdf.js)
// ============================================================
// Renders real PDF pages to canvas. Two modes:
//
//   "thumbnail" — a single page (the first by default), no chrome.
//                 Used by the preview card so the page stays light.
//   "full"      — paginated viewer with zoom / fit-to-width and a
//                 page indicator.
//
// Pages are rendered lazily: only the page currently on screen is
// rasterised, so a large PDF never loads every page at once.
// ============================================================

"use client";

import React from "react";
import { IconButton } from "@legalir/ui";
import {
  IconChevronLeft,
  IconChevronRightSmall,
  IconFitWidth,
  IconZoomIn,
  IconZoomOut,
} from "@/lib/icons";
import { loadPdfjs } from "@/lib/pdf";
import { toPersianNumber } from "@/lib/persian-utils";
import { PreviewError, PreviewLoading } from "./preview-states";

// ============================================================
// Shared: render one page into a canvas
// ============================================================

type PdfDocumentProxy = Awaited<
  ReturnType<Awaited<ReturnType<typeof loadPdfjs>>["getDocument"]>["promise"]
>;

interface PdfPageCanvasProps {
  /** The loaded pdf.js document proxy. */
  pdf: PdfDocumentProxy;
  pageNumber: number;
  /** CSS width the canvas should fill; height follows the page ratio. */
  width: number;
  /** Extra scale multiplier (zoom). */
  scale?: number;
  className?: string;
  onRendered?: () => void;
  onError?: (error: Error) => void;
}

function PdfPageCanvas({
  pdf,
  pageNumber,
  width,
  scale = 1,
  className = "",
  onRendered,
  onError,
}: PdfPageCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [height, setHeight] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        // Fit the page to `width`, then apply the zoom multiplier.
        const base = page.getViewport({ scale: 1 });
        const fitScale = (width / base.width) * scale;
        const viewport = page.getViewport({ scale: fitScale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;

        // Render at device pixel ratio for a crisp page.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        setHeight(Math.floor(viewport.height));

        const task = page.render({
          canvasContext: context,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        renderTask = task;
        await task.promise;
        if (!cancelled) onRendered?.();
      } catch (err) {
        // pdf.js rejects a cancelled render with a RenderingCancelledException;
        // that is expected during zoom/page changes and is not a failure.
        const name = (err as { name?: string })?.name;
        if (cancelled || name === "RenderingCancelledException") return;
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, width, scale, onRendered, onError]);

  return (
    <canvas
      ref={canvasRef}
      className={`block bg-white ${className}`}
      style={height ? { minHeight: height } : undefined}
      aria-hidden="true"
    />
  );
}

// ============================================================
// Thumbnail mode — first page only, no chrome
// ============================================================

interface PdfThumbnailProps {
  fileUrl: string;
  /** Container width in px; the page is fitted to it. */
  width: number;
  onReady?: () => void;
  onError?: () => void;
}

export function PdfThumbnail({ fileUrl, width, onReady, onError }: PdfThumbnailProps) {
  const [pdf, setPdf] = React.useState<PdfDocumentProxy | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let loaded: PdfDocumentProxy | null = null;

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const doc = await pdfjs.getDocument({ url: fileUrl }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        loaded = doc;
        setPdf(doc);
      } catch {
        if (!cancelled) {
          setFailed(true);
          onError?.();
        }
      }
    })();

    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [fileUrl, onError]);

  if (failed) {
    return (
      <div className="w-full aspect-[3/4] flex items-center justify-center bg-surface-container text-caption text-muted">
        پیش‌نمایش در دسترس نیست
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className="w-full aspect-[3/4] bg-surface-container animate-pulse" aria-hidden="true" />
    );
  }

  return (
    <div className="w-full flex justify-center bg-surface-container">
      <PdfPageCanvas
        pdf={pdf}
        pageNumber={1}
        width={width}
        onRendered={onReady}
        onError={() => {
          setFailed(true);
          onError?.();
        }}
      />
    </div>
  );
}

// ============================================================
// Full mode — paginated viewer with zoom
// ============================================================

interface PdfViewerProps {
  fileUrl: string;
  fileName: string;
  downloadUrl?: string | null;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

export function PdfViewer({ fileUrl, fileName, downloadUrl }: PdfViewerProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [pdf, setPdf] = React.useState<PdfDocumentProxy | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [zoom, setZoom] = React.useState(1);
  const [fitWidth, setFitWidth] = React.useState(true);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [failed, setFailed] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);

  // --- Load the document ---
  React.useEffect(() => {
    let cancelled = false;
    let loaded: PdfDocumentProxy | null = null;

    setFailed(false);
    setPdf(null);

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const doc = await pdfjs.getDocument({ url: fileUrl }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        loaded = doc;
        setPdf(doc);
        setPageCount(doc.numPages);
        setPage(1);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [fileUrl, reloadKey]);

  // --- Track the container width so pages can fit it ---
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const goPrev = React.useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goNext = React.useCallback(
    () => setPage((p) => Math.min(pageCount || 1, p + 1)),
    [pageCount]
  );
  const zoomIn = React.useCallback(
    () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2))),
    []
  );
  const zoomOut = React.useCallback(
    () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2))),
    []
  );
  const resetFit = React.useCallback(() => {
    setZoom(1);
    setFitWidth(true);
  }, []);

  // --- Keyboard navigation ---
  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goNext(); // RTL: left arrow advances
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      }
    },
    [goNext, goPrev, zoomIn, zoomOut]
  );

  if (failed) {
    return (
      <PreviewError
        message="فایل PDF بارگذاری نشد یا خراب است."
        onRetry={() => setReloadKey((k) => k + 1)}
        downloadUrl={downloadUrl}
      />
    );
  }

  if (!pdf) {
    return <PreviewLoading aspectRatio="3 / 4" label="در حال بارگذاری فایل PDF…" />;
  }

  // Fit-to-width uses the container width; zoom multiplies it.
  const pageWidth = fitWidth
    ? Math.max(240, containerWidth - 32)
    : Math.max(240, (containerWidth - 32) * zoom);

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-2 flex-wrap rounded-large border border-divider bg-surface px-2 py-1.5"
        role="toolbar"
        aria-label="ابزارهای نمایش PDF"
      >
        {/* Pagination */}
        <div className="flex items-center gap-1">
          <IconButton
            label="صفحه بعد"
            size="small"
            onClick={goNext}
            disabled={page >= pageCount}
          >
            <IconChevronLeft />
          </IconButton>
          <span className="text-caption text-on-surface tabular-nums px-1 min-w-[72px] text-center">
            {toPersianNumber(page)} / {toPersianNumber(pageCount)}
          </span>
          <IconButton
            label="صفحه قبل"
            size="small"
            onClick={goPrev}
            disabled={page <= 1}
          >
            <IconChevronRightSmall />
          </IconButton>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
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
            label="تناسب با عرض"
            size="small"
            onClick={resetFit}
            className={fitWidth && zoom === 1 ? "text-primary" : ""}
          >
            <IconFitWidth />
          </IconButton>
        </div>
      </div>

      {/* Page surface */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="overflow-auto rounded-large border border-divider bg-surface-container p-4 max-h-[75vh] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        aria-label={`نمایش فایل ${fileName}، صفحه ${toPersianNumber(page)} از ${toPersianNumber(pageCount)}`}
      >
        <div className="flex justify-center">
          <div className="shadow-elevation-2 rounded-small overflow-hidden">
            <PdfPageCanvas
              pdf={pdf}
              pageNumber={page}
              width={pageWidth}
              onError={() => setFailed(true)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
