"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useConversation,
  useConversations,
  useUpdateConversation,
  useConversationReferences,
  useChatTools,
} from "@/hooks/useConversations";
import { useDailyQuota } from "@/hooks/useDashboard";
import { useDocumentDetail } from "@/hooks/useDocuments";
import { QuotaExhaustedModal } from "@/features/quota-exhausted";
import { ConversationWorkspace } from "@/components/chat/conversation-workspace";
import { ConversationList } from "@/components/chat/conversation-list";
import { ServiceContextCard } from "@/components/chat/service-context-card";
import { SourceDetailDrawer } from "@/components/chat/source-detail-drawer";
import { signalApiReachable } from "@/components/chat/connection-status";
import { ReferencesTab } from "@/components/chat/references-tab";
import { SourcesTab } from "@/components/chat/sources-tab";
import { ConversationDocumentsTab } from "@/components/chat/conversation-documents-tab";
import { Button, Tabs } from "@legalir/ui";
import { IconClose } from "@/lib/icons";
import { streamChat } from "@/lib/ai/stream-client";
import type { PipelineProgress } from "@/lib/ai/stream-client";
import type { ProcessingRunView } from "@legalir/types";
import {
  createLiveRun,
  applyPipelineEvent,
  completeLiveRun,
  failLiveRun,
  cancelLiveRun,
} from "@/lib/ai/pipeline/live-run";
import {
  createLiveTurn,
  applyChunk,
  applyRunId,
  completeTurn,
  failTurn,
  cancelTurn,
  mergeTurn,
  isTurnFullyPersisted,
  type LiveTurn,
} from "@/lib/ai/live-turn";
import { serviceTypeFromQuery, composerPlaceholder, type ServiceType } from "@/lib/ai/service-context";
import { takePastedReview } from "@/lib/contracts/pasted-review";
import { PageContextHeader } from "@/components/shared";
import { DocumentViewer } from "@/components/documents/document-viewer";
import type {
  V1Reference,
  AiRunStatus,
  V1DocumentListItem,
  SubscriptionUsageSummary,
  ChatToolId,
  FollowUpAnswer,
  FollowUpQuestion,
} from "@legalir/types";

export default function ConversationPage() {
  const params = useParams();
  const id = params?.["id"] as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Data
  const { data: conversationDetail, isLoading: detailLoading } = useConversation(id);
  const { data: conversations = [], isLoading: convsLoading, error: convsError, refetch: refetchConvs } = useConversations();
  const { data: references = [] } = useConversationReferences(id);
  const { data: quota } = useDailyQuota();

  // Mutations
  const updateMutation = useUpdateConversation();
  const archiveMutation = useUpdateConversation();

  // UI state
  const [isStreaming, setIsStreaming] = useState(false);
  const [runStatus, setRunStatus] = useState<AiRunStatus | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedSourceQuote, setSelectedSourceQuote] = useState<string | null>(null);
  const [scrollToSectionId, setScrollToSectionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType>("legal_consultation");
  // Tool availability and the persisted selection come from the server —
  // never from a hard-coded client list (§7).
  const { data: chatTools } = useChatTools(serviceType, id);
  // The tools this turn will actually ask the backend to run.
  const [selectedToolIds, setSelectedToolIds] = useState<ChatToolId[]>([]);
  // The last tool the server refused, with its real reason (shown, not swallowed).
  const [toolRejection, setToolRejection] = useState<{ id: string; reasonFa: string } | null>(null);
  // The follow-ups the backend is genuinely waiting on (§8). Restored from the
  // persisted workflow, then kept in step with each real turn's events.
  const [followUps, setFollowUps] = useState<FollowUpQuestion[]>([]);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [exhaustedCode, setExhaustedCode] = useState<string | null>(null);
  const [exhaustedUsage, setExhaustedUsage] = useState<SubscriptionUsageSummary | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // Documents attached to the next message (composer tray).
  const [attachedDocuments, setAttachedDocuments] = useState<V1DocumentListItem[]>([]);
  // Document opened from a message's attachment card (existing viewer).
  const [viewerDocumentId, setViewerDocumentId] = useState<string | null>(null);
  // One-shot composer prefill, set when the user arrives from a context
  // that already knows the question (e.g. «درباره این یافته سؤال کنید»).
  const [composerInitialValue, setComposerInitialValue] = useState<string | undefined>(undefined);

  // The single legal-request state machine (§51). One run object, advanced
  // only by backend events — never by a client-side timer (§33). It is
  // restored from the persisted run on load so a refresh keeps the timeline.
  const [processingRun, setProcessingRun] = useState<ProcessingRunView | null>(null);

  // The live turn: the optimistic user message + the incrementally streaming
  // assistant reply. Non-null only while a turn is in flight (or failed and
  // awaiting a retry). It is merged with the persisted messages for rendering.
  const [liveTurn, setLiveTurn] = useState<LiveTurn | null>(null);

  const handlePipelineEvent = useCallback((p: PipelineProgress) => {
    setProcessingRun((prev) => applyPipelineEvent(prev ?? createLiveRun(id), p));
    // The backend run id is the trace id — keep it on the turn so a support
    // engineer can follow a failure end-to-end (frontend → backend) (§8).
    if (p.requestId) {
      setLiveTurn((prev) => (prev ? applyRunId(prev, p.requestId) : prev));
    }
  }, [id]);

  // Derive service context from the entry URL (?service= / ?category=). When
  // the backend has already recorded a service for this conversation, that
  // record wins: it is what the last turn actually ran with, so a refresh or
  // a hand-edited URL can never silently switch the service (§2, §3).
  useEffect(() => {
    const persisted = conversationDetail?.serviceType;
    if (persisted) {
      setServiceType(persisted as ServiceType);
      return;
    }
    if (typeof window !== "undefined") {
      setServiceType(serviceTypeFromQuery(window.location.search));
    }
  }, [id, conversationDetail?.serviceType]);

  // Adopt the server's projection of the selection. It is already filtered to
  // the tools this service may use, so a tampered client value never sticks.
  const serverToolKey = chatTools?.selected.join("|") ?? "";
  useEffect(() => {
    setSelectedToolIds(chatTools?.selected ?? []);
  }, [serverToolKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore the open follow-ups from the persisted workflow so a refresh does
  // not lose the questions the backend is still waiting on (§8, §11).
  useEffect(() => {
    const restored = conversationDetail?.workflow?.pendingFollowUps;
    if (Array.isArray(restored) && restored.length > 0) {
      setFollowUps(restored);
    }
  }, [conversationDetail?.workflow]);

  // Restore the processing timeline from the persisted run (§37, §43). A run
  // that was still in flight when the page was refreshed is shown as-is —
  // the UI never replays a fake animation from the start.
  useEffect(() => {
    const restored = conversationDetail?.processingRun ?? null;
    if (restored) setProcessingRun(restored);
  }, [conversationDetail?.processingRun]);

  // Returning from the upload flow with a freshly-created document: pre-select
  // it in the composer tray (but never auto-send — the user stays in control).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const attachedId = params.get("attachedDocumentId");
    if (!attachedId) return;
    setAttachedDocuments((prev) =>
      prev.some((d) => d.id === attachedId)
        ? prev
        : [
            ...prev,
            {
              id: attachedId,
              name: params.get("attachedDocumentName") ?? "سند پیوست",
              mime: params.get("attachedDocumentMime") ?? "",
              sizeBytes: Number(params.get("attachedDocumentSize") ?? 0),
              status: "ready",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              riskLevel: null,
              findingCount: 0,
            },
          ]
    );
    // Strip the one-shot params so a refresh does not re-add the document.
    params.delete("attachedDocumentId");
    params.delete("attachedDocumentName");
    params.delete("attachedDocumentMime");
    params.delete("attachedDocumentSize");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`
    );
  }, [id]);

  // Arriving from a finding's «درباره این یافته سؤال کنید»: seed the
  // composer with the question (never auto-send), then strip the param so
  // a refresh does not re-seed it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ask = params.get("ask");
    if (!ask) return;
    setComposerInitialValue(ask);
    params.delete("ask");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`
    );
  }, [id]);

  // Arriving from /contracts/review with a PASTED contract: the text was
  // handed over through sessionStorage because it can be far too long for
  // a URL. Taking it retires the token, so a refresh cannot replay it.
  // Unlike `?ask=`, this message IS sent automatically once: the user
  // already confirmed the scope and pressed «شروع بررسی», so waiting for
  // a second send would be a silent no-op.
  const [pastedReviewMessage, setPastedReviewMessage] = useState<string | null>(null);
  const pastedReviewSent = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reviewPasted");
    if (!token) return;
    setPastedReviewMessage(takePastedReview(token));
    params.delete("reviewPasted");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`
    );
  }, [id]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [id]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileDrawerOpen]);

  // Abort any in-flight stream on unmount.
  useEffect(() => {
    return () => abortRef.current?.();
  }, []);

  // Messages from the detail response.
  const serverMessages = useMemo(
    () => conversationDetail?.messages ?? [],
    [conversationDetail?.messages]
  );

  // The merged view the workspace renders: persisted messages + the live turn
  // (the optimistic user message and the streaming assistant reply). Once the
  // refetch that follows `done` has persisted both halves, the live turn is
  // dropped so nothing is ever duplicated (§3, §4).
  const visibleMessages = useMemo(
    () => mergeTurn(serverMessages, liveTurn),
    [serverMessages, liveTurn]
  );

  useEffect(() => {
    if (liveTurn && isTurnFullyPersisted(liveTurn, serverMessages)) {
      setLiveTurn(null);
    }
  }, [liveTurn, serverMessages]);

  const convData = conversationDetail
    ? {
        id: conversationDetail.id,
        title: conversationDetail.title,
        category: conversationDetail.category,
        status: conversationDetail.status,
        riskLevel: conversationDetail.riskLevel,
        messageCount: conversationDetail.messageCount,
        createdAt: conversationDetail.createdAt,
        updatedAt: conversationDetail.updatedAt,
        userId: conversationDetail.userId,
      }
    : null;

  // The id of the user message the in-flight progress line should sit under.
  const progressingMessageId = liveTurn
    ? liveTurn.serverUserId ?? liveTurn.localUserId
    : null;

  const handleSendMessage = useCallback(
    async (content: string, followUpAnswers?: FollowUpAnswer[]) => {
      if (!id || isStreaming) return;

      setIsStreaming(true);
      setRunStatus("queued");
      // Start a fresh run for this turn — Stage 1 active, everything else
      // pending. It is advanced only by backend events from here on.
      setProcessingRun(createLiveRun(id));

      // Capture the attachments for this turn, then clear the tray so the
      // next message starts empty (the refs are persisted server-side).
      const attachmentDocumentIds = attachedDocuments.map((d) => d.id);
      const turnAttachments = attachedDocuments;
      setAttachedDocuments([]);

      // The optimistic turn, shown the instant the user sends (§3).
      setLiveTurn(
        createLiveTurn({ conversationId: id, content, attachments: turnAttachments })
      );

      const finish = (status: AiRunStatus) => {
        setIsStreaming(false);
        setRunStatus(status);
        abortRef.current = null;
        queryClient.invalidateQueries({ queryKey: ["conversation", id] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        queryClient.invalidateQueries({ queryKey: ["conversation-references", id] });
        // A message consumes one unit of the day's allowance.
        queryClient.invalidateQueries({ queryKey: ["quota", "daily"] });
        // …and 200 energy — refresh the top-bar balance badge instantly.
        queryClient.invalidateQueries({ queryKey: ["rewards", "summary"] });
        queryClient.invalidateQueries({ queryKey: ["points", "account"] });
      };

      // The real SSE path through the LEGALIR AI gateway. Everything the UI
      // shows about this turn comes from here: real chunks, real stages, and
      // the real persisted ids/sections/references on `done`.
      abortRef.current = streamChat(
        {
          conversationId: id,
          content,
          context: { serviceType },
          attachmentDocumentIds:
            attachmentDocumentIds.length > 0 ? attachmentDocumentIds : undefined,
          // The tools the user selected for THIS turn. The gateway validates
          // them against the service allowlist and reports back any refusal.
          toolIds: selectedToolIds.length > 0 ? selectedToolIds : undefined,
          followUpAnswers:
            followUpAnswers && followUpAnswers.length > 0 ? followUpAnswers : undefined,
        },
        {
          onStatus: (status) => setRunStatus(status),
          onChunk: (chunk) => {
            // Real incremental text — the assistant bubble grows as it arrives.
            setLiveTurn((prev) => (prev ? applyChunk(prev, chunk) : prev));
          },
          onPipeline: handlePipelineEvent,
          onContextValidated: (event) => {
            // The server has the final word on the selection: adopt exactly
            // what it accepted and surface the refusal that actually happened.
            setSelectedToolIds(event.toolIds);
            setToolRejection(event.rejectedTools[0] ?? null);
            if (event.serviceType) setServiceType(event.serviceType as ServiceType);
            queryClient.invalidateQueries({ queryKey: ["chat-tools"] });
          },
          onWorkflow: (event) => {
            // The open follow-ups are whatever the engine still waits on —
            // never a client-invented list (§8).
            setFollowUps(event.pendingFollowUps);
          },
          onDone: (done) => {
            setProcessingRun((prev) => (prev ? completeLiveRun(prev) : prev));
            setLiveTurn((prev) => (prev ? completeTurn(prev, done) : prev));
            if (Array.isArray(done.pendingFollowUps)) {
              setFollowUps(done.pendingFollowUps);
            }
            queryClient.invalidateQueries({ queryKey: ["chat-tools"] });
            // A completed real turn proves the chat service is reachable —
            // update the connection indicator from this work rather than
            // polling it (§6).
            signalApiReachable();
            finish("succeeded");
          },
          onError: (err) => {
            // Quota exhausted — show the countdown/upgrade modal. The engine
            // returns a structured code (daily credit vs a period service
            // quota) plus the live usage summary.
            if (err.code === "QUOTA_EXHAUSTED" || err.usage) {
              setExhaustedCode(err.code);
              setExhaustedUsage(err.usage ?? null);
              setQuotaModalOpen(true);
              setProcessingRun((prev) =>
                prev ? failLiveRun(prev, err.message, false) : prev
              );
              setLiveTurn((prev) => (prev ? failTurn(prev, err.message, false) : prev));
              finish("failed");
              return;
            }
            // Any other failure: keep the user message, mark it failed, and
            // offer a retry that re-sends the SAME content (§4, §9). We never
            // fall back to a second endpoint — the SSE path is the only real
            // one, so the UI stays honest about the state.
            setProcessingRun((prev) =>
              prev ? failLiveRun(prev, err.message, err.retryable) : prev
            );
            setLiveTurn((prev) =>
              prev ? failTurn(prev, err.message, err.retryable) : prev
            );
            finish("failed");
          },
        }
      );
    },
    [
      id,
      isStreaming,
      serviceType,
      selectedToolIds,
      attachedDocuments,
      queryClient,
      handlePipelineEvent,
    ]
  );

  // Send the confirmed pasted review exactly once, as soon as the
  // conversation is actually loaded. The `sent` ref makes this immune to
  // re-renders and to React strict-mode double effects, so the message can
  // never be charged or sent twice.
  useEffect(() => {
    if (!pastedReviewMessage || pastedReviewSent.current) return;
    if (!convData || isStreaming) return;
    pastedReviewSent.current = true;
    const message = pastedReviewMessage;
    setPastedReviewMessage(null);
    void handleSendMessage(message);
  }, [pastedReviewMessage, convData, isStreaming, handleSendMessage]);

  const handleStopGeneration = useCallback(() => {
    // Aborting the fetch signals the backend to record the cancellation
    // (cancelRun). The partial reply received so far is kept (§4).
    abortRef.current?.();
    abortRef.current = null;
    setProcessingRun((prev) => (prev ? cancelLiveRun(prev) : prev));
    setLiveTurn((prev) => (prev ? cancelTurn(prev) : prev));
    setRunStatus("succeeded");
    setIsStreaming(false);
  }, []);

  // Retry the failed user message by re-sending its exact content (§9).
  const handleRetryMessage = useCallback(
    (messageId: string) => {
      const failed = visibleMessages.find((m) => m.id === messageId);
      if (!failed || failed.role !== "user") return;
      // Clear the failed live turn first so a fresh one is created with the
      // same content — never two bubbles for the same message.
      setLiveTurn(null);
      void handleSendMessage(failed.content);
    },
    [visibleMessages, handleSendMessage]
  );

  const handleRename = useCallback(
    (title: string) => {
      updateMutation.mutate({ id, data: { title } });
    },
    [id, updateMutation]
  );

  // Persist the tool selection with the conversation, so a refresh (or a
  // second tab) restores exactly what the user chose (§7). The update is
  // optimistic: the chip flips instantly, then the server confirms it.
  const handleToolSelectionChange = useCallback(
    (toolIds: ChatToolId[]) => {
      setSelectedToolIds(toolIds);
      setToolRejection(null);
      updateMutation.mutate({ id, data: { toolIds } });
    },
    [id, updateMutation]
  );

  // Answers the backend is waiting on travel as both a readable message and
  // structured answers, so the next turn records real facts (§8).
  const handleFollowUpSubmit = useCallback(
    (content: string, answers: FollowUpAnswer[]) => {
      if (answers.length === 0) return;
      // Answered questions leave the panel immediately; the server's next
      // `workflow`/`done` event is the authority on what remains open.
      const answered = new Set(answers.map((a) => a.id));
      setFollowUps((prev) => prev.filter((q) => !answered.has(q.id)));
      void handleSendMessage(content, answers);
    },
    [handleSendMessage]
  );

  const handleCitationClick = useCallback((ref: V1Reference) => {
    setSelectedSourceQuote(ref.quote ?? null);
    setSelectedSourceId(ref.sourceId);
  }, []);

  const handleNavigateToSection = useCallback((sectionId: string) => {
    setScrollToSectionId(sectionId);
    setActiveTab("chat");
  }, []);

  // The documents this conversation actually carries — one per document, from
  // the backend's ownership-checked attachment refs (§9). Never a global list.
  const conversationDocuments = useMemo(() => {
    const ids = new Set<string>();
    for (const message of serverMessages) {
      for (const attachment of message.attachments ?? []) ids.add(attachment.documentId);
    }
    return ids;
  }, [serverMessages]);

  // Correct mapping per §9: «مستندات» is the user's own files, «منابع» is what
  // retrieval actually returned, and «ارجاعات» is the citation-level view.
  const tabs = [
    { value: "chat", label: "گفتگو" },
    {
      value: "sources",
      label: "منابع",
      badge:
        references.length > 0
          ? new Set(references.map((r) => r.sourceId)).size
          : undefined,
    },
    {
      value: "documents",
      label: "مستندات",
      badge: conversationDocuments.size > 0 ? conversationDocuments.size : undefined,
    },
    {
      value: "references",
      label: "ارجاعات",
      badge: references.length > 0 ? references.length : undefined,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Quota exhausted — countdown + upgrade CTA */}
      <QuotaExhaustedModal
        open={quotaModalOpen}
        onClose={() => setQuotaModalOpen(false)}
        code={exhaustedCode}
        usage={exhaustedUsage}
      />

      {/* Contextual header — service resolved from the URL */}
      <div className="px-4 tablet:px-6 pt-4 shrink-0">
        <Suspense fallback={<div className="h-16" aria-hidden="true" />}>
          <PageContextHeader className="mb-0" />
        </Suspense>
      </div>

      <div className="flex flex-1 min-h-0">
      {/* Desktop: Conversation List Sidebar */}
      <aside className="hidden tablet:flex flex-col w-[320px] shrink-0 border-e border-divider bg-surface h-full">
        <ConversationList
          conversations={conversations}
          isLoading={convsLoading}
          error={convsError as Error | null}
          onRetry={() => refetchConvs()}
          onArchive={(convId) =>
            archiveMutation.mutate({ id: convId, data: { status: "archived" } })
          }
          dailyUsed={quota?.used ?? 0}
          dailyLimit={quota?.total ?? 10}
          subscriptionUsed={quota?.used}
          subscriptionLimit={quota?.total}
        />
      </aside>

      {/* Main workspace */}
      <main className="flex-1 flex flex-col min-w-0">
        {detailLoading && !convData ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse space-y-4 p-8">
              <div className="h-8 bg-surfaceVariant rounded-medium w-48" />
              <div className="h-4 bg-surfaceVariant rounded-medium w-96" />
            </div>
          </div>
        ) : !convData ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <p className="text-bodyMedium text-muted">گفتگو یافت نشد</p>
          </div>
        ) : (
          <>
            {/* Service context — a slim one-line strip, not a heavy card (§2) */}
            <div className="shrink-0 px-4 pt-3">
              <ServiceContextCard serviceType={serviceType} compact />
            </div>

            {/* Tabs */}
            <div className="shrink-0">
              <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
            </div>

            {/* Chat Tab */}
            {activeTab === "chat" && (
              <div className="flex-1 flex flex-col min-h-0 relative">
                {isMinimized ? (
                  /* Minimized floating restore button */
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-bodyMedium text-muted mb-4">گفتگو جمع شده است</p>
                      <Button size="large" onClick={() => setIsMinimized(false)}>
                        بازکردن گفتگو
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ConversationWorkspace
                    conversation={convData}
                    messages={visibleMessages}
                    isStreaming={isStreaming}
                    runStatus={runStatus}
                    onSendMessage={handleSendMessage}
                    onStopGeneration={handleStopGeneration}
                    onRetryMessage={handleRetryMessage}
                    onRename={handleRename}
                    onCitationClick={handleCitationClick}
                    scrollToSectionId={scrollToSectionId}
                    onScrollComplete={() => setScrollToSectionId(null)}
                    onMobileDrawerToggle={() => setMobileDrawerOpen(true)}
                    isStarred={isStarred}
                    onToggleStar={() => setIsStarred((s) => !s)}
                    onMinimize={() => setIsMinimized(true)}
                    onClose={() => router.push("/chat")}
                    processingRun={processingRun}
                    progressingMessageId={progressingMessageId}
                    onPipelineRetry={() => {
                      if (liveTurn && liveTurn.retryable) {
                        handleRetryMessage(liveTurn.serverUserId ?? liveTurn.localUserId);
                      }
                    }}
                    composerPlaceholder={composerPlaceholder(serviceType)}
                    attachedDocuments={attachedDocuments}
                    onAttachedDocumentsChange={setAttachedDocuments}
                    onAttachmentClick={setViewerDocumentId}
                    returnTo={`/chat/${id}`}
                    composerInitialValue={composerInitialValue}
                    tools={chatTools?.tools ?? []}
                    selectedToolIds={selectedToolIds}
                    onToolSelectionChange={handleToolSelectionChange}
                    toolRejection={toolRejection}
                    followUps={followUps}
                    onFollowUpSubmit={handleFollowUpSubmit}
                  />
                )}
              </div>
            )}

            {/* References Tab */}
            {activeTab === "references" && (
              <div className="flex-1 overflow-y-auto">
                <ReferencesTab
                  references={references}
                  isLoading={detailLoading}
                  onReferenceClick={handleCitationClick}
                  onNavigateToSection={handleNavigateToSection}
                />
              </div>
            )}

            {/* Sources Tab — only what retrieval actually returned */}
            {activeTab === "sources" && (
              <div className="flex-1 overflow-y-auto">
                <SourcesTab
                  references={references}
                  isLoading={detailLoading}
                  onSourceClick={(sourceId) => {
                    setSelectedSourceQuote(null);
                    setSelectedSourceId(sourceId);
                  }}
                />
              </div>
            )}

            {/* Documents Tab — only this conversation's own attachments */}
            {activeTab === "documents" && (
              <div className="flex-1 overflow-y-auto">
                <ConversationDocumentsTab
                  messages={visibleMessages}
                  isLoading={detailLoading}
                  onOpenDocument={setViewerDocumentId}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Source Detail Drawer */}
      <SourceDetailDrawer
        sourceId={selectedSourceId}
        highlightQuote={selectedSourceQuote}
        onClose={() => {
          setSelectedSourceId(null);
          setSelectedSourceQuote(null);
        }}
      />

      {/* Attached-document viewer — reuses the existing DocumentViewer. */}
      {viewerDocumentId && (
        <AttachedDocumentViewer
          documentId={viewerDocumentId}
          onClose={() => setViewerDocumentId(null)}
        />
      )}

      {/* Mobile Conversation Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 tablet:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel — slides from right for RTL */}
          <aside
            className="absolute inset-y-0 end-0 w-[300px] max-w-[85vw] bg-surface shadow-elevation3 flex flex-col animate-slide-in-right"
            role="dialog"
            aria-modal="true"
            aria-label="لیست گفتگوها"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between p-3 border-b border-divider">
              <h2 className="text-titleSmall text-onSurface">گفتگوها</h2>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-hover transition-colors touch-target"
                aria-label="بستن منو"
              >
                <IconClose size={20} />
              </button>
            </div>
            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto">
              <ConversationList
                conversations={conversations}
                isLoading={convsLoading}
                error={convsError as Error | null}
                onRetry={() => refetchConvs()}
                onArchive={(convId) =>
                  archiveMutation.mutate({ id: convId, data: { status: "archived" } })
                }
                dailyUsed={quota?.used ?? 0}
                dailyLimit={quota?.total ?? 10}
                subscriptionUsed={quota?.used}
                subscriptionLimit={quota?.total}
              />
            </div>
          </aside>
        </div>
      )}
      </div>
    </div>
  );
}

// ============================================================
// Attached-document viewer overlay
// ============================================================
// Opens a document attached to a message in the EXISTING DocumentViewer,
// inside a modal overlay so the user never leaves the conversation.

function AttachedDocumentViewer({
  documentId,
  onClose,
}: {
  documentId: string;
  onClose: () => void;
}) {
  const { data: doc } = useDocumentDetail(documentId);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="نمایش سند پیوست"
        className="relative flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-large bg-surface shadow-elevation-3 tablet:h-[85vh]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-divider px-4 py-3">
          <h2 className="truncate text-titleSmall text-onSurface">
            {doc?.name ?? "سند پیوست"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover"
            aria-label="بستن نمایشگر"
          >
            <IconClose size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <DocumentViewer
            documentId={documentId}
            fileName={doc?.name ?? ""}
            mime={doc?.mime ?? ""}
            sizeBytes={doc?.sizeBytes ?? 0}
          />
        </div>
      </div>
    </div>
  );
}
