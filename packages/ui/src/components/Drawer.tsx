"use client";

import React, { useEffect, useCallback, useRef } from "react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  position?: "end" | "start";
  width?: number;
  title?: string;
  children: React.ReactNode;
}

export function Drawer({
  open,
  onClose,
  position = "end",
  width = 280,
  title,
  children,
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Keep the latest `onClose` reachable from the stable listener below without
  // making it a dependency — a changing `onClose` identity (an inline arrow
  // prop) must not re-run the focus effects while the drawer is open, or focus
  // is stolen/restored on every parent render (the "typing jumps away" defect).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onCloseRef.current();
      return;
    }

    // Focus trap within drawer
    if (e.key === "Tab" && drawerRef.current) {
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

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
  }, []);

  // Body scroll lock — tied ONLY to `open`.
  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  // Focus save/restore — tied ONLY to `open`, never to parent re-renders.
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    return () => {
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  const isEnd = position === "end";
  // Each edge class pairs an LTR base transform with an RTL counterpart so the
  // panel starts off its OWN edge, then the animation settles it at translateX(0).
  // A panel anchored to `end` sits at the left in RTL, so it must enter from the
  // left (`-100%` → 0). Leaving it at `+100%` would slide it across the screen.
  const slideClass = isEnd
    ? "translate-x-full rtl:translate-x-[-100%] animate-drawer-slide-in"
    : "-translate-x-full rtl:translate-x-full animate-drawer-slide-in-left";

  return (
    <div className="fixed inset-0 z-40" role="presentation">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-scrim animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || "منوی کناری"}
        className={[
          "absolute top-0 bottom-0 bg-surface shadow-elevation-16",
          "flex flex-col overflow-auto",
          slideClass,
          isEnd ? "end-0" : "start-0",
        ].join(" ")}
        // `maxWidth: 100%` caps the drawer to the viewport on narrow screens so
        // a fixed pixel width can never cause horizontal overflow on mobile.
        style={{ width, maxWidth: "100%" }}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-divider">
            <h2 className="text-titleLarge text-onSurface">{title}</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-onSurface/[0.08] transition-colors"
              aria-label="بستن منو"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}
