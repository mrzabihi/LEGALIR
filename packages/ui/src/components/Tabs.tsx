"use client";

import React, { useCallback, useRef, useEffect, useState } from "react";

interface TabItem {
  value: string;
  label: string;
  badge?: number | string;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
}

export function Tabs({ tabs, value, onChange, variant = "primary", fullWidth = false }: TabsProps) {
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });
  const tabsRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  const updateIndicator = useCallback(() => {
    const activeEl = tabsRef.current.get(value);
    if (activeEl) {
      const parent = activeEl.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const elRect = activeEl.getBoundingClientRect();
        setIndicatorStyle({
          left: elRect.left - parentRect.left,
          width: elRect.width,
        });
      }
    }
  }, [value]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  useEffect(() => {
    updateIndicator();
  }, [value, tabs, updateIndicator]);

  return (
    <div
      className={[
        "relative flex border-b border-divider",
        variant === "secondary" ? "bg-surfaceVariant/50 rounded-medium px-1 pt-1" : "",
        fullWidth ? "w-full" : "",
      ].join(" ")}
      role="tablist"
    >
      {/* Animated indicator (only for primary variant) */}
      {variant === "primary" && (
        <div
          className="absolute bottom-0 h-0.5 bg-primary transition-all duration-short4 ease-standard rounded-full"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            transform: "translateY(0)",
          }}
        />
      )}

      {tabs.map((tab) => {
        const isActive = value === tab.value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              if (el) tabsRef.current.set(tab.value, el);
              else tabsRef.current.delete(tab.value);
            }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.value)}
            className={[
              "relative flex items-center gap-1.5 px-4 py-3",
              "text-labelLarge transition-colors duration-short3",
              "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]",
              "disabled:opacity-[0.38] disabled:pointer-events-none",
              fullWidth ? "flex-1 justify-center" : "",
              variant === "primary"
                ? isActive
                  ? "text-primary"
                  : "text-onSurfaceVariant hover:text-onSurface"
                : [
                    "rounded-small",
                    isActive
                      ? "bg-surface text-onSurface shadow-elevation-1"
                      : "text-onSurfaceVariant hover:text-onSurface",
                  ].join(" "),
            ].join(" ")}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="bg-error text-onError text-labelSmall min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
