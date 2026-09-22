// ============================================================
// LEGALIR — Wizard step: handover condition
// ============================================================
// The condition of the property at handover, the meter readings and
// the keys handed over. This record is what protects both parties
// later: it is snapshotted into the contract version and printed in
// the final PDF, so a dispute has a dated, hashed reference.
// ============================================================

"use client";

import React from "react";
import { useWizard } from "../wizard-context";
import { Field, FieldGrid, SectionCard, ChoiceField, NumberField, Notice } from "../primitives";
import type {
  ConditionState,
  HandoverRecord,
  PropertyRentData,
  PropertySaleData,
} from "@legalir/types";

/** This step only ever renders for the two property journeys. */
type PropertyData = PropertyRentData | PropertySaleData;

const CONDITION_OPTIONS: { value: ConditionState; label: string }[] = [
  { value: "intact", label: "سالم" },
  { value: "flawed", label: "دارای ایراد جزئی" },
  { value: "needs_repair", label: "نیازمند تعمیر" },
  { value: "unrecorded", label: "ثبت‌نشده" },
];

export function HandoverStep() {
  const { data, patchData } = useWizard();
  const handover = (data as PropertyData).handover;

  const setHandover = (patch: Partial<HandoverRecord>) =>
    patchData({ handover: { ...handover, ...patch } });

  const setItem = (key: string, patch: Partial<HandoverRecord["items"][number]>) =>
    setHandover({
      items: handover.items.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    });

  const setMeter = (key: string, patch: Partial<HandoverRecord["meters"][number]>) =>
    setHandover({
      meters: handover.meters.map((m) => (m.key === key ? { ...m, ...patch } : m)),
    });

  const setKeyCount = (key: string, count: number | null) =>
    setHandover({
      keys: handover.keys.map((k) => (k.key === key ? { ...k, count: count ?? 0 } : k)),
    });

  const recorded = handover.items.filter((i) => i.state !== "unrecorded").length;

  return (
    <div className="space-y-4">
      <Notice tone="info" title="چرا این مرحله مهم است؟">
        وضعیت ملک در لحظه تحویل ثبت و در نسخه نهایی قرارداد درج می‌شود. این ثبت مبنای رسیدگی به اختلاف‌های
        آینده درباره خسارت است.
      </Notice>

      <SectionCard
        title="وضعیت اجزا"
        description="وضعیت هر بخش از ملک را در زمان تحویل مشخص کنید"
        aside={
          <span className="text-caption text-muted">
            {recorded} از {handover.items.length} ثبت‌شده
          </span>
        }
      >
        <div className="space-y-3">
          {handover.items.map((item) => (
            <div
              key={item.key}
              className="rounded-medium border border-divider bg-surface-container-low p-3 space-y-2"
            >
              <span className="block text-labelLarge text-on-surface">{item.labelFa}</span>
              <FieldGrid>
                <ChoiceField
                  label="وضعیت"
                  value={item.state}
                  onChange={(v) => setItem(item.key, { state: v })}
                  options={CONDITION_OPTIONS}
                />
                <Field
                  label="توضیح"
                  value={item.note}
                  onChange={(v) => setItem(item.key, { note: v })}
                  placeholder="در صورت وجود ایراد، توضیح دهید"
                />
              </FieldGrid>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="قرائت کنتورها" description="شماره و رقم کنتور در زمان تحویل">
        <div className="space-y-3">
          {handover.meters.map((meter) => (
            <div
              key={meter.key}
              className="rounded-medium border border-divider bg-surface-container-low p-3 space-y-2"
            >
              <span className="block text-labelLarge text-on-surface">{meter.labelFa}</span>
              <FieldGrid>
                <Field
                  label="شماره کنتور"
                  value={meter.meterNumber}
                  onChange={(v) => setMeter(meter.key, { meterNumber: v })}
                />
                <Field
                  label="رقم کنتور"
                  value={meter.value}
                  onChange={(v) => setMeter(meter.key, { value: v })}
                  inputMode="numeric"
                />
              </FieldGrid>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="کلیدهای تحویلی" description="تعداد کلید تحویل‌شده برای هر مورد">
        <FieldGrid>
          {handover.keys.map((k) => (
            <NumberField
              key={k.key}
              label={k.labelFa}
              value={k.count}
              onChange={(v) => setKeyCount(k.key, v)}
              suffix="عدد"
            />
          ))}
        </FieldGrid>
      </SectionCard>

      <SectionCard title="یادداشت تحویل" description="هر نکته دیگری که باید ثبت شود">
        <Field
          label="یادداشت"
          value={handover.notes}
          onChange={(v) => setHandover({ notes: v })}
          placeholder="مثلاً تحویل با یک عدد ریموت پارکینگ"
        />
      </SectionCard>
    </div>
  );
}
