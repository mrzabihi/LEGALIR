// ============================================================
// LEGALIR — «ساخت جدید» create-action sheet
// ============================================================
// The bottom sheet opened by the centre button of the mobile navigation.
// It is a light, rounded surface with a two-column grid of four quick-start
// actions. Opening the sheet never creates anything — each action is a real
// link into an existing flow, and picking one closes the sheet and navigates.
//
// Focus management mirrors the shared Dialog: focus is trapped while open,
// Escape and backdrop close it, and focus returns to the trigger on close.
// The sheet is portalled to <body> so it is never clipped by the shell's
// stacking contexts (the bar uses backdrop-blur, which creates one).

"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createActions } from "@/lib/routes";
import {
  IconClose,
  IconFilePen,
  IconFileSearch,
  IconFileText,
  IconChat,
} from "@/lib/icons";

const ACTION_ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  FilePen: IconFilePen,
  FileSearch: IconFileSearch,
  FileText: IconFileText,
  Chat: IconChat,
};

interface CreateActionSheetProps {
  open: boolean;
  onClose: () => void;
}

export function CreateActionSheet({ open, onClose }: CreateActionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Focus trap: Tab / Shift+Tab cycle within the sheet.
      if (e.key === "Tab" && sheetRef.current) {
        const focusable = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusable.length === 0) return;

        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    const raf = requestAnimationFrame(() => {
      sheetRef.current
        ?.querySelector<HTMLElement>('a[href], button:not([disabled])')
        ?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, [open, handleKeyDown]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="presentation">
      {/* Backdrop — tap to dismiss */}
      <div
        className="absolute inset-0 bg-scrim animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        id="create-action-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-action-sheet-title"
        className="animate-sheet-up safe-bottom absolute inset-x-0 bottom-0 mx-auto max-h-[85dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[28px] border-x border-t border-divider bg-surface shadow-elevation-24"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-outline-variant" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
          <div>
            <h2 id="create-action-sheet-title" className="text-h3 text-on-surface">
              ساخت جدید
            </h2>
            <p className="mt-1 text-body-2 text-muted">چه کاری می‌خواهید انجام دهید؟</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400"
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* Actions — two-column grid. The generous bottom padding keeps the
            last row clear of the floating nav bar, which rides above the
            sheet so its centre × stays tappable. */}
        <div className="grid grid-cols-2 gap-3 px-5 pb-24 pt-2">
          {createActions.map((action) => {
            const Icon = ACTION_ICON_MAP[action.icon];
            return (
              <Link
                key={action.id}
                href={action.href}
                onClick={onClose}
                className="group flex min-h-[64px] items-center gap-3 rounded-2xl border border-divider bg-surface-container-low px-4 py-3.5 transition-colors hover:bg-surface-container active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-50 text-secondary-700 transition-colors group-hover:bg-secondary-100">
                  {Icon ? <Icon size={22} /> : null}
                </span>
                <span className="text-body-2 font-medium text-on-surface">
                  {action.titleFa}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
