"use client";

import React, { useEffect, useCallback, useRef } from "react";
import { Button } from "./Button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  /** Dialog width constraint */
  maxWidth?: "sm" | "md" | "lg";
  /** Prevent closing on backdrop click */
  persistent?: boolean;
  /** Footer actions */
  actions?: React.ReactNode;
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "sm",
  persistent = false,
  actions,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Trap focus and handle escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !persistent) {
        onClose();
      }
    },
    [onClose, persistent]
  );

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";

      // Focus first focusable element
      requestAnimationFrame(() => {
        const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      });
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      if (!open && previousFocus.current) {
        previousFocus.current.focus();
      }
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-scrim animate-fade-in"
        onClick={persistent ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-title" : undefined}
        aria-describedby={description ? "dialog-description" : undefined}
        className={[
          "relative w-full bg-surface rounded-large shadow-elevation-24",
          maxWidthClasses[maxWidth],
          "animate-dialog-enter",
          "max-h-[85vh] sm:max-h-[85vh]",  // 90dvh on mobile for bottom sheet feel
          "overflow-auto",
          // Mobile: full-width bottom sheet
          "max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0",
          "max-sm:max-w-full max-sm:rounded-b-none max-sm:max-h-[90dvh]",
          "max-sm:animate-slide-up",
        ].join(" ")}
      >
        {/* Header */}
        {(title || description) && (
          <div className="px-6 pt-6 pb-2">
            {title && (
              <h2 id="dialog-title" className="text-headlineSmall text-onSurface">
                {title}
              </h2>
            )}
            {description && (
              <p id="dialog-description" className="mt-1 text-bodyMedium text-onSurfaceVariant">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Body */}
        {children && <div className="px-6 py-4">{children}</div>}

        {/* Footer */}
        {actions && (
          <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/** Convenience: Confirm Dialog */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "تأیید",
  cancelLabel = "انصراف",
  destructive = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant="filled"
            onClick={onConfirm}
            loading={loading}
            className={destructive ? "!bg-error text-onError" : ""}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
