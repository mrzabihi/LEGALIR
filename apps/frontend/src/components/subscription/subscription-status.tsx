// ============================================================
// LEGALIR — SubscriptionStatus (reusable account-status component)
// ============================================================
// One component, three placements. Every variant reads the SAME canonical
// state from useSubscriptionStatus — no surface computes days or status
// on its own.
//
//   chip     → header (desktop + mobile), next to the avatar
//   badge    → the «اشتراک» sidebar item
//   details  → settings section (fuller information)
//
// States handled: active · expiring_soon · expired · free · loading.
// ============================================================

"use client";

import Link from "next/link";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import type { SubscriptionState, SubscriptionStatusView } from "@/lib/subscription";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import {
  IconChevronRight,
  IconPlanSilver,
  IconPlanGold,
  IconPlanDiamond,
} from "@/lib/icons";
import type { PlanCode } from "@legalir/types";

// ============================================================
// Plan tier — icon + motion + colour per plan
// ============================================================
// The tier is conveyed by SHAPE (sparkle / star / gem) and by the speed
// of the sheen sweep, not by colour alone. Two colour sets are needed
// because the badge sits on the dark warm-glass sidebar while the chip
// sits on the light header surface.

type PlanIconComponent = React.ComponentType<{ size?: number; className?: string }>;

const PLAN_TIER: Record<
  PlanCode,
  { icon: PlanIconComponent; motion: string; onDark: string; onLight: string }
> = {
  silver: {
    icon: IconPlanSilver,
    motion: "plan-icon--silver",
    onDark: "text-neutral-200",
    onLight: "text-neutral-500",
  },
  gold: {
    icon: IconPlanGold,
    motion: "plan-icon--gold",
    onDark: "text-secondary-300",
    onLight: "text-secondary-600",
  },
  diamond: {
    icon: IconPlanDiamond,
    motion: "plan-icon--diamond",
    onDark: "text-info-200",
    onLight: "text-info-600",
  },
};

/**
 * The animated plan-tier glyph. Renders nothing for a free user (no tier).
 * `tone` picks the colour set for the surface it sits on.
 */
function PlanIcon({
  planCode,
  size = 12,
  tone = "onLight",
  className = "",
}: {
  planCode: PlanCode | null;
  size?: number;
  tone?: "onDark" | "onLight";
  className?: string;
}) {
  if (!planCode) return null;
  const tier = PLAN_TIER[planCode];
  const Icon = tier.icon;
  return (
    <span className={`plan-icon rounded-full ${tier.motion} ${className}`} aria-hidden="true">
      <Icon size={size} className={tier[tone]} />
    </span>
  );
}

/** Semantic tone per state — never colour-only (each carries a label). */
const TONE: Record<SubscriptionState, { dot: string; text: string; chip: string }> = {
  active: {
    dot: "bg-success",
    text: "text-success",
    chip: "bg-success/10 text-success border-success/25",
  },
  expiring_soon: {
    dot: "bg-warning",
    text: "text-warning",
    chip: "bg-warning/10 text-warning border-warning/30",
  },
  expired: {
    dot: "bg-error",
    text: "text-error",
    chip: "bg-error/10 text-error border-error/25",
  },
  free: {
    dot: "bg-muted",
    text: "text-muted",
    chip: "bg-surface-container-high text-on-surface-variant border-outline-variant",
  },
  loading: {
    dot: "bg-muted",
    text: "text-muted",
    chip: "bg-surface-container-high text-on-surface-variant border-outline-variant",
  },
};

/** Short plan label for tight surfaces: «الماس» or «رایگان». */
function planLabel(s: SubscriptionStatusView): string {
  return s.planNameFa ?? "رایگان";
}

/** Compact remaining label: «۲۸ روز» / «منقضی». */
function shortRemaining(s: SubscriptionStatusView): string {
  if (s.state === "free") return "بدون اشتراک";
  if (s.state === "expired") return "منقضی";
  return `${toPersianNumber(s.daysRemaining)} روز`;
}

/** Accessible description used as aria-label on every variant. */
function ariaLabel(s: SubscriptionStatusView): string {
  if (s.state === "loading") return "در حال بارگذاری وضعیت اشتراک";
  if (s.state === "free") return "اشتراک: پلن رایگان، اشتراک فعال ندارید";
  return `اشتراک: ${planLabel(s)}، ${s.remainingLabelFa}`;
}

// ============================================================
// chip — header placement (desktop + mobile)
// ============================================================

export function SubscriptionStatusChip({ className = "" }: { className?: string }) {
  const { status, isLoading } = useSubscriptionStatus();
  const tone = TONE[status.state];

  if (isLoading) {
    return (
      <span
        className={`inline-flex h-8 w-20 animate-pulse rounded-xl bg-surface-container-high ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <Link
      href="/subscription"
      className={`group inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 transition-colors hover:brightness-[0.97] touch-target-min ${tone.chip} ${className}`}
      aria-label={ariaLabel(status)}
      title={ariaLabel(status)}
    >
      {status.planCode ? (
        <PlanIcon planCode={status.planCode} size={13} tone="onLight" />
      ) : (
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
      )}
      <span className="text-labelSmall font-semibold whitespace-nowrap">{planLabel(status)}</span>
      <span className="hidden tablet:inline text-labelSmall opacity-70 whitespace-nowrap" aria-hidden="true">
        •
      </span>
      <span className="hidden tablet:inline text-labelSmall font-medium whitespace-nowrap" aria-hidden="true">
        {shortRemaining(status)}
      </span>
    </Link>
  );
}

// ============================================================
// badge — tiny plan pill for narrow surfaces (sidebar card)
// ============================================================

export function SubscriptionStatusBadge({ className = "" }: { className?: string }) {
  const { status, isLoading } = useSubscriptionStatus();
  const tone = TONE[status.state];

  if (isLoading) {
    return <span className={`inline-block h-4 w-12 animate-pulse rounded-full bg-surface-container-high ${className}`} aria-hidden="true" />;
  }

  // On the dark warm-glass sidebar the semantic tone colours fail contrast,
  // so the badge uses the sidebar's own ivory foreground: white text, white
  // border, translucent white fill. The plan tier is carried by the animated
  // glyph instead of by colour.
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[rgba(255,249,240,0.45)] bg-[rgba(255,249,240,0.12)] px-2 py-0.5 text-[10px] font-semibold text-glass-ivory whitespace-nowrap ${className}`}
      aria-label={ariaLabel(status)}
    >
      {status.planCode ? (
        <PlanIcon planCode={status.planCode} size={11} tone="onDark" />
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
      )}
      {planLabel(status)}
    </span>
  );
}

// ============================================================
// details — settings section (fuller information)
// ============================================================

export function SubscriptionStatusDetails({ className = "" }: { className?: string }) {
  const { status, isLoading, isError, refetch } = useSubscriptionStatus();
  const tone = TONE[status.state];

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`} aria-busy="true">
        <div className="h-5 w-1/3 animate-pulse rounded bg-divider" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-divider" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`flex flex-col items-start gap-2 ${className}`} role="alert">
        <p className="text-body-2 text-error">خطا در دریافت وضعیت اشتراک</p>
        <button
          onClick={refetch}
          className="rounded-full px-3 py-1.5 text-body-2 text-primary hover:bg-primary/10 transition-colors touch-target"
        >
          تلاش مجدد
        </button>
      </div>
    );
  }

  const isFree = status.state === "free";

  return (
    <div className={className}>
      {/* Plan + status */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-body-1 text-on-surface font-semibold">
          <PlanIcon planCode={status.planCode} size={18} tone="onLight" />
          {isFree ? "پلن رایگان" : planLabel(status)}
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption font-medium ${tone.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
          {status.statusLabelFa}
        </span>
      </div>

      {/* Remaining / expiry */}
      <dl className="mt-4 grid grid-cols-1 tablet:grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <dt className="text-caption text-muted">روزهای باقی‌مانده</dt>
          <dd className={`text-body-1 font-medium tabular-nums ${isFree ? "text-muted" : tone.text}`}>
            {isFree ? "—" : `${toPersianNumber(status.daysRemaining)} روز`}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted">تاریخ پایان</dt>
          <dd className="text-body-1 text-on-surface font-medium">
            {status.endAt ? toPersianDate(status.endAt) : "—"}
          </dd>
        </div>
      </dl>

      {/* Action */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/subscription"
          className="inline-flex items-center gap-1.5 rounded-medium bg-primary-700 text-white px-5 py-2.5 text-button font-medium hover:bg-primary-800 transition-colors touch-target"
        >
          {status.canRenew ? "تمدید اشتراک" : isFree ? "مشاهده پلن‌ها" : "مدیریت اشتراک"}
          <IconChevronRight size={16} rtlFlip />
        </Link>
        {status.canUpgrade && !isFree && (
          <Link
            href="/subscription"
            className="inline-flex items-center gap-1.5 rounded-medium border border-divider px-5 py-2.5 text-button font-medium text-on-surface hover:bg-surface-hover transition-colors touch-target"
          >
            ارتقای اشتراک
          </Link>
        )}
      </div>
    </div>
  );
}
