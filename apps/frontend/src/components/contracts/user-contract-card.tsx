// ============================================================
// LEGALIR — User contract card (work item)
// ============================================================
// A USER contract card is a work item, not an inspiration. Where a
// template card leads with a big illustration and a "شروع" verb, this
// one leads with the contract's IDENTITY and its STATE OF WORK:
//
//   thumbnail · status badge · title · type · progress ·
//   last change · primary action · secondary ⋮ menu
//
// The primary action is the single verb for the current status
// («ادامه تکمیل», «مشاهده قرارداد», «دانلود مجدد»), so the card always
// tells the user what the next step is.
// ============================================================

"use client";

import Link from "next/link";
import type { UnifiedContract } from "@/lib/contracts/unified";
import { contractHref } from "@/lib/contracts/unified";
import { primaryActionLabel } from "@/lib/contracts/status";
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
  const actionLabel = primaryActionLabel(contract.status);

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

          <p className="mt-2 text-labelSmall text-muted">
            آخرین تغییر: {toRelativeTime(contract.updatedAt)}
          </p>
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
