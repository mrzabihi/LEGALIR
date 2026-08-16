"use client";

import { useState, useEffect } from "react";
import { useConversations, useUpdateConversation } from "@/hooks/useConversations";
import { ConversationList } from "@/components/chat/conversation-list";
import { ServiceContextCard } from "@/components/chat/service-context-card";
import { serviceTypeFromQuery, type ServiceType } from "@/lib/ai/service-context";
import { IconChat } from "@/lib/icons";
import Link from "next/link";

export default function ChatListPage() {
  const { data: conversations = [], isLoading, error, refetch } = useConversations();
  const archiveMutation = useUpdateConversation();
  const [serviceType, setServiceType] = useState<ServiceType>("legal_consultation");

  // Derive service context from the entry URL (?service= / ?category=).
  useEffect(() => {
    if (typeof window !== "undefined") {
      setServiceType(serviceTypeFromQuery(window.location.search));
    }
  }, []);

  return (
    <div className="flex h-full">
      {/* Sidebar / Conversation list */}
      <aside className="hidden tablet:flex flex-col w-[320px] shrink-0 border-e border-divider bg-surface h-full">
        <ConversationList
          conversations={conversations}
          isLoading={isLoading}
          error={error as Error | null}
          onRetry={() => refetch()}
          onArchive={(id) =>
            archiveMutation.mutate({ id, data: { status: "archived" } })
          }
          dailyUsed={3}
          dailyLimit={10}
          subscriptionUsed={127}
          subscriptionLimit={300}
          daysRemaining={23}
        />
      </aside>

      {/* Mobile: list view only (no workspace side by side) */}
      <div className="flex-1 flex flex-col tablet:hidden">
        <div className="p-4 border-b border-divider">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-h2 text-on-surface">گفتگوها</h1>
            <Link
              href={`/chat/new?service=${serviceType}`}
              className="rounded-medium bg-primary text-white px-5 py-3 text-button hover:bg-primary-variant transition-colors touch-target"
            >
              گفتگوی جدید
            </Link>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConversationList
            conversations={conversations}
            isLoading={isLoading}
            error={error as Error | null}
            onRetry={() => refetch()}
            onArchive={(id) =>
              archiveMutation.mutate({ id, data: { status: "archived" } })
            }
          />
        </div>
      </div>

      {/* Desktop empty state */}
      <main className="hidden tablet:flex flex-1 flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <IconChat size={32} className="text-primary" />
          </div>
          <h2 className="text-h3 text-onSurface mb-2">
            گفتگوی حقوقی با هوش مصنوعی
          </h2>
          <p className="text-bodyMedium text-muted mb-6">
            یک گفتگو را از لیست انتخاب کنید یا گفتگوی جدیدی شروع کنید. هوش مصنوعی
            LEGALIR تحلیل حقوقی، ریسک‌ها و اقدامات پیشنهادی را ارائه می‌دهد.
          </p>
          <div className="mb-6">
            <ServiceContextCard serviceType={serviceType} compact />
          </div>
          <Link
            href={`/chat/new?service=${serviceType}`}
            className="inline-flex items-center gap-2 rounded-medium bg-primary text-white px-6 py-3 text-button hover:bg-primary-variant transition-colors touch-target"
          >
            شروع گفتگوی جدید
          </Link>
          <p className="text-bodySmall text-muted mt-4">
            تحلیل تخصصی حقوقی، همراه با منابع و مستندات مرتبط
          </p>
        </div>
      </main>
    </div>
  );
}
