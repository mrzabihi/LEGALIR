// ============================================================
// LEGALIR — Notification Center (مرکز اعلان‌ها)
// ============================================================
// The full history behind the header bell. Four tabs filter ONE
// canonical feed — public announcements, personal events and the
// points ledger (normalized) all come from the same query.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { Button } from "@legalir/ui";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { NotificationItem } from "@/components/notifications/notification-item";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications";
import { IconBell, IconRefresh } from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import type { NotificationCategory, NotificationItem as NotificationItemType } from "@legalir/types";

type TabValue = "all" | NotificationCategory;

const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "همه پیام‌ها" },
  { value: "public", label: "پیام‌های عمومی" },
  { value: "personal", label: "پیام‌های شخصی" },
  { value: "points", label: "امتیازها" },
];

const EMPTY_TEXT: Record<TabValue, { title: string; hint: string }> = {
  all: {
    title: "اعلان جدیدی ندارید",
    hint: "پیام‌ها و به‌روزرسانی‌های جدید شما در این بخش نمایش داده می‌شوند.",
  },
  public: {
    title: "اطلاعیه عمومی جدیدی نیست",
    hint: "اطلاعیه‌های سرویس و تغییرات محصول در این بخش نمایش داده می‌شوند.",
  },
  personal: {
    title: "پیام شخصی جدیدی ندارید",
    hint: "رویدادهای مربوط به اسناد، قراردادها و درخواست‌های شما اینجا نمایش داده می‌شوند.",
  },
  points: {
    title: "هنوز سابقه امتیازی ندارید",
    hint: "امتیازهای کسب‌شده و مصرف‌شده شما در این بخش نمایش داده می‌شوند.",
  },
};

export default function NotificationsPage() {
  const [tab, setTab] = useState<TabValue>("all");
  const { data, isLoading, error, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const visible = useMemo(
    () => (tab === "all" ? items : items.filter((n) => n.category === tab)),
    [items, tab]
  );

  const handleActivate = (item: NotificationItemType) => {
    if (!item.read) markRead.mutate(item.id);
  };

  return (
    <div className="p-4 tablet:p-6 max-w-3xl mx-auto" dir="rtl">
      <Breadcrumb
        items={[{ label: "داشبورد", href: "/dashboard" }, { label: "اعلان‌ها" }]}
      />

      {/* Header — stacked on phones so the title + badge never squeeze the
          mark-all action; inline on tablet and up. */}
      <div className="mb-5 flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <IconBell size={26} className="shrink-0 text-on-surface" />
          <h1 className="text-h2 text-on-surface">اعلان‌ها</h1>
          {unreadCount > 0 && (
            <span className="shrink-0 rounded-full bg-error-container px-2.5 py-0.5 text-caption font-medium text-error">
              {toPersianNumber(unreadCount)} خوانده‌نشده
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <Button
            type="button"
            variant="text"
            onClick={() => markAllRead.mutate()}
            loading={markAllRead.isPending}
            className="w-full tablet:w-auto"
          >
            علامت‌گذاری همه به‌عنوان خوانده‌شده
          </Button>
        )}
      </div>

      {/* Tabs — scrollable on narrow screens so Persian labels stay legible */}
      <div className="overflow-x-auto -mx-4 px-4 tablet:mx-0 tablet:px-0">
        <div className="flex gap-1 border-b border-divider min-w-max" role="tablist">
          {TABS.map((t) => {
            const active = tab === t.value;
            const count =
              t.value === "all"
                ? items.length
                : items.filter((n) => n.category === t.value).length;
            return (
              <button
                key={t.value}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.value)}
                className={[
                  "relative whitespace-nowrap px-4 py-3 text-labelLarge transition-colors duration-short3",
                  "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]",
                  active ? "text-primary" : "text-on-surface-variant hover:text-on-surface",
                ].join(" ")}
              >
                {t.label}
                {count > 0 && (
                  <span className="ms-1.5 text-caption text-muted tabular-nums">
                    {toPersianNumber(count)}
                  </span>
                )}
                {active && (
                  <span className="absolute bottom-0 inset-x-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-large bg-surface-container animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-large bg-error-container p-6 text-center">
            <p className="text-body-1 text-error">خطا در دریافت اعلان‌ها</p>
            <Button
              type="button"
              variant="text"
              size="small"
              onClick={() => refetch()}
              startIcon={<IconRefresh size={16} />}
            >
              تلاش مجدد
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-large bg-surface border border-divider py-14 text-center">
            <IconBell size={32} className="text-muted" />
            <p className="text-body-1 text-on-surface">{EMPTY_TEXT[tab].title}</p>
            <p className="text-body-2 text-muted max-w-sm">{EMPTY_TEXT[tab].hint}</p>
          </div>
        ) : (
          <div className="divide-y divide-divider overflow-hidden rounded-large bg-surface border border-divider">
            {visible.map((item) => (
              <NotificationItem key={item.id} item={item} onActivate={handleActivate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
