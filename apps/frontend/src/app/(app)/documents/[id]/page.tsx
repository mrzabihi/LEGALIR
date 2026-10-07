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
// Direct module imports — the `@/components/documents` barrel re-exports the
// whole document component set, pulling unrelated modules into this route.
import { DocumentChatPanel } from "@/components/documents/document-chat-panel";
import { DocumentPreviewCard } from "@/components/documents/document-preview-card";
import { ReviewResult } from "@/components/documents/review-result";
import { TrialBadge } from "@/components/documents/trial-badge";
import { TrialScenarioPicker } from "@/components/documents/trial-scenario-picker";
import { DocumentLawyerSuggestions } from "@/components/documents/document-lawyer-suggestions";
import { useAiStatus } from "@/hooks/useAiStatus";
import { TRIAL_DISCLAIMER_FA, type TrialScenario } from "@/lib/documents/trial-scenarios";
import {
  Button,
  Skeleton,
  ErrorState,
  ConfirmDialog,
  ProgressLinear,
} from "@legalir/ui";
import { IconArrowBack, IconDelete, IconRefresh, IconWarning } from "@/lib/icons";
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
  // A question the user asked about a specific finding (spec §12).
  const [pendingQuestion, setPendingQuestion] = React.useState<{
    text: string;
    nonce: number;
  } | null>(null);

  // --- Real model connectivity (single source: the gateway health probe) ---
  // The page has two clearly separated states. `aiConnected` is true only
  // when the provider is actually configured AND answers its health probe;
  // "unknown" is treated honestly as not-connected.
  const { data: aiStatus, isLoading: aiStatusLoading } = useAiStatus();
  const aiConnected = aiStatus?.configured === true && aiStatus?.healthy === true;

  // --- Trial mode ---
  // A scenario is DEMO data, never a claim about the user's own document.
  const [scenario, setScenario] = React.useState<TrialScenario | null>(null);

  const selectScenario = React.useCallback((s: TrialScenario) => {
    setScenario(s);
    setPendingQuestion(null);
  }, []);
  const exitTrial = React.useCallback(() => setScenario(null), []);

  // When a real model becomes available, leave any trial demo behind so the
  // page can never show a scenario while claiming real connectivity.
  React.useEffect(() => {
    if (aiConnected) setScenario(null);
  }, [aiConnected]);

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

  // --- Ask the chat about a specific finding (spec §12) ---
  // The nonce forces the chat panel to react even when the same finding is
  // asked about twice in a row.
  const askAboutFinding = React.useCallback((finding: { title: string; locator: string }) => {
    setPendingQuestion({
      text: `درباره این یافته توضیح بده: «${finding.title}»${
        finding.locator ? ` (${finding.locator})` : ""
      }`,
      nonce: Date.now(),
    });
  }, []);

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

      {/* Document preview — real first-page / image preview, links to the viewer */}
      <DocumentPreviewCard
        documentId={document.id}
        fileName={document.name}
        mime={document.mime}
        sizeBytes={document.sizeBytes}
      />

      {/* ============================================================
          Two clearly separated states: REAL analysis vs TRIAL demo.
          A report is shown as a real result ONLY when the model is
          actually connected; otherwise the page offers trial scenarios
          and never fabricates a result for the user's document.
          ============================================================ */}

      {/* (A) Checking the connectivity signal */}
      {aiStatusLoading && (
        <div className="mt-6 flex items-center gap-2 text-muted">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
          <span className="text-bodySmall">در حال بررسی وضعیت سرویس تحلیل...</span>
        </div>
      )}

      {/* (B) TRIAL mode — a demo, clearly labelled everywhere */}
      {!aiStatusLoading && scenario && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <h2 className="text-h3 text-on-surface">نتیجه بررسی نمونه</h2>
            <TrialBadge label={`نمونهٔ آزمایشی — ${scenario.titleFa}`} />
          </div>
          <p className="mt-1 text-caption text-muted">{TRIAL_DISCLAIMER_FA}</p>

          <div className="mt-4">
            <ReviewResult
              report={scenario.report}
              extractedText={scenario.extractedText}
              trial
              trialLabel={scenario.titleFa}
              onAskAboutFinding={askAboutFinding}
            />
          </div>

          <div className="mt-6">
            <DocumentChatPanel
              documentId={document.id}
              documentName={scenario.docLabelFa}
              scenario={scenario}
              aiConnected={false}
              pendingQuestion={pendingQuestion}
            />
          </div>

          <DocumentLawyerSuggestions scenario={scenario} className="mt-6" />

          <div className="mt-4">
            <Button
              variant="outlined"
              startIcon={<IconArrowBack size={18} />}
              onClick={exitTrial}
            >
              بازگشت از حالت آزمایشی
            </Button>
          </div>
        </>
      )}

      {/* (C) REAL mode — the model is connected */}
      {!aiStatusLoading && !scenario && aiConnected && (
        document.status === "ready" ? (
          <>
            <div className="mt-6">
              <h2 className="text-h3 text-on-surface mb-4">نتیجه بررسی</h2>
              <ReviewResult
                report={document.report}
                extractedText={document.extractedText}
                onAskAboutFinding={askAboutFinding}
              />
            </div>

            <div className="mt-6">
              <DocumentChatPanel
                documentId={document.id}
                documentName={document.name}
                report={document.report}
                aiConnected={aiConnected}
                pendingQuestion={pendingQuestion}
              />
            </div>

            <DocumentLawyerSuggestions className="mt-6" />
          </>
        ) : (
          <div className="mt-6 rounded-large border border-divider bg-surface p-4">
            <p className="text-bodySmall text-muted">
              سرویس تحلیل متصل است. برای دیدن نتیجه، ابتدا تحلیل این سند را
              آغاز کنید.
            </p>
          </div>
        )
      )}

      {/* (D) NO-MODEL mode — a real document, but no model connected */}
      {!aiStatusLoading && !scenario && !aiConnected && (
        <>
          <div className="mt-6 flex items-start gap-3 rounded-large border border-warning/30 bg-warning/5 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10">
              <IconWarning size={22} className="text-warning" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-titleMedium text-onSurface font-medium">
                تحلیل هوشمند در دسترس نیست
              </h2>
              <p className="mt-1 text-bodySmall text-muted leading-relaxed">
                در حال حاضر اتصال به سرویس تحلیل مدل برقرار نیست؛ بنابراین سند
                شما به‌صورت واقعی تحلیل نمی‌شود و هیچ نتیجه یا منبعی برای آن
                ساخته نشده است. می‌توانید سناریوی آزمایشی زیر را انتخاب کنید
                تا نمونهٔ نتیجه، گفتگو و پیشنهاد وکیل را با دادهٔ نمایشی ببینید.
              </p>
              {aiStatus && (
                <p className="mt-1 text-caption text-muted">
                  وضعیت سرویس: {aiStatus.configured ? "تنظیم‌شده، اما بدون پاسخ" : "تنظیم‌نشده"}
                  {" "}({aiStatus.provider})
                </p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <TrialScenarioPicker onSelect={selectScenario} />
          </div>

          {/* The chat section is still present — honestly disabled, with its
              own no-model explanation — so the page keeps its structure and
              the user is never left wondering where the chat went. */}
          <div className="mt-6">
            <DocumentChatPanel
              documentId={document.id}
              documentName={document.name}
              aiConnected={false}
              pendingQuestion={pendingQuestion}
            />
          </div>

          {/* Real marketplace lawyers — a legitimate next step, framed honestly
              as a listing, never as an automatic match for this document. */}
          <DocumentLawyerSuggestions className="mt-6" />
        </>
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
