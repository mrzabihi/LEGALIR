"use client";

import { useParams } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  useConversation,
  useConversations,
  useSendMessage,
  useUpdateConversation,
  useConversationReferences,
  useCreateAiRun,
  useCancelAiRun,
} from "@/hooks/useConversations";
import { ConversationWorkspace } from "@/components/chat/conversation-workspace";
import { ConversationList } from "@/components/chat/conversation-list";
import { SourceDetailDrawer } from "@/components/chat/source-detail-drawer";
import { ReferencesTab } from "@/components/chat/references-tab";
import { SourcesTab } from "@/components/chat/sources-tab";
import { Tabs } from "@legalir/ui";
import { IconClose } from "@/lib/icons";
import type { V1Reference, AiRunStatus } from "@legalir/types";

export default function ConversationPage() {
  const params = useParams();
  const id = params?.["id"] as string;

  // Data
  const { data: conversationDetail, isLoading: detailLoading } = useConversation(id);
  const { data: conversations = [], isLoading: convsLoading } = useConversations();
  const { data: references = [] } = useConversationReferences(id);

  // Mutations
  const sendMutation = useSendMessage();
  const updateMutation = useUpdateConversation();
  const archiveMutation = useUpdateConversation();
  const _createRunMutation = useCreateAiRun();
  const cancelRunMutation = useCancelAiRun();

  // UI state
  const [isStreaming, setIsStreaming] = useState(false);
  const [runStatus, setRunStatus] = useState<AiRunStatus | null>(null);
  const [streamingRunId, setStreamingRunId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [scrollToSectionId, setScrollToSectionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Messages from the detail response
  const messages = conversationDetail?.messages ?? [];
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

      // Start streaming state
      setIsStreaming(true);
      setRunStatus("queued");

      // Simulate run creation and progression
      const pollInterval = setInterval(() => {
        setRunStatus((prev) => {
          if (prev === "queued") return "retrieving";
          if (prev === "retrieving") return "generating";
          if (prev === "generating") return "validating";
          return prev;
        });
      }, 800);
      pollingRef.current = pollInterval;

      try {
        await sendMutation.mutateAsync({ conversationId: id, content });
        // Complete
        clearInterval(pollInterval);
        setRunStatus("succeeded");
        setIsStreaming(false);
      } catch {
        clearInterval(pollInterval);
        setRunStatus("failed");
        setIsStreaming(false);
      }
    },
    [id, isStreaming, sendMutation]
  );

  const handleStopGeneration = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (streamingRunId) {
      cancelRunMutation.mutate(streamingRunId);
    }
    setRunStatus("failed");
    setIsStreaming(false);
    setStreamingRunId(null);
  }, [streamingRunId, cancelRunMutation]);

  const handleRetry = useCallback(
    async (_messageId: string) => {
      if (!id) return;
      setIsStreaming(true);
      setRunStatus("queued");

      const pollInterval = setInterval(() => {
        setRunStatus((prev) => {
          if (prev === "queued") return "retrieving";
          if (prev === "retrieving") return "generating";
          if (prev === "generating") return "validating";
          return prev;
        });
      }, 800);
      pollingRef.current = pollInterval;

      try {
        await sendMutation.mutateAsync({
          conversationId: id,
          content: "تلاش مجدد پاسخ",
        });
        clearInterval(pollInterval);
        setRunStatus("succeeded");
        setIsStreaming(false);
      } catch {
        clearInterval(pollInterval);
        setRunStatus("failed");
        setIsStreaming(false);
      }
    },
    [id, sendMutation]
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
    <div className="flex h-full">
      {/* Desktop: Conversation List Sidebar */}
      <aside className="hidden tablet:flex flex-col w-[320px] shrink-0 border-e border-divider bg-surface h-full">
        <ConversationList
          conversations={conversations}
          isLoading={convsLoading}
          error={null}
          onArchive={(convId) =>
            archiveMutation.mutate({ id: convId, data: { status: "archived" } })
          }
          dailyUsed={3}
          dailyLimit={10}
          subscriptionUsed={127}
          subscriptionLimit={300}
          daysRemaining={23}
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
            {/* Tabs */}
            <div className="shrink-0">
              <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
            </div>

            {/* Chat Tab */}
            {activeTab === "chat" && (
              <div className="flex-1 flex flex-col min-h-0">
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
                />
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
                error={null}
                onArchive={(convId) =>
                  archiveMutation.mutate({ id: convId, data: { status: "archived" } })
                }
                dailyUsed={3}
                dailyLimit={10}
                subscriptionUsed={127}
                subscriptionLimit={300}
                daysRemaining={23}
              />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
