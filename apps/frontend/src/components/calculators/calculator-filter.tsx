// ============================================================
// LEGALIR — Calculator filter dropdown
// ============================================================
// A compact trigger + popover listbox, one per filter (category,
// legal standing). Modelled on the app's existing self-contained
// trigger/menu pattern (see `contract-card-menu.tsx`): it owns its open
// state, closes on outside-pointer and Escape, and restores focus to the
// trigger.
//
// The trigger always shows the current selection — the filter name when
// nothing is chosen, or the chosen option's label when it is — so the
// state is legible without opening the menu. A small count badge appears
// while a non-default option is active, and the panel's first row is an
// explicit «همهٔ …» reset.
//
// Accessibility: a button with `aria-haspopup="listbox"` /
// `aria-expanded`, and a `role="listbox"` panel of `role="option"` rows
// carrying `aria-selected`. Keyboard: Enter/Space/↓ opens and focuses the
// chosen row; ↑/↓ move; Enter/Space select; Escape closes.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconClose } from "@/lib/icons";
import type { ControlOption } from "./types";

interface CalculatorFilterProps {
  /** Accessible/visible name of the filter, e.g. «دسته» or «اعتبار». */
  label: string;
  /** Noun used for the reset row, e.g. «همهٔ دسته‌ها». */
  allLabel: string;
  options: ControlOption[];
  value: string;
  onChange: (id: string) => void;
  /** Applies only to the two filters on one row (they grow to share it). */
  className?: string;
}

export function CalculatorFilter({
  label,
  allLabel,
  options,
  value,
  onChange,
  className = "",
}: CalculatorFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const rows = [{ id: "all", label: allLabel, count: undefined as number | undefined }, ...options];
  const active = value !== "all" ? options.find((o) => o.id === value) : undefined;
  const activeIndex = rows.findIndex((r) => r.id === value);

  useEffect(() => {
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

  // Focus the active row (or the reset row) when the panel opens, so
  // keyboard users land on a sensible starting point.
  useEffect(() => {
    if (!open) return;
    const idx = activeIndex >= 0 ? activeIndex : 0;
    const node = listRef.current?.children[idx] as HTMLElement | undefined;
    node?.querySelector("button")?.focus();
  }, [open, activeIndex]);

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onRowKeyDown = (e: React.KeyboardEvent, id: string) => {
    const nodes = Array.from(listRef.current?.querySelectorAll("button") ?? []) as HTMLElement[];
    const i = nodes.indexOf(e.currentTarget as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      nodes[Math.min(nodes.length - 1, i + 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nodes[Math.max(0, i - 1)]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(id);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={active ? `${label}: ${active.label}` : `${label}: ${allLabel}`}
        className={[
          "flex h-10 w-full min-w-0 items-center gap-1.5 rounded-medium border px-3",
          "text-body-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          active
            ? "border-primary bg-primary-soft text-on-primary-container"
            : "border-[color:var(--color-outline)] bg-surface text-on-surface",
          "hover:bg-surface-container",
        ].join(" ")}
      >
        <span className="shrink-0 text-caption text-on-surface-variant">{label}:</span>
        <span className="min-w-0 flex-1 truncate text-start font-medium">
          {active ? active.label : allLabel}
        </span>
        {active && (
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-white"
            aria-hidden="true"
          >
            ۱
          </span>
        )}
        <IconChevronDown
          size={18}
          className={`shrink-0 text-on-surface-variant transition-transform duration-short3 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-1 max-h-72 w-max min-w-full overflow-y-auto rounded-large border border-divider bg-surface py-1 shadow-elevation-8 animate-slide-up-fade"
        >
          {rows.map((row, idx) => {
            const selected = row.id === value;
            const isReset = idx === 0;
            return (
              <li key={row.id} className="px-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onClick={() => choose(row.id)}
                  onKeyDown={(e) => onRowKeyDown(e, row.id)}
                  className={[
                    "flex w-full items-center gap-2 rounded-small px-2 py-1.5 text-start text-body-2 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    selected
                      ? "bg-primary-soft font-medium text-on-primary-container"
                      : "text-on-surface hover:bg-on-surface/[0.06]",
                    isReset && !selected ? "text-on-surface-variant" : "",
                  ].join(" ")}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                    {selected && <IconCheck size={16} />}
                  </span>
                  <span className="flex-1 whitespace-nowrap">{row.label}</span>
                  {!isReset && (
                    <span className="shrink-0 text-caption tabular-nums text-on-surface-variant">
                      {row.count?.toLocaleString("fa-IR")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}

          {active && (
            <li className="mt-1 border-t border-divider pt-1">
              <button
                type="button"
                onClick={() => choose("all")}
                className="flex w-full items-center gap-2 rounded-small px-2 py-1.5 text-start text-body-2 text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                  <IconClose size={16} />
                </span>
                پاک کردن {label}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
