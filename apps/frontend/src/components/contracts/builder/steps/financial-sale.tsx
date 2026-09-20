// ============================================================
// LEGALIR — Wizard step: financial (sale)
// ============================================================
// ثمن معامله and the payment schedule. The schedule lives in its own
// table (`contract-payments`) and its own endpoint, so it is saved
// through `setPayments` rather than the domain-data autosave. The
// running total is compared against the price so the user can see at
// a glance whether the instalments add up.
// ============================================================

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWizard } from "../wizard-context";
import {
  Field,
  FieldGrid,
  SectionCard,
  ChoiceField,
  MoneyField,
  DateField,
  ToggleRow,
  Notice,
  RepeatableRow,
  AddRowButton,
} from "../primitives";
import { formatToman, isZeroMoney, moneyEquals, sumMoney, toRial } from "@/lib/contracts/money";
import type {
  CheckDetails,
  ContractPayment,
  PaymentMethod,
  PropertySaleData,
} from "@legalir/types";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "انتقال بانکی" },
  { value: "card", label: "کارت به کارت" },
  { value: "check", label: "چک" },
  { value: "sadad_check", label: "چک صیادی" },
  { value: "other", label: "سایر" },
];

const PAYMENT_SAVE_DEBOUNCE_MS = 700;

function emptyCheck(): CheckDetails {
  return { bank: "", checkNumber: "", sadadId: "", dueDate: null, imageDocumentId: null };
}

function emptyPayment(sequence: number): ContractPayment {
  return {
    id: `pay-${crypto.randomUUID()}`,
    contractId: "",
    sequence,
    labelFa: `قسط ${sequence}`,
    amount: { amount: 0, currency: "IRR" },
    dueDate: null,
    conditionFa: "",
    method: "bank_transfer",
    status: "pending",
    check: null,
    note: "",
  };
}

export function FinancialSaleStep() {
  const { data, patchData, payments, setPayments } = useWizard();
  const d = data as PropertySaleData;

  const setTerms = (patch: Partial<PropertySaleData["terms"]>) =>
    patchData({ terms: { ...d.terms, ...patch } });

  // The schedule is edited locally and flushed on a debounce so a
  // burst of keystrokes produces one PUT, not one per character.
  const [rows, setRows] = useState<ContractPayment[]>(payments);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const commit = (next: ContractPayment[]) => {
    setRows(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setPayments(next.map((p, i) => ({ ...p, sequence: i + 1 })));
    }, PAYMENT_SAVE_DEBOUNCE_MS);
  };

  const patchRow = (index: number, patch: Partial<ContractPayment>) =>
    commit(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const addRow = () => commit([...rows, emptyPayment(rows.length + 1)]);
  const removeRow = (index: number) =>
    commit(rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, sequence: i + 1 })));

  const scheduled = useMemo(() => sumMoney(rows.map((r) => r.amount)), [rows]);
  const price = d.terms.totalPrice;
  const matches = moneyEquals(scheduled, price);
  const overpay = toRial(scheduled) > toRial(price);

  const pricePerSqm = useMemo(() => {
    const area = d.general.area;
    if (!area || area <= 0 || isZeroMoney(price)) return null;
    return { amount: Math.round(price.amount / area), currency: "IRR" as const };
  }, [d.general.area, price]);

  return (
    <div className="space-y-4">
      <SectionCard title="ثمن معامله" description="مبلغ کل معامله را به تومان وارد کنید">
        <MoneyField
          label="مبلغ کل (ثمن معامله)"
          value={d.terms.totalPrice}
          onChange={(v) => setTerms({ totalPrice: v ?? { amount: 0, currency: "IRR" } })}
        />
        {pricePerSqm && (
          <Notice tone="info">
            قیمت هر مترمربع بر اساس متراژ {d.general.area} مترمربع: {formatToman(pricePerSqm)}
          </Notice>
        )}
      </SectionCard>

      <SectionCard
        title="برنامه پرداخت"
        description="اقساط، تاریخ سررسید و روش پرداخت را مشخص کنید"
        aside={
          rows.length > 0 ? (
            <span className={`text-caption ${matches ? "text-success" : "text-warning"}`}>
              جمع اقساط: {formatToman(scheduled)}
            </span>
          ) : undefined
        }
      >
        <ToggleRow
          label="ثمن به‌صورت قسطی پرداخت می‌شود"
          description="در صورت غیرفعال بودن، پرداخت یکجا هنگام تنظیم سند فرض می‌شود"
          checked={d.terms.hasSchedule}
          onChange={(v) => {
            setTerms({ hasSchedule: v });
            if (v && rows.length === 0) commit([emptyPayment(1)]);
          }}
        />

        {d.terms.hasSchedule && (
          <>
            {rows.length === 0 && (
              <Notice tone="info">
                هنوز قسطی اضافه نشده است. با دکمه زیر اولین قسط را اضافه کنید.
              </Notice>
            )}

            {rows.map((row, index) => (
              <RepeatableRow key={row.id} index={index} onRemove={() => removeRow(index)}>
                <FieldGrid>
                  <Field
                    label="عنوان قسط"
                    value={row.labelFa}
                    onChange={(v) => patchRow(index, { labelFa: v })}
                    placeholder="مثلاً پیش‌پرداخت"
                  />
                  <MoneyField
                    label="مبلغ قسط"
                    value={row.amount}
                    onChange={(v) =>
                      patchRow(index, { amount: v ?? { amount: 0, currency: "IRR" } })
                    }
                  />
                  <ChoiceField
                    label="روش پرداخت"
                    value={row.method}
                    onChange={(v) => patchRow(index, { method: v })}
                    options={METHODS}
                  />
                  <DateField
                    label="تاریخ سررسید"
                    value={row.dueDate}
                    onChange={(iso) => patchRow(index, { dueDate: iso })}
                  />
                </FieldGrid>

                <Field
                  label="شرط پرداخت"
                  value={row.conditionFa}
                  onChange={(v) => patchRow(index, { conditionFa: v })}
                  placeholder="مثلاً هنگام تحویل ملک"
                />

                {(row.method === "check" || row.method === "sadad_check") && (
                  <FieldGrid>
                    <Field
                      label="بانک"
                      value={row.check?.bank ?? ""}
                      onChange={(v) =>
                        patchRow(index, { check: { ...(row.check ?? emptyCheck()), bank: v } })
                      }
                    />
                    <Field
                      label="شماره چک"
                      value={row.check?.checkNumber ?? ""}
                      onChange={(v) =>
                        patchRow(index, {
                          check: { ...(row.check ?? emptyCheck()), checkNumber: v },
                        })
                      }
                    />
                    <Field
                      label="شناسه صیادی"
                      value={row.check?.sadadId ?? ""}
                      onChange={(v) =>
                        patchRow(index, { check: { ...(row.check ?? emptyCheck()), sadadId: v } })
                      }
                    />
                    <DateField
                      label="تاریخ چک"
                      value={row.check?.dueDate ?? null}
                      onChange={(iso) =>
                        patchRow(index, { check: { ...(row.check ?? emptyCheck()), dueDate: iso } })
                      }
                    />
                  </FieldGrid>
                )}

                <Field
                  label="توضیح"
                  value={row.note}
                  onChange={(v) => patchRow(index, { note: v })}
                />
              </RepeatableRow>
            ))}

            <AddRowButton label="افزودن قسط" onClick={addRow} />

            {rows.length > 0 && !matches && (
              <Notice tone={overpay ? "error" : "warning"}>
                {overpay
                  ? `جمع اقساط ${formatToman(scheduled)} از ثمن معامله بیشتر است.`
                  : `جمع اقساط ${formatToman(scheduled)} با ثمن معامله ${formatToman(price)} برابر نیست.`}
              </Notice>
            )}
            {rows.length > 0 && matches && (
              <Notice tone="success">جمع اقساط با ثمن معامله برابر است.</Notice>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard
        title="مبلغ هنگام تنظیم سند"
        description="اختیاری — مبلغی که در دفترخانه پرداخت می‌شود"
      >
        <MoneyField
          label="مبلغ قابل پرداخت در دفترخانه"
          value={d.registration.amountAtRegistration}
          onChange={(v) =>
            patchData({ registration: { ...d.registration, amountAtRegistration: v } })
          }
        />
      </SectionCard>
    </div>
  );
}
