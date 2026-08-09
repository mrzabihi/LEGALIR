"use client";

import { useState } from "react";
import {
  useCurrentSubscription,
  useEntitlements,
  useUsage,
  usePlansV1,
  useCheckoutIntent,
  useCheckoutIntentPoll,
} from "@/hooks/useSubscription";
import { useQuery } from "@tanstack/react-query";
import { fetchSubscriptionHistory } from "@/lib/api/v1";
import { SkeletonCard, Button, ProgressLinear, ConfirmDialog } from "@legalir/ui";
import { toPersianNumber, toPersianDate, toPersianCurrency } from "@/lib/persian-utils";
import { IconCheck, IconCheckCircle, IconWarning, IconHistory } from "@/lib/icons";
import type { Plan, PlanCode, PaymentStatus, V1SubscriptionHistoryItem } from "@legalir/types";

// ============================================================
// Constants
// ============================================================

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  idle: "آماده",
  creating: "در حال ایجاد",
  pending: "در انتظار پرداخت",
  paid: "پرداخت شده",
  failed: "ناموفق",
  cancelled: "لغو شده",
};

const PAYMENT_STATUS_VARIANTS: Record<PaymentStatus, string> = {
  idle: "bg-surface text-muted",
  creating: "bg-warning/10 text-warning",
  pending: "bg-warning/10 text-warning",
  paid: "bg-success/10 text-success",
  failed: "bg-error/10 text-error",
  cancelled: "bg-surfaceVariant text-muted",
};

const PLAN_ORDER: PlanCode[] = ["silver", "gold", "diamond"];

// ============================================================
// Sub-components
// ============================================================

function UsageMeter({
  label,
  used,
  limit,
  featureKey: _featureKey,
}: {
  label: string;
  used: number;
  limit: number | null;
  featureKey: string;
}) {
  if (limit === null) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-body-2 text-on-surface">{label}</span>
        <span className="text-body-2 text-success flex items-center gap-1">
          <IconCheckCircle size={16} />
          نامحدود
        </span>
      </div>
    );
  }

  const pct = Math.min(Math.round((used / limit) * 100), 100);
  const isNearLimit = pct >= 80 && pct < 100;
  const isExhausted = pct >= 100;
  const remaining = Math.max(limit - used, 0);

  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-body-2 text-on-surface">{label}</span>
        <span className="text-caption text-muted">
          <span className={isExhausted ? "text-error" : isNearLimit ? "text-warning" : ""}>
            {toPersianNumber(remaining)}
          </span>
          {" / "}
          {toPersianNumber(limit)}
          {" باقی‌مانده"}
        </span>
      </div>
      <ProgressLinear
        value={used}
        max={limit}
        color={isExhausted ? "error" : isNearLimit ? "secondary" : "primary"}
        size="small"
      />
    </div>
  );
}

function CurrentSubscriptionCard({
  subscription: sub,
  isLoading,
  isError,
  onRefresh,
}: {
  subscription: ReturnType<typeof useCurrentSubscription>["data"];
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
}) {
  if (isLoading) {
    return (
      <div className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <SkeletonCard lines={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <p className="text-body-2 text-error mb-3">خطا در دریافت وضعیت اشتراک</p>
        <Button variant="text" onClick={onRefresh}>
          تلاش مجدد
        </Button>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <div className="flex items-start gap-3">
          <IconWarning size={24} className="text-warning shrink-0 mt-0.5" />
          <div>
            <h2 className="text-h3 text-on-surface mb-1">بدون اشتراک فعال</h2>
            <p className="text-body-2 text-muted">
              شما در حال حاضر اشتراک فعالی ندارید. یکی از پلن‌های زیر را انتخاب کنید.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isActive = sub.status === "active";
  const isExpired = sub.status === "expired";
  const isCancelled = sub.status === "cancelled";

  const statusLabel = isActive ? "فعال" : isExpired ? "منقضی شده" : isCancelled ? "لغو شده" : sub.status;
  const statusColor = isActive
    ? "bg-success/10 text-success"
    : isExpired
      ? "bg-error/10 text-error"
      : "bg-surfaceVariant text-muted";

  const daysLeft = Math.max(0, Math.ceil((new Date(sub.endAt).getTime() - Date.now()) / 86_400_000));

  return (
    <div className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
      <div className="flex flex-col tablet:flex-row tablet:items-center tablet:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-h3 text-on-surface mb-1">وضعیت اشتراک</h2>
          <div className="flex items-center gap-3">
            <span className="text-body-1 text-on-surface font-medium">{sub.planNameFa}</span>
            <span className={`rounded-full px-3 py-0.5 text-caption font-medium ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {isActive && (
          <div className="text-right">
            <div className="text-caption text-muted">
              {daysLeft > 0
                ? `${toPersianNumber(daysLeft)} روز تا تمدید`
                : "امروز منقضی می‌شود"}
            </div>
            <div className="text-caption text-muted mt-0.5">
              تاریخ پایان: {toPersianDate(sub.endAt)}
            </div>
          </div>
        )}
      </div>

      {/* Auto-renewal */}
      <div className="flex items-center gap-2 text-caption text-muted mb-3">
        <span>تمدید خودکار:</span>
        {sub.autoRenew ? (
          <span className="text-success flex items-center gap-1">
            <IconCheckCircle size={14} />
            فعال
          </span>
        ) : (
          <span className="text-muted">غیرفعال</span>
        )}
      </div>

      {/* Expiry warning */}
      {isActive && daysLeft <= 3 && daysLeft > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-medium bg-warning/5 border border-warning/20 text-caption text-warning mb-3">
          <IconWarning size={16} className="shrink-0" />
          اشتراک شما به زودی منقضی می‌شود. لطفاً آن را تمدید کنید.
        </div>
      )}

      {/* Expired banner */}
      {(isExpired || isCancelled) && (
        <div className="flex items-center gap-2 p-3 rounded-medium bg-error/5 border border-error/20 text-caption text-error">
          <IconWarning size={16} className="shrink-0" />
          {isExpired
            ? "اشتراک شما منقضی شده است. برای ادامه استفاده، یکی از پلن‌ها را خریداری کنید."
            : "اشتراک شما لغو شده است. برای فعال‌سازی مجدد، یکی از پلن‌ها را انتخاب کنید."}
        </div>
      )}
    </div>
  );
}

function UsageSummaryCard({
  usage,
  entitlements,
  isLoading,
  isError,
  onRefresh,
}: {
  usage: ReturnType<typeof useUsage>["data"];
  entitlements: ReturnType<typeof useEntitlements>["data"];
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
}) {
  if (isLoading) {
    return (
      <div className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <SkeletonCard lines={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <p className="text-body-2 text-error mb-3">خطا در دریافت اطلاعات مصرف</p>
        <Button variant="text" onClick={onRefresh}>
          تلاش مجدد
        </Button>
      </div>
    );
  }

  const entList = entitlements?.entitlements ?? [];
  const nonBooleanEnts = entList.filter((e) => !e.isBoolean);

  if (nonBooleanEnts.length === 0) {
    return (
      <div className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <h2 className="text-h3 text-on-surface mb-4">مصرف</h2>
        <p className="text-body-2 text-muted">اطلاعات مصرفی برای نمایش وجود ندارد.</p>
      </div>
    );
  }

  return (
    <div className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-h3 text-on-surface">مصرف</h2>
        {usage && (
          <span className="text-caption text-muted">
            {toPersianNumber(usage.daysRemaining)} روز تا بازنشانی
          </span>
        )}
      </div>
      <div className="space-y-1">
        {nonBooleanEnts.map((ent) => (
          <UsageMeter
            key={ent.featureKey}
            featureKey={ent.featureKey}
            label={ent.nameFa}
            used={ent.used}
            limit={ent.limit}
          />
        ))}
      </div>
      {/* Boolean entitlements */}
      {entList.filter((e) => e.isBoolean).length > 0 && (
        <div className="mt-4 pt-4 border-t border-divider">
          <h3 className="text-body-2 text-muted mb-2">قابلیت‌های ویژه</h3>
          <div className="space-y-1">
            {entList
              .filter((e) => e.isBoolean)
              .map((ent) => (
                <div key={ent.featureKey} className="flex items-center justify-between py-1">
                  <span className="text-body-2 text-on-surface">{ent.nameFa}</span>
                  {ent.isEnabled ? (
                    <span className="text-caption text-success flex items-center gap-1">
                      <IconCheckCircle size={14} />
                      فعال
                    </span>
                  ) : (
                    <span className="text-caption text-muted">غیرفعال</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentHistoryList({
  items,
  isLoading,
  isError,
  onRefresh,
}: {
  items: V1SubscriptionHistoryItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
}) {
  if (isLoading) {
    return (
      <div className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <SkeletonCard lines={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <p className="text-body-2 text-error mb-3">خطا در دریافت تاریخچه پرداخت</p>
        <Button variant="text" onClick={onRefresh}>
          تلاش مجدد
        </Button>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <div className="flex items-start gap-3">
          <IconHistory size={24} className="text-muted shrink-0 mt-0.5" />
          <div>
            <h2 className="text-h3 text-on-surface mb-1">تاریخچه پرداخت</h2>
            <p className="text-body-2 text-muted">
              هنوز هیچ پرداختی ثبت نشده است.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: "bg-success/10 text-success",
    expired: "bg-surfaceVariant text-muted",
    cancelled: "bg-error/10 text-error",
    unknown: "bg-warning/10 text-warning",
  };

  return (
    <div className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-h3 text-on-surface flex items-center gap-2">
          <IconHistory size={22} />
          تاریخچه پرداخت
        </h2>
      </div>

      <div className="overflow-x-auto -mx-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-divider">
              <th className="text-right py-3 px-4 text-caption text-muted font-medium">پلن</th>
              <th className="text-right py-3 px-4 text-caption text-muted font-medium">مبلغ</th>
              <th className="text-right py-3 px-4 text-caption text-muted font-medium">تاریخ خرید</th>
              <th className="text-right py-3 px-4 text-caption text-muted font-medium hidden tablet:table-cell">تاریخ پایان</th>
              <th className="text-right py-3 px-4 text-caption text-muted font-medium">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-divider/60 last:border-0 hover:bg-neutral-50 transition-colors">
                <td className="py-3 px-4 text-body-2 text-on-surface font-medium">
                  {item.planNameFa}
                </td>
                <td className="py-3 px-4 text-body-2 text-on-surface">
                  {toPersianCurrency(item.amount)}
                </td>
                <td className="py-3 px-4 text-caption text-on-surface">
                  {toPersianDate(item.purchasedAt)}
                </td>
                <td className="py-3 px-4 text-caption text-on-surface hidden tablet:table-cell">
                  {toPersianDate(item.endAt)}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={[
                      "rounded-full px-2.5 py-0.5 text-caption font-medium inline-block",
                      statusColors[item.status] ?? "bg-surfaceVariant text-muted",
                    ].join(" ")}
                  >
                    {item.statusFa}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlanSelectionCard({
  plan,
  isCurrent,
  isLocked,
  onSelect,
  isLoading,
}: {
  plan: Plan;
  isCurrent: boolean;
  isLocked: boolean;
  onSelect: (plan: Plan) => void;
  isLoading: boolean;
}) {
  return (
    <div
      className={[
        "rounded-large p-6 border flex flex-col transition-shadow",
        isCurrent
          ? "bg-primary/[0.04] border-primary shadow-elevation-1 ring-1 ring-primary/20"
          : "bg-surface border-divider shadow-elevation-1 hover:shadow-elevation-4",
        isLocked ? "opacity-60" : "",
      ].join(" ")}
    >
      <h3 className="text-h3 text-on-surface mb-1">{plan.nameFa}</h3>
      <p className="text-body-2 text-muted mb-4">{plan.descriptionFa}</p>

      {/* Pricing */}
      <div className="mb-4">
        <span className="text-body-2 text-muted line-through ml-2">
          {toPersianNumber(plan.listPrice)}
        </span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-h2 text-secondary font-bold">
            {toPersianNumber(plan.salePrice)}
          </span>
          <span className="text-body-2 text-muted">تومان</span>
        </div>
        <p className="text-caption text-muted mt-1">{plan.durationDays} روز</p>
      </div>

      {/* Usage limits summary */}
      <div className="mb-4 space-y-1">
        <div className="flex justify-between text-caption">
          <span className="text-muted">درخواست روزانه</span>
          <span className="text-on-surface">{toPersianNumber(plan.dailyRequestLimit)}</span>
        </div>
        <div className="flex justify-between text-caption">
          <span className="text-muted">توکن ماهانه</span>
          <span className="text-on-surface">{toPersianNumber(plan.totalTokenLimit)}</span>
        </div>
        {plan.usageLimits.map((ul) => (
          <div key={ul.featureKey} className="flex justify-between text-caption">
            <span className="text-muted">{ul.nameFa}</span>
            <span className="text-on-surface">{toPersianNumber(ul.limit)}</span>
          </div>
        ))}
      </div>

      {/* Features */}
      <ul className="space-y-2 mb-6 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="text-body-2 text-on-surface flex items-start gap-2">
            <IconCheck size={16} className="text-success mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* Action */}
      {isCurrent ? (
        <div className="rounded-medium bg-primary/10 text-primary text-center py-3 text-button">
          پلن فعلی
        </div>
      ) : (
        <Button
          variant="filled"
          onClick={() => onSelect(plan)}
          loading={isLoading}
          disabled={isLoading}
          className="w-full"
        >
          {PLAN_ORDER.indexOf(plan.code) > (plan.code === "silver" ? 0 : 1)
            ? "ارتقا به " + plan.nameFa
            : "انتخاب " + plan.nameFa}
        </Button>
      )}
    </div>
  );
}

// ============================================================
// ConfirmDialog — Plan selection confirmation
// ============================================================

function PlanConfirmDialog({
  open,
  plan,
  onClose,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  plan: Plan | null;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  if (!plan) return null;

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`انتخاب پلن ${plan.nameFa}`}
      description={`آیا از انتخاب پلن ${plan.nameFa} با قیمت ${toPersianNumber(plan.salePrice)} تومان به مدت ${plan.durationDays} روز اطمینان دارید؟`}
      confirmLabel="تأیید و پرداخت"
      cancelLabel="انصراف"
      loading={isLoading}
    />
  );
}

// ============================================================
// PaymentStatusBanner
// ============================================================

function PaymentStatusBanner({
  status,
  intentId,
  onRetry,
}: {
  status: PaymentStatus;
  intentId: string | null;
  onRetry: () => void;
}) {
  const label = PAYMENT_STATUS_LABELS[status];
  const variantClass = PAYMENT_STATUS_VARIANTS[status];

  return (
    <div className={`rounded-large p-4 mb-6 ${variantClass} border border-divider`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-body-2 font-medium">وضعیت پرداخت: {label}</p>
          {intentId && status !== "idle" && (
            <p className="text-caption mt-1 opacity-70">شناسه پرداخت: {intentId.slice(0, 8)}...</p>
          )}
        </div>
        {(status === "failed" || status === "cancelled") && (
          <Button variant="text" onClick={onRetry}>
            تلاش مجدد
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Page Component
// ============================================================

export default function SubscriptionPage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checkoutIntentId, setCheckoutIntentId] = useState<string | null>(null);

  const {
    data: subscription,
    isLoading: subLoading,
    isError: subError,
    refetch: refetchSub,
  } = useCurrentSubscription();

  const {
    data: entitlements,
    isLoading: entLoading,
    isError: entError,
    refetch: refetchEnt,
  } = useEntitlements();

  const {
    data: usage,
    isLoading: usageLoading,
    isError: usageError,
    refetch: refetchUsage,
  } = useUsage();

  const {
    data: plans,
    isLoading: plansLoading,
  } = usePlansV1();

  const checkoutMutation = useCheckoutIntent();
  const {
    data: checkoutStatus,
    isLoading: _pollingLoading,
  } = useCheckoutIntentPoll(checkoutIntentId);

  // Payment history
  const {
    data: historyData,
    isLoading: historyLoading,
    isError: historyError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["v1", "subscription-history"],
    queryFn: () => fetchSubscriptionHistory(),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // Determine payment status
  const paymentStatus: PaymentStatus = checkoutStatus?.status ?? "idle";

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setConfirmOpen(true);
  };

  const handleConfirmCheckout = async () => {
    if (!selectedPlan) return;
    try {
      const intent = await checkoutMutation.mutateAsync(selectedPlan.code);
      setCheckoutIntentId(intent.id);
      setConfirmOpen(false);
    } catch {
      // Error handled by mutation state
    }
  };

  const handleRetry = () => {
    setCheckoutIntentId(null);
    refetchSub();
  };

  const currentPlanCode = subscription?.planCode ?? null;

  return (
    <div className="p-4 tablet:p-6 max-w-4xl mx-auto">
      <h1 className="text-h2 text-on-surface mb-6">اشتراک</h1>

      {/* Payment Status */}
      {paymentStatus !== "idle" && (
        <PaymentStatusBanner
          status={paymentStatus}
          intentId={checkoutIntentId}
          onRetry={handleRetry}
        />
      )}

      {/* Current Subscription Card */}
      <CurrentSubscriptionCard
        subscription={subscription}
        isLoading={subLoading}
        isError={subError}
        onRefresh={() => refetchSub()}
      />

      {/* Usage Summary */}
      <UsageSummaryCard
        usage={usage}
        entitlements={entitlements}
        isLoading={entLoading || usageLoading}
        isError={entError || usageError}
        onRefresh={() => {
          refetchEnt();
          refetchUsage();
        }}
      />

      {/* Payment History */}
      <PaymentHistoryList
        items={historyData?.items}
        isLoading={historyLoading}
        isError={historyError}
        onRefresh={() => refetchHistory()}
      />

      {/* Plan Selection */}
      <h2 className="text-h3 text-on-surface mb-4">پلن‌ها</h2>

      {plansLoading ? (
        <div className="grid tablet:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-large bg-surface p-6 border border-divider">
              <SkeletonCard lines={4} />
            </div>
          ))}
        </div>
      ) : plans && plans.length > 0 ? (
        <div className="grid tablet:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PlanSelectionCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.code === currentPlanCode}
              isLocked={false}
              onSelect={handleSelectPlan}
              isLoading={checkoutMutation.isPending}
            />
          ))}
        </div>
      ) : null}

      {/* Confirmation Dialog */}
      <PlanConfirmDialog
        open={confirmOpen}
        plan={selectedPlan}
        onClose={() => {
          setConfirmOpen(false);
          setSelectedPlan(null);
        }}
        onConfirm={handleConfirmCheckout}
        isLoading={checkoutMutation.isPending}
      />

      {/* Error state for checkout mutation */}
      {checkoutMutation.isError && (
        <div className="mt-4 p-3 rounded-medium bg-error/5 border border-error/20 text-caption text-error">
          {(checkoutMutation.error as Error)?.message ?? "خطا در ایجاد درخواست پرداخت"}
        </div>
      )}
    </div>
  );
}
