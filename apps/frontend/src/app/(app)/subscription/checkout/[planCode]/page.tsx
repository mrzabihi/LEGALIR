"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePlansV1, useCheckoutIntent, useCheckoutIntentPoll } from "@/hooks/useSubscription";
import { Button, SkeletonCard } from "@legalir/ui";
import { toPersianNumber, toPersianCurrency } from "@/lib/persian-utils";
import { IconCheck, IconShield, IconArrowBack } from "@/lib/icons";
import type { PlanCode } from "@legalir/types";

// ============================================================
// Loading Skeleton
// ============================================================

function CheckoutSkeleton() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <SkeletonCard lines={6} />
    </div>
  );
}

// ============================================================
// Page Component
// ============================================================

export default function CheckoutPage() {
  const params = useParams<{ planCode: string }>();
  const router = useRouter();
  const planCode = params?.planCode as PlanCode;

  const [intentId, setIntentId] = useState<string | null>(null);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

  const { data: plans, isLoading: plansLoading } = usePlansV1();
  const checkoutMutation = useCheckoutIntent();
  const { data: checkoutStatus } = useCheckoutIntentPoll(intentId);

  const plan = plans?.find((p) => p.code === planCode) ?? null;

  // Redirect if planCode is invalid
  useEffect(() => {
    if (!plansLoading && plans && !plan) {
      router.replace("/pricing");
    }
  }, [plans, plansLoading, plan, router]);

  // Watch for payment status changes
  useEffect(() => {
    if (checkoutStatus?.status === "paid" && !paymentComplete) {
      setPaymentComplete(true);
      // Redirect to subscription page after a brief delay
      const timer = setTimeout(() => {
        router.push("/subscription");
      }, 2500);
      return () => clearTimeout(timer);
    }
    if (checkoutStatus?.status === "failed") {
      setIsSimulatingPayment(false);
    }
  }, [checkoutStatus?.status, paymentComplete, router]);

  const handleCreateIntent = useCallback(async () => {
    if (!planCode) return;
    try {
      const intent = await checkoutMutation.mutateAsync(planCode);
      setIntentId(intent.id);
    } catch {
      // Error handled by mutation state
    }
  }, [planCode, checkoutMutation]);

  const handleSimulatePayment = useCallback(() => {
    setIsSimulatingPayment(true);
    // Simulate payment gateway processing: 2-3 seconds
    setTimeout(() => {
      // After simulation, redirect
      setPaymentComplete(true);
      setTimeout(() => {
        router.push("/subscription");
      }, 2000);
    }, 2500);
  }, [router]);

  // --- Loading state ---
  if (plansLoading) return <CheckoutSkeleton />;

  // --- Invalid plan ---
  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <h1 className="text-h2 text-on-surface mb-4">پلن یافت نشد</h1>
        <p className="text-body-2 text-muted mb-6">
          پلن انتخاب شده معتبر نیست. لطفاً از صفحه تعرفه‌ها پلن مناسب را انتخاب کنید.
        </p>
        <Button variant="filled" onClick={() => router.push("/pricing")}>
          بازگشت به تعرفه‌ها
        </Button>
      </div>
    );
  }

  // --- Payment complete ---
  if (paymentComplete) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4">
        <div className="rounded-large bg-surface p-8 shadow-elevation-3 border border-divider text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
              <IconCheck size={40} className="text-success" />
            </div>
          </div>
          <h1 className="text-h2 text-on-surface mb-3">پرداخت موفق</h1>
          <p className="text-body-2 text-muted mb-2">
            اشتراک {plan.nameFa} شما با موفقیت فعال شد.
          </p>
          <p className="text-caption text-muted mb-6">
            در حال انتقال به صفحه اشتراک...
          </p>
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // --- No intent yet: Show plan summary and create intent ---
  if (!intentId) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-body-2 text-muted hover:text-on-surface transition-colors mb-6"
        >
          <IconArrowBack size={18} />
          بازگشت
        </button>

        <h1 className="text-h2 text-on-surface mb-6">تأیید و پرداخت</h1>

        {/* Plan Summary Card */}
        <div className="rounded-large bg-surface p-6 shadow-elevation-2 border border-divider mb-6">
          <h2 className="text-h3 text-on-surface mb-4">خلاصه سفارش</h2>

          {/* Plan info */}
          <div className="flex items-center justify-between py-3 border-b border-divider">
            <span className="text-body-2 text-muted">پلن انتخابی</span>
            <span className="text-body-2 text-on-surface font-medium">{plan.nameFa}</span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-divider">
            <span className="text-body-2 text-muted">مدت اشتراک</span>
            <span className="text-body-2 text-on-surface">
              {toPersianNumber(plan.durationDays)} روز
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-divider">
            <span className="text-body-2 text-muted">درخواست روزانه</span>
            <span className="text-body-2 text-on-surface">
              {toPersianNumber(plan.dailyRequestLimit)} درخواست
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-divider">
            <span className="text-body-2 text-muted">توکن ماهانه</span>
            <span className="text-body-2 text-on-surface">
              {toPersianNumber(plan.totalTokenLimit)}
            </span>
          </div>

          {/* Features included */}
          <div className="py-3 border-b border-divider">
            <span className="text-body-2 text-muted mb-2 block">امکانات پلن</span>
            <ul className="space-y-1.5">
              {plan.features.map((f) => (
                <li key={f} className="text-body-2 text-on-surface flex items-start gap-2">
                  <IconCheck size={16} className="text-success mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pricing */}
          <div className="flex items-center justify-between py-4">
            <span className="text-h3 text-on-surface">مبلغ قابل پرداخت</span>
            <div className="text-right">
              {plan.listPrice > plan.salePrice && (
                <span className="text-body-2 text-muted line-through block">
                  {toPersianCurrency(plan.listPrice)}
                </span>
              )}
              <span className="text-h2 text-secondary font-bold">
                {toPersianCurrency(plan.salePrice)}
              </span>
            </div>
          </div>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-3 p-4 rounded-medium bg-success/5 border border-success/20 mb-6">
          <IconShield size={20} className="text-success mt-0.5 shrink-0" />
          <div>
            <p className="text-body-2 text-on-surface font-medium">پرداخت امن</p>
            <p className="text-caption text-muted">
              اطلاعات پرداخت شما به صورت رمزنگاری‌شده منتقل می‌شود. LEGALIR هیچ‌گونه دسترسی به اطلاعات کارت بانکی شما ندارد.
            </p>
          </div>
        </div>

        {/* Error */}
        {checkoutMutation.isError && (
          <div className="p-3 rounded-medium bg-error/5 border border-error/20 text-caption text-error mb-4">
            {(checkoutMutation.error as Error)?.message ?? "خطا در ایجاد درخواست پرداخت"}
          </div>
        )}

        {/* CTA */}
        <Button
          variant="filled"
          size="large"
          fullWidth
          loading={checkoutMutation.isPending}
          disabled={checkoutMutation.isPending}
          onClick={handleCreateIntent}
          className="rounded-large text-lg font-bold shadow-elevation-3 animate-glow"
        >
          {checkoutMutation.isPending ? "در حال ایجاد درخواست..." : "پرداخت و فعال‌سازی"}
        </Button>
      </div>
    );
  }

  // --- Intent created: show simulated payment gateway ---
  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      {/* Back button */}
      <button
        onClick={() => {
          setIntentId(null);
          setIsSimulatingPayment(false);
        }}
        className="flex items-center gap-2 text-body-2 text-muted hover:text-on-surface transition-colors mb-6"
      >
        <IconArrowBack size={18} />
        بازگشت
      </button>

      <div className="rounded-large bg-surface p-8 shadow-elevation-3 border border-divider text-center">
        <h1 className="text-h2 text-on-surface mb-4">درگاه پرداخت</h1>

        {/* Plan info summary */}
        <div className="rounded-medium bg-primary/5 p-4 mb-6 text-right">
          <div className="flex justify-between mb-1">
            <span className="text-body-2 text-muted">پلن</span>
            <span className="text-body-2 text-on-surface font-medium">{plan.nameFa}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-body-2 text-muted">مدت</span>
            <span className="text-body-2 text-on-surface">{toPersianNumber(plan.durationDays)} روز</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-divider mt-2">
            <span className="text-body-2 text-muted">مبلغ</span>
            <span className="text-body-2 text-secondary font-bold">
              {toPersianCurrency(plan.salePrice)}
            </span>
          </div>
        </div>

        {/* Simulated payment processing */}
        {isSimulatingPayment ? (
          <div className="py-8">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full border-3 border-primary border-t-transparent animate-spin" />
            </div>
            <p className="text-body-1 text-on-surface mb-2">در حال پردازش پرداخت...</p>
            <p className="text-caption text-muted">لطفاً شکیبا باشید</p>
          </div>
        ) : (
          <>
            {/* Mock payment form */}
            <div className="rounded-medium bg-neutral-50 p-5 mb-6 text-right">
              <p className="text-caption text-muted mb-4">
                این یک درگاه پرداخت شبیه‌سازی‌شده است. با کلیک روی دکمه زیر، پرداخت شما تأیید خواهد شد.
              </p>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-caption text-muted block mb-1">شماره کارت (شبیه‌سازی)</label>
                  <div className="h-10 rounded-medium bg-surface border border-neutral-300 flex items-center px-3">
                    <span className="text-body-2 text-on-surface font-mono">۶۲۱۹-۸۶۱۰-****-****</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-caption text-muted block mb-1">تاریخ انقضا</label>
                    <div className="h-10 rounded-medium bg-surface border border-neutral-300 flex items-center px-3">
                      <span className="text-body-2 text-on-surface font-mono">۰۴/۰۸</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-caption text-muted block mb-1">CVV2</label>
                    <div className="h-10 rounded-medium bg-surface border border-neutral-300 flex items-center px-3">
                      <span className="text-body-2 text-on-surface font-mono">***</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security note */}
            <div className="flex items-center justify-center gap-2 text-caption text-muted mb-6">
              <IconShield size={16} />
              اطلاعات شما محفوظ است
            </div>

            {/* CTA */}
            <Button
              variant="filled"
              size="large"
              fullWidth
              onClick={handleSimulatePayment}
              className="rounded-large text-lg font-bold shadow-elevation-3 animate-glow"
            >
              پرداخت {toPersianCurrency(plan.salePrice)}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
