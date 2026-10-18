"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatToolIcon, ChatToolId, ChatToolView } from "@legalir/types";
import { IconGavel, IconSearch, IconSparkle } from "@/lib/icons";

/**
 * The contextual tools bar that sits with the composer: deep analysis, legal
 * research and judicial opinions. Every state shown here comes from the
 * server (`GET /api/v1/chat/tools`): an unavailable tool is rendered as
 * unavailable WITH the server's reason, never as a pretend-active option.
 *
 * Selecting a tool is real: the selection is sent with the next message, the
 * gateway validates it against the service allowlist, and the result is
 * persisted on the conversation. A rejected tool is reported back and
 * visibly removed here.
 */

const ICONS: Record<ChatToolIcon, typeof IconSparkle> = {
  sparkle: IconSparkle,
  search: IconSearch,
  gavel: IconGavel,
};

export interface ChatToolsBarProps {
  tools: ChatToolView[];
  selected: ChatToolId[];
  onChange: (toolIds: ChatToolId[]) => void;
  /** True while the assistant is generating — selection is locked then. */
  disabled?: boolean;
  /** The reason a tool was rejected by the server (shown until dismissed). */
  rejection?: { id: string; reasonFa: string } | null;
}

export function ChatToolsBar({
  tools,
  selected,
  onChange,
  disabled = false,
  rejection = null,
}: ChatToolsBarProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dismiss the description popover on outside click / Escape, so it never
  // traps the user or covers the composer on a small screen (§14).
  useEffect(() => {
    if (!expandedId) return;
    const onDocClick = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setExpandedId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedId(null);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [expandedId]);

  const toggle = useCallback(
    (tool: ChatToolView) => {
      if (!tool.available || disabled) return;
      const isSelected = selected.includes(tool.id);
      onChange(
        isSelected ? selected.filter((id) => id !== tool.id) : [...selected, tool.id]
      );
    },
    [selected, onChange, disabled]
  );

  if (tools.length === 0) return null;

  const expanded = tools.find((t) => t.id === expandedId) ?? null;
  const rejectionTool = rejection ? tools.find((t) => t.id === rejection.id) : null;

  return (
    <div ref={containerRef} className="relative border-t border-divider bg-surface px-3 pt-2">
      {/* Scrollable on mobile, wraps on desktop. Never pushes the composer
          off-screen and never scrolls the page horizontally (§5, §14). */}
      <div
        role="group"
        aria-label="ابزارهای زمینه‌ای"
        className="flex items-center gap-2 overflow-x-auto pb-2 desktop:flex-wrap desktop:overflow-visible"
        style={{ scrollbarWidth: "thin" }}
      >
        <span className="shrink-0 text-caption text-muted ps-1">ابزارها:</span>
        {tools.map((tool) => {
          const Icon = ICONS[tool.icon] ?? IconSparkle;
          const isSelected = selected.includes(tool.id);
          const isRejected = rejection?.id === tool.id;
          const stateFa = tool.available
            ? tool.effectNoteFa
            : (tool.unavailableReasonFa ?? "در دسترس نیست");
          return (
            <span key={tool.id} className="contents">
              <button
                type="button"
                onClick={() => toggle(tool)}
                onFocus={() => setExpandedId(tool.id)}
                aria-pressed={isSelected}
                // aria-disabled rather than `disabled`: an unavailable tool must
                // stay focusable so a keyboard/screen-reader user can hear WHY
                // it is unavailable (§14). The click handler still refuses it.
                aria-disabled={!tool.available || disabled}
                aria-describedby={`chat-tool-desc-${tool.id}`}
                title={
                  tool.available
                    ? `${tool.labelFa} — ${tool.effectNoteFa}`
                    : `${tool.labelFa} — ${stateFa}`
                }
                className={[
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
                  "min-h-9 text-caption transition-colors motion-reduce:transition-none",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  isSelected
                    ? "border-primary bg-primary-container text-primary"
                    : "border-divider bg-background text-onSurface",
                  !tool.available
                    ? "opacity-60 cursor-not-allowed"
                    : disabled
                      ? "cursor-not-allowed opacity-60"
                      : "hover:bg-surface-hover active:scale-[0.98] motion-reduce:active:scale-100",
                  isRejected ? "border-error text-error" : "",
                ].join(" ")}
              >
                <Icon size={14} aria-hidden="true" />
                <span>{tool.labelFa}</span>
                {/* Selection is never conveyed by color alone (§14). */}
                {isSelected && (
                  <span aria-hidden="true" className="text-[11px] leading-none">
                    ✓
                  </span>
                )}
              </button>
              {/* Always present so `aria-describedby` resolves on focus, even
                  before the visual popover opens. */}
              <span id={`chat-tool-desc-${tool.id}`} className="sr-only">
                {`${tool.labelFa} — ${stateFa}`}
              </span>
            </span>
          );
        })}
      </div>

      {/* The popover: a short, honest description of the focused tool. It sits
          above the bar so it never covers the composer. */}
      {expanded && (
        <div
          id={`chat-tool-popover-${expanded.id}`}
          role="status"
          className="absolute bottom-full start-3 end-3 mb-1 rounded-medium border border-divider bg-surface p-3 shadow-elevation-1"
        >
          <p className="text-caption text-onSurface">{expanded.descriptionFa}</p>
          <p className="mt-1 text-caption text-muted">
            {expanded.available ? expanded.effectNoteFa : expanded.unavailableReasonFa}
          </p>
        </div>
      )}

      {/* A server rejection is stated, not silently swallowed. */}
      {rejectionTool && (
        <p role="alert" className="px-1 pb-2 text-caption text-error">
          «{rejectionTool.labelFa}» اعمال نشد: {rejection?.reasonFa}
        </p>
      )}
    </div>
  );
}
