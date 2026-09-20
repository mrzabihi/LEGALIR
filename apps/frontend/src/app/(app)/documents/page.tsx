// ============================================================
// LEGALIR — Documents List Page (Phase 9)
// ============================================================

"use client";

import React, { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useDocuments, useDeleteDocument } from "@/hooks/useDocuments";
// Import the module directly rather than through the `@/components/documents`
// barrel: the barrel re-exports every document component (viewers, pdfjs
// wrappers, chat panel, …), so a barrel import dragged ~550 KB of unrelated
// modules — including pdfjs-dist — into this list route's client bundle.
import { DocumentList } from "@/components/documents/document-list";
import { PageContextHeader } from "@/components/shared";
import { Button, ConfirmDialog, SkeletonCard, EmptyState, ErrorState, snackbar } from "@legalir/ui";
import { IconAdd, IconDocument } from "@/lib/icons";
import type {
  V1DocumentListParams,
  V1DocumentFilter,
  V1DocumentListItem,
} from "@legalir/types";

export default function DocumentsPage() {
  const router = useRouter();

  // --- Search / Filter state ---
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<V1DocumentFilter>("all");
  const [sort, setSort] = React.useState<"newest" | "oldest" | "name">("newest");

  // --- Delete state ---
  const [pendingDelete, setPendingDelete] = React.useState<V1DocumentListItem | null>(null);
  const deleteDocument = useDeleteDocument();

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    deleteDocument.mutate(target.id, {
      onSuccess: () => {
        setPendingDelete(null);
        snackbar.show({ message: "سند با موفقیت حذف شد.", variant: "success" });
      },
      onError: (err) => {
        // Keep the document in the list and surface the failure.
        snackbar.show({
          message: err instanceof Error ? err.message : "حذف سند با خطا مواجه شد.",
          variant: "error",
        });
      },
    });
  };

  // --- Queries ---
  const listParams: V1DocumentListParams = {
    search: search || undefined,
    status,
    sort,
  };
  const { data, isLoading, isError, error, refetch } = useDocuments(listParams);

  // --- Navigation ---
  const handleDocumentClick = (id: string) => {
    router.push(`/documents/${id}`);
  };

  const handleUploadClick = () => {
    router.push("/documents/upload");
  };

  // --- Render loading ---
  if (isLoading) {
    return (
      <div className="p-4 tablet:p-6 max-w-6xl mx-auto">
        <Header onUploadClick={handleUploadClick} />
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
        <Header onUploadClick={handleUploadClick} />
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
        <Header onUploadClick={handleUploadClick} />
        <EmptyState
          icon={<IconDocument size={64} />}
          title="هنوز سندی اضافه نکرده‌اید"
          description="قرارداد یا سند حقوقی خود را بارگذاری کنید تا تحلیل ریسک و بررسی بندها را دریافت کنید"
          action={{
            label: "افزودن سند",
            onClick: handleUploadClick,
          }}
        />
      </div>
    );
  }

  // --- Render list ---
  return (
    <div className="p-4 tablet:p-6 max-w-6xl mx-auto">
      <Header onUploadClick={handleUploadClick} />

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
        onDelete={setPendingDelete}
      />

      {/* Delete confirmation. Nothing is deleted until the user
          explicitly confirms; cancel closes with no side effects. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => {
          if (!deleteDocument.isPending) setPendingDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="حذف سند؟"
        description="آیا از حذف این سند مطمئن هستید؟ پس از حذف، دیگر به این سند دسترسی نخواهید داشت."
        confirmLabel="حذف سند"
        cancelLabel="انصراف"
        destructive
        loading={deleteDocument.isPending}
      />
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Header({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <Suspense fallback={<div className="h-16" aria-hidden="true" />}>
        <PageContextHeader className="mb-0" />
      </Suspense>
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
