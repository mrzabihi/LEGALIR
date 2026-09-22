// ============================================================
// LEGALIR — Settings · Privacy (حریم خصوصی)
// ============================================================
// Dedicated page for privacy preferences. Reads and writes the shared
// preferences record through /api/v1/settings/privacy.
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
import { usePrivacySettings, useUpdatePrivacySettings } from "@/hooks/useAccount";
import { IconShield } from "@/lib/icons";
import type { PrivacySettings } from "@legalir/types";

const ITEMS: ToggleItem[] = [
  { key: "shareUsageData", label: "اشتراک‌گذاری داده‌های مصرف", description: "داده‌های ناشناس مصرف برای بهبود سرویس." },
  { key: "allowAiTraining", label: "اجازه آموزش AI", description: "استفاده از گفتگوهای شما برای بهبود مدل." },
  { key: "storeConversationHistory", label: "ذخیره تاریخچه گفتگو", description: "گفتگوها ذخیره و در تاریخچه نمایش داده می‌شوند." },
  { key: "autoMemoryConsent", label: "تأیید خودکار حافظه", description: "ذخیره خودکار دانش استخراج‌شده از گفتگوها." },
];

export default function PrivacySettingsPage() {
  const query = usePrivacySettings();
  const update = useUpdatePrivacySettings();

  // The mutation writes optimistically into the query cache, so the switch
  // flips instantly and `query.data` is already the new value.
  const values = query.data;

  const handleChange = useCallback(
    (key: string, value: boolean) => {
      update.mutate({ [key]: value } as Partial<PrivacySettings>);
    },
    [update]
  );

  return (
    <SettingsShell
      title="حریم خصوصی"
      description="کنترل کنید داده‌های شما چگونه استفاده و ذخیره می‌شود."
    >
      <SettingsCard
        title="حریم خصوصی"
        icon={<IconShield size={22} />}
        action={<SavingIndicator visible={update.isPending} />}
      >
        {query.isLoading ? (
          <SkeletonBlock lines={4} />
        ) : query.error ? (
          <ErrorBanner
            message={(query.error as Error).message}
            onRetry={() => query.refetch()}
          />
        ) : !values ? (
          <EmptyState text="تنظیمات حریم خصوصی در دسترس نیست." />
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
