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
import type { WorkflowEvent } from "@/lib/ai/stream-client";
import { serviceTypeFromQuery, type ServiceType } from "@/lib/ai/service-context";
import { PageContextHeader } from "@/components/shared";
import { WorkflowProgress } from "@/components/chat/workflow-progress";
import type { WorkflowPhase } from "@/components/chat/workflow-progress";
import type { V1Reference, AiRunStatus, V1DailyQuota } from "@legalir/types";

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
  const [exhaustedQuota, setExhaustedQuota] = useState<V1DailyQuota | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // Workflow state from SSE events
  const [workflow, setWorkflow] = useState<WorkflowEvent | null>(null);

  // Derive service context from the entry URL (?service= / ?category=).
  useEffect(() => {
    if (typeof window !== "undefined") {
      setServiceType(serviceTypeFromQuery(window.location.search));
    }
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
        { conversationId: id, content, context: { serviceType } },
        {
          onStatus: (status) => setRunStatus(status),
          onDone: () => finish("succeeded"),
          onWorkflow: (evt) => setWorkflow(evt),
          onError: async (err) => {
            // Quota exhausted — show the countdown/upgrade modal instead of
            // falling back to the non-streaming endpoint (which would also 429).
            if (err.code === "QUOTA_EXHAUSTED") {
              setExhaustedQuota(err.quota ?? null);
              setQuotaModalOpen(true);
              finish("failed");
              return;
            }
            try {
              await sendMutation.mutateAsync({ conversationId: id, content });
              finish("succeeded");
            } catch {
              finish("failed");
            }
          },
        }
      );
    },
    [id, isStreaming, serviceType, sendMutation, queryClient]
  );

  const handleStopGeneration = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    if (streamingRunId) {
      cancelRunMutation.mutate(streamingRunId);
    }
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
        quota={exhaustedQuota}
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
                    workflow={workflow}
                    onCreateCase={() => router.push("/cases?create=true")}
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
