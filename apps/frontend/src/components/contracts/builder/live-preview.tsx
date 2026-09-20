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
import { renderContract } from "@/lib/contracts/template";
import { formatIsoJalali } from "@/lib/contracts/dates";

export function LivePreview({
  contract,
  parties,
  payments,
  compact = false,
}: {
  contract: PropertyContract;
  parties: ContractParty[];
  payments: ContractPayment[];
  compact?: boolean;
}) {
  const rendered = useMemo(
    () => renderContract(contract, parties, payments),
    [contract, parties, payments]
  );

  return (
    <article
      dir="rtl"
      className={`rounded-large bg-surface border border-divider shadow-elevation-1 ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <header className="pb-4 mb-4 border-b border-divider">
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
    </article>
  );
}
