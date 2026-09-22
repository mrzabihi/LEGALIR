// ============================================================
// LEGALIR — Wizard step: financial (rent)
// ============================================================
// ودیعه، اجاره‌بها، مدت اجاره و وجه التزام تأخیر. Money is entered
// in toman and stored as integer rial through the central utility.
// The duration is derived from the start/end dates so the user
// never has to compute it.
// ============================================================

"use client";

import React from "react";
import { useWizard } from "../wizard-context";
import {
  Field,
  FieldGrid,
  NumberField,
  SectionCard,
  ChoiceField,
  MoneyField,
  DateField,
  ToggleRow,
  Notice,
} from "../primitives";
import { monthsBetween, addMonthsIso } from "@/lib/contracts/dates";
import { formatToman, isZeroMoney } from "@/lib/contracts/money";
import type { PropertyRentData, RentAgreementKind } from "@legalir/types";

const AGREEMENT_KINDS: { value: RentAgreementKind; label: string }[] = [
  { value: "deposit_and_rent", label: "رهن و اجاره" },
  { value: "full_deposit", label: "رهن کامل" },
  { value: "rent_only", label: "اجاره بدون ودیعه" },
];

export function FinancialRentStep() {
  const { data, patchData } = useWizard();
  const d = data as PropertyRentData;

  const setTerms = (patch: Partial<PropertyRentData["terms"]>) =>
    patchData({ terms: { ...d.terms, ...patch } });
  const setDurations = (patch: Partial<PropertyRentData["durations"]>) =>
    patchData({ durations: { ...d.durations, ...patch } });

  const months = monthsBetween(d.durations.startDate, d.durations.endDate);

  // The end date may never precede the start date. Both are ISO strings,
  // so a plain lexicographic compare is a correct chronological compare.
  const endBeforeStart =
    !!d.durations.startDate &&
    !!d.durations.endDate &&
    d.durations.endDate < d.durations.startDate;
  const END_BEFORE_START_FA = "تاریخ پایان قرارداد نمی‌تواند قبل از تاریخ شروع باشد.";

  /** When the start date changes, keep the end date a whole year later. */
  function onStartChange(iso: string | null) {
    const patch: Partial<PropertyRentData["durations"]> = { startDate: iso };
    if (iso && !d.durations.endDate) {
      patch.endDate = addMonthsIso(iso, 12);
    }
    patch.durationMonths = monthsBetween(iso, patch.endDate ?? d.durations.endDate);
    setDurations(patch);
  }

  function onEndChange(iso: string | null) {
    setDurations({
      endDate: iso,
      durationMonths: monthsBetween(d.durations.startDate, iso),
    });
  }

  const showDeposit = d.terms.agreementKind !== "rent_only";
  const showRent = d.terms.agreementKind !== "full_deposit";

  return (
    <div className="space-y-4">
      <SectionCard title="نوع توافق" description="ساختار مالی قرارداد اجاره">
        <ChoiceField
          label="نوع توافق"
          value={d.terms.agreementKind}
          onChange={(v) => setTerms({ agreementKind: v })}
          options={AGREEMENT_KINDS}
        />
      </SectionCard>

      <SectionCard title="مبلغ‌ها" description="مبالغ را به تومان وارد کنید">
        {showDeposit && (
          <MoneyField
            label="مبلغ ودیعه (رهن)"
            value={d.terms.securityDeposit}
            onChange={(v) => setTerms({ securityDeposit: v ?? { amount: 0, currency: "IRR" } })}
          />
        )}
        {showRent && (
          <MoneyField
            label="اجاره‌بها ماهانه"
            value={d.terms.monthlyRent}
            onChange={(v) => setTerms({ monthlyRent: v ?? { amount: 0, currency: "IRR" } })}
          />
        )}

        {showRent && (
          <FieldGrid>
            <NumberField
              label="روز سررسید پرداخت اجاره"
              value={d.terms.rentDueDay}
              onChange={(v) => setTerms({ rentDueDay: v })}
              min={1}
              helperText="روز ماه (۱ تا ۳۱)"
            />
            <Field
              label="شماره حساب موجر"
              value={d.terms.landlordAccount}
              onChange={(v) => setTerms({ landlordAccount: v })}
              placeholder="شبا یا شماره کارت"
            />
          </FieldGrid>
        )}

        {showDeposit && (
          <ToggleRow
            label="ودیعه به‌صورت قسطی پرداخت می‌شود"
            checked={d.terms.depositInstalments}
            onChange={(v) => setTerms({ depositInstalments: v })}
          />
        )}
      </SectionCard>

      <SectionCard title="مدت اجاره" description="تاریخ‌ها به شمسی ثبت می‌شوند">
        <DateField
          label="تاریخ عقد قرارداد"
          value={d.durations.contractDate}
          onChange={(iso) => setDurations({ contractDate: iso })}
        />
        <FieldGrid>
          <DateField
            label="تاریخ شروع اجاره"
            value={d.durations.startDate}
            onChange={onStartChange}
          />
          <DateField
            label="تاریخ پایان اجاره"
            value={d.durations.endDate}
            onChange={onEndChange}
            errorMessage={endBeforeStart ? END_BEFORE_START_FA : undefined}
          />
        </FieldGrid>
        <DateField
          label="تاریخ تحویل ملک"
          value={d.durations.handoverDate}
          onChange={(iso) => setDurations({ handoverDate: iso })}
        />
        {months !== null && (
          <Notice tone="success">
            مدت اجاره: {months} ماه
            {d.terms.agreementKind !== "full_deposit" && !isZeroMoney(d.terms.monthlyRent)
              ? ` — مجموع اجاره‌بها در این مدت: ${formatToman({
                  amount: d.terms.monthlyRent.amount * months,
                  currency: "IRR",
                })}`
              : ""}
          </Notice>
        )}
      </SectionCard>

      <SectionCard title="وجه التزام تأخیر در پرداخت" description="اختیاری — در صورت توافق طرفین">
        <ToggleRow
          label="وجه التزام تأخیر در پرداخت اجاره اعمال می‌شود"
          checked={d.terms.hasLatePenalty}
          onChange={(v) => setTerms({ hasLatePenalty: v })}
        />
        {d.terms.hasLatePenalty && (
          <>
            <ChoiceField
              label="دوره محاسبه"
              value={d.terms.latePenaltyPeriod ?? ""}
              onChange={(v) => setTerms({ latePenaltyPeriod: v })}
              options={[
                { value: "daily", label: "روزانه" },
                { value: "monthly", label: "ماهانه" },
              ]}
              placeholder="انتخاب کنید"
            />
            <MoneyField
              label="مبلغ وجه التزام"
              value={d.terms.latePenaltyAmount}
              onChange={(v) => setTerms({ latePenaltyAmount: v })}
            />
          </>
        )}
      </SectionCard>
    </div>
  );
}
