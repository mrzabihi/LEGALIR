// ============================================================
// LEGALIR — Document Upload Zone
// Drag-and-drop file upload with validation (Phase 9)
// ============================================================

"use client";

import { useRef, useState, useCallback, type DragEvent, type ChangeEvent } from "react";
import { IconUpload, IconClose, IconWarning } from "@/lib/icons";
import { SUPPORTED_DOCUMENT_MIMES, MAX_DOCUMENT_SIZE_BYTES } from "@legalir/types";

// ============================================================
// Helpers
// ============================================================

const ACCEPT_STRING = SUPPORTED_DOCUMENT_MIMES.join(",");

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
}

function formatMaxSize(): string {
  return formatFileSize(MAX_DOCUMENT_SIZE_BYTES);
}

function validateFile(file: File): string | null {
  const acceptedMimes = SUPPORTED_DOCUMENT_MIMES as readonly string[];
  if (!acceptedMimes.includes(file.type)) {
    const extensions = SUPPORTED_DOCUMENT_MIMES.map(
      (m) => MIME_LABELS[m] ?? m
    ).join("، ");
    return `فرمت فایل پشتیبانی نمی‌شود. فرمت‌های مجاز: ${extensions}`;
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return `حجم فایل بیش از حد مجاز است. حداکثر حجم مجاز: ${formatMaxSize()}`;
  }

  if (file.size === 0) {
    return "فایل خالی است. لطفا یک فایل معتبر انتخاب کنید.";
  }

  return null;
}

// ============================================================
// UploadZone component
// ============================================================

interface UploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function UploadZone({ onFile, disabled = false }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setSelectedFileName(file.name);
      onFile(file);
    },
    [onFile]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [disabled, handleFile]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  const handleClearError = useCallback(() => {
    setError(null);
    setSelectedFileName(null);
  }, []);

  return (
    <div className="w-full" dir="rtl">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="ناحیه بارگذاری فایل"
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "relative flex flex-col items-center justify-center gap-3 p-8 rounded-large border-2 border-dashed transition-all duration-200 cursor-pointer",
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-divider bg-surface hover:border-primary/50",
          disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
        ].join(" ")}
      >
        {/* Icon */}
        <div
          className={[
            "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
            isDragOver ? "bg-primary/10 text-primary" : "bg-gray-100 text-muted",
          ].join(" ")}
        >
          <IconUpload size={28} />
        </div>

        {/* Text */}
        <div className="text-center">
          {selectedFileName ? (
            <p className="text-body-2 text-on-surface font-medium">
              {selectedFileName}
            </p>
          ) : (
            <>
              <p className="text-body-2 text-on-surface font-medium">
                فایل خود را اینجا رها کنید
              </p>
              <p className="text-caption text-muted mt-1">
                یا برای انتخاب فایل کلیک کنید
              </p>
            </>
          )}
        </div>

        {/* Accepted formats */}
        <p className="text-caption text-muted">
          فرمت‌های مجاز: PDF، DOCX، PNG، JPEG، WebP (حداکثر{" "}
          {formatMaxSize()})
        </p>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_STRING}
          onChange={handleInputChange}
          className="sr-only"
          aria-hidden="true"
          disabled={disabled}
        />
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-medium bg-red-50 border border-red-200 p-3 text-red-800"
        >
          <IconWarning size={20} className="mt-0.5 shrink-0 text-red-600" />
          <div className="flex-1 min-w-0">
            <p className="text-caption font-medium">{error}</p>
          </div>
          <button
            type="button"
            onClick={handleClearError}
            aria-label="بستن پیام خطا"
            className="shrink-0 text-red-500 hover:text-red-700 p-1"
          >
            <IconClose size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
