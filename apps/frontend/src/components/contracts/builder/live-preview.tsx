// ============================================================
// LEGALIR — Live contract preview
// ============================================================
// Renders the contract text from the SAME data the wizard is
// editing, using the deterministic template engine. There is no
// second copy of the content: the preview, the snapshot hash and
// the final PDF all come from `renderContract`.
// ============================================================

"use client";

import React, { useMemo } from "react";
import type { ContractParty, ContractPayment, PropertyContract } from "@legalir/types";
import {
  CONTRACT_DRAFT_WATERMARK_FA,
  CONTRACT_REVIEW_STAMP_DISCLAIMER_FA,
  CONTRACT_REVIEW_STAMP_TEXT,
} from "@legalir/types";
import { renderContract } from "@/lib/contracts/template";
import { buildLegalBasisReport } from "@/lib/contracts/legal-basis";
import { formatIsoJalali } from "@/lib/contracts/dates";

/**
 * The review mark shown on the preview. When `applied` the blue
 * «بررسی شد» stamp is drawn; otherwise the unapproved-draft watermark.
 * Omitting the prop entirely means "unapproved draft".
 */
export interface PreviewStamp {
  applied: boolean;
  reviewedAt?: string | null;
  reviewingOfficeFa?: string;
  reviewerInitials?: string | null;
  reviewId?: string;
}

export function LivePreview({
  contract,
  parties,
  payments,
  compact = false,
  stamp,
}: {
  contract: PropertyContract;
  parties: ContractParty[];
  payments: ContractPayment[];
  compact?: boolean;
  stamp?: PreviewStamp;
}) {
  const rendered = useMemo(
    () => renderContract(contract, parties, payments),
    [contract, parties, payments]
  );

  // §2 — the non-binding legal-basis annex. It lists ONLY catalogued,
  // reviewed provisions; an unmapped clause is left out, never guessed.
  const legalBasis = useMemo(
    () => buildLegalBasisReport(contract, rendered),
    [contract, rendered]
  );

  const approved = stamp?.applied === true;

  return (
    <article
      dir="rtl"
      className={`relative overflow-hidden rounded-large bg-surface border border-divider shadow-elevation-1 ${
        compact ? "p-4" : "p-6"
      }`}
    >
      {/* The unapproved-draft watermark, drawn across a not-yet-approved
          preview so a draft can never be mistaken for an approved doc. */}
      {!approved && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none"
        >
          <span className="-rotate-45 text-[64px] font-bold text-on-surface opacity-10 whitespace-nowrap">
            {CONTRACT_DRAFT_WATERMARK_FA}
          </span>
        </div>
      )}

      <div className="relative z-10">
      <header className="pb-4 mb-4 border-b border-divider">
        {approved && (
          <div className="mb-3 inline-flex flex-col items-start gap-1 rounded-medium border-2 border-dashed border-[#1C4E9C] px-4 py-2 text-[#1C4E9C]">
            <span className="text-titleSmall font-bold">{CONTRACT_REVIEW_STAMP_TEXT}</span>
            {(stamp?.reviewerInitials || stamp?.reviewedAt) && (
              <span className="text-labelSmall">
                {stamp?.reviewedAt
                  ? `تاریخ بررسی: ${formatIsoJalali(stamp.reviewedAt.slice(0, 10))}`
                  : ""}
                {stamp?.reviewerInitials ? ` — بررسی‌کننده: ${stamp.reviewerInitials}` : ""}
              </span>
            )}
            <span className="text-labelSmall max-w-md">{CONTRACT_REVIEW_STAMP_DISCLAIMER_FA}</span>
          </div>
        )}
        <h2 className={`${compact ? "text-h4" : "text-h3"} text-on-surface`}>
          {rendered.titleFa}
        </h2>
        <p className="text-caption text-muted mt-1">
          شناسه قرارداد: {contract.referenceCode} — نسخه قالب: {contract.templateVersion}
        </p>
      </header>

      <p className="text-body-2 text-on-surface leading-7 mb-5">{rendered.preambleFa}</p>

      <div className="space-y-5">
        {rendered.clauses.map((clause) => (
          <section key={clause.id}>
            <h3 className="text-titleSmall text-primary mb-1.5 flex items-center gap-2">
              {clause.headingFa}
              {clause.conditional && (
                <span className="text-labelSmall rounded-small bg-surface-container px-1.5 py-0.5 text-muted">
                  بند شرطی
                </span>
              )}
            </h3>
            <div className="space-y-1.5">
              {clause.paragraphs.map((p, i) => (
                <p key={i} className="text-body-2 text-on-surface-variant leading-7">
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-6 pt-4 border-t border-divider">
        <h3 className="text-titleSmall text-on-surface mb-2">امضای طرفین</h3>
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
          {rendered.signatureLines.map((line) => (
            <div
              key={line.roleFa}
              className="rounded-medium border border-dashed border-outline px-3 py-2.5"
            >
              <p className="text-labelMedium text-on-surface-variant">{line.roleFa}</p>
              <p className="text-body-2 text-on-surface mt-0.5">{line.nameFa}</p>
              <p className="text-caption text-muted">کد ملی: {line.nationalId}</p>
            </div>
          ))}
        </div>
        <p className="text-caption text-muted mt-4">{rendered.footerFa}</p>
        <p className="text-caption text-muted mt-1">
          تاریخ پیش‌نمایش: {formatIsoJalali(new Date().toISOString().slice(0, 10))}
        </p>
      </footer>

      {legalBasis.sections.length > 0 && (
        <section className="mt-6 border-t border-divider pt-4" aria-label="مبنای حقوقی و گزارش بررسی">
          <h3 className="text-titleSmall text-on-surface">پیوست — مبنای حقوقی و گزارش بررسی</h3>
          <p className="mt-1 rounded-medium bg-surface-container-low p-2.5 text-caption leading-6 text-muted">
            {legalBasis.disclaimerFa}
          </p>
          <ul className="mt-3 space-y-2.5">
            {legalBasis.sections.map((section) => (
              <li key={section.clauseId}>
                <p className="text-labelMedium text-on-surface-variant">{section.clauseHeadingFa}</p>
                <ul className="mt-1 space-y-1">
                  {section.citations.map((c, i) => (
                    <li key={i} className="text-caption leading-6 text-on-surface-variant">
                      <span className="font-medium text-on-surface">{c.articleFa}</span>
                      {` (${c.lawTitleFa}) — ${c.noteFa}`}
                      {c.status === "pending" && (
                        <span className="ms-1 rounded-small bg-surface-container px-1.5 py-0.5 text-labelSmall text-muted">
                          در انتظار بازبینی حقوقی
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {legalBasis.uncitedClauseCount > 0 && (
            <p className="mt-2 text-caption text-muted">
              {legalBasis.uncitedClauseCount} بند دیگر بر پایهٔ توافق طرفین تنظیم شده و استناد قانونی
              جداگانه‌ای برای آن درج نشده است.
            </p>
          )}
        </section>
      )}
      </div>
    </article>
  );
}
