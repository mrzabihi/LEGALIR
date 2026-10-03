// ============================================================
// LEGALIR — User contract card (work item)
// ============================================================
// A USER contract card is a work item, not an inspiration. Where a
// template card leads with a big illustration and a specific CTA, this
// one leads with the contract's IDENTITY and its STATE OF WORK:
//
//   thumbnail · draft badge · title · type · id · party names ·
//   progress · last change · analysis badge · primary action · ⋮ menu
//
// The card shows BOTH axes, because they answer different questions:
//   • the DRAFT badge  — how far along the document is;
//   • the ANALYSIS badge — what the AI review of the last fixed
//     version said (or that it has not run / is stale).
//
// The primary action is the single verb for the current state, derived
// from BOTH axes («ادامه تکمیل», «بررسی نسخه جدید», «مشاهده نتیجه
// بررسی»), so the card always tells the user what the next step is.
// ============================================================

"use client";

import Link from "next/link";
import type { UnifiedContract } from "@/lib/contracts/unified";
import { contractHref } from "@/lib/contracts/unified";
import {
  CONTRACT_ANALYSIS_STATUS_LABELS,
  CONTRACT_ANALYSIS_STATUS_TONE,
  STATUS_DOT_CLASSES,
  STATUS_TONE_CLASSES,
  primaryActionLabel,
} from "@/lib/contracts/status";
import { ContractVisual } from "@/lib/contracts/visuals";
import { toRelativeTime } from "@/lib/persian-utils";
import { IconArrowBack, IconCopy, IconDelete } from "@/lib/icons";
import { ContractStatusBadge } from "./contract-status-badge";
import { ContractCardMenu, type ContractCardMenuItem } from "./contract-card-menu";

interface UserContractCardProps {
  contract: UnifiedContract;
  /** Opens the delete-confirmation dialog (drafts only). */
  onDelete?: (contract: UnifiedContract) => void;
  /** Copies the reference code / id to the clipboard. */
  onCopyId?: (contract: UnifiedContract) => void;
}

export function UserContractCard({ contract, onDelete, onCopyId }: UserContractCardProps) {
  const href = contractHref(contract);
  // The primary verb reads BOTH axes: a stale or failed review is the
  // more urgent next step than finishing the text.
  const actionLabel = primaryActionLabel(
    contract.status,
    contract.analysisStatus,
    contract.archived
  );

  const menuItems: ContractCardMenuItem[] = [];
  if (onCopyId) {
    menuItems.push({
      key: "copy",
      labelFa: "کپی شناسه قرارداد",
      icon: <IconCopy size={16} />,
      onSelect: () => onCopyId(contract),
    });
  }
  if (contract.deletable && onDelete) {
    menuItems.push({
      key: "delete",
      labelFa: "حذف پیش‌نویس",
      icon: <IconDelete size={16} />,
      destructive: true,
      onSelect: () => onDelete(contract),
    });
  }

  return (
    <div className="rounded-large border border-divider bg-surface p-4 shadow-elevation-1 hover:shadow-elevation-3 hover:border-primary/40 transition-all duration-short3">
      <div className="flex items-start gap-3">
        {/* Quiet thumbnail — anchors the row without competing with the
            status and progress, which are the point of this card. */}
        <div className="hidden mobile-l:block h-14 w-20 shrink-0 overflow-hidden rounded-medium bg-surface-container-low">
          <ContractVisual type={contract.type} className="h-full w-full" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={href}
              className="min-w-0 rounded-small focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <h3 className="truncate text-titleSmall text-on-surface">{contract.title}</h3>
            </Link>
            <ContractStatusBadge status={contract.status} label={contract.stateFa} />
          </div>

          <p className="mt-1 truncate text-caption text-muted">
            {contract.typeFa}
            {contract.subtitleFa ? ` · ${contract.subtitleFa}` : ""}
          </p>

          {/* The contract id — the same value the «کپی شناسه» action
              copies, shown so the user can match a card to a document. */}
          <p className="mt-0.5 truncate font-mono text-labelSmall text-muted" dir="ltr">
            {contract.referenceCode}
          </p>

          {/* Progress — the server-computed completeness for OS
              contracts; V1 contracts have no progress, so the bar is
              replaced by the last-change line alone. */}
          {contract.source === "os" && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-labelSmall text-muted">
                <span>
                  {contract.currentStepTitleFa
                    ? `مرحله: ${contract.currentStepTitleFa}`
                    : "پیشرفت تکمیل"}
                </span>
                <span>{contract.progress}٪</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className={`h-full rounded-full ${
                    contract.progress === 100 ? "bg-success" : "bg-primary"
                  }`}
                  style={{ width: `${contract.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* The AI-review axis — a SEPARATE badge from the draft badge,
              because it answers a different question. It is always
              labelled as an AI review, never a legal verdict. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AnalysisBadge status={contract.analysisStatus} />
            <span className="text-labelSmall text-muted">
              آخرین تغییر: {toRelativeTime(contract.updatedAt)}
            </span>
          </div>
        </div>

        {menuItems.length > 0 && <ContractCardMenu items={menuItems} />}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={href}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-medium bg-primary px-5 text-labelLarge text-primary-on transition-all duration-short3 hover:state-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          {actionLabel}
          <IconArrowBack size={18} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

/**
 * The AI-review badge. It is prefixed with «بررسی هوش مصنوعی» so the
 * label can never be mistaken for a legal approval, and it always
 * carries its text — the colour dot is decoration, not the message.
 */
function AnalysisBadge({ status }: { status: UnifiedContract["analysisStatus"] }) {
  const tone = CONTRACT_ANALYSIS_STATUS_TONE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-labelSmall ${STATUS_TONE_CLASSES[tone]}`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASSES[tone]}`}
        aria-hidden="true"
      />
      بررسی هوش مصنوعی: {CONTRACT_ANALYSIS_STATUS_LABELS[status]}
    </span>
  );
}
