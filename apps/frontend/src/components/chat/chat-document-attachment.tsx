"use client";

// ============================================================
// LEGALIR — Chat Document Attachment (reusable card)
// ============================================================
// One component, two variants — so the composer tray and the persisted
// message bubble never drift apart:
//
//   COMPOSER — a compact chip in the composer's attachment tray, with a
//              remove (×) affordance. Shown before the message is sent.
//   MESSAGE  — a card rendered inside a sent message bubble. Clicking it
//              opens the existing document viewer. No remove affordance.
//
// The card only ever shows document *metadata*; the file itself is opened
// through the existing auth-gated viewer, so a card can never leak bytes.
// ============================================================

import { IconDocument, IconFile, IconClose, IconChevronRight } from "@/lib/icons";
import { formatFileSize } from "@/lib/persian-utils";
import { previewTypeLabel } from "@/lib/document-preview";
import type { ChatAttachmentRef, V1DocumentListItem } from "@legalir/types";

export type ChatDocumentAttachmentVariant = "COMPOSER" | "MESSAGE";

/** The minimal shape both variants need — satisfied by both source types. */
interface AttachmentLike {
  documentId: string;
  name: string;
  mime: string;
  sizeBytes: number;
}

interface ChatDocumentAttachmentProps {
  variant: ChatDocumentAttachmentVariant;
  document: AttachmentLike;
  /** MESSAGE: open the existing viewer. */
  onOpen?: (documentId: string) => void;
  /** COMPOSER: remove from the tray. */
  onRemove?: (documentId: string) => void;
  /** MESSAGE: true when rendered on the primary (user) bubble. */
  onPrimary?: boolean;
}

function iconFor(mime: string) {
  return mime === "application/pdf" ? IconDocument : IconFile;
}

export function ChatDocumentAttachment({
  variant,
  document,
  onOpen,
  onRemove,
  onPrimary = false,
}: ChatDocumentAttachmentProps) {
  const Icon = iconFor(document.mime);
  const typeLabel = previewTypeLabel(document.mime, document.name);

  // ----------------------------------------------------------
  // COMPOSER — compact removable chip
  // ----------------------------------------------------------
  if (variant === "COMPOSER") {
    return (
      <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/5 py-1 pe-1 ps-3 text-bodySmall text-primary-700">
        <Icon size={14} className="shrink-0" aria-hidden="true" />
        <span className="truncate max-w-[12rem]">{document.name}</span>
        <span className="shrink-0 text-caption text-primary-700/70">
          {formatFileSize(document.sizeBytes)}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(document.documentId)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-primary-700 transition-colors hover:bg-primary/15"
            aria-label={`حذف پیوست ${document.name}`}
            title="حذف پیوست"
          >
            <IconClose size={12} />
          </button>
        )}
      </span>
    );
  }

  // ----------------------------------------------------------
  // MESSAGE — persisted card inside the bubble
  // ----------------------------------------------------------
  const interactive = Boolean(onOpen);
  const Wrapper = interactive ? "button" : "div";

  return (
    <Wrapper
      {...(interactive
        ? {
            type: "button" as const,
            onClick: () => onOpen!(document.documentId),
            "aria-label": `مشاهده سند ${document.name}`,
          }
        : {})}
      className={[
        "group flex w-full items-center gap-3 rounded-medium border p-2.5 text-start transition-colors",
        onPrimary
          ? "border-white/25 bg-white/10 hover:bg-white/15"
          : "border-divider bg-surface-container hover:bg-surface-hover",
        interactive ? "cursor-pointer" : "",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          onPrimary ? "bg-white/20 text-white" : "bg-primary/10 text-primary",
        ].join(" ")}
        aria-hidden="true"
      >
        <Icon size={18} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={[
            "block truncate text-bodySmall font-medium",
            onPrimary ? "text-white" : "text-onSurface",
          ].join(" ")}
        >
          {document.name}
        </span>
        <span
          className={[
            "block text-caption",
            onPrimary ? "text-white/70" : "text-muted",
          ].join(" ")}
        >
          {typeLabel} · {formatFileSize(document.sizeBytes)}
        </span>
      </span>

      {interactive && (
        <IconChevronRight
          size={16}
          className={[
            "shrink-0 transition-transform group-hover:-translate-x-0.5",
            onPrimary ? "text-white/70" : "text-muted",
          ].join(" ")}
          aria-hidden="true"
        />
      )}
    </Wrapper>
  );
}

/** Narrow a hydrated ref to the card's minimal shape. */
export function refToAttachment(ref: ChatAttachmentRef): AttachmentLike {
  return {
    documentId: ref.documentId,
    name: ref.name,
    mime: ref.mime,
    sizeBytes: ref.sizeBytes,
  };
}

/** Narrow a list item to the card's minimal shape. */
export function listItemToAttachment(doc: V1DocumentListItem): AttachmentLike {
  return {
    documentId: doc.id,
    name: doc.name,
    mime: doc.mime,
    sizeBytes: doc.sizeBytes,
  };
}

export type { ChatDocumentAttachmentProps, AttachmentLike };
