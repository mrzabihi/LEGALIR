// ============================================================
// LEGALIR — Admin · Sales, Payments & Refunds (فروش، پرداخت و بازگشت)
// ============================================================
// The order ledger plus the two-person refund workflow. Requesting a refund
// and approving it are SEPARATE permissions (`admin:billing:manage` vs
// `admin:refund:approve`) — the server rejects a self-approval, so one
// operator cannot both raise and clear a financial adjustment. The gateway
// is simulated in this environment; that is stated, never hidden.
// ============================================================

"use client";

import { useState } from "react";
import {
  useAdminOrders,
  useAdminOrder,
  useCreateAdminRefund,
  useDecideAdminRefund,
  useAdminMe,
} from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate, toPersianCurrency } from "@/lib/persian-utils";
import type { AdminOrder, OrderStatus } from "@/lib/api/admin";
import { ORDER_STATUS_FA, ADJUSTMENT_KIND_FA, ADJUSTMENT_STATUS_FA } from "@legalir/types";
import {
  PageHeader,
  Card,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  Button,
  TextInput,
  Select,
  Field,
  InfoBanner,
  FilterPills,
  IdChip,
} from "@/components/admin/ui";

const ORDER_STATUS_TONES: Record<
  OrderStatus,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  CREATED: "neutral",
  PENDING: "warning",
  SUCCESS: "success",
  FAILED: "danger",
  EXPIRED: "neutral",
  REFUNDED: "info",
  PARTIALLY_REFUNDED: "info",
  DISPUTED: "danger",
};

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

function OrderDetail({ id }: { id: string }) {
  const { can } = useAdminMe();
  const canRequest = can("admin:billing:manage");
  const canApprove = can("admin:refund:approve");

  const detail = useAdminOrder(id);
  const createRefund = useCreateAdminRefund();
  const decideRefund = useDecideAdminRefund();

  const [kind, setKind] = useState<"refund_full" | "refund_partial" | "adjustment">("refund_partial");
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  if (detail.isLoading)
    return <Card className="p-4 text-body-2 text-muted">در حال بارگذاری…</Card>;
  if (detail.isError || !detail.data)
    return <Card className="p-4 text-body-2 text-red-600">خطا در دریافت سفارش</Card>;

  const { order, refunds } = detail.data;

  async function onRequestRefund() {
    setFeedback(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFeedback({ tone: "error", text: "مبلغ بازگشت باید عددی بزرگ‌تر از صفر باشد." });
      return;
    }
    if (!reason.trim()) {
      setFeedback({ tone: "error", text: "درج دلیل برای عملیات مالی الزامی است." });
      return;
    }
    try {
      await createRefund.mutateAsync({ orderId: id, input: { kind, amount: amt, reason } });
      setAmount("");
      setReason("");
      setFeedback({
        tone: "success",
        text: "درخواست بازگشت ثبت شد و برای تأیید توسط تأییدکننده دوم در انتظار است.",
      });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "ثبت درخواست ناموفق بود") });
    }
  }

  async function onDecide(refundId: string, decision: "approved" | "rejected") {
    setFeedback(null);
    try {
      await decideRefund.mutateAsync({ id: refundId, decision });
      setFeedback({
        tone: "success",
        text: decision === "approved" ? "بازگشت تأیید شد." : "بازگشت رد شد.",
      });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "تصمیم‌گیری ناموفق بود") });
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-h3 font-bold text-onSurface">
            <span dir="ltr">{order.referenceId}</span>
            <Badge tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_FA[order.status]}</Badge>
          </h3>
          <p className="mt-1 text-caption text-muted">
            {order.planNameFa} · {order.userDisplayName ?? "بدون نام"} · {order.userMobileMasked}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 tablet:grid-cols-4">
        <div className="rounded-medium border border-divider p-3">
          <p className="text-caption text-muted">قیمت فهرست</p>
          <p className="tabular-nums">{toPersianCurrency(order.listPrice)}</p>
        </div>
        <div className="rounded-medium border border-divider p-3">
          <p className="text-caption text-muted">مبلغ فروش</p>
          <p className="tabular-nums">{toPersianCurrency(order.salePrice)}</p>
        </div>
        <div className="rounded-medium border border-divider p-3">
          <p className="text-caption text-muted">مبلغ بازگشتی</p>
          <p className="tabular-nums">{toPersianCurrency(order.refundedAmount)}</p>
        </div>
        <div className="rounded-medium border border-divider p-3">
          <p className="text-caption text-muted">خالص</p>
          <p className="tabular-nums font-semibold">{toPersianCurrency(order.netAmount)}</p>
        </div>
      </div>

      <p className="mb-4 text-caption text-muted">
        درگاه: {order.gateway} (شبیه‌سازی‌شده در این محیط) · تاریخ خرید:{" "}
        {toPersianDate(order.purchasedAt)}
        {order.trackingId ? ` · کد پیگیری: ${order.trackingId}` : ""}
      </p>

      {feedback && (
        <div
          className={`mb-4 rounded-large border p-3 text-body-2 ${
            feedback.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {canRequest && (
        <div className="mb-5 rounded-medium border border-divider p-3">
          <h4 className="mb-2 text-body-2 font-semibold text-onSurface">
            ثبت درخواست بازگشت/تعدیل
          </h4>
          <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
            <Field label="نوع">
              <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="refund_full">بازگشت کامل</option>
                <option value="refund_partial">بازگشت جزئی</option>
                <option value="adjustment">تعدیل</option>
              </Select>
            </Field>
            <Field label="مبلغ (تومان)">
              <TextInput
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(order.salePrice)}
              />
            </Field>
            <Field label="دلیل">
              <TextInput value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button variant="primary" onClick={onRequestRefund} disabled={createRefund.isPending}>
                ثبت درخواست
              </Button>
            </div>
          </div>
          <p className="mt-2 text-caption text-muted">
            درخواست پس از ثبت، برای تأیید به تأییدکننده دوم (با مجوز مستقل) ارجاع می‌شود.
          </p>
        </div>
      )}

      <h4 className="mb-2 text-body-2 font-semibold text-onSurface">تعدیل‌های مالی</h4>
      {refunds.length === 0 ? (
        <p className="text-body-2 text-muted">تعدیلی ثبت نشده است.</p>
      ) : (
        <DataTable
          head={
            <tr>
              <Th>نوع</Th>
              <Th>مبلغ</Th>
              <Th>دلیل</Th>
              <Th>وضعیت</Th>
              <Th>تأییدکننده</Th>
              {canApprove && <Th>تصمیم</Th>}
            </tr>
          }
        >
          {refunds.map((r) => (
            <tr key={r.id}>
              <Td>{ADJUSTMENT_KIND_FA[r.kind] ?? r.kind}</Td>
              <Td className="tabular-nums">{toPersianCurrency(r.amount)}</Td>
              <Td className="max-w-[220px] truncate" title={r.reason}>
                {r.reason}
              </Td>
              <Td>
                <Badge
                  tone={
                    r.status === "approved" || r.status === "completed"
                      ? "success"
                      : r.status === "rejected"
                        ? "danger"
                        : "warning"
                  }
                >
                  {ADJUSTMENT_STATUS_FA[r.status] ?? r.status}
                </Badge>
              </Td>
              <Td>{r.approvedBy ? <IdChip id={r.approvedBy} /> : "—"}</Td>
              {canApprove && (
                <Td>
                  {r.status === "pending" ? (
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="primary" onClick={() => onDecide(r.id, "approved")}>
                        تأیید
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onDecide(r.id, "rejected")}>
                        رد
                      </Button>
                    </div>
                  ) : (
                    <span className="text-caption text-muted">—</span>
                  )}
                </Td>
              )}
            </tr>
          ))}
        </DataTable>
      )}
    </Card>
  );
}

export default function AdminOrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const query = useAdminOrders({ search, status: status || undefined, page, pageSize: 20 });
  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : 1;

  const filters = [
    { value: "", label: "همه" },
    ...Object.entries(ORDER_STATUS_FA).map(([value, label]) => ({ value, label })),
  ];

  return (
    <div>
      <PageHeader
        title="فروش، پرداخت و بازگشت"
        description="دفتر سفارش‌ها و گردش کار بازگشت دو‌مرحله‌ای. ثبت و تأیید عملیات مالی تفکیک شده‌اند و درگاه در این محیط شبیه‌سازی می‌شود."
      />

      <InfoBanner tone="info">
        درگاه پرداخت در این محیط شبیه‌سازی‌شده است و هیچ تراکنش واقعی انجام نمی‌شود.
      </InfoBanner>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <TextInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="جستجو در شناسه، کاربر یا پلن"
          className="min-w-[240px] flex-1"
        />
        <FilterPills
          options={filters}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="سفارشی با این فیلتر یافت نشد."
      >
        {(data) => (
          <>
            <DataTable
              head={
                <tr>
                  <Th>کد پیگیری</Th>
                  <Th>کاربر</Th>
                  <Th>پلن</Th>
                  <Th>مبلغ فروش</Th>
                  <Th>بازگشتی</Th>
                  <Th>خالص</Th>
                  <Th>وضعیت</Th>
                  <Th>تاریخ</Th>
                  <Th>جزئیات</Th>
                </tr>
              }
            >
              {data.items.map((o: AdminOrder) => (
                <tr key={o.id}>
                  <Td dir="ltr" className="font-mono text-caption">
                    {o.referenceId}
                  </Td>
                  <Td>
                    <span>{o.userDisplayName ?? "بدون نام"}</span>
                    <span className="block text-caption text-muted tabular-nums">
                      {o.userMobileMasked}
                    </span>
                  </Td>
                  <Td>{o.planNameFa}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{toPersianCurrency(o.salePrice)}</Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {toPersianCurrency(o.refundedAmount)}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums font-medium">
                    {toPersianCurrency(o.netAmount)}
                  </Td>
                  <Td>
                    <Badge tone={ORDER_STATUS_TONES[o.status]}>{ORDER_STATUS_FA[o.status]}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">{toPersianDate(o.purchasedAt)}</Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelected(selected === o.id ? null : o.id)}
                    >
                      {selected === o.id ? "بستن" : "مشاهده"}
                    </Button>
                  </Td>
                </tr>
              ))}
            </DataTable>

            <div className="mt-3 flex items-center justify-between text-caption text-muted">
              <span>{toPersianNumber(data.total)} سفارش</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={data.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  قبلی
                </Button>
                <span className="tabular-nums">
                  {toPersianNumber(data.page)} / {toPersianNumber(totalPages)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={data.page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  بعدی
                </Button>
              </div>
            </div>
          </>
        )}
      </StateView>

      {selected && (
        <div className="mt-5">
          <OrderDetail id={selected} />
        </div>
      )}
    </div>
  );
}
