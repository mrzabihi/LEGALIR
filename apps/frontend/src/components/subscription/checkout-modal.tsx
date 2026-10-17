// ============================================================
// LEGALIR — Checkout · Order review modal
// ============================================================
// The purchase is driven entirely by the SERVER-computed quote: this modal
// renders whatever `useCheckoutQuote` returns and never does its own pricing
// math. Behaviour is decided ONLY by the quote's `finalAmount`:
//
//   finalAmount === 0  → a single primary button «تأیید و فعالسازی اشتراک»
//                         calls the order route, which re-validates + activates
//                         atomically. No gateway UI is shown.
//   finalAmount  >  0  → the gateway button is visible and enabled, but a real
//                         gateway is not active: clicking shows a notice and
//                         commits/activates NOTHING (no fabricated success).
//
// Coupon handling: the code is trimmed + upper-cased, validated server-side
// (audited), and applied only on a valid result. Applying/removing re-keys the
// quote query, so the whole breakdown is re-derived from the server.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dialog, snackbar } from "@legalir/ui";
import { IconCheckCircle, IconError, IconInfo, IconShield } from "@/lib/icons";
import { toPersianCurrency, toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import { generateIdempotencyKey } from "@/lib/api/idempotency";
import {
  useCheckoutQuote,
  useCreateCheckoutOrder,
  useValidateCoupon,
} from "@/hooks/useCheckout";
import type { Plan, CheckoutOrderView } from "@legalir/types";

export interface CheckoutModalProps {
  open: boolean;
  /** The plan the user chose to buy (null while closing). */
  plan: Plan | null;
  onClose: () => void;
}

type FieldMessage = { kind: "success" | "error"; text: string } | null;

export function CheckoutModal({ open, plan, onClose }: CheckoutModalProps) {
  const planCode = plan?.code ?? null;

  const [couponInput, setCouponInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState<FieldMessage>(null);
  const [order, setOrder] = useState<CheckoutOrderView | null>(null);

  const quoteQuery = useCheckoutQuote(open ? planCode : null, appliedCode);
  const validateMutation = useValidateCoupon();
  const orderMutation = useCreateCheckoutOrder();

  // One idempotency key per (open, plan) attempt: retries reuse it, so a
  // double-click / refresh can never create a second order or double-activate.
  const idemKeyRef = useRef<string>("");

  // Reset every piece of modal state whenever it opens for a (possibly new)
  // plan — a coupon that was valid on plan A must be re-checked on plan B.
  useEffect(() => {
    if (!open) return;
    setCouponInput("");
    setAppliedCode(null);
    setCouponMessage(null);
    setOrder(null);
    if (planCode) idemKeyRef.current = generateIdempotencyKey();
  }, [open, planCode]);

  const quote = quoteQuery.data?.quote ?? null;
  const quoteCouponError = quoteQuery.data?.couponError ?? null;
  const isFree = quote ? quote.finalAmount === 0 : false;

  const handleApplyCoupon = () => {
    if (!planCode) return;
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponMessage({ kind: "error", text: "کد تخفیف را وارد کنید." });
      return;
    }
    setCouponMessage(null);
    validateMutation.mutate(
      { planCode, couponCode: code },
      {
        onSuccess: (res) => {
          if (res.valid) {
            setAppliedCode(code); // re-keys the quote query → server re-derives
            setCouponInput("");
            setCouponMessage({ kind: "success", text: res.messageFa });
          } else {
            setAppliedCode(null);
            setCouponMessage({ kind: "error", text: res.messageFa });
          }
        },
        onError: (err) => {
          setAppliedCode(null);
          setCouponMessage({ kind: "error", text: err.message || "خطا در بررسی کد تخفیف" });
        },
      }
    );
  };

  const handleRemoveCoupon = () => {
    setAppliedCode(null);
    setCouponInput("");
    setCouponMessage(null);
  };

  const handleFreeConfirm = () => {
    if (!planCode || !quote) return;
    orderMutation.mutate(
      {
        planCode,
        couponCode: appliedCode ?? undefined,
        idempotencyKey: idemKeyRef.current,
      },
      {
        onSuccess: (res) => setOrder(res.order),
        onError: (err) =>
          snackbar.show({ message: err.message || "خطا در ثبت سفارش", variant: "error" }),
      }
    );
  };

  const handleGatewayClick = () => {
    // The gateway is NOT active. Never fabricate success, never activate.
    snackbar.show({
      message: "درگاه پرداخت به‌زودی فعال می‌شود. در حال حاضر امکان تکمیل پرداخت آنلاین وجود ندارد.",
      variant: "info",
      duration: 6000,
    });
  };

  // ---- Success / pending outcome panel ----
  if (order) {
    const activated = order.status === "no_payment_required";
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md">
        <div className="flex flex-col items-center py-4 text-center">
          <div
            className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              activated ? "bg-success-container" : "bg-warning-container"
            }`}
          >
            {activated ? (
              <IconCheckCircle size={36} className="text-success" />
            ) : (
              <IconInfo size={36} className="text-warning" />
            )}
          </div>
          <h2 className="mb-2 text-h3 text-on-surface">
            {activated ? "اشتراک فعال شد" : "سفارش در انتظار پرداخت"}
          </h2>
          <p className="mb-5 text-body-2 text-muted">
            {activated
              ? `اشتراک ${order.planNameFa} شما با موفقیت فعال شد.`
              : `سفارش ${order.planNameFa} ثبت شد؛ برای فعال‌سازی باید پرداخت تکمیل شود.`}
          </p>

          <dl className="w-full space-y-2 rounded-large border border-divider bg-surface-container p-4 text-right">
            <Row label="شماره پیگیری" value={order.referenceId} mono />
            <Row label="پلن" value={order.planNameFa} />
            {order.startAt && order.endAt && (
              <Row
                label="اعتبار"
                value={`${toPersianDate(order.startAt)} تا ${toPersianDate(order.endAt)}`}
              />
            )}
            <Row label="وضعیت" value={order.statusFa} />
            {activated ? (
              <Row label="مبلغ پرداختی" value={toPersianCurrency(order.collectedAmount)} />
            ) : (
              <Row label="مبلغ قابل پرداخت" value={toPersianCurrency(order.finalAmount)} />
            )}
          </dl>
        </div>
      </Dialog>
    );
  }

  const loading = quoteQuery.isLoading;
  const quoteFailed = quoteQuery.isError;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      persistent={orderMutation.isPending}
      maxWidth="lg"
      title="بازبینی و تأیید سفارش"
      description={plan ? `پلن ${plan.nameFa}` : undefined}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={orderMutation.isPending}>
            انصراف
          </Button>
          {isFree ? (
            <Button
              variant="filled"
              onClick={handleFreeConfirm}
              loading={orderMutation.isPending}
              disabled={orderMutation.isPending || loading}
            >
              تأیید و فعال‌سازی اشتراک
            </Button>
          ) : (
            <Button variant="filled" onClick={handleGatewayClick} disabled={loading}>
              پرداخت و فعال‌سازی
            </Button>
          )}
        </>
      }
    >
      {/* Plan + period */}
      <div className="mb-4 rounded-large border border-divider bg-surface-container p-4">
        <div className="flex items-center justify-between">
          <span className="text-body-2 text-muted">پلن</span>
          <span className="text-body-2 font-semibold text-on-surface">
            {quote?.planNameFa ?? plan?.nameFa ?? "—"}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-body-2 text-muted">مدت</span>
          <span className="text-body-2 text-on-surface">
            {quote ? `${toPersianNumber(quote.durationDays)} روز` : "—"}
          </span>
        </div>
      </div>

      {/* Coupon */}
      {!loading && !quoteFailed && (
        <div className="mb-4">
          <label htmlFor="checkout-coupon" className="mb-1.5 block text-caption text-muted">
            کد تخفیف
          </label>
          {appliedCode ? (
            <div className="flex items-center justify-between rounded-medium border border-success bg-success-container px-3 py-2.5">
              <span className="text-body-2 font-medium text-success" dir="ltr">
                {appliedCode}
              </span>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="text-caption text-error hover:underline"
              >
                حذف
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                id="checkout-coupon"
                type="text"
                inputMode="text"
                autoComplete="off"
                dir="ltr"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyCoupon();
                  }
                }}
                placeholder="مثلاً LEGAL1404"
                disabled={validateMutation.isPending}
                className="h-11 min-w-0 flex-1 rounded-small border border-divider bg-surface px-3 text-body-2 text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
              />
              <Button
                variant="outlined"
                onClick={handleApplyCoupon}
                loading={validateMutation.isPending}
                disabled={validateMutation.isPending}
              >
                اعمال
              </Button>
            </div>
          )}

          {couponMessage && (
            <p
              role={couponMessage.kind === "error" ? "alert" : "status"}
              aria-live={couponMessage.kind === "error" ? "assertive" : "polite"}
              className={`mt-1.5 flex items-center gap-1.5 text-caption ${
                couponMessage.kind === "success" ? "text-success" : "text-error"
              }`}
            >
              {couponMessage.kind === "error" && <IconError size={14} />}
              {couponMessage.text}
            </p>
          )}
          {/* A coupon that was valid at apply time but is rejected on re-quote
              (e.g. capacity just filled) — the server is authoritative. */}
          {!couponMessage && quoteCouponError && (
            <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-caption text-error">
              <IconError size={14} />
              {quoteCouponError.messageFa}
            </p>
          )}
        </div>
      )}

      {/* Invoice breakdown — every figure is the SERVER's */}
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-7 animate-pulse rounded-small bg-surface-container" />
          ))}
        </div>
      ) : quoteFailed ? (
        <div className="rounded-large border border-error bg-error-container p-4 text-center">
          <p className="text-body-2 text-error">خطا در دریافت اطلاعات سفارش.</p>
          <Button variant="text" onClick={() => quoteQuery.refetch()}>
            تلاش مجدد
          </Button>
        </div>
      ) : quote ? (
        <div className="rounded-large border border-divider p-1">
          <dl className="divide-y divide-divider">
            {quote.lines.map((line) => (
              <div key={line.key} className="flex items-center justify-between px-3 py-2.5">
                <dt className="text-body-2 text-muted">
                  {line.labelFa}
                  {line.hintFa && (
                    <span className="ms-1.5 text-caption text-success">{line.hintFa}</span>
                  )}
                </dt>
                <dd
                  className={`text-body-2 tabular-nums ${
                    line.amount < 0 ? "text-success" : "text-on-surface"
                  }`}
                >
                  {line.amount < 0 ? "−" : ""}
                  {toPersianCurrency(Math.abs(line.amount))}
                </dd>
              </div>
            ))}
          </dl>

          {/* Final amount — the single deciding figure, on its own brand row */}
          <div className="flex items-center justify-between rounded-medium bg-primary-container px-3 py-3">
            <span className="text-body-1 font-semibold text-on-surface">مبلغ نهایی</span>
            <span className="text-h3 font-bold text-primary">
              {quote.finalAmount === 0 ? "رایگان" : toPersianCurrency(quote.finalAmount)}
            </span>
          </div>
        </div>
      ) : null}

      {/* Status note */}
      {!loading && !quoteFailed && quote && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-large border p-3 text-caption ${
            isFree
              ? "border-success bg-success-container text-success"
              : "border-warning bg-warning-container text-warning"
          }`}
        >
          <IconShield size={16} className="mt-0.5 shrink-0" />
          <span>
            {isFree
              ? "با تأیید، اشتراک شما بلافاصله و بدون نیاز به پرداخت فعال می‌شود."
              : "درگاه پرداخت آنلاین هنوز فعال نشده است. با کلیک روی دکمهٔ پرداخت، فعلاً اطلاع‌رسانی می‌شود و هیچ مبلغی دریافت نخواهد شد."}
          </span>
        </div>
      )}
    </Dialog>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-caption text-muted">{label}</dt>
      <dd
        className={`text-body-2 text-on-surface ${mono ? "font-mono" : ""}`}
        dir={mono ? "ltr" : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
