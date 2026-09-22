// ============================================================
// LEGALIR — Settings · Memory & Knowledge (حافظه و دانش)
// ============================================================
// Lets the user teach the product the documents/knowledge it needs
// so the AI can update itself with that knowledge. Items are stored
// as memory entries and injected into AI grounding.
// ============================================================

"use client";

import { useState, useCallback } from "react";
import { TextField, Textarea, Select } from "@legalir/ui";
import { SettingsShell } from "@/components/settings/settings-shell";
import {
  SettingsCard,
  SkeletonBlock,
  ErrorBanner,
  EmptyState,
} from "@/components/settings/settings-ui";
import {
  useMemories,
  useCreateMemory,
  useDeleteMemory,
} from "@/hooks/usePhase11";
import { IconMemory, IconAdd, IconClose, IconDelete } from "@/lib/icons";
import type { V1MemoryItem } from "@legalir/types";

const MEMORY_CATEGORY_LABELS: Record<V1MemoryItem["category"], string> = {
  profile: "اطلاعات کاربر",
  preference: "تنظیمات برگزیده",
  legal_context: "دانش حقوقی",
};

export default function MemorySettingsPage() {
  const { data, isLoading, isError, error, refetch } = useMemories();
  const createMemory = useCreateMemory();
  const deleteMemory = useDeleteMemory();

  const [showForm, setShowForm] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState<V1MemoryItem["category"]>("legal_context");
  const [deleteTarget, setDeleteTarget] = useState<V1MemoryItem | null>(null);

  const items = (data?.items ?? []).filter((m) => m.status !== "deleted");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!key.trim() || !value.trim()) return;
      createMemory.mutate(
        { key: key.trim(), value: value.trim(), category },
        {
          onSuccess: () => {
            setKey("");
            setValue("");
            setShowForm(false);
          },
        }
      );
    },
    [key, value, category, createMemory]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMemory.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }, [deleteTarget, deleteMemory]);

  return (
    <SettingsShell
      title="حافظه و دانش"
      description="دانش و مستنداتی که هوش مصنوعی باید بداند را مدیریت کنید."
    >
      <SettingsCard
        title="حافظه و دانش"
        icon={<IconMemory size={22} />}
        action={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-body-2 text-on-primary font-medium transition hover:bg-primary-variant touch-target"
          >
            {showForm ? <IconClose size={16} /> : <IconAdd size={16} />}
            {showForm ? "بستن" : "افزودن دانش"}
          </button>
        }
      >
        <p className="text-body-2 text-muted mb-5">
          مستندات و دانشی که لازم است محصول بداند را اینجا اضافه کنید تا هوش مصنوعی
          خودش را با آن دانش به‌روزرسانی کند.
        </p>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="rounded-large border border-divider bg-surface-hover/40 p-4 mb-5 space-y-3"
          >
            <TextField
              id="memory-key"
              type="text"
              label="عنوان دانش"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="مثال: رویه داخلی شرکت در تنظیم قراردادها"
              fullWidth
            />
            <Textarea
              id="memory-value"
              label="محتوا"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={3}
              placeholder="متن دانش یا توضیح مستند..."
              fullWidth
            />
            <Select
              id="memory-category"
              label="دسته"
              value={category}
              onChange={(e) => setCategory(e.target.value as V1MemoryItem["category"])}
              fullWidth
              options={[
                { value: "legal_context", label: "دانش حقوقی" },
                { value: "profile", label: "اطلاعات کاربر" },
                { value: "preference", label: "تنظیمات برگزیده" },
              ]}
            />
            <button
              type="submit"
              disabled={createMemory.isPending || !key.trim() || !value.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-body-2 text-on-primary font-medium transition hover:bg-primary-variant disabled:opacity-50 disabled:cursor-not-allowed touch-target"
            >
              {createMemory.isPending ? "در حال ذخیره..." : "ذخیره دانش"}
            </button>
          </form>
        )}

        {isLoading ? (
          <SkeletonBlock lines={4} />
        ) : isError ? (
          <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState text="هنوز دانشی اضافه نشده است." />
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-large border border-divider bg-surface p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-body-1 text-on-surface font-medium">{item.key}</span>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-caption text-primary">
                      {MEMORY_CATEGORY_LABELS[item.category]}
                    </span>
                  </div>
                  <p className="text-body-2 text-muted line-clamp-2">{item.value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  disabled={deleteMemory.isPending}
                  className="shrink-0 rounded-full p-2 text-muted hover:text-error hover:bg-error/10 transition-colors touch-target"
                  aria-label="حذف"
                >
                  <IconDelete size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      {deleteTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تأیید حذف دانش"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="w-full max-w-sm rounded-large bg-surface p-6 shadow-elevation-8 border border-divider">
            <h3 className="text-h3 text-on-surface mb-3">حذف دانش</h3>
            <p className="text-body-2 text-muted mb-6">
              آیا از حذف
              <span className="text-on-surface font-medium"> «{deleteTarget.key}» </span>
              اطمینان دارید؟
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMemory.isPending}
                className="rounded-full border border-divider px-5 py-2 text-body-2 text-muted hover:text-on-surface hover:bg-muted/10 transition-colors touch-target"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteMemory.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-error px-5 py-2 text-white text-body-2 font-medium hover:bg-error/90 disabled:opacity-50 transition-colors touch-target"
              >
                {deleteMemory.isPending ? "در حال حذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
