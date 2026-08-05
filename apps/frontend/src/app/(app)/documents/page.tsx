// ============================================================
// LEGALIR — Documents List Page (Phase 9)
// ============================================================

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useDocuments, useInitiateUpload, useCompleteUpload } from "@/hooks/useDocuments";
import { DocumentList, UploadZone } from "@/components/documents";
import { Button, Dialog, SkeletonCard, EmptyState, ErrorState, ProgressLinear } from "@legalir/ui";
import { IconAdd, IconDocument } from "@/lib/icons";
import {
  SUPPORTED_DOCUMENT_MIMES,
  MAX_DOCUMENT_SIZE_BYTES,
} from "@legalir/types";
import type { V1DocumentListParams, V1DocumentFilter } from "@legalir/types";
import { formatFileSize } from "@/lib/persian-utils";

type UploadStep = "idle" | "uploading" | "processing" | "success" | "error";

export default function DocumentsPage() {
  const router = useRouter();

  // --- Search / Filter state ---
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<V1DocumentFilter>("all");
  const [sort, setSort] = React.useState<"newest" | "oldest" | "name">("newest");

  // --- Upload dialog state ---
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadStep, setUploadStep] = React.useState<UploadStep>("idle");
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  // --- Queries ---
  const listParams: V1DocumentListParams = {
    search: search || undefined,
    status,
    sort,
  };
  const { data, isLoading, isError, error, refetch } = useDocuments(listParams);

  // --- Mutations ---
  const initiateUpload = useInitiateUpload();
  const completeUpload = useCompleteUpload();

  const isMutating = uploadStep === "uploading" || uploadStep === "processing";

  // --- Navigation ---
  const handleDocumentClick = (id: string) => {
    router.push(`/documents/${id}`);
  };

  // --- File validation ---
  const validateFile = (file: File): string | null => {
    if (!(SUPPORTED_DOCUMENT_MIMES as readonly string[]).includes(file.type)) {
      return "فرمت فایل پشتیبانی نمی‌شود. فرمت‌های مجاز: PDF، DOCX، PNG، JPEG، WebP";
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      return `حجم فایل بیش از حد مجاز است. حداکثر حجم مجاز: ${formatFileSize(MAX_DOCUMENT_SIZE_BYTES)}`;
    }
    return null;
  };

  // --- Upload flow ---
  const startUpload = React.useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setUploadStep("error");
        setUploadError(validationError);
        return;
      }

      setSelectedFile(file);
      setUploadStep("uploading");
      setUploadError(null);
      setUploadProgress(0);

      initiateUpload.mutate(
        { name: file.name, mime: file.type, sizeBytes: file.size },
        {
          onSuccess: (uploadData) => {
            setUploadStep("processing");
            setUploadProgress(50);

            // Simulate progress toward completion
            const interval = setInterval(() => {
              setUploadProgress((prev) => {
                if (prev >= 90) {
                  clearInterval(interval);
                  return prev;
                }
                return prev + 10;
              });
            }, 300);

            completeUpload.mutate(uploadData.id, {
              onSuccess: () => {
                clearInterval(interval);
                setUploadProgress(100);
                setUploadStep("success");

                setTimeout(() => {
                  setUploadDialogOpen(false);
                  setSelectedFile(null);
                  setUploadStep("idle");
                  setUploadError(null);
                  setUploadProgress(0);
                  refetch();
                }, 1000);
              },
              onError: (err) => {
                clearInterval(interval);
                setUploadStep("error");
                setUploadError(err instanceof Error ? err.message : "خطا در تکمیل بارگذاری");
              },
            });
          },
          onError: (err) => {
            setUploadStep("error");
            setUploadError(err instanceof Error ? err.message : "خطا در شروع بارگذاری");
          },
        }
      );
    },
    [initiateUpload, completeUpload, refetch]
  );

  // --- Close upload dialog ---
  const handleCloseUploadDialog = () => {
    if (isMutating) return; // prevent closing during active upload
    setUploadDialogOpen(false);
    setSelectedFile(null);
    setUploadStep("idle");
    setUploadError(null);
    setUploadProgress(0);
  };

  // --- File drop handler ---
  const handleFile = (file: File) => {
    setSelectedFile(file);
    startUpload(file);
  };

  // --- Render loading ---
  if (isLoading) {
    return (
      <div className="p-4 tablet:p-6 max-w-6xl mx-auto">
        <Header onUploadClick={() => setUploadDialogOpen(true)} />
        <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} lines={3} />
          ))}
        </div>
      </div>
    );
  }

  // --- Render error ---
  if (isError) {
    return (
      <div className="p-4 tablet:p-6 max-w-6xl mx-auto">
        <Header onUploadClick={() => setUploadDialogOpen(true)} />
        <ErrorState
          title="خطا در دریافت اسناد"
          message={error instanceof Error ? error.message : "لطفاً دوباره تلاش کنید"}
          onRetry={() => refetch()}
          fullPage
        />
      </div>
    );
  }

  // --- Render empty ---
  if (!data?.items?.length && !search && status === "all") {
    return (
      <div className="p-4 tablet:p-6 max-w-6xl mx-auto">
        <Header onUploadClick={() => setUploadDialogOpen(true)} />
        <EmptyState
          icon={<IconDocument size={64} />}
          title="سندی بارگذاری نشده"
          description="قرارداد یا سند حقوقی خود را بارگذاری کنید تا تحلیل ریسک و بررسی بندها را دریافت کنید"
          action={{
            label: "بارگذاری سند",
            onClick: () => setUploadDialogOpen(true),
          }}
        />
      </div>
    );
  }

  // --- Render list ---
  return (
    <div className="p-4 tablet:p-6 max-w-6xl mx-auto">
      <Header onUploadClick={() => setUploadDialogOpen(true)} />

      <DocumentList
        documents={data?.items ?? []}
        isLoading={false}
        isError={false}
        search={search}
        status={status}
        sort={sort}
        onSearchChange={setSearch}
        onStatusChange={(val) => setStatus(val as V1DocumentFilter)}
        onSortChange={(val) => setSort(val as "newest" | "oldest" | "name")}
        onDocumentClick={handleDocumentClick}
        onRetry={() => refetch()}
      />

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadDialogOpen}
        onClose={handleCloseUploadDialog}
        uploadStep={uploadStep}
        selectedFile={selectedFile}
        uploadProgress={uploadProgress}
        uploadError={uploadError}
        onFile={handleFile}
        disabled={isMutating}
        isMutating={isMutating}
      />
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Header({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-h2 text-on-surface">اسناد</h1>
        <p className="text-body-2 text-muted mt-1">
          اسناد حقوقی خود را بارگذاری و تحلیل کنید
        </p>
      </div>
      <Button
        variant="filled"
        size="large"
        startIcon={<IconAdd size={20} />}
        onClick={onUploadClick}
      >
        بارگذاری سند
      </Button>
    </div>
  );
}

function UploadDialog({
  open,
  onClose,
  uploadStep,
  selectedFile,
  uploadProgress,
  uploadError,
  onFile,
  disabled,
  isMutating,
}: {
  open: boolean;
  onClose: () => void;
  uploadStep: UploadStep;
  selectedFile: File | null;
  uploadProgress: number;
  uploadError: string | null;
  onFile: (file: File) => void;
  disabled: boolean;
  isMutating: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={uploadStep === "idle" ? "بارگذاری سند جدید" : undefined}
      maxWidth="md"
      persistent={isMutating}
    >
      {uploadStep === "idle" && (
        <UploadZone onFile={onFile} disabled={disabled} />
      )}

      {(uploadStep === "uploading" || uploadStep === "processing") && selectedFile && (
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-medium bg-primary/10 flex items-center justify-center shrink-0">
              <IconDocument size={20} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body-2 text-on-surface truncate">{selectedFile.name}</p>
              <p className="text-caption text-muted">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
          <ProgressLinear
            value={uploadProgress}
            color="primary"
            size="medium"
            showValue
            label={
              uploadStep === "uploading" ? "در حال بارگذاری..." : "در حال پردازش..."
            }
          />
        </div>
      )}

      {uploadStep === "success" && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-success">
              <path
                d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                fill="currentColor"
              />
            </svg>
          </div>
          <p className="text-body-1 text-on-surface">سند با موفقیت بارگذاری شد</p>
          <p className="text-body-2 text-muted">
            سند در حال پردازش و تحلیل است. نتایج به زودی آماده خواهد شد.
          </p>
        </div>
      )}

      {uploadStep === "error" && (
        <div className="space-y-4">
          <ErrorState
            title="خطا در بارگذاری"
            message={uploadError ?? "خطای ناشناخته"}
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="text" onClick={onClose}>
              انصراف
            </Button>
            <Button
              variant="filled"
              onClick={() => {
                if (selectedFile) {
                  onFile(selectedFile);
                }
              }}
            >
              تلاش مجدد
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
