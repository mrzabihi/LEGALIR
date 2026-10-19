// ============================================================
// LEGALIR — Live contract preview
// ============================================================
// Renders the contract text from the SAME data the wizard is
// editing, using the deterministic template engine, as a real
// paginated A4 document. There is no second copy of the content: the
// preview, the snapshot hash and the final PDF all come from
// `renderContract`.
//
// The «پیش‌نویس» watermark is NOT a UI toggle: it is derived from the
// contract's stored state. Only a FINALIZED (or ARCHIVED-final) contract
// is shown without it, which is the same rule the server PDF applies.
// ============================================================

"use client";

import React from "react";
import type {
  ContractParty,
  ContractPayment,
  ContractPrintMirror,
  PropertyContract,
  PropertyContractState,
} from "@legalir/types";
import { PROPERTY_CONTRACT_STATE_LABELS } from "@legalir/types";
import {
  A4Document,
  type A4ReviewStamp,
  type A4SignatureMark,
} from "../document/a4-document";

/** The review mark shown on the document, when the version carries one. */
export type PreviewStamp = A4ReviewStamp;

/**
 * TRUE while the document is not the final, stamped contract. Derived
 * from the stored state only — never from how the UI happens to render.
 */
export function isDraftState(state: PropertyContractState): boolean {
  return state !== "FINALIZED" && state !== "ARCHIVED";
}

export function LivePreview({
  contract,
  parties,
  payments,
  stamp,
  signatureMarks,
  pdfHref,
  showActions = true,
  versionNumber,
  documentHash,
  includeLegalBasis = true,
  printMirror,
}: {
  contract: PropertyContract;
  parties: ContractParty[];
  payments: ContractPayment[];
  stamp?: PreviewStamp;
  /** Real signature state per role label, from the signature request. */
  signatureMarks?: Record<string, A4SignatureMark>;
  /** The PDF route for this version — only when a version exists. */
  pdfHref?: string;
  showActions?: boolean;
  versionNumber?: number | null;
  documentHash?: string | null;
  includeLegalBasis?: boolean;
  /**
   * §T7 — everything the STORED final PDF carries besides the contract
   * text: signature scans, annexed files, the red admin message and the
   * authenticity facts. Passing it makes the on-screen sheet mirror the
   * printed copy; omitting it renders text-only (the pre-T7 behaviour).
   */
  printMirror?: ContractPrintMirror | null;
}) {
  return (
    <A4Document
      contract={contract}
      parties={parties}
      payments={payments}
      draft={isDraftState(contract.state)}
      stateFa={PROPERTY_CONTRACT_STATE_LABELS[contract.state] ?? ""}
      versionNumber={versionNumber}
      documentHash={documentHash}
      reviewStamp={stamp}
      signatureMarks={signatureMarks}
      signatureImages={printMirror?.signatures}
      annexes={printMirror?.annexes}
      adminMessage={printMirror?.adminMessage ?? null}
      authenticity={printMirror?.authenticity ?? null}
      selfFinalNotice={printMirror?.selfFinal ?? null}
      pdfHref={pdfHref}
      showActions={showActions}
      includeLegalBasis={includeLegalBasis}
    />
  );
}
