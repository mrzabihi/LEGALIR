"use client";

interface UsageBarProps {
  /** Daily used count */
  used: number;
  /** Daily limit */
  limit: number;
  /** Days remaining in current subscription period */
  daysRemaining?: number;
  /** Total used in the subscription period (e.g. monthly) */
  subscriptionUsed?: number;
  /** Total limit in the subscription period (e.g. monthly) */
  subscriptionLimit?: number;
}

export function UsageBar({
  used,
  limit,
  daysRemaining,
  subscriptionUsed,
  subscriptionLimit,
}: UsageBarProps) {
  const dailyPercent = Math.min((used / limit) * 100, 100);
  const dailyExhausted = used >= limit;

  const hasSubscription = subscriptionUsed !== undefined && subscriptionLimit !== undefined;
  const subPercent = hasSubscription
    ? Math.min((subscriptionUsed! / subscriptionLimit!) * 100, 100)
    : 0;
  const subExhausted = hasSubscription && subscriptionUsed! >= subscriptionLimit!;

  return (
    <div className="rounded-medium bg-surfaceVariant/50 p-3 space-y-3">
      {/* Today's usage */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-bodySmall text-onSurfaceVariant">درخواست‌های امروز</span>
          <span className="text-labelMedium">
            <span
              className={dailyExhausted ? "text-error font-medium" : "text-primary font-medium"}
            >
              {used}
            </span>
            <span className="text-muted"> / {limit}</span>
          </span>
        </div>
        <div className="h-1.5 bg-surfaceVariant rounded-full overflow-hidden">
          <div
            className={[
              "h-full rounded-full transition-all duration-medium2",
              dailyExhausted ? "bg-error" : "bg-primary",
            ].join(" ")}
            style={{ width: `${dailyPercent}%` }}
          />
        </div>
        {dailyExhausted && (
          <p className="text-bodySmall text-error mt-1">سهمیه امروز به پایان رسیده است</p>
        )}
      </div>

      {/* Subscription remaining */}
      {hasSubscription && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-bodySmall text-onSurfaceVariant">
              درخواست‌های باقی‌مانده از اشتراک
            </span>
            <span className="text-labelMedium">
              <span
                className={subExhausted ? "text-error font-medium" : "text-primary font-medium"}
              >
                {subscriptionLimit! - subscriptionUsed!}
              </span>
              <span className="text-muted"> باقی‌مانده</span>
            </span>
          </div>
          <div className="h-1.5 bg-surfaceVariant rounded-full overflow-hidden">
            <div
              className={[
                "h-full rounded-full transition-all duration-medium2",
                subExhausted ? "bg-error" : "bg-primary",
              ].join(" ")}
              style={{ width: `${subPercent}%` }}
            />
          </div>
          {subExhausted && (
            <p className="text-bodySmall text-error mt-1">
              سهمیه اشتراک به پایان رسیده است
            </p>
          )}
        </div>
      )}

      {/* Days remaining */}
      {daysRemaining !== undefined && daysRemaining > 0 && (
        <p className="text-bodySmall text-muted">
          {daysRemaining} روز تا تمدید اشتراک
        </p>
      )}
    </div>
  );
}
