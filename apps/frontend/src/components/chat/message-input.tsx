"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { IconSend, IconStop } from "@/lib/icons";

const DRAFT_PREFIX = "legalir-draft-";

function getDraftKey(conversationId?: string): string {
  return conversationId ? `${DRAFT_PREFIX}${conversationId}` : `${DRAFT_PREFIX}new`;
}

function loadDraft(conversationId?: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(getDraftKey(conversationId)) ?? "";
}

function saveDraft(conversationId: string | undefined, value: string): void {
  if (typeof window === "undefined") return;
  if (value.trim()) {
    localStorage.setItem(getDraftKey(conversationId), value);
  } else {
    localStorage.removeItem(getDraftKey(conversationId));
  }
}

interface MessageInputProps {
  conversationId?: string;
  onSend: (content: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
}

export function MessageInput({
  conversationId,
  onSend,
  onStop,
  disabled = false,
  isGenerating = false,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialized = useRef(false);

  // Load draft
  useEffect(() => {
    if (!initialized.current) {
      const draft = loadDraft(conversationId);
      if (draft) {
        setValue(draft);
      }
      initialized.current = true;
    }
  }, [conversationId]);

  // Re-initialize when conversation changes
  useEffect(() => {
    initialized.current = false;
  }, [conversationId]);

  // Save draft on value change
  useEffect(() => {
    if (initialized.current) {
      saveDraft(conversationId, value);
    }
  }, [value, conversationId]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, [value]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isGenerating) return;
    onSend(trimmed);
    setValue("");
    if (conversationId) {
      saveDraft(conversationId, "");
    }
  }, [value, disabled, isGenerating, onSend, conversationId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex items-end gap-2 p-3 border-t border-divider bg-surface">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="سوال حقوقی خود را بنویسید..."
        disabled={disabled}
        rows={1}
        className={[
          "flex-1 resize-none rounded-medium border border-divider bg-background px-4 py-3",
          "text-bodyMedium text-onSurface placeholder:text-muted",
          "focus:outline-2 focus:outline-primary focus:border-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "leading-relaxed",
        ].join(" ")}
        aria-label="متن پیام"
        style={{ minHeight: "48px" }}
      />

      {isGenerating && onStop ? (
        <button
          onClick={onStop}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-error text-white hover:bg-error/90 transition-colors touch-target shrink-0"
          aria-label="توقف تولید"
        >
          <IconStop size={20} />
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className={[
            "w-12 h-12 flex items-center justify-center rounded-full transition-colors touch-target shrink-0",
            value.trim() && !disabled
              ? "bg-primary text-white hover:bg-primary-variant"
              : "bg-outline/10 text-muted cursor-not-allowed",
          ].join(" ")}
          aria-label="ارسال پیام"
        >
          <IconSend size={20} />
        </button>
      )}
    </div>
  );
}
