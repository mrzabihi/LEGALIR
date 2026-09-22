"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useConversation,
  useConversations,
  useSendMessage,
  useUpdateConversation,
  useConversationReferences,
  useCancelAiRun,
} from "@/hooks/useConversations";
import { useDailyQuota } from "@/hooks/useDashboard";
import { useDocumentDetail } from "@/hooks/useDocuments";
import { QuotaExhaustedModal } from "@/features/quota-exhausted";
import { ConversationWorkspace } from "@/components/chat/conversation-workspace";
import { ConversationList } from "@/components/chat/conversation-list";
import { ServiceContextCard } from "@/components/chat/service-context-card";
import { SourceDetailDrawer } from "@/components/chat/source-detail-drawer";
import { ReferencesTab } from "@/components/chat/references-tab";
import { SourcesTab } from "@/components/chat/sources-tab";
import { Tabs } from "@legalir/ui";
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
import { serviceTypeFromQuery, composerPlaceholder, type ServiceType } from "@/lib/ai/service-context";
import { PageContextHeader } from "@/components/shared";
import { DocumentViewer } from "@/components/documents/document-viewer";
import type {
  V1Reference,
  AiRunStatus,
  V1DocumentListItem,
  SubscriptionUsageSummary,
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
  const sendMutation = useSendMessage();
  const updateMutation = useUpdateConversation();
  const archiveMutation = useUpdateConversation();
  const cancelRunMutation = useCancelAiRun();

  // UI state
  const [isStreaming, setIsStreaming] = useState(false);
  const [runStatus, setRunStatus] = useState<AiRunStatus | null>(null);
  const [streamingRunId, setStreamingRunId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [scrollToSectionId, setScrollToSectionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType>("legal_consultation");
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [exhaustedCode, setExhaustedCode] = useState<string | null>(null);
  const [exhaustedUsage, setExhaustedUsage] = useState<SubscriptionUsageSummary | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // Documents attached to the next message (composer tray).
  const [attachedDocuments, setAttachedDocuments] = useState<V1DocumentListItem[]>([]);
  // Document opened from a message's attachment card (existing viewer).
  const [viewerDocumentId, setViewerDocumentId] = useState<string | null>(null);

  // The single legal-request state machine (§51). One run object, advanced
  // only by backend events — never by a client-side timer (§33). It is
  // restored from the persisted run on load so a refresh keeps the timeline.
  const [processingRun, setProcessingRun] = useState<ProcessingRunView | null>(null);

  const handlePipelineEvent = useCallback((p: PipelineProgress) => {
    setProcessingRun((prev) => applyPipelineEvent(prev ?? createLiveRun(id), p));
  }, [id]);

  // Derive service context from the entry URL (?service= / ?category=).
  useEffect(() => {
    if (typeof window !== "undefined") {
      setServiceType(serviceTypeFromQuery(window.location.search));
    }
  }, [id]);

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

  // Messages from the detail response
  const messages = useMemo(
    () => conversationDetail?.messages ?? [],
    [conversationDetail?.messages]
  );
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

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!id || isStreaming) return;

      setIsStreaming(true);
      setRunStatus("queued");
      // Start a fresh run for this turn — Stage 1 active, everything else
      // pending. It is advanced only by backend events from here on.
      setProcessingRun(createLiveRun(id));

      // Capture the attachments for this turn, then clear the tray so the
      // next message starts empty (the refs are persisted server-side).
      const attachmentDocumentIds = attachedDocuments.map((d) => d.id);
      setAttachedDocuments([]);

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

      // Primary path: real SSE streaming through the LEGALIR AI gateway.
      // Falls back to the existing message endpoint on any failure (§27).
      abortRef.current = streamChat(
        {
          conversationId: id,
          content,
          context: { serviceType },
          attachmentDocumentIds:
            attachmentDocumentIds.length > 0 ? attachmentDocumentIds : undefined,
        },
        {
          onStatus: (status) => setRunStatus(status),
          onDone: () => {
            setProcessingRun((prev) => (prev ? completeLiveRun(prev) : prev));
            finish("succeeded");
          },
          onPipeline: handlePipelineEvent,
          onError: async (err) => {
            // Quota exhausted — show the countdown/upgrade modal instead of
            // falling back to the non-streaming endpoint (which would also 429).
            // The engine returns a structured code (daily credit vs a period
            // service quota) plus the live usage summary.
            if (err.code === "QUOTA_EXHAUSTED" || err.usage) {
              setExhaustedCode(err.code);
              setExhaustedUsage(err.usage ?? null);
              setQuotaModalOpen(true);
              setProcessingRun((prev) =>
                prev ? failLiveRun(prev, err.message, false) : prev
              );
              finish("failed");
              return;
            }
            try {
              await sendMutation.mutateAsync({ conversationId: id, content });
              setProcessingRun((prev) => (prev ? completeLiveRun(prev) : prev));
              finish("succeeded");
            } catch {
              setProcessingRun((prev) =>
                prev ? failLiveRun(prev, err.message, err.retryable) : prev
              );
              finish("failed");
            }
          },
        }
      );
    },
    [id, isStreaming, serviceType, attachedDocuments, sendMutation, queryClient, handlePipelineEvent]
  );

  const handleStopGeneration = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    if (streamingRunId) {
      cancelRunMutation.mutate(streamingRunId);
    }
    setProcessingRun((prev) => (prev ? cancelLiveRun(prev) : prev));
    setRunStatus("failed");
    setIsStreaming(false);
    setStreamingRunId(null);
  }, [streamingRunId, cancelRunMutation]);

  const handleRetry = useCallback(
    async (messageId: string) => {
      if (!id) return;
      // Re-send the last user message through the streaming path.
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const content = lastUser?.content ?? "تلاش مجدد پاسخ";
      void messageId;
      await handleSendMessage(content);
    },
    [id, messages, handleSendMessage]
  );

  const handleRename = useCallback(
    (title: string) => {
      updateMutation.mutate({ id, data: { title } });
    },
    [id, updateMutation]
  );

  const handleCitationClick = useCallback((ref: V1Reference) => {
    setSelectedSourceId(ref.sourceId);
  }, []);

  const handleNavigateToSection = useCallback((sectionId: string) => {
    setScrollToSectionId(sectionId);
    setActiveTab("chat");
  }, []);

  const tabs = [
    { value: "chat", label: "گفتگو" },
    { value: "references", label: "منابع", badge: references.length > 0 ? references.length : undefined },
    { value: "sources", label: "مستندات", badge: references.length > 0 ? new Set(references.map((r) => r.sourceId)).size : undefined },
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
              <div className="h-4 bg-surfaceVariant rounded-small w-96" />
            </div>
          </div>
        ) : !convData ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <p className="text-bodyMedium text-muted">گفتگو یافت نشد</p>
          </div>
        ) : (
          <>
            {/* Service context card (§21) */}
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
                      <p className="text-body-2 text-muted mb-4">گفتگو جمع شده است</p>
                      <button
                        onClick={() => setIsMinimized(false)}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-6 py-3 text-button font-medium hover:bg-primary-700 transition-colors active:scale-[0.98] shadow-md"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                        بازکردن گفتگو
                      </button>
                    </div>
                  </div>
                ) : (
                  <ConversationWorkspace
                    conversation={convData}
                    messages={messages}
                    isStreaming={isStreaming}
                    runStatus={runStatus}
                    onSendMessage={handleSendMessage}
                    onStopGeneration={handleStopGeneration}
                    onRetry={handleRetry}
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
                    onPipelineRetry={() => handleRetry("")}
                    composerPlaceholder={composerPlaceholder(serviceType)}
                    attachedDocuments={attachedDocuments}
                    onAttachedDocumentsChange={setAttachedDocuments}
                    onAttachmentClick={setViewerDocumentId}
                    returnTo={`/chat/${id}`}
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

            {/* Sources Tab */}
            {activeTab === "sources" && (
              <div className="flex-1 overflow-y-auto">
                <SourcesTab
                  references={references}
                  isLoading={detailLoading}
                  onSourceClick={(sourceId) => setSelectedSourceId(sourceId)}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Source Detail Drawer */}
      <SourceDetailDrawer
        sourceId={selectedSourceId}
        onClose={() => setSelectedSourceId(null)}
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
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-onSurface/[0.08] transition-colors touch-target"
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-onSurface/[0.08]"
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
