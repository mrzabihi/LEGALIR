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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const isEnd = position === "end";
  const slideClass = isEnd
    ? "translate-x-full rtl:translate-x-[-100%] animate-slide-in-end"
    : "-translate-x-full rtl:translate-x-full animate-slide-in-start";

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
        style={{ width }}
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
