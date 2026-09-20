// ============================================================
// LEGALIR — Settings · Subscription (اشتراک)
// ============================================================
// The ONLY surface that shows the fuller subscription picture:
// current plan, status, expiry / days remaining, renewal & upgrade
// actions, and the plan's benefits. Every value comes from the
// canonical useSubscriptionStatus / useEntitlements hooks — this page
// never computes days or status on its own.
// ============================================================

"use client";

import { SettingsShell } from "@/components/settings/settings-shell";
import { SettingsCard, SkeletonBlock } from "@/components/settings/settings-ui";
import { SubscriptionStatusDetails } from "@/components/subscription/subscription-status";
import { useEntitlements } from "@/hooks/useSubscription";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconSubscription, IconCheck } from "@/lib/icons";
import type { Entitlement } from "@legalir/types";

const PERIOD_FA: Record<Entitlement["period"], string> = {
  day: "روزانه",
  week: "هفتگی",
  month: "ماهانه",
  year: "سالانه",
  forever: "نامحدود",
};

/** Human-readable limit for a benefit row. */
function limitLabel(e: Entitlement): string {
  if (e.isBoolean) return e.isEnabled ? "فعال" : "غیرفعال";
  if (e.limit === null) return "نامحدود";
  return `${toPersianNumber(e.limit)} در ${PERIOD_FA[e.period]}`;
}

function BenefitsList() {
  const { data, isLoading, isError } = useEntitlements();

  if (isLoading) return <SkeletonBlock lines={4} />;
  if (isError || !data) {
    return <p className="text-body-2 text-muted">اطلاعات مزایا در دسترس نیست.</p>;
  }

  const enabled = data.entitlements.filter((e) => e.isEnabled);
  if (enabled.length === 0) {
    return <p className="text-body-2 text-muted">مزایایی برای این پلن ثبت نشده است.</p>;
  }

  return (
    <ul className="divide-y divide-divider/70">
      {enabled.map((e) => (
        <li key={e.featureKey} className="flex items-center justify-between gap-4 py-3">
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
              <IconCheck size={14} />
            </span>
            <span className="text-body-2 text-on-surface truncate">{e.nameFa}</span>
          </span>
          <span className="shrink-0 text-caption text-muted tabular-nums">{limitLabel(e)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function SubscriptionSettingsPage() {
  return (
    <SettingsShell
      title="اشتراک"
      description="وضعیت پلن فعلی، تاریخ پایان و مزایای اشتراک شما."
    >
      <SettingsCard title="وضعیت اشتراک" icon={<IconSubscription size={22} />}>
        <SubscriptionStatusDetails />
      </SettingsCard>

      <SettingsCard title="مزایای پلن" icon={<IconCheck size={22} />}>
        <BenefitsList />
      </SettingsCard>
    </SettingsShell>
  );
}
