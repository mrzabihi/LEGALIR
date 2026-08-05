"use client";

import React, { useState, useRef, useCallback } from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "start" | "end";
  delay?: number;
}

const positionClasses = {
  top: "bottom-full start-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full start-1/2 -translate-x-1/2 mt-2",
  start: "end-full top-1/2 -translate-y-1/2 me-2",
  end: "start-full top-1/2 -translate-y-1/2 ms-2",
};

export function Tooltip({ content, children, position = "top", delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    setVisible(false);
  }, []);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={[
            "absolute z-50 px-2 py-1 rounded-small",
            "bg-inverseSurface text-inverseOnSurface",
            "text-labelSmall whitespace-nowrap",
            "shadow-elevation-2",
            "animate-fade-in pointer-events-none",
            positionClasses[position],
          ].join(" ")}
        >
          {content}
        </span>
      )}
    </span>
  );
}
