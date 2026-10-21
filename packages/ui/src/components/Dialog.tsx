"use client";

import React, { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  /**
   * Dialog width constraint. `sm`–`lg` cover the compact confirm/prompt
   * dialogs; `xl`–`7xl` exist for wide desktop surfaces (e.g. the admin
   * plan builder). All are `max-width`, so the dialog stays `w-full` and
   * never exceeds the viewport.
   */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
  /** Prevent closing on backdrop click */
  persistent?: boolean;
  /** Footer actions */
  actions?: React.ReactNode;
  /**
   * Optional dismiss control pinned to the dialog's top corner, on the same
   * row as the title. Pass an `IconButton` with a real `label`.
   *
   * It is a header slot rather than a child on purpose: anything rendered as
   * a child lives in the scrolling body, so on a short viewport the close
   * control would scroll away and leave the dialog with no visible way out.
   * A dedicated flex slot also guarantees it can never overlap the title
   * or the body content.
   */
  closeButton?: React.ReactNode;
  /**
   * Where focus lands when the dialog opens.
   *
   *   "first"     (default) the first focusable control — a form dialog that
   *               wants the caret in its first field.
   *   "container" the dialog surface itself (`tabIndex=-1`). Use it for a
   *               short, read-only prompt: focusing the surface still moves
   *               assistive tech into the dialog and announces its title,
   *               without painting a focus ring on the close button the
   *               instant the dialog appears.
   */
  initialFocus?: "first" | "container";
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
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
  closeButton,
  initialFocus = "first",
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Latest `onClose`/`persistent` reachable from the stable keydown listener
  // below without making them dependencies. A changing `onClose` identity (the
  // usual inline arrow prop) must NOT re-run the focus effects while the dialog
  // is open — otherwise focus is re-stolen and restored on every parent render
  // (e.g. on each keystroke in a field of the dialog), which is exactly the
  // "typing jumps to another field" defect.
  const onCloseRef = useRef(onClose);
  const persistentRef = useRef(persistent);
  // Same reason as above: `initialFocus` is read inside the open-only focus
  // effect, so it must not become a dependency of it.
  const initialFocusRef = useRef(initialFocus);
  useEffect(() => {
    onCloseRef.current = onClose;
    persistentRef.current = persistent;
    initialFocusRef.current = initialFocus;
  });

  // Trap focus and handle escape. Identity is stable (empty deps) on purpose.
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && !persistentRef.current) {
      onCloseRef.current();
      return;
    }

    // Focus trap: Tab/Shift+Tab cycle within dialog
    if (e.key === "Tab" && dialogRef.current) {
      const container = dialogRef.current;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      // The surface itself is focusable (`tabIndex=-1`) and holds focus under
      // `initialFocus="container"`. It sits before `first` in DOM order and is
      // outside the Tab cycle, so a plain Shift+Tab from it escapes the dialog
      // entirely instead of wrapping to the last control — it is a boundary,
      // exactly like `first` is. `undefined`/outside activeElement is treated
      // the same way: pull focus back in rather than let it walk the page
      // behind the scrim.
      const atBoundary = active === container || !active || !container.contains(active);

      if (e.shiftKey && (atBoundary || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (atBoundary || active === last)) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  // Body scroll lock + key listener — tied ONLY to `open`.
  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  // Focus management — tied ONLY to `open`, never to parent re-renders, so
  // typing inside a dialog field cannot move focus.
  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement;

    // Move focus into the dialog once, on open.
    const raf = requestAnimationFrame(() => {
      if (initialFocusRef.current === "container") {
        dialogRef.current?.focus();
        return;
      }
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      // Restore focus on close.
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  // A Dialog is frequently opened from INSIDE a Drawer. The drawer panel is
  // itself `position: absolute` + animated with a transform, and a transform
  // makes a containing block for `position: fixed` descendants — so an
  // in-tree dialog would be laid out against the drawer's own scrolled
  // content and could land off-screen (observed at y = −197 inside a long
  // contract drawer). Portalling to <body> keeps the overlay anchored to the
  // real viewport no matter which scrolling container it was opened from.
  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-scrim backdrop-blur-[2px] animate-fade-in"
        onClick={persistent ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        // Focusable so `initialFocus="container"` can move focus to the
        // surface itself. `-1` keeps it out of the Tab order.
        tabIndex={-1}
        aria-labelledby={title ? "dialog-title" : undefined}
        aria-describedby={description ? "dialog-description" : undefined}
        className={[
          "relative flex w-full flex-col bg-surface rounded-large shadow-elevation-24 ring-1 ring-black/5",
          // The surface can hold focus (`initialFocus="container"`), which
          // must never paint a ring around the whole panel.
          "focus:outline-none",
          maxWidthClasses[maxWidth],
          "animate-dialog-enter",
          "max-h-[85vh]",
          // Mobile: full-width bottom sheet (a bit taller than desktop).
          "max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0",
          "max-sm:max-w-full max-sm:rounded-b-none max-sm:max-h-[90dvh]",
          "max-sm:animate-slide-up",
        ].join(" ")}
      >
        {/* Header — pinned (shrink-0) so the title/close stay visible on scroll. */}
        {(title || description || closeButton) && (
          <div
            className={[
              "shrink-0 px-6 pt-6 pb-2",
              // With a dismiss control the header is a two-column row: the
              // copy keeps the remaining width (and may wrap), the button
              // keeps its own fixed slot, so the two can never overlap.
              closeButton ? "flex items-start gap-2" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className={closeButton ? "min-w-0 flex-1" : undefined}>
              {title && (
                <h2 id="dialog-title" className="text-headlineSmall font-medium text-on-surface">
                  {title}
                </h2>
              )}
              {description && (
                <p id="dialog-description" className="mt-1 text-bodyMedium text-on-surface-variant">
                  {description}
                </p>
              )}
            </div>
            {/* The caller owns the button's own optical offset (a 48px MD3
                icon target needs to be pulled into the corner), so this slot
                only reserves the column. */}
            {closeButton && <div className="shrink-0">{closeButton}</div>}
          </div>
        )}

        {/* Body — the only scroll region (min-h-0 lets a flex child shrink). */}
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>}

        {/* Footer — pinned (shrink-0) so the primary actions stay reachable.
            On the mobile bottom sheet the bottom padding adds the device
            safe-area inset, so the actions never sit under the home
            indicator in the installed PWA. One `padding-bottom` utility per
            breakpoint range on purpose — the helper classes in globals.css
            are plain CSS and would lose to (or fight with) `pb-6`. */}
        {actions && (
          <div className="flex shrink-0 items-center justify-end gap-2 px-6 pb-6 pt-2 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
            {actions}
          </div>
        )}
      </div>
    </div>
  );

  // SSR/first paint has no document yet; render nothing rather than crash on
  // a portal target that does not exist.
  if (typeof document === "undefined") return overlay;
  return createPortal(overlay, document.body);
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
