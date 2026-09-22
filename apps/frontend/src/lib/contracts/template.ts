// ============================================================
// LEGALIR — Deterministic contract template engine
// ============================================================
// The contract text is produced by a REVIEWED, VERSIONED template
// combined with the user's data and a set of conditional clauses.
// It is fully deterministic: the same data always yields the same
// text, so a snapshot's hash is meaningful and an approval can be
// tied to exact content.
//
// AI is never used to invent the base contract. The template is the
// source of truth; the user's data fills it in; conditional clauses
// are included only when their condition holds.
//
// Every clause carries a stable `id` so the UI can highlight which
// clause a field feeds, and so a diff between versions is possible.
// ============================================================

import type {
  ContractFieldDescriptor,
  ContractParty,
  ContractPayment,
  GenericContractData,
  GenericFieldValue,
  PropertyContract,
  PropertyRentData,
  PropertySaleData,
} from "@legalir/types";
import { getContractDefinition, partyRoleLabelFa } from "./registry";
import { formatToman, formatTomanCompact, isZeroMoney } from "./money";
import { formatIsoJalali } from "./dates";

// ------------------------------------------------------------
// Output shape
// ------------------------------------------------------------

export interface RenderedClause {
  /** Stable clause id, e.g. "rent.parties". */
  id: string;
  /** Clause heading, e.g. «ماده ۱ — طرفین قرارداد». */
  headingFa: string;
  /** Paragraphs of the clause, in order. */
  paragraphs: string[];
  /** True when the clause was included because a condition held. */
  conditional: boolean;
}

export interface RenderedContract {
  titleFa: string;
  preambleFa: string;
  clauses: RenderedClause[];
  /** The signature block, rendered from the parties. */
  signatureLines: { roleFa: string; nameFa: string; nationalId: string }[];
  /** Footer note about the template version. */
  footerFa: string;
}

/** A placeholder shown when a required value is still missing. */
const PLACEHOLDER = "……………";

function or(value: string | null | undefined, fallback = PLACEHOLDER): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function num(value: number | null | undefined, fallback = PLACEHOLDER): string {
  return value === null || value === undefined ? fallback : String(value);
}

function money(value: { amount: number; currency: "IRR" } | null | undefined): string {
  if (!value || isZeroMoney(value)) return PLACEHOLDER;
  return formatToman(value);
}

function moneyCompact(value: { amount: number; currency: "IRR" } | null | undefined): string {
  if (!value || isZeroMoney(value)) return PLACEHOLDER;
  return formatTomanCompact(value);
}

function fullName(party: ContractParty | undefined): string {
  if (!party) return PLACEHOLDER;
  const name = `${party.identity.firstName} ${party.identity.lastName}`.trim();
  return name.length > 0 ? name : PLACEHOLDER;
}

function partyLine(party: ContractParty | undefined, roleFa: string): string {
  if (!party) return `${roleFa}: ${PLACEHOLDER}`;
  const i = party.identity;
  const parts = [
    `${roleFa}: ${fullName(party)}`,
    i.fatherName ? `فرزند ${i.fatherName}` : null,
    i.nationalId ? `به کد ملی ${i.nationalId}` : null,
    i.birthCertificateNumber ? `شناسنامه شماره ${i.birthCertificateNumber}` : null,
    i.mobile ? `تلفن ${i.mobile}` : null,
    i.address ? `ساکن ${i.address}` : null,
  ].filter(Boolean);
  return parts.join("، ") + ".";
}

function addressLine(data: PropertyRentData | PropertySaleData): string {
  const a = data.address;
  const parts = [
    a.province,
    a.city,
    a.district,
    a.neighborhood,
    a.street,
    a.alley ? `کوچه ${a.alley}` : "",
    a.plaque ? `پلاک ${a.plaque}` : "",
    a.floor ? `طبقه ${a.floor}` : "",
    a.unit ? `واحد ${a.unit}` : "",
  ].filter((p) => p && p.trim().length > 0);
  return parts.length > 0 ? parts.join("، ") : PLACEHOLDER;
}

function propertyKindFa(kind: string): string {
  switch (kind) {
    case "apartment":
      return "آپارتمان";
    case "house":
      return "خانه";
    case "villa":
      return "ویلا";
    default:
      return kind;
  }
}

function deedTypeFa(t: string): string {
  switch (t) {
    case "single_page":
      return "تک‌برگ";
    case "booklet":
      return "دفترچه‌ای";
    case "other":
      return "سایر";
    case "none":
      return "بدون سند";
    default:
      return t;
  }
}

function costBearerFa(b: string): string {
  switch (b) {
    case "landlord":
      return "موجر";
    case "tenant":
      return "مستأجر";
    case "seller":
      return "فروشنده";
    case "buyer":
      return "خریدار";
    default:
      return "طرفین به‌طور مساوی";
  }
}

function legalAnswerFa(a: string): string {
  switch (a) {
    case "yes":
      return "بله";
    case "no":
      return "خیر";
    default:
      return "نامشخص";
  }
}

// ------------------------------------------------------------
// Shared clauses
// ------------------------------------------------------------

function partiesClause(
  contract: PropertyContract,
  parties: ContractParty[]
): RenderedClause {
  const def = getContractDefinition(contract.type);
  const paragraphs = def.roles.map((role) => {
    const party = parties.find((p) => p.role === role);
    return partyLine(party, partyRoleLabelFa(role));
  });
  return {
    id: "common.parties",
    headingFa: "ماده ۱ — طرفین قرارداد",
    paragraphs,
    conditional: false,
  };
}

function propertyClause(data: PropertyRentData | PropertySaleData): RenderedClause {
  const g = data.general;
  const paragraphs = [
    `موضوع قرارداد، ${propertyKindFa(data.propertyKind)} مسکونی واقع در ${addressLine(data)} می‌باشد.`,
    `متراژ ملک ${num(g.area)} مترمربع، سال ساخت ${num(g.buildYear)}، طبقه ${num(g.floor)} از ${num(g.totalFloors)} طبقه و دارای ${num(g.bedrooms)} اتاق خواب است.`,
  ];
  if (g.orientation || g.renovationStatus || g.occupancyStatus) {
    paragraphs.push(
      [
        g.orientation ? `جهت ملک: ${g.orientation}` : null,
        g.renovationStatus ? `وضعیت بازسازی: ${g.renovationStatus}` : null,
        g.occupancyStatus ? `وضعیت سکونت: ${g.occupancyStatus}` : null,
      ]
        .filter(Boolean)
        .join("، ") + "."
    );
  }
  return {
    id: "common.property",
    headingFa: "ماده ۲ — مشخصات ملک",
    paragraphs,
    conditional: false,
  };
}

function deedClause(data: PropertyRentData | PropertySaleData): RenderedClause {
  const d = data.deed;
  const paragraphs = [
    `ملک موضوع این قرارداد دارای سند ${deedTypeFa(d.deedType)} به شماره ${or(d.deedNumber)}، پلاک ثبتی اصلی ${or(d.mainPlaque)}${d.subPlaque ? ` فرعی ${d.subPlaque}` : ""}، بخش ثبتی ${or(d.registrationDistrict)} و به مساحت رسمی ${num(d.officialArea)} مترمربع است.`,
    `نام مالک مندرج در سند: ${or(d.ownerName)}${d.deedDate ? `، تاریخ سند ${formatIsoJalali(d.deedDate)}` : ""}.`,
  ];
  return {
    id: "common.deed",
    headingFa: "ماده ۳ — سند مالکیت",
    paragraphs,
    conditional: false,
  };
}

function amenitiesClause(data: PropertyRentData | PropertySaleData): RenderedClause {
  const a = data.amenities;
  const items: string[] = [];
  if (a.hasParking) {
    const kindFa =
      a.parkingKind === "exclusive" ? "اختصاصی" : a.parkingKind === "shared" ? "مشترک" : "متفرقه";
    items.push(`پارکینگ ${kindFa}${a.parkingNumber ? ` شماره ${a.parkingNumber}` : ""}`);
  }
  if (a.hasStorage) items.push(`انبار${a.storageNumber ? ` شماره ${a.storageNumber}` : ""}`);
  if (a.hasElevator) items.push("آسانسور");
  if (a.hasBalcony) items.push("بالکن");
  if (a.heating.length > 0) items.push(`سیستم گرمایش: ${a.heating.join("، ")}`);
  if (a.cooling.length > 0) items.push(`سیستم سرمایش: ${a.cooling.join("، ")}`);

  const paragraphs =
    items.length > 0
      ? [`امکانات و تجهیزات ملک عبارت است از: ${items.join("، ")}.`]
      : ["ملک فاقد امکانات و تجهیزات خاص اضافی است."];

  return {
    id: "common.amenities",
    headingFa: "ماده ۴ — امکانات و تجهیزات",
    paragraphs,
    conditional: items.length > 0,
  };
}

function handoverClause(data: PropertyRentData | PropertySaleData): RenderedClause {
  const recorded = data.handover.items.filter((i) => i.state !== "unrecorded");
  const paragraphs: string[] = [];
  if (recorded.length > 0) {
    const stateFa: Record<string, string> = {
      intact: "سالم",
      flawed: "دارای ایراد",
      needs_repair: "نیازمند تعمیر",
      unrecorded: "ثبت‌نشده",
    };
    paragraphs.push(
      "وضعیت ملک در زمان تحویل به شرح زیر ثبت و مورد توافق طرفین قرار گرفت: " +
        recorded.map((i) => `${i.labelFa}: ${stateFa[i.state]}`).join("، ") +
        "."
    );
  }
  const meters = data.handover.meters.filter((m) => m.value.trim().length > 0);
  if (meters.length > 0) {
    paragraphs.push(
      "شماره کنتورها و آخرین قرائت: " +
        meters.map((m) => `${m.labelFa} ${m.meterNumber || "—"} (${m.value})`).join("، ") +
        "."
    );
  }
  const keys = data.handover.keys.filter((k) => k.count > 0);
  if (keys.length > 0) {
    paragraphs.push(
      "اقلام تحویلی: " + keys.map((k) => `${k.labelFa} (${k.count} عدد)`).join("، ") + "."
    );
  }
  if (data.handover.notes.trim()) {
    paragraphs.push(`توضیحات تحویل: ${data.handover.notes.trim()}`);
  }
  if (paragraphs.length === 0) {
    paragraphs.push("وضعیت ملک در زمان تحویل مطابق وضعیت موجود و مورد مشاهده طرفین تحویل می‌شود.");
  }
  return {
    id: "common.handover",
    headingFa: "ماده — تحویل ملک",
    paragraphs,
    conditional: recorded.length > 0 || meters.length > 0 || keys.length > 0,
  };
}

function customClausesClause(
  data: PropertyRentData | PropertySaleData | GenericContractData
): RenderedClause | null {
  if (data.customClauses.length === 0) return null;
  return {
    id: "common.custom",
    headingFa: "ماده — توافقات خاص طرفین",
    paragraphs: data.customClauses.map((c, i) => `${i + 1}. ${c.title}: ${c.body}`),
    conditional: true,
  };
}

// ------------------------------------------------------------
// Rent-specific clauses
// ------------------------------------------------------------

function rentFinancialClause(data: PropertyRentData): RenderedClause {
  const t = data.terms;
  const d = data.durations;
  const kindFa =
    t.agreementKind === "deposit_and_rent"
      ? "رهن و اجاره"
      : t.agreementKind === "full_deposit"
        ? "رهن کامل"
        : "اجاره بدون ودیعه";

  const paragraphs = [
    `نوع توافق: ${kindFa}.`,
    `مدت اجاره از تاریخ ${formatIsoJalali(d.startDate)} تا ${formatIsoJalali(d.endDate)}${d.durationMonths ? ` (${d.durationMonths} ماه)` : ""} است.`,
  ];
  if (t.agreementKind !== "rent_only") {
    paragraphs.push(`مبلغ ودیعه (رهن): ${money(t.securityDeposit)}.`);
  }
  if (t.agreementKind !== "full_deposit") {
    paragraphs.push(
      `اجاره‌بها ماهانه ${money(t.monthlyRent)}${t.rentDueDay ? `، قابل پرداخت تا روز ${t.rentDueDay} هر ماه` : ""}.`
    );
  }
  if (t.landlordAccount.trim()) {
    paragraphs.push(`اجاره‌بها به حساب موجر به شماره ${t.landlordAccount.trim()} واریز می‌شود.`);
  }
  if (d.handoverDate) {
    paragraphs.push(`تاریخ تحویل ملک: ${formatIsoJalali(d.handoverDate)}.`);
  }
  return {
    id: "rent.financial",
    headingFa: "ماده ۵ — ودیعه، اجاره‌بها و مدت",
    paragraphs,
    conditional: false,
  };
}

function rentLatePenaltyClause(data: PropertyRentData): RenderedClause | null {
  const t = data.terms;
  if (!t.hasLatePenalty || !t.latePenaltyAmount || isZeroMoney(t.latePenaltyAmount)) return null;
  const periodFa = t.latePenaltyPeriod === "daily" ? "روز" : "ماه";
  return {
    id: "rent.late_penalty",
    headingFa: "ماده — وجه التزام تأخیر در پرداخت اجاره",
    paragraphs: [
      `در صورت تأخیر مستأجر در پرداخت اجاره‌بها، مستأجر متعهد است بابت هر ${periodFa} تأخیر مبلغ ${money(t.latePenaltyAmount)} به‌عنوان وجه التزام به موجر بپردازد.`,
    ],
    conditional: true,
  };
}

function rentCostsClause(data: PropertyRentData): RenderedClause {
  const c = data.costs;
  const rows: [string, string][] = [
    ["آب", c.water],
    ["برق", c.electricity],
    ["گاز", c.gas],
    ["تلفن", c.telephone],
    ["اینترنت", c.internet],
    ["شارژ ساختمان", c.buildingCharge],
    ["هزینه‌های جاری", c.currentExpenses],
    ["تعمیرات اساسی", c.majorRepairs],
    ["خرابی تأسیسات", c.utilityFailures],
    ["خسارت ناشی از سوءاستفاده", c.misuseDamage],
  ];
  return {
    id: "rent.costs",
    headingFa: "ماده ۶ — پرداخت هزینه‌ها",
    paragraphs: [
      "پرداخت هزینه‌های ملک به شرح زیر بر عهده طرفین است: " +
        rows.map(([label, bearer]) => `${label}: ${costBearerFa(bearer)}`).join("، ") +
        ".",
    ],
    conditional: false,
  };
}

function rentUsageClause(data: PropertyRentData): RenderedClause {
  const u = data.usageRules;
  const paragraphs: string[] = [];
  if (u.residentialOnly) {
    paragraphs.push("استفاده از ملک صرفاً برای سکونت مجاز است و تغییر کاربری ممنوع می‌باشد.");
  }
  paragraphs.push(
    u.allowSublet
      ? "واگذاری ملک به غیر (اجاره به ثالث) با موافقت کتبی موجر مجاز است."
      : "واگذاری ملک به غیر (اجاره به ثالث) بدون موافقت کتبی موجر ممنوع است."
  );
  if (!u.allowStructuralChanges) {
    paragraphs.push("هرگونه تغییر در ساختار ملک بدون موافقت کتبی موجر ممنوع است.");
  }
  if (!u.allowPets) paragraphs.push("نگهداری حیوانات خانگی در ملک مجاز نیست.");
  if (u.parkingTerms.trim()) paragraphs.push(`شرایط پارکینگ: ${u.parkingTerms.trim()}`);
  if (u.commonAreaTerms.trim()) paragraphs.push(`شرایط مشاعات: ${u.commonAreaTerms.trim()}`);
  if (u.maintenanceTerms.trim()) paragraphs.push(`شرایط نگهداری: ${u.maintenanceTerms.trim()}`);
  return {
    id: "rent.usage",
    headingFa: "ماده ۷ — شرایط استفاده از ملک",
    paragraphs,
    conditional: false,
  };
}

function rentTerminationClause(data: PropertyRentData): RenderedClause {
  const t = data.termination;
  const grounds: string[] = [];
  if (t.grounds.nonPayment) grounds.push("عدم پرداخت اجاره‌بها");
  if (t.grounds.latePayment) grounds.push("تأخیر مکرر در پرداخت");
  if (t.grounds.unauthorizedUse) grounds.push("استفاده غیرمجاز از ملک");
  if (t.grounds.sublet) grounds.push("واگذاری بدون مجوز");
  if (t.grounds.propertyDamage) grounds.push("ایجاد خسارت به ملک");
  if (t.grounds.earlyVacation) grounds.push("تخلیه پیش از موعد");
  if (t.grounds.failureToVacate) grounds.push("عدم تخلیه در پایان مدت");

  const paragraphs: string[] = [];
  if (grounds.length > 0) {
    paragraphs.push(`موارد فسخ قرارداد: ${grounds.join("، ")}.`);
  }
  if (t.evictionPenaltyAmount && !isZeroMoney(t.evictionPenaltyAmount)) {
    const periodFa = t.evictionPenaltyPeriod === "daily" ? "روز" : "ماه";
    paragraphs.push(
      `در صورت عدم تخلیه ملک در پایان مدت، مستأجر متعهد است بابت هر ${periodFa} تأخیر مبلغ ${money(t.evictionPenaltyAmount)} به‌عنوان وجه التزام بپردازد.`
    );
  }
  if (t.depositReturnTerms.trim()) {
    paragraphs.push(`شرایط بازگشت ودیعه: ${t.depositReturnTerms.trim()}`);
  }
  if (t.depositReturnTiming.trim()) {
    paragraphs.push(`زمان بازگشت ودیعه: ${t.depositReturnTiming.trim()}`);
  }
  if (paragraphs.length === 0) {
    paragraphs.push("در پایان مدت اجاره، ودیعه پس از تخلیه کامل ملک به مستأجر بازگردانده می‌شود.");
  }
  return {
    id: "rent.termination",
    headingFa: "ماده ۸ — فسخ و بازگشت ودیعه",
    paragraphs,
    conditional: false,
  };
}

// ------------------------------------------------------------
// Sale-specific clauses
// ------------------------------------------------------------

function salePriceClause(data: PropertySaleData): RenderedClause {
  const t = data.terms;
  const paragraphs = [
    `ثمن معامله به‌طور قطعی مبلغ ${money(t.totalPrice)} (${moneyCompact(t.totalPrice)}) تعیین گردید.`,
  ];
  if (t.pricePerSqm && !isZeroMoney(t.pricePerSqm)) {
    paragraphs.push(`قیمت هر مترمربع: ${money(t.pricePerSqm)}.`);
  }
  return {
    id: "sale.price",
    headingFa: "ماده ۵ — ثمن معامله",
    paragraphs,
    conditional: false,
  };
}

function salePaymentScheduleClause(payments: ContractPayment[]): RenderedClause | null {
  if (payments.length === 0) return null;
  const paragraphs = payments.map((p, i) => {
    const when = p.dueDate
      ? `تاریخ ${formatIsoJalali(p.dueDate)}`
      : p.conditionFa.trim() || "به‌محض درخواست";
    const methodFa =
      p.method === "check"
        ? "چک"
        : p.method === "sadad_check"
          ? "چک صیادی"
          : p.method === "bank_transfer"
            ? "انتقال بانکی"
            : p.method === "card"
              ? "کارت به کارت"
              : "سایر";
    const check = p.check
      ? ` (چک شماره ${p.check.checkNumber || "—"} بانک ${p.check.bank || "—"}${p.check.dueDate ? `، سررسید ${formatIsoJalali(p.check.dueDate)}` : ""})`
      : "";
    return `${i + 1}. ${p.labelFa}: مبلغ ${money(p.amount)}، ${when}، روش پرداخت ${methodFa}${check}.`;
  });
  return {
    id: "sale.payment_schedule",
    headingFa: "ماده ۶ — برنامه پرداخت",
    paragraphs,
    conditional: true,
  };
}

function saleLegalStatusClause(data: PropertySaleData): RenderedClause {
  const s = data.legalStatus;
  const paragraphs = [
    `وضعیت رهن ملک: ${legalAnswerFa(s.inMortgage)}${s.mortgageDetails.trim() ? ` — ${s.mortgageDetails.trim()}` : ""}.`,
    `وضعیت بازداشت ملک: ${legalAnswerFa(s.seized)}.`,
    `وضعیت وام: ${legalAnswerFa(s.hasLoan)}${s.loanDetails.trim() ? ` — ${s.loanDetails.trim()}` : ""}.`,
    `وضعیت تصرف توسط مستأجر: ${legalAnswerFa(s.occupiedByTenant)}${s.tenantLeaseEnd ? ` (پایان اجاره: ${formatIsoJalali(s.tenantLeaseEnd)})` : ""}.`,
    `محدودیت انتقال: ${legalAnswerFa(s.transferRestricted)}${s.restrictionDetails.trim() ? ` — ${s.restrictionDetails.trim()}` : ""}.`,
  ];
  return {
    id: "sale.legal_status",
    headingFa: "ماده ۷ — وضعیت حقوقی ملک",
    paragraphs,
    conditional: false,
  };
}

function saleRegistrationClause(data: PropertySaleData): RenderedClause {
  const r = data.registration;
  const responsibleFa =
    r.documentsResponsible === "seller"
      ? "فروشنده"
      : r.documentsResponsible === "buyer"
        ? "خریدار"
        : "هر دو طرف";
  const paragraphs = [
    `طرفین توافق نمودند در تاریخ ${formatIsoJalali(r.agreedDate)}${r.agreedTime ? ` ساعت ${r.agreedTime}` : ""} در دفتر اسناد رسمی شماره ${or(r.notaryOfficeNumber)} واقع در ${or(r.notaryCity)}${r.notaryAddress.trim() ? `، ${r.notaryAddress.trim()}` : ""} حاضر شوند.`,
    `تهیه مدارک لازم برای تنظیم سند رسمی بر عهده ${responsibleFa} است.`,
  ];
  if (r.amountAtRegistration && !isZeroMoney(r.amountAtRegistration)) {
    paragraphs.push(`مبلغ قابل پرداخت هنگام تنظیم سند رسمی: ${money(r.amountAtRegistration)}.`);
  }
  if (r.requiredDocuments.length > 0) {
    paragraphs.push(`مدارک مورد نیاز: ${r.requiredDocuments.join("، ")}.`);
  }
  paragraphs.push(
    "بدیهی است انتقال رسمی مالکیت تنها با تنظیم سند رسمی در دفتر اسناد رسمی محقق می‌شود و این مبایعه‌نامه مقدمه‌ای برای آن است."
  );
  return {
    id: "sale.registration",
    headingFa: "ماده ۸ — دفترخانه و ثبت رسمی",
    paragraphs,
    conditional: false,
  };
}

function saleObligationsClause(data: PropertySaleData): RenderedClause {
  const o = data.obligations;
  const paragraphs: string[] = [];
  if (o.sellerNoShowPenalty && !isZeroMoney(o.sellerNoShowPenalty)) {
    paragraphs.push(
      `در صورت عدم حضور فروشنده در دفترخانه در تاریخ توافق‌شده، فروشنده متعهد است مبلغ ${money(o.sellerNoShowPenalty)} به‌عنوان وجه التزام به خریدار بپردازد.`
    );
  }
  if (o.handoverDelayPenalty && !isZeroMoney(o.handoverDelayPenalty)) {
    paragraphs.push(
      `در صورت تأخیر در تحویل ملک، فروشنده متعهد است مبلغ ${money(o.handoverDelayPenalty)} به‌عنوان وجه التزام به خریدار بپردازد.`
    );
  }
  if (o.sellerMustReleaseMortgage) {
    paragraphs.push("فروشنده متعهد است پیش از تنظیم سند رسمی، نسبت به فک رهن ملک اقدام نماید.");
  }
  paragraphs.push(
    `تسویه بدهی‌های قبلی ملک (عوارض، شارژ و قبوض) بر عهده ${costBearerFa(o.priorDebtsBearer)} است.`
  );
  if (o.includedEquipment.trim()) {
    paragraphs.push(`تجهیزات همراه ملک: ${o.includedEquipment.trim()}.`);
  }
  if (o.otherTerms.trim()) paragraphs.push(`سایر توافقات: ${o.otherTerms.trim()}`);
  return {
    id: "sale.obligations",
    headingFa: "ماده ۹ — تعهدات و وجه التزام",
    paragraphs,
    conditional: false,
  };
}

// ------------------------------------------------------------
// Generic (schema-driven) clauses
// ------------------------------------------------------------
// Every non-property contract type shares one rendering path: the
// registry's field descriptors are grouped by their wizard step, and
// each group becomes a clause. Labels and option labels come from the
// descriptors, so a new contract type needs no template code.

/** Render a single generic field value as human-readable Persian text. */
function genericValueFa(descriptor: ContractFieldDescriptor, value: GenericFieldValue | undefined): string {
  if (value === null || value === undefined || value === "") return PLACEHOLDER;
  switch (descriptor.kind) {
    case "money":
      return money(value as unknown as { amount: number; currency: "IRR" });
    case "date":
      return typeof value === "string" ? formatIsoJalali(value) : PLACEHOLDER;
    case "toggle":
      return value === true ? "بله" : "خیر";
    case "select": {
      const opt = descriptor.options?.find((o) => o.value === value);
      return opt?.labelFa ?? String(value);
    }
    case "number":
      return num(typeof value === "number" ? value : null);
    default:
      return String(value);
  }
}

/** Build one clause per wizard step that owns at least one filled field. */
function genericClauses(def: ReturnType<typeof getContractDefinition>, data: GenericContractData): RenderedClause[] {
  const values = data.values ?? {};
  const clauses: RenderedClause[] = [];
  let index = 0;

  for (const step of def.wizardSteps) {
    const fields = def.fields.filter((f) => f.stepId === step.id);
    if (fields.length === 0) continue;

    const paragraphs = fields
      .filter((f) => {
        const v = values[f.key];
        return v !== null && v !== undefined && v !== "";
      })
      .map((f) => `${f.labelFa}: ${genericValueFa(f, values[f.key])}.`);

    if (paragraphs.length === 0) continue;

    index += 1;
    clauses.push({
      id: `generic.${step.id}`,
      headingFa: `ماده ${index} — ${step.titleFa}`,
      paragraphs,
      conditional: false,
    });
  }

  return clauses;
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

/**
 * Render the full contract text from the contract's current data.
 * Deterministic: identical input always yields identical output.
 */
export function renderContract(
  contract: PropertyContract,
  parties: ContractParty[],
  payments: ContractPayment[]
): RenderedContract {
  const def = getContractDefinition(contract.type);
  const clauses: RenderedClause[] = [];

  clauses.push(partiesClause(contract, parties));

  // Schema-driven types render their clauses straight from the registry
  // field descriptors; the bespoke property journeys keep their
  // hand-written clause builders.
  if (def.fields.length > 0) {
    clauses.push(...genericClauses(def, contract.data as GenericContractData));
  } else {
    clauses.push(propertyClause(contract.data as PropertyRentData | PropertySaleData));
    clauses.push(deedClause(contract.data as PropertyRentData | PropertySaleData));
    clauses.push(amenitiesClause(contract.data as PropertyRentData | PropertySaleData));

    if (contract.type === "property_rent") {
      const data = contract.data as PropertyRentData;
      clauses.push(rentFinancialClause(data));
      const late = rentLatePenaltyClause(data);
      if (late) clauses.push(late);
      clauses.push(rentCostsClause(data));
      clauses.push(rentUsageClause(data));
      clauses.push(rentTerminationClause(data));
    } else {
      const data = contract.data as PropertySaleData;
      clauses.push(salePriceClause(data));
      const schedule = salePaymentScheduleClause(payments);
      if (schedule) clauses.push(schedule);
      clauses.push(saleLegalStatusClause(data));
      clauses.push(saleRegistrationClause(data));
      clauses.push(saleObligationsClause(data));
    }

    clauses.push(handoverClause(contract.data as PropertyRentData | PropertySaleData));
  }

  const custom = customClausesClause(contract.data as PropertyRentData | PropertySaleData | GenericContractData);
  if (custom) clauses.push(custom);

  const signatureLines = def.roles.map((role) => {
    const party = parties.find((p) => p.role === role);
    return {
      roleFa: partyRoleLabelFa(role),
      nameFa: fullName(party),
      nationalId: party?.identity.nationalId ?? PLACEHOLDER,
    };
  });

  const contractDate =
    contract.type === "property_rent"
      ? (contract.data as PropertyRentData).durations.contractDate
      : null;

  const preambleKindFa =
    def.fields.length > 0
      ? def.typeFa
      : contract.type === "property_rent"
        ? "قرارداد اجاره"
        : "مبایعه‌نامه";

  return {
    titleFa: contract.title || def.typeFa,
    preambleFa:
      `این ${preambleKindFa} در تاریخ ${formatIsoJalali(contractDate)} بین طرفین زیر منعقد گردید و طرفین با آگاهی کامل از مفاد آن، به اجرای تعهدات خود متعهد شدند.`,
    clauses,
    signatureLines,
    footerFa: `قالب قرارداد: ${def.templateVersion} — شناسه قرارداد: ${contract.referenceCode}`,
  };
}

/** A plain-text rendering, used for the PDF body and the hash. */
export function renderContractText(rendered: RenderedContract): string {
  const lines: string[] = [rendered.titleFa, "", rendered.preambleFa, ""];
  for (const clause of rendered.clauses) {
    lines.push(clause.headingFa);
    for (const p of clause.paragraphs) lines.push(p);
    lines.push("");
  }
  lines.push("امضاها:");
  for (const s of rendered.signatureLines) {
    lines.push(`${s.roleFa}: ${s.nameFa} (کد ملی ${s.nationalId})`);
  }
  lines.push("", rendered.footerFa);
  return lines.join("\n");
}
