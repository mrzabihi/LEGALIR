// ============================================================
// LEGALIR — Lawyer workbench · Service rates (نرخ خدمات)
// ============================================================
// One row per service in the catalogue, each showing the lawyer's current
// published price (or «قیمت ثبت نشده»), the SLA that service runs on, and a
// short history of every change.
//
// Two invariants the UI must not break:
//   · the price is per-service and belongs to the signed-in lawyer — the server
//     resolves the lawyer id from the session, never from the request;
//   · a rate change NEVER reprices an already-accepted request. The detail page
//     renders `agreedRate` (a frozen snapshot) and shows the live rate only as
//     context. The explanation sits on this page so the lawyer is not surprised.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import {
  useClearLawyerRate,
  useLawyerRates,
  useLawyerServices,
  useSetLawyerRate,
} from "@/hooks/useLawyerPortal";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyBlock,
  ErrorBlock,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  Td,
  TextArea,
  TextInput,
  Th,
} from "@/components/admin/ui";
import { ConfirmDialog, Dialog, snackbar } from "@legalir/ui";
import { ApiClientError } from "@/lib/api/errors";
import { toPersianCurrency, toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import { LAWYER_RATE_UNIT_FA, type LawyerRateUnit } from "@legalir/types";
import type { LawyerServiceRow } from "@/lib/api/lawyer-portal";
import { IconCalculator, IconClock, IconDelete, IconEdit, IconInfo } from "@/lib/icons";

const UNITS: LawyerRateUnit[] = ["FIXED", "HOURLY", "PER_SESSION"];

const CLOCK_FA = {
  CALENDAR: "ساعت تقویمی",
  BUSINESS_HOURS: "ساعت کاری",
} as const;

const PAUSE_FA = {
  PAUSE: "توقف در انتظار کاربر",
  CONTINUE: "ادامه در انتظار کاربر",
} as const;

interface Draft {
  serviceKey: string;
  amount: string;
  unit: LawyerRateUnit;
  note: string;
}

export default function LawyerRatesPage() {
  const services = useLawyerServices();
  const rates = useLawyerRates();
  const setRate = useSetLawyerRate();
  const clearRate = useClearLawyerRate();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<LawyerServiceRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = services.data?.services ?? [];

  const changes = useMemo(
    () =>
      (rates.data?.changes ?? []).slice(0, 20).map((c) => ({
        ...c,
        next: c.nextAmountToman == null ? "حذف‌شده" : toPersianCurrency(c.nextAmountToman, "IRT"),
        previous:
          c.previousAmountToman == null ? "—" : toPersianCurrency(c.previousAmountToman, "IRT"),
      })),
    [rates.data?.changes]
  );

  function openEditor(row: LawyerServiceRow) {
    setError(null);
    setDraft({
      serviceKey: row.id,
      amount: row.rate ? String(row.rate.amountToman) : "",
      unit: row.rate?.unit ?? "FIXED",
      note: row.rate?.noteFa ?? "",
    });
  }

  async function submit() {
    if (!draft) return;
    setError(null);
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("مبلغ باید عددی بزرگ‌تر از صفر باشد.");
      return;
    }
    if (!Number.isInteger(amount)) {
      setError("مبلغ باید به تومان و بدون اعشار باشد.");
      return;
    }
    try {
      await setRate.mutateAsync({
        serviceKey: draft.serviceKey,
        amountToman: amount,
        unit: draft.unit,
        noteFa: draft.note.trim() || null,
      });
      snackbar.show({ message: "نرخ خدمت ثبت شد.", variant: "success" });
      setDraft(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : "ثبت نرخ ناموفق بود.");
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await clearRate.mutateAsync(removing.id);
      snackbar.show({ message: "نرخ این خدمت حذف شد.", variant: "success" });
      setRemoving(null);
    } catch (err) {
      snackbar.show({
        message: err instanceof ApiClientError ? err.userMessage : "حذف نرخ ناموفق بود.",
        variant: "error",
      });
      setRemoving(null);
    }
  }

  if (services.isLoading) return <LoadingBlock rows={8} />;
  if (services.isError || !services.data)
    return <ErrorBlock message="خطا در بارگذاری خدمات" onRetry={() => services.refetch()} />;

  const activeRow = draft ? rows.find((r) => r.id === draft.serviceKey) : undefined;
  const pricedCount = rows.filter((r) => r.rate).length;

  return (
    <div>
      <PageHeader
        title="نرخ خدمات"
        description="قیمت هر خدمتی که ارائه می‌دهید را ثبت کنید. قیمت هنگام پذیرش یک درخواست تثبیت می‌شود و تغییر بعدی روی آن اثری ندارد."
        icon={<IconCalculator size={22} />}
      />

      <Card className="mb-4 p-4">
        <div className="flex items-start gap-2">
          <IconInfo size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-caption leading-6 text-on-surface-variant">
            {toPersianNumber(pricedCount)} از {toPersianNumber(rows.length)} خدمت قیمت‌گذاری
            شده‌اند. برای دریافت ارجاع، دست‌کم یک نرخ لازم است. مبلغ‌ها به تومان است و در فاکتور
            همان مقدار نمایش داده می‌شود.
          </p>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyBlock message="خدمتی برای قیمت‌گذاری یافت نشد." />
      ) : (
        <DataTable
          minWidth={860}
          head={
            <tr>
              <Th>خدمت</Th>
              <Th>نرخ فعلی</Th>
              <Th>مهلت پاسخ / تکمیل</Th>
              <Th>رفتار ساعت</Th>
              <Th>عملیات</Th>
            </tr>
          }
        >
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface-hover">
              <Td>
                <div className="flex flex-col">
                  <span className="font-medium text-on-surface">{row.nameFa}</span>
                  <span className="text-caption text-muted">{row.descriptionFa}</span>
                </div>
              </Td>
              <Td>
                {row.rate ? (
                  <div className="flex flex-col">
                    <span className="font-medium tabular-nums text-on-surface">
                      {toPersianCurrency(row.rate.amountToman, "IRT")}
                    </span>
                    <span className="text-caption text-muted">
                      {LAWYER_RATE_UNIT_FA[row.rate.unit]}
                    </span>
                  </div>
                ) : (
                  <Badge tone="warning">قیمت ثبت نشده</Badge>
                )}
              </Td>
              <Td className="text-caption">
                {row.sla.active
                  ? `${toPersianNumber(row.sla.responseHours)} / ${toPersianNumber(
                      row.sla.completionHours
                    )} ساعت`
                  : "—"}
              </Td>
              <Td className="text-caption">
                <div className="flex flex-col">
                  <span>{CLOCK_FA[row.sla.clock]}</span>
                  <span className="text-muted">{PAUSE_FA[row.sla.pauseBehavior]}</span>
                </div>
              </Td>
              <Td>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openEditor(row)}
                    startIcon={<IconEdit size={14} />}
                  >
                    {row.rate ? "ویرایش" : "ثبت نرخ"}
                  </Button>
                  {row.rate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRemoving(row)}
                      startIcon={<IconDelete size={14} />}
                      ariaLabel={`حذف نرخ ${row.nameFa}`}
                    >
                      حذف
                    </Button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}

      {/* Change history — append-only, newest first */}
      <Card className="mt-5">
        <CardHeader
          title="تاریخچهٔ تغییرات"
          subtitle="هر تغییر با مقدار پیش و پس از تغییر ثبت می‌شود."
        />
        <CardBody>
          {changes.length === 0 ? (
            <p className="text-body-2 text-muted">هنوز تغییری در نرخ‌ها ثبت نشده است.</p>
          ) : (
            <ul className="divide-y divide-divider">
              {changes.map((c) => {
                const service = rows.find((r) => r.id === c.serviceKey);
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-body-2 text-on-surface">
                        {service?.nameFa ?? c.serviceKey}
                      </p>
                      <p className="text-caption text-muted">
                        {c.previous} ← {c.next}
                      </p>
                    </div>
                    <span className="text-caption tabular-nums text-muted">
                      {toPersianDate(c.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Editor */}
      <Dialog
        open={Boolean(draft)}
        onClose={() => !setRate.isPending && setDraft(null)}
        title={activeRow ? `نرخ ${activeRow.nameFa}` : "نرخ خدمت"}
        description="مبلغ را به تومان وارد کنید. تغییر نرخ فقط بر درخواست‌های آینده اثر دارد."
        maxWidth="md"
        actions={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={setRate.isPending}>
              انصراف
            </Button>
            <Button onClick={() => void submit()} loading={setRate.isPending}>
              ذخیرهٔ نرخ
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-3">
            <Field label="مبلغ (تومان)" required error={error ?? undefined}>
              <TextInput
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                inputMode="numeric"
                dir="ltr"
                placeholder="مثلاً 1500000"
              />
            </Field>
            <Field label="روش محاسبه">
              <Select
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value as LawyerRateUnit })}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {LAWYER_RATE_UNIT_FA[u]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="یادداشت (اختیاری)"
              hint="در کارت عمومی شما کنار قیمت نمایش داده می‌شود."
            >
              <TextArea
                rows={2}
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                maxLength={200}
              />
            </Field>
            {activeRow && activeRow.sla.active && (
              <p className="flex items-center gap-1.5 rounded-medium bg-surface-container px-3 py-2 text-caption text-muted">
                <IconClock size={14} aria-hidden="true" />
                مهلت پاسخ {toPersianNumber(activeRow.sla.responseHours)} ساعت و مهلت تکمیل{" "}
                {toPersianNumber(activeRow.sla.completionHours)} ساعت است.
              </p>
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => !clearRate.isPending && setRemoving(null)}
        onConfirm={() => void confirmRemove()}
        title="حذف نرخ خدمت"
        description={
          removing
            ? `نرخ «${removing.nameFa}» حذف می‌شود. درخواست‌های پذیرفته‌شده قیمت توافق‌شدهٔ خود را حفظ می‌کنند.`
            : undefined
        }
        confirmLabel="حذف نرخ"
        destructive
        loading={clearRate.isPending}
      />
    </div>
  );
}
