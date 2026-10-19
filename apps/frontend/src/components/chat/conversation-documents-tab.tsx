"use client";

import { useMemo } from "react";
import type { ChatAttachmentRef, DocumentStatus, RiskLevel } from "@legalir/types";
import { IconChevronRight, IconDocument, IconWarning } from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";

/**
 * The «مستندات» tab of a conversation.
 *
 * It lists exactly the documents the user attached inside THIS conversation —
 * the source is the backend's per-message attachment refs, which are derived
 * from the conversation's own attachment rows and ownership-checked. Nothing
 * is fetched from another conversation and nothing is invented: a document
 * whose processing failed shows that failure, and a conversation with no
 * attachments says so plainly.
 */
const STATUS_LABEL: Record<DocumentStatus, string> = {
  uploaded: "بارگذاری شد",
  processing: "در حال پردازش",
  extracting: "استخراج متن",
  analyzing: "تحلیل حقوقی",
  ready: "آماده",
  failed: "خطا در پردازش",
  blocked: "مسدود",
  cancelled: "لغو شده",
};

const STATUS_TONE: Record<DocumentStatus, string> = {
  uploaded: "bg-surfaceVariant text-muted",
  processing: "bg-surfaceVariant text-muted",
  extracting: "bg-surfaceVariant text-muted",
  analyzing: "bg-primary-container text-primary",
  ready: "bg-surfaceVariant text-onSurface",
  failed: "bg-error-container text-error",
  blocked: "bg-error-container text-error",
  cancelled: "bg-surfaceVariant text-muted",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "ریسک کم",
  medium: "ریسک متوسط",
  high: "ریسک بالا",
  critical: "ریسک بحرانی",
};

interface ConversationDocumentsTabProps {
  /** Attachment refs grouped per message, in the conversation's own order. */
  messages: { attachments?: ChatAttachmentRef[] }[];
  isLoading?: boolean;
  onOpenDocument: (documentId: string) => void;
}

export function ConversationDocumentsTab({
  messages,
  isLoading = false,
  onOpenDocument,
}: ConversationDocumentsTabProps) {
  // One entry per document even when it was attached to more than one turn.
  const documents = useMemo(() => {
    const seen = new Map<string, ChatAttachmentRef>();
    for (const message of messages) {
      for (const attachment of message.attachments ?? []) {
        if (!seen.has(attachment.documentId)) seen.set(attachment.documentId, attachment);
      }
    }
    return Array.from(seen.values());
  }, [messages]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-full bg-surfaceVariant" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-surfaceVariant rounded-small w-3/4" />
              <div className="h-3 bg-surfaceVariant rounded-small w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="p-6 text-center">
        <IconDocument size={32} className="text-muted mx-auto mb-2" />
        <p className="text-bodyMedium text-muted">در این گفتگو سندی پیوست نشده است</p>
        <p className="text-bodySmall text-muted mt-1 leading-relaxed">
          برای اینکه پاسخ به سند شما استناد کند، از دکمه «افزودن سند» کنار کادر پیام استفاده کنید.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-divider">
      {documents.map((doc) => {
        const failed = doc.status === "failed" || doc.status === "blocked";
        return (
          <div key={doc.documentId} className="flex items-start gap-3 px-4 py-3">
            <span
              className={[
                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                failed ? "bg-error-container text-error" : "bg-primary-container text-primary",
              ].join(" ")}
            >
              {failed ? <IconWarning size={18} /> : <IconDocument size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="line-clamp-1 text-labelMedium font-medium text-onSurface">
                  {doc.name}
                </span>
                <span
                  className={[
                    "shrink-0 rounded-full px-1.5 py-0.5 text-bodySmall",
                    STATUS_TONE[doc.status],
                  ].join(" ")}
                >
                  {STATUS_LABEL[doc.status]}
                </span>
                {doc.status === "ready" && doc.riskLevel && (
                  <span className="shrink-0 rounded-full bg-surfaceVariant px-1.5 py-0.5 text-bodySmall text-muted">
                    {RISK_LABEL[doc.riskLevel]}
                  </span>
                )}
              </div>
              <p className="mb-1 text-bodySmall leading-relaxed text-muted">
                {doc.status === "ready" && doc.findingCount > 0
                  ? `${toPersianNumber(doc.findingCount)} یافته`
                  : failed
                    ? "پردازش این سند کامل نشد؛ محتوای آن در پاسخ‌ها استفاده نمی‌شود."
                    : "در حال آماده‌سازی برای استفاده در پاسخ‌ها."}
              </p>
              <button
                type="button"
                onClick={() => onOpenDocument(doc.documentId)}
                className="flex min-h-9 items-center gap-1 text-labelSmall text-primary transition-colors hover:text-primary-variant"
                aria-label={`مشاهده سند ${doc.name}`}
              >
                مشاهده سند
                <IconChevronRight size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
