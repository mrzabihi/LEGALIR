"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  Conversation,
  Message,
  V1Reference,
  StructuredResponseSection,
  AiRunStatus,
  V1DocumentListItem,
  ProcessingRunView,
} from "@legalir/types";
import { IconArrowBack, IconEdit, IconMenu, IconClose, IconStar, IconChevronDown } from "@/lib/icons";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { DisclaimerBanner } from "./disclaimer-banner";
import { EscalationCta } from "./escalation-cta";
import { LegalRequestProgress } from "./legal-request-progress";
import { ConnectionStatus } from "./connection-status";
import { useRouter } from "next/navigation";
import { TextField } from "@legalir/ui";

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
  /** Retry a failed USER message by re-sending its exact content (§9). */
  onRetryMessage?: (messageId: string) => void;
  onRename?: (title: string) => void;
  onCitationClick?: (reference: V1Reference) => void;
  scrollToSectionId?: string | null;
  onScrollComplete?: () => void;
  onMobileDrawerToggle?: () => void;
  isStarred?: boolean;
  onToggleStar?: () => void;
  onMinimize?: () => void;
  onClose?: () => void;
  /**
   * The current legal request's processing run — live while streaming, or
   * restored from the backend after a refresh. Rendered as an in-conversation
   * timeline entry that persists after the run finishes (§11, §18).
   */
  processingRun?: ProcessingRunView | null;
  /**
   * The id of the user message the in-flight progress line sits under. The
   * line is rendered as that message's trailing element so it visually
   * belongs to the turn that produced it (§5).
   */
  progressingMessageId?: string | null;
  /** Retry a failed run (only offered when the run is retryable). */
  onPipelineRetry?: () => void;
  /** Context-aware composer placeholder, derived from the service (§10). */
  composerPlaceholder?: string;
  /** Documents attached to the next message (composer tray). */
  attachedDocuments?: V1DocumentListItem[];
  onAttachedDocumentsChange?: (documents: V1DocumentListItem[]) => void;
  /** Open a document attached to a sent message in the existing viewer. */
  onAttachmentClick?: (documentId: string) => void;
  /** Where to return after uploading a new document (the chat URL). */
  returnTo?: string;
  /** One-shot composer prefill (e.g. a question about a specific finding). */
  composerInitialValue?: string;
}

export function ConversationWorkspace({
  conversation,
  messages,
  isStreaming = false,
  runStatus,
  onSendMessage,
  onStopGeneration,
  onRetryMessage,
  onRename,
  onCitationClick,
  scrollToSectionId,
  onScrollComplete,
  onMobileDrawerToggle,
  isStarred = false,
  onToggleStar,
  onMinimize,
  onClose,
  processingRun,
  progressingMessageId,
  onPipelineRetry,
  composerPlaceholder,
  attachedDocuments,
  onAttachedDocumentsChange,
  onAttachmentClick,
  returnTo,
  composerInitialValue,
}: ConversationWorkspaceProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conversation.title);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Auto-scroll only when the user is already at the bottom. If they have
  // scrolled up to read earlier text, we never yank them back down — instead
  // a «رفتن به پاسخ جدید» button appears (§23).
  const [atBottom, setAtBottom] = useState(true);
  const lastMessageStatus = messages[messages.length - 1]?.status;
  // The last message's content length grows chunk-by-chunk while streaming —
  // watching it keeps the view pinned to the growing reply, but only when the
  // user is already at the bottom (§4: never yank a user who scrolled up).
  const lastContentLength = messages[messages.length - 1]?.content?.length ?? 0;

  // The message the progress line belongs under: the live turn's user message
  // while a run is in flight, or the most recent user message when the run was
  // restored from the backend after a refresh (§5, §8).
  const lastUserId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === "user") return messages[i]!.id;
    }
    return null;
  })();
  const progressTargetId = processingRun
    ? progressingMessageId ?? lastUserId
    : null;

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance < 80);
  }, []);

  useEffect(() => {
    if (atBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, lastMessageStatus, lastContentLength, atBottom]);

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
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-hover transition-colors touch-target shrink-0 tablet:hidden"
          aria-label="بازگشت به لیست گفتگوها"
        >
          <IconArrowBack size={20} />
        </button>

        {/* Mobile: conversations menu toggle */}
        {onMobileDrawerToggle && (
          <button
            onClick={onMobileDrawerToggle}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-hover transition-colors touch-target shrink-0 tablet:hidden"
            aria-label="نمایش لیست گفتگوها"
          >
            <IconMenu size={20} />
          </button>
        )}

        {isRenaming ? (
          <div className="flex-1 flex items-center gap-2">
            <TextField
              label="نام گفتگو"
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setIsRenaming(false);
              }}
              onBlur={handleRename}
              inputSize="small"
              autoFocus
              fullWidth
            />
          </div>
        ) : (
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <h1 className="text-titleSmall text-onSurface truncate">
              {conversation.title}
            </h1>
            <button
              onClick={() => setIsRenaming(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-hover transition-colors shrink-0 touch-target"
              aria-label="تغییر نام گفتگو"
            >
              <IconEdit size={14} className="text-muted" />
            </button>
          </div>
        )}

        {/* Real connection status — the device's network state AND a real
            health check of the chat service (§6). */}
        <ConnectionStatus />

        {/* Star / bookmark conversation */}
        {onToggleStar && (
          <button
            onClick={onToggleStar}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-hover transition-colors touch-target shrink-0"
            aria-label={isStarred ? "حذف از نشان‌ها" : "نشان کردن گفتگو"}
            title={isStarred ? "حذف نشان" : "نشان کردن"}
          >
            <IconStar
              size={18}
              className={isStarred ? "text-warning fill-warning" : "text-muted"}
            />
          </button>
        )}

        {/* Minimize button (desktop only) */}
        {onMinimize && (
          <button
            onClick={onMinimize}
            className="hidden tablet:flex w-10 h-10 items-center justify-center rounded-full hover:bg-surface-hover transition-colors touch-target shrink-0"
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
          className="hidden tablet:flex w-10 h-10 items-center justify-center rounded-full hover:bg-error-container hover:text-error transition-colors touch-target shrink-0"
          aria-label="بستن گفتگو"
          title="بستن"
        >
          <IconClose size={18} className="text-muted" />
        </button>
      </header>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {/* One simple, centered message column (§2) — the conversation text
            leads; nothing is wrapped in nested cards or panels. */}
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="mb-4 text-4xl">&#x2696;&#xFE0F;</div>
              <h3 className="mb-2 text-h3 text-onSurface">
                گفتگوی حقوقی خود را شروع کنید
              </h3>
              <p className="mb-6 max-w-md text-bodyMedium text-muted">
                سوال حقوقی خود را مطرح کنید. هوش مصنوعی LEGALIR تحلیل اولیه، ریسک‌ها و اقدامات پیشنهادی را ارائه می‌دهد.
              </p>
              <DisclaimerBanner />
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                // Only the assistant message currently receiving real chunks
                // is "streaming" (§4) — a persisted message never is.
                const isAssistantStreaming =
                  msg.role === "assistant" && msg.status === "streaming";
                const showProgress = progressTargetId === msg.id;
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isStreaming={isAssistantStreaming}
                    runStatus={isAssistantStreaming ? runStatus : null}
                    onRetry={
                      msg.status === "failed" && onRetryMessage
                        ? () => onRetryMessage(msg.id)
                        : undefined
                    }
                    onCitationClick={onCitationClick}
                    onAttachmentClick={onAttachmentClick}
                    scrollToSectionId={scrollToSectionId}
                    onScrollComplete={onScrollComplete}
                    trailing={
                      showProgress && processingRun ? (
                        <LegalRequestProgress
                          run={processingRun}
                          isStreaming={isStreaming}
                          onCancel={onStopGeneration}
                          onRetry={onPipelineRetry}
                          compact
                        />
                      ) : undefined
                    }
                  />
                );
              })}

              {/* Escalation after messages — proposes lawyers for the topic. */}
              {!isStreaming && (
                <div className="mt-4">
                  <EscalationCta category={conversation.category} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Jump-to-latest — shown only when the user has scrolled up while a
          response is streaming, so they are never force-scrolled (§23). */}
      {!atBottom && isStreaming && (
        <div className="relative">
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute -top-12 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border border-divider bg-surface px-3 py-1.5 text-caption text-onSurface shadow-elevation-2 transition hover:bg-surface-hover"
          >
            <IconChevronDown size={14} />
            رفتن به پاسخ جدید
          </button>
        </div>
      )}

      {/* Input */}
      <MessageInput
        conversationId={conversation.id}
        onSend={onSendMessage}
        onStop={onStopGeneration}
        disabled={conversation.status === "archived"}
        isGenerating={isStreaming}
        placeholder={composerPlaceholder}
        attachedDocuments={attachedDocuments}
        onAttachedDocumentsChange={onAttachedDocumentsChange}
        returnTo={returnTo}
        initialValue={composerInitialValue}
      />
    </div>
  );
}
