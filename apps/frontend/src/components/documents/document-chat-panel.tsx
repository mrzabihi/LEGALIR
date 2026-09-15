// ============================================================
// LEGALIR — Document Chat Panel
// Lets the user chat with LegalIR about a specific uploaded
// document (e.g. a rental contract). Auto-creates a conversation
// scoped to the document, streams AI responses with the document's
// text + findings injected as grounding, and offers suggested
// prompts tailored to the document.
// ============================================================

"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Message, V1Reference, StructuredResponseSection, AiRunStatus, RiskReport } from "@legalir/types";
import { createConversation, fetchConversation } from "@/lib/api/v1";
import { streamChat } from "@/lib/ai/stream-client";
import { MessageBubble } from "@/components/chat/message-bubble";
import { MessageInput } from "@/components/chat/message-input";
import { DisclaimerBanner } from "@/components/chat/disclaimer-banner";
import { RiskSummary } from "./risk-summary";
import { FindingCard } from "./finding-card";
import { IconChat } from "@/lib/icons";

interface ExtendedMessage extends Message {
  sections?: StructuredResponseSection[];
  riskLevel?: string | null;
  references?: V1Reference[];
  report?: RiskReport | null;
}

interface DocumentChatPanelProps {
  documentId: string;
  documentName: string;
  /** The document's risk analysis, rendered as LegalIR's opening comment. */
  report?: RiskReport | null;
}

// ============================================================
// Intent selection + tailored follow-up questions
// ------------------------------------------------------------
// Before LegalIR shows its analysis of the uploaded file, it asks
// the user what they want to do with the document (review legal
// issues against the constitution / fix it / edit it). Once an
// intent is chosen, follow-up questions are tailored to the
// document type the user declared (e.g. landlord/tenant for a
// rental contract).
// ============================================================

type IntentId = "review" | "fix" | "edit";
type DocumentType = "rental" | "employment" | "contracting" | "generic";

const INTENT_OPTIONS: { id: IntentId; label: string; hint: string }[] = [
  {
    id: "review",
    label: "بررسی مشکلات حقوقی طبق قانون اساسی",
    hint: "مطابقت سند با اصول قانون اساسی و قوانین موضوعه",
  },
  {
    id: "fix",
    label: "اصلاح قرارداد",
    hint: "رفع ایرادات و بندهای پرریسک",
  },
  {
    id: "edit",
    label: "ویرایش قرارداد",
    hint: "تغییر مفاد و تنظیم بندها",
  },
];

/** Infer the document type from its file name so follow-up
 *  questions can be tailored to the specific contract. */
function detectDocumentType(name: string): DocumentType {
  if (/اجاره|اجاره‌نامه|موجر|مستأجر/.test(name)) return "rental";
  if (/کار|استخدام|تعهدات بیمه/.test(name)) return "employment";
  if (/پیمانکاری|خدمات فنی/.test(name)) return "contracting";
  return "generic";
}

/** Follow-up questions per document type × intent. These are the
 *  suggested chips shown in the chat after the user picks an intent. */
const FOLLOW_UPS: Record<DocumentType, Record<IntentId, string[]>> = {
  rental: {
    review: [
      "من موجر هستم، چه نکاتی را باید رعایت کنم؟",
      "من مستأجر هستم، حقوق من چیست؟",
      "آیا شرط فسخ یک‌طرفه در این قرارداد قانونی است؟",
      "سقف افزایش اجاره طبق قانون چقدر است؟",
    ],
    fix: [
      "چطور سقف افزایش اجاره را اصلاح کنم؟",
      "شرط فسخ یک‌طرفه را چطور قانونی کنم؟",
      "مسئولیت تعمیرات را چطور شفاف کنم؟",
      "مهلت تخلیه را چطور مشخص کنم؟",
    ],
    edit: [
      "چه بندهایی را باید ویرایش کنم؟",
      "چطور مبلغ ودیعه و اجاره را تنظیم کنم؟",
      "چطور مدت قرارداد را تغییر دهم؟",
    ],
  },
  employment: {
    review: [
      "حقوق و مزایای من طبق قانون کار چیست؟",
      "آیا دوره آزمایشی این قرارداد قانونی است؟",
      "شرایط خاتمه قرارداد چه مواردی است؟",
    ],
    fix: [
      "چطور بندهای پرریسک را اصلاح کنم؟",
      "چطور شاخص‌های عملکرد را شفاف کنم؟",
    ],
    edit: [
      "چطور مدت قرارداد را ویرایش کنم؟",
      "چطور حقوق و مزایا را تنظیم کنم؟",
    ],
  },
  contracting: {
    review: [
      "آیا سقف جریمه تأخیر در این قرارداد مشخص است؟",
      "مالکیت معنوی مستندات چگونه است؟",
      "شرایط حل اختلاف چیست؟",
    ],
    fix: [
      "چطور سقف جریمه را اصلاح کنم؟",
      "چطور تعهدات طرفین را شفاف کنم؟",
    ],
    edit: [
      "چطور مبلغ قرارداد را ویرایش کنم؟",
      "چطور سطح خدمات را تنظیم کنم؟",
    ],
  },
  generic: {
    review: [
      "مشکلات حقوقی این سند چیست؟",
      "آیا این سند با قانون اساسی مطابقت دارد؟",
    ],
    fix: [
      "چطور ایرادات این سند را اصلاح کنم؟",
      "چه بندهایی نیاز به اصلاح دارند؟",
    ],
    edit: [
      "چطور این سند را ویرایش کنم؟",
      "چه بخش‌هایی را باید تغییر دهم؟",
    ],
  },
};

export function DocumentChatPanel({ documentId, documentName, report }: DocumentChatPanelProps) {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [runStatus, setRunStatus] = useState<AiRunStatus | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<IntentId | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Infer the document type from its name to tailor follow-up questions.
  const docType = useMemo(() => detectDocumentType(documentName), [documentName]);
  const followUps = selectedIntent ? FOLLOW_UPS[docType][selectedIntent] : [];

  // Build the opening assistant message from the analysis report, so the
  // analysis reads as LegalIR's first comment on the uploaded file.
  const reportMessage = useMemo<ExtendedMessage | null>(() => {
    if (!report || report.findings.length === 0) return null;
    return {
      id: "report-opening",
      conversationId: "",
      role: "assistant",
      content: report.summary,
      status: "completed",
      createdAt: report.generatedAt,
      report,
    };
  }, [report]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isStreaming]);

  // Abort any in-flight stream on unmount.
  useEffect(() => {
    return () => abortRef.current?.();
  }, []);

  // Create (or reuse) a conversation scoped to this document.
  const ensureConversation = useCallback(async () => {
    setIsInitializing(true);
    setInitError(null);
    try {
      const conv = await createConversation({
        title: `گفتگو درباره ${documentName}`,
        category: "document",
      });
      setConversationId(conv.id);
    } catch {
      setInitError("ایجاد گفتگو با خطا مواجه شد. لطفا دوباره تلاش کنید.");
    } finally {
      setIsInitializing(false);
    }
  }, [documentName]);

  useEffect(() => {
    ensureConversation();
  }, [ensureConversation]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || isStreaming) return;

      // Optimistically append the user message.
      const userMsg: ExtendedMessage = {
        id: `local-${Date.now()}`,
        conversationId,
        role: "user",
        content,
        status: "sent",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setRunStatus("queued");

      const finish = (status: AiRunStatus) => {
        setIsStreaming(false);
        setRunStatus(status);
        abortRef.current = null;
        queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      };

      abortRef.current = streamChat(
        {
          conversationId,
          content,
          context: { serviceType: "document_analysis", documentId },
        },
        {
          onStatus: (status) => setRunStatus(status),
          onDone: async (done) => {
            // Load the persisted assistant message from the conversation.
            try {
              const detail = await fetchConversation(conversationId);
              const assistantMsg = detail.messages.find((m) => m.id === done.messageId);
              if (assistantMsg) {
                setMessages((prev) => [
                  ...prev,
                  {
                    ...assistantMsg,
                    sections: done.sections,
                    references: done.references,
                  },
                ]);
              }
            } catch {
              // Fallback: append a minimal assistant message.
              setMessages((prev) => [
                ...prev,
                {
                  id: done.messageId,
                  conversationId,
                  role: "assistant",
                  content: "",
                  status: "completed",
                  createdAt: new Date().toISOString(),
                  sections: done.sections,
                  references: done.references,
                },
              ]);
            }
            finish("succeeded");
          },
          onError: () => {
            // Mark the last user message as failed so the user can retry.
            setMessages((prev) =>
              prev.map((m) =>
                m.id === userMsg.id ? { ...m, status: "failed" as const } : m
              )
            );
            finish("failed");
          },
        }
      );
    },
    [conversationId, isStreaming, documentId, queryClient]
  );

  const handleStopGeneration = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setRunStatus("failed");
    setIsStreaming(false);
  }, []);

  const handleRetry = useCallback(
    async (messageId: string) => {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const content = lastUser?.content ?? "تلاش مجدد پاسخ";
      void messageId;
      await handleSendMessage(content);
    },
    [messages, handleSendMessage]
  );

  return (
    <div className="flex flex-col rounded-large border border-divider bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-divider bg-surface-container/50">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <IconChat size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-titleSmall text-onSurface truncate">گفتگو با لیگالیر درباره این سند</h3>
          <p className="text-caption text-muted truncate">{documentName}</p>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-[280px] max-h-[420px]" role="log" aria-live="polite">
        {isInitializing ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse flex items-center gap-2 text-muted">
              <span className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
              <span className="text-bodySmall">در حال آماده‌سازی گفتگو...</span>
            </div>
          </div>
        ) : initError ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-bodySmall text-error mb-3">{initError}</p>
            <button
              onClick={ensureConversation}
              className="rounded-medium bg-primary text-white px-4 py-2 text-button font-medium hover:bg-primary-variant transition-colors touch-target"
            >
              تلاش مجدد
            </button>
          </div>
        ) : !selectedIntent ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-3xl mb-3" aria-hidden="true">&#x2696;&#xFE0F;</div>
            <h4 className="text-bodyMedium text-onSurface font-medium mb-2">
              با این سند چه کاری می‌خواهید انجام دهید؟
            </h4>
            <p className="text-bodySmall text-muted mb-4 max-w-sm">
              لیگالیر متن و تحلیل این سند را می‌خواند. ابتدا هدف خود را انتخاب کنید تا سوالات مرتبط را پیشنهاد دهد.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {INTENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedIntent(opt.id)}
                  disabled={isStreaming}
                  className="rounded-medium border border-primary/30 bg-primary-50 text-primary px-4 py-3 text-bodySmall font-medium hover:bg-primary-100 transition-colors touch-target disabled:opacity-50 text-right"
                >
                  <span className="block">{opt.label}</span>
                  <span className="block text-caption text-muted font-normal mt-0.5">{opt.hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <DisclaimerBanner />
            </div>
          </div>
        ) : (
          <>
            {/* Opening analysis message (LegalIR's comment on the file) */}
            {reportMessage && (
              <div className="flex gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary text-labelSmall font-bold" aria-hidden="true">ل</span>
                </div>
                <div className="max-w-[85%] tablet:max-w-[75%]">
                  <div className="rounded-large px-4 py-3 bg-surface border border-divider rounded-bl-small">
                    <p className="text-bodyMedium text-onSurface leading-loose legal-text">
                      {reportMessage.content}
                    </p>
                  </div>
                  {/* Risk summary + findings rendered inline as the analysis */}
                  <div className="mt-3 flex flex-col gap-3">
                    <RiskSummary report={report!} />
                    <div className="flex flex-col gap-3">
                      <h4 className="text-labelLarge text-on-surface font-medium">
                        یافته‌ها ({report!.findings.length})
                      </h4>
                      {report!.findings.map((finding) => (
                        <FindingCard key={finding.id} finding={finding} />
                      ))}
                    </div>
                  </div>
                  <div className="mt-2">
                    <DisclaimerBanner />
                  </div>
                </div>
              </div>
            )}

            {/* User + assistant messages */}
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isStreaming && msg.role === "assistant"}
                runStatus={isStreaming && msg.role === "assistant" ? runStatus : null}
                onRetry={msg.status === "failed" ? () => handleRetry(msg.id) : undefined}
              />
            ))}
          </>
        )}

        {/* Streaming indicator */}
        {isStreaming && runStatus && runStatus !== "succeeded" && (
          <div className="flex items-center gap-2 px-4 py-2 animate-pulse" aria-live="polite" role="status">
            <span className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-bodySmall text-muted">در حال پردازش...</span>
          </div>
        )}
      </div>

      {/* Tailored follow-up questions (after intent selection, before any user message) */}
      {!isInitializing && !initError && selectedIntent && messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {followUps.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSendMessage(prompt)}
              disabled={isStreaming}
              className="rounded-full border border-primary/30 bg-primary-50 text-primary px-3 py-1.5 text-caption font-medium hover:bg-primary-100 transition-colors touch-target disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <MessageInput
        conversationId={conversationId ?? undefined}
        onSend={handleSendMessage}
        onStop={handleStopGeneration}
        disabled={isInitializing || !!initError}
        isGenerating={isStreaming}
      />
    </div>
  );
}
