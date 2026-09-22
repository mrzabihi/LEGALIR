// ============================================================
// LEGALIR — History Page
// Category-based history tabs, search, filter, sort
// Archive/resume, Admin review with audit trail
// ============================================================

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useHistory, useArchiveHistoryItem } from "@/hooks/usePhase11";
import { useDeleteConversation } from "@/hooks/useConversations";
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
  IconDelete,
  IconSubscription,
} from "@/lib/icons";
import type { V1HistoryItem } from "@legalir/types";
import { Select, TextField } from "@legalir/ui";

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
  { key: "subscription", label: "Subscription" },
  { key: "case", label: "Case" },
];

const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: "newest", label: "جدیدترین" },
  { key: "oldest", label: "قدیمی‌ترین" },
  { key: "title", label: "عنوان" },
];



// ============================================================
// Icon selector per item type
// ============================================================


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
        {hasFilters ? "نتیجه‌ای یافت نشد" : "تاریخچه شما هنوز خالی است"}
      </h3>
      <p className="text-body-2 text-muted mb-6">
        {hasFilters
          ? "با تغییر فیلترها دوباره جستجو کنید"
          : "با شروع استفاده از LEGALIR، تاریخچه فعالیت‌های شما در اینجا نمایش داده می‌شود"}
      </p>
      {!hasFilters && (
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-white text-body-2 font-medium hover:bg-primary-dark transition-colors touch-target"
        >
          <IconChat size={18} />
          شروع گفتگو
        </Link>
      )}
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
        <div className="mb-5">
          <TextField
            id="admin-review-purpose"
            label="هدف بازبینی"
            type="text"
            value={purpose}
            onChange={(e) => onPurposeChange(e.target.value)}
            placeholder="مثال: حسابرسی دوره‌ای سه‌ماهه"
            required
            autoFocus
            fullWidth
          />
        </div>

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
// Service-Type-Specific Card Designs
// ============================================================

/** Status badge color map — maps raw status to color + symbol */
function getStatusConfig(status: string): { color: string; symbol: string; label: string } {
  const s = status.toLowerCase();
  if (["completed", "ready", "generated", "approved", "exported", "active"].includes(s)) {
    return { color: "bg-success/10 text-success border-success/30", symbol: "✓", label: "" };
  }
  if (["processing", "analyzing", "extracting", "under_review", "collecting", "uploaded"].includes(s)) {
    return { color: "bg-blue-100 text-blue-700 border-blue-300", symbol: "⟳", label: "" };
  }
  if (["draft"].includes(s)) {
    return { color: "bg-amber-100 text-amber-700 border-amber-300", symbol: "📝", label: "" };
  }
  if (["failed", "blocked"].includes(s)) {
    return { color: "bg-error/10 text-error border-error/30", symbol: "✗", label: "" };
  }
  if (["archived"].includes(s)) {
    return { color: "bg-surfaceVariant text-muted border-divider", symbol: "📦", label: "" };
  }
  return { color: "bg-surfaceVariant text-muted border-divider", symbol: "", label: "" };
}

/** Conversation card — shows question preview, category, date */
function ConversationCard({ item, isArchived }: { item: V1HistoryItem; isArchived: boolean }) {
  const statusCfg = getStatusConfig(item.status);

  return (
    <div
      className={`rounded-large border p-4 transition-all hover:shadow-elevation-4 group ${
        isArchived ? "opacity-60 bg-surfaceVariant/30" : "bg-surface border-divider"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <IconChat size={20} className="text-blue-600" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className={`text-body-1 font-semibold text-onSurface ${isArchived ? "line-through" : ""}`}>
              {item.title}
            </h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-labelSmall border ${statusCfg.color}`}>
              <span>{statusCfg.symbol}</span>
              {item.statusFa}
            </span>
          </div>

          {/* Question preview / description */}
          {item.description && (
            <p className="text-body-2 text-muted line-clamp-2 mb-2">
              {item.description}
            </p>
          )}

          {/* Bottom: category + date */}
          <div className="flex items-center gap-3 text-labelSmall text-muted">
            {item.categoryFa && (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60" />
                {item.categoryFa}
              </span>
            )}
            <span>{toPersianDate(item.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Document Analysis card — shows document name, risk level, findings count */
function DocumentCard({ item, isArchived }: { item: V1HistoryItem; isArchived: boolean }) {
  const statusCfg = getStatusConfig(item.status);
  const riskLevel = item.status === "ready" ? (item.description?.includes("۵") ? "high" : "medium") : null;
  const findingCount = item.description?.match(/(\d+)\s*یافته/)?.[1] ?? null;
  const riskColor =
    riskLevel === "high" ? "text-error bg-error/10" :
    riskLevel === "medium" ? "text-warning bg-warning/10" :
    "text-muted bg-surfaceVariant";

  return (
    <div
      className={`rounded-large border p-4 transition-all hover:shadow-elevation-4 group ${
        isArchived ? "opacity-60 bg-surfaceVariant/30" : "bg-surface border-divider"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <IconDocument size={20} className="text-green-600" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className={`text-body-1 font-semibold text-onSurface ${isArchived ? "line-through" : ""}`}>
              {item.title}
            </h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-labelSmall border ${statusCfg.color}`}>
              <span>{statusCfg.symbol}</span>
              {item.statusFa}
            </span>
          </div>

          {/* Risk level + findings count */}
          <div className="flex items-center gap-3 mb-2">
            {riskLevel && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-labelSmall ${riskColor}`}>
                {riskLevel === "high" ? "🟡" : "🟢"}
                ریسک {riskLevel === "high" ? "بالا" : "متوسط"}
              </span>
            )}
            {findingCount && (
              <span className="text-labelSmall text-muted">
                {findingCount} یافته
              </span>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-body-2 text-muted line-clamp-1 mb-1">
              {item.description}
            </p>
          )}

          {/* Bottom: category + date */}
          <div className="flex items-center gap-3 text-labelSmall text-muted">
            {item.categoryFa && (
              <span>{item.categoryFa}</span>
            )}
            <span>{toPersianDate(item.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Contract card — shows contract type, status, version */
function ContractCard({ item, isArchived }: { item: V1HistoryItem; isArchived: boolean }) {
  const statusCfg = getStatusConfig(item.status);
  const isApproved = item.status === "approved" || item.status === "exported";
  const isGenerated = item.status === "generated";

  return (
    <div
      className={`rounded-large border p-4 transition-all hover:shadow-elevation-4 group ${
        isArchived ? "opacity-60 bg-surfaceVariant/30" : "bg-surface border-divider"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <IconContract size={20} className="text-amber-600" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className={`text-body-1 font-semibold text-onSurface ${isArchived ? "line-through" : ""}`}>
              {item.title}
            </h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-labelSmall border ${statusCfg.color}`}>
              <span>{statusCfg.symbol}</span>
              {item.statusFa}
            </span>
            {isApproved && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-labelSmall bg-success/10 text-success border border-success/30">
                <span>✓</span>
                نهایی
              </span>
            )}
            {isGenerated && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-labelSmall bg-primary/10 text-primary border border-primary/30">
                <span>📋</span>
                آماده بررسی
              </span>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-body-2 text-muted line-clamp-2 mb-2">
              {item.description}
            </p>
          )}

          {/* Bottom: category + date */}
          <div className="flex items-center gap-3 text-labelSmall text-muted">
            {item.categoryFa && (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                {item.categoryFa}
              </span>
            )}
            <span>{toPersianDate(item.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Case card — shows case title, status, and category */
function CaseCard({ item, isArchived }: { item: V1HistoryItem; isArchived: boolean }) {
  const statusCfg = getStatusConfig(item.status);

  return (
    <div
      className={`rounded-large border p-4 transition-all hover:shadow-elevation-4 group ${
        isArchived ? "opacity-60 bg-surfaceVariant/30" : "bg-surface border-divider"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
          <IconShield size={20} className="text-sky-600" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className={`text-body-1 font-semibold text-onSurface ${isArchived ? "line-through" : ""}`}>
              {item.title}
            </h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-labelSmall border ${statusCfg.color}`}>
              <span>{statusCfg.symbol}</span>
              {item.statusFa}
            </span>
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-body-2 text-muted line-clamp-2 mb-2">
              {item.description}
            </p>
          )}

          {/* Bottom: category + date */}
          <div className="flex items-center gap-3 text-labelSmall text-muted">
            {item.categoryFa && (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500/60" />
                {item.categoryFa}
              </span>
            )}
            <span>{toPersianDate(item.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Subscription card — shows purchased plan, status, and activation date */
function SubscriptionCard({ item, isArchived }: { item: V1HistoryItem; isArchived: boolean }) {
  const statusCfg = getStatusConfig(item.status);

  return (
    <div
      className={`rounded-large border p-4 transition-all hover:shadow-elevation-4 group ${
        isArchived ? "opacity-60 bg-surfaceVariant/30" : "bg-surface border-divider"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
          <IconSubscription size={20} className="text-violet-600" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className={`text-body-1 font-semibold text-onSurface ${isArchived ? "line-through" : ""}`}>
              {item.title}
            </h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-labelSmall border ${statusCfg.color}`}>
              <span>{statusCfg.symbol}</span>
              {item.statusFa}
            </span>
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-body-2 text-muted line-clamp-2 mb-2">
              {item.description}
            </p>
          )}

          {/* Bottom: date */}
          <div className="flex items-center gap-3 text-labelSmall text-muted">
            <span>{toPersianDate(item.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryItemCard({
  item,
  isArchived,
  onToggleArchive,
  onDelete,
}: {
  item: V1HistoryItem;
  isArchived: boolean;
  onToggleArchive: (item: V1HistoryItem) => void;
  onDelete: (item: V1HistoryItem) => void;
}) {
  // Render type-specific card on larger screens
  const CardComponent =
    item.type === "conversation" ? ConversationCard :
    item.type === "document" ? DocumentCard :
    item.type === "contract" ? ContractCard :
    item.type === "subscription" ? SubscriptionCard :
    item.type === "case" ? CaseCard :
    ConversationCard;

  return (
    <div className="relative group/item">
      <CardComponent item={item} isArchived={isArchived} />

      {/* Action buttons — positioned absolutely */}
      <div className="absolute top-3 end-3 flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition-all">
        <button
          onClick={() => onToggleArchive(item)}
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-labelSmall font-medium transition-all touch-target",
            isArchived
              ? "bg-primary/10 text-primary hover:bg-primary/20"
              : "bg-white/90 text-muted hover:bg-white shadow-sm border border-border",
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

        {/* Delete — only for conversations (chats the user can remove) */}
        {item.type === "conversation" && (
          <button
            onClick={() => onDelete(item)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-labelSmall font-medium bg-white/90 text-error hover:bg-error/10 shadow-sm border border-error/30 transition-all touch-target"
            aria-label="حذف گفتگو"
          >
            <IconDelete size={14} />
            حذف
          </button>
        )}
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
  const [deleteTarget, setDeleteTarget] = useState<V1HistoryItem | null>(null);

  const deleteConversation = useDeleteConversation();
  const archiveItem = useArchiveHistoryItem();

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
  const handleToggleArchive = useCallback(
    (item: V1HistoryItem) => {
      const nextArchived = !archivedItems.has(item.id);
      // Optimistic local toggle for instant feedback.
      setArchivedItems((prev) => {
        const next = new Set(prev);
        if (nextArchived) next.add(item.id);
        else next.delete(item.id);
        return next;
      });
      // Persist server-side so the state survives reloads.
      archiveItem.mutate(
        { id: item.id, archived: nextArchived },
        {
          onError: () => {
            setArchivedItems((prev) => {
              const next = new Set(prev);
              if (nextArchived) next.delete(item.id);
              else next.add(item.id);
              return next;
            });
          },
        }
      );
    },
    [archivedItems, archiveItem]
  );

  const handleRequestDelete = useCallback((item: V1HistoryItem) => {
    setDeleteTarget(item);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteConversation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        refetch();
      },
    });
  }, [deleteTarget, deleteConversation, refetch]);

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
          <div className="flex-1">
            <TextField
              type="search"
              label="جستجو در تاریخچه"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در تاریخچه..."
              leadingIcon={<IconSearch size={18} />}
              endAdornment={
                searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-on-surface/[0.08]"
                    aria-label="پاک کردن جستجو"
                  >
                    <IconClose size={16} />
                  </button>
                ) : undefined
              }
              fullWidth
            />
          </div>

          {/* Type Filter */}
          <Select
            label="فیلتر نوع"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            selectSize="small"
            className="min-w-[140px]"
            options={TYPE_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label }))}
          />

          {/* Sort Order */}
          <Select
            label="مرتب‌سازی"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            selectSize="small"
            className="min-w-[140px]"
            options={SORT_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label }))}
          />
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
              onDelete={handleRequestDelete}
            />
          ))}
        </div>
      )}

      {/* Delete Conversation Confirmation */}
      {deleteTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تأیید حذف گفتگو"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="w-full max-w-sm rounded-large bg-surface p-6 shadow-elevation-8 border border-divider">
            <h3 className="text-h3 text-on-surface mb-3">حذف گفتگو</h3>
            <p className="text-body-2 text-muted mb-6">
              آیا از حذف گفتگوی
              <span className="text-on-surface font-medium"> «{deleteTarget.title}» </span>
              اطمینان دارید؟ این گفتگو دیگر در تاریخچه نمایش داده نخواهد شد.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteConversation.isPending}
                className="rounded-full border border-divider px-5 py-2 text-body-2 text-muted hover:text-on-surface hover:bg-muted/10 transition-colors touch-target"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteConversation.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-error px-5 py-2 text-white text-body-2 font-medium hover:bg-error/90 disabled:opacity-50 transition-colors touch-target"
              >
                {deleteConversation.isPending ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    در حال حذف...
                  </>
                ) : (
                  <>
                    <IconDelete size={14} />
                    حذف
                  </>
                )}
              </button>
            </div>
          </div>
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
