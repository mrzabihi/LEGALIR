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
  ContractPreSignTip,
  PropertyContract,
} from "@legalir/types";
import {
  CONTRACT_DRAFT_WATERMARK_FA,
  CONTRACT_PRE_SIGN_TIPS_DISCLAIMER_FA,
  CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
  CONTRACT_REVIEW_STAMP_TEXT,
} from "@legalir/types";
import {
  renderContract,
  type RenderedBlock,
  type RenderedContract,
  type RenderedTable,
} from "@/lib/contracts/template";
import {
  LEGAL_BASIS_SEED,
  buildLegalBasisReport,
  seedPreSignTips,
} from "@/lib/contracts/legal-basis";
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
  /**
   * §7 — the type's non-compulsory «قبل از امضا بدانید» tips, printed as a
   * SEPARATE annex. Omit to fall back to the reviewed seed for the type.
   */
  preSignTips?: ContractPreSignTip[];
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
  preSignTips: preSignTipsProp,
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
    () =>
      includeLegalBasis && contract && rendered
        ? buildLegalBasisReport(contract, rendered, LEGAL_BASIS_SEED)
        : null,
    [contract, rendered, includeLegalBasis]
  );

  // §7 — the pre-sign tips. A caller that already read the merged (stored)
  // rows passes them in; otherwise the reviewed seed for the type is used,
  // so the annex is never empty for a seeded type.
  const tips = useMemo<ContractPreSignTip[]>(
    () => preSignTipsProp ?? (contract ? seedPreSignTips(contract.type) : []),
    [preSignTipsProp, contract]
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

  /**
   * ONE guard for everything the official mark brings with it — the seal
   * images in every footer, the disclaimer and the letterhead line. The
   * seal asset is what proves the mark; without it none of the rest may be
   * claimed, or a contract would print a seal disclaimer with no seal.
   */
  // Narrowed to the stamp itself (not a boolean) so every consumer reads
  // `officialStamp.sealHref` without a non-null assertion.
  const officialStamp =
    reviewStamp?.applied && reviewStamp.official && reviewStamp.sealHref
      ? reviewStamp
      : null;

  /**
   * The unreviewed-document mark. Derived from the SAME rule the PDF and
   * DOCX renderers apply — the watermark and the review stamp are mutually
   * exclusive — so a page can never show both, and never shows neither.
   */
  const showWatermark = draft && !reviewStamp?.applied;

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
          {/* The LEGALIR mark keeps the physical TOP-LEFT corner; the
              identification block is RIGHT-ALIGNED on the opposite side,
              where a Persian reader looks for the document identity. The
              title is a separate, centred line beneath, so neither the
              logo nor the metadata can ever overlap it. */}
          <div className="a4-letterhead-top">
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
                {versionNumber && versionNumber > 0 ? faNum(versionNumber) : "پیش‌نویس (ثبت‌نشده)"}
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

          {officialStamp ? (
            /* The OFFICIAL approval is recorded here as TEXT only. The seal
               and hologram themselves belong to the per-page footer (see
               `footerNode`), because the server PDF draws them at the bottom
               of EVERY page — the screen must not show a different layout. */
            <span className="a4-official-meta a4-official-letterhead">
              {officialStamp.approvedByLabelFa
                ? `مهر رسمی لیگالیر — تأیید مدیر ارشد: ${officialStamp.approvedByLabelFa}`
                : "مهر رسمی لیگالیر — تأیید مدیر ارشد"}
              {officialStamp.approvedAt
                ? ` — ${formatIsoJalali(officialStamp.approvedAt.slice(0, 10))}`
                : ""}
            </span>
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

    // The closing note (§2.2) is pulled OUT of the clause flow: it prints
    // after every article and after the non-binding annex, so it genuinely
    // sits at the end of the material and can never be read as one more
    // contract article.
    const closingNote = rendered.clauses.find((c) => c.id === "common.supplementary_note");
    const materialClauses = rendered.clauses.filter(
      (c) => c.id !== "common.supplementary_note"
    );

    const pushClauseBlocks = (clause: RenderedContract["clauses"][number], key: string) => {
      list.push({
        id: `${key}-heading`,
        node: clauseHeading(clause.headingFa),
        keepWithNext: true,
        estimate: 34,
      });
      blocksOf(clause).forEach((block, pIndex) => {
        // Long tables become independent chunks so no single block can ever
        // exceed a page (clipping) and every chunk repeats its headings.
        for (const chunk of chunkBlock(block, `${key}-b-${pIndex}`)) {
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
    };

    materialClauses.forEach((clause, index) => {
      pushClauseBlocks(clause, `clause-${index}`);
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

    // §7 — the pre-sign tips annex: a SEPARATE, non-compulsory block that
    // belongs to the contract TYPE, not to its text. It is never presented
    // as a term and requires no acknowledgement.
    if (tips.length > 0) {
      list.push({
        id: "tips-heading",
        node: clauseHeading("پیوست — نکات پیش از امضا (غیرالزام‌آور)"),
        keepWithNext: true,
        breakBefore: true,
        estimate: 34,
      });
      list.push({
        id: "tips-disclaimer",
        node: <p className="a4-annex-disclaimer">{CONTRACT_PRE_SIGN_TIPS_DISCLAIMER_FA}</p>,
        estimate: estimate(CONTRACT_PRE_SIGN_TIPS_DISCLAIMER_FA),
      });
      tips.forEach((tip, index) => {
        list.push({
          id: `tips-${index}-heading`,
          node: <p className="a4-annex-heading">{tip.titleFa}</p>,
          keepWithNext: true,
          estimate: 24,
        });
        const body = `${tip.bodyFa} (منبع: ${tip.sourceNameFa} — نسخهٔ محتوا ${tip.contentVersion})${
          tip.status === "pending" ? " — در انتظار بررسی حقوقی" : ""
        }`;
        list.push({
          id: `tips-${index}-body`,
          node: <p className="a4-annex-item">{body}</p>,
          estimate: estimate(body, 22),
        });
      });
    }

    // §2.2 — the closing note, immediately before the signatures: it is the
    // last thing a reader sees before signing, exactly as the wizard promised.
    if (closingNote) {
      pushClauseBlocks(closingNote, "closing-note");
    }

    // §2.6 — the FULL signature block is the document's last block. It is a
    // single, unbreakable unit: the paginator moves it whole to a fresh page
    // when it does not fit, so no page can ever carry half a signature block.
    list.push({
      id: "signatures",
      node: (
        <div className="a4-signatures">
          <h3 className="a4-clause-heading">امضای طرفین</h3>
          {/* A real RTL table: role / full name / signing place / state.
              A table (not floating boxes) keeps the two parties aligned and
              makes «who signs where» unambiguous on paper. The whole block
              is one unbreakable unit, so the table is moved to a fresh page
              rather than split across sheets. */}
          <table className="a4-signature-table">
            <thead>
              <tr>
                <th scope="col">نقش</th>
                <th scope="col">نام کامل</th>
                <th scope="col">محل امضا</th>
                <th scope="col">وضعیت امضا</th>
              </tr>
            </thead>
            <tbody>
              {rendered.signatureLines.map((line) => {
                const mark = signatureMarks?.[line.roleFa];
                return (
                  <tr key={line.roleFa}>
                    <th scope="row" className="a4-signature-role">
                      {line.roleFa}
                    </th>
                    <td>
                      <span className="a4-signature-name">{line.nameFa}</span>
                      {line.nationalId !== "……………" && (
                        <span className="a4-signature-id">
                          کد ملی / شناسه: {line.nationalId}
                        </span>
                      )}
                    </td>
                    {/* The physical signing area — real ruled space, kept
                        apart from the typed name so the two can never be
                        confused with an electronic signature. */}
                    <td className="a4-signature-place">
                      <div className="a4-signature-rule" aria-hidden="true" />
                    </td>
                    <td className="a4-signature-state">
                      {mark?.statusFa ? (
                        <>
                          <span className="a4-signature-state-label">{mark.statusFa}</span>
                          {mark.signedAt && (
                            <span className="a4-signature-date">
                              {formatIsoJalali(mark.signedAt.slice(0, 10))}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="a4-signature-pending">در انتظار امضا</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="a4-footer-note">{rendered.footerFa}</p>
        </div>
      ),
      estimate: 190 + rendered.signatureLines.length * 62,
    });

    return list;
  }, [
    contractDate,
    documentHash,
    legalBasis,
    referenceCode,
    officialStamp,
    rendered,
    signatureMarks,
    stateFa,
    templateVersion,
    tips,
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
      // `complete` means "fetched", not "decoded". The seal and hologram are
      // multi-megabyte PNGs mounted into a freshly created portal, so wait
      // for the decoder too — otherwise the print dialog can capture the
      // boxes before the pixels exist and emit blank marks.
      await Promise.all(
        images.map((img) => img.decode?.().catch(() => undefined) ?? Promise.resolve())
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

  /**
   * §2.6 — the page footer. It carries THREE things, always in the same
   * reserved band: a legible paraphe strip (one initialled box per signing
   * role, so every page can be initialled), the document footer note and
   * the page number. Because the strip lives INSIDE the measured footer,
   * its height is part of the page budget — body text can never flow into
   * it, and it can never collide with a table, a clause or the page number.
   *
   * `pageNumber` differs only between the measurer (a dummy "۱ از ۱") and
   * the real sheet, so both boxes measure identically.
   */
  /**
   * `labelled` is true only on the first sheet: the seal is the same mark
   * on every page, and announcing it N times is noise for a screen reader.
   * Later pages still paint it — accessibility does not remove evidence.
   */
  /**
   * The review mark that appears on EVERY page. It is rendered only when the
   * server says the version was approved AND at least one real piece of
   * review data exists — a blank stamp would read as a confirmation the
   * record does not support. Each line is a real field; an absent field says
   * «ثبت نشده» instead of being silently dropped.
   */
  const stampConfirmed =
    reviewStamp?.applied === true &&
    Boolean(reviewStamp.reviewedAt || reviewStamp.reviewId);

  const reviewMarkNode = (
    <div className="a4-review-stamp a4-review-stamp-page">
      <span className="a4-review-stamp-title">{CONTRACT_REVIEW_STAMP_TEXT}</span>
      <span className="a4-review-stamp-meta">
        تاریخ بررسی:{" "}
        {reviewStamp?.reviewedAt
          ? formatIsoJalali(reviewStamp.reviewedAt.slice(0, 10))
          : "ثبت نشده"}
      </span>
      <span className="a4-review-stamp-meta">
        بررسی‌کننده:{" "}
        {reviewStamp?.reviewerInitials || reviewStamp?.reviewingOfficeFa || "ثبت نشده"}
      </span>
      <span className="a4-review-stamp-meta">
        شناسه بررسی: {reviewStamp?.reviewId || "ثبت نشده"}
      </span>
      <span className="a4-review-stamp-note">{CONTRACT_REVIEW_STAMP_DISCLAIMER_FA}</span>
    </div>
  );

  const footerNode = (pageNumber: string, labelled: boolean, withProbe = false) => (
    <footer className="a4-page-footer" ref={withProbe ? footerProbeRef : undefined}>
      <div className="a4-paraphe" aria-hidden="true">
        <span className="a4-paraphe-caption">پاراف صفحه</span>
        {rendered.signatureLines.map((line) => (
          <span key={line.roleFa} className="a4-paraphe-item">
            <span className="a4-paraphe-role">{line.roleFa}</span>
            <span className="a4-paraphe-box" />
          </span>
        ))}
      </div>

      {/* The review mark and the official seal share ONE row on EVERY page:
          the review block sits at the reading edge (right), the seal +
          hologram group at the physical BOTTOM-LEFT. Both live inside the
          measured footer band, so neither can ever overlap body text,
          tables, signatures or the page number. */}
      {(stampConfirmed || officialStamp) && (
        <div className="a4-page-marks">
          {/* Rendered FIRST so `space-between` anchors it to the physical
              left; the review block then lands on the right. */}
          {officialStamp && (
            <div className="a4-page-official" data-a4-page-official="true">
              {/* §4 — the hologram is the LEFTMOST item, so the pair reads
                  «holo · seal» from the physical bottom-left corner. It is
                  optional in the PDF too (`officialMarkPages` accepts null),
                  so a seal-only stamp renders the seal alone rather than an
                  empty image box. */}
              {officialStamp.hologramHref && (
                <div className="a4-hologram-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={officialStamp.hologramHref}
                    alt={labelled ? "هولوگرام لیگالیر" : ""}
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
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={officialStamp.sealHref}
                alt={labelled ? "مهر رسمی لیگالیر" : ""}
                className="a4-seal"
              />
            </div>
          )}
          {stampConfirmed && reviewMarkNode}
        </div>
      )}
      {/* One disclaimer per page. The review block already ends with it, so
          the standalone line is only needed when the OFFICIAL seal is the
          only mark on the page. */}
      {officialStamp && !stampConfirmed && (
        <span className="a4-review-stamp-note a4-page-official-note">
          {CONTRACT_REVIEW_STAMP_DISCLAIMER_FA}
        </span>
      )}

      <div className="a4-page-footer-line">
        <span>{rendered?.footerFa ?? ""}</span>
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
          {/* The watermark is the UNREVIEWED-document mark, and it is
              mutually exclusive with the review stamp — exactly as in the
              PDF and DOCX renderers (`if (stamp.applied) stampBlock() else
              draftWatermark()`). A state-based `draft` alone is too coarse:
              an approved-but-unsigned contract is not final, but it already
              carries LEGALIR's review mark, and printing both would show a
              layout the signed PDF never has. */}
          {showWatermark && (
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

          {footerNode(`صفحه ${faNum(pageIndex + 1)} از ${faNum(pageCount)}`, pageIndex === 0)}
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
          {/* The SAME footer (paraphe strip + note + page number) inside the
              measurer, so its real height is part of the page budget rather
              than guessed. */}
          {footerNode("صفحه ۱ از ۱", true, true)}
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
