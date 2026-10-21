"use client";

import React, { useEffect, useCallback, useRef } from "react";
import { IconButton } from "./IconButton";
import {
  acquireOverlayLayer,
  isTopOverlayLayer,
  releaseOverlayLayer,
  type OverlayToken,
} from "../lib/overlay-layer";

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
  // This drawer's entry in the shared layer stack — a Dialog opened from the
  // drawer registers above it, so only one of them answers a keypress.
  const layerToken = useRef<OverlayToken | null>(null);

  // Keep the latest `onClose` reachable from the stable listener below without
  // making it a dependency — a changing `onClose` identity (an inline arrow
  // prop) must not re-run the focus effects while the drawer is open, or focus
  // is stolen/restored on every parent render (the "typing jumps away" defect).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only the topmost overlay reacts: Escape while a confirm dialog sits above
    // this drawer must close the dialog, not the drawer (and not both, which is
    // what two independent document listeners used to do).
    if (!isTopOverlayLayer(layerToken.current)) return;

    if (e.key === "Escape") {
      onCloseRef.current();
      return;
    }

    // Focus trap within drawer
    if (e.key === "Tab" && drawerRef.current) {
      const container = drawerRef.current;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      // A drawer has no on-open autofocus, so focus is still on whatever opened
      // it — outside the panel, over the page behind the scrim. Tab from there
      // used to walk that page instead of entering the drawer. Focus outside
      // the panel (or nowhere at all) is therefore a boundary in both
      // directions: Tab pulls it in at the first control, Shift+Tab at the
      // last. Same rule the shared Dialog applies to its own surface.
      //
      // Exception: a Dialog opened FROM a drawer is portalled to <body>, so it
      // is outside this container in DOM terms while sitting on top of it. The
      // drawer must not drag focus out of a modal stacked above it.
      const stacked = active instanceof Element ? active.closest('[role="dialog"]') : null;
      const ownedByOtherModal = !!stacked && stacked !== container;
      const atBoundary = !ownedByOtherModal && (!active || !container.contains(active));

      if (e.shiftKey && (atBoundary || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (atBoundary || active === last)) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  // Layer registration + body scroll lock — tied ONLY to `open`.
  //
  // The lock is reference counted (lib/overlay-layer), so a dialog opened from
  // this drawer and then closed leaves the page frozen until the drawer itself
  // goes away. The key listener stays separate: `open` alone must not re-run
  // the registration, and `handleKeyDown` has a stable identity.
  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    const token = acquireOverlayLayer();
    layerToken.current = token;
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      layerToken.current = null;
      releaseOverlayLayer(token);
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
          <div className="flex items-center justify-between gap-2 border-b border-divider p-4">
            <h2 className="text-titleLarge text-onSurface">{title}</h2>
            {/* The shared IconButton, not a hand-rolled <button>: the drawer's
                dismiss control is the first Tab stop in the panel, so it must
                carry the same 48px MD3 target and focus ring as every other
                icon action. `-m-2` pulls the 48px target back onto the same
                optical corner the 40px glyph used to occupy. */}
            <IconButton
              variant="standard"
              size="medium"
              label="بستن منو"
              onClick={onClose}
              className="-m-2"
            >
              {/* Material "close" glyph, same path the panel used inline. */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </IconButton>
          </div>
        )}
        <div className="flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}
