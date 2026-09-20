// ============================================================
// LEGALIR — Property Contract Card
// ============================================================
// The list card for a contract built in the new Contract Operating
// System. It shows the real server-computed progress and the step the
// user left off at, so tapping it resumes the wizard exactly where
// they stopped — the "Resume" requirement of the spec.
//
// A draft also exposes two explicit actions:
//   • ادامه / ویرایش — resumes the SAME contract id (never creates a
//     new one); it is the primary action.
//   • حذف پیش‌نویس   — a destructive action that opens a confirmation
//     dialog before anything is deleted.
// ============================================================

"use client";

import Link from "next/link";
import type { PropertyContractListItem } from "@legalir/types";
import { Button } from "@legalir/ui";
import { IconArrowBack, IconContract, IconDelete, IconEdit, IconHome } from "@/lib/icons";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  property_rent: <IconHome className="w-5 h-5" />,
  property_sale: <IconContract className="w-5 h-5" />,
};

/** A state chip colour, keyed by how far along the contract is. */
function stateTone(state: PropertyContractListItem["state"]): string {
  if (state === "FINALIZED" || state === "READY_FOR_OFFICIAL_REGISTRATION") {
    return "bg-success-50 text-success-700";
  }
  if (state === "SIGNED" || state === "PARTIALLY_SIGNED" || state === "READY_TO_SIGN") {
    return "bg-info-50 text-info-700";
  }
  if (state === "CHANGES_REQUESTED" || state === "CANCELLED") {
    return "bg-error-50 text-error-700";
  }
  if (state === "READY_FOR_REVIEW" || state === "COUNTERPARTY_REVIEW") {
    return "bg-warning-50 text-warning-700";
  }
  return "bg-surface-container text-muted";
}

/**
 * Only drafts (and cancelled contracts) may be deleted — this mirrors
 * the server-side guard in DELETE /api/v1/property-contracts/[id].
 */
function isDeletable(state: PropertyContractListItem["state"]): boolean {
  return state === "DRAFT" || state === "CANCELLED";
}

interface PropertyContractCardProps {
  contract: PropertyContractListItem;
  /** Opens the delete-confirmation dialog for this contract. */
  onDelete?: (contract: PropertyContractListItem) => void;
}

export function PropertyContractCard({ contract, onDelete }: PropertyContractCardProps) {
  const isDone =
    contract.state === "FINALIZED" || contract.state === "READY_FOR_OFFICIAL_REGISTRATION";
  const deletable = isDeletable(contract.state);

  return (
    <div className="rounded-large bg-surface p-4 shadow-elevation-1 border border-divider hover:shadow-elevation-3 hover:border-primary/40 transition-all">
      {/* The info block is the resume target — it links to the existing
          contract id so the wizard reopens where the user stopped. */}
      <Link
        href={`/contracts/${contract.id}`}
        className="block focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-medium"
        aria-label={`ادامه قرارداد ${contract.title}`}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-medium bg-primary-container text-primary-on flex items-center justify-center shrink-0">
            {TYPE_ICONS[contract.type] ?? <IconContract className="w-5 h-5" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-titleSmall text-on-surface truncate">{contract.title}</h3>
              <span
                className={`text-labelSmall rounded-small px-2 py-0.5 shrink-0 ${stateTone(contract.state)}`}
              >
                {contract.stateFa}
              </span>
            </div>

            <p className="text-caption text-muted mt-1 truncate">
              {contract.typeFa} · {contract.referenceCode}
            </p>

            <div className="flex items-center gap-3 mt-2 text-caption text-muted">
              <span className="truncate">{contract.partySummaryFa}</span>
              {contract.locationFa !== "بدون نشانی" && (
                <span className="truncate">· {contract.locationFa}</span>
              )}
            </div>

            {/* Progress is the server-computed completeness, not a step count. */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-labelSmall text-muted mb-1">
                <span>{isDone ? "تکمیل‌شده" : `مرحله: ${contract.currentStepTitleFa}`}</span>
                <span>{contract.progress}٪</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className={`h-full rounded-full ${isDone ? "bg-success" : "bg-primary"}`}
                  style={{ width: `${contract.progress}%` }}
                />
              </div>
            </div>
          </div>

          <IconArrowBack className="w-4 h-4 text-muted shrink-0 mt-1" />
        </div>
      </Link>

      {/* Actions — primary resume, plus a destructive delete for drafts.
          Stacked on mobile, inline from the `tablet` breakpoint up. */}
      <div className="mt-4 flex flex-col tablet:flex-row tablet:items-center gap-2">
        <Link
          href={`/contracts/${contract.id}`}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-medium bg-primary text-primary-on text-labelLarge transition-all duration-short3 hover:state-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <IconEdit size={18} aria-hidden="true" />
          ادامه / ویرایش
        </Link>

        {deletable && onDelete && (
          <Button
            variant="text"
            size="medium"
            className="!text-error hover:!bg-error/10"
            startIcon={<IconDelete size={18} />}
            onClick={() => onDelete(contract)}
          >
            حذف پیش‌نویس
          </Button>
        )}
      </div>
    </div>
  );
}
