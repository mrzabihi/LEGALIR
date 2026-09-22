// ============================================================
// LEGALIR — Wizard step: obligations & conditions
// ============================================================
// One step id ("obligations") is shared by both journeys, so this
// module dispatches on the contract type: rent collects who bears
// each recurring cost, the usage rules and the termination grounds;
// sale collects the penalties and the prior-debt responsibility.
// ============================================================

"use client";

import React from "react";
import { useWizard } from "../wizard-context";
import {
  Field,
  FieldGrid,
  SectionCard,
  ChoiceField,
  MoneyField,
  ToggleRow,
  Notice,
} from "../primitives";
import type { CostBearer, PropertyRentData, PropertySaleData, RentCosts } from "@legalir/types";

// ------------------------------------------------------------
// Shared option sets
// ------------------------------------------------------------

const COST_BEARERS: { value: CostBearer; label: string }[] = [
  { value: "tenant", label: "مستأجر" },
  { value: "landlord", label: "موجر" },
  { value: "other", label: "سایر" },
];

const PENALTY_PERIODS: { value: "daily" | "monthly"; label: string }[] = [
  { value: "daily", label: "روزانه" },
  { value: "monthly", label: "ماهانه" },
];

// ------------------------------------------------------------
// Rent
// ------------------------------------------------------------

const COST_ROWS: { key: keyof RentCosts; label: string }[] = [
  { key: "water", label: "آب" },
  { key: "electricity", label: "برق" },
  { key: "gas", label: "گاز" },
  { key: "telephone", label: "تلفن" },
  { key: "internet", label: "اینترنت" },
  { key: "buildingCharge", label: "شارژ ساختمان" },
  { key: "currentExpenses", label: "هزینه‌های جاری" },
  { key: "majorRepairs", label: "تعمیرات اساسی" },
  { key: "utilityFailures", label: "خرابی انشعابات" },
  { key: "misuseDamage", label: "خسارت ناشی از سوءاستفاده" },
];

const TERMINATION_GROUNDS: {
  key: keyof PropertyRentData["termination"]["grounds"];
  label: string;
}[] = [
  { key: "nonPayment", label: "عدم پرداخت اجاره‌بها" },
  { key: "latePayment", label: "تأخیر در پرداخت اجاره‌بها" },
  { key: "unauthorizedUse", label: "استفاده غیرمجاز از ملک" },
  { key: "sublet", label: "واگذاری به غیر بدون اجازه" },
  { key: "propertyDamage", label: "ایجاد خسارت به ملک" },
  { key: "earlyVacation", label: "تخلیه پیش از موعد" },
  { key: "failureToVacate", label: "عدم تخلیه در موعد مقرر" },
];

function RentObligations() {
  const { data, patchData } = useWizard();
  const d = data as PropertyRentData;

  const setCosts = (patch: Partial<RentCosts>) => patchData({ costs: { ...d.costs, ...patch } });
  const setRules = (patch: Partial<PropertyRentData["usageRules"]>) =>
    patchData({ usageRules: { ...d.usageRules, ...patch } });
  const setTermination = (patch: Partial<PropertyRentData["termination"]>) =>
    patchData({ termination: { ...d.termination, ...patch } });
  const setGround = (key: keyof PropertyRentData["termination"]["grounds"], value: boolean) =>
    setTermination({ grounds: { ...d.termination.grounds, [key]: value } });

  return (
    <div className="space-y-4">
      <SectionCard title="پرداخت هزینه‌ها" description="هر هزینه بر عهده کدام طرف است؟">
        <FieldGrid>
          {COST_ROWS.map((row) => (
            <ChoiceField
              key={row.key}
              label={row.label}
              value={d.costs[row.key]}
              onChange={(v) => setCosts({ [row.key]: v } as Partial<RentCosts>)}
              options={COST_BEARERS}
            />
          ))}
        </FieldGrid>
      </SectionCard>

      <SectionCard title="قواعد استفاده از ملک" description="محدودیت‌ها و مجوزهای بهره‌برداری">
        <ToggleRow
          label="استفاده صرفاً مسکونی"
          description="ملک فقط برای سکونت استفاده می‌شود"
          checked={d.usageRules.residentialOnly}
          onChange={(v) => setRules({ residentialOnly: v })}
        />
        <ToggleRow
          label="اجازه تغییر کاربری"
          checked={d.usageRules.allowChangeOfUse}
          onChange={(v) => setRules({ allowChangeOfUse: v })}
        />
        <ToggleRow
          label="اجازه واگذاری به غیر"
          checked={d.usageRules.allowSublet}
          onChange={(v) => setRules({ allowSublet: v })}
        />
        <ToggleRow
          label="اجازه نگهداری حیوان خانگی"
          checked={d.usageRules.allowPets}
          onChange={(v) => setRules({ allowPets: v })}
        />
        <ToggleRow
          label="اجازه تغییرات سازه‌ای"
          checked={d.usageRules.allowStructuralChanges}
          onChange={(v) => setRules({ allowStructuralChanges: v })}
        />
        <ToggleRow
          label="اجازه نصب تجهیزات روی نما"
          checked={d.usageRules.allowFacadeEquipment}
          onChange={(v) => setRules({ allowFacadeEquipment: v })}
        />

        <FieldGrid>
          <Field
            label="شرایط پارکینگ"
            value={d.usageRules.parkingTerms}
            onChange={(v) => setRules({ parkingTerms: v })}
          />
          <Field
            label="شرایط مشاعات"
            value={d.usageRules.commonAreaTerms}
            onChange={(v) => setRules({ commonAreaTerms: v })}
          />
          <Field
            label="شرایط نگهداری"
            value={d.usageRules.maintenanceTerms}
            onChange={(v) => setRules({ maintenanceTerms: v })}
          />
          <Field
            label="مسئولیت خسارت مشاعات"
            value={d.usageRules.commonAreaDamageLiability}
            onChange={(v) => setRules({ commonAreaDamageLiability: v })}
          />
        </FieldGrid>
      </SectionCard>

      <SectionCard title="موارد فسخ قرارداد" description="زمینه‌هایی که به فسخ قرارداد منجر می‌شود">
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2">
          {TERMINATION_GROUNDS.map((g) => (
            <ToggleRow
              key={g.key}
              label={g.label}
              checked={d.termination.grounds[g.key]}
              onChange={(v) => setGround(g.key, v)}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="وجه التزام عدم تخلیه" description="اختیاری — در صورت توافق طرفین">
        <ChoiceField
          label="دوره محاسبه"
          value={d.termination.evictionPenaltyPeriod ?? ""}
          onChange={(v) => setTermination({ evictionPenaltyPeriod: v })}
          options={PENALTY_PERIODS}
          placeholder="انتخاب کنید"
        />
        <MoneyField
          label="مبلغ وجه التزام"
          value={d.termination.evictionPenaltyAmount}
          onChange={(v) => setTermination({ evictionPenaltyAmount: v })}
        />
      </SectionCard>

      <SectionCard title="بازگشت ودیعه" description="شرایط و زمان بازگرداندن ودیعه به مستأجر">
        <Field
          label="شرایط بازگشت ودیعه"
          value={d.termination.depositReturnTerms}
          onChange={(v) => setTermination({ depositReturnTerms: v })}
          placeholder="مثلاً پس از تخلیه و تسویه بدهی‌ها"
        />
        <Field
          label="زمان بازگشت ودیعه"
          value={d.termination.depositReturnTiming}
          onChange={(v) => setTermination({ depositReturnTiming: v })}
          placeholder="مثلاً حداکثر یک ماه پس از تخلیه"
        />
      </SectionCard>
    </div>
  );
}

// ------------------------------------------------------------
// Sale
// ------------------------------------------------------------

const PRIOR_DEBT_BEARERS: { value: "seller" | "buyer" | "other"; label: string }[] = [
  { value: "seller", label: "فروشنده" },
  { value: "buyer", label: "خریدار" },
  { value: "other", label: "سایر" },
];

function SaleObligations() {
  const { data, patchData } = useWizard();
  const d = data as PropertySaleData;

  const setObligations = (patch: Partial<PropertySaleData["obligations"]>) =>
    patchData({ obligations: { ...d.obligations, ...patch } });

  return (
    <div className="space-y-4">
      <SectionCard title="وجه التزام‌ها" description="جرائم توافقی برای عدم انجام تعهدات">
        <MoneyField
          label="جریمه عدم حضور فروشنده در دفترخانه"
          value={d.obligations.sellerNoShowPenalty}
          onChange={(v) => setObligations({ sellerNoShowPenalty: v })}
        />
        <MoneyField
          label="وجه التزام تأخیر در تحویل ملک"
          value={d.obligations.handoverDelayPenalty}
          onChange={(v) => setObligations({ handoverDelayPenalty: v })}
        />
      </SectionCard>

      <SectionCard title="تعهدات فروشنده" description="تعهدات مربوط به وضعیت حقوقی ملک">
        <ToggleRow
          label="فروشنده متعهد به فک رهن پیش از انتقال است"
          checked={d.obligations.sellerMustReleaseMortgage}
          onChange={(v) => setObligations({ sellerMustReleaseMortgage: v })}
        />
        <ChoiceField
          label="تسویه بدهی‌های قبلی بر عهده"
          value={d.obligations.priorDebtsBearer}
          onChange={(v) => setObligations({ priorDebtsBearer: v })}
          options={PRIOR_DEBT_BEARERS}
        />
        {d.obligations.priorDebtsBearer === "buyer" && (
          <Notice tone="warning">
            با انتخاب «خریدار»، بدهی‌های قبلی ملک (از جمله عوارض و شارژ معوق) بر عهده خریدار خواهد بود. این
            موضوع را پیش از امضا با وکیل بررسی کنید.
          </Notice>
        )}
      </SectionCard>

      <SectionCard title="تجهیزات و سایر توافقات" description="آنچه همراه ملک منتقل می‌شود">
        <Field
          label="تجهیزات همراه ملک"
          value={d.obligations.includedEquipment}
          onChange={(v) => setObligations({ includedEquipment: v })}
          placeholder="مثلاً کولر، پکیج، کابینت"
        />
        <Field
          label="سایر توافقات"
          value={d.obligations.otherTerms}
          onChange={(v) => setObligations({ otherTerms: v })}
        />
      </SectionCard>
    </div>
  );
}

// ------------------------------------------------------------
// Dispatcher
// ------------------------------------------------------------

export function ObligationsStep() {
  const { contract } = useWizard();
  return contract.type === "property_sale" ? <SaleObligations /> : <RentObligations />;
}
