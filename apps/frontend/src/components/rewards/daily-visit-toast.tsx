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
import { IconCoin } from "@/lib/icons";

export function DailyVisitToast() {
  const claim = useClaimDailyVisit();
  const fired = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    // Idempotent: awarded=true only the first successful claim of the day.
    claim
      .mutateAsync()
      .then((res) => {
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
