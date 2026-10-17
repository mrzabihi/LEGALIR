"use client";

import type { ReactNode } from "react";
import { Button } from "@legalir/ui";
import type { Message, V1Reference, StructuredResponseSection } from "@legalir/types";
import type { AiRunStatus } from "@legalir/types";
import { IconRetry, IconWarning, IconCheck, IconClock } from "@/lib/icons";
import { AiRunIndicator } from "./ai-run-indicator";
import { StructuredResponse } from "./structured-response";
import { DisclaimerBanner } from "./disclaimer-banner";
import { ChatDocumentAttachment, refToAttachment } from "./chat-document-attachment";

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
  /** Open a document attached to this message in the existing viewer. */
  onAttachmentClick?: (documentId: string) => void;
  scrollToSectionId?: string | null;
  onScrollComplete?: () => void;
  /** Rendered directly under the bubble, inside the message column — used
   *  for the in-flight processing line beneath the user's message (§5). */
  trailing?: ReactNode;
}

export function MessageBubble({
  message,
  isStreaming = false,
  runStatus,
  onRetry,
  onCitationClick,
  onAttachmentClick,
  scrollToSectionId,
  onScrollComplete,
  trailing,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isFailed = message.status === "failed";
  const isBlocked = message.status === "blocked";
  const isSending = message.status === "sending";
  const hasSections = isAssistant && message.sections && message.sections.length > 0;
  const attachments = message.attachments ?? [];

  // A streaming assistant reply shows a typing caret while it is being written.
  const showCaret = isAssistant && isStreaming;

  return (
    <div
      className={[
        "flex gap-2.5 animate-fade-in motion-reduce:animate-none",
        isUser ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      {/* Assistant avatar */}
      {isAssistant && (
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container"
          aria-hidden="true"
        >
          <span className="text-labelSmall font-bold text-primary">ل</span>
        </div>
      )}

      <div className="flex max-w-[88%] flex-col tablet:max-w-[76%]">
        {/* Bubble — flat, low-contrast surfaces; the conversation text leads. */}
        {(attachments.length > 0 || message.content || isBlocked || isFailed) && (
          <div
            className={[
              "px-3.5 py-2.5",
              isUser
                ? "rounded-large rounded-ee-medium bg-primary-container text-on-primary-container"
                : "rounded-large rounded-es-medium bg-surface-container text-onSurface",
              isFailed ? "bg-error-container text-on-error-container" : "",
            ].join(" ")}
          >
            {/* Blocked state — a real backend signal, not a decoration */}
            {isBlocked && (
              <div className="mb-2 flex items-center gap-2 text-warning">
                <IconWarning size={15} />
                <span className="text-bodySmall">پاسخ به این درخواست امکان‌پذیر نیست</span>
              </div>
            )}

            {/* Attached documents — persisted refs, opened in the existing
                auth-gated viewer; shown above the message text. */}
            {attachments.length > 0 && (
              <div className={["space-y-2", message.content ? "mb-2" : ""].join(" ")}>
                {attachments.map((ref) => (
                  <ChatDocumentAttachment
                    key={ref.attachmentId}
                    variant="MESSAGE"
                    document={refToAttachment(ref)}
                    onPrimary={isUser}
                    onOpen={onAttachmentClick}
                  />
                ))}
              </div>
            )}

            {/* Message content — plain text, no per-chunk decoration. */}
            {(message.content || showCaret) && (
              <div
                className={[
                  "whitespace-pre-wrap text-bodyMedium",
                  isAssistant ? "leading-loose legal-text" : "leading-relaxed",
                ].join(" ")}
              >
                {message.content}
                {showCaret && (
                  <span
                    className="ms-0.5 inline-block h-4 w-[3px] animate-pulse rounded-full bg-primary align-middle motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
              </div>
            )}

            {/* Run indicator (legacy status line) — only for non-success. */}
            {runStatus && runStatus !== "succeeded" && !showCaret && (
              <AiRunIndicator status={runStatus} />
            )}
          </div>
        )}

        {/* Structured sections (below the bubble) — the real persisted
            sections. Rendered as plain prose, not nested cards. */}
        {hasSections && !isBlocked && (
          <div className="mt-1.5">
            <StructuredResponse
              sections={message.sections!}
              references={message.references}
              streaming={false}
              onCitationClick={onCitationClick}
              scrollToSectionId={scrollToSectionId}
              onScrollComplete={onScrollComplete}
            />
            <div className="mt-2">
              <DisclaimerBanner />
            </div>
          </div>
        )}

        {/* Failed state + retry — the user's message is never lost (§3, §9). */}
        {isFailed && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-bodySmall text-error">
              <IconWarning size={14} />
              ارسال نشد
            </span>
            {onRetry && (
              <Button
                type="button"
                variant="text"
                size="small"
                onClick={onRetry}
                startIcon={<IconRetry size={14} />}
                aria-label="تلاش مجدد برای ارسال"
                className="h-7 !px-2.5 text-caption"
              >
                تلاش مجدد
              </Button>
            )}
          </div>
        )}

        {/* Delivery status — sending / sent / timestamp. */}
        <p
          className={[
            "mt-1 flex items-center gap-1 px-1 text-caption text-muted",
            isUser ? "justify-end" : "justify-start",
          ].join(" ")}
        >
          {isUser && isSending && (
            <>
              <IconClock size={12} aria-hidden="true" />
              <span>در حال ارسال…</span>
            </>
          )}
          {isUser && !isSending && !isFailed && (
            <IconCheck size={12} className="text-success" aria-hidden="true" />
          )}
          <time dateTime={message.createdAt}>
            {new Date(message.createdAt).toLocaleTimeString("fa-IR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </p>

        {/* In-flight processing line — sits directly under the user's message,
            as the last item in the message column (§5). */}
        {trailing}
      </div>

      {/* User avatar */}
      {isUser && (
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary"
          aria-hidden="true"
        >
          <span className="text-labelSmall font-bold text-white">ش</span>
        </div>
      )}
    </div>
  );
}
