"use client";

// ============================================================
// LEGALIR — Quota Exhausted Modal
// ============================================================
// Shown when a billable activity is blocked by the usage engine. The
// title and body switch on the structured error code so the user learns
// WHICH limit they hit:
//
//   • daily credit exhausted  → resets at Tehran midnight (countdown)
//   • a period service quota  → resets only at period end
//   • subscription expired    → renew
//
// The countdown is driven by the server's `resetAt`, never the client clock.
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog, Button } from "@legalir/ui";
import { toPersianNumber } from "@/lib/persian-utils";
import type { SubscriptionUsageSummary, UsageErrorCode } from "@legalir/types";

interface QuotaExhaustedModalProps {
  open: boolean;
  onClose: () => void;
  /** The structured error code from the engine (defaults to daily credit). */
  code?: string | null;
  /** The live usage summary returned with the 429. */
  usage?: SubscriptionUsageSummary | null;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function computeRemaining(resetAt: string | undefined): string {
  if (!resetAt) return "--:--:--";
  const diff = new Date(resetAt).getTime() - Date.now();
  if (diff <= 0) return "۰۰:۰۰:۰۰";
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  // Persian digits for a fully localized display.
  const fa = (v: string) => v.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
  return fa(`${pad(h)}:${pad(m)}:${pad(s)}`);
}

/** Remaining time until `resetAt`, formatted as HH:MM:SS (Persian digits). */
function useCountdown(resetAt: string | undefined): string {
  const [remaining, setRemaining] = useState(() => computeRemaining(resetAt));

  useEffect(() => {
    setRemaining(computeRemaining(resetAt));
    if (!resetAt) return;
    const id = setInterval(() => setRemaining(computeRemaining(resetAt)), 1000);
    return () => clearInterval(id);
  }, [resetAt]);

  return remaining;
}

/** Which period quota a code refers to, for the copy. */
const PERIOD_QUOTA_CODES: Partial<Record<UsageErrorCode, string>> = {
  AI_MESSAGE_LIMIT_EXCEEDED: "پیام هوش مصنوعی",
  TOKEN_LIMIT_EXCEEDED: "توکن",
  DOCUMENT_ANALYSIS_LIMIT_EXCEEDED: "تحلیل سند",
  CONTRACT_LIMIT_EXCEEDED: "قرارداد",
};

export function QuotaExhaustedModal({ open, onClose, code, usage }: QuotaExhaustedModalProps) {
  const resetAt = usage?.daily.resetAt;
  const countdown = useCountdown(resetAt);

  const expired = code === "SUBSCRIPTION_EXPIRED" || usage?.subscriptionExpired === true;
  const noSubscription = code === "NO_ACTIVE_SUBSCRIPTION";
  const periodQuotaName = code ? PERIOD_QUOTA_CODES[code as UsageErrorCode] : undefined;
  const isPeriodQuota = Boolean(periodQuotaName);

  const title = expired
    ? "اشتراک شما به پایان رسیده است"
    : noSubscription
      ? "اشتراک فعالی ندارید"
      : isPeriodQuota
        ? `سهمیه ${periodQuotaName} شما به پایان رسیده است`
        : "اعتبار امروز شما به پایان رسید";

  const description = expired
    ? "برای ادامه استفاده از خدمات هوشمند، اشتراک خود را تمدید کنید."
    : noSubscription
      ? "برای استفاده از این امکان، یک پلن تهیه کنید."
      : isPeriodQuota
        ? `سهمیه ${periodQuotaName} این دوره شما مصرف شده است. این سهمیه فقط در پایان دوره بازنشانی می‌شود.`
        : "اعتبار درخواست‌های امروز شما مصرف شده است. می‌توانید تا بازنشانی اعتبار صبر کنید یا اشتراک تهیه کنید.";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title={title}
      description={description}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            بستن
          </Button>
          <Link href="/subscription" onClick={onClose}>
            <Button variant="filled">
              {expired ? "تمدید اشتراک" : "خرید اشتراک"}
            </Button>
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {/* Countdown to reset — only meaningful for the daily credit */}
        {!isPeriodQuota && !noSubscription && (
          <div className="rounded-large bg-surfaceVariant/50 p-4 text-center">
            <p className="text-bodySmall text-onSurfaceVariant mb-2">
              زمان باقی‌مانده تا بازنشانی اعتبار
            </p>
            <p
              className="text-h2 font-bold text-primary tabular-nums"
              dir="ltr"
              aria-live="polite"
            >
              {countdown}
            </p>
            <p className="text-labelSmall text-muted mt-1">بازنشانی در نیمه‌شب به وقت تهران</p>
          </div>
        )}

        {/* Usage summary — today's credit and the persistent reward points */}
        {usage && (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-medium bg-surfaceVariant/30 px-4 py-3">
              <span className="text-bodySmall text-onSurfaceVariant">اعتبار امروز</span>
              <span className="text-labelMedium text-onSurface tabular-nums" dir="ltr">
                {toPersianNumber(usage.daily.pointsRemaining)} /{" "}
                {toPersianNumber(usage.daily.pointsTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-medium bg-surfaceVariant/30 px-4 py-3">
              <span className="text-bodySmall text-onSurfaceVariant">امتیازهای شما</span>
              <span className="text-labelMedium text-onSurface tabular-nums" dir="ltr">
                {toPersianNumber(usage.rewardPoints)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
