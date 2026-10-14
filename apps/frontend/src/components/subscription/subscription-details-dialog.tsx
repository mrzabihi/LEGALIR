// ============================================================
// LEGALIR — Subscription · Purchase details dialog
// ============================================================
// Shows ONE purchase / subscription record. Every figure comes straight
// from the record the history API returned (`V1SubscriptionHistoryItem`) —
// nothing is inferred from another endpoint or invented. `startAt`/`endAt`
// are empty strings on a purchase that never activated (awaiting payment),
// so they render as «—» rather than a bogus date.
//
// On mobile the shared Dialog becomes a bottom sheet; the body scrolls
// inside it, so a long record stays readable.
// ============================================================

"use client";

import { Button, Dialog } from "@legalir/ui";
import { toPersianCurrency, toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import type { V1SubscriptionHistoryItem } from "@legalir/types";

export interface SubscriptionDetailsDialogProps {
  /** The record to show; null keeps the dialog closed. */
  item: V1SubscriptionHistoryItem | null;
  onClose: () => void;
  /** Optional: jump the user to the plans tab to renew/repurchase. */
  onViewPlans?: () => void;
}

/** Semantic status pill — never colour-only (each carries its label). */
const STATUS_CLASS: Record<string, string> = {
  active: "bg-success-container text-success border-success",
  expired: "bg-surface-container text-muted border-divider",
  cancelled: "bg-error-container text-error border-error",
  unknown: "bg-warning-container text-warning border-warning",
};

/** Whole days between two ISO dates, or null when either is missing. */
function durationDays(startAt: string, endAt: string): number | null {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 86_400_000);
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-body-2 text-muted">{label}</dt>
      <dd
        className={`text-body-2 font-medium text-on-surface ${mono ? "font-mono text-caption" : ""}`}
        dir={mono ? "ltr" : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

/** A date field, or «—» when the record has no activation date yet. */
function dateOrDash(iso: string): string {
  return iso ? toPersianDate(iso) : "—";
}

export function SubscriptionDetailsDialog({
  item,
  onClose,
  onViewPlans,
}: SubscriptionDetailsDialogProps) {
  const open = item !== null;
  const record = item;
  const days = record ? durationDays(record.startAt, record.endAt) : null;
  const isExpired = record?.status === "expired" || record?.status === "cancelled";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      title="جزئیات خرید"
      description={record ? `پلن ${record.planNameFa}` : undefined}
      actions={
        <>
          {onViewPlans && isExpired && (
            <Button variant="text" onClick={onViewPlans}>
              مشاهده پلن‌ها
            </Button>
          )}
          <Button variant="filled" onClick={onClose}>
            بستن
          </Button>
        </>
      }
    >
      {record && (
        <dl className="divide-y divide-divider rounded-large border border-divider bg-surface-container px-4">
          {/* Plan + status */}
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-body-2 text-muted">پلن</dt>
            <dd className="flex items-center gap-2 text-body-2 font-semibold text-on-surface">
              {record.planNameFa}
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-caption font-medium ${
                  STATUS_CLASS[record.status] ?? STATUS_CLASS["unknown"]
                }`}
              >
                {record.statusFa}
              </span>
            </dd>
          </div>

          <Row label="مبلغ پرداختی" value={toPersianCurrency(record.amount)} />
          <Row label="تاریخ خرید" value={toPersianDate(record.purchasedAt)} />
          <Row label="تاریخ شروع" value={dateOrDash(record.startAt)} />
          <Row label="تاریخ پایان" value={dateOrDash(record.endAt)} />
          <Row
            label="مدت اعتبار"
            value={days !== null ? `${toPersianNumber(days)} روز` : "—"}
          />
          <Row label="وضعیت پرداخت" value={record.statusFa} />
          <Row label="شناسهٔ اشتراک" value={record.id} mono />
        </dl>
      )}
    </Dialog>
  );
}
