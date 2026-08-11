"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  Conversation,
  Message,
  V1Reference,
  StructuredResponseSection,
  AiRunStatus,
} from "@legalir/types";
import { IconArrowBack, IconEdit, IconMenu, IconClose, IconStar } from "@/lib/icons";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { DisclaimerBanner } from "./disclaimer-banner";
import { EscalationCta } from "./escalation-cta";
import { useRouter } from "next/navigation";

interface ExtendedMessage extends Message {
  sections?: StructuredResponseSection[];
  riskLevel?: string | null;
  references?: V1Reference[];
}

interface ConversationWorkspaceProps {
  conversation: Conversation;
  messages: ExtendedMessage[];
  isStreaming?: boolean;
  runStatus?: AiRunStatus | null;
  onSendMessage: (content: string) => void;
  onStopGeneration?: () => void;
  onRetry?: (messageId: string) => void;
  onRename?: (title: string) => void;
  onCitationClick?: (reference: V1Reference) => void;
  scrollToSectionId?: string | null;
  onScrollComplete?: () => void;
  onMobileDrawerToggle?: () => void;
  isStarred?: boolean;
  onToggleStar?: () => void;
  onMinimize?: () => void;
  onClose?: () => void;
}

export function ConversationWorkspace({
  conversation,
  messages,
  isStreaming = false,
  runStatus,
  onSendMessage,
  onStopGeneration,
  onRetry,
  onRename,
  onCitationClick,
  scrollToSectionId,
  onScrollComplete,
  onMobileDrawerToggle,
  isStarred = false,
  onToggleStar,
  onMinimize,
  onClose,
}: ConversationWorkspaceProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conversation.title);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Auto-scroll to bottom on new messages
  const lastMessageStatus = messages[messages.length - 1]?.status;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, lastMessageStatus]);

  const handleRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename?.(trimmed);
    }
    setIsRenaming(false);
  }, [renameValue, conversation.title, onRename]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      router.push("/chat");
    }
  }, [onClose, router]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-divider bg-surface">
        {/* Mobile: back button */}
        <button
          onClick={() => window.history.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-onSurface/[0.08] transition-colors touch-target shrink-0 tablet:hidden"
          aria-label="بازگشت به لیست گفتگوها"
        >
          <IconArrowBack size={20} />
        </button>

        {/* Mobile: conversations menu toggle */}
        {onMobileDrawerToggle && (
          <button
            onClick={onMobileDrawerToggle}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-onSurface/[0.08] transition-colors touch-target shrink-0 tablet:hidden"
            aria-label="نمایش لیست گفتگوها"
          >
            <IconMenu size={20} />
          </button>
        )}

        {isRenaming ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setIsRenaming(false);
              }}
              onBlur={handleRename}
              className="flex-1 rounded-medium border border-primary bg-background px-3 py-1.5 text-bodyMedium text-onSurface focus:outline-2 focus:outline-primary"
              autoFocus
              aria-label="نام گفتگو"
            />
          </div>
        ) : (
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <h1 className="text-titleSmall text-onSurface truncate">
              {conversation.title}
            </h1>
            <button
              onClick={() => setIsRenaming(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-onSurface/[0.08] transition-colors shrink-0 touch-target"
              aria-label="تغییر نام گفتگو"
            >
              <IconEdit size={14} className="text-muted" />
            </button>
          </div>
        )}

        {/* Star / bookmark conversation */}
        {onToggleStar && (
          <button
            onClick={onToggleStar}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-onSurface/[0.08] transition-colors touch-target shrink-0"
            aria-label={isStarred ? "حذف از نشان‌ها" : "نشان کردن گفتگو"}
            title={isStarred ? "حذف نشان" : "نشان کردن"}
          >
            <IconStar
              size={18}
              className={isStarred ? "text-yellow-500 fill-yellow-500" : "text-muted"}
            />
          </button>
        )}

        {/* Minimize button (desktop only) */}
        {onMinimize && (
          <button
            onClick={onMinimize}
            className="hidden tablet:flex w-10 h-10 items-center justify-center rounded-full hover:bg-onSurface/[0.08] transition-colors touch-target shrink-0"
            aria-label="جمع کردن گفتگو"
            title="جمع کردن"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
              <path d="M5 12h14" />
            </svg>
          </button>
        )}

        {/* Close / X button (desktop only) */}
        <button
          onClick={handleClose}
          className="hidden tablet:flex w-10 h-10 items-center justify-center rounded-full hover:bg-error/10 hover:text-error transition-colors touch-target shrink-0"
          aria-label="بستن گفتگو"
          title="بستن"
        >
          <IconClose size={18} className="text-muted" />
        </button>
      </header>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-4xl mb-4">&#x2696;&#xFE0F;</div>
            <h3 className="text-h3 text-onSurface mb-2">
              گفتگوی حقوقی خود را شروع کنید
            </h3>
            <p className="text-bodyMedium text-muted mb-6 max-w-md">
              سوال حقوقی خود را مطرح کنید. هوش مصنوعی LEGALIR تحلیل اولیه، ریسک‌ها و اقدامات پیشنهادی را ارائه می‌دهد.
            </p>
            <DisclaimerBanner />
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && msg.role === "assistant"}
              runStatus={isStreaming && msg.role === "assistant" ? runStatus : null}
              onRetry={
                msg.status === "failed" && onRetry
                  ? () => onRetry(msg.id)
                  : undefined
              }
              onCitationClick={onCitationClick}
              scrollToSectionId={scrollToSectionId}
              onScrollComplete={onScrollComplete}
            />
          ))
        )}

        {/* Streaming indicator for new messages */}
        {isStreaming && runStatus && runStatus !== "succeeded" && (
          <div className="flex items-center gap-2 px-4 py-2 animate-pulse" aria-live="polite" role="status">
            <span className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-bodySmall text-muted">در حال پردازش...</span>
          </div>
        )}

        {/* Escalation after messages */}
        {messages.length > 0 && !isStreaming && (
          <div className="mt-4">
            <EscalationCta />
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput
        conversationId={conversation.id}
        onSend={onSendMessage}
        onStop={onStopGeneration}
        disabled={conversation.status === "archived"}
        isGenerating={isStreaming}
      />
    </div>
  );
}
