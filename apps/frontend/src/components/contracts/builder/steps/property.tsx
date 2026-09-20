// ============================================================
// LEGALIR — Wizard step: property
// ============================================================
// Address, general specs and amenities. Shared by both journeys
// because the property description is identical; only the terms
// differ. Villa-only fields appear conditionally when the property
// kind is `villa` — the conditional-field requirement.
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
  ToggleRow,
  Notice,
} from "../primitives";
import type {
  KitchenKind,
  ParkingKind,
  PropertyKind,
  RestroomKind,
  UtilityStatus,
  VillaDetails,
} from "@legalir/types";

const PROPERTY_KINDS: { value: PropertyKind; label: string }[] = [
  { value: "apartment", label: "آپارتمان" },
  { value: "house", label: "خانه" },
  { value: "villa", label: "ویلا" },
];

const PARKING_KINDS: { value: ParkingKind; label: string }[] = [
  { value: "exclusive", label: "اختصاصی" },
  { value: "shared", label: "مشترک" },
  { value: "obstructing", label: "مزاحم" },
];

const UTILITY_STATUSES: { value: UtilityStatus; label: string }[] = [
  { value: "independent", label: "مستقل" },
  { value: "shared", label: "مشترک" },
  { value: "none", label: "ندارد" },
];

const HEATING_OPTIONS = ["پکیج", "موتورخانه", "شوفاژ", "بخاری", "اسپلیت", "زمینی"];
const COOLING_OPTIONS = ["کولر آبی", "کولر گازی", "اسپلیت", "چیلر", "فن‌کوئل"];

const EMPTY_VILLA: VillaDetails = {
  landArea: null,
  buildingArea: null,
  yardArea: null,
  roofGarden: false,
  pool: false,
  sauna: false,
  jacuzzi: false,
  pergola: false,
  greenSpace: false,
  exclusiveFloors: null,
  buildingPermit: "",
};

export function PropertyStep() {
  const { data, patchData } = useWizard();
  const d = data;

  const setAddress = (patch: Partial<typeof d.address>) =>
    patchData({ address: { ...d.address, ...patch } });
  const setGeneral = (patch: Partial<typeof d.general>) =>
    patchData({ general: { ...d.general, ...patch } });
  const setAmenities = (patch: Partial<typeof d.amenities>) =>
    patchData({ amenities: { ...d.amenities, ...patch } });
  const setUtilities = (patch: Partial<typeof d.amenities.utilities>) =>
    patchData({ amenities: { ...d.amenities, utilities: { ...d.amenities.utilities, ...patch } } });
  const setVilla = (patch: Partial<VillaDetails>) =>
    patchData({ villa: { ...EMPTY_VILLA, ...(d.villa ?? {}), ...patch } });

  const toggleIn = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="space-y-4">
      <SectionCard title="نوع ملک" description="نوع ملک تعیین می‌کند کدام فیلدها نمایش داده شوند">
        <ChoiceField
          label="نوع ملک"
          value={d.propertyKind}
          onChange={(v) => patchData({ propertyKind: v })}
          options={PROPERTY_KINDS}
        />
      </SectionCard>

      <SectionCard title="نشانی ملک" description="نشانی دقیق ملک موضوع قرارداد">
        <FieldGrid>
          <Field label="استان" value={d.address.province} onChange={(v) => setAddress({ province: v })} />
          <Field label="شهر" value={d.address.city} onChange={(v) => setAddress({ city: v })} />
          <Field label="منطقه" value={d.address.district} onChange={(v) => setAddress({ district: v })} />
          <Field
            label="محله"
            value={d.address.neighborhood}
            onChange={(v) => setAddress({ neighborhood: v })}
          />
          <Field label="خیابان" value={d.address.street} onChange={(v) => setAddress({ street: v })} />
          <Field label="کوچه" value={d.address.alley} onChange={(v) => setAddress({ alley: v })} />
          <Field label="پلاک" value={d.address.plaque} onChange={(v) => setAddress({ plaque: v })} />
          <Field label="طبقه" value={d.address.floor} onChange={(v) => setAddress({ floor: v })} />
          <Field label="واحد" value={d.address.unit} onChange={(v) => setAddress({ unit: v })} />
          <Field
            label="کد پستی"
            value={d.address.postalCode}
            onChange={(v) => setAddress({ postalCode: v.replace(/\D/g, "").slice(0, 10) })}
            inputMode="numeric"
          />
        </FieldGrid>
      </SectionCard>

      <SectionCard title="مشخصات عمومی" description="متراژ، سال ساخت و تعداد اتاق">
        <FieldGrid>
          <NumberField
            label="متراژ (مترمربع)"
            value={d.general.area}
            onChange={(v) => setGeneral({ area: v })}
            suffix="مترمربع"
          />
          <NumberField
            label="سال ساخت"
            value={d.general.buildYear}
            onChange={(v) => setGeneral({ buildYear: v })}
            min={1300}
          />
          <NumberField label="طبقه" value={d.general.floor} onChange={(v) => setGeneral({ floor: v })} />
          <NumberField
            label="تعداد کل طبقات"
            value={d.general.totalFloors}
            onChange={(v) => setGeneral({ totalFloors: v })}
          />
          <NumberField
            label="تعداد کل واحدها"
            value={d.general.totalUnits}
            onChange={(v) => setGeneral({ totalUnits: v })}
          />
          <NumberField
            label="تعداد واحد در هر طبقه"
            value={d.general.unitsPerFloor}
            onChange={(v) => setGeneral({ unitsPerFloor: v })}
          />
          <NumberField
            label="تعداد اتاق خواب"
            value={d.general.bedrooms}
            onChange={(v) => setGeneral({ bedrooms: v })}
          />
          <Field
            label="شماره واحد"
            value={d.general.unitNumber}
            onChange={(v) => setGeneral({ unitNumber: v })}
          />
          <Field
            label="جهت ملک"
            value={d.general.orientation}
            onChange={(v) => setGeneral({ orientation: v })}
            placeholder="مثلاً شمالی"
          />
          <Field
            label="وضعیت بازسازی"
            value={d.general.renovationStatus}
            onChange={(v) => setGeneral({ renovationStatus: v })}
            placeholder="مثلاً بازسازی‌شده"
          />
          <Field
            label="وضعیت سکونت"
            value={d.general.occupancyStatus}
            onChange={(v) => setGeneral({ occupancyStatus: v })}
            placeholder="مثلاً خالی"
          />
        </FieldGrid>
      </SectionCard>

      {/* Conditional: villa-only fields */}
      {d.propertyKind === "villa" && (
        <SectionCard title="مشخصات ویلا" description="این بخش فقط برای ملک از نوع ویلا نمایش داده می‌شود">
          <FieldGrid>
            <NumberField
              label="مساحت زمین"
              value={d.villa?.landArea ?? null}
              onChange={(v) => setVilla({ landArea: v })}
              suffix="مترمربع"
            />
            <NumberField
              label="مساحت بنا"
              value={d.villa?.buildingArea ?? null}
              onChange={(v) => setVilla({ buildingArea: v })}
              suffix="مترمربع"
            />
            <NumberField
              label="مساحت حیاط"
              value={d.villa?.yardArea ?? null}
              onChange={(v) => setVilla({ yardArea: v })}
              suffix="مترمربع"
            />
            <Field
              label="شماره پروانه ساخت"
              value={d.villa?.buildingPermit ?? ""}
              onChange={(v) => setVilla({ buildingPermit: v })}
            />
          </FieldGrid>
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2">
            {(
              [
                ["roofGarden", "روف گاردن"],
                ["pool", "استخر"],
                ["sauna", "سونا"],
                ["jacuzzi", "جکوزی"],
                ["pergola", "پرگولا"],
                ["greenSpace", "فضای سبز"],
              ] as const
            ).map(([key, label]) => (
              <ToggleRow
                key={key}
                label={label}
                checked={d.villa?.[key] ?? false}
                onChange={(checked) => setVilla({ [key]: checked })}
              />
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="امکانات" description="پارکینگ، انبار، آسانسور و تجهیزات">
        <ToggleRow
          label="پارکینگ دارد"
          checked={d.amenities.hasParking}
          onChange={(v) => setAmenities({ hasParking: v })}
        />
        {d.amenities.hasParking && (
          <FieldGrid>
            <ChoiceField
              label="نوع پارکینگ"
              value={d.amenities.parkingKind ?? ""}
              onChange={(v) => setAmenities({ parkingKind: v })}
              options={PARKING_KINDS}
              placeholder="انتخاب کنید"
            />
            <Field
              label="شماره پارکینگ"
              value={d.amenities.parkingNumber}
              onChange={(v) => setAmenities({ parkingNumber: v })}
            />
            <Field
              label="طبقه پارکینگ"
              value={d.amenities.parkingFloor}
              onChange={(v) => setAmenities({ parkingFloor: v })}
            />
          </FieldGrid>
        )}

        <ToggleRow
          label="انبار دارد"
          checked={d.amenities.hasStorage}
          onChange={(v) => setAmenities({ hasStorage: v })}
        />
        {d.amenities.hasStorage && (
          <FieldGrid>
            <Field
              label="شماره انبار"
              value={d.amenities.storageNumber}
              onChange={(v) => setAmenities({ storageNumber: v })}
            />
            <NumberField
              label="مساحت انبار"
              value={d.amenities.storageArea}
              onChange={(v) => setAmenities({ storageArea: v })}
              suffix="مترمربع"
            />
          </FieldGrid>
        )}

        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2">
          <ToggleRow
            label="آسانسور"
            checked={d.amenities.hasElevator}
            onChange={(v) => setAmenities({ hasElevator: v })}
          />
          <ToggleRow
            label="بالکن"
            checked={d.amenities.hasBalcony}
            onChange={(v) => setAmenities({ hasBalcony: v })}
          />
        </div>
        {d.amenities.hasBalcony && (
          <NumberField
            label="مساحت بالکن"
            value={d.amenities.balconyArea}
            onChange={(v) => setAmenities({ balconyArea: v })}
            suffix="مترمربع"
          />
        )}

        <FieldGrid>
          <NumberField
            label="تعداد سرویس بهداشتی"
            value={d.amenities.restroomCount}
            onChange={(v) => setAmenities({ restroomCount: v })}
          />
          <NumberField
            label="تعداد حمام"
            value={d.amenities.bathroomCount}
            onChange={(v) => setAmenities({ bathroomCount: v })}
          />
          <ChoiceField
            label="نوع سرویس بهداشتی"
            value={d.amenities.restroomKind ?? ""}
            onChange={(v) => setAmenities({ restroomKind: v as RestroomKind })}
            options={[
              { value: "iranian", label: "ایرانی" },
              { value: "european", label: "فرنگی" },
              { value: "both", label: "هر دو" },
            ]}
            placeholder="انتخاب کنید"
          />
          <ChoiceField
            label="نوع آشپزخانه"
            value={d.amenities.kitchenKind ?? ""}
            onChange={(v) => setAmenities({ kitchenKind: v as KitchenKind })}
            options={[
              { value: "open", label: "باز" },
              { value: "closed", label: "بسته" },
            ]}
            placeholder="انتخاب کنید"
          />
          <Field
            label="جنس کابینت"
            value={d.amenities.kitchenCabinet}
            onChange={(v) => setAmenities({ kitchenCabinet: v })}
          />
        </FieldGrid>

        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2">
          <ToggleRow
            label="حمام مستر"
            checked={d.amenities.hasMasterBathroom}
            onChange={(v) => setAmenities({ hasMasterBathroom: v })}
          />
          <ToggleRow label="هود" checked={d.amenities.hasHood} onChange={(v) => setAmenities({ hasHood: v })} />
          <ToggleRow
            label="اجاق گاز"
            checked={d.amenities.hasStove}
            onChange={(v) => setAmenities({ hasStove: v })}
          />
          <ToggleRow label="فر" checked={d.amenities.hasOven} onChange={(v) => setAmenities({ hasOven: v })} />
          <ToggleRow
            label="ماشین ظرفشویی"
            checked={d.amenities.hasDishwasher}
            onChange={(v) => setAmenities({ hasDishwasher: v })}
          />
        </div>

        <div className="space-y-2">
          <span className="block text-labelMedium text-on-surface-variant">سیستم گرمایش</span>
          <div className="flex flex-wrap gap-2">
            {HEATING_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setAmenities({ heating: toggleIn(d.amenities.heating, opt) })}
                className={`rounded-full px-3 py-1.5 text-labelLarge border transition-colors ${
                  d.amenities.heating.includes(opt)
                    ? "bg-primary text-primary-on border-primary"
                    : "bg-surface text-on-surface border-outline hover:bg-surface-container"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-labelMedium text-on-surface-variant">سیستم سرمایش</span>
          <div className="flex flex-wrap gap-2">
            {COOLING_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setAmenities({ cooling: toggleIn(d.amenities.cooling, opt) })}
                className={`rounded-full px-3 py-1.5 text-labelLarge border transition-colors ${
                  d.amenities.cooling.includes(opt)
                    ? "bg-primary text-primary-on border-primary"
                    : "bg-surface text-on-surface border-outline hover:bg-surface-container"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="وضعیت انشعابات" description="آب، برق، گاز، تلفن و اینترنت">
        <FieldGrid>
          <ChoiceField
            label="آب"
            value={d.amenities.utilities.water}
            onChange={(v) => setUtilities({ water: v })}
            options={UTILITY_STATUSES}
          />
          <ChoiceField
            label="برق"
            value={d.amenities.utilities.electricity}
            onChange={(v) => setUtilities({ electricity: v })}
            options={UTILITY_STATUSES}
          />
          <ChoiceField
            label="گاز"
            value={d.amenities.utilities.gas}
            onChange={(v) => setUtilities({ gas: v })}
            options={UTILITY_STATUSES}
          />
          <ChoiceField
            label="تلفن"
            value={d.amenities.utilities.telephone}
            onChange={(v) => setUtilities({ telephone: v })}
            options={UTILITY_STATUSES}
          />
          <ChoiceField
            label="اینترنت"
            value={d.amenities.utilities.internet}
            onChange={(v) => setUtilities({ internet: v })}
            options={UTILITY_STATUSES}
          />
        </FieldGrid>
      </SectionCard>

      <Notice tone="info">
        هر تغییری که در این مرحله می‌دهید به‌صورت خودکار ذخیره می‌شود و بلافاصله در پیش‌نمایش قرارداد بازتاب پیدا
        می‌کند.
      </Notice>
    </div>
  );
}

