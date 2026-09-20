// ============================================================
// LEGALIR — Daily Visit Reward (auto-claim on app entry)
// Fires the idempotent claim once per mount, and shows a subtle
// toast when +100 points are actually awarded. The claim is
// backend-idempotent, so multi-tab / refresh can never double-award.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { useClaimDailyVisit } from "@/hooks/useRewards";
import { toPersianNumber } from "@/lib/persian-utils";
import { tehranDateString } from "@/lib/rewards";
import { IconCoin } from "@/lib/icons";

/**
 * Remembers the Tehran business day of the last successful claim so a
 * hard reload does not re-hit the endpoint. The server stays the real
 * guard (the claim is idempotent per day); this only spares the network
 * round-trip that used to be the slowest call on every page load.
 */
const CLAIMED_DAY_KEY = "legalir-daily-visit-claimed";

export function DailyVisitToast() {
  const claim = useClaimDailyVisit();
  const fired = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const today = tehranDateString();
    try {
      if (window.localStorage.getItem(CLAIMED_DAY_KEY) === today) return;
    } catch {
      // Storage unavailable (private mode) — fall through and let the
      // server's idempotency handle it.
    }

    // Idempotent: awarded=true only the first successful claim of the day.
    claim
      .mutateAsync()
      .then((res) => {
        try {
          window.localStorage.setItem(CLAIMED_DAY_KEY, today);
        } catch {
          // Non-fatal: the server still guards against a double award.
        }
        if (res.awarded) {
          setMessage(`+${toPersianNumber(res.points)} امتیاز — امتیاز حضور امروز به حساب شما اضافه شد.`);
        }
      })
      .catch(() => {
        // Silent: claiming is best-effort; never block the dashboard on it.
      });
  }, [claim]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up-fade flex items-center gap-2 rounded-xl bg-emerald-600 text-white pl-4 pr-5 py-3 text-body-2 shadow-elevation-8 motion-reduce:transition-none"
    >
      <IconCoin size={18} />
      <span>{message}</span>
    </div>
  );
}
