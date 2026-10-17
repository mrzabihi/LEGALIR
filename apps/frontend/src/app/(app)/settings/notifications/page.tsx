// ============================================================
// LEGALIR — Settings · Notifications (اعلان‌ها)
// ============================================================
// Notification PREFERENCES — not the history. The history lives in the
// Notification Center (/notifications), linked from the card below.
// Reads and writes the shared preferences record through
// /api/v1/settings/notifications — the same source of truth the rest
// of the app uses.
// ============================================================

"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { SettingsShell } from "@/components/settings/settings-shell";
import {
  SettingsCard,
  PreferenceToggleGroup,
  SavingIndicator,
  SkeletonBlock,
  ErrorBanner,
  EmptyState,
  type ToggleItem,
} from "@/components/settings/settings-ui";
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from "@/hooks/useAccount";
import { IconBell, IconChevronRight, IconInfo } from "@/lib/icons";
import type { NotificationSettings } from "@legalir/types";

function errText(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : "ذخیره نشد؛ وضعیت قبلی بازگردانده شد.";
}

/** Grouped so the list reads as two clear families, not six loose switches. */
const GROUPS: { title: string; items: ToggleItem[] }[] = [
  {
    title: "اعلان‌های حساب",
    items: [
      { key: "caseUpdate", label: "وضعیت درخواست‌ها", description: "تغییرات وضعیت پرونده‌ها و درخواست‌های شما." },
      { key: "paymentStatus", label: "اشتراک و پرداخت", description: "نتیجه پرداخت‌ها و صورت‌حساب‌ها." },
      { key: "contractExpiry", label: "یادآوری قراردادها", description: "پیش از انقضای قراردادها به شما اطلاع می‌دهیم." },
      { key: "appointments", label: "نوبت‌ها", description: "یادآوری نوبت‌های مشاوره." },
      { key: "lawyerResponse", label: "پاسخ وکیل", description: "وقتی وکیل به درخواست شما پاسخ می‌دهد مطلع شوید." },
    ],
  },
  {
    title: "فعالیت‌های لیگالیر",
    items: [
      { key: "marketing", label: "اطلاعیه‌های عمومی", description: "اخبار محصول، قابلیت‌های جدید و پیشنهادها." },
    ],
  },
];

export default function NotificationSettingsPage() {
  const query = useNotificationSettings();
  const update = useUpdateNotificationSettings();

  // The mutation writes optimistically into the query cache, so the switch
  // flips instantly and `query.data` is already the new value.
  const values = query.data;

  // Which row is being written / which row's last write failed. Tracked here
  // (not in the group) so only that row shows a spinner or an error.
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  // Ref guard: a double tap can fire two onChange calls in one frame, before
  // `isPending` re-renders. The ref rejects the second without a round-trip.
  const inFlight = useRef(false);

  const handleChange = useCallback(
    (key: string, value: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSavingKey(key);
      setFailedKey(null);
      update.mutate(
        { [key]: value } as Partial<NotificationSettings>,
        {
          // The hook restores the previous cache value on error, so the row
          // snaps back to the server truth; this just points at that row.
          onError: () => setFailedKey(key),
          onSettled: () => {
            inFlight.current = false;
            setSavingKey(null);
          },
        }
      );
    },
    [update]
  );

  return (
    <SettingsShell
      title="اعلان‌ها"
      description="انتخاب کنید چه رویدادهایی به شما اطلاع داده شود."
    >
      {/* Entry point to the history — preferences and history are distinct. */}
      <Link
        href="/notifications"
        className="group mb-6 flex items-center gap-4 rounded-large border border-divider bg-surface p-5 shadow-elevation-1 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-primary-container text-primary">
          <IconBell size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-1 font-semibold text-on-surface">مرکز اعلان‌ها</p>
          <p className="text-body-2 text-muted mt-0.5">
            مشاهده پیام‌های عمومی، شخصی و سابقه امتیازها.
          </p>
        </div>
        <span className="shrink-0 text-muted transition-transform group-hover:-translate-x-0.5">
          <IconChevronRight size={20} rtlFlip />
        </span>
      </Link>

      {query.isLoading ? (
        <SettingsCard title="اعلان‌ها" icon={<IconInfo size={22} />}>
          <SkeletonBlock lines={6} />
        </SettingsCard>
      ) : query.error ? (
        <SettingsCard title="اعلان‌ها" icon={<IconInfo size={22} />}>
          <ErrorBanner
            message={(query.error as Error).message}
            onRetry={() => query.refetch()}
          />
        </SettingsCard>
      ) : !values ? (
        <SettingsCard title="اعلان‌ها" icon={<IconInfo size={22} />}>
          <EmptyState text="تنظیمات اعلان‌ها در دسترس نیست." />
        </SettingsCard>
      ) : (
        GROUPS.map((group) => (
          <SettingsCard
            key={group.title}
            title={group.title}
            icon={<IconInfo size={22} />}
            action={<SavingIndicator visible={update.isPending} />}
          >
            <PreferenceToggleGroup
              items={group.items}
              values={values as unknown as Record<string, boolean>}
              onChange={handleChange}
              disabled={false}
              saving={update.isPending}
              savingKey={savingKey}
              failedKey={failedKey}
              errorMessage={update.error ? errText(update.error) : null}
            />
          </SettingsCard>
        ))
      )}
    </SettingsShell>
  );
}
