// ============================================================
// LEGALIR — Settings · Notifications (اعلان‌ها)
// ============================================================
// Dedicated page for notification preferences. Reads and writes the
// shared preferences record through /api/v1/settings/notifications —
// the same source of truth the rest of the app uses.
// ============================================================

"use client";

import { useCallback } from "react";
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
import { IconInfo } from "@/lib/icons";
import type { NotificationSettings } from "@legalir/types";

const ITEMS: ToggleItem[] = [
  { key: "appointments", label: "نوبت‌ها", description: "یادآوری نوبت‌های مشاوره." },
  { key: "contractExpiry", label: "یادآوری قراردادها", description: "پیش از انقضای قراردادها به شما اطلاع می‌دهیم." },
  { key: "lawyerResponse", label: "پاسخ وکیل", description: "وقتی وکیل به درخواست شما پاسخ می‌دهد مطلع شوید." },
  { key: "paymentStatus", label: "وضعیت پرداخت", description: "نتیجه پرداخت‌ها و صورت‌حساب‌ها را اطلاع می‌دهیم." },
  { key: "caseUpdate", label: "به‌روزرسانی پرونده", description: "تغییرات وضعیت پرونده‌های شما را اطلاع می‌دهیم." },
  { key: "marketing", label: "بازاریابی", description: "پیشنهادها و اخبار محصول." },
];

export default function NotificationSettingsPage() {
  const query = useNotificationSettings();
  const update = useUpdateNotificationSettings();

  // The mutation writes optimistically into the query cache, so the switch
  // flips instantly and `query.data` is already the new value.
  const values = query.data;

  const handleChange = useCallback(
    (key: string, value: boolean) => {
      update.mutate({ [key]: value } as Partial<NotificationSettings>);
    },
    [update]
  );

  return (
    <SettingsShell
      title="اعلان‌ها"
      description="انتخاب کنید چه رویدادهایی به شما اطلاع داده شود."
    >
      <SettingsCard
        title="اعلان‌ها"
        icon={<IconInfo size={22} />}
        action={<SavingIndicator visible={update.isPending} />}
      >
        {query.isLoading ? (
          <SkeletonBlock lines={6} />
        ) : query.error ? (
          <ErrorBanner
            message={(query.error as Error).message}
            onRetry={() => query.refetch()}
          />
        ) : !values ? (
          <EmptyState text="تنظیمات اعلان‌ها در دسترس نیست." />
        ) : (
          <PreferenceToggleGroup
            items={ITEMS}
            values={values as unknown as Record<string, boolean>}
            onChange={handleChange}
            disabled={false}
            saving={false}
          />
        )}
      </SettingsCard>
    </SettingsShell>
  );
}
