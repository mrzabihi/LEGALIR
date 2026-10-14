// ============================================================
// LEGALIR — User contract row (work item)
// ============================================================
// A USER contract is a work item, not an inspiration. Where a template
// card leads with an illustration and a specific CTA, this one is a
// compact, single-column scan row that leads with the contract's
// IDENTITY and its STATE OF WORK:
//
//   tile · title · status badge · type · id · progress · last change ·
//   analysis badge · ONE primary action · ⋮ menu
//
// The card shows BOTH axes, because they answer different questions:
//   • the status badge   — how far along the document is;
//   • the analysis badge — what the AI review of the last fixed version
//     said (or that it has not run / is stale).
//
// The primary action is the single verb for the current state, derived
// from BOTH axes («ادامه تکمیل», «بررسی نسخه جدید», «مشاهده نتیجه
// بررسی»); everything else (copy id, delete draft) lives in the ⋮ menu.
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
import { OverflowMenu } from "@/components/shared";
import { ContractStatusBadge } from "./contract-status-badge";

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

  const menuItems = [
    ...(onCopyId
      ? [
          {
            key: "copy",
            label: "کپی شناسه قرارداد",
            icon: <IconCopy size={16} />,
            onSelect: () => onCopyId(contract),
          },
        ]
      : []),
    ...(contract.deletable && onDelete
      ? [
          {
            key: "delete",
            label: "حذف پیش‌نویس",
            icon: <IconDelete size={16} />,
            destructive: true,
            onSelect: () => onDelete(contract),
          },
        ]
      : []),
  ];

  return (
    <article className="flex flex-col gap-3 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-3 transition-colors duration-short3 hover:border-[color:var(--color-outline)] tablet:flex-row tablet:items-center tablet:gap-4 tablet:p-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {/* Quiet tile — anchors the row without competing with the status
            and progress, which are the point of this row. */}
        <div
          className="h-11 w-11 shrink-0 overflow-hidden rounded-medium bg-surface-container-low"
          aria-hidden="true"
        >
          <ContractVisual type={contract.type} className="h-full w-full" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={href}
              className="min-w-0 rounded-small focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <h3 className="truncate text-titleSmall font-semibold text-on-surface">
                {contract.title}
              </h3>
            </Link>
            <ContractStatusBadge status={contract.status} label={contract.stateFa} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-caption text-on-surface-variant">
            <span className="font-medium">{contract.typeFa}</span>
            {contract.subtitleFa && (
              <>
                <span aria-hidden="true" className="text-divider">·</span>
                <span>{contract.subtitleFa}</span>
              </>
            )}
            <span aria-hidden="true" className="text-divider">·</span>
            {/* The contract id — the same value the «کپی شناسه» action copies. */}
            <span className="font-mono" dir="ltr">{contract.referenceCode}</span>
            <span aria-hidden="true" className="text-divider">·</span>
            <span>آخرین تغییر: {toRelativeTime(contract.updatedAt)}</span>
          </div>

          {/* Progress — the server-computed completeness for OS
              contracts; V1 contracts carry no progress, so only the
              analysis row is shown. */}
          {contract.source === "os" && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className={`h-full rounded-full ${
                    contract.progress === 100 ? "bg-success" : "bg-primary"
                  }`}
                  style={{ width: `${contract.progress}%` }}
                />
              </div>
              <span className="text-caption text-on-surface-variant">
                {contract.currentStepTitleFa ? `مرحله: ${contract.currentStepTitleFa}` : "پیشرفت تکمیل"}
              </span>
              <span className="text-caption font-medium text-on-surface-variant">
                {contract.progress}٪
              </span>
              <AnalysisBadge status={contract.analysisStatus} />
            </div>
          )}

          {contract.source !== "os" && (
            <div className="mt-1.5">
              <AnalysisBadge status={contract.analysisStatus} />
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 tablet:justify-end">
        <Link
          href={href}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-labelLarge font-medium text-primary-on transition-colors duration-short3 hover:bg-primary-700 hover:text-white focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 tablet:h-9 tablet:flex-none tablet:text-labelSmall"
        >
          {actionLabel}
          <IconArrowBack size={16} aria-hidden="true" />
        </Link>

        {menuItems.length > 0 && (
          <OverflowMenu
            label="گزینه‌های این قرارداد"
            size="small"
            className="shrink-0"
            items={menuItems}
          />
        )}
      </div>
    </article>
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
