// ============================================================
// LEGALIR — Wizard step: ownership & legal status
// ============================================================
// The deed details are shared by both journeys. The sale journey
// additionally asks the legal-status questions (رهن، بازداشت، وام،
// مستأجر) that determine whether the property can be transferred.
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
  Notice,
  DateField,
} from "../primitives";
import type { DeedType, LegalStatusAnswer, PropertySaleData } from "@legalir/types";

const DEED_TYPES: { value: DeedType; label: string }[] = [
  { value: "single_page", label: "تک‌برگ" },
  { value: "booklet", label: "دفترچه‌ای" },
  { value: "other", label: "سایر" },
  { value: "none", label: "بدون سند" },
];

const LEGAL_ANSWERS: { value: LegalStatusAnswer; label: string }[] = [
  { value: "yes", label: "بله" },
  { value: "no", label: "خیر" },
  { value: "unknown", label: "نامشخص" },
];

export function OwnershipStep() {
  const { contract, data, patchData } = useWizard();
  const d = data;
  const isSale = contract.type === "property_sale";

  const setDeed = (patch: Partial<typeof d.deed>) => patchData({ deed: { ...d.deed, ...patch } });

  const sale = isSale ? (d as PropertySaleData) : null;
  const setLegal = (patch: Partial<PropertySaleData["legalStatus"]>) => {
    if (!sale) return;
    patchData({ legalStatus: { ...sale.legalStatus, ...patch } });
  };
  const setExtras = (patch: Partial<PropertySaleData["extras"]>) => {
    if (!sale) return;
    patchData({ extras: { ...sale.extras, ...patch } });
  };

  return (
    <div className="space-y-4">
      <SectionCard title="سند مالکیت" description="مشخصات ثبتی ملک مطابق سند رسمی">
        <FieldGrid>
          <ChoiceField
            label="نوع سند"
            value={d.deed.deedType}
            onChange={(v) => setDeed({ deedType: v })}
            options={DEED_TYPES}
          />
          <Field
            label="شماره سند"
            value={d.deed.deedNumber}
            onChange={(v) => setDeed({ deedNumber: v })}
          />
          <Field
            label="شناسه یکتای سند (حدنگار)"
            value={d.deed.uniqueDeedId}
            onChange={(v) => setDeed({ uniqueDeedId: v })}
          />
          <Field
            label="شماره سریال سند"
            value={d.deed.serialNumber}
            onChange={(v) => setDeed({ serialNumber: v })}
          />
          <Field
            label="پلاک ثبتی اصلی"
            value={d.deed.mainPlaque}
            onChange={(v) => setDeed({ mainPlaque: v })}
          />
          <Field
            label="پلاک ثبتی فرعی"
            value={d.deed.subPlaque}
            onChange={(v) => setDeed({ subPlaque: v })}
          />
          <Field
            label="بخش ثبتی"
            value={d.deed.registrationDistrict}
            onChange={(v) => setDeed({ registrationDistrict: v })}
          />
          <Field label="قطعه" value={d.deed.parcel} onChange={(v) => setDeed({ parcel: v })} />
          <Field
            label="حوزه ثبتی"
            value={d.deed.registrationZone}
            onChange={(v) => setDeed({ registrationZone: v })}
          />
          <NumberField
            label="مساحت رسمی سند"
            value={d.deed.officialArea}
            onChange={(v) => setDeed({ officialArea: v })}
            suffix="مترمربع"
          />
          <Field
            label="نام مالک در سند"
            value={d.deed.ownerName}
            onChange={(v) => setDeed({ ownerName: v })}
          />
        </FieldGrid>
        <DateField
          label="تاریخ سند"
          value={d.deed.deedDate}
          onChange={(iso) => setDeed({ deedDate: iso })}
        />
      </SectionCard>

      {sale && (
        <>
          <SectionCard
            title="وضعیت حقوقی ملک"
            description="این پاسخ‌ها در متن مبایعه‌نامه درج می‌شود و مبنای تعهدات طرفین است"
          >
            <ChoiceField
              label="آیا ملک در رهن است؟"
              value={sale.legalStatus.inMortgage}
              onChange={(v) => setLegal({ inMortgage: v })}
              options={LEGAL_ANSWERS}
            />
            {sale.legalStatus.inMortgage === "yes" && (
              <Field
                label="جزئیات رهن"
                value={sale.legalStatus.mortgageDetails}
                onChange={(v) => setLegal({ mortgageDetails: v })}
                placeholder="مبلغ، طلبکار و شرایط فک رهن"
              />
            )}

            <ChoiceField
              label="آیا ملک بازداشت است؟"
              value={sale.legalStatus.seized}
              onChange={(v) => setLegal({ seized: v })}
              options={LEGAL_ANSWERS}
            />

            <ChoiceField
              label="آیا ملک دارای وام است؟"
              value={sale.legalStatus.hasLoan}
              onChange={(v) => setLegal({ hasLoan: v })}
              options={LEGAL_ANSWERS}
            />
            {sale.legalStatus.hasLoan === "yes" && (
              <Field
                label="جزئیات وام"
                value={sale.legalStatus.loanDetails}
                onChange={(v) => setLegal({ loanDetails: v })}
                placeholder="بانک، مبلغ باقی‌مانده و شرایط تسویه"
              />
            )}

            <ChoiceField
              label="آیا ملک در اختیار مستأجر است؟"
              value={sale.legalStatus.occupiedByTenant}
              onChange={(v) => setLegal({ occupiedByTenant: v })}
              options={LEGAL_ANSWERS}
            />
            {sale.legalStatus.occupiedByTenant === "yes" && (
              <DateField
                label="تاریخ پایان اجاره مستأجر"
                value={sale.legalStatus.tenantLeaseEnd}
                onChange={(iso) => setLegal({ tenantLeaseEnd: iso })}
              />
            )}

            <ChoiceField
              label="آیا محدودیتی برای انتقال وجود دارد؟"
              value={sale.legalStatus.transferRestricted}
              onChange={(v) => setLegal({ transferRestricted: v })}
              options={LEGAL_ANSWERS}
            />
            {sale.legalStatus.transferRestricted === "yes" && (
              <Field
                label="جزئیات محدودیت"
                value={sale.legalStatus.restrictionDetails}
                onChange={(v) => setLegal({ restrictionDetails: v })}
              />
            )}

            {(sale.legalStatus.seized === "yes" ||
              sale.legalStatus.transferRestricted === "yes") && (
              <Notice tone="warning" title="توجه حقوقی">
                وجود بازداشت یا محدودیت انتقال، مانع قانونی برای تنظیم سند رسمی است. پیش از امضا، رفع این موانع را
                با یک وکیل بررسی کنید.
              </Notice>
            )}
          </SectionCard>

          <SectionCard title="مدارک فنی و بدهی‌ها" description="پایان‌کار، تفکیک و وضعیت خلافی">
            <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2">
              <ChoiceField
                label="پایان‌کار دارد؟"
                value={sale.extras.hasCompletionCertificate ? "yes" : "no"}
                onChange={(v) => setExtras({ hasCompletionCertificate: v === "yes" })}
                options={[
                  { value: "yes", label: "بله" },
                  { value: "no", label: "خیر" },
                ]}
              />
              <ChoiceField
                label="صورت‌مجلس تفکیکی دارد؟"
                value={sale.extras.hasPartitionMinutes ? "yes" : "no"}
                onChange={(v) => setExtras({ hasPartitionMinutes: v === "yes" })}
                options={[
                  { value: "yes", label: "بله" },
                  { value: "no", label: "خیر" },
                ]}
              />
            </div>
            {sale.extras.hasCompletionCertificate && (
              <FieldGrid>
                <Field
                  label="شماره پایان‌کار"
                  value={sale.extras.completionCertificateNumber}
                  onChange={(v) => setExtras({ completionCertificateNumber: v })}
                />
              </FieldGrid>
            )}
            {sale.extras.hasCompletionCertificate && (
              <DateField
                label="تاریخ پایان‌کار"
                value={sale.extras.completionCertificateDate}
                onChange={(iso) => setExtras({ completionCertificateDate: iso })}
              />
            )}
            <Field
              label="وضعیت خلافی ساختمانی"
              value={sale.extras.buildingViolations}
              onChange={(v) => setExtras({ buildingViolations: v })}
              placeholder="مثلاً بدون خلافی"
            />
          </SectionCard>
        </>
      )}

      {!isSale && (
        <Notice tone="info" title="اختیار موجر">
          اگر موجر مالک سند نیست، در مرحله طرفین سمت «وکیل مالک» را انتخاب کنید و مشخصات وکالت‌نامه را ثبت نمایید.
        </Notice>
      )}
    </div>
  );
}
