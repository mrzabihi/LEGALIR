// ============================================================
// LEGALIR — Document Card
// List card showing document metadata, status, and risk level
// ============================================================

"use client";

import type { V1DocumentListItem } from "@legalir/types";
import { ProgressLinear } from "@legalir/ui";
import { IconDocument, IconFile, IconChevronRight } from "@/lib/icons";
import { StatusBadge } from "./status-badge";

// ============================================================
// Helpers
// ============================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffMin < 1) return "لحظاتی پیش";
  if (diffMin < 60) return `${diffMin} دقیقه پیش`;
  if (diffHour < 24) return `${diffHour} ساعت پیش`;
  if (diffDay === 1) return "دیروز";
  if (diffDay < 30) return `${diffDay} روز پیش`;
  if (diffMonth < 12) return `${diffMonth} ماه پیش`;
  return `${diffYear} سال پیش`;
}

function getDocumentIcon(mime: string) {
  if (mime === "application/pdf") return IconDocument;
  return IconFile;
}

const RISK_CHIP_CLASSES: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-red-100 text-red-800 border-red-200",
};

const RISK_LABELS: Record<string, string> = {
  low: "کم",
  medium: "متوسط",
  high: "زیاد",
  critical: "بحرانی",
};

function isProcessing(status: string): boolean {
  return ["processing", "extracting", "analyzing"].includes(status);
}

// ============================================================
// DocumentCard component
// ============================================================

interface DocumentCardProps {
  document: V1DocumentListItem;
  onClick: () => void;
}

export function DocumentCard({ document, onClick }: DocumentCardProps) {
  const { name, mime, sizeBytes, status, createdAt, riskLevel, findingCount } =
    document;

  const DocIcon = getDocumentIcon(mime);
  const processing = isProcessing(status);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col gap-3 rounded-xl border border-divider/60 bg-surface p-4 text-start shadow-elevation-1 transition-all duration-short3 hover:border-primary-300 hover:shadow-elevation-3 touch-target"
      aria-label={`سند ${name}`}
    >
      {/* Top row: icon + name + status */}
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-primary-50 text-primary-700">
          <DocIcon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="text-body-2 text-on-surface font-medium truncate"
            title={name}
          >
            {name}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StatusBadge status={status} />
            {riskLevel && status === "ready" && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium border ${RISK_CHIP_CLASSES[riskLevel] ?? ""}`}
                aria-label={`سطح ریسک: ${RISK_LABELS[riskLevel] ?? riskLevel}`}
              >
                {RISK_LABELS[riskLevel] ?? riskLevel}
              </span>
            )}
          </div>
        </div>
        <IconChevronRight
          size={18}
          className="shrink-0 text-muted transition-transform duration-short3 group-hover:-translate-x-0.5"
        />
      </div>

      {/* Meta row: size, date, findings */}
      <div className="flex items-center gap-3 text-caption text-muted flex-wrap">
        <span>{formatFileSize(sizeBytes)}</span>
        <span aria-hidden="true" className="text-divider">
          |
        </span>
        <span>{getRelativeTime(createdAt)}</span>
        {status === "ready" && findingCount > 0 && (
          <>
            <span aria-hidden="true" className="text-divider">
              |
            </span>
            <span>{findingCount} یافته</span>
          </>
        )}
      </div>

      {/* Progress bar for processing (indeterminate) */}
      {processing && (
        <div className="mt-1">
          <ProgressLinear
            value={0}
            variant="indeterminate"
            size="small"
            label="در حال پردازش سند"
          />
        </div>
      )}
    </button>
  );
}
