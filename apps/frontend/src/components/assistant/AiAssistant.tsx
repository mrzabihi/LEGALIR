"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PageContext } from "@/stores/assistant-store";
import { useAssistantStore } from "@/stores/assistant-store";
import {
  IconClose,
  IconSend,
  IconInfo,
  IconWarning,
  IconArrowForward,
  IconMinimize,
  IconStar,
} from "@/lib/icons";

// ============================================================
// WELCOME MESSAGE PER CONTEXT
// ============================================================

const CONTEXT_LABELS: Record<string, string> = {
  dashboard: "داشبورد",
  chat: "گفت‌وگو",
  contracts: "قراردادها",
  documents: "اسناد",
  settings: "تنظیمات",
  history: "تاریخچه",
  new: "ساخت جدید",
  subscription: "اشتراک",
  profile: "پروفایل",
  memory: "حافظه",
  support: "پشتیبانی",
};

function getWelcomeMessage(context?: string): string {
  const pageLabel = context ? CONTEXT_LABELS[context] ?? "صفحه جاری" : "صفحه جاری";
  return `سلام! من دستیار هوشمند LEGALIR هستم. شما در بخش **${pageLabel}** قرار دارید. چطور می‌توانم کمک کنم؟`;
}

// ============================================================
// AI SPARKLE ICON (gold-themed)
// ============================================================

function AiSparkleIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d="M12 1l1.5 5.5L19 8l-5.5 1.5L12 15l-1.5-5.5L5 8l5.5-1.5L12 1z" />
      <path
        d="M19.5 15l1 3.5 3.5 1-3.5 1-1 3.5-1-3.5-3.5-1 3.5-1 1-3.5z"
        transform="scale(0.45) translate(24 24)"
      />
      <path
        d="M19.5 15l1 3.5 3.5 1-3.5 1-1 3.5-1-3.5-3.5-1 3.5-1 1-3.5z"
        transform="scale(0.35) translate(48 48)"
      />
    </svg>
  );
}

// ============================================================
// ASSISTANT PANEL — Full chat interface
// ============================================================

export interface AiAssistantPanelProps {
  pageContext?: string;
  /** When true, renders as a full page section instead of a slide-in panel */
  mode?: "panel" | "page";
}

export function AiAssistantPanel({ pageContext, mode = "panel" }: AiAssistantPanelProps) {
  const { messages, addMessage, closePanel, minimizePanel, isMinimized, restorePanel, starredIds, toggleStar } = useAssistantStore();
  const [inputValue, setInputValue] = useState("");
  const [hasSentMessage, setHasSentMessage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const welcomeMessage = getWelcomeMessage(pageContext);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    addMessage({ role: "user", content: trimmed, context: pageContext });
    setInputValue("");
    setHasSentMessage(true);

    setTimeout(() => {
      addMessage({
        role: "assistant",
        content:
          "متوجه شدم. در حال حاضر این یک پاسخ نمایشی است. برای گفت‌وگوی کامل حقوقی، لطفاً به صفحه چت مراجعه کنید.",
        context: pageContext,
      });
    }, 1200);
  }, [inputValue, addMessage, pageContext]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleGoToChat = useCallback(() => {
    if (mode === "panel") closePanel();
    router.push("/chat");
  }, [closePanel, router, mode]);

  // Quick support actions
  const handleQuickAction = useCallback(
    (action: string) => {
      if (action === "help") {
        addMessage({
          role: "system",
          content: "راهنما: برای استفاده از چت کامل، روی دکمه 'رفتن به گفت‌وگو' کلیک کنید.",
          context: pageContext,
        });
      } else if (action === "report") {
        addMessage({
          role: "system",
          content:
            "می‌توانید مشکل خود را از طریق ایمیل support@legalir.com یا از طریق گفت‌وگوی کامل با ما در میان بگذارید.",
          context: pageContext,
        });
      }
    },
    [addMessage, pageContext]
  );

  if (mode === "panel" && isMinimized) {
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-primary border-b border-divider" dir="rtl">
        <div className="flex items-center gap-2">
          <AiSparkleIcon size={16} />
          <span className="text-caption text-neutral-0">دستیار LEGALIR</span>
        </div>
        <button
          onClick={restorePanel}
          className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-0 hover:bg-primary-600 transition-colors"
          aria-label="باز کردن دستیار"
        >
          <IconArrowForward size={16} style={{ transform: 'rotate(-90deg)' }} />
        </button>
      </div>
    );
  }

  const isPageMode = mode === "page";
  const containerClasses = isPageMode
    ? "flex flex-col h-full bg-surface rounded-xl border border-divider shadow-elevation-1 overflow-hidden"
    : "flex flex-col h-full bg-surface";

  return (
    <div className={containerClasses} dir="rtl">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-divider bg-gradient-to-l from-primary to-primary-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-secondary-400 flex items-center justify-center">
            <AiSparkleIcon size={18} />
          </div>
          <div>
            <h2 className="text-body-2 font-medium text-neutral-0">
              دستیار هوشمند LEGALIR
            </h2>
            <p className="text-caption text-primary-200">
              دسترسی سریع به راهنمایی و پشتیبانی
            </p>
          </div>
        </div>
        {!isPageMode && (
          <>
            <button
              onClick={minimizePanel}
              className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-0 hover:bg-primary-600 transition-colors touch-target"
              aria-label="جمع کردن دستیار هوشمند"
            >
              <IconMinimize size={20} />
            </button>
            <button
              onClick={closePanel}
              className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-0 hover:bg-primary-600 transition-colors touch-target"
              aria-label="بستن دستیار هوشمند"
            >
              <IconClose size={20} />
            </button>
          </>
        )}
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide"
      >
        {/* Welcome Message */}
        <div className="flex items-start gap-2 animate-slide-up-fade">
          <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center shrink-0">
            <AiSparkleIcon size={14} />
          </div>
          <div className="bg-surfaceVariant rounded-medium rounded-ts-none px-4 py-3 max-w-[85%]">
            <p className="text-bodySmall text-onSurface leading-relaxed whitespace-pre-line">
              {welcomeMessage}
            </p>
          </div>
        </div>

        {/* Messages */}
        {messages.map((msg, index) => {
          const isStarred = starredIds.includes(msg.id);
          const isUser = msg.role === "user";
          const isSystem = msg.role === "system";
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showAvatar = prevMsg?.role !== msg.role;

          if (isSystem) {
            return (
              <div
                key={msg.id}
                className="flex items-center justify-center animate-slide-up-fade"
              >
                <div className="bg-info-container text-info text-caption px-4 py-2 rounded-medium max-w-[90%] text-center">
                  <IconInfo size={14} className="inline-block me-1 align-middle" />
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2 animate-slide-up-fade ${
                isUser ? "flex-row-reverse" : ""
              }`}
            >
              {showAvatar && !isUser && (
                <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center shrink-0">
                  <AiSparkleIcon size={14} />
                </div>
              )}
              {showAvatar && isUser && (
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <span className="text-caption text-primary-700 font-medium">
                    شما
                  </span>
                </div>
              )}
              <div
                className={`px-4 py-3 max-w-[80%] ${
                  isUser
                    ? "bg-primary text-neutral-0 rounded-medium rounded-ts-none"
                    : "bg-surfaceVariant text-onSurface rounded-medium rounded-te-none"
                }`}
              >
                <p className="text-bodySmall leading-relaxed whitespace-pre-line">
                  {msg.content}
                </p>
                <button
                  onClick={() => toggleStar(msg.id)}
                  className="mt-1 flex items-center gap-1 text-caption"
                  aria-label={isStarred ? 'حذف از نشان‌ها' : 'نشان کردن پیام'}
                >
                  <IconStar size={14} className={isStarred ? 'text-secondary-400' : 'text-muted opacity-40 hover:opacity-70'} />
                </button>
                {!showAvatar && <div className="h-8" />}
              </div>
            </div>
          );
        })}

        {/* Go to Full Chat CTA */}
        {hasSentMessage && (
          <div className="text-center pt-2 animate-slide-up-fade">
            <button
              onClick={handleGoToChat}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-neutral-0 text-button hover:bg-secondary-700 transition-colors touch-target-min"
            >
              رفتن به گفت‌وگوی کامل
              <IconArrowForward size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-t border-divider bg-surfaceVariant">
        <button
          onClick={() => handleQuickAction("help")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-medium border border-outline-variant text-bodySmall text-onSurfaceVariant hover:bg-surface hover:text-onSurface transition-colors touch-target-min"
          aria-label="کمک"
        >
          <IconInfo size={16} />
          <span className="hidden tablet:inline">کمک</span>
        </button>
        <button
          onClick={() => handleQuickAction("report")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-medium border border-outline-variant text-bodySmall text-onSurfaceVariant hover:bg-surface hover:text-onSurface transition-colors touch-target-min"
          aria-label="گزارش مشکل"
        >
          <IconWarning size={16} />
          <span className="hidden tablet:inline">گزارش مشکل</span>
        </button>
      </div>

      {/* Message Input */}
      <div className="shrink-0 flex items-end gap-2 p-3 border-t border-divider bg-surface">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="سوال خود را بنویسید..."
          rows={1}
          className={[
            "flex-1 resize-none rounded-medium border border-divider bg-background px-4 py-2.5",
            "text-bodySmall text-onSurface placeholder:text-muted",
            "focus:outline-2 focus:outline-primary focus:border-primary",
            "leading-relaxed",
          ].join(" ")}
          aria-label="متن پیام"
          style={{ minHeight: "44px", maxHeight: "100px" }}
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim()}
          className={[
            "w-11 h-11 flex items-center justify-center rounded-full transition-colors touch-target shrink-0",
            inputValue.trim()
              ? "bg-primary text-white hover:bg-primary-variant"
              : "bg-outline/10 text-muted cursor-not-allowed",
          ].join(" ")}
          aria-label="ارسال پیام"
        >
          <IconSend size={20} />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN AI ASSISTANT
// No FAB — used as embedded panel in support page
// ============================================================

export interface AiAssistantProps {
  pageContext?: string;
}

export function AiAssistant({ pageContext }: AiAssistantProps) {
  const { isOpen, toggleOpen, closePanel } = useAssistantStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closePanel();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, closePanel]);

  // Prevent body scroll when panel is open on mobile
  useEffect(() => {
    if (isOpen) {
      const isMobile = window.matchMedia("(max-width: 599px)").matches;
      if (isMobile) {
        document.body.style.overflow = "hidden";
      }
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Overlay (desktop) — click outside to close */}
      {isOpen && (
        <div
          className="hidden desktop:block fixed inset-0 z-40"
          onClick={closePanel}
          aria-hidden="true"
        />
      )}

      {/* Panel — desktop: slide-in drawer; mobile: bottom sheet */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="دستیار هوشمند LEGALIR"
        className={[
          "fixed z-50",
          "bg-surface",
          "flex flex-col",
          "desktop:inset-y-0 desktop:end-0 desktop:w-[380px] desktop:shadow-elevation-16",
          "desktop:border-s desktop:border-divider",
          "max-desktop:inset-x-0 max-desktop:bottom-0 max-desktop:h-[80dvh] max-desktop:rounded-t-large max-desktop:shadow-elevation-24",
          "transition-transform duration-medium1 ease-emphasized",
          isOpen
            ? "desktop:translate-x-0 max-desktop:translate-y-0"
            : "desktop:translate-x-full max-desktop:translate-y-full",
        ].join(" ")}
      >
        <AiAssistantPanel pageContext={pageContext} />
      </div>
    </>
  );
}
