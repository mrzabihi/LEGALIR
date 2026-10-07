// ============================================================
// LEGALIR — Document Chat Panel
// Lets the user chat with LegalIR about a specific uploaded
// document. It has three clearly separated modes:
//
//   1. REAL  — a model is connected: create a document-scoped
//              conversation and stream grounded answers (unchanged
//              behaviour, now gated on real connectivity).
//   2. TRIAL — a trial scenario is active: show the scenario's own
//              questions and their canned answers, locally, labelled
//              «نمونهٔ آزمایشی». Never streams, never fabricates a
//              legal answer for the user's real document.
//   3. NO-MODEL — a real document but no model: the chat is disabled
//              and honestly says so, pointing the user at the trial
//              scenarios instead of inventing answers.
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
import { TrialBadge } from "./trial-badge";
import { IconChat, IconSparkle, IconWarning } from "@/lib/icons";
import {
  TRIAL_DISCLAIMER_FA,
  type TrialScenario,
  type TrialScenarioQuestion,
} from "@/lib/documents/trial-scenarios";

interface ExtendedMessage extends Message {
  sections?: StructuredResponseSection[];
  riskLevel?: string | null;
  references?: V1Reference[];
  report?: RiskReport | null;
  /** True for a locally-appended trial message (canned answer). */
  trial?: boolean;
}

interface DocumentChatPanelProps {
  documentId: string;
  documentName: string;
  /** The document's risk analysis, rendered as LegalIR's opening comment. */
  report?: RiskReport | null;
  /**
   * A question the user asked about a specific finding (spec §12). When it
   * changes, the panel sends it automatically — so «درباره این یافته سؤال
   * کنید» lands the user in the chat with the question already asked.
   */
  pendingQuestion?: { text: string; nonce: number } | null;
  /**
   * Real model connectivity, read from the gateway health endpoint
   * (`useAiStatus`). `undefined` means "not determined yet" and is treated
   * honestly as "not connected" — we never assume a model is available.
   */
  aiConnected?: boolean;
  /** The active trial scenario, when the page is in trial mode. */
  scenario?: TrialScenario | null;
}

// ============================================================
// Intent selection + tailored follow-up questions (REAL path)
// ------------------------------------------------------------
// Once a model is connected, LegalIR asks what the user wants to do with
// the document (review legal issues against the relevant laws / fix it /
// edit it) and tailors follow-up questions to the declared document type.
//
// The review intent is deliberately NOT limited to the constitution: the
// model is asked to check the document against the *relevant* laws and the
// project's knowledge base (only mentioning the constitution where it is
// genuinely on point).
// ============================================================

type IntentId = "review" | "fix" | "edit";
type DocumentType = "rental" | "employment" | "contracting" | "generic";

const INTENT_OPTIONS: { id: IntentId; label: string; hint: string }[] = [
  {
    id: "review",
    label: "بررسی مشکلات حقوقی",
    hint: "بررسی سند بر پایه قوانین مرتبط و منابع حقوقی، هر جا لازم باشد",
  },
  {
    id: "fix",
    label: "اصلاح قرارداد",
    hint: "رفع ایرادات و بندهای پرریسک با حفظ قصد طرفین",
  },
  {
    id: "edit",
    label: "ویرایش قرارداد",
    hint: "اعمال تغییرات؛ نسخهٔ پیشنهادی جداگانه نمایش داده می‌شود",
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
      "آیا این سند با قوانین مرتبط مغایرت دارد؟",
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

export function DocumentChatPanel({
  documentId,
  documentName,
  report,
  pendingQuestion,
  aiConnected,
  scenario = null,
}: DocumentChatPanelProps) {
  const queryClient = useQueryClient();
  const isTrial = !!scenario;
  const chatEnabled = !isTrial && aiConnected === true;

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [runStatus, setRunStatus] = useState<AiRunStatus | null>(null);
  const [isInitializing, setIsInitializing] = useState(!isTrial && aiConnected === true);
  const [initError, setInitError] = useState<string | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<IntentId | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Infer the document type from its name to tailor follow-up questions.
  const docType = useMemo(() => detectDocumentType(documentName), [documentName]);
  const followUps = selectedIntent ? FOLLOW_UPS[docType][selectedIntent] : [];

  // The report shown as LegalIR's opening comment: the real document report
  // in REAL mode, or the scenario's own report in TRIAL mode.
  const effectiveReport = scenario ? scenario.report : report ?? null;

  // Build the opening assistant message from the analysis report.
  const reportMessage = useMemo<ExtendedMessage | null>(() => {
    if (!effectiveReport || effectiveReport.findings.length === 0) return null;
    return {
      id: isTrial ? "trial-opening" : "report-opening",
      conversationId: "",
      role: "assistant",
      content: effectiveReport.summary,
      status: "completed",
      createdAt: effectiveReport.generatedAt,
      report: effectiveReport,
      trial: isTrial,
    };
  }, [effectiveReport, isTrial]);

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

  // Reset local trial conversation when the scenario changes.
  useEffect(() => {
    setMessages([]);
    setSelectedIntent(null);
  }, [scenario?.id]);

  // Create (or reuse) a conversation scoped to this document — REAL path only.
  const ensureConversation = useCallback(async () => {
    if (!chatEnabled) return;
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
  }, [documentName, chatEnabled]);

  useEffect(() => {
    if (chatEnabled) ensureConversation();
  }, [ensureConversation, chatEnabled]);

  // ------------------------------------------------------------
  // REAL path — stream a grounded answer.
  // ------------------------------------------------------------
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || isStreaming || !chatEnabled) return;

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
    [conversationId, isStreaming, documentId, queryClient, chatEnabled]
  );

  // ------------------------------------------------------------
  // TRIAL path — append canned, scenario-scoped messages locally.
  // No network, no streaming, no fabricated legal answer.
  // ------------------------------------------------------------
  const appendTrialExchange = useCallback((question: string, answer: string) => {
    const now = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: `trial-q-${now}`,
        conversationId: "trial",
        role: "user",
        content: question,
        status: "sent",
        createdAt: new Date().toISOString(),
      },
      {
        id: `trial-a-${now}`,
        conversationId: "trial",
        role: "assistant",
        content: answer,
        status: "completed",
        createdAt: new Date().toISOString(),
        trial: true,
      },
    ]);
  }, []);

  const handleTrialQuestion = useCallback(
    (q: TrialScenarioQuestion) => {
      appendTrialExchange(q.questionFa, q.answerFa);
    },
    [appendTrialExchange]
  );

  const handleTrialFreeText = useCallback(
    (text: string) => {
      appendTrialExchange(
        text,
        "در حالت آزمایشی فقط پاسخ پرسش‌های پیشنهادی همین سناریو در دسترس است. برای گفتگوی آزاد با مدل، اتصال سرویس تحلیل لازم است. " +
          "یکی از پرسش‌های پیشنهادی زیر را انتخاب کنید."
      );
    },
    [appendTrialExchange]
  );

  const handleClearTrial = useCallback(() => setMessages([]), []);

  // Auto-send a question the user asked about a specific finding (spec §12).
  const lastQuestionNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!pendingQuestion) return;
    if (lastQuestionNonce.current === pendingQuestion.nonce) return;
    if (isTrial) {
      // In trial mode we cannot answer an arbitrary question truthfully.
      lastQuestionNonce.current = pendingQuestion.nonce;
      handleTrialFreeText(pendingQuestion.text);
      return;
    }
    setSelectedIntent("review");
    if (conversationId && !isStreaming && chatEnabled) {
      lastQuestionNonce.current = pendingQuestion.nonce;
      void handleSendMessage(pendingQuestion.text);
    }
  }, [
    pendingQuestion,
    conversationId,
    isStreaming,
    handleSendMessage,
    isTrial,
    handleTrialFreeText,
    chatEnabled,
  ]);

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
          <h3 className="text-titleSmall text-onSurface truncate">
            گفتگو با لیگالیر درباره این سند
          </h3>
          <p className="text-caption text-muted truncate">
            {isTrial ? scenario!.titleFa : documentName}
          </p>
        </div>
        {isTrial && (
          <button
            type="button"
            onClick={handleClearTrial}
            disabled={messages.length === 0}
            className="shrink-0 rounded-medium px-2 py-1 text-caption text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:pointer-events-none touch-target"
          >
            پاک‌کردن گفتگو
          </button>
        )}
      </div>

      {/* Trial marker strip */}
      {isTrial && (
        <div className="flex items-center gap-2 border-b border-secondary/20 bg-secondary/5 px-4 py-2">
          <TrialBadge label="نمونهٔ آزمایشی" />
          <span className="text-caption text-muted">{TRIAL_DISCLAIMER_FA}</span>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-[280px] max-h-[420px]"
        role="log"
        aria-live="polite"
      >
        {/* --- NO-MODEL state (real document, model not connected) --- */}
        {!isTrial && !chatEnabled ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <IconWarning size={24} className="text-warning" aria-hidden="true" />
            </div>
            <h4 className="text-bodyMedium text-onSurface font-medium mb-2">
              گفتگو با مدل ممکن نیست
            </h4>
            <p className="text-bodySmall text-muted mb-2 max-w-sm leading-relaxed">
              در حال حاضر اتصال به سرویس تحلیل هوشمند برقرار نیست؛ بنابراین
              نمی‌توانیم به پرسش‌های شما دربارهٔ این سند پاسخ حقوقی بدهیم.
            </p>
            <p className="text-caption text-muted max-w-sm leading-relaxed">
              تا زمان برقراری اتصال، می‌توانید یکی از سناریوهای آزمایشی را
              انتخاب کنید تا نمونهٔ نتیجه، گفتگو و پیشنهاد وکیل را ببینید.
            </p>
          </div>
        ) : isTrial ? (
          <>
            {/* Opening trial analysis message (scenario, not the user's file) */}
            {reportMessage && (
              <div className="flex gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                  <IconSparkle size={15} className="text-secondary" aria-hidden="true" />
                </div>
                <div className="max-w-[85%] tablet:max-w-[75%]">
                  <div className="rounded-large px-4 py-3 bg-surface border border-secondary/20 rounded-bl-small">
                    <p className="text-bodyMedium text-onSurface leading-loose legal-text">
                      {reportMessage.content}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    <RiskSummary report={reportMessage.report!} />
                    <div className="flex flex-col gap-3">
                      <h4 className="text-labelLarge text-on-surface font-medium">
                        یافته‌های نمونه ({reportMessage.report!.findings.length})
                      </h4>
                      {reportMessage.report!.findings.map((finding) => (
                        <FindingCard key={finding.id} finding={finding} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-1">
                <MessageBubble message={msg} isStreaming={false} runStatus={null} />
                {msg.role === "assistant" && msg.trial && (
                  <div className="self-start">
                    <TrialBadge />
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
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
                  لیگالیر متن و تحلیل این سند را می‌خواند و بر پایهٔ قوانین مرتبط
                  پاسخ می‌دهد. ابتدا هدف خود را انتخاب کنید.
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
                      <span className="block text-caption text-muted font-normal mt-0.5">
                        {opt.hint}
                      </span>
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
                      <span className="text-primary text-labelSmall font-bold" aria-hidden="true">
                        ل
                      </span>
                    </div>
                    <div className="max-w-[85%] tablet:max-w-[75%]">
                      <div className="rounded-large px-4 py-3 bg-surface border border-divider rounded-bl-small">
                        <p className="text-bodyMedium text-onSurface leading-loose legal-text">
                          {reportMessage.content}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-col gap-3">
                        <RiskSummary report={reportMessage.report!} />
                        <div className="flex flex-col gap-3">
                          <h4 className="text-labelLarge text-on-surface font-medium">
                            یافته‌ها ({reportMessage.report!.findings.length})
                          </h4>
                          {reportMessage.report!.findings.map((finding) => (
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
          </>
        )}

        {/* Streaming indicator */}
        {isStreaming && runStatus && runStatus !== "succeeded" && (
          <div
            className="flex items-center gap-2 px-4 py-2 animate-pulse"
            aria-live="polite"
            role="status"
          >
            <span className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-bodySmall text-muted">در حال پردازش...</span>
          </div>
        )}
      </div>

      {/* Trial questions — scenario-scoped, canned answers */}
      {isTrial && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          <p className="text-caption text-muted">پرسش‌های آزمایشی این سناریو:</p>
          <div className="flex flex-wrap gap-2">
            {scenario!.questions.map((q) => (
              <button
                key={q.questionFa}
                onClick={() => handleTrialQuestion(q)}
                className="rounded-full border border-secondary/30 bg-secondary/5 text-secondary-700 px-3 py-1.5 text-caption font-medium hover:bg-secondary/10 transition-colors touch-target"
              >
                {q.questionFa}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tailored follow-up questions (REAL path, after intent selection) */}
      {!isTrial && chatEnabled && !isInitializing && !initError && selectedIntent && messages.length === 0 && (
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

      {/* Input — real path only; trial/no-model modes explain themselves above */}
      {chatEnabled ? (
        <MessageInput
          conversationId={conversationId ?? undefined}
          onSend={handleSendMessage}
          onStop={handleStopGeneration}
          disabled={isInitializing || !!initError}
          isGenerating={isStreaming}
        />
      ) : (
        <div className="border-t border-divider bg-surface-container/40 px-4 py-3">
          <p className="text-caption text-muted leading-relaxed">
            {isTrial
              ? "در حالت آزمایشی، پاسخ‌ها فقط از میان پرسش‌های پیشنهادی همین سناریو ارائه می‌شوند؛ برای گفتگوی آزاد، اتصال سرویس تحلیل لازم است."
              : "ورودی گفتگو تا برقراری اتصال به سرویس تحلیل غیرفعال است."}
          </p>
        </div>
      )}
    </div>
  );
}
