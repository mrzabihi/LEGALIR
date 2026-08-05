"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "./Button";

type SnackbarVariant = "info" | "success" | "warning" | "error";

interface SnackbarItem {
  id: string;
  message: string;
  variant?: SnackbarVariant;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface SnackbarContextValue {
  show: (params: Omit<SnackbarItem, "id">) => void;
  hide: (id: string) => void;
}

// Simple global state for snackbar management
let snackbarCounter = 0;
const listeners = new Set<() => void>();
let snackbarState: SnackbarItem[] = [];

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export const snackbar = {
  show(params: Omit<SnackbarItem, "id">) {
    const id = `snackbar-${++snackbarCounter}`;
    snackbarState = [...snackbarState, { ...params, id }];
    notifyListeners();
    return id;
  },
  hide(id: string) {
    snackbarState = snackbarState.filter((s) => s.id !== id);
    notifyListeners();
  },
};

const variantIcons: Record<SnackbarVariant, React.ReactNode> = {
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 17h2v-6h-2v6zm1-8c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0 13C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  ),
  success: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
    </svg>
  ),
};

const variantClasses: Record<SnackbarVariant, string> = {
  info: "bg-inverseSurface text-inverseOnSurface",
  success: "bg-success text-onSuccess",
  warning: "bg-warning text-onWarning",
  error: "bg-error text-onError",
};

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SnackbarItem[]>([]);

  useEffect(() => {
    const listener = () => setItems([...snackbarState]);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <>
      {children}
      {/* Snackbar container */}
      <div className="fixed bottom-4 start-4 end-4 z-50 flex flex-col gap-2 pointer-events-none">
        {items.map((item) => (
          <SnackbarItemComponent key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}

function SnackbarItemComponent({ item }: { item: SnackbarItem }) {
  const [exiting, setExiting] = useState(false);
  const duration = item.duration ?? 5000;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => snackbar.hide(item.id), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, item.id]);

  return (
    <div
      role="alert"
      className={[
        "pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-small shadow-elevation-4",
        "animate-slide-up",
        exiting ? "animate-fade-out" : "",
        variantClasses[item.variant ?? "info"],
      ].join(" ")}
      style={{ maxWidth: "480px", width: "fit-content" }}
    >
      <span className="shrink-0">{variantIcons[item.variant ?? "info"]}</span>
      <span className="text-bodyMedium flex-1">{item.message}</span>
      {item.action && (
        <Button variant="text" size="small" onClick={item.action.onClick} className="!text-inherit shrink-0">
          {item.action.label}
        </Button>
      )}
      <button
        onClick={() => {
          setExiting(true);
          setTimeout(() => snackbar.hide(item.id), 300);
        }}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-onSurface/[0.12] transition-colors shrink-0"
        aria-label="بستن"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>
    </div>
  );
}
