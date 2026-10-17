"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  useMemories,
  useUpdateMemory,
  useDeleteMemory,
  useUpdateMemoryEnabled,
} from "@/hooks/usePhase11";
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
  IconChat,
} from "@/lib/icons";
import type { V1MemoryItem } from "@legalir/types";
import { Button, IconButton, Switch, TextField } from "@legalir/ui";

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
  const updateMemoryEnabled = useUpdateMemoryEnabled();

  // --- Local State ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<V1MemoryItem | null>(null);
  const [consentTarget, setConsentTarget] = useState<V1MemoryItem | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // The server-derived flag is the only source of truth; the optimistic
  // cache write makes it flip in the same frame as the tap.
  const effectiveMemoryEnabled = data?.memoryEnabled ?? false;
  const items: V1MemoryItem[] = data?.items ?? [];

  /** The item whose PATCH is currently in flight (one at a time). */
  const itemInFlight = updateMemory.isPending
    ? (updateMemory.variables?.id ?? null)
    : null;

  // Filter out deleted items from display
  const visibleItems = items.filter((item) => item.status !== "deleted");

  // --- Handlers ---

  function handleToggleMemory(next: boolean) {
    // Ignore re-entrant taps while the previous write is in flight.
    if (updateMemoryEnabled.isPending) return;
    setGlobalError(null);
    // Persisted through the privacy preference that GET /api/v1/memories
    // derives `memoryEnabled` from — one source of truth, no local flag.
    // The hook restores every affected cache if the write fails.
    updateMemoryEnabled.mutate(next, {
      onError: (err) =>
        setGlobalError(
          err instanceof Error && err.message
            ? err.message
            : "تغییر وضعیت حافظه ذخیره نشد؛ وضعیت قبلی بازگردانده شد."
        ),
    });
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
    if (updateMemory.isPending) return;
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
        <Switch
          checked={effectiveMemoryEnabled}
          onChange={(e) => handleToggleMemory(e.target.checked)}
          aria-label="حافظه"
          error={globalError}
          saving={updateMemoryEnabled.isPending}
          disabled={isLoading}
          disabledReason={isLoading ? "در حال بارگذاری وضعیت حافظه…" : undefined}
          className="shrink-0"
        />
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
                <div className="h-8 w-8 rounded-full bg-surface-container" />
                <div className="h-4 w-24 bg-surface-container rounded" />
              </div>
              <div className="h-3 w-full bg-surface-container rounded mb-2" />
              <div className="h-3 w-3/4 bg-surface-container rounded" />
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
          <Button type="button" onClick={() => refetch()}>
            تلاش مجدد
          </Button>
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
            هنوز موردی در حافظه ذخیره نشده است
          </h3>
          <p className="text-body-2 text-muted max-w-md mx-auto mb-6">
            LEGALIR می‌تواند اطلاعات مهم شما را برای بهبود پاسخ‌های آینده به خاطر
            بسپارد. تمام اطلاعات ذخیره‌شده قابل مشاهده، ویرایش و حذف توسط شما
            هستند.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-primary-on text-body-2 font-medium hover:opacity-90 transition-colors touch-target"
          >
            <IconChat size={18} />
            شروع گفتگو
          </Link>
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
                className={`rounded-large border border-divider transition-all hover:shadow-elevation-2 ${
                  isDisabled
                    ? // A disabled item is muted with a tint, not with whole-card
                      // opacity — dimming the card would also dim the switch that
                      // turns it back on, making the off state hard to read.
                      "bg-surface-container shadow-none"
                    : "bg-surface shadow-elevation-1"
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
                    {/* Enable/Disable — one shared switch, own row state */}
                    <Switch
                      checked={item.status === "active"}
                      onChange={() => handleToggleItemStatus(item)}
                      aria-label={`وضعیت «${item.key}»`}
                      saving={itemInFlight === item.id}
                      disabled={updateMemory.isPending && itemInFlight !== item.id}
                      disabledReason={
                        updateMemory.isPending && itemInFlight !== item.id
                          ? "در انتظار پایان تغییر دیگر…"
                          : undefined
                      }
                      className="me-1"
                    />

                    {/* Edit Button — icon-only but labelled; disabled while
                        this item is already in edit mode. */}
                    {item.consentGiven && (
                      <IconButton
                        size="small"
                        onClick={() => handleStartEdit(item)}
                        disabled={isEditing}
                        label="ویرایش"
                      >
                        <IconEdit size={16} />
                      </IconButton>
                    )}

                    {/* Delete Button — distinct destructive treatment; the
                        confirmation dialog still owns the real decision. */}
                    {item.consentGiven && (
                      <IconButton
                        size="small"
                        variant="danger"
                        onClick={() => handleRequestDelete(item)}
                        disabled={deleteMemory.isPending}
                        label="حذف"
                      >
                        <IconDelete size={16} />
                      </IconButton>
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
                      <TextField
                        label="کلید"
                        type="text"
                        value={editKey}
                        onChange={(e) => setEditKey(e.target.value)}
                        placeholder="مثال: نام وکیل"
                        fullWidth
                      />
                      <TextField
                        label="مقدار"
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="مثال: محمد محمدی"
                        fullWidth
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="submit"
                          size="small"
                          loading={updateMemory.isPending}
                          disabled={!editKey.trim() || !editValue.trim()}
                          startIcon={<IconSave size={14} />}
                        >
                          ذخیره
                        </Button>
                        <Button
                          type="button"
                          size="small"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          disabled={updateMemory.isPending}
                          startIcon={<IconClose size={14} />}
                        >
                          انصراف
                        </Button>
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
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancelDelete}
                disabled={deleteMemory.isPending}
              >
                انصراف
              </Button>
              {/* The destructive action stays red, keeps its own label, and
                  shows progress in place so the dialog never looks stuck. */}
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmDelete}
                loading={deleteMemory.isPending}
                startIcon={<IconDelete size={14} />}
              >
                حذف
              </Button>
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
            <div className="rounded-medium bg-surface-container border border-divider p-3 mb-4">
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
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancelConsent}
                disabled={updateMemory.isPending}
                startIcon={<IconClose size={14} />}
              >
                انصراف
              </Button>
              <Button
                type="button"
                variant="outlined"
                onClick={handleRejectConsent}
                disabled={updateMemory.isPending}
              >
                رد کردن
              </Button>
              <Button
                type="button"
                onClick={handleApproveConsent}
                loading={updateMemory.isPending}
                startIcon={<IconCheck size={14} />}
              >
                تأیید می‌کنم
              </Button>
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
            <IconButton
              size="small"
              variant="danger"
              onClick={() => {
                updateMemory.reset();
                deleteMemory.reset();
              }}
              label="بستن"
              className="ms-auto shrink-0"
            >
              <IconClose size={16} />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  );
}
