"use client";

import type { Message, V1Reference, StructuredResponseSection } from "@legalir/types";
import type { AiRunStatus } from "@legalir/types";
import { IconRetry, IconWarning } from "@/lib/icons";
import { AiRunIndicator } from "./ai-run-indicator";
import { StructuredResponse } from "./structured-response";
import { DisclaimerBanner } from "./disclaimer-banner";

interface MessageBubbleProps {
  message: Message & {
    sections?: StructuredResponseSection[];
    riskLevel?: string | null;
    references?: V1Reference[];
  };
  isStreaming?: boolean;
  runStatus?: AiRunStatus | null;
  onRetry?: () => void;
  onCitationClick?: (reference: V1Reference) => void;
  scrollToSectionId?: string | null;
  onScrollComplete?: () => void;
}

export function MessageBubble({
  message,
  isStreaming = false,
  runStatus,
  onRetry,
  onCitationClick,
  scrollToSectionId,
  onScrollComplete,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isFailed = message.status === "failed";
  const isBlocked = message.status === "blocked";
  const hasSections = isAssistant && message.sections && message.sections.length > 0;

  return (
    <div
      className={[
        "flex gap-3 animate-fade-in",
        isUser ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      {/* Assistant avatar */}
      {isAssistant && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-primary text-labelSmall font-bold" aria-hidden="true">ل</span>
        </div>
      )}

      <div
        className={[
          "max-w-[85%] tablet:max-w-[75%]",
          isUser ? "order-first" : "",
        ].join(" ")}
      >
        {/* Bubble */}
        <div
          className={[
            "rounded-large px-4 py-3",
            isUser
              ? "bg-primary text-white rounded-br-small"
              : "bg-surface border border-divider rounded-bl-small",
            isFailed || isBlocked
              ? "bg-error/[0.06] border-error/20"
              : "",
          ].join(" ")}
        >
          {/* Failed state */}
          {isFailed && (
            <div className="flex items-center gap-2 mb-2 text-error">
              <IconWarning size={16} />
              <span className="text-bodySmall">خطا در پردازش پاسخ</span>
            </div>
          )}

          {/* Blocked state */}
          {isBlocked && (
            <div className="flex items-center gap-2 mb-2 text-warning">
              <IconWarning size={16} />
              <span className="text-bodySmall">پاسخ به این درخواست امکان‌پذیر نیست</span>
            </div>
          )}

          {/* Message content */}
          <div
            className={[
              "text-bodyMedium whitespace-pre-wrap",
              isUser ? "text-white" : "text-onSurface",
              isAssistant && !hasSections ? "leading-loose legal-text" : "",
            ].join(" ")}
          >
            {message.content}
          </div>

          {/* Run indicator */}
          {runStatus && runStatus !== "succeeded" && (
            <AiRunIndicator status={runStatus} />
          )}
        </div>

        {/* Structured sections (below bubble) */}
        {hasSections && !isFailed && !isBlocked && (
          <div className="mt-1">
            <StructuredResponse
              sections={message.sections!}
              references={message.references}
              streaming={isStreaming || message.status === "streaming"}
              onCitationClick={onCitationClick}
              scrollToSectionId={scrollToSectionId}
              onScrollComplete={onScrollComplete}
            />
            <div className="mt-2">
              <DisclaimerBanner />
            </div>
          </div>
        )}

        {/* Retry button */}
        {isFailed && onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 flex items-center gap-1.5 text-bodySmall text-primary hover:text-primary-variant transition-colors touch-target px-3 py-2 rounded-medium"
            aria-label="تلاش مجدد"
          >
            <IconRetry size={14} />
            تلاش مجدد
          </button>
        )}

        {/* Timestamp */}
        <p
          className={[
            "text-bodySmall text-muted mt-1 px-1",
            isUser ? "text-end" : "text-start",
          ].join(" ")}
        >
          {new Date(message.createdAt).toLocaleTimeString("fa-IR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
          <span className="text-white text-labelSmall font-bold" aria-hidden="true">ش</span>
        </div>
      )}
    </div>
  );
}
