// ============================================================
// LEGALIR — Document Upload Wizard Page
// Full-page flow: choose source → select file → processing pipeline
// ============================================================

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useInitiateUpload, useCompleteUpload, useDocuments } from "@/hooks/useDocuments";
// Direct module imports — the `@/components/documents` barrel re-exports the
// whole document component set (including pdfjs-backed viewers), which would
// pull unrelated modules into this route's client bundle.
import { UploadZone } from "@/components/documents/upload-zone";
import { StatusBadge } from "@/components/documents/status-badge";
import { ProcessingPipeline } from "@/components/documents/processing-pipeline";
import type { PipelineStage } from "@/components/documents/processing-pipeline";
import { Button, EmptyState, ErrorState } from "@legalir/ui";
import {
  IconArrowBack,
  IconDocument,
  IconUpload,
  IconChevronRight,
  IconCheck,
} from "@/lib/icons";
import {
  SUPPORTED_DOCUMENT_MIMES,
  MAX_DOCUMENT_SIZE_BYTES,
} from "@legalir/types";
import type { V1DocumentListItem } from "@legalir/types";
import { formatFileSize } from "@/lib/persian-utils";

type WizardStep = "choose" | "library" | "upload" | "processing" | "done" | "error";

export default function DocumentUploadPage() {
  const router = useRouter();

  // --- Wizard state ---
  const [step, setStep] = React.useState<WizardStep>("choose");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [pipelineStage, setPipelineStage] = React.useState<PipelineStage>("upload");
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [createdId, setCreatedId] = React.useState<string | null>(null);

  // --- Queries ---
  const { data: listData } = useDocuments({});

  // --- Mutations ---
  const initiateUpload = useInitiateUpload();
  const completeUpload = useCompleteUpload();

  const isMutating = step === "processing";

  // --- Navigation ---
  const handleBack = () => {
    if (isMutating) return;
    router.push("/documents");
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

  // --- Start upload pipeline ---
  const startUpload = React.useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setStep("error");
        setError(validationError);
        return;
      }

      setSelectedFile(file);
      setStep("processing");
      setPipelineStage("upload");
      setProgress(0);
      setError(null);

      initiateUpload.mutate(
        { name: file.name, mime: file.type, sizeBytes: file.size },
        {
          onSuccess: (uploadData) => {
            // Advance through pipeline stages with simulated progress
            setPipelineStage("extract");
            setProgress(30);

            const interval = setInterval(() => {
              setProgress((prev) => {
                if (prev >= 90) {
                  clearInterval(interval);
                  return prev;
                }
                return prev + 10;
              });
            }, 350);

            completeUpload.mutate({ id: uploadData.id, file }, {
              onSuccess: (doc) => {
                clearInterval(interval);
                setProgress(100);
                setPipelineStage("ready");
                setCreatedId(doc.id);

                setTimeout(() => {
                  setStep("done");
                }, 800);
              },
              onError: (err) => {
                clearInterval(interval);
                setStep("error");
                setError(err instanceof Error ? err.message : "خطا در تکمیل بارگذاری");
              },
            });
          },
          onError: (err) => {
            setStep("error");
            setError(err instanceof Error ? err.message : "خطا در شروع بارگذاری");
          },
        }
      );
    },
    [initiateUpload, completeUpload]
  );

  // --- Render ---
  return (
    <div className="p-4 tablet:p-6 max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="text"
          startIcon={<IconArrowBack size={20} />}
          onClick={handleBack}
          disabled={isMutating}
        >
          بازگشت به اسناد
        </Button>
        <h1 className="text-h2 text-on-surface">افزودن سند</h1>
        <div className="w-28" aria-hidden="true" />
      </div>

      {/* Step: choose source */}
      {step === "choose" && (
        <ChooseSource
          onLibrary={() => setStep("library")}
          onUpload={() => setStep("upload")}
        />
      )}

      {/* Step: pick from library */}
      {step === "library" && (
        <LibraryStep
          items={listData?.items ?? []}
          onBack={() => setStep("choose")}
          onSelect={(id) => router.push(`/documents/${id}`)}
        />
      )}

      {/* Step: upload from system */}
      {step === "upload" && (
        <UploadStep
          onFile={startUpload}
          onBack={() => setStep("choose")}
        />
      )}

      {/* Step: processing pipeline */}
      {step === "processing" && selectedFile && (
        <ProcessingStep
          file={selectedFile}
          stage={pipelineStage}
          progress={progress}
        />
      )}

      {/* Step: done */}
      {step === "done" && (
        <DoneStep
          onView={() => createdId && router.push(`/documents/${createdId}`)}
          onBack={() => router.push("/documents")}
        />
      )}

      {/* Step: error */}
      {step === "error" && (
        <ErrorStep
          message={error ?? "خطای ناشناخته"}
          onRetry={() => {
            if (selectedFile) startUpload(selectedFile);
          }}
          onBack={() => setStep("choose")}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-steps
// ============================================================

function ChooseSource({
  onLibrary,
  onUpload,
}: {
  onLibrary: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-body-2 text-muted">
        سند خود را از کجا اضافه می‌کنید؟
      </p>

      <button
        type="button"
        onClick={onLibrary}
        className="flex w-full items-center gap-4 rounded-xl border border-divider/60 bg-surface p-4 text-start shadow-elevation-1 transition-all duration-short3 hover:border-primary-300 hover:shadow-elevation-3 touch-target"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-primary-50 text-primary-700">
          <IconDocument size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-titleMedium text-on-surface">
            اسناد لیگالیر
          </span>
          <span className="block text-caption text-muted mt-0.5">
            انتخاب از اسناد موجود در حساب شما
          </span>
        </span>
        <IconChevronRight size={20} className="shrink-0 text-muted" />
      </button>

      <button
        type="button"
        onClick={onUpload}
        className="flex w-full items-center gap-4 rounded-xl border border-divider/60 bg-surface p-4 text-start shadow-elevation-1 transition-all duration-short3 hover:border-primary-300 hover:shadow-elevation-3 touch-target"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-primary-50 text-primary-700">
          <IconUpload size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-titleMedium text-on-surface">
            بارگذاری از سیستم
          </span>
          <span className="block text-caption text-muted mt-0.5">
            مرور فایل یا کشیدن و رها کردن (Drag & Drop)
          </span>
        </span>
        <IconChevronRight size={20} className="shrink-0 text-muted" />
      </button>
    </div>
  );
}

function LibraryStep({
  items,
  onBack,
  onSelect,
}: {
  items: V1DocumentListItem[];
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 rounded-medium px-2 py-1 text-caption text-primary hover:bg-primary/10 transition-colors touch-target"
      >
        <IconArrowBack size={16} />
        بازگشت
      </button>

      {items.length === 0 ? (
        <EmptyState
          icon={<IconDocument size={48} />}
          title="سندی برای انتخاب وجود ندارد"
          description="ابتدا یک سند بارگذاری کنید یا از گزینه بارگذاری از سیستم استفاده کنید"
        />
      ) : (
        <div className="space-y-2">
          {items.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => onSelect(doc.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-divider/60 bg-surface p-3 text-start shadow-elevation-1 transition-all duration-short3 hover:border-primary-300 hover:shadow-elevation-3 touch-target"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-primary-50 text-primary-700">
                <IconDocument size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-2 text-on-surface">
                  {doc.name}
                </span>
                <span className="block text-caption text-muted mt-0.5">
                  {formatFileSize(doc.sizeBytes)}
                </span>
              </span>
              <StatusBadge status={doc.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadStep({
  onFile,
  onBack,
}: {
  onFile: (file: File) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 rounded-medium px-2 py-1 text-caption text-primary hover:bg-primary/10 transition-colors touch-target"
      >
        <IconArrowBack size={16} />
        بازگشت
      </button>
      <UploadZone onFile={onFile} />
    </div>
  );
}

function ProcessingStep({
  file,
  stage,
  progress,
}: {
  file: File;
  stage: PipelineStage;
  progress: number;
}) {
  return (
    <div className="space-y-4">
      {/* File summary card */}
      <div className="flex items-center gap-3 rounded-xl border border-divider/60 bg-surface p-4 shadow-elevation-1">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-primary-50 text-primary-700">
          <IconDocument size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-2 text-on-surface">{file.name}</p>
          <p className="text-caption text-muted mt-0.5">
            {formatFileSize(file.size)}
          </p>
        </div>
        <span className="shrink-0 text-caption font-medium text-primary">
          {Math.round(progress)}٪
        </span>
      </div>

      {/* Pipeline visualization */}
      <ProcessingPipeline stage={stage} progress={progress} />

      <p className="text-center text-caption text-muted">
        در حال پردازش سند شما... این صفحه را نبندید
      </p>
    </div>
  );
}

function DoneStep({
  onView,
  onBack,
}: {
  onView: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
        <IconCheck size={32} className="text-success" />
      </div>
      <div>
        <h2 className="text-h3 text-on-surface">سند با موفقیت بارگذاری شد</h2>
        <p className="text-body-2 text-muted mt-1">
          تحلیل سند شما آماده است. می‌توانید گزارش را مشاهده کنید.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="filled" onClick={onView}>
          مشاهده تحلیل
        </Button>
        <Button variant="text" onClick={onBack}>
          بازگشت به اسناد
        </Button>
      </div>
    </div>
  );
}

function ErrorStep({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <ErrorState title="خطا در بارگذاری" message={message} />
      <div className="flex items-center justify-end gap-2">
        <Button variant="text" onClick={onBack}>
          انصراف
        </Button>
        <Button variant="filled" onClick={onRetry}>
          تلاش مجدد
        </Button>
      </div>
    </div>
  );
}
