// ============================================================
// LEGALIR — Overflow (⋮) menu
// ============================================================
// The single, reusable "more actions" menu for compact list rows
// (/history, /cases, /contracts, /documents). It exists so every list
// answers "what else can I do with this row?" the same way, instead of
// each page growing its own one-off menu.
//
// What it guarantees (so a caller never has to wire it up):
//   • a real ARIA menu — role="menu"/"menuitem", arrow-key roving
//     focus, Home/End, Escape to close AND return focus to the trigger;
//   • closes on outside pointer-down and on Tab-out;
//   • never opens off-screen — it flips above the trigger when there
//     is no room below, and is capped to the viewport height;
//   • the trigger swallows its own click so tapping the menu can never
//     also open/activate the row behind it.
//
// Motion is a short fade/slide that the global `prefers-reduced-motion`
// guard neutralises.
// ============================================================

"use client";

import React from "react";
import { IconMore } from "@/lib/icons";

export interface OverflowMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  /** Renders the item in the error tone (e.g. delete). */
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface OverflowMenuProps {
  items: OverflowMenuItem[];
  /** Accessible name for the trigger, e.g. «گزینه‌های این سابقه». */
  label?: string;
  /** Visual size of the trigger. `small` = 36px (desktop list rows). */
  size?: "small" | "medium";
  className?: string;
}

const TRIGGER_SIZE: Record<NonNullable<OverflowMenuProps["size"]>, string> = {
  small: "h-9 w-9",
  medium: "h-10 w-10",
};

export function OverflowMenu({
  items,
  label = "گزینه‌های بیشتر",
  size = "small",
  className = "",
}: OverflowMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [placement, setPlacement] = React.useState<"bottom" | "top">("bottom");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const close = React.useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Outside pointer-down + Escape. Kept in one effect so the listeners
  // exist only while the menu is open.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Collision handling: flip above the trigger when the menu would
  // overflow the viewport bottom, and cap its height so it always fits.
  React.useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const needed = menu.offsetHeight + 12;
    setPlacement(spaceBelow < needed && rect.top > spaceBelow ? "top" : "bottom");
  }, [open]);

  // Move focus into the menu on open (roving focus starts on item 0).
  React.useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  if (items.length === 0) return null;

  const focusItem = (index: number) => {
    const count = items.length;
    const next = ((index % count) + count) % count;
    itemRefs.current[next]?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItem(index + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItem(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusItem(0);
        break;
      case "End":
        e.preventDefault();
        focusItem(items.length - 1);
        break;
      case "Tab":
        // Leaving the menu with Tab closes it without trapping focus.
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          // Never let the menu toggle bubble up and activate the row.
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className={`${TRIGGER_SIZE[size]} inline-flex shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-short3 hover:bg-surface-hover hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2`}
      >
        <IconMore size={20} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          className={[
            "absolute end-0 z-40 max-h-[min(18rem,calc(100vh-1rem))] min-w-[12rem] max-w-[min(16rem,calc(100vw-1rem))] overflow-y-auto rounded-medium border border-[color:var(--color-outline-variant)] bg-surface py-1 shadow-elevation-8 animate-slide-up-fade",
            placement === "bottom" ? "top-full mt-1" : "bottom-full mb-1",
          ].join(" ")}
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              onKeyDown={(e) => onMenuKeyDown(e, index)}
              className={[
                "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start text-body-2 transition-colors duration-short3",
                "focus-visible:outline-none focus-visible:bg-surface-hover",
                item.disabled ? "cursor-not-allowed opacity-40" : "hover:bg-surface-hover",
                item.destructive ? "text-error" : "text-on-surface",
              ].join(" ")}
            >
              {item.icon && (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
