// ============================================================
// LEGALIR — Subscription Usage Card (Dashboard)
// ============================================================
// Renders the usage engine's summary as TWO clearly separate assets:
//
//   1) اعتبار امروز اشتراک — today's subscription credit. Resets at
//      Tehran midnight and never carries over.
//   2) امتیازهای شما       — reward points. A persistent ledger that is
//      NEVER reset by the daily rollover.
//
// Below them, the period-scoped service quotas (tokens, AI messages,
// document analysis, contracts) which reset only at period end.
//
// Every number comes from GET /api/v1/subscription/usage — nothing is
// computed or hard-coded on the client.
// ============================================================

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@legalir/ui";
import { useSubscriptionUsage } from "@/hooks/useSubscription";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IconBolt,
  IconCalendar,
  IconChevronRight,
  IconCoin,
  IconDocument,
  IconChat,
  IconContract,
  IconDatabase,
} from "@/lib/icons";
import type { PeriodQuotaView, ServiceQuotaType } from "@legalir/types";

const QUOTA_ICON: Record<ServiceQuotaType, typeof IconDocument> = {
  AI_MESSAGES: IconChat,
  TOKENS: IconDatabase,
  DOCUMENT_ANALYSIS: IconDocument,
  CONTRACT_DRAFT: IconContract,
  CONTRACT_CREATION: IconContract,
};

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

// ============================================================
// AssetCard — the one anatomy both usage assets share
// ============================================================
// «اعتبار امروز اشتراک» and «امتیازهای شما» are two different assets, but
// they sit side by side in one row, so they must read as one group. Before
// this, the credit card carried a progress bar and a second caption while
// the points card did not, so the two boxes ended at different heights and
// their numbers sat on different baselines.
//
// This component fixes the anatomy for both:
//   • identical padding and border radius;
//   • the icon tile always top-start, 36px, title beside it;
//   • the note under the title is clamped to two lines and reserves those
//     two lines, so the number below starts at the same y in both cards;
//   • the main value is the first large element after the header, with its
//     unit («امتیاز») set at the same size in both;
//   • the footer note is pinned to the bottom (`mt-auto`), so unequal
//     copy never misaligns the pair.
// Colour is the only axis that differs — green for the day's credit, gold
// for the persistent points — and it is passed as one `tone` token.
// ============================================================

type AssetTone = "green" | "gold";

/** The shared anatomy — one source of truth for both asset cards. */
const ASSET_SHELL =
  "flex h-full flex-col rounded-medium border bg-surface p-4 transition-colors duration-short4";
const ASSET_HEAD = "flex items-start gap-2.5";
const ASSET_TILE = "flex h-9 w-9 shrink-0 items-center justify-center rounded-medium";
/** Reserves two lines so the number starts on the same baseline in both cards. */
const ASSET_NOTE = "mt-0.5 line-clamp-2 min-h-10 text-caption leading-5 text-muted";
const ASSET_VALUE = "mt-1 text-h3 font-bold tabular-nums text-on-surface";
const ASSET_FOOT = "mt-auto pt-3 text-caption leading-5 text-muted";

const ASSET_TONE: Record<AssetTone, { card: string; tile: string }> = {
  green: {
    card: "border-[color:color-mix(in_srgb,var(--brand-green)_18%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--brand-green)_6%,transparent)]",
    tile: "bg-[color:color-mix(in_srgb,var(--brand-green)_12%,transparent)] text-[var(--brand-fg)]",
  },
  gold: {
    card: "border-[color:color-mix(in_srgb,var(--brand-gold)_28%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--brand-gold)_6%,transparent)]",
    tile: "bg-[color:color-mix(in_srgb,var(--brand-gold)_16%,transparent)] text-[var(--brand-fg-gold)]",
  },
};

interface AssetCardProps {
  icon: ReactNode;
  title: string;
  note: string;
  value: string;
  /** The printed ceiling, e.g. «از ۵۰۰» — omitted when there is none. */
  total?: string;
  /** The unit, printed at the same size in every asset card. */
  unit: string;
  /** Progress under the value. Omitted → the space stays empty. */
  progress?: ReactNode;
  footer: ReactNode;
  tone: AssetTone;
  /** Present → the whole card is a link to the asset's own surface. */
  href?: string;
}

function AssetCard({
  icon,
  title,
  note,
  value,
  total,
  unit,
  progress,
  footer,
  tone,
  href,
}: AssetCardProps) {
  const t = ASSET_TONE[tone];

  const body = (
    <>
      <div className={ASSET_HEAD}>
        <span className={`${ASSET_TILE} ${t.tile}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-body-2 font-medium text-on-surface">{title}</p>
          <p className={ASSET_NOTE}>{note}</p>
        </div>
      </div>

      {/* The number is the first thing the eye lands on after the title.
          `tabular-nums` keeps the digits from shifting as values change. */}
      <p className={ASSET_VALUE}>
        {value}
        {total !== undefined && (
          <span className="ms-1 text-body-2 font-normal tabular-nums text-muted">
            از {total}
          </span>
        )}
        <span className="ms-1.5 text-body-2 font-normal text-muted">{unit}</span>
      </p>

      {progress}

      <p className={ASSET_FOOT}>{footer}</p>
    </>
  );

  const shell = `${ASSET_SHELL} ${t.card}`;

  if (href) {
    return (
      <Link href={href} className={`group ${shell}`}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}

/** A compact progress bar for one period quota. */
function QuotaRow({ quota }: { quota: PeriodQuotaView }) {
  const Icon = QUOTA_ICON[quota.quotaType] ?? IconDocument;
  const unlimited = quota.unlimited || quota.limit === null || quota.limit <= 0;
  const limit = quota.limit ?? 0;
  const percent = unlimited ? 0 : pct(quota.used, limit);
  const exhausted = !unlimited && quota.remaining === 0;

  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-medium bg-surface-container-high text-on-surface-variant">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-body-2 text-on-surface truncate">{quota.nameFa}</span>
          <span className="shrink-0 text-caption text-muted tabular-nums">
            {unlimited
              ? "نامحدود"
              : `${toPersianNumber(quota.used)} از ${toPersianNumber(limit)}`}
          </span>
        </div>
        {!unlimited && (
          <div
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high"
            role="progressbar"
            aria-valuenow={quota.used}
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-label={`مصرف ${quota.nameFa}`}
          >
            <span
              className={`block h-full rounded-full transition-all duration-medium2 ${
                exhausted ? "bg-error-500" : "bg-[var(--brand-green)]"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function SubscriptionUsageCard() {
  const { data, isLoading, isError, refetch } = useSubscriptionUsage();

  return (
    <section
      className="mb-6 rounded-large bg-[var(--dashboard-card-bg)] border border-[color:color-mix(in_srgb,var(--brand-green)_18%,transparent)] shadow-elevation-1 p-5"
      aria-label="مصرف و سهمیه"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-gradient-to-b from-[var(--brand-green)] to-[var(--brand-gold)]" aria-hidden="true" />
            <h3 className="text-titleMedium text-on-surface font-semibold">مصرف و سهمیه</h3>
          </div>
          <p className="text-caption text-muted mt-0.5">
            اعتبار امروز، سهمیه‌های دوره و امتیازهای شما
          </p>
        </div>
        <Link
          href="/settings/usage"
          className="hidden tablet:inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--brand-green)_25%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-green)_8%,transparent)] px-3.5 py-1.5 text-caption text-[var(--brand-fg)] font-medium hover:bg-[var(--brand-green)] hover:text-[var(--brand-ivory)] transition-colors duration-short4 touch-target-min"
        >
          جزئیات بیشتر
          <IconChevronRight size={14} rtlFlip />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
          <div className="h-28 rounded-medium bg-surface-container-high skeleton-shimmer" />
          <div className="h-28 rounded-medium bg-surface-container-high skeleton-shimmer" />
        </div>
      ) : isError || !data ? (
        <div className="rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-6 text-center">
          <p className="text-body-2 text-muted mb-3">خطا در دریافت اطلاعات مصرف</p>
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={() => refetch()}
          >
            تلاش مجدد
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── The two distinct assets ─────────────────────────── */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
            {/* 1) Today's subscription credit */}
            {data.hasSubscription ? (
              <AssetCard
                tone="green"
                icon={<IconBolt size={18} />}
                title="اعتبار امروز اشتراک"
                note="هر روز نیمه‌شب به وقت تهران بازنشانی می‌شود"
                value={toPersianNumber(data.daily.pointsRemaining)}
                total={toPersianNumber(data.daily.pointsTotal)}
                unit="امتیاز باقی‌مانده"
                progress={
                  <div
                    className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
                    role="progressbar"
                    aria-valuenow={data.daily.pointsUsed}
                    aria-valuemin={0}
                    aria-valuemax={data.daily.pointsTotal}
                    aria-label="اعتبار مصرف‌شدهٔ امروز"
                  >
                    <span
                      className="block h-full rounded-full bg-[var(--brand-green)] transition-all duration-medium2"
                      style={{ width: `${pct(data.daily.pointsUsed, data.daily.pointsTotal)}%` }}
                    />
                  </div>
                }
                footer={
                  <span className="tabular-nums">
                    {toPersianNumber(data.daily.requestsRemaining)} درخواست از{" "}
                    {toPersianNumber(data.daily.requestLimit)} باقی‌مانده
                  </span>
                }
              />
            ) : (
              <AssetCard
                tone="green"
                href="/subscription"
                icon={<IconBolt size={18} />}
                title="اعتبار امروز اشتراک"
                note="هر روز نیمه‌شب به وقت تهران بازنشانی می‌شود"
                value="بدون اشتراک"
                unit=""
                footer="برای دریافت اعتبار روزانه یک پلن تهیه کنید."
              />
            )}

            {/* 2) Reward points — a separate, persistent asset */}
            <AssetCard
              tone="gold"
              href="/points"
              icon={<IconCoin size={18} />}
              title="امتیازهای شما"
              note="دائمی — با بازنشانی روزانه از بین نمی‌رود"
              value={toPersianNumber(data.rewardPoints)}
              unit="امتیاز"
              footer={
                data.allowRewardPointsAfterLimit
                  ? "پس از پایان اعتبار روزانه قابل استفاده است"
                  : "برای دریافت پاداش فعالیت کنید"
              }
            />
          </div>

          {/* ── Period-scoped service quotas ────────────────────── */}
          {data.hasSubscription && data.period.length > 0 && (
            <div className="rounded-medium border border-[color:color-mix(in_srgb,var(--brand-green)_14%,transparent)] bg-surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-medium bg-surface-container-high text-on-surface-variant">
                  <IconCalendar size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-2 text-on-surface font-medium">سهمیه‌های دوره</p>
                  <p className="text-caption text-muted">
                    {data.daysRemaining !== null
                      ? `${toPersianNumber(data.daysRemaining)} روز تا پایان دوره`
                      : "در پایان دوره بازنشانی می‌شود"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 tablet:grid-cols-2 gap-x-6 gap-y-3">
                {data.period.map((q) => (
                  <QuotaRow key={q.quotaType} quota={q} />
                ))}
              </div>
            </div>
          )}

          {/* Mobile action */}
          <Link
            href="/settings/usage"
            className="tablet:hidden flex w-full items-center justify-center gap-1 rounded-medium border border-[color:color-mix(in_srgb,var(--brand-green)_22%,transparent)] px-4 py-2.5 text-body-2 text-[var(--brand-fg)] font-medium hover:bg-[color:color-mix(in_srgb,var(--brand-green)_8%,transparent)] transition-colors duration-short4 touch-target"
          >
            جزئیات بیشتر
            <IconChevronRight size={16} rtlFlip />
          </Link>
        </div>
      )}
    </section>
  );
}
