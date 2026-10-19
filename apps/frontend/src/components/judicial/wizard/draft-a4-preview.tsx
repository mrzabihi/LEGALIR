// ============================================================
// LEGALIR — Judicial draft, A4 preview (screen = print)
// ============================================================
// The last stage's document surface. It renders the SELECTED draft version
// as real A4 RTL pages using the SAME page geometry and CSS classes as the
// contract document, so the sheet on screen lines up with what the server
// PDF will later render.
//
// Pagination is measured, never guessed: the paragraphs are laid out once in
// a hidden measurer inside the real page box, their heights are read, and
// then distributed into pages so no paragraph is split across sheets and no
// orphaned heading starts a page's last line.
//
// The watermark is driven by a real flag (`approved`), not by the component's
// opinion: a draft always says «پیش‌نویس», and only the stored approved status
// removes it. The footer repeats the standing promise — this text is not a
// filed or served document — on every page, because a printed sheet travels
// away from the screen that explained it.
// ============================================================

"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@legalir/ui";
import { IconInfo } from "@/lib/icons";

/** One measured unit of the document. */
interface DraftBlock {
  id: string;
  kind: "heading" | "paragraph";
  text: string;
}

const FALLBACK_PAGE_HEIGHT = 720;
const PAGE_SAFETY = 12;

/** Persian digits for page numbers. */
function faNum(value: number): string {
  return String(value).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
}

/**
 * Split the stored text into blocks. A line that is short and ends without
 * sentence punctuation is treated as a heading — the composer emits the
 * document's own headings that way — which keeps them attached to the
 * paragraph that follows.
 */
function toBlocks(text: string): DraftBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: DraftBlock[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const joined = buffer.join(" ").trim();
    if (joined) {
      blocks.push({ id: `p-${blocks.length}`, kind: "paragraph", text: joined });
    }
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const looksLikeHeading =
      line.length <= 48 && !/[.،؛:؟!]$/.test(line) && !/^\d/.test(line);
    if (looksLikeHeading) {
      flush();
      blocks.push({ id: `h-${blocks.length}`, kind: "heading", text: line });
      continue;
    }
    buffer.push(line);
  }
  flush();
  return blocks;
}

/** Greedy pagination over measured heights; a heading never ends a page. */
function paginate(
  blocks: DraftBlock[],
  heights: Record<string, number>,
  capacity: number
): DraftBlock[][] {
  const pages: DraftBlock[][] = [];
  let current: DraftBlock[] = [];
  let used = 0;

  blocks.forEach((block, index) => {
    const h = heights[block.id] ?? 40;
    const next = blocks[index + 1];
    // Keep a heading with at least its first following paragraph.
    const required = block.kind === "heading" ? h + (next ? (heights[next.id] ?? 40) : 0) : h;
    if (current.length > 0 && used + required > capacity) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(block);
    used += h;
  });

  if (current.length > 0) pages.push(current);
  return pages.length > 0 ? pages : [[]];
}

export interface DraftA4PreviewProps {
  titleFa: string;
  /** e.g. «دادخواست حقوقی» — the letterhead's document-type line. */
  documentTypeFa: string;
  /** The request identifier shown on the letterhead (never a serial). */
  referenceId: string;
  versionNumber: number;
  text: string;
  /** TRUE only when the stored status is approved; nothing else clears it. */
  approved: boolean;
  /** Issued date for an approved version, when the server reports one. */
  approvedAtLabelFa?: string | null;
}

export function DraftA4Preview({
  titleFa,
  documentTypeFa,
  referenceId,
  versionNumber,
  text,
  approved,
  approvedAtLabelFa,
}: DraftA4PreviewProps) {
  const blocks = useMemo(() => toBlocks(text), [text]);

  const measureRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<{
    capacity: number;
    heights: Record<string, number>;
  } | null>(null);

  /**
   * Measure the page's usable height (page box minus its padding) and every
   * block once. The measurer uses the same class chain as the visible sheet,
   * so the numbers are the ones the real layout will use.
   */
  const measure = useCallback(() => {
    const root = measureRef.current;
    if (!root) return;
    const content = root.querySelector<HTMLElement>("[data-draft-content]");
    const pageEl = root.querySelector<HTMLElement>(".a4-page");
    if (!content || !pageEl) return;

    const style = window.getComputedStyle(content);
    const padTop = parseFloat(style.paddingTop) || 0;
    const padBottom = parseFloat(style.paddingBottom) || 0;
    const footer = root.querySelector<HTMLElement>("[data-draft-footer]");
    const footerH = footer?.getBoundingClientRect().height ?? 0;
    const usable = pageEl.getBoundingClientRect().height - padTop - padBottom - footerH - PAGE_SAFETY;

    const heights: Record<string, number> = {};
    for (const el of root.querySelectorAll<HTMLElement>("[data-draft-block]")) {
      const id = el.dataset["draftBlock"];
      if (id) heights[id] = el.getBoundingClientRect().height;
    }
    setMetrics({
      capacity: usable > 200 ? usable : FALLBACK_PAGE_HEIGHT,
      heights,
    });
  }, []);

  // Measure once the real Persian face is in: a fallback face has different
  // metrics and would under-fill every page.
  useLayoutEffect(() => {
    measure();
    let cancelled = false;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (fonts?.ready) {
      void fonts.ready.then(() => {
        if (!cancelled) measure();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [measure, blocks]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

  const pages = useMemo(
    () => paginate(blocks, metrics?.heights ?? {}, metrics?.capacity ?? FALLBACK_PAGE_HEIGHT),
    [blocks, metrics]
  );

  // ----------------------------------------------------------
  // Print — ONLY the document leaves the printer
  // ----------------------------------------------------------
  // The printable copy is portalled to <body> as `.a4-print-root`; the global
  // print CSS hides every other body child, so no app chrome is printed and no
  // blank sheets are emitted by the tall wizard page above it.
  const [printing, setPrinting] = useState(false);

  const flushPrint = useCallback(() => setPrinting(true), []);

  useLayoutEffect(() => {
    if (!printing) return;
    let cancelled = false;
    const finish = () => setPrinting(false);
    window.addEventListener("afterprint", finish);

    const run = async () => {
      try {
        await document.fonts?.ready;
      } catch {
        /* a failed font wait must never block printing */
      }
      const root = document.querySelector<HTMLElement>(".a4-print-root");
      const images = root ? Array.from(root.querySelectorAll<HTMLImageElement>("img")) : [];
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve();
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            })
        )
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      if (!cancelled) window.print();
    };
    void run();

    const timer = window.setTimeout(finish, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", finish);
      window.clearTimeout(timer);
    };
  }, [printing]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  const pageCount = pages.length;

  const letterhead = (
    <header className="a4-letterhead">
      <div className="a4-letterhead-top">
        {/* The public LEGALIR mark, the same one every contract document
            prints. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/legalir-logo.png" alt="LEGALIR" className="a4-letterhead-logo" />
        <div className="a4-letterhead-meta">
          <p className="a4-doc-type">{documentTypeFa}</p>
          <p className="a4-doc-ref">
            شناسهٔ درخواست: <span dir="ltr">{referenceId}</span>
          </p>
          <p className="a4-doc-ref">
            نسخه: {versionNumber > 0 ? faNum(versionNumber) : "پیش‌نویس"}
          </p>
          <p className="a4-doc-state">
            وضعیت: {approved ? "تأییدشده" : "پیش‌نویس — تأییدنشده"}
            {approved && approvedAtLabelFa ? ` — ${approvedAtLabelFa}` : ""}
          </p>
        </div>
      </div>
      <h1 className="a4-doc-title">{titleFa}</h1>
    </header>
  );

  const footer = (pageNumber: string) => (
    <footer className="a4-page-footer" data-draft-footer>
      <div className="a4-page-footer-line">
        <span dir="rtl">
          این متن پیش‌نویس است و به‌معنای ثبت، ارسال یا ابلاغ در مرجع قضایی نیست.
        </span>
        <span className="a4-page-number">{pageNumber}</span>
      </div>
    </footer>
  );

  const renderPages = (rootClass: string) => (
    <div className={rootClass} dir="rtl">
      {pages.map((pageBlocks, pageIndex) => (
        <section
          key={`${rootClass}-${pageIndex}`}
          className="a4-page"
          aria-label={`صفحه ${faNum(pageIndex + 1)} از ${faNum(pageCount)}`}
        >
          {!approved && (
            <div className="a4-watermark" aria-hidden="true">
              <span>پیش‌نویس</span>
            </div>
          )}

          <div className="a4-page-inner">
            {pageIndex > 0 && (
              <div className="a4-running-head">
                <span className="a4-running-type">{documentTypeFa}</span>
                <span className="a4-running-ref" dir="ltr">
                  {referenceId}
                </span>
                <span className="a4-running-version">
                  {versionNumber > 0 ? `نسخه ${faNum(versionNumber)}` : "پیش‌نویس"}
                </span>
              </div>
            )}
            <div className="a4-page-blocks">
              {pageIndex === 0 && <div className="a4-block">{letterhead}</div>}
              {pageBlocks.map((block) => (
                <div key={block.id} className="a4-block">
                  {block.kind === "heading" ? (
                    <h2 className="a4-clause-heading">{block.text}</h2>
                  ) : (
                    <p className="a4-paragraph">{block.text}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {footer(`صفحه ${faNum(pageIndex + 1)} از ${faNum(pageCount)}`)}
        </section>
      ))}
    </div>
  );

  return (
    <div className="a4-document" dir="rtl">
      <div className="a4-actions no-print">
        <div className="a4-actions-meta">
          <span className="flex items-center gap-1.5">
            <IconInfo size={14} aria-hidden="true" />
            پیش‌نمایش A4 — همان قالب چاپ
          </span>
        </div>
        <div className="a4-actions-buttons">
          <Button
            variant="outlined"
            size="small"
            onClick={flushPrint}
            disabled={printing}
          >
            {printing ? "در حال آماده‌سازی چاپ…" : "چاپ پیش‌نویس"}
          </Button>
        </div>
      </div>

      <div className="a4-pages">{renderPages("a4-pages-inner")}</div>

      {/* Hidden measurer — same page box, same class chain, same footer. */}
      <div className="a4-measurer" aria-hidden="true" ref={measureRef}>
        <div className="a4-page">
          <div className="a4-page-content" data-draft-content>
            {blocks.map((block) => (
              <div key={block.id} data-draft-block={block.id} className="a4-block">
                {block.kind === "heading" ? (
                  <h2 className="a4-clause-heading">{block.text}</h2>
                ) : (
                  <p className="a4-paragraph">{block.text}</p>
                )}
              </div>
            ))}
          </div>
          {footer("صفحه ۱ از ۱")}
        </div>
      </div>

      {printing &&
        typeof document !== "undefined" &&
        createPortal(renderPages("a4-print-root"), document.body)}
    </div>
  );
}
