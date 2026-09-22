"use client";

// ============================================================
// LEGALIR — Attach Document Modal
// ============================================================
// The real picker behind the composer's paperclip. It lists the user's
// recent documents (metadata only — never the file bytes), lets them
// multi-select up to MAX_CHAT_ATTACHMENTS, and offers a path to upload a
// brand-new document through the EXISTING documents flow.
//
// Desktop: a centred dialog. Mobile: a bottom sheet. Same content.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRecentDocuments } from "@/hooks/useDocuments";
import {
  IconAttach,
  IconDocument,
  IconFile,
  IconUpload,
  IconClose,
  IconCheck,
  IconSearch,
  IconRefresh,
} from "@/lib/icons";
import { formatFileSize } from "@/lib/persian-utils";
import { previewTypeLabel } from "@/lib/document-preview";
import { MAX_CHAT_ATTACHMENTS, type V1DocumentListItem } from "@legalir/types";
import { TextField } from "@legalir/ui";

interface AttachDocumentModalProps {
  open: boolean;
  onClose: () => void;
  /** Documents already selected in the composer (pre-checked here). */
  selected: V1DocumentListItem[];
  /** Confirm the selection — replaces the composer's attachment list. */
  onConfirm: (documents: V1DocumentListItem[]) => void;
  /** Where to return after uploading a new document (the chat URL). */
  returnTo?: string;
}

export function AttachDocumentModal({
  open,
  onClose,
  selected,
  onConfirm,
  returnTo,
}: AttachDocumentModalProps) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useRecentDocuments(24);
  const documents = useMemo(() => data?.items ?? [], [data]);

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<V1DocumentListItem[]>(selected);
  const panelRef = useRef<HTMLDivElement>(null);

  // Re-sync the working selection each time the modal opens.
  useEffect(() => {
    if (open) setPicked(selected);
  }, [open, selected]);

  // Escape closes; body scroll is locked while open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const pickedIds = new Set(picked.map((d) => d.id));
  const atLimit = picked.length >= MAX_CHAT_ATTACHMENTS;

  const filtered = query.trim()
    ? documents.filter((d) =>
        d.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : documents;

  const toggle = (doc: V1DocumentListItem) => {
    setPicked((prev) => {
      if (prev.some((d) => d.id === doc.id)) {
        return prev.filter((d) => d.id !== doc.id);
      }
      if (prev.length >= MAX_CHAT_ATTACHMENTS) return prev;
      return [...prev, doc];
    });
  };

  const handleUploadNew = () => {
    const params = new URLSearchParams({ source: "chat" });
    if (returnTo) params.set("returnTo", returnTo);
    router.push(`/documents/upload?${params.toString()}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end tablet:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — bottom sheet on mobile, centred dialog on desktop */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="افزودن سند به گفتگو"
        className={[
          "relative flex w-full flex-col bg-surface shadow-elevation-3",
          "max-h-[85vh] tablet:max-h-[80vh] tablet:max-w-lg",
          "rounded-t-2xl tablet:rounded-large",
          "animate-slide-up-fade",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-divider px-4 py-3">
          <div className="flex items-center gap-2">
            <IconAttach size={20} className="text-primary" />
            <h2 className="text-titleSmall text-onSurface">افزودن سند به گفتگو</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-onSurface/[0.08]"
            aria-label="بستن"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 px-4 pt-3">
          <TextField
            type="search"
            label="جستجوی سند"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی سند..."
            leadingIcon={<IconSearch size={18} />}
            inputSize="small"
            fullWidth
          />
          <p className="mt-2 text-caption text-muted">
            حداکثر {MAX_CHAT_ATTACHMENTS} سند — {picked.length} انتخاب شده
          </p>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {isLoading && (
            <div className="space-y-2 px-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-medium bg-surface-container" />
              ))}
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <p className="text-bodySmall text-muted">
                بارگذاری فهرست اسناد ناموفق بود.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1.5 rounded-medium px-3 py-2 text-bodySmall text-primary transition-colors hover:bg-primary/10"
              >
                <IconRefresh size={16} />
                تلاش مجدد
              </button>
            </div>
          )}

          {!isLoading && !isError && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <IconDocument size={40} className="text-muted" />
              <p className="text-bodySmall text-muted">
                {query.trim()
                  ? "سندی با این نام پیدا نشد."
                  : "هنوز سندی ثبت نکرده‌اید."}
              </p>
              <p className="text-caption text-muted">
                می‌توانید سند جدیدی بارگذاری کنید.
              </p>
            </div>
          )}

          {!isLoading &&
            !isError &&
            filtered.map((doc) => {
              const isPicked = pickedIds.has(doc.id);
              const disabled = !isPicked && atLimit;
              const Icon = doc.mime === "application/pdf" ? IconDocument : IconFile;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => toggle(doc)}
                  disabled={disabled}
                  aria-pressed={isPicked}
                  className={[
                    "flex w-full items-center gap-3 rounded-medium px-3 py-2.5 text-start transition-colors",
                    isPicked ? "bg-primary/10" : "hover:bg-surface-hover",
                    disabled ? "cursor-not-allowed opacity-40" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      isPicked ? "bg-primary text-white" : "bg-primary/10 text-primary",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    <Icon size={20} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-bodySmall text-onSurface">
                      {doc.name}
                    </span>
                    <span className="block text-caption text-muted">
                      {previewTypeLabel(doc.mime, doc.name)} · {formatFileSize(doc.sizeBytes)}
                    </span>
                  </span>

                  <span
                    className={[
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      isPicked
                        ? "border-primary bg-primary text-white"
                        : "border-outline/40 text-transparent",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    <IconCheck size={14} />
                  </span>
                </button>
              );
            })}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-divider p-3">
          <button
            type="button"
            onClick={handleUploadNew}
            className="mb-2 flex w-full items-center gap-3 rounded-medium px-3 py-2.5 text-start transition-colors hover:bg-surface-hover"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
              <IconUpload size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-bodySmall font-medium text-onSurface">
                بارگذاری سند جدید
              </span>
              <span className="block text-caption text-muted">
                رفتن به بخش اسناد و آپلود فایل
              </span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-medium border border-divider px-4 py-2.5 text-bodySmall text-onSurface transition-colors hover:bg-surface-hover"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={() => onConfirm(picked)}
              className="flex-1 rounded-medium bg-primary px-4 py-2.5 text-bodySmall font-medium text-white transition-colors hover:bg-primary-variant"
            >
              افزودن {picked.length > 0 ? `(${picked.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
