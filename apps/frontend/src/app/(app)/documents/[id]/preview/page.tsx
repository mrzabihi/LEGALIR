// ============================================================
// LEGALIR — Document Preview Page
// ============================================================
// Dedicated full viewer at /documents/[id]/preview. It renders the
// real file (PDF pages or image) through the shared DocumentViewer,
// with a back link, the document title and a download action.
//
// Authorization is enforced by the API: the preview descriptor and the
// file bytes are both scoped to the session user, so opening another
// user's id here shows a "not found" state rather than their file.
// ============================================================

"use client";

import React from "react";
import { useRouter, useParams } from "next/navigation";
import { Button, Skeleton, ErrorState } from "@legalir/ui";
import { IconArrowBack, IconDownload } from "@/lib/icons";
import { useDocumentDetail } from "@/hooks/useDocuments";
import { DocumentViewer } from "@/components/documents/document-viewer";

export default function DocumentPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.["id"] as string | undefined;

  const { data: document, isLoading, isError, refetch } = useDocumentDetail(id);

  const handleBack = React.useCallback(() => {
    if (id) router.push(`/documents/${id}`);
    else router.push("/documents");
  }, [id, router]);

  // --- Missing id ---
  if (!id) {
    return (
      <div className="p-4 tablet:p-6 max-w-5xl mx-auto">
        <BackButton onClick={() => router.push("/documents")} />
        <ErrorState title="مسیر نامعتبر" message="شناسه سند مشخص نشده است" fullPage />
      </div>
    );
  }

  // --- Loading ---
  if (isLoading) {
    return (
      <div className="p-4 tablet:p-6 max-w-5xl mx-auto">
        <Skeleton variant="rectangular" width="100%" height="44px" className="rounded-medium mb-4" />
        <Skeleton variant="rectangular" width="100%" height="520px" className="rounded-large" />
      </div>
    );
  }

  // --- Error / not found ---
  if (isError || !document) {
    return (
      <div className="p-4 tablet:p-6 max-w-5xl mx-auto">
        <BackButton onClick={handleBack} />
        <ErrorState
          title="سند یافت نشد"
          message="این سند وجود ندارد یا به حساب شما تعلق ندارد."
          onRetry={isError ? () => refetch() : undefined}
          fullPage
        />
      </div>
    );
  }

  return (
    <div className="p-4 tablet:p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header: back + title + download */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="text"
            startIcon={<IconArrowBack size={20} />}
            onClick={handleBack}
          >
            بازگشت
          </Button>

          <Button
            variant="outlined"
            size="medium"
            startIcon={<IconDownload size={18} />}
            onClick={() => {
              window.location.href = `/api/v1/documents/${document.id}/download`;
            }}
          >
            دانلود
          </Button>
        </div>

        <h1 className="text-h2 text-on-surface break-words">{document.name}</h1>
      </div>

      {/* Real preview */}
      <DocumentViewer
        documentId={document.id}
        fileName={document.name}
        mime={document.mime}
        sizeBytes={document.sizeBytes}
      />
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="mb-6">
      <Button variant="text" startIcon={<IconArrowBack size={20} />} onClick={onClick}>
        بازگشت به اسناد
      </Button>
    </div>
  );
}
