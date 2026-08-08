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
} from "@/lib/icons";

// ============================================================
// CONTEXT-BASED SUGGESTION CHIPS
// ============================================================

const SUGGESTIONS: Record<PageContext, string[]> = {
  dashboard: [
    "چطور یک قرارداد را بررسی کنم؟",
    "وضعیت پرونده من چیست؟",
    "یک اظهارنامه جدید می‌خواهم",
  ],
  chat: ["تحلیل دقیق‌تر", "ارجاع به وکیل", "ذخیره این گفتگو"],
  contracts: [
    "بررسی ریسک قرارداد",
    "مقایسه نسخه‌ها",
    "مشکلات رایج قرارداد",
  ],
  documents: ["تحلیل این سند", "استخراج بندهای مهم", "خلاصه‌سازی سند"],
  settings: ["تغییر تنظیمات حساب", "تنظیمات زبان", "حریم خصوصی"],
  history: ["مشاهده تاریخچه", "فیلتر بر اساس تاریخ", "خروجی تاریخچه"],
  new: ["ساخت قرارداد جدید", "شروع بررسی سند", "ایجاد پرونده جدید"],
  subscription: [
    "ارتقای اشتراک",
    "مقایسه پلن‌ها",
    "وضعیت پرداخت من",
  ],
  profile: ["ویرایش پروفایل", "تغییر شماره موبایل", "احراز هویت"],
  memory: ["پاک کردن حافظه", "آموزش دستیار", "ذخیره اطلاعات جدید"],
};

const DEFAULT_SUGGESTIONS: string[] = [
  "چطور می‌توانید کمک کنید؟",
  "چه خدماتی دارید؟",
  "مشاوره حقوقی می‌خواهم",
];

function getSuggestions(context?: string): string[] {
  if (!context) return DEFAULT_SUGGESTIONS;
  return SUGGESTIONS[context as PageContext] ?? DEFAULT_SUGGESTIONS;
}

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
};

function getWelcomeMessage(context?: string): string {
  const pageLabel = context ? CONTEXT_LABELS[context] ?? "صفحه جاری" : "صفحه جاری";
  return `سلام! 👋 من دستیار هوشمند LEGALIR هستم. شما در بخش **${pageLabel}** قرار دارید. چطور می‌توانم کمک کنم؟`;
}

// ============================================================
// QUICK ACTION BUTTONS
// ============================================================

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  variant?: "primary" | "secondary" | "outline";
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
// ASSISTANT PANEL COMPONENT
// ============================================================

interface AiAssistantPanelProps {
  pageContext?: string;
}

function AiAssistantPanel({ pageContext }: AiAssistantPanelProps) {
  const { messages, addMessage, closePanel } = useAssistantStore();
  const [inputValue, setInputValue] = useState("");
  const [hasSentMessage, setHasSentMessage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const suggestions = getSuggestions(pageContext);
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

    // Simulate assistant response after a short delay
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

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      addMessage({ role: "user", content: suggestion, context: pageContext });
      setHasSentMessage(true);

      setTimeout(() => {
        addMessage({
          role: "assistant",
          content:
            "سوال خوبی پرسیدید! برای تحلیل دقیق‌تر، می‌توانید به صفحه گفت‌وگوی حقوقی مراجعه کنید.",
          context: pageContext,
        });
      }, 1200);
    },
    [addMessage, pageContext]
  );

  const handleGoToChat = useCallback(() => {
    closePanel();
    router.push("/chat");
  }, [closePanel, router]);

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

  const quickActions: QuickAction[] = [
    {
      label: "کمک",
      icon: <IconInfo size={16} />,
      action: () => handleQuickAction("help"),
      variant: "outline",
    },
    {
      label: "گزارش مشکل",
      icon: <IconWarning size={16} />,
      action: () => handleQuickAction("report"),
      variant: "outline",
    },
    {
      label: "راهنما",
      icon: <IconArrowForward size={16} />,
      action: () => handleQuickAction("help"),
      variant: "outline",
    },
  ];

  return (
    <div className="flex flex-col h-full bg-surface" dir="rtl">
      {/* Panel Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-divider bg-primary">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-secondary-400 flex items-center justify-center">
            <AiSparkleIcon size={18} />
          </div>
          <div>
            <h2 className="text-body-2 font-medium text-neutral-0">
              دستیار هوشمند LEGALIR
            </h2>
            <p className="text-caption text-secondary-200">
              نسخه آزمایشی
            </p>
          </div>
        </div>
        <button
          onClick={closePanel}
          className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-0 hover:bg-primary-600 transition-colors touch-target"
          aria-label="بستن دستیار هوشمند"
        >
          <IconClose size={20} />
        </button>
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

        {/* Suggestion Chips (shown when no messages sent yet) */}
        {!hasSentMessage && messages.length === 0 && (
          <div className="space-y-2 animate-slide-up-fade" style={{ animationDelay: "100ms" }}>
            <p className="text-caption text-muted px-1">
              پیشنهادها:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="inline-flex items-center px-3 py-2 rounded-full border border-secondary-300 text-bodySmall text-secondary-700 hover:bg-secondary-50 active:bg-secondary-100 transition-colors touch-target-min"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, index) => {
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
        {quickActions.map((qa) => (
          <button
            key={qa.label}
            onClick={qa.action}
            className="flex items-center gap-1.5 px-3 py-2 rounded-medium border border-outline-variant text-bodySmall text-onSurfaceVariant hover:bg-surface hover:text-onSurface transition-colors touch-target-min"
            aria-label={qa.label}
          >
            {qa.icon}
            <span className="hidden tablet:inline">{qa.label}</span>
          </button>
        ))}
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
// FLOATING ACTION BUTTON COMPONENT
// ============================================================

interface AiAssistantFABProps {
  onClick: () => void;
  isOpen: boolean;
  unreadCount: number;
}

function AiAssistantFAB({ onClick, isOpen, unreadCount }: AiAssistantFABProps) {
  return (
    <button
      onClick={onClick}
      className={[
        "fixed bottom-6 end-6 z-40",
        "w-14 h-14 rounded-full",
        "bg-primary-700 text-secondary-400",
        "shadow-elevation-8 hover:shadow-elevation-16",
        "flex items-center justify-center",
        "hover:bg-primary-800 active:bg-primary-900",
        "transition-all duration-medium1 ease-emphasized",
        "touch-target",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        // Subtle pulsing glow when not open
        !isOpen ? "animate-glow" : "",
      ].join(" ")}
      aria-label={isOpen ? "بستن دستیار هوشمند" : "باز کردن دستیار هوشمند"}
      aria-expanded={isOpen}
    >
      {isOpen ? (
        <IconClose size={24} className="text-secondary-400" />
      ) : (
        <AiSparkleIcon size={26} />
      )}

      {/* Unread badge */}
      {!isOpen && unreadCount > 0 && (
        <span className="absolute -top-1 -end-1 min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-error text-onError text-[11px] font-bold px-1.5 animate-slide-up-fade">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}

      <span className="sr-only">
        دستیار هوشمند LEGALIR{unreadCount > 0 ? ` — ${unreadCount} پیام خوانده‌نشده` : ""}
      </span>
    </button>
  );
}

// ============================================================
// MAIN AI ASSISTANT EXPORT
// ============================================================

export interface AiAssistantProps {
  /** Identifies the current page context for contextual suggestions */
  pageContext?: string;
}

export function AiAssistant({ pageContext }: AiAssistantProps) {
  const { isOpen, toggleOpen, closePanel, unreadCount } =
    useAssistantStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const [hasOpened, setHasOpened] = useState(false);

  // Track whether the panel has ever been opened (for entrance animation)
  useEffect(() => {
    if (isOpen && !hasOpened) {
      setHasOpened(true);
    }
  }, [isOpen, hasOpened]);

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
      {/* FAB Button */}
      <AiAssistantFAB
        onClick={toggleOpen}
        isOpen={isOpen}
        unreadCount={unreadCount}
      />

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
          // Desktop: slide-in from end (RTL: from left/start)
          "desktop:inset-y-0 desktop:end-0 desktop:w-[380px] desktop:shadow-elevation-16",
          "desktop:border-s desktop:border-divider",
          // Mobile: bottom sheet
          "max-desktop:inset-x-0 max-desktop:bottom-0 max-desktop:h-[80dvh] max-desktop:rounded-t-large max-desktop:shadow-elevation-24",
          // Animation classes
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
