"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Conversation } from "@legalir/types";
import { IconAdd, IconArchive, IconChat, IconChevronRight, IconInfo } from "@/lib/icons";
import { getCategoryName } from "./category-selector";
import { UsageBar } from "./usage-bar";

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) {
      return date.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    }
    if (days === 1) return "دیروز";
    if (days < 7) return `${days} روز پیش`;
    return date.toLocaleDateString("fa-IR", { month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

const _STATUS_LABELS: Record<string, string> = {
  active: "فعال",
  completed: "تکمیل‌شده",
  archived: "بایگانی",
  draft: "پیش‌نویس",
  failed: "خطا",
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-success/10 text-success",
  medium: "bg-warning/10 text-warning",
  high: "bg-error/10 text-error",
  critical: "bg-error/20 text-error",
};

interface ConversationListProps {
  conversations: Conversation[];
  isLoading: boolean;
  error: Error | null;
  onArchive?: (id: string) => void;
  dailyUsed?: number;
  dailyLimit?: number;
  subscriptionUsed?: number;
  subscriptionLimit?: number;
  daysRemaining?: number;
}

export function ConversationList({
  conversations,
  isLoading,
  error,
  onArchive,
  dailyUsed = 3,
  dailyLimit = 10,
  subscriptionUsed,
  subscriptionLimit,
  daysRemaining = 23,
}: ConversationListProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-divider">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-titleMedium text-onSurface">گفتگوها</h2>
          <Link
            href="/chat/new"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary-variant transition-colors touch-target"
            aria-label="گفتگوی جدید"
          >
            <IconAdd size={20} />
          </Link>
        </div>
        <UsageBar
          used={dailyUsed}
          limit={dailyLimit}
          daysRemaining={daysRemaining}
          subscriptionUsed={subscriptionUsed}
          subscriptionLimit={subscriptionLimit}
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-5 bg-surfaceVariant rounded-medium w-3/4 mb-2" />
                <div className="h-3 bg-surfaceVariant rounded-small w-1/2" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="p-4 text-center">
            <p className="text-bodySmall text-error mb-2">خطا در بارگذاری گفتگوها</p>
          </div>
        )}

        {!isLoading && !error && conversations.length === 0 && (
          <div className="p-6 text-center">
            <p className="text-bodyMedium text-muted mb-3">گفتگویی ندارید</p>
            <Link
              href="/chat/new"
              className="inline-flex items-center gap-2 rounded-medium bg-primary text-white px-4 py-2 text-button hover:bg-primary-variant transition-colors"
            >
              <IconAdd size={16} />
              شروع گفتگوی جدید
            </Link>
          </div>
        )}

        {!isLoading &&
          !error &&
          conversations.map((conv) => {
            const isActive = pathname === `/chat/${conv.id}`;
            const isArchived = conv.status === "archived";

            return (
              <div key={conv.id} className="group relative px-2">
                <Link
                  href={isArchived ? "#" : `/chat/${conv.id}`}
                  onClick={(e) => {
                    if (isArchived) e.preventDefault();
                  }}
                  className={[
                    "flex items-start gap-3 px-3 py-3 rounded-medium transition-colors",
                    "touch-target",
                    isActive
                      ? "bg-primary/10"
                      : "hover:bg-onSurface/[0.05]",
                    isArchived ? "opacity-50 cursor-default" : "",
                  ].join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="w-8 h-8 rounded-full bg-surfaceVariant flex items-center justify-center shrink-0 mt-0.5">
                    <IconChat size={16} className="text-onSurfaceVariant" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-labelLarge text-onSurface truncate">
                        {conv.title}
                      </p>
                      {conv.riskLevel && !isArchived && (
                        <span
                          className={[
                            "text-labelSmall px-1.5 py-0.5 rounded-full shrink-0",
                            RISK_COLORS[conv.riskLevel] ?? "",
                          ].join(" ")}
                        >
                          {conv.riskLevel === "low"
                            ? "کم"
                            : conv.riskLevel === "medium"
                              ? "متوسط"
                              : conv.riskLevel === "high"
                                ? "بالا"
                                : conv.riskLevel === "critical"
                                  ? "بحرانی"
                                  : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {conv.category && (
                        <span className="text-bodySmall text-muted">
                          {getCategoryName(conv.category)}
                        </span>
                      )}
                      <span className="text-bodySmall text-muted">
                        {formatDate(conv.updatedAt)}
                      </span>
                      <span className="text-bodySmall text-muted">
                        {conv.messageCount} پیام
                      </span>
                    </div>
                  </div>
                  {!isArchived && (
                    <IconChevronRight
                      size={16}
                      className="text-muted shrink-0 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  )}
                </Link>

                {/* Archive button for non-archived conversations */}
                {!isArchived && onArchive && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      onArchive(conv.id);
                    }}
                    className="absolute top-3 end-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surfaceVariant transition-colors opacity-0 group-hover:opacity-100 touch-target"
                    aria-label={`بایگانی گفتگو: ${conv.title}`}
                    title="بایگانی"
                  >
                    <IconArchive size={14} className="text-muted" />
                  </button>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-divider">
        <div className="flex items-center gap-2 text-bodySmall text-muted">
          <IconInfo size={14} />
          <span>بازارگاه وکلا به‌زودی</span>
        </div>
      </div>
    </div>
  );
}
