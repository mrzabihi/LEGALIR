// ============================================================
// LEGALIR — Documents List Page (Phase 9)
// ============================================================
// The shell for the documents surface: a low compact header plus the
// shared compact list. The header keeps its service-resolved title /
// breadcrumb (so the same page works for every document service) but
// drops the decorative banner for the flat list identity.
// ============================================================

"use client";

import React, { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDocuments, useDeleteDocument } from "@/hooks/useDocuments";
import { resolveService } from "@/lib/services";
// Import the module directly rather than through the `@/components/documents`
// barrel: the barrel re-exports every document component (viewers, pdfjs
// wrappers, chat panel, …), so a barrel import dragged ~550 KB of unrelated
// modules — including pdfjs-dist — into this list route's client bundle.
import { DocumentList } from "@/components/documents/document-list";
import { CompactPageHeader, PageContainer } from "@/components/shared";
import { Button, ConfirmDialog, snackbar } from "@legalir/ui";
import { IconAdd } from "@/lib/icons";
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
  const { data, isLoading, isError, refetch } = useDocuments(listParams);

  // --- Navigation ---
  const handleUploadClick = () => {
    router.push("/documents/upload");
  };

  return (
    <PageContainer>
      <Header onUploadClick={handleUploadClick} />

      <div className="mt-4">
        <DocumentList
          documents={data?.items ?? []}
          isLoading={isLoading}
          isError={isError}
          search={search}
          status={status}
          sort={sort}
          onSearchChange={setSearch}
          onStatusChange={(val) => setStatus(val as V1DocumentFilter)}
          onSortChange={(val) => setSort(val as "newest" | "oldest" | "name")}
          onRetry={() => refetch()}
          onDelete={setPendingDelete}
        />
      </div>

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
    </PageContainer>
  );
}

// ============================================================
// Header
// ============================================================

// `Header` reads `useSearchParams` (via the URL-resolved service), which
// Next.js requires to sit inside a Suspense boundary on a statically
// rendered route. The wrapper keeps every call site boundary-free.
function Header({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <Suspense
      fallback={
        <div className="h-16 animate-pulse rounded-medium border-b border-[color:var(--color-outline-variant)] bg-surface-container" aria-hidden="true" />
      }
    >
      <HeaderBanner onUploadClick={onUploadClick} />
    </Suspense>
  );
}

function HeaderBanner({ onUploadClick }: { onUploadClick: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const service = resolveService(pathname, searchParams);

  return (
    <CompactPageHeader
      breadcrumbAriaLabel="breadcrumb"
      breadcrumb={[
        { label: "داشبورد", href: "/dashboard" },
        { label: service?.title ?? "تحلیل اسناد" },
      ]}
      title={service?.title ?? "تحلیل اسناد"}
      description={service?.subtitle ?? "بررسی و تحلیل مستندات حقوقی"}
      actions={
        <Button
          variant="filled"
          size="large"
          startIcon={<IconAdd size={20} />}
          onClick={onUploadClick}
        >
          بارگذاری سند
        </Button>
      }
    />
  );
}
