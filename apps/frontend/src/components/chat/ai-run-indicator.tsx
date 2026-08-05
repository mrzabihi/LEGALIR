"use client";

import type { AiRunStatus } from "@legalir/types";
import { IconCheck, IconWarning, IconError } from "@/lib/icons";

const STATUS_LABELS: Record<AiRunStatus, string> = {
  queued: "در صف",
  retrieving: "در حال دریافت اطلاعات",
  generating: "در حال تولید پاسخ",
  validating: "در حال اعتبارسنجی",
  succeeded: "تکمیل شد",
  blocked: "مسدود شد",
  failed: "با خطا مواجه شد",
};

const STATUS_ICONS: Partial<Record<AiRunStatus, React.ReactNode>> = {
  succeeded: <IconCheck size={16} className="text-success" />,
  blocked: <IconWarning size={16} className="text-warning" />,
  failed: <IconError size={16} className="text-error" />,
};

const STATUS_COLORS: Record<AiRunStatus, string> = {
  queued: "bg-outline/30",
  retrieving: "bg-primary/50 animate-pulse",
  generating: "bg-primary/70 animate-pulse",
  validating: "bg-primary/90 animate-pulse",
  succeeded: "bg-success",
  blocked: "bg-warning",
  failed: "bg-error",
};

interface AiRunIndicatorProps {
  status: AiRunStatus;
}

export function AiRunIndicator({ status }: AiRunIndicatorProps) {
  const isTerminal = status === "succeeded" || status === "blocked" || status === "failed";
  const isActive = !isTerminal;

  return (
    <div className="flex items-center gap-2 py-2 px-3">
      <span
        className={[
          "w-2 h-2 rounded-full shrink-0",
          STATUS_COLORS[status],
        ].join(" ")}
      />
      <span className="text-bodySmall text-onSurfaceVariant">
        {STATUS_LABELS[status]}
      </span>
      {STATUS_ICONS[status] && (
        <span className="shrink-0">{STATUS_ICONS[status]}</span>
      )}
      {isActive && (
        <span className="text-bodySmall text-muted">...</span>
      )}
    </div>
  );
}

export function getStatusLabel(status: AiRunStatus): string {
  return STATUS_LABELS[status];
}
