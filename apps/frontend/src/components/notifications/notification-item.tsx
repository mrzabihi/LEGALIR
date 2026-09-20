// ============================================================
// LEGALIR — NotificationItem
// ============================================================
// The single reusable row used by the header popover, the full
// notification center and every tab. One component, one visual
// language — the category only changes the icon and its tone.
// ============================================================

"use client";

import Link from "next/link";
import { toPersianNumber, toRelativeTime } from "@/lib/persian-utils";
import {
  IconBell,
  IconCoin,
  IconDocument,
  IconInfo,
  IconWarning,
} from "@/lib/icons";
import type { NotificationItem as NotificationItemType, NotificationTone } from "@legalir/types";

/** Icon container tone — subtle, never a fully coloured row. */
const TONE_STYLES: Record<NotificationTone, string> = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  success: "bg-success-container text-success",
  warning: "bg-warning-container text-warning",
  error: "bg-error-container text-error",
};

const CATEGORY_LABEL: Record<NotificationItemType["category"], string> = {
  public: "عمومی",
  personal: "شخصی",
  points: "امتیاز",
};

function ItemIcon({ item }: { item: NotificationItemType }) {
  if (item.category === "points") return <IconCoin size={18} />;
  if (item.category === "public") return <IconBell size={18} />;
  if (item.tone === "error") return <IconWarning size={18} />;
  if (item.tone === "neutral") return <IconDocument size={18} />;
  return <IconInfo size={18} />;
}

interface NotificationItemProps {
  item: NotificationItemType;
  /** Called when the row is activated — used to mark it read. */
  onActivate?: (item: NotificationItemType) => void;
  /** Compact variant for the header popover. */
  compact?: boolean;
}

export function NotificationItem({ item, onActivate, compact = false }: NotificationItemProps) {
  const body = (
    <>
      <span
        className={`flex shrink-0 items-center justify-center rounded-medium ${TONE_STYLES[item.tone]} ${
          compact ? "h-8 w-8" : "h-9 w-9"
        }`}
      >
        <ItemIcon item={item} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-on-surface truncate ${
              compact ? "text-body-2" : "text-body-1"
            } ${item.read ? "font-normal" : "font-semibold"}`}
          >
            {item.title}
          </p>
          {item.pointsDelta !== undefined && (
            <span
              className={`shrink-0 tabular-nums text-labelSmall font-semibold ${
                item.pointsDelta >= 0 ? "text-success" : "text-error"
              }`}
              dir="ltr"
            >
              {item.pointsDelta >= 0 ? "+" : "−"}
              {toPersianNumber(Math.abs(item.pointsDelta))}
            </span>
          )}
        </div>

        {item.message && (
          <p className="text-caption text-muted truncate mt-0.5">{item.message}</p>
        )}

        <div className="flex items-center gap-2 mt-1">
          <span className="text-caption text-[color:color-mix(in_srgb,var(--color-on-surface-variant)_70%,transparent)]">
            {toRelativeTime(item.createdAt)}
          </span>
          {!compact && (
            <span className="rounded-full border border-outline-variant px-1.5 py-px text-[10px] text-on-surface-variant">
              {CATEGORY_LABEL[item.category]}
            </span>
          )}
        </div>
      </div>

      {/* Unread marker — a dot, not a colour-only cue (the title weight
          also changes, and the row carries an aria-label). */}
      {!item.read && (
        <span
          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-error"
          aria-hidden="true"
        />
      )}
    </>
  );

  const className = [
    "flex items-start gap-3 w-full text-start transition-colors duration-short3 ease-standard",
    compact ? "px-4 py-3" : "px-4 py-3.5",
    item.read ? "hover:bg-surface-container/60" : "bg-primary/[0.04] hover:bg-primary/[0.07]",
  ].join(" ");

  const ariaLabel = `${CATEGORY_LABEL[item.category]}: ${item.title}${item.read ? "" : " — خوانده‌نشده"}`;

  if (item.href) {
    return (
      <Link
        href={item.href}
        className={className}
        aria-label={ariaLabel}
        onClick={() => onActivate?.(item)}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={() => onActivate?.(item)}
    >
      {body}
    </button>
  );
}
