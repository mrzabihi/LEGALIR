// ============================================================
// LEGALIR — History Page
// Category-based history tabs, search, filter, sort
// Archive/resume, Admin review with audit trail
// ============================================================

"use client";

import { useState, useCallback } from "react";
import { useHistory } from "@/hooks/usePhase11";
import { HISTORY_CATEGORY_LABELS } from "@legalir/testing";
import { toPersianDate } from "@/lib/persian-utils";
import {
  IconHistory,
  IconSearch,
  IconChat,
  IconDocument,
  IconContract,
  IconArchive,
  IconRefresh,
  IconClose,
  IconCheck,
  IconWarning,
  IconShield,
} from "@/lib/icons";
import type { V1HistoryItem } from "@legalir/types";

// ============================================================
// Constants
// ============================================================

const CATEGORY_TABS: { key: string; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "cases", label: "پرونده‌ها" },
  { key: "contracts", label: "قراردادها" },
  { key: "real_estate", label: "املاک" },
  { key: "family", label: "خانواده" },
  { key: "commerce", label: "تجارت" },
  { key: "other", label: "سایر" },
];

const TYPE_OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "conversation", label: "Conversation" },
  { key: "document", label: "Document" },
  { key: "contract", label: "Contract" },
];

const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: "newest", label: "جدیدترین" },
  { key: "oldest", label: "قدیمی‌ترین" },
  { key: "title", label: "عنوان" },
];

const TYPE_BADGE_COLORS: Record<string, string> = {
  conversation: "bg-blue-100 text-blue-700 border-blue-200",
  document: "bg-green-100 text-green-700 border-green-200",
  contract: "bg-amber-100 text-amber-700 border-amber-200",
};

const TYPE_LABELS: Record<string, string> = {
  conversation: "گفتگو",
  document: "سند",
  contract: "قرارداد",
};

// ============================================================
// Icon selector per item type
// ============================================================

function getTypeIcon(type: string, size?: number) {
  switch (type) {
    case "conversation":
      return <IconChat size={size} />;
    case "document":
      return <IconDocument size={size} />;
    case "contract":
      return <IconContract size={size} />;
    default:
      return <IconDocument size={size} />;
  }
}

// ============================================================
// Sub-components
// ============================================================

function LoadingState() {
  return (
    <div className="space-y-4 mt-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-large bg-surface p-5 shadow-elevation-1 border border-divider animate-pulse"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-muted/30 shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-5 bg-muted/30 rounded w-2/3" />
              <div className="h-4 bg-muted/20 rounded w-1/3" />
              <div className="h-4 bg-muted/20 rounded w-full" />
            </div>
            <div className="w-20 h-4 bg-muted/20 rounded shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-large bg-surface p-8 shadow-elevation-1 border border-divider text-center mt-6">
      <div className="flex justify-center mb-4">
        <IconWarning size={48} className="text-error" />
      </div>
      <h3 className="text-h3 text-on-surface mb-2">خطا در دریافت تاریخچه</h3>
      <p className="text-body-2 text-muted mb-6">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-primary text-white text-body-2 font-medium hover:bg-primary-dark transition-colors touch-target"
      >
        <IconRefresh size={18} />
        تلاش مجدد
      </button>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-large bg-surface p-8 shadow-elevation-1 border border-divider text-center mt-6">
      <div className="flex justify-center mb-4">
        <IconHistory size={48} className="text-muted" />
      </div>
      <h3 className="text-h3 text-on-surface mb-2">
        {hasFilters ? "نتیجه‌ای یافت نشد" : "تاریخچه‌ای یافت نشد"}
      </h3>
      <p className="text-body-2 text-muted">
        {hasFilters
          ? "با تغییر فیلترها دوباره جستجو کنید"
          : "با شروع استفاده از LEGALIR، تاریخچه فعالیت‌های شما در اینجا نمایش داده می‌شود"}
      </p>
    </div>
  );
}

function AuditBanner() {
  return (
    <div className="rounded-large bg-amber-50 border border-amber-300 p-4 mb-6 flex items-start gap-3">
      <IconShield size={22} className="text-amber-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-body-2 font-semibold text-amber-800">
          حالت بازبینی مدیر — دسترسی کامل
        </p>
        <p className="text-body-2 text-amber-700 mt-1">
          شما در حال مشاهده تاریخچه کامل تمام کاربران هستید. این فعالیت‌ها ثبت و قابل حسابرسی است.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Admin Review Modal
// ============================================================

function AdminReviewModal({
  open,
  purpose,
  onPurposeChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  purpose: string;
  onPurposeChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  const trimmed = purpose.trim();
  const isValid = trimmed.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-scrim/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-large bg-surface shadow-elevation-16 border border-divider p-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <IconShield size={24} className="text-amber-600" />
            <h2 className="text-h3 text-on-surface">بازبینی مدیر ارشد</h2>
          </div>
          <button
            onClick={onCancel}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-onSurface/[0.08] transition-colors touch-target"
            aria-label="بستن"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Purpose Input */}
        <label
          htmlFor="admin-review-purpose"
          className="block text-body-2 text-on-surface mb-2 font-medium"
        >
          هدف بازبینی <span className="text-error">*</span>
        </label>
        <input
          id="admin-review-purpose"
          type="text"
          value={purpose}
          onChange={(e) => onPurposeChange(e.target.value)}
          placeholder="مثال: حسابرسی دوره‌ای سه‌ماهه"
          className="w-full rounded-large bg-background border border-border px-4 py-3 text-body-1 text-on-surface placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors mb-5"
          autoFocus
          dir="rtl"
        />

        {/* Audit Warning */}
        <div className="rounded-large bg-amber-50 border border-amber-200 p-4 mb-6 flex items-start gap-2.5">
          <IconWarning size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-body-2 text-amber-800 leading-relaxed">
            تمامی فعالیت‌های بازبینی شما ثبت و ذخیره می‌شود. این اطلاعات قابل حسابرسی است.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            className="rounded-full px-5 py-2.5 text-body-2 font-medium text-on-surface border border-border hover:bg-onSurface/[0.06] transition-colors touch-target"
          >
            انصراف
          </button>
          <button
            onClick={onConfirm}
            disabled={!isValid}
            className={[
              "rounded-full px-5 py-2.5 text-body-2 font-medium text-white transition-colors touch-target",
              isValid
                ? "bg-primary hover:bg-primary-dark"
                : "bg-muted cursor-not-allowed",
            ].join(" ")}
          >
            تأیید و ورود
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// History Item Card
// ============================================================

function HistoryItemCard({
  item,
  isArchived,
  onToggleArchive,
}: {
  item: V1HistoryItem;
  isArchived: boolean;
  onToggleArchive: (item: V1HistoryItem) => void;
}) {
  const badgeColor =
    TYPE_BADGE_COLORS[item.type] ??
    "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <div
      className={[
        "rounded-large bg-surface shadow-elevation-1 border border-divider p-5 transition-all",
        isArchived ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        {/* Type Icon */}
        <div className="w-10 h-10 rounded-full bg-muted/10 flex items-center justify-center shrink-0 text-muted">
          {getTypeIcon(item.type, 20)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3
              className={[
                "text-body-1 font-semibold text-on-surface",
                isArchived ? "line-through" : "",
              ].join(" ")}
            >
              {item.title}
            </h3>

            {/* Type badge */}
            <span
              className={[
                "inline-block rounded-full px-2.5 py-0.5 text-labelSmall border",
                badgeColor,
              ].join(" ")}
            >
              {TYPE_LABELS[item.type] ?? item.type}
            </span>

            {/* Category badge */}
            {item.category && (
              <span className="inline-block rounded-full px-2.5 py-0.5 text-labelSmall bg-muted/15 text-muted border border-divider">
                {item.categoryFa ??
                  HISTORY_CATEGORY_LABELS[item.category] ??
                  item.category}
              </span>
            )}

            {/* Status badge */}
            <span className="inline-block rounded-full px-2.5 py-0.5 text-labelSmall bg-muted/10 text-muted border border-divider">
              {item.statusFa}
            </span>
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-body-2 text-muted mt-1 line-clamp-2">
              {item.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <span className="text-labelSmall text-muted">
              {toPersianDate(item.createdAt)}
            </span>

            {/* Actions */}
            <button
              onClick={() => onToggleArchive(item)}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-labelSmall font-medium transition-colors touch-target",
                isArchived
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "bg-muted/10 text-muted hover:bg-muted/20",
              ].join(" ")}
              aria-label={isArchived ? "خروج از بایگانی" : "بایگانی"}
            >
              {isArchived ? (
                <>
                  <IconCheck size={14} />
                  خروج از بایگانی
                </>
              ) : (
                <>
                  <IconArchive size={14} />
                  بایگانی
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page Component
// ============================================================

export default function HistoryPage() {
  // --- State ---
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("newest");
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [adminReviewPurpose, setAdminReviewPurpose] = useState<string>("");
  const [adminReviewActive, setAdminReviewActive] = useState<boolean>(false);
  const [archivedItems, setArchivedItems] = useState<Set<string>>(new Set());

  // isAdmin — default false; set to true for super admin access in staging/prod
  const [isAdmin] = useState<boolean>(false);

  // --- Derived query params ---
  const hasFilters =
    selectedCategory !== "all" ||
    searchQuery.trim() !== "" ||
    selectedType !== "all";

  const historyParams = adminReviewActive
    ? {} // full unfiltered list for admin review
    : {
        category: selectedCategory,
        search: searchQuery.trim() || undefined,
        type: selectedType,
        sort: sortOrder,
      };

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useHistory(historyParams);

  // --- Handlers ---
  const handleToggleArchive = useCallback((item: V1HistoryItem) => {
    setArchivedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, []);

  const handleOpenAdminModal = useCallback(() => {
    setAdminReviewPurpose("");
    setShowAdminModal(true);
  }, []);

  const handleCancelAdmin = useCallback(() => {
    setShowAdminModal(false);
    setAdminReviewPurpose("");
  }, []);

  const handleConfirmAdmin = useCallback(() => {
    if (adminReviewPurpose.trim().length === 0) return;
    setShowAdminModal(false);
    setAdminReviewActive(true);
  }, [adminReviewPurpose]);

  const handleExitAdminReview = useCallback(() => {
    setAdminReviewActive(false);
    setAdminReviewPurpose("");
  }, []);

  // --- Derived items list ---
  const items: V1HistoryItem[] = data?.items ?? [];

  return (
    <div className="p-4 tablet:p-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-h2 text-on-surface">تاریخچه</h1>
          <p className="text-body-2 text-muted mt-1">
            سابقه گفتگوها، اسناد و قراردادها
          </p>
        </div>

        {/* Admin Review button — only shown to admin users */}
        {isAdmin && !adminReviewActive && (
          <button
            onClick={handleOpenAdminModal}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 bg-amber-600 text-white text-body-2 font-medium hover:bg-amber-700 transition-colors touch-target"
          >
            <IconShield size={18} />
            بازبینی مدیر ارشد
          </button>
        )}

        {/* Exit admin review */}
        {adminReviewActive && (
          <button
            onClick={handleExitAdminReview}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 border border-error text-error text-body-2 font-medium hover:bg-error/10 transition-colors touch-target"
          >
            <IconClose size={18} />
            خروج از حالت بازبینی
          </button>
        )}
      </div>

      {/* Persistent Audit Banner */}
      {adminReviewActive && <AuditBanner />}

      {/* Category Tabs */}
      {!adminReviewActive && (
        <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="دسته‌بندی تاریخچه">
          {CATEGORY_TABS.map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedCategory(cat.key)}
                className={[
                  "rounded-full px-4 py-2 text-body-2 transition-colors touch-target",
                  isActive
                    ? "bg-primary text-white"
                    : "bg-surface text-muted hover:text-on-surface border border-border",
                ].join(" ")}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Search, Filter, Sort Bar */}
      {!adminReviewActive && (
        <div className="flex flex-col tablet:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <IconSearch
              size={18}
              className="absolute start-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در تاریخچه..."
              className="w-full h-11 rounded-large bg-surface border border-border ps-10 pe-4 text-body-2 text-on-surface placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              dir="rtl"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute end-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted/20 transition-colors touch-target"
                aria-label="پاک کردن جستجو"
              >
                <IconClose size={14} />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-11 rounded-large bg-surface border border-border px-4 text-body-2 text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors cursor-pointer min-w-[140px]"
            aria-label="فیلتر نوع"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="h-11 rounded-large bg-surface border border-border px-4 text-body-2 text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors cursor-pointer min-w-[140px]"
            aria-label="مرتب‌سازی"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Admin review active: show filter-reset message */}
      {adminReviewActive && (
        <p className="text-body-2 text-muted mb-6">
          نمایش تمام آیتم‌ها بدون فیلتر (حالت بازبینی)
        </p>
      )}

      {/* Loading State */}
      {isLoading && <LoadingState />}

      {/* Error State */}
      {isError && !isLoading && (
        <ErrorState
          message={error instanceof Error ? error.message : "خطای ناشناخته"}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State */}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState hasFilters={hasFilters || adminReviewActive} />
      )}

      {/* Item List */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="space-y-3 mt-2">
          {/* Result count */}
          <p className="text-labelSmall text-muted px-1">
            {data?.pagination
              ? `${items.length} از ${data.pagination.total} نتیجه`
              : `${items.length} نتیجه`}
          </p>

          {items.map((item) => (
            <HistoryItemCard
              key={item.id}
              item={item}
              isArchived={archivedItems.has(item.id)}
              onToggleArchive={handleToggleArchive}
            />
          ))}
        </div>
      )}

      {/* Admin Review Modal */}
      <AdminReviewModal
        open={showAdminModal}
        purpose={adminReviewPurpose}
        onPurposeChange={setAdminReviewPurpose}
        onCancel={handleCancelAdmin}
        onConfirm={handleConfirmAdmin}
      />
    </div>
  );
}
