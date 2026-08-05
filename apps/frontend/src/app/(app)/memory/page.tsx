"use client";

import { useState, type FormEvent } from "react";
import { useMemories, useUpdateMemory, useDeleteMemory } from "@/hooks/usePhase11";
import {
  IconMemory,
  IconPerson,
  IconSettings,
  IconBalance,
  IconEdit,
  IconDelete,
  IconCheck,
  IconClose,
  IconWarning,
  IconSave,
} from "@/lib/icons";
import type { V1MemoryItem } from "@legalir/types";

// ============================================================
// Constants
// ============================================================

const CATEGORY_CONFIG: Record<
  V1MemoryItem["category"],
  { label: string; icon: typeof IconPerson; color: string; bgColor: string }
> = {
  profile: {
    label: "اطلاعات کاربر",
    icon: IconPerson,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
  },
  preference: {
    label: "تنظیمات برگزیده",
    icon: IconSettings,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/20",
  },
  legal_context: {
    label: "اطلاعات حقوقی",
    icon: IconBalance,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
  },
};

const SENSITIVITY_CONFIG: Record<
  V1MemoryItem["sensitivity"],
  { label: string; colorClass: string }
> = {
  normal: { label: "عادی", colorClass: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  sensitive: { label: "حساس", colorClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  highly_sensitive: {
    label: "بسیار حساس",
    colorClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

const STATUS_LABELS: Record<V1MemoryItem["status"], string> = {
  active: "فعال",
  disabled: "غیرفعال",
  deleted: "حذف شده",
};

// ============================================================
// Component
// ============================================================

export default function MemoryPage() {
  // --- Data ---
  const { data, isLoading, isError, error, refetch } = useMemories();
  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();

  // --- Local State ---
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<V1MemoryItem | null>(null);
  const [consentTarget, setConsentTarget] = useState<V1MemoryItem | null>(null);

  // Sync local memoryEnabled with API data when it loads
  const effectiveMemoryEnabled =
    data !== undefined ? data.memoryEnabled : memoryEnabled;
  const items: V1MemoryItem[] = data?.items ?? [];

  // Filter out deleted items from display
  const visibleItems = items.filter((item) => item.status !== "deleted");

  // --- Handlers ---

  function handleToggleMemory() {
    const next = !effectiveMemoryEnabled;
    setMemoryEnabled(next);
    // In a real implementation, this would call a PATCH on the global memory toggle
    // For now we manage it locally with a visual state
  }

  function handleStartEdit(item: V1MemoryItem) {
    setEditingId(item.id);
    setEditKey(item.key);
    setEditValue(item.value);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditKey("");
    setEditValue("");
  }

  function handleSaveEdit(itemId: string, e: FormEvent) {
    e.preventDefault();
    if (!editKey.trim() || !editValue.trim()) return;

    updateMemory.mutate(
      { id: itemId, key: editKey.trim(), value: editValue.trim() },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditKey("");
          setEditValue("");
        },
      }
    );
  }

  function handleToggleItemStatus(item: V1MemoryItem) {
    const newStatus = item.status === "active" ? "disabled" : "active";
    updateMemory.mutate({ id: item.id, status: newStatus });
  }

  function handleRequestDelete(item: V1MemoryItem) {
    setDeleteTarget(item);
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteMemory.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }

  function handleCancelDelete() {
    setDeleteTarget(null);
  }

  function handleRequestConsent(item: V1MemoryItem) {
    setConsentTarget(item);
  }

  function handleApproveConsent() {
    if (!consentTarget) return;
    // Simulate consent approval — update the item to mark consent given
    // In a real implementation, this would call a dedicated consent endpoint
    updateMemory.mutate(
      { id: consentTarget.id, status: consentTarget.status },
      {
        onSuccess: () => {
          setConsentTarget(null);
        },
      }
    );
  }

  function handleRejectConsent() {
    if (!consentTarget) return;
    // Simulate consent rejection — soft-delete or disable the item
    updateMemory.mutate(
      { id: consentTarget.id, status: "disabled" },
      {
        onSuccess: () => {
          setConsentTarget(null);
        },
      }
    );
  }

  function handleCancelConsent() {
    setConsentTarget(null);
  }

  // --- Derived View Data ---

  const legalContextItems = visibleItems.filter(
    (item) => item.category === "legal_context"
  );
  const hasLegalContextItems = legalContextItems.length > 0;

  // --- Render ---

  return (
    <div className="p-4 tablet:p-6 max-w-4xl mx-auto" dir="rtl">
      {/* ====================================================== */}
      {/* Header with Toggle                                      */}
      {/* ====================================================== */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-h2 text-on-surface">حافظه</h1>
          <p className="text-body-2 text-muted mt-1">
            اطلاعات ذخیره‌شده برای بهبود پاسخ‌های AI
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-body-2 text-muted">
            {effectiveMemoryEnabled ? "فعال" : "غیرفعال"}
          </span>
          <button
            type="button"
            onClick={handleToggleMemory}
            role="switch"
            aria-checked={effectiveMemoryEnabled}
            aria-label={
              effectiveMemoryEnabled ? "غیرفعال کردن حافظه" : "فعال کردن حافظه"
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              effectiveMemoryEnabled ? "bg-primary" : "bg-border"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                effectiveMemoryEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* ====================================================== */}
      {/* Legal Context Warning                                    */}
      {/* ====================================================== */}
      {hasLegalContextItems && (
        <div className="mb-4 flex items-start gap-3 rounded-large bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
          <IconWarning
            className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
            size={20}
          />
          <p className="text-body-2 text-amber-800 dark:text-amber-300">
            اطلاعات حقوقی حساس به صورت خودکار ذخیره نمی‌شود
          </p>
        </div>
      )}

      {/* ====================================================== */}
      {/* Loading State                                            */}
      {/* ====================================================== */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider animate-pulse"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-muted/30" />
                <div className="h-4 w-24 bg-muted/30 rounded" />
              </div>
              <div className="h-3 w-full bg-muted/20 rounded mb-2" />
              <div className="h-3 w-3/4 bg-muted/20 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* ====================================================== */}
      {/* Error State                                              */}
      {/* ====================================================== */}
      {isError && !isLoading && (
        <div className="rounded-large bg-surface p-8 shadow-elevation-1 border border-divider text-center">
          <div className="flex justify-center mb-4">
            <IconWarning className="text-red-500" size={48} />
          </div>
          <h3 className="text-h3 text-on-surface mb-2">
            خطا در بارگذاری اطلاعات
          </h3>
          <p className="text-body-2 text-muted mb-6">
            {error instanceof Error
              ? error.message
              : "متأسفانه در دریافت اطلاعات ذخیره‌شده مشکلی پیش آمده است."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-white text-body-2 font-medium hover:bg-primary/90 transition-colors touch-target"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {/* ====================================================== */}
      {/* Empty State                                              */}
      {/* ====================================================== */}
      {!isLoading && !isError && visibleItems.length === 0 && (
        <div className="rounded-large bg-surface p-8 shadow-elevation-1 border border-divider text-center">
          <div className="flex justify-center mb-4">
            <IconMemory className="text-muted" size={48} />
          </div>
          <h3 className="text-h3 text-on-surface mb-2">
            اطلاعاتی ذخیره نشده است
          </h3>
          <p className="text-body-2 text-muted max-w-md mx-auto">
            LEGALIR می‌تواند اطلاعات مهم شما را برای بهبود پاسخ‌های آینده به خاطر
            بسپارد. تمام اطلاعات ذخیره‌شده قابل مشاهده، ویرایش و حذف توسط شما
            هستند.
          </p>
        </div>
      )}

      {/* ====================================================== */}
      {/* Memory Items List                                        */}
      {/* ====================================================== */}
      {!isLoading && !isError && visibleItems.length > 0 && (
        <div className="space-y-3">
          {visibleItems.map((item) => {
            const cat = CATEGORY_CONFIG[item.category];
            const sensitivity = SENSITIVITY_CONFIG[item.sensitivity];
            const isDisabled = item.status === "disabled";
            const isEditing = editingId === item.id;
            const CategoryIcon = cat.icon;

            return (
              <div
                key={item.id}
                className={`rounded-large bg-surface shadow-elevation-1 border border-divider transition-all hover:shadow-elevation-2 ${
                  isDisabled ? "opacity-50" : ""
                }`}
              >
                {/* Card Header: Category + Badges */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-medium ${cat.bgColor} ${cat.color}`}
                    >
                      <CategoryIcon size={14} />
                      {cat.label}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${sensitivity.colorClass}`}
                    >
                      {sensitivity.label}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${
                        item.status === "active"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1">
                    {/* Enable/Disable Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleItemStatus(item)}
                      disabled={updateMemory.isPending}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors touch-target ${
                        item.status === "active" ? "bg-primary" : "bg-border"
                      }`}
                      aria-label={
                        item.status === "active"
                          ? "غیرفعال کردن"
                          : "فعال کردن"
                      }
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          item.status === "active"
                            ? "translate-x-[18px]"
                            : "translate-x-[2px]"
                        }`}
                      />
                    </button>

                    {/* Edit Button */}
                    {item.consentGiven && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        disabled={isEditing}
                        className="rounded-full p-2 text-muted hover:text-on-surface hover:bg-muted/10 transition-colors touch-target"
                        aria-label="ویرایش"
                      >
                        <IconEdit size={16} />
                      </button>
                    )}

                    {/* Delete Button */}
                    {item.consentGiven && (
                      <button
                        type="button"
                        onClick={() => handleRequestDelete(item)}
                        disabled={deleteMemory.isPending}
                        className="rounded-full p-2 text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors touch-target"
                        aria-label="حذف"
                      >
                        <IconDelete size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="px-5 pb-5">
                  {isEditing ? (
                    /* ---------- Inline Edit Form ---------- */
                    <form
                      onSubmit={(e) => handleSaveEdit(item.id, e)}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-caption text-muted mb-1">
                          کلید
                        </label>
                        <input
                          type="text"
                          value={editKey}
                          onChange={(e) => setEditKey(e.target.value)}
                          className="w-full rounded-md border border-divider bg-surface px-3 py-2 text-body-2 text-on-surface placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                          placeholder="مثال: نام وکیل"
                          dir="rtl"
                        />
                      </div>
                      <div>
                        <label className="block text-caption text-muted mb-1">
                          مقدار
                        </label>
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full rounded-md border border-divider bg-surface px-3 py-2 text-body-2 text-on-surface placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                          placeholder="مثال: محمد محمدی"
                          dir="rtl"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={
                            updateMemory.isPending ||
                            !editKey.trim() ||
                            !editValue.trim()
                          }
                          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-white text-caption font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-target"
                        >
                          <IconSave size={14} />
                          ذخیره
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={updateMemory.isPending}
                          className="inline-flex items-center gap-1.5 rounded-full border border-divider px-4 py-1.5 text-caption text-muted hover:text-on-surface hover:bg-muted/10 transition-colors touch-target"
                        >
                          <IconClose size={14} />
                          انصراف
                        </button>
                        {updateMemory.isPending && (
                          <span className="text-caption text-muted">
                            در حال ذخیره...
                          </span>
                        )}
                      </div>
                    </form>
                  ) : (
                    /* ---------- Display Mode ---------- */
                    <div>
                      <dl className="grid grid-cols-1 gap-2">
                        <div>
                          <dt className="text-caption text-muted">کلید</dt>
                          <dd className="text-body-2 text-on-surface font-medium mt-0.5">
                            {item.key}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-caption text-muted">مقدار</dt>
                          <dd className="text-body-2 text-on-surface mt-0.5">
                            {item.value}
                          </dd>
                        </div>
                      </dl>

                      {/* Consent Request Button for pending items */}
                      {!item.consentGiven && (
                        <div className="mt-3 pt-3 border-t border-divider">
                          <button
                            type="button"
                            onClick={() => handleRequestConsent(item)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-4 py-1.5 text-caption font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors touch-target"
                          >
                            <IconWarning size={14} />
                            درخواست تأیید
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ====================================================== */}
      {/* Global Memory Disabled Overlay                            */}
      {/* ====================================================== */}
      {!effectiveMemoryEnabled && !isLoading && !isError && visibleItems.length > 0 && (
        <div className="mt-4 rounded-large bg-surface p-4 shadow-elevation-1 border border-divider text-center">
          <IconMemory className="mx-auto mb-2 text-muted" size={24} />
          <p className="text-body-2 text-muted">
            حافظه غیرفعال است. هیچ داده جدیدی ذخیره نخواهد شد.
          </p>
        </div>
      )}

      {/* ====================================================== */}
      {/* Delete Confirmation Dialog                               */}
      {/* ====================================================== */}
      {deleteTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="تأیید حذف"
        >
          <div className="mx-4 w-full max-w-sm rounded-large bg-surface p-6 shadow-elevation-3 border border-divider">
            <h3 className="text-h3 text-on-surface mb-3">تأیید حذف</h3>
            <p className="text-body-2 text-muted mb-6">
              آیا از حذف آیتم
              <span className="text-on-surface font-medium">
                {" "}
                &quot;{deleteTarget.key}&quot;{" "}
              </span>
              اطمینان دارید؟ این عملیات قابل بازگشت نیست.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={deleteMemory.isPending}
                className="rounded-full border border-divider px-5 py-2 text-body-2 text-muted hover:text-on-surface hover:bg-muted/10 transition-colors touch-target"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteMemory.isPending}
                className="rounded-full bg-red-600 px-5 py-2 text-white text-body-2 font-medium hover:bg-red-700 disabled:opacity-50 transition-colors touch-target inline-flex items-center gap-1.5"
              >
                {deleteMemory.isPending ? (
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

      {/* ====================================================== */}
      {/* Consent Dialog                                           */}
      {/* ====================================================== */}
      {consentTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="تأیید ذخیره‌سازی اطلاعات"
        >
          <div className="mx-4 w-full max-w-md rounded-large bg-surface p-6 shadow-elevation-3 border border-divider">
            {/* Consent Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-2 shrink-0">
                <IconWarning
                  className="text-amber-600 dark:text-amber-400"
                  size={20}
                />
              </div>
              <div>
                <h3 className="text-h3 text-on-surface">تأیید ذخیره‌سازی</h3>
                <p className="text-caption text-muted mt-1">
                  دسته:{" "}
                  {CATEGORY_CONFIG[consentTarget.category]?.label ??
                    consentTarget.category}
                </p>
              </div>
            </div>

            {/* Consent Item Details */}
            <div className="rounded-md bg-muted/5 border border-divider p-3 mb-4">
              <dl className="space-y-1">
                <div className="flex items-center justify-between">
                  <dt className="text-caption text-muted">کلید:</dt>
                  <dd className="text-body-2 text-on-surface">
                    {consentTarget.key}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-caption text-muted">مقدار:</dt>
                  <dd className="text-body-2 text-on-surface">
                    {consentTarget.value}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-caption text-muted">سطح حساسیت:</dt>
                  <dd>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium ${
                        SENSITIVITY_CONFIG[consentTarget.sensitivity]
                          .colorClass
                      }`}
                    >
                      {SENSITIVITY_CONFIG[consentTarget.sensitivity].label}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Consent Message */}
            <p className="text-body-2 text-on-surface mb-6 leading-relaxed">
              من تأیید می‌کنم که این اطلاعات برای بهبود پاسخ‌های AI ذخیره شود
            </p>

            {/* Consent Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelConsent}
                disabled={updateMemory.isPending}
                className="rounded-full border border-divider px-5 py-2 text-body-2 text-muted hover:text-on-surface hover:bg-muted/10 transition-colors touch-target"
              >
                <IconClose size={14} className="inline-block ml-1" />
                انصراف
              </button>
              <button
                type="button"
                onClick={handleRejectConsent}
                disabled={updateMemory.isPending}
                className="rounded-full border border-red-200 dark:border-red-800 px-5 py-2 text-body-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors touch-target"
              >
                رد کردن
              </button>
              <button
                type="button"
                onClick={handleApproveConsent}
                disabled={updateMemory.isPending}
                className="rounded-full bg-primary px-5 py-2 text-white text-body-2 font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors touch-target inline-flex items-center gap-1.5"
              >
                {updateMemory.isPending ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    در حال ذخیره...
                  </>
                ) : (
                  <>
                    <IconCheck size={14} />
                    تأیید می‌کنم
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* Mutation Error Toast (global)                            */}
      {/* ====================================================== */}
      {(updateMemory.isError || deleteMemory.isError) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 mx-4 w-full max-w-sm rounded-large bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 shadow-elevation-2">
          <div className="flex items-start gap-3">
            <IconWarning
              className="text-red-600 dark:text-red-400 shrink-0 mt-0.5"
              size={18}
            />
            <div>
              <p className="text-body-2 text-red-800 dark:text-red-300 font-medium">
                خطا در انجام عملیات
              </p>
              <p className="text-caption text-red-600 dark:text-red-400 mt-1">
                {updateMemory.error instanceof Error
                  ? updateMemory.error.message
                  : deleteMemory.error instanceof Error
                    ? deleteMemory.error.message
                    : "لطفاً دوباره تلاش کنید."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                updateMemory.reset();
                deleteMemory.reset();
              }}
              className="mr-auto text-red-500 hover:text-red-700 dark:hover:text-red-300 p-1 touch-target shrink-0"
              aria-label="بستن"
            >
              <IconClose size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
