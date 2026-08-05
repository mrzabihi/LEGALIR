// ============================================================
// LEGALIR — Document List View
// List of documents with search/filter, grid, empty/loading/error (Phase 9)
// ============================================================

"use client";

import type { V1DocumentListItem } from "@legalir/types";
import { Skeleton, EmptyState, ErrorState } from "@legalir/ui";
import { IconDocument } from "@/lib/icons";
import { SearchFilterBar } from "./search-filter-bar";
import { DocumentCard } from "./document-card";

// ============================================================
// Skeleton cards for loading state
// ============================================================

function DocumentCardSkeleton() {
  return (
    <div className="rounded-large border border-divider bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" width="40px" height="40px" />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton variant="text" width="75%" height="20px" />
          <Skeleton variant="text" width="80px" height="16px" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Skeleton variant="text" width="64px" height="12px" />
        <Skeleton variant="text" width="80px" height="12px" />
      </div>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <DocumentCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============================================================
// DocumentList component
// ============================================================

interface DocumentListProps {
  documents: V1DocumentListItem[];
  isLoading: boolean;
  isError: boolean;
  search: string;
  status: string;
  sort: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onDocumentClick: (id: string) => void;
  onRetry: () => void;
}

export function DocumentList({
  documents,
  isLoading,
  isError,
  search,
  status,
  sort,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onDocumentClick,
  onRetry,
}: DocumentListProps) {
  return (
    <div className="flex flex-col gap-4" dir="rtl">
      {/* Search and filter bar */}
      <SearchFilterBar
        search={search}
        status={status}
        sort={sort}
        onSearchChange={onSearchChange}
        onStatusChange={onStatusChange}
        onSortChange={onSortChange}
      />

      {/* Content area */}
      {isLoading ? (
        <LoadingGrid />
      ) : isError ? (
        <ErrorState
          title="خطا در دریافت اسناد"
          message="دریافت لیست اسناد با خطا مواجه شد. لطفا دوباره تلاش کنید."
          onRetry={onRetry}
        />
      ) : documents.length === 0 ? (
        <EmptyState
          title="سندی یافت نشد"
          description={
            search || status !== "all"
              ? "سندی با این مشخصات یافت نشد. فیلترها را تغییر دهید."
              : "هنوز سندی بارگذاری نکرده‌اید. اولین سند خود را بارگذاری کنید."
          }
          icon={<IconDocument size={48} className="text-muted" />}
        />
      ) : (
        <>
          {/* Document count */}
          <p className="text-caption text-muted">
            {documents.length} سند
          </p>

          {/* Document grid */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onClick={() => onDocumentClick(doc.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
