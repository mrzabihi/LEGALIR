// ============================================================
// LEGALIR — Document Detail Page (Phase 9)
// ============================================================

"use client";

import React from "react";
import { useRouter, useParams } from "next/navigation";
import {
  useDocumentDetail,
  useDocumentStatus,
  useRetryDocument,
  useDeleteDocument,
} from "@/hooks/useDocuments";
import { DocumentChatPanel, PreviewPlaceholder } from "@/components/documents";
import { Button, Skeleton, ErrorState, ConfirmDialog, ProgressLinear } from "@legalir/ui";
import { IconArrowBack, IconDelete, IconRefresh } from "@/lib/icons";
import type { V1DocumentDetail } from "@legalir/types";

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.['id'] as string | undefined;

  // --- Queries ---
  const {
    data: document,
    isLoading,
    isError,
    error,
    refetch,
  } = useDocumentDetail(id);

  const {
    data: statusInfo,
    refetch: refetchStatus,
  } = useDocumentStatus(id);

  // --- Mutations ---
  const retryMutation = useRetryDocument();
  const deleteMutation = useDeleteDocument();

  // --- Local UI state ---
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  // --- Status polling effect ---
  const isProcessing =
    document?.status === "processing" ||
    document?.status === "extracting" ||
    document?.status === "analyzing";

  React.useEffect(() => {
    if (!id) return;
    if (statusInfo?.status === "ready" || statusInfo?.status === "failed") {
      // Stop polling implicitly (enabled remains true, but data is now stable)
      refetch();
    }
  }, [statusInfo?.status, refetch, id]);

  // --- Navigation ---
  const handleBack = () => {
    router.push("/documents");
  };

  // --- Delete ---
  const handleDeleteConfirm = () => {
    if (!id) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        router.push("/documents");
      },
    });
  };

  // --- Retry ---
  const handleRetry = () => {
    if (!id) return;
    retryMutation.mutate(id, {
      onSuccess: () => {
        refetch();
        refetchStatus();
      },
    });
  };

  // --- Missing ID guard ---
  if (!id) {
    return (
      <div className="p-4 tablet:p-6 max-w-4xl mx-auto">
        <BackButton onClick={handleBack} />
        <ErrorState
          title="مسیر نامعتبر"
          message="شناسه سند مشخص نشده است"
          fullPage
        />
      </div>
    );
  }

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="p-4 tablet:p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Skeleton variant="rectangular" width="100%" height="44px" className="rounded-medium" />
        </div>
        <Skeleton variant="rectangular" height="240px" className="rounded-large mb-4" />
        <div className="space-y-3 px-1">
          <Skeleton variant="text" width="60%" height="20px" />
          <Skeleton variant="text" width="80%" height="16px" />
          <Skeleton variant="text" width="40%" height="16px" />
          <Skeleton variant="text" width="70%" height="16px" />
          <Skeleton variant="text" width="50%" height="16px" />
        </div>
      </div>
    );
  }

  // --- Error state (includes 410 Gone for deleted documents) ---
  if (isError) {
    const errorMessage =
      error instanceof Error ? error.message : "سند مورد نظر یافت نشد یا حذف شده است";

    return (
      <div className="p-4 tablet:p-6 max-w-4xl mx-auto">
        <BackButton onClick={handleBack} />
        <ErrorState
          title="خطا در دریافت سند"
          message={errorMessage}
          onRetry={() => refetch()}
          fullPage
        />
      </div>
    );
  }

  // --- Not found (query succeeded but data is null/undefined) ---
  if (!document) {
    return (
      <div className="p-4 tablet:p-6 max-w-4xl mx-auto">
        <BackButton onClick={handleBack} />
        <ErrorState
          title="سند یافت نشد"
          message="سند مورد نظر وجود ندارد یا حذف شده است"
          fullPage
        />
      </div>
    );
  }

  // --- Main render ---
  return (
    <div className="p-4 tablet:p-6 max-w-4xl mx-auto">
      {/* Top bar: back + title + status + actions */}
      <HeaderBar
        document={document}
        onBack={handleBack}
        onRetry={handleRetry}
        onDelete={() => setDeleteDialogOpen(true)}
        isRetrying={retryMutation.isPending}
        isDeleting={deleteMutation.isPending}
      />

      {/* Processing progress bar */}
      {isProcessing && statusInfo && (
        <div className="mb-4">
          <ProgressLinear
            value={statusInfo.progress}
            color="primary"
            size="medium"
            showValue
            label={
              statusInfo.currentStage
                ? `در حال ${stageLabel(statusInfo.currentStage)}...`
                : "در حال پردازش سند..."
            }
          />
        </div>
      )}

      {/* Document preview — moved to the top */}
      <PreviewPlaceholder
        documentName={document.name}
        mime={document.mime}
        previewUrl={document.previewUrl}
        downloadUrl={`/api/v1/documents/${document.id}/download`}
      />

      {/* Merged chat + analysis — LegalIR comments on the uploaded file.
          The analysis report is rendered as the opening assistant message. */}
      {document.status === "ready" && (
        <div className="mt-6">
          <DocumentChatPanel
            documentId={document.id}
            documentName={document.name}
            report={document.report}
          />
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="حذف سند"
        description={`آیا از حذف سند "${document.name}" اطمینان دارید؟ این عملیات قابل بازگشت نیست.`}
        confirmLabel="حذف"
        cancelLabel="انصراف"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="mb-6">
      <Button
        variant="text"
        startIcon={<IconArrowBack size={20} />}
        onClick={onClick}
      >
        بازگشت به اسناد
      </Button>
    </div>
  );
}

function HeaderBar({
  document,
  onBack,
  onRetry,
  onDelete,
  isRetrying,
  isDeleting: _isDeleting,
}: {
  document: V1DocumentDetail;
  onBack: () => void;
  onRetry: () => void;
  onDelete: () => void;
  isRetrying: boolean;
  isDeleting: boolean;
}) {
  const isFailed = document.status === "failed";

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Top row: back + actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="text"
          startIcon={<IconArrowBack size={20} />}
          onClick={onBack}
        >
          بازگشت
        </Button>

        <div className="flex items-center gap-2">
          {isFailed && (
            <Button
              variant="outlined"
              size="medium"
              startIcon={<IconRefresh size={18} />}
              onClick={onRetry}
              loading={isRetrying}
            >
              تلاش مجدد
            </Button>
          )}
          <Button
            variant="outlined"
            size="medium"
            startIcon={<IconDelete size={18} />}
            onClick={onDelete}
          >
            حذف
          </Button>
        </div>
      </div>

      {/* Title row */}
      <div>
        <h1 className="text-h2 text-on-surface break-words">{document.name}</h1>
      </div>
    </div>
  );
}

/** Map a processing stage enum/key to a Persian label */
function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    uploaded: "بارگذاری",
    processing: "پردازش اولیه",
    extracting: "استخراج متن",
    analyzing: "تحلیل حقوقی",
    ready: "آماده",
    failed: "ناموفق",
  };
  return map[stage] ?? stage;
}
