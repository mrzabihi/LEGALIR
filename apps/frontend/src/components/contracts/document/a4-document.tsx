// ============================================================
// LEGALIR — A4 contract document (screen = print = PDF)
// ============================================================
// The ONE document surface. It renders the deterministic template
// output into real A4 pages, with:
//
//   • a letterhead: LEGALIR mark, document title, type, reference
//     code, contract date and version;
//   • the full numbered clause text from `renderContract`;
//   • the signature section with every role and its signing date;
//   • the non-binding legal-basis annex;
//   • «صفحه N از M» on every page.
//
// Pagination is measured, not guessed: every block is rendered once in
// a hidden A4 measurer, measured, then distributed into pages so a
// heading is never orphaned at the bottom of a page and the signature
// block is never split. The printed sheet uses the same page boxes, so
// the browser's print output and the server PDF agree.
//
// The «پیش‌نویس» watermark is driven by a REAL status flag passed by
// the caller (`draft`). The component never decides that a document is
// final — the contract's stored state/version decides, and the server
// PDF enforces the same rule.
// ============================================================

"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  ContractParty,
  ContractPayment,
  PropertyContract,
} from "@legalir/types";
import {
  CONTRACT_DRAFT_WATERMARK_FA,
  CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
  CONTRACT_REVIEW_STAMP_TEXT,
} from "@legalir/types";
import {
  renderContract,
  type RenderedBlock,
  type RenderedContract,
  type RenderedTable,
} from "@/lib/contracts/template";
import { buildLegalBasisReport } from "@/lib/contracts/legal-basis";
import { formatIsoJalali } from "@/lib/contracts/dates";

/** Per-party signature state, keyed by the rendered role label. */
export interface A4SignatureMark {
  signedAt?: string | null;
  /** Human-readable state, e.g. «امضا شده» / «در انتظار امضا». */
  statusFa?: string;
}

export interface A4ReviewStamp {
  applied: boolean;
  reviewedAt?: string | null;
  reviewingOfficeFa?: string;
  reviewerInitials?: string | null;
  reviewId?: string;
  /**
   * TRUE when a Super Admin has applied the OFFICIAL seal to this exact
   * version. Only then are the seal/hologram images shown; the internal
   * review mark alone never draws them.
   */
  official?: boolean;
  /** Private, permission-gated asset URLs (never a public path). */
  sealHref?: string;
  hologramHref?: string;
  approvedByLabelFa?: string | null;
  approvedAt?: string | null;
}

/**
 * The hologram's security ink. It is deliberately NOT rendered on screen
 * — a digital copy cannot carry a printed hologram. The print media rule
 * in globals.css reveals it, mirroring the source `PrintOnly` asset.
 */
const HOLOGRAM_INK = { brand: "Powered By SOYE", serial: "1361366" } as const;

/** Letterhead metadata, for a pre-rendered document (public signer page). */
export interface A4DocumentMeta {
  typeFa: string;
  referenceCode: string;
  contractDateIso: string;
  templateVersion: string;
}

export interface A4DocumentProps {
  /**
   * The working data. When `rendered` is supplied instead (the public
   * signer route sends only rendered text, never raw party rows), these
   * may be omitted.
   */
  contract?: PropertyContract;
  parties?: ContractParty[];
  payments?: ContractPayment[];
  /** Pre-rendered text, from the same deterministic engine. */
  rendered?: RenderedContract;
  /** Letterhead metadata for a pre-rendered document. */
  meta?: A4DocumentMeta;
  /**
   * TRUE while the document is not a finalised contract. The caller must
   * derive it from the real contract state/version — never from whether
   * the UI happens to have hidden the watermark.
   */
  draft: boolean;
  /** e.g. «پیش‌نویس» / «نهایی‌شده». */
  stateFa?: string;
  /** The frozen version number, when rendering a snapshot. */
  versionNumber?: number | null;
  /** The frozen version hash, when rendering a snapshot. */
  documentHash?: string | null;
  /** The admin review mark, when the current version carries one. */
  reviewStamp?: A4ReviewStamp | null;
  /** Signature completion per role label, from the real signature request. */
  signatureMarks?: Record<string, A4SignatureMark>;
  /** Show the legal-basis annex (default true). */
  includeLegalBasis?: boolean;
  /** PDF / print actions. */
  pdfHref?: string;
  showActions?: boolean;
  className?: string;
}

// ------------------------------------------------------------
// Layout constants (CSS px; the page itself is sized in mm)
// ------------------------------------------------------------

/** Gap between blocks inside a page, in px. */
const BLOCK_GAP = 10;
/** Characters per line used only for the pre-measurement estimate. */
const ESTIMATE_CHARS_PER_LINE = 78;
const ESTIMATE_LINE = 26;

interface Block {
  id: string;
  node: React.ReactNode;
  /** Keep this block together with the next one (headings). */
  keepWithNext?: boolean;
  /** Start a new page before this block (annex). */
  breakBefore?: boolean;
  estimate: number;
}

function estimate(text: string, lineHeight = ESTIMATE_LINE): number {
  const lines = Math.max(1, Math.ceil(text.length / ESTIMATE_CHARS_PER_LINE));
  return lines * lineHeight + 6;
}

/** Fallback usable content height (A4 minus padding, header and footer). */
const FALLBACK_PAGE_HEIGHT = 930;
/** Vertical space reserved for the running header on pages 2+. */
const RUNNING_HEADER_RESERVE = 34;
/** Sub-pixel guard so a block never spills past the page box. */
const PAGE_SAFETY = 4;

// ------------------------------------------------------------
// Block content
// ------------------------------------------------------------

function clauseHeading(text: string) {
  return <h3 className="a4-clause-heading">{text}</h3>;
}

function paragraph(text: string) {
  return <p className="a4-paragraph">{text}</p>;
}

/**
 * A real A4 table: a semantic `<table>` with a repeating `<thead>`, so a
 * table that crosses a page boundary keeps its column headings in print
 * and the browser never splits a row mid-cell. Cells wrap Persian text, so
 * nothing overflows on a narrow screen either.
 */
function renderedTable(table: RenderedTable) {
  return (
    <div className="a4-table-wrap">
      {table.captionFa && <p className="a4-table-caption">{table.captionFa}</p>}
      <table className="a4-table">
        <thead>
          <tr>
            {table.columnsFa.map((col, i) => (
              <th key={i} scope="col">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rowsFa.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Render one clause block — a paragraph or a table. */
function renderBlock(block: RenderedBlock) {
  return block.kind === "paragraph" ? paragraph(block.textFa) : renderedTable(block.table);
}

/**
 * Rows per table chunk. A table larger than this is emitted as several
 * chunks, each carrying its own caption (first chunk only) and heading row,
 * so a long table paginates cleanly with its column headings repeated
 * instead of being clipped by `overflow:hidden`.
 */
const TABLE_ROWS_PER_CHUNK = 12;

/** Split a table block into page-sized chunks; paragraphs pass through. */
function chunkBlock(block: RenderedBlock, key: string): { id: string; block: RenderedBlock }[] {
  if (block.kind === "paragraph") return [{ id: key, block }];
  const { captionFa, columnsFa, rowsFa } = block.table;
  if (rowsFa.length <= TABLE_ROWS_PER_CHUNK) return [{ id: key, block }];
  const chunks: { id: string; block: RenderedBlock }[] = [];
  for (let start = 0; start < rowsFa.length; start += TABLE_ROWS_PER_CHUNK) {
    const rows = rowsFa.slice(start, start + TABLE_ROWS_PER_CHUNK);
    chunks.push({
      id: `${key}-c${chunks.length}`,
      block: {
        kind: "table",
        table: {
          ...(start === 0 && captionFa ? { captionFa } : {}),
          columnsFa,
          rowsFa: rows,
        },
      },
    });
  }
  return chunks;
}

/** The ordered blocks of a clause, falling back to its paragraphs. */
function blocksOf(clause: { paragraphs: string[]; blocks?: RenderedBlock[] }): RenderedBlock[] {
  return clause.blocks ?? clause.paragraphs.map((textFa) => ({ kind: "paragraph", textFa }));
}

// ------------------------------------------------------------
// Pagination
// ------------------------------------------------------------

function paginate(
  blocks: Block[],
  heights: Record<string, number>,
  pageHeight: number
): Block[][] {
  const pages: Block[][] = [[]];
  let used = 0;

  const heightOf = (b: Block) => heights[b.id] ?? b.estimate;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const h = heightOf(block);

    if (block.breakBefore && pages[pages.length - 1]!.length > 0) {
      pages.push([]);
      used = 0;
    }

    // A heading must not be the last item on a page: if it and the first
    // following block do not fit, move it to a fresh page.
    let needed = h;
    if (block.keepWithNext && i + 1 < blocks.length) {
      needed += BLOCK_GAP + heightOf(blocks[i + 1]!);
    }

    const current = pages[pages.length - 1]!;
    const gap = current.length > 0 ? BLOCK_GAP : 0;
    if (current.length > 0 && used + gap + needed > pageHeight) {
      pages.push([]);
      used = 0;
    }

    const page = pages[pages.length - 1]!;
    if (page.length > 0) used += BLOCK_GAP;
    page.push(block);
    used += h;
  }

  return pages.filter((p) => p.length > 0).length > 0 ? pages : [[]];
}

// ------------------------------------------------------------
// Component
// ------------------------------------------------------------

export function A4Document({
  contract,
  parties,
  payments,
  rendered: renderedProp,
  meta,
  draft,
  stateFa,
  versionNumber,
  documentHash,
  reviewStamp,
  signatureMarks,
  includeLegalBasis = true,
  pdfHref,
  showActions = false,
  className = "",
}: A4DocumentProps) {
  const rendered = useMemo<RenderedContract | null>(() => {
    if (renderedProp) return renderedProp;
    if (!contract) return null;
    return renderContract(contract, parties ?? [], payments ?? []);
  }, [renderedProp, contract, parties, payments]);

  // The annex is derived from the working contract row, so it is only
  // available where that row exists (never for the public signer view,
  // which receives rendered text only).
  const legalBasis = useMemo(
    () => (includeLegalBasis && contract && rendered ? buildLegalBasisReport(contract, rendered) : null),
    [contract, rendered, includeLegalBasis]
  );

  // The contract date: the property-rent wizard stores its own date; every
  // other type uses the immutable creation date.
  const contractDate = useMemo(() => {
    if (meta) return formatIsoJalali(meta.contractDateIso.slice(0, 10));
    if (!contract) return "";
    const durations = (contract.data as { durations?: { contractDate?: string } } | null)
      ?.durations;
    const stored = contract.type === "property_rent" ? durations?.contractDate : null;
    return formatIsoJalali((stored || contract.createdAt).slice(0, 10));
  }, [contract, meta]);

  const typeFa = meta?.typeFa ?? contract?.typeFa ?? "";
  const referenceCode = meta?.referenceCode ?? contract?.referenceCode ?? "";
  const templateVersion = meta?.templateVersion ?? contract?.templateVersion ?? "";

  // ----------------------------------------------------------
  // Blocks
  // ----------------------------------------------------------
  const blocks = useMemo<Block[]>(() => {
    if (!rendered) return [];
    const list: Block[] = [];

    // The letterhead is the first BLOCK, not a fixed page header: it is
    // measured like everything else, so page 1's real capacity is known
    // and the title never collides with the first clause.
    list.push({
      id: "letterhead",
      node: (
        <header className="a4-letterhead">
          {/* Logo and the identification block both sit at the TOP LEFT; the
              title is centred on its own line beneath them, so neither the
              logo nor the metadata can ever overlap the title. */}
          <div className="a4-letterhead-top">
            <div className="a4-letterhead-ident">
              {/* The public LEGALIR mark is used on documents; the
                  dashboard chrome mark is reserved for the app. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/legalir-logo.png" alt="LEGALIR" className="a4-letterhead-logo" />
              <div className="a4-letterhead-meta">
                <p className="a4-doc-type">{typeFa}</p>
                <p className="a4-doc-ref">
                  شناسه قرارداد: <span dir="ltr">{referenceCode}</span>
                </p>
                <p className="a4-doc-ref">تاریخ قرارداد: {contractDate}</p>
                <p className="a4-doc-ref">
                  نسخه:{" "}
                  {versionNumber && versionNumber > 0
                    ? faNum(versionNumber)
                    : "پیش‌نویس (ثبت‌نشده)"}
                  {" — "}نسخه قالب: {templateVersion}
                </p>
                {stateFa && <p className="a4-doc-state">وضعیت: {stateFa}</p>}
                {documentHash && (
                  <p className="a4-doc-hash" dir="ltr">
                    SHA-256: {documentHash}
                  </p>
                )}
              </div>
            </div>
          </div>

          {reviewStamp?.applied && reviewStamp.official && reviewStamp.sealHref ? (
            /* The OFFICIAL mark: the real seal + the print-only hologram.
               These are drawn only for a version a Super Admin stamped, and
               they sit beside (never instead of) the party signatures. */
            <div className="a4-official-mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={reviewStamp.sealHref} alt="مهر رسمی لیگالیر" className="a4-seal" />
              <div className="a4-hologram-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={reviewStamp.hologramHref}
                  alt="هولوگرام لیگالیر"
                  className="a4-hologram"
                />
                {/* Screen: hidden. Print/PDF: visible. Never a UI toggle. */}
                <span className="a4-hologram-ink a4-hologram-ink-brand">
                  {HOLOGRAM_INK.brand}
                </span>
                <span className="a4-hologram-ink a4-hologram-ink-serial">
                  {HOLOGRAM_INK.serial}
                </span>
              </div>
              <span className="a4-official-meta">
                {reviewStamp.approvedByLabelFa
                  ? `تأیید مدیر ارشد: ${reviewStamp.approvedByLabelFa}`
                  : "تأیید مدیر ارشد"}
                {reviewStamp.approvedAt
                  ? ` — ${formatIsoJalali(reviewStamp.approvedAt.slice(0, 10))}`
                  : ""}
              </span>
              <span className="a4-review-stamp-note">{CONTRACT_REVIEW_STAMP_DISCLAIMER_FA}</span>
            </div>
          ) : reviewStamp?.applied ? (
            <div className="a4-review-stamp">
              <span className="a4-review-stamp-title">{CONTRACT_REVIEW_STAMP_TEXT}</span>
              <span className="a4-review-stamp-meta">
                {reviewStamp.reviewedAt
                  ? `تاریخ بررسی: ${formatIsoJalali(reviewStamp.reviewedAt.slice(0, 10))}`
                  : ""}
                {reviewStamp.reviewerInitials
                  ? ` — بررسی‌کننده: ${reviewStamp.reviewerInitials}`
                  : ""}
                {reviewStamp.reviewId ? ` — شناسه: ${reviewStamp.reviewId}` : ""}
              </span>
              <span className="a4-review-stamp-note">{CONTRACT_REVIEW_STAMP_DISCLAIMER_FA}</span>
            </div>
          ) : null}

          <h1 className="a4-doc-title">{rendered.titleFa}</h1>
        </header>
      ),
      keepWithNext: true,
      estimate: 190,
    });

    list.push({
      id: "preamble",
      node: paragraph(rendered.preambleFa),
      estimate: estimate(rendered.preambleFa),
    });

    rendered.clauses.forEach((clause, index) => {
      const headingId = `clause-${index}-heading`;
      list.push({
        id: headingId,
        node: clauseHeading(clause.headingFa),
        keepWithNext: true,
        estimate: 34,
      });
      blocksOf(clause).forEach((block, pIndex) => {
        // Long tables become independent chunks so no single block can ever
        // exceed a page (clipping) and every chunk repeats its headings.
        for (const chunk of chunkBlock(block, `clause-${index}-b-${pIndex}`)) {
          list.push({
            id: chunk.id,
            node: renderBlock(chunk.block),
            estimate:
              chunk.block.kind === "paragraph"
                ? estimate(chunk.block.textFa)
                : 28 +
                  chunk.block.table.rowsFa.length * 24 +
                  (chunk.block.table.captionFa ? 18 : 0),
          });
        }
      });
    });

    // Signature block — never split.
    list.push({
      id: "signatures",
      node: (
        <div className="a4-signatures">
          <h3 className="a4-clause-heading">امضای طرفین</h3>
          <div className="a4-signature-grid">
            {rendered.signatureLines.map((line) => {
              const mark = signatureMarks?.[line.roleFa];
              return (
                <div key={line.roleFa} className="a4-signature-box">
                  <p className="a4-signature-role">{line.roleFa}</p>
                  <p className="a4-signature-name">{line.nameFa}</p>
                  {line.nationalId !== "……………" && (
                    <p className="a4-signature-id">کد ملی / شناسه: {line.nationalId}</p>
                  )}
                  <p className="a4-signature-date">
                    تاریخ امضا:{" "}
                    {mark?.signedAt
                      ? formatIsoJalali(mark.signedAt.slice(0, 10))
                      : "……………………"}
                  </p>
                  {mark?.statusFa && <p className="a4-signature-state">{mark.statusFa}</p>}
                </div>
              );
            })}
          </div>
          <p className="a4-footer-note">{rendered.footerFa}</p>
        </div>
      ),
      estimate: 190 + rendered.signatureLines.length * 12,
    });

    if (legalBasis && legalBasis.sections.length > 0) {
      list.push({
        id: "annex-heading",
        node: clauseHeading("پیوست — مبنای حقوقی و گزارش بررسی"),
        keepWithNext: true,
        breakBefore: true,
        estimate: 34,
      });
      list.push({
        id: "annex-disclaimer",
        node: <p className="a4-annex-disclaimer">{legalBasis.disclaimerFa}</p>,
        estimate: estimate(legalBasis.disclaimerFa),
      });
      legalBasis.sections.forEach((section, sIndex) => {
        list.push({
          id: `annex-${sIndex}-heading`,
          node: <p className="a4-annex-heading">{section.clauseHeadingFa}</p>,
          keepWithNext: true,
          estimate: 24,
        });
        section.citations.forEach((citation, cIndex) => {
          const text = `${citation.articleFa} (${citation.lawTitleFa}) — ${citation.noteFa}${
            citation.status === "pending" ? " — در انتظار بازبینی حقوقی" : ""
          }`;
          list.push({
            id: `annex-${sIndex}-c-${cIndex}`,
            node: <p className="a4-annex-item">{text}</p>,
            estimate: estimate(text, 22),
          });
        });
      });
      if (legalBasis.uncitedClauseCount > 0) {
        const text = `${legalBasis.uncitedClauseCount} بند دیگر بر پایهٔ توافق طرفین تنظیم شده و استناد قانونی جداگانه‌ای برای آن درج نشده است.`;
        list.push({
          id: "annex-uncited",
          node: <p className="a4-annex-item">{text}</p>,
          estimate: estimate(text, 22),
        });
      }
    }

    return list;
  }, [
    contractDate,
    documentHash,
    legalBasis,
    referenceCode,
    rendered,
    reviewStamp,
    signatureMarks,
    stateFa,
    templateVersion,
    typeFa,
    versionNumber,
  ]);

  // ----------------------------------------------------------
  // Measurement
  // ----------------------------------------------------------
  const measureRef = useRef<HTMLDivElement>(null);
  const footerProbeRef = useRef<HTMLElement>(null);
  const [metrics, setMetrics] = useState<{
    pageHeight: number;
    heights: Record<string, number>;
    width: number;
  } | null>(null);

  /**
   * Measure the page's REAL usable height — the page box minus its top and
   * bottom padding, its footer and the running header — then measure every
   * block once. The earlier version used the height of all content as the
   * page capacity, which made `paginate` believe one sheet could hold the
   * whole document and let `overflow:hidden` silently clip the rest.
   */
  const measure = useCallback(() => {
    const root = measureRef.current;
    if (!root) return;
    const content = root.querySelector<HTMLElement>("[data-a4-content]");
    const pageEl = root.querySelector<HTMLElement>(".a4-page");
    if (!content || !pageEl) return;

    const style = window.getComputedStyle(content);
    const padTop = parseFloat(style.paddingTop) || 0;
    const padBottom = parseFloat(style.paddingBottom) || 0;
    const pageBox = pageEl.getBoundingClientRect().height;
    const footerBox = footerProbeRef.current?.getBoundingClientRect().height ?? 0;

    const usable =
      pageBox - padTop - padBottom - footerBox - RUNNING_HEADER_RESERVE - PAGE_SAFETY;

    const heights: Record<string, number> = {};
    for (const el of root.querySelectorAll<HTMLElement>("[data-a4-block]")) {
      const id = el.dataset["a4Block"];
      if (id) heights[id] = el.getBoundingClientRect().height;
    }
    setMetrics({
      pageHeight: usable > 200 ? usable : FALLBACK_PAGE_HEIGHT,
      heights,
      width: content.getBoundingClientRect().width,
    });
  }, []);

  // Measure once the real font is in: a fallback face has different metrics,
  // so measuring before `document.fonts.ready` under-measures every block and
  // under-fills every page.
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
    () => paginate(blocks, metrics?.heights ?? {}, metrics?.pageHeight ?? FALLBACK_PAGE_HEIGHT),
    [blocks, metrics]
  );

  // ----------------------------------------------------------
  // Print — print ONLY the document, never the app chrome
  // ----------------------------------------------------------
  // The printable copy is mounted at `document.body` for the duration of
  // the print dialog (see the CSS in globals.css), so the app shell is
  // display:none'd instead of merely made invisible — that is what
  // prevents the tall wizard page from emitting blank sheets ahead of
  // the document.
  const [printing, setPrinting] = useState(false);
  const flushPrint = useCallback(() => setPrinting(true), []);

  useLayoutEffect(() => {
    if (!printing) return;
    let cancelled = false;
    const finish = () => setPrinting(false);
    window.addEventListener("afterprint", finish);

    // Never open the print dialog on a half-laid-out sheet: the Vazirmatn
    // faces and the letterhead logo must be in place, or the browser prints
    // fallback-metric text and a missing logo. We await fonts, every image in
    // the print root, and two animation frames before calling `print()`.
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

    // Fallback for engines that never fire `afterprint`.
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

  if (!rendered) return null;

  const renderPages = (rootClass: string) => (
    <div className={rootClass} dir="rtl">
      {pages.map((pageBlocks, pageIndex) => (
        <section
          key={`${rootClass}-${pageIndex}`}
          className="a4-page"
          aria-label={`صفحه ${faNum(pageIndex + 1)} از ${faNum(pageCount)}`}
        >
          {draft && (
            <div className="a4-watermark" aria-hidden="true">
              <span>{CONTRACT_DRAFT_WATERMARK_FA}</span>
            </div>
          )}

          <div className="a4-page-inner">
            {/* Pages 2+ repeat the document identity in a slim running
                header: the reader always knows which contract and which
                revision they are holding. */}
            {pageIndex > 0 && (
              <div className="a4-running-head">
                <span className="a4-running-type">{typeFa}</span>
                <span className="a4-running-ref" dir="ltr">
                  {referenceCode}
                </span>
                <span className="a4-running-version">
                  نسخه {versionNumber && versionNumber > 0 ? faNum(versionNumber) : "پیش‌نویس"}
                </span>
              </div>
            )}
            <div className="a4-page-blocks">
              {pageBlocks.map((block) => (
                <div key={block.id} className="a4-block">
                  {block.node}
                </div>
              ))}
            </div>
          </div>

          <footer className="a4-page-footer">
            <span>{rendered?.footerFa ?? ""}</span>
            <span>
              صفحه {faNum(pageIndex + 1)} از {faNum(pageCount)}
            </span>
          </footer>
        </section>
      ))}
    </div>
  );

  return (
    <div className={`a4-document ${className}`} dir="rtl">
      {showActions && (
        <div className="a4-actions no-print">
          <div className="a4-actions-meta">
            <span>{draft ? "پیش‌نویس — بدون امضا و تأیید نهایی" : "نسخه نهایی"}</span>
          </div>
          <div className="a4-actions-buttons">
            <button
              type="button"
              onClick={flushPrint}
              disabled={printing}
              className="a4-action-button"
            >
              {printing ? "در حال آماده‌سازی چاپ…" : "چاپ سند"}
            </button>
            {pdfHref && (
              <a href={pdfHref} className="a4-action-button" target="_blank" rel="noreferrer">
                دانلود PDF
              </a>
            )}
          </div>
        </div>
      )}

      {/* Hidden measurer — same page box and width as the visible sheet. */}
      <div className="a4-measurer" aria-hidden="true" ref={measureRef}>
        <div className="a4-page">
          <div className="a4-page-content" data-a4-content>
            {blocks.map((block) => (
              <div key={block.id} data-a4-block={block.id} className="a4-block">
                {block.node}
              </div>
            ))}
          </div>
          {/* A real footer inside the measurer, so its height is part of the
              page budget rather than guessed. */}
          <footer className="a4-page-footer" ref={footerProbeRef}>
            <span>{rendered?.footerFa ?? ""}</span>
            <span>صفحه ۱ از ۱</span>
          </footer>
        </div>
      </div>

      <div className="a4-pages">{renderPages("a4-pages-inner")}</div>

      {printing &&
        typeof document !== "undefined" &&
        createPortal(renderPages("a4-print-root"), document.body)}
    </div>
  );
}

/** Persian digits for page numbers and the version label. */
function faNum(value: number): string {
  return String(value).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
}
