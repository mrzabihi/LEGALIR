// ============================================================
// LEGALIR — Points Summary Card (Dashboard)
// ============================================================
// The 5th dashboard stat card. It reads the SAME source of truth as the
// header badge — `useRewardsSummary()` → GET /api/v1/rewards/summary — so
// the two can never disagree. The mini bar chart is fed by the real reward
// ledger (GET /api/v1/rewards/history); no point amount is computed or
// hard-coded on the client.
// ============================================================

"use client";

import Link from "next/link";
import { useRewardsSummary, useRewardsHistory } from "@/hooks/useRewards";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconCoin } from "@/lib/icons";

/** How many recent ledger entries the mini chart shows. */
const BAR_COUNT = 6;

export function PointsSummaryCard() {
  const summary = useRewardsSummary();
  const history = useRewardsHistory(1, BAR_COUNT);

  const balance = summary.data?.balance;
  const items = history.data?.items ?? [];
  const last = items[0];

  // Oldest → newest, so the most recent change sits at the reading edge.
  const bars = [...items].reverse();
  const peak = bars.reduce((max, b) => Math.max(max, Math.abs(b.pointsDelta)), 0);

  const lastPositive = last ? last.pointsDelta >= 0 : true;

  const ariaLabel = [
    "امتیاز من",
    balance !== undefined ? `${toPersianNumber(balance)} امتیاز` : "در حال بارگذاری",
    last
      ? `آخرین تغییر ${lastPositive ? "مثبت" : "منفی"} ${toPersianNumber(Math.abs(last.pointsDelta))} امتیاز`
      : null,
    "مشاهده جزئیات امتیازها",
  ]
    .filter(Boolean)
    .join("، ");

  return (
    <Link
      href="/points"
      aria-label={ariaLabel}
      className="group relative col-span-2 tablet:col-span-1 overflow-hidden rounded-xl bg-[linear-gradient(135deg,rgba(176,141,87,0.28),rgba(163,124,60,0.10))] text-secondary-100 border border-white/10 backdrop-blur p-4 flex flex-col gap-2 transition-colors duration-300 hover:border-[rgba(213,190,151,0.40)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(213,190,151,0.70)]"
    >
      {/* soft glow that intensifies on hover */}
      <span
        className="pointer-events-none absolute -top-8 -end-8 w-24 h-24 rounded-full bg-[rgba(195,165,116,0.20)] blur-2xl transition-opacity duration-500 opacity-60 group-hover:opacity-100"
        aria-hidden="true"
      />

      {/* Title row */}
      <div className="relative flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[rgba(195,165,116,0.20)] text-secondary-200 ring-1 ring-inset ring-[rgba(213,190,151,0.20)] transition-transform duration-300 group-hover:scale-105">
          <IconCoin size={18} />
        </span>
        <span className="text-caption text-[color:color-mix(in_srgb,var(--color-secondary-100)_90%,transparent)] font-medium">امتیاز من</span>
      </div>

      {/* Balance — the card's primary value */}
      <div className="relative">
        {summary.isLoading ? (
          <span className="block h-7 w-20 rounded-md bg-white/15 animate-pulse" aria-hidden="true" />
        ) : summary.isError ? (
          <p className="text-h3 text-white font-bold" aria-hidden="true">—</p>
        ) : (
          <p className="text-h3 text-white font-bold tabular-nums" dir="ltr">
            {toPersianNumber(balance ?? 0)}
          </p>
        )}
        <p className="text-caption text-[color:color-mix(in_srgb,var(--color-secondary-100)_70%,transparent)] mt-0.5">امتیاز</p>
      </div>

      {/* Mini consumption chart — real ledger data, decorative */}
      {bars.length > 0 && (
        <div className="relative flex items-end gap-1 h-8 mt-auto" aria-hidden="true">
          {bars.map((b) => {
            const h =
              peak > 0 ? Math.max(12, Math.round((Math.abs(b.pointsDelta) / peak) * 100)) : 12;
            return (
              <span
                key={b.id}
                className={`flex-1 rounded-sm ${
                  b.pointsDelta >= 0
                    ? "bg-[color-mix(in_srgb,var(--color-success-400)_80%,transparent)]"
                    : "bg-[color-mix(in_srgb,var(--color-error-400)_80%,transparent)]"
                }`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
      )}

      {/* Last change */}
      <div className="relative flex items-center justify-between gap-2 pt-1 border-t border-white/10">
        <span className="text-[10px] text-[color:color-mix(in_srgb,var(--color-secondary-100)_70%,transparent)]">آخرین تغییر</span>
        {history.isLoading ? (
          <span className="block h-3 w-10 rounded bg-white/15 animate-pulse" aria-hidden="true" />
        ) : last ? (
          <span
            className={`text-caption font-semibold tabular-nums ${lastPositive ? "text-emerald-300" : "text-red-300"}`}
            dir="ltr"
          >
            {lastPositive ? "+" : ""}
            {toPersianNumber(last.pointsDelta)}
          </span>
        ) : (
          <span className="text-caption text-[color:color-mix(in_srgb,var(--color-secondary-100)_50%,transparent)]">—</span>
        )}
      </div>
    </Link>
  );
}
