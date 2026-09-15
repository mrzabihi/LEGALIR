"use client";

// ============================================================
// LEGALIR — Quota Exhausted Modal
// ============================================================
// Shown when the user's daily request allowance is fully consumed
// (or their subscription has lapsed). Displays a live countdown to
// the next reset (Tehran midnight, from the server clock) and a CTA
// to purchase/upgrade a subscription.
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog, Button } from "@legalir/ui";
import type { V1DailyQuota } from "@legalir/types";

interface QuotaExhaustedModalProps {
  open: boolean;
  onClose: () => void;
  quota: V1DailyQuota | null;
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

export function QuotaExhaustedModal({ open, onClose, quota }: QuotaExhaustedModalProps) {
  const countdown = useCountdown(quota?.resetAt);
  const expired = quota?.subscriptionExpired ?? false;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title={expired ? "اشتراک شما به پایان رسیده است" : "سهمیه درخواست امروز به پایان رسید"}
      description={
        expired
          ? "برای ادامه استفاده از خدمات هوشمند، اشتراک خود را تمدید کنید."
          : "سهمیه درخواست‌های امروز شما مصرف شده است. می‌توانید تا بازنشانی سهمیه صبر کنید یا اشتراک تهیه کنید."
      }
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
        {/* Countdown to reset */}
        <div className="rounded-large bg-surfaceVariant/50 p-4 text-center">
          <p className="text-bodySmall text-onSurfaceVariant mb-2">
            زمان باقی‌مانده تا بازنشانی سهمیه
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

        {/* Usage summary */}
        {quota && (
          <div className="flex items-center justify-between rounded-medium bg-surfaceVariant/30 px-4 py-3">
            <span className="text-bodySmall text-onSurfaceVariant">مصرف امروز</span>
            <span className="text-labelMedium text-onSurface tabular-nums" dir="ltr">
              {quota.used} / {quota.total}
            </span>
          </div>
        )}
      </div>
    </Dialog>
  );
}
