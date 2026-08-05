// ============================================================
// LEGALIR — Document Detail View
// Full document detail with processing, analysis, text, preview (Phase 9)
// ============================================================

"use client";

import { useState, useCallback } from "react";
import type { V1DocumentDetail, DocumentJob } from "@legalir/types";
import {
  Button,
  IconButton,
  ProgressLinear,
  Skeleton,
  ErrorState,
} from "@legalir/ui";
import {
  IconArrowBack,
  IconDelete,
  IconRetry,
  IconDownload,
  IconCheckCircle,
  IconWarning,
  IconInfo,
} from "@/lib/icons";
import { StatusBadge } from "./status-badge";
import { AnalysisReport } from "./analysis-report";
import { ExtractedText } from "./extracted-text";
import { PreviewPlaceholder } from "./preview-placeholder";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

// ============================================================
// Stage label mapping
// ============================================================

const STAGE_LABELS: Record<string, string> = {
  processing: "پردازش اولیه",
  extracting: "استخراج متن",
  analyzing: "تحلیل حقوقی",
  ready: "تکمیل شده",
  failed: "خطا",
  blocked: "مسدود",
};

const STAGE_ORDER: string[] = [
  "processing",
  "extracting",
  "analyzing",
  "ready",
];

function getStageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

function getStageIndex(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 ? idx : -1;
}

function isProcessingStatus(status: string): boolean {
  return ["processing", "extracting", "analyzing"].includes(status);
}

// ============================================================
// Job list sub-component
// ============================================================

function JobList({ jobs }: { jobs: DocumentJob[] }) {
  return (
    <div className="flex flex-col gap-2" dir="rtl">
      <h4 className="text-labelSmall text-on-surface font-medium">مراحل پردازش:</h4>
      {jobs.map((job) => (
        <div
          key={job.id}
          className="flex items-center gap-2 rounded-medium bg-surface border border-divider px-3 py-2"
        >
          {/* Status icon */}
          {job.status === "completed" ? (
            <IconCheckCircle size={18} className="text-green-600 shrink-0" />
          ) : job.status === "failed" ? (
            <IconWarning size={18} className="text-red-600 shrink-0" />
          ) : job.status === "running" ? (
            <div className="w-[18px] h-[18px] shrink-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          ) : (
            <IconInfo size={18} className="text-muted shrink-0" />
          )}

          {/* Stage name */}
          <span className="text-caption text-on-surface flex-1">
            {getStageLabel(job.stage)}
          </span>

          {/* Progress for running */}
          {job.status === "running" && (
            <span className="text-caption text-muted">{job.progress}٪</span>
          )}

          {/* Error code */}
          {job.status === "failed" && job.errorCode && (
            <span className="text-caption text-red-600 text-end max-w-[120px] truncate" title={job.errorCode}>
              {job.errorCode}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Processing section
// ============================================================

function ProcessingSection({
  jobs,
  currentStage,
  progress,
}: {
  jobs: DocumentJob[];
  currentStage: string | null;
  progress: number;
}) {
  const currentStageIndex = currentStage ? getStageIndex(currentStage) : 0;

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-labelLarge text-on-surface font-medium">
            در حال پردازش سند
          </h3>
          <span className="text-caption text-muted">{progress}٪</span>
        </div>
        <ProgressLinear value={progress} label={`پیشرفت پردازش: ${progress} درصد`} showValue />
      </div>

      {/* Current stage */}
      {currentStage && (
        <div className="flex items-center gap-2 rounded-medium bg-blue-50 border border-blue-100 p-3">
          <div className="w-5 h-5 shrink-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <div>
            <p className="text-caption font-medium text-blue-800">
              مرحله فعلی: {getStageLabel(currentStage)}
            </p>
          </div>
        </div>
      )}

      {/* Stage progress indicators */}
      <div className="flex items-center gap-1">
        {STAGE_ORDER.map((stage, idx) => {
          const isCurrent = idx === currentStageIndex;
          const isCompleted = idx < currentStageIndex;
          const _isPending = idx > currentStageIndex;

          return (
            <div key={stage} className="flex items-center flex-1">
              {/* Step bubble */}
              <div
                className={[
                  "flex items-center justify-center w-6 h-6 rounded-full text-caption font-bold shrink-0",
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isCurrent
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-muted",
                ].join(" ")}
                aria-label={`${getStageLabel(stage)}${isCompleted ? " (تکمیل شده)" : isCurrent ? " (در حال انجام)" : " (در انتظار)"}`}
              >
                {isCompleted ? (
                  <IconCheckCircle size={14} />
                ) : (
                  <span className="text-[10px]">{idx + 1}</span>
                )}
              </div>

              {/* Connector line */}
              {idx < STAGE_ORDER.length - 1 && (
                <div
                  className={[
                    "flex-1 h-0.5 mx-1",
                    isCompleted ? "bg-green-500" : "bg-gray-200",
                  ].join(" ")}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Stage labels */}
      <div className="flex items-start gap-1">
        {STAGE_ORDER.map((stage) => (
          <span
            key={stage}
            className="flex-1 text-center text-caption text-muted"
          >
            {getStageLabel(stage)}
          </span>
        ))}
      </div>

      {/* Job list */}
      {jobs.length > 0 && <JobList jobs={jobs} />}
    </div>
  );
}

// ============================================================
// DocumentDetail component
// ============================================================

interface DocumentDetailProps {
  document: V1DocumentDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  onBack: () => void;
}

export function DocumentDetail({
  document,
  isLoading,
  isError,
  onRetry,
  onDelete,
  isDeleting,
  onBack,
}: DocumentDetailProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleOpenDelete = useCallback(() => setDeleteDialogOpen(true), []);
  const handleCloseDelete = useCallback(() => setDeleteDialogOpen(false), []);
  const handleConfirmDelete = useCallback(() => {
    onDelete();
  }, [onDelete]);

  const processing = document
    ? isProcessingStatus(document.status)
    : false;

  // ============================================================
  // Loading state
  // ============================================================
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4" dir="rtl">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" width="40px" height="40px" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton variant="text" width="192px" height="24px" />
            <Skeleton variant="text" width="96px" height="16px" />
          </div>
        </div>
        <Skeleton variant="text" width="100%" height="16px" />
        <Skeleton variant="text" width="75%" height="16px" />
        <Skeleton variant="rectangular" width="100%" height="256px" />
      </div>
    );
  }

  // ============================================================
  // Error state
  // ============================================================
  if (isError) {
    return (
      <div dir="rtl">
        <div className="mb-4">
          <IconButton
            label="بازگشت"
            onClick={onBack}
            variant="standard"
            className="touch-target"
          >
            <IconArrowBack size={22} />
          </IconButton>
        </div>
        <ErrorState
          title="خطا در دریافت اطلاعات سند"
          message="دریافت جزئیات سند با خطا مواجه شد."
          onRetry={onRetry}
        />
      </div>
    );
  }

  // ============================================================
  // Not found state
  // ============================================================
  if (!document) {
    return (
      <div dir="rtl">
        <div className="mb-4">
          <IconButton
            label="بازگشت"
            onClick={onBack}
            variant="standard"
            className="touch-target"
          >
            <IconArrowBack size={22} />
          </IconButton>
        </div>
        <ErrorState
          title="سند یافت نشد"
          message="سند مورد نظر وجود ندارد یا حذف شده است."
        />
      </div>
    );
  }

  const { id: _id, name, status, mime, jobs, report, extractedText } = document;

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* ============================================================
          Header: back, name, status, actions
          ============================================================ */}
      <div className="flex flex-col gap-3">
        {/* Back button + title row */}
        <div className="flex items-center gap-3">
          <IconButton
            label="بازگشت به لیست اسناد"
            onClick={onBack}
            variant="standard"
            className="touch-target shrink-0"
          >
            <IconArrowBack size={22} />
          </IconButton>
          <h1
            className="text-h2 text-on-surface truncate flex-1"
            title={name}
          >
            {name}
          </h1>
        </div>

        {/* Status + actions row */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={status} />

          {/* Retry button for failed documents */}
          {status === "failed" && (
            <Button
              variant="outlined"
              size="small"
              onClick={onRetry}
              className="touch-target"
              aria-label="تلاش مجدد برای پردازش سند"
              startIcon={<IconRetry size={16} />}
            >
              تلاش مجدد
            </Button>
          )}

          {/* Download button (disabled placeholder) */}
          <Button
            variant="outlined"
            size="small"
            disabled
            className="touch-target"
            aria-label="دانلود سند - به زودی"
            startIcon={<IconDownload size={16} />}
          >
            دانلود
          </Button>

          {/* Delete button */}
          <Button
            variant="text"
            size="small"
            onClick={handleOpenDelete}
            disabled={isDeleting}
            className="text-red-600 hover:bg-red-50 touch-target"
            aria-label="حذف سند"
            startIcon={<IconDelete size={16} />}
          >
            حذف
          </Button>
        </div>
      </div>

      {/* ============================================================
          Processing section
          ============================================================ */}
      {processing && (
        <div className="rounded-large border border-divider bg-surface p-5">
          <ProcessingSection
            jobs={jobs}
            currentStage={
              jobs.length > 0
                ? jobs.find((j) => j.status === "running")?.stage ??
                  jobs[jobs.length - 1]?.stage ??
                  null
                : status
            }
            progress={
              jobs.length > 0
                ? Math.round(
                    jobs.reduce((sum, j) => sum + j.progress, 0) / jobs.length
                  )
                : 0
            }
          />
        </div>
      )}

      {/* ============================================================
          Failed document error
          ============================================================ */}
      {status === "failed" && (
        <div className="flex items-start gap-2 rounded-medium bg-red-50 border border-red-200 p-4">
          <IconWarning size={22} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-body-2 text-red-800 font-medium">
              پردازش سند با خطا مواجه شد
            </p>
            <p className="text-caption text-red-700 mt-1">
              لطفا دوباره تلاش کنید یا در صورت تکرار خطا با پشتیبانی تماس بگیرید.
            </p>
          </div>
        </div>
      )}

      {/* ============================================================
          Analysis report section
          ============================================================ */}
      {(status === "ready" || report) && (
        <AnalysisReport
          report={report ?? null}
          isLoading={false}
          isError={false}
        />
      )}

      {/* ============================================================
          Extracted text section
          ============================================================ */}
      <ExtractedText
        text={extractedText ?? null}
        isLoading={processing}
      />

      {/* ============================================================
          Preview placeholder
          ============================================================ */}
      <PreviewPlaceholder documentName={name} mime={mime} />

      {/* ============================================================
          Delete confirmation dialog
          ============================================================ */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        documentName={name}
      />
    </div>
  );
}
