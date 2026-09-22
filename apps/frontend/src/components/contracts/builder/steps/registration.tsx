// ============================================================
// LEGALIR — Wizard step: notary & official registration (sale)
// ============================================================
// When and where the parties will attend the notary office, and who
// prepares which documents. The legal warning is driven by the
// registry's `registrationPolicy` — never hard-coded here — so the
// "Legalier finalized ≠ ownership transferred" rule stays in one
// place and applies to every contract type that needs it.
// ============================================================

"use client";

import React from "react";
import { useWizard } from "../wizard-context";
import { Field, FieldGrid, SectionCard, ChoiceField, DateField, Notice } from "../primitives";
import { getContractDefinition } from "@/lib/contracts/registry";
import type { PropertySaleData } from "@legalir/types";

const RESPONSIBLE: { value: "seller" | "buyer" | "both"; label: string }[] = [
  { value: "seller", label: "فروشنده" },
  { value: "buyer", label: "خریدار" },
  { value: "both", label: "هر دو" },
];

/** Documents the seller is expected to bring to the notary office. */
const SELLER_DOCUMENTS = [
  "سند مالکیت اصلی",
  "کارت ملی و شناسنامه فروشنده",
  "مدارک فک رهن یا تسویه وام",
  "پایان‌کار و صورت‌مجلس تفکیکی",
  "گواهی عدم بازداشت ملک",
  "آخرین قبوض آب، برق و گاز",
];

export function RegistrationStep() {
  const { contract, data, patchData } = useWizard();
  const d = data as PropertySaleData;
  const def = getContractDefinition(contract.type);

  const setRegistration = (patch: Partial<PropertySaleData["registration"]>) =>
    patchData({ registration: { ...d.registration, ...patch } });

  const toggleDocument = (label: string) => {
    const list = d.registration.requiredDocuments;
    setRegistration({
      requiredDocuments: list.includes(label)
        ? list.filter((x) => x !== label)
        : [...list, label],
    });
  };

  return (
    <div className="space-y-4">
      <Notice tone="warning" title="نکته حقوقی مهم">
        {def.registrationPolicy.explanationFa}
      </Notice>

      <SectionCard title="زمان و مکان ثبت" description="اطلاعات حضور در دفتر اسناد رسمی">
        <FieldGrid>
          <DateField
            label="تاریخ توافقی حضور در دفترخانه"
            value={d.registration.agreedDate}
            onChange={(iso) => setRegistration({ agreedDate: iso })}
          />
          <Field
            label="ساعت حضور"
            value={d.registration.agreedTime}
            onChange={(v) => setRegistration({ agreedTime: v })}
            placeholder="مثلاً ۱۰:۳۰"
          />
          <Field
            label="شهر دفترخانه"
            value={d.registration.notaryCity}
            onChange={(v) => setRegistration({ notaryCity: v })}
          />
          <Field
            label="شماره دفترخانه"
            value={d.registration.notaryOfficeNumber}
            onChange={(v) => setRegistration({ notaryOfficeNumber: v })}
          />
        </FieldGrid>
        <Field
          label="نشانی دفترخانه"
          value={d.registration.notaryAddress}
          onChange={(v) => setRegistration({ notaryAddress: v })}
        />
      </SectionCard>

      <SectionCard title="مسئولیت مدارک" description="چه کسی مدارک ثبت را تهیه می‌کند؟">
        <ChoiceField
          label="مسئول تهیه مدارک"
          value={d.registration.documentsResponsible}
          onChange={(v) => setRegistration({ documentsResponsible: v })}
          options={RESPONSIBLE}
        />

        <div className="space-y-2">
          <span className="block text-labelMedium text-on-surface-variant">
            چک‌لیست مدارک فروشنده
          </span>
          <div className="flex flex-wrap gap-2">
            {SELLER_DOCUMENTS.map((label) => {
              const selected = d.registration.requiredDocuments.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDocument(label)}
                  className={`rounded-full px-3 py-1.5 text-labelLarge border transition-colors ${
                    selected
                      ? "bg-primary text-primary-on border-primary"
                      : "bg-surface text-on-surface border-outline hover:bg-surface-container"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
