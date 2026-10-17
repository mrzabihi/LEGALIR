// ============================================================
// LEGALIR — Settings · Privacy (حریم خصوصی)
// ============================================================
// Dedicated page for privacy preferences. Reads and writes the shared
// preferences record through /api/v1/settings/privacy.
// ============================================================

"use client";

import { useCallback, useRef, useState } from "react";
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

function errText(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : "ذخیره نشد؛ وضعیت قبلی بازگردانده شد.";
}

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

  // Which row is in flight / failed — so only that row shows it.
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  // Double-tap guard: rejects a second write before `isPending` re-renders.
  const inFlight = useRef(false);

  const handleChange = useCallback(
    (key: string, value: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSavingKey(key);
      setFailedKey(null);
      update.mutate(
        { [key]: value } as Partial<PrivacySettings>,
        {
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
            saving={update.isPending}
            savingKey={savingKey}
            failedKey={failedKey}
            errorMessage={update.error ? errText(update.error) : null}
          />
        )}
      </SettingsCard>
    </SettingsShell>
  );
}
