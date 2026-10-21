// ============================================================
// LEGALIR — Points Summary Card (Dashboard)
// ============================================================
// The 5th dashboard stat card. It reads the SAME source of truth as the
// header badge — `useRewardsSummary()` → GET /api/v1/rewards/summary — so
// the two can never disagree. The mini bar chart is fed by the real reward
// ledger (GET /api/v1/rewards/history); no point amount is computed or
// hard-coded on the client.
//
// The card renders through `HeroStatCard`, so it shares the hero row's
// geometry (icon tile, value baseline, chart slot, pinned note) and differs
// from its siblings only by `tone="gold"`.
// ============================================================

"use client";

import { useRewardsSummary, useRewardsHistory } from "@/hooks/useRewards";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconCoin } from "@/lib/icons";
import { HeroStatCard } from "./hero-stat-card";

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
    <HeroStatCard
      tone="gold"
      href="/points"
      ariaLabel={ariaLabel}
      className="col-span-2 tablet:col-span-1"
      icon={<IconCoin size={18} />}
      title="امتیاز من"
      unit="امتیاز"
      value={
        summary.isLoading ? (
          <span
            className="inline-block h-6 w-20 animate-pulse rounded-md bg-white/15"
            aria-hidden="true"
          />
        ) : summary.isError ? (
          <span aria-hidden="true">—</span>
        ) : (
          toPersianNumber(balance ?? 0)
        )
      }
      note={
        <>
          <span className="truncate">آخرین تغییر</span>
          {history.isLoading ? (
            <span
              className="ms-auto block h-3 w-10 animate-pulse rounded bg-white/15"
              aria-hidden="true"
            />
          ) : last ? (
            <span
              className={`ms-auto shrink-0 font-semibold tabular-nums ${
                lastPositive ? "text-emerald-300" : "text-red-300"
              }`}
              dir="ltr"
            >
              {lastPositive ? "+" : ""}
              {toPersianNumber(last.pointsDelta)}
            </span>
          ) : (
            <span className="ms-auto shrink-0 text-white/50">—</span>
          )}
        </>
      }
    >
      {/* Mini consumption chart — real ledger data, decorative: every point
          amount is already stated in the value and the footer. */}
      {bars.length > 0 && (
        <div className="flex h-full items-end gap-1" aria-hidden="true">
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
    </HeroStatCard>
  );
}
