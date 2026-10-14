// ============================================================
// LEGALIR — Documents list (compact MD3 scan-list)
// ============================================================
// A single-column list that shares the exact toolbar / row / overflow
// language of /history, /cases and /contracts: one search bar, a status
// chip row, a sort control, a results line, then flat rows. Each row
// carries its document identity, its REAL processing status, and ONE
// action chosen by that status —
//   • آماده        → «مشاهده سند»
//   • در حال پردازش → «مشاهده بررسی»
//   • خطا/مسدود     → «تلاش مجدد»
// — with download/delete moved into the ⋮ menu.
// ============================================================

"use client";

import Link from "next/link";
import type { V1DocumentListItem, V1DocumentFilter } from "@legalir/types";
import { Select, snackbar } from "@legalir/ui";
import {
  SearchField,
  FilterChips,
  ResultsBar,
  OverflowMenu,
  type ActiveFilter,
} from "@/components/shared";
import { useRetryDocument } from "@/hooks/useDocuments";
import {
  IconDocument,
  IconFile,
  IconDownload,
  IconRetry,
  IconOpenInNew,
  IconClose,
  IconWarning,
  IconDelete,
} from "@/lib/icons";
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
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
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

function documentIcon(mime: string) {
  return mime === "application/pdf" ? IconDocument : IconFile;
}

function isProcessing(status: string): boolean {
  return ["processing", "extracting", "analyzing"].includes(status);
}

function isFailed(status: string): boolean {
  return ["failed", "blocked"].includes(status);
}

const STATUS_OPTIONS: { key: V1DocumentFilter; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "ready", label: "آماده" },
  { key: "processing", label: "در حال پردازش" },
  { key: "failed", label: "خطا" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "جدیدترین" },
  { value: "oldest", label: "قدیمی‌ترین" },
  { value: "name", label: "نام" },
];

const RISK_LABELS: Record<string, string> = {
  low: "ریسک کم",
  medium: "ریسک متوسط",
  high: "ریسک زیاد",
  critical: "ریسک بحرانی",
};

const RISK_TONE: Record<string, string> = {
  low: "bg-success-container text-success border-success",
  medium: "bg-warning-container text-warning border-warning",
  high: "bg-warning-container text-warning border-warning",
  critical: "bg-error-container text-error border-error",
};

// ============================================================
// Row
// ============================================================

function DocumentRow({
  document: doc,
  onOpen,
  onDelete,
  onRetried,
}: {
  document: V1DocumentListItem;
  onOpen: (id: string) => void;
  onDelete?: (document: V1DocumentListItem) => void;
  onRetried?: () => void;
}) {
  const { id, name, mime, sizeBytes, status, createdAt, riskLevel, findingCount } = doc;
  const DocIcon = documentIcon(mime);
  const retry = useRetryDocument();
  const processing = isProcessing(status);
  const failed = isFailed(status);

  const handleRetry = () => {
    retry.mutate(id, {
      onSuccess: () => {
        snackbar.show({ message: "پردازش سند دوباره آغاز شد", variant: "success" });
        onRetried?.();
      },
      onError: () => snackbar.show({ message: "تلاش مجدد ناموفق بود", variant: "error" }),
    });
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = `/api/v1/documents/${id}/download`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const menuItems = [
    ...(status === "ready"
      ? [
          {
            key: "download",
            label: "دانلود",
            icon: <IconDownload size={16} />,
            onSelect: handleDownload,
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            key: "delete",
            label: "حذف",
            icon: <IconDelete size={16} />,
            destructive: true,
            onSelect: () => onDelete(doc),
          },
        ]
      : []),
  ];

  return (
    <article className="flex flex-col gap-3 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-3 transition-colors duration-short3 hover:border-[color:var(--color-outline)] tablet:flex-row tablet:items-center tablet:gap-4 tablet:p-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-primary-container text-primary-on-container"
          aria-hidden="true"
        >
          <DocIcon size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 truncate text-titleSmall font-semibold text-on-surface" title={name}>
              {name}
            </h3>
            <StatusBadge status={status} />
            {riskLevel && status === "ready" && (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-caption font-medium ${RISK_TONE[riskLevel] ?? ""}`}
              >
                {RISK_LABELS[riskLevel] ?? riskLevel}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-caption text-on-surface-variant">
            <span>{formatFileSize(sizeBytes)}</span>
            <span aria-hidden="true" className="text-divider">·</span>
            <span>{getRelativeTime(createdAt)}</span>
            {status === "ready" && findingCount > 0 && (
              <>
                <span aria-hidden="true" className="text-divider">·</span>
                <span>{findingCount} یافته</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 tablet:justify-end">
        {failed ? (
          <button
            type="button"
            onClick={handleRetry}
            disabled={retry.isPending}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-labelLarge font-medium text-primary-on transition-colors duration-short3 hover:bg-primary-700 hover:text-white focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 tablet:h-9 tablet:flex-none tablet:text-labelSmall"
          >
            <IconRetry size={16} />
            تلاش مجدد
          </button>
        ) : (
          <Link
            href={`/documents/${id}`}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-labelLarge font-medium text-primary-on transition-colors duration-short3 hover:bg-primary-700 hover:text-white focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 tablet:h-9 tablet:flex-none tablet:text-labelSmall"
          >
            {processing ? <IconOpenInNew size={16} /> : <IconDocument size={16} />}
            {processing ? "مشاهده بررسی" : "مشاهده سند"}
          </Link>
        )}

        <OverflowMenu
          label="گزینه‌های این سند"
          size="small"
          className="shrink-0"
          items={menuItems}
        />
      </div>
    </article>
  );
}

// ============================================================
// DocumentList
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
  /** Opens the delete-confirmation dialog for a document. */
  onDelete?: (document: V1DocumentListItem) => void;
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
  onDelete,
}: DocumentListProps) {
  const hasFilters = search.trim() !== "" || status !== "all";

  const clearAllFilters = () => {
    onSearchChange("");
    onStatusChange("all");
  };

  const activeFilters: ActiveFilter[] = [];
  if (search.trim()) {
    activeFilters.push({ key: "search", label: `جست‌وجو: ${search.trim()}`, onRemove: () => onSearchChange("") });
  }
  if (status !== "all") {
    activeFilters.push({
      key: "status",
      label: STATUS_OPTIONS.find((s) => s.key === status)?.label ?? status,
      onRemove: () => onStatusChange("all"),
    });
  }

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      {/* Toolbar — search owns the space; sort stays compact beside it. */}
      <div className="flex flex-col gap-3 tablet:flex-row tablet:items-end">
        <div className="flex-1">
          <SearchField
            label="جست‌وجو در اسناد"
            placeholder="مثلاً: قرارداد، دادخواست، اظهارنامه"
            value={search}
            onChange={onSearchChange}
          />
        </div>
        <Select
          label="مرتب‌سازی"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          selectSize="small"
          className="tablet:w-[160px]"
          options={SORT_OPTIONS}
        />
      </div>

      <FilterChips
        options={STATUS_OPTIONS}
        value={status}
        onChange={onStatusChange}
        ariaLabel="فیلتر وضعیت سند"
      />

      {/* Content */}
      {isLoading ? (
        <div className="mt-1 space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-3 tablet:p-4"
            >
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-medium bg-surface-container" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-surface-container" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-surface-container" />
              </div>
              <div className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-surface-container" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="mt-1 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-8 text-center">
          <div className="mb-4 flex justify-center">
            <IconWarning size={44} className="text-error" />
          </div>
          <h3 className="mb-2 text-titleMedium text-on-surface">خطا در دریافت اسناد</h3>
          <p className="mb-6 text-body-2 text-on-surface-variant">
            دریافت لیست اسناد با خطا مواجه شد. لطفاً دوباره تلاش کنید.
          </p>
          <button
            onClick={onRetry}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-body-2 font-medium text-primary-on transition-colors duration-short3 hover:bg-primary-700 hover:text-white"
          >
            تلاش مجدد
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div className="mt-1 flex flex-col items-center gap-3 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface py-14 text-center">
          <IconDocument size={44} className="text-on-surface-variant" />
          <p className="text-body-1 font-medium text-on-surface">
            {hasFilters ? "نتیجه‌ای یافت نشد" : "هنوز سندی بارگذاری نکرده‌اید"}
          </p>
          <p className="max-w-md text-body-2 text-on-surface-variant">
            {hasFilters
              ? "سندی با این مشخصات یافت نشد؛ فیلترها را تغییر دهید."
              : "اولین سند خود را بارگذاری کنید."}
          </p>
          {hasFilters && (
            <button
              onClick={clearAllFilters}
              className="mt-2 inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--color-outline-variant)] px-5 text-body-2 font-medium text-on-surface transition-colors duration-short3 hover:bg-surface-hover"
            >
              <IconClose size={18} />
              پاک کردن فیلترها
            </button>
          )}
        </div>
      ) : (
        <div className="mt-1 space-y-2.5">
          <ResultsBar
            countLabel={`${documents.length} سند`}
            filters={activeFilters}
            onClearAll={clearAllFilters}
            className="px-0.5"
          />
          <div className="space-y-2.5">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                onOpen={onDocumentClick}
                onDelete={onDelete}
                onRetried={onRetry}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
