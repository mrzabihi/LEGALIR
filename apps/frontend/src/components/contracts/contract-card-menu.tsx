// ============================================================
// LEGALIR — Contract card overflow menu
// ============================================================
// The secondary "⋮" menu on a work-item card. It holds the actions
// that are not the card's primary verb — delete a draft, copy the
// reference code, open the verification page.
//
// Self-contained: it owns its open state, closes on outside click and
// on Escape, and returns focus to the trigger, so a card can drop it
// in without wiring any of that up.
// ============================================================

"use client";

import React from "react";
import { IconMore } from "@/lib/icons";

export interface ContractCardMenuItem {
  key: string;
  labelFa: string;
  icon?: React.ReactNode;
  /** Renders the item in the error colour (e.g. delete). */
  destructive?: boolean;
  onSelect: () => void;
}

interface ContractCardMenuProps {
  items: ContractCardMenuItem[];
  /** Accessible name for the trigger. */
  label?: string;
}

export function ContractCardMenu({ items, label = "گزینه‌های بیشتر" }: ContractCardMenuProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-on-surface/[0.08] transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        <IconMore size={20} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-10 z-30 min-w-44 rounded-medium border border-divider bg-surface py-1 shadow-elevation-8 animate-slide-up-fade"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-right text-body-2 transition-colors hover:bg-on-surface/[0.06] ${
                item.destructive ? "text-error" : "text-on-surface"
              }`}
            >
              {item.icon && (
                <span className="h-4 w-4 shrink-0" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              {item.labelFa}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
