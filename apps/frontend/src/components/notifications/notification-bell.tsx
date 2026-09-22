// ============================================================
// LEGALIR — NotificationBell
// ============================================================
// Header entry point to the Notification Center.
//   Desktop → compact popover anchored to the bell
//   Mobile  → bottom sheet (the shared Dialog already does this)
// The unread count comes from the canonical feed query, so the badge
// can never disagree with the list it opens.
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog } from "@legalir/ui";
import { IconBell } from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications";
import { NotificationItem } from "./notification-item";
import type { NotificationItem as NotificationItemType } from "@legalir/types";

/** How many items the preview shows — the full history lives in the center. */
const PREVIEW_LIMIT = 4;

/**
 * `sidebar` renders the bell on the dark glass sidebar header, so it
 * needs light-on-dark colours and a popover that opens toward the
 * content area instead of off the screen edge.
 */
export function NotificationBell({ variant = "default" }: { variant?: "default" | "sidebar" }) {
  const isSidebar = variant === "sidebar";
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = data?.unreadCount ?? 0;
  const preview = data?.items.slice(0, PREVIEW_LIMIT) ?? [];

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("mousedown", handleClickOutside);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, handleClickOutside]);

  const ariaLabel =
    unreadCount > 0
      ? `اعلان‌ها، ${toPersianNumber(unreadCount)} پیام خوانده‌نشده`
      : "اعلان‌ها";

  const badge = unreadCount > 9 ? "۹+" : toPersianNumber(unreadCount);

  const handleActivate = (item: NotificationItemType) => {
    if (!item.read) markRead.mutate(item.id);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors touch-target-min shrink-0",
          isSidebar
            ? open
              ? "bg-glass-state-strong text-glass-ivory"
              : "text-glass-ivory-muted hover:bg-glass-state hover:text-glass-ivory"
            : open
              ? "bg-primary-50 text-primary-700"
              : "text-neutral-600 hover:bg-neutral-100",
        ].join(" ")}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="اعلان‌ها"
      >
        <IconBell size={21} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -end-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-white animate-notification-pulse"
            aria-hidden="true"
          >
            {badge}
          </span>
        )}
      </button>

      {/* Desktop popover */}
      {open && (
        <div
          className={[
            "hidden tablet:block absolute top-full mt-3 w-[22rem] rounded-2xl bg-surface border border-divider shadow-elevation-8 z-50 overflow-hidden animate-scale-in",
            // On the sidebar the bell hugs the screen's right edge, so the
            // popover must open leftward (start-0 in RTL) to stay on screen.
            isSidebar ? "start-0 origin-top-start" : "end-0 origin-top-end",
          ].join(" ")}
          role="dialog"
          aria-label="پیش‌نمایش اعلان‌ها"
        >
          <NotificationPreview
            items={preview}
            isLoading={isLoading}
            unreadCount={unreadCount}
            onActivate={handleActivate}
            onMarkAll={() => markAllRead.mutate()}
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}

      {/* Mobile bottom sheet — Dialog already renders as a sheet on small screens */}
      <div className="tablet:hidden">
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="اعلان‌ها"
          maxWidth="md"
        >
          <NotificationPreview
            items={preview}
            isLoading={isLoading}
            unreadCount={unreadCount}
            onActivate={handleActivate}
            onMarkAll={() => markAllRead.mutate()}
            onNavigate={() => setOpen(false)}
          />
        </Dialog>
      </div>
    </div>
  );
}

function NotificationPreview({
  items,
  isLoading,
  unreadCount,
  onActivate,
  onMarkAll,
  onNavigate,
}: {
  items: NotificationItemType[];
  isLoading: boolean;
  unreadCount: number;
  onActivate: (item: NotificationItemType) => void;
  onMarkAll: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-divider px-4 py-3">
        <h3 className="text-titleMedium text-on-surface font-semibold">اعلان‌ها</h3>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAll}
            className="text-caption text-primary font-medium hover:underline"
          >
            خواندن همه
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3 p-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-medium bg-surface-container animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <IconBell size={28} className="text-muted" />
          <p className="text-body-2 text-on-surface">اعلان جدیدی ندارید</p>
          <p className="text-caption text-muted">
            پیام‌ها و به‌روزرسانی‌های جدید شما در این بخش نمایش داده می‌شوند.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-divider/70 max-h-[22rem] overflow-y-auto">
          {items.map((item) => (
            <NotificationItem
              key={item.id}
              item={item}
              compact
              onActivate={onActivate}
            />
          ))}
        </div>
      )}

      <Link
        href="/notifications"
        onClick={onNavigate}
        className="border-t border-divider px-4 py-3 text-center text-body-2 text-primary font-medium hover:bg-surface-container/60 transition-colors"
      >
        مشاهده همه اعلان‌ها
      </Link>
    </div>
  );
}
