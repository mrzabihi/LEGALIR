// ============================================================
// LEGALIR — Contract List Card (Phase 10)
// ============================================================

import Link from "next/link";
import type { V1ContractListItem } from "@legalir/types";
import { ContractStateBadge } from "./state-badge";

const typeIcons: Record<string, string> = {
  lease: "🏠",
  sale_purchase: "🛒",
  loan: "💰",
  partnership: "🤝",
  nda: "🛡️",
  employment: "💼",
  saas: "☁️",
  contracting: "🏗️",
  investment: "📈",
};

interface ContractCardProps {
  contract: V1ContractListItem;
}

export function ContractCard({ contract }: ContractCardProps) {
  const icon = typeIcons[contract.type] ?? "📄";

  return (
    <Link
      href={`/contracts/${contract.id}`}
      className="block rounded-large bg-surface p-4 shadow-elevation-1 border border-divider hover:shadow-elevation-2 transition-shadow focus-visible:ring-2 focus-visible:ring-primary touch-target"
      aria-label={`قرارداد ${contract.title}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 mt-0.5" aria-hidden="true">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h3 className="text-body-1 font-medium text-on-surface truncate">
              {contract.title}
            </h3>
            <ContractStateBadge state={contract.state} />
          </div>
          <div className="flex items-center gap-3 text-caption text-muted">
            <span>{contract.typeFa}</span>
            <span aria-hidden="true">·</span>
            <span>
              {contract.currentVersionNumber > 0
                ? `نسخه ${contract.currentVersionNumber}`
                : "بدون نسخه"}
            </span>
          </div>
          {contract.hasDraft && (
            <div className="mt-2 inline-flex items-center gap-1 text-caption text-amber-600 bg-amber-50 rounded-small px-2 py-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
              پیش‌نویس ذخیره شده
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
