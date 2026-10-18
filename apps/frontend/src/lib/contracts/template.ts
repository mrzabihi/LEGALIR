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
  ContractRepeatColumn,
  CustomClause,
  GenericContractData,
  GenericFieldValue,
  GenericRepeatRow,
  PartyRole,
  PropertyContract,
  PropertyRentData,
  PropertySaleData,
} from "@legalir/types";
import { fieldConditionHolds, getContractDefinition, partyRoleLabelFa } from "./registry";
import { formatToman, formatTomanCompact, isZeroMoney } from "./money";
import { formatIsoJalali } from "./dates";
import { toPersianDigits } from "@/lib/persian-utils";

// ------------------------------------------------------------
// Output shape
// ------------------------------------------------------------

/**
 * A table inside a clause. Columns and rows are already formatted Persian
 * strings — the renderer never re-interprets them, so the screen, the PDF
 * and the DOCX all draw the same cells.
 */
export interface RenderedTable {
  /** Optional caption printed above the table. */
  captionFa?: string;
  /** Column headings, in RTL reading order. */
  columnsFa: string[];
  /** Body cells; every row has exactly one cell per column. */
  rowsFa: string[][];
}

/**
 * One ordered piece of a clause. `paragraphs` remains the plain-text
 * projection used for hashing and search; `blocks` adds the structure the
 * document surfaces draw (tables where a table reads better than prose).
 */
export type RenderedBlock =
  | { kind: "paragraph"; textFa: string }
  | { kind: "table"; table: RenderedTable };

export interface RenderedClause {
  /** Stable clause id, e.g. "rent.parties". */
  id: string;
  /** Clause heading, e.g. «ماده ۱ — طرفین قرارداد». */
  headingFa: string;
  /**
   * Plain-text projection of the clause, used for the document hash, the
   * admin list and the signature page. Always present.
   */
  paragraphs: string[];
  /**
   * Structured content, in order. When absent the renderer falls back to
   * `paragraphs`, so an older rendered payload still displays correctly.
   */
  blocks?: RenderedBlock[];
  /** True when the clause was included because a condition held. */
  conditional: boolean;
}

/** The text projection of a clause — blocks when present, else paragraphs. */
export function clauseParagraphs(clause: RenderedClause): string[] {
  if (!clause.blocks) return clause.paragraphs;
  return clause.blocks.flatMap((block) => {
    if (block.kind === "paragraph") return [block.textFa];
    const table = block.table;
    const head = table.captionFa ? [table.captionFa] : [];
    return [
      ...head,
      table.columnsFa.join(" | "),
      ...table.rowsFa.map((row) => row.join(" | ")),
    ];
  });
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
  return value === null || value === undefined ? fallback : toPersianDigits(value);
}

// --- Structured blocks -------------------------------------------
// A clause is drawn from ordered blocks. Tables are used only where a
// table genuinely reads better than a sentence (parties, money rows,
// payment schedules, delivery items, per-step form answers); long prose
// answers stay paragraphs. `projectBlocks` keeps `paragraphs` as the
// exact plain-text mirror of the blocks, so nothing can be visible on
// the sheet but missing from the plain-text export.

/** One paragraph block. */
function para(textFa: string): RenderedBlock {
  return { kind: "paragraph", textFa };
}

/** One table block, or null when there is nothing to show. */
function tableBlock(
  captionFa: string | undefined,
  columnsFa: string[],
  rowsFa: string[][]
): RenderedBlock | null {
  const rows = rowsFa.filter((row) => row.some((cell) => cell.trim().length > 0));
  if (rows.length === 0 || columnsFa.length === 0) return null;
  return { kind: "table", table: { ...(captionFa ? { captionFa } : {}), columnsFa, rowsFa: rows } };
}

/** Plain-text mirror of a block list. */
function projectBlocks(blocks: RenderedBlock[]): string[] {
  return blocks.flatMap((block) => {
    if (block.kind === "paragraph") return [block.textFa];
    const t = block.table;
    return [
      ...(t.captionFa ? [t.captionFa] : []),
      t.columnsFa.join(" | "),
      ...t.rowsFa.map((row) => row.join(" | ")),
    ];
  });
}

/** Assemble a clause from blocks; `paragraphs` is always derived. */
function clauseFrom(
  id: string,
  headingFa: string,
  blocks: (RenderedBlock | null)[],
  conditional: boolean
): RenderedClause {
  const present = blocks.filter((b): b is RenderedBlock => b !== null);
  return { id, headingFa, paragraphs: projectBlocks(present), blocks: present, conditional };
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
  if (party.personKind === "legal") {
    const name = (party.identity.companyName ?? "").trim();
    return name.length > 0 ? name : PLACEHOLDER;
  }
  const name = `${party.identity.firstName} ${party.identity.lastName}`.trim();
  return name.length > 0 ? name : PLACEHOLDER;
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

/** The legal identifier printed for a party in the summary table. */
function partyLegalId(party: ContractParty | undefined): string {
  if (!party) return PLACEHOLDER;
  if (party.personKind === "legal") return or(party.identity.companyRegistrationNumber);
  if (party.nationality === "foreign") return or(party.identity.passportNumber);
  return or(party.identity.nationalId);
}

/**
 * Identity details that do not fit the summary table (father name, birth
 * certificate, passport validity, economic code…). Returns null when there
 * is nothing extra to say, so no empty sentence ever reaches the sheet.
 */
function partyExtraDetails(party: ContractParty, roleFa: string): string | null {
  const i = party.identity;
  const parts: string[] = [];
  if (party.personKind === "legal") {
    if (i.companyNationalId) parts.push(`شناسهٔ ملی ${i.companyNationalId}`);
    if (i.economicCode) parts.push(`کد اقتصادی ${i.economicCode}`);
  } else if (party.nationality === "foreign") {
    if (i.nationalityCountryFa) parts.push(`تابع ${i.nationalityCountryFa}`);
    if (i.passportExpiry) parts.push(`گذرنامه معتبر تا ${i.passportExpiry}`);
    if (i.birthPlace) parts.push(`متولد ${i.birthPlace}`);
  } else {
    if (i.fatherName) parts.push(`فرزند ${i.fatherName}`);
    if (i.birthCertificateNumber) parts.push(`شناسنامه شماره ${i.birthCertificateNumber}`);
  }
  return parts.length > 0 ? `${roleFa}: ${parts.join("، ")}.` : null;
}

/**
 * The party's identity lines, in the order the sheet prints them.
 * A legal entity carries its authorised representative in the SAME cell —
 * the entity and the natural person stay one party, never two columns.
 */
function partyLines(party: ContractParty | undefined, parties: ContractParty[]): string[] {
  const lines = [
    `نام / عنوان: ${fullName(party)}`,
    `${party?.personKind === "legal" ? "شمارهٔ ثبت" : "کد ملی"}: ${partyLegalId(party)}`,
    `نشانی: ${or(party?.identity.address)}`,
    `تلفن: ${or(party?.identity.mobile)}`,
  ];

  if (party?.personKind === "legal") {
    const rep = parties.find(
      (p) => p.role === "legal_representative" && p.representativeOfPartyId === party.id
    );
    if (rep) {
      lines.push(
        `نمایندهٔ قانونی: ${fullName(rep)}${
          rep.representativePositionFa ? ` (${rep.representativePositionFa})` : ""
        } — کد ملی: ${or(rep.identity.nationalId)}`
      );
    }
  }

  return lines;
}

function partiesClause(
  contract: PropertyContract,
  parties: ContractParty[]
): RenderedClause {
  const def = getContractDefinition(contract.type);
  const extras: RenderedBlock[] = [];

  // Two-column party layout (§5): the first contract role prints in the
  // LEFT column and the second in the RIGHT column. The sheet is RTL, so
  // the FIRST table column is the right-hand one — hence role 2 leads.
  if (def.roles.length === 2) {
    const [role1, role2] = def.roles as [PartyRole, PartyRole];
    const party1 = parties.find((p) => p.role === role1);
    const party2 = parties.find((p) => p.role === role2);
    const role1Fa = partyRoleLabelFa(role1);
    const role2Fa = partyRoleLabelFa(role2);

    if (party1) {
      const detail = partyExtraDetails(party1, role1Fa);
      if (detail) extras.push(para(detail));
    }
    if (party2) {
      const detail = partyExtraDetails(party2, role2Fa);
      if (detail) extras.push(para(detail));
    }

    const lines1 = partyLines(party1, parties);
    const lines2 = partyLines(party2, parties);
    const rowCount = Math.max(lines1.length, lines2.length);
    const rows = Array.from({ length: rowCount }, (_, i) => [
      lines2[i] ?? "",
      lines1[i] ?? "",
    ]);

    return clauseFrom(
      "common.parties",
      "ماده ۱ — طرفین قرارداد",
      [
        tableBlock(
          "مشخصات طرفین و نمایندگان (طرف اول در ستون چپ، طرف دوم در ستون راست)",
          [`${role2Fa} (طرف دوم)`, `${role1Fa} (طرف اول)`],
          rows
        ),
        ...extras,
      ],
      false
    );
  }

  // Fallback for a hypothetical non-pair contract: the original role table.
  const rows: string[][] = [];
  for (const role of def.roles) {
    const party = parties.find((p) => p.role === role);
    const roleFa = partyRoleLabelFa(role);
    rows.push([
      roleFa,
      fullName(party),
      partyLegalId(party),
      or(party?.identity.address),
      or(party?.identity.mobile),
    ]);
    if (party) {
      const detail = partyExtraDetails(party, roleFa);
      if (detail) extras.push(para(detail));
    }

    // A legal entity is followed by its authorised representative as its own
    // row — the entity and the natural person are never merged into one cell.
    if (party?.personKind === "legal") {
      const rep = parties.find(
        (p) => p.role === "legal_representative" && p.representativeOfPartyId === party.id
      );
      if (rep) {
        rows.push([
          `نمایندهٔ قانونی ${fullName(party)}`,
          `${fullName(rep)}${rep.representativePositionFa ? ` (${rep.representativePositionFa})` : ""}`,
          or(rep.identity.nationalId),
          or(rep.identity.address),
          or(rep.identity.mobile),
        ]);
      }
    }
  }

  return clauseFrom(
    "common.parties",
    "ماده ۱ — طرفین قرارداد",
    [
      tableBlock(
        "مشخصات طرفین و نمایندگان",
        ["نقش", "نام / عنوان", "کد ملی / شمارهٔ ثبت", "نشانی", "تلفن"],
        rows
      ),
      ...extras,
    ],
    false
  );
}

function propertyClause(data: PropertyRentData | PropertySaleData): RenderedClause {
  const g = data.general;
  const rows: string[][] = [
    ["نوع ملک", propertyKindFa(data.propertyKind)],
    ["متراژ", `${num(g.area)} مترمربع`],
    ["سال ساخت", num(g.buildYear)],
    ["طبقه", `${num(g.floor)} از ${num(g.totalFloors)}`],
    ["تعداد اتاق خواب", num(g.bedrooms)],
    ["جهت ملک", g.orientation || ""],
    ["وضعیت بازسازی", g.renovationStatus || ""],
    ["وضعیت سکونت", g.occupancyStatus || ""],
  ];
  return clauseFrom(
    "common.property",
    "ماده ۲ — مشخصات ملک",
    [
      para(
        `موضوع قرارداد، ${propertyKindFa(data.propertyKind)} مسکونی واقع در ${addressLine(data)} است.`
      ),
      tableBlock("مشخصات ملک", ["ویژگی", "شرح"], rows),
    ],
    false
  );
}

function deedClause(data: PropertyRentData | PropertySaleData): RenderedClause {
  const d = data.deed;
  const rows: string[][] = [
    ["نوع سند", deedTypeFa(d.deedType)],
    ["شمارهٔ سند", or(d.deedNumber)],
    ["پلاک ثبتی اصلی", or(d.mainPlaque)],
    ["پلاک ثبتی فرعی", d.subPlaque || ""],
    ["بخش ثبتی", or(d.registrationDistrict)],
    ["مساحت رسمی", `${num(d.officialArea)} مترمربع`],
    ["مالک مندرج در سند", or(d.ownerName)],
    ["تاریخ سند", d.deedDate ? formatIsoJalali(d.deedDate) : ""],
  ];
  return clauseFrom(
    "common.deed",
    "ماده ۳ — سند مالکیت",
    [tableBlock("مشخصات ثبتی ملک", ["ویژگی", "شرح"], rows)],
    false
  );
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
  const h = data.handover;
  const recorded = h.items.filter((i) => i.state !== "unrecorded");
  const meters = h.meters.filter((m) => m.value.trim().length > 0);
  const keys = h.keys.filter((k) => k.count > 0);
  const stateFa: Record<string, string> = {
    intact: "سالم",
    flawed: "دارای ایراد",
    needs_repair: "نیازمند تعمیر",
    unrecorded: "ثبت‌نشده",
  };

  const blocks: (RenderedBlock | null)[] = [];
  if (recorded.length > 0) {
    blocks.push(
      tableBlock(
        "وضعیت اقلام ملک در زمان تحویل",
        ["قلم", "وضعیت"],
        recorded.map((i) => [i.labelFa, stateFa[i.state] ?? i.state])
      )
    );
  }
  if (meters.length > 0) {
    blocks.push(
      tableBlock(
        "شماره کنتورها و آخرین قرائت",
        ["کنتور", "شماره", "آخرین قرائت"],
        meters.map((m) => [m.labelFa, m.meterNumber || "—", m.value])
      )
    );
  }
  if (keys.length > 0) {
    blocks.push(
      tableBlock(
        "اقلام تحویلی",
        ["قلم", "تعداد"],
        keys.map((k) => [k.labelFa, `${num(k.count)} عدد`])
      )
    );
  }
  if (h.notes.trim()) blocks.push(para(`توضیحات تحویل: ${h.notes.trim()}`));
  if (blocks.length === 0) {
    blocks.push(
      para("وضعیت ملک در زمان تحویل مطابق وضعیت موجود و مورد مشاهده طرفین تحویل می‌شود.")
    );
  }

  return clauseFrom(
    "common.handover",
    "ماده — تحویل ملک",
    blocks,
    recorded.length > 0 || meters.length > 0 || keys.length > 0
  );
}

/** True when a custom-clause entry is a real added term (default kind). */
function isAgreement(c: CustomClause): boolean {
  return (c.kind ?? "agreement") === "agreement";
}

function customClausesClause(
  data: PropertyRentData | PropertySaleData | GenericContractData
): RenderedClause | null {
  // Only AGREEMENTS are operative contract terms. A change request is a
  // proposal about the draft and must never print as a clause — it goes
  // to the non-operative annex below.
  const agreements = data.customClauses.filter(isAgreement);
  if (agreements.length === 0) return null;
  return {
    id: "common.custom",
    headingFa: "ماده — توافقات خاص طرفین",
    paragraphs: agreements.map((c, i) => `${i + 1}. ${c.title}: ${c.body}`),
    conditional: true,
  };
}

/**
 * REQUESTED changes — a non-operative annex.
 *
 * Deliberately its own clause with its own heading: a request is not a
 * contract term. Printing it here keeps every identity field and authored
 * clause untouched, while still making the request visible and reviewable
 * to both parties.
 *
 * The supplementary NOTE is not part of this clause: the product prints it
 * as its own final section (see `supplementaryNoteClause`) so it can never
 * be read as one more contract article.
 */
function supplementaryClause(
  data: PropertyRentData | PropertySaleData | GenericContractData,
  sectionTitleFa: (key: string) => string
): RenderedClause | null {
  const requests = data.customClauses
    .filter((c) => c.kind === "change_request")
    .filter((c) => c.body.trim().length > 0 || c.title.trim().length > 0);
  if (requests.length === 0) return null;

  const blocks: (RenderedBlock | null)[] = [];
  if (requests.length > 0) {
    blocks.push(
      para(
        "موارد زیر فقط درخواست تغییر است و بخشی از متن تعهدآور قرارداد نیست؛ تنها پس از اعمال در بند مربوط و امضای مجدد، تعهدآور می‌شود:"
      )
    );
    blocks.push(
      tableBlock(
        `درخواست‌های تغییر (${toPersianDigits(requests.length)} مورد)`,
        ["ردیف", "بخش مرتبط", "موضوع", "شرح درخواست"],
        requests.map((req, i) => [
          toPersianDigits(i + 1),
          req.sectionRef ? sectionTitleFa(req.sectionRef) : "کل قرارداد",
          req.title.trim() || "—",
          req.body.trim() || "—",
        ])
      )
    );
  }
  return clauseFrom("common.supplementary", "ماده — اطلاعات تکمیلی و تغییرات درخواستی", blocks, true);
}

/**
 * «یادداشت تکمیلی» — the user's note about the whole contract.
 *
 * Printed as the LAST section of the document, after every article and
 * annex, under its own heading. Kept out of the numbered material on
 * purpose: it explains the contract, it does not amend it. Returns null
 * when the note is empty, so an absent note leaves no trace at all.
 */
function supplementaryNoteClause(
  data: PropertyRentData | PropertySaleData | GenericContractData
): RenderedClause | null {
  const notes = (data.supplementary?.notes ?? "").trim();
  if (notes.length === 0) return null;
  return clauseFrom(
    "common.supplementary_note",
    "یادداشت تکمیلی",
    [para("این یادداشت دربارهٔ کل قرارداد است و جدا از مواد قرارداد درج می‌شود:"), para(notes)],
    true
  );
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

  const rows: string[][] = [
    ["نوع توافق", kindFa],
    [
      "مدت اجاره",
      `از ${formatIsoJalali(d.startDate)} تا ${formatIsoJalali(d.endDate)}${
        d.durationMonths ? ` (${num(d.durationMonths)} ماه)` : ""
      }`,
    ],
  ];
  if (t.agreementKind !== "rent_only") {
    rows.push(["مبلغ ودیعه (رهن)", money(t.securityDeposit)]);
  }
  if (t.agreementKind !== "full_deposit") {
    rows.push(["اجاره‌بهای ماهانه", money(t.monthlyRent)]);
    if (t.rentDueDay) {
      rows.push(["مهلت پرداخت اجاره در هر ماه", `تا روز ${num(t.rentDueDay)}`]);
    }
  }
  if (t.landlordAccount.trim()) {
    rows.push(["حساب واریز اجاره‌بها", t.landlordAccount.trim()]);
  }
  if (d.handoverDate) {
    rows.push(["تاریخ تحویل ملک", formatIsoJalali(d.handoverDate)]);
  }
  return clauseFrom(
    "rent.financial",
    "ماده ۵ — ودیعه، اجاره‌بها و مدت",
    [tableBlock("شرایط مالی و مدت اجاره", ["شرح", "مقدار"], rows)],
    false
  );
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
  return clauseFrom(
    "rent.costs",
    "ماده ۶ — پرداخت هزینه‌ها",
    [
      tableBlock(
        "تقسیم هزینه‌های ملک میان طرفین",
        ["نوع هزینه", "مسئول پرداخت"],
        rows.map(([label, bearer]) => [label, costBearerFa(bearer)])
      ),
    ],
    false
  );
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

/** The Persian label for a payment method. */
function paymentMethodFa(method: ContractPayment["method"]): string {
  switch (method) {
    case "check":
      return "چک";
    case "sadad_check":
      return "چک صیادی";
    case "bank_transfer":
      return "انتقال بانکی";
    case "card":
      return "کارت به کارت";
    default:
      return "سایر";
  }
}

function salePaymentScheduleClause(payments: ContractPayment[]): RenderedClause | null {
  if (payments.length === 0) return null;
  const rows = payments.map((p, i) => {
    const when = p.dueDate
      ? formatIsoJalali(p.dueDate)
      : p.conditionFa.trim() || "به‌محض درخواست";
    const check = p.check
      ? `چک ${p.check.checkNumber || "—"} — بانک ${p.check.bank || "—"}${
          p.check.dueDate ? `، سررسید ${formatIsoJalali(p.check.dueDate)}` : ""
        }`
      : "";
    return [
      toPersianDigits(i + 1),
      p.labelFa,
      money(p.amount),
      when,
      paymentMethodFa(p.method),
      check,
    ];
  });
  return clauseFrom(
    "sale.payment_schedule",
    "ماده ۶ — برنامه پرداخت",
    [
      tableBlock(
        "اقساط و برنامهٔ پرداخت ثمن",
        ["ردیف", "شرح پرداخت", "مبلغ", "سررسید / شرط", "روش پرداخت", "مشخصات چک"],
        rows
      ),
    ],
    true
  );
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

/** Render one cell of a `repeatable` row, using that column's own kind. */
function repeatCellFa(
  columnKind: ContractRepeatColumn["kind"],
  value: unknown
): string {
  if (value === null || value === undefined || value === "") return "";
  switch (columnKind) {
    case "money":
      return money(value as unknown as { amount: number; currency: "IRR" });
    case "date":
      return typeof value === "string" ? formatIsoJalali(value) : "";
    case "number":
      return num(typeof value === "number" ? value : null);
    default:
      return String(value);
  }
}

/**
 * The rows of a `repeatable` field, with fully-blank rows dropped. An
 * empty row is a scaffold in the form, never a row in the document.
 */
function repeatRowsFa(
  descriptor: ContractFieldDescriptor,
  value: GenericFieldValue | undefined
): string[][] {
  if (!Array.isArray(value)) return [];
  const columns = descriptor.columns ?? [];
  const rows: string[][] = [];
  for (const row of value as GenericRepeatRow[]) {
    const cells = columns.map((c) => repeatCellFa(c.kind, row[c.key]));
    const hasContent = cells.some((cell) => cell.trim().length > 0);
    if (hasContent) rows.push(cells);
  }
  return rows;
}

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
    case "repeatable": {
      // Rows are a table, never a comma-joined string: this branch is only
      // reached if a declared table owns the key, or a legacy draft still
      // holds free text. The legacy text prints verbatim so no answer the
      // user gave before the row editor existed is ever lost.
      if (typeof value === "string") return value.trim();
      return repeatRowsFa(descriptor, value)
        .map((cells) => cells.join(" | "))
        .join(" ؛ ");
    }
    default:
      return String(value);
  }
}

/**
 * Build one clause per wizard step that owns at least one field.
 *
 * A `required` field is always rendered — with the placeholder when it
 * is still empty — so a draft visibly shows what is missing instead of
 * silently dropping a clause. Optional fields appear only when filled,
 * so no empty line ever reaches the final document.
 */
function genericClauses(
  def: ReturnType<typeof getContractDefinition>,
  data: GenericContractData,
  startIndex: number
): RenderedClause[] {
  const values = data.values ?? {};
  const clauses: RenderedClause[] = [];
  let index = startIndex;

  for (const step of def.wizardSteps) {
    const fields = def.fields.filter((f) => f.stepId === step.id);
    if (fields.length === 0) continue;

    const isFilledValue = (key: string): boolean => {
      const v = values[key];
      return v !== null && v !== undefined && v !== "";
    };

    // A required field is rendered even while empty (the placeholder makes
    // the missing value visible in a draft), but ONLY when its branch
    // actually applies: a passport expiry must never appear for an Iranian
    // employee. Optional empty fields never add a line.
    const rendered = fields.filter((f) => {
      if (isFilledValue(f.key)) return true;
      if (!f.required && !f.requiredWhen) return false;
      return fieldConditionHolds(values, f.requiredWhen);
    });
    if (rendered.length === 0) continue;

    // Semantic tables first. A type may declare named tables for a step
    // (vehicle specs, salary and benefits, service level, money terms…).
    // A declared table OWNS its fields: they print only there, with the
    // headers the definition chose, so an answer can never appear twice.
    const blocks: (RenderedBlock | null)[] = [];
    const descriptorByKey = new Map(def.fields.map((f) => [f.key, f]));
    const declaredTables = (def.fieldTables ?? []).filter((t) => t.stepId === step.id);
    // A repeatable field is its OWN table. A definition may still name its
    // key as a row in a two-column spec table (commercial_sale does), but a
    // spec cell can only hold one value — it would flatten an entire
    // schedule into a single " | "-joined string. Such rows are therefore
    // skipped here and the key is left un-owned, so the repeatable path
    // below always draws the real table.
    const isRepeatableKey = (key: string): boolean =>
      descriptorByKey.get(key)?.kind === "repeatable";
    const groupedKeys = new Set(
      declaredTables
        .flatMap((t) => t.rows.map((r) => r.key))
        .filter((key) => !isRepeatableKey(key))
    );

    for (const t of declaredTables) {
      const rowsFa: string[][] = [];
      for (const row of t.rows) {
        const descriptor = descriptorByKey.get(row.key);
        if (!descriptor || descriptor.kind === "repeatable") continue;
        const value = values[row.key];
        const filled = value !== null && value !== undefined && value !== "";
        // A required row stays visible (with the placeholder) so a draft
        // shows exactly what is still missing. An empty optional row is
        // dropped, so no half-empty table ever reaches the sheet.
        const requiredHere =
          (descriptor.required || descriptor.requiredWhen) &&
          fieldConditionHolds(values, descriptor.requiredWhen);
        if (!filled && !requiredHere) continue;
        rowsFa.push([row.labelFa ?? descriptor.labelFa, genericValueFa(descriptor, value)]);
      }
      // A table with no printable row is noise on a legal sheet — a bare
      // heading row carries no information. Drop it entirely rather than
      // printing an empty grid.
      if (rowsFa.length > 0) blocks.push(tableBlock(t.captionFa, t.columnsFa, rowsFa));
    }

    // A repeating field is its OWN table — one row per entry, its declared
    // column headers printed once. It is never folded into the two-column
    // spec table (which would flatten a schedule into one unreadable cell).
    // Blank rows never reach the sheet.
    const repeatFields = rendered.filter(
      (f) => !groupedKeys.has(f.key) && f.kind === "repeatable"
    );
    for (const f of repeatFields) {
      const stored = values[f.key];
      // A draft saved before this field became a table still holds free
      // text. Print it verbatim rather than dropping an answer the user
      // already gave — the array form takes over once they add a row.
      if (typeof stored === "string" && stored.trim()) {
        blocks.push(para(`${f.labelFa}: ${stored.trim()}`));
        continue;
      }
      const rowsFa = repeatRowsFa(f, stored);
      if (rowsFa.length === 0) continue;
      blocks.push(
        tableBlock(f.labelFa, (f.columns ?? []).map((c) => c.labelFa), rowsFa)
      );
    }
    const repeatKeys = new Set(repeatFields.map((f) => f.key));

    // Short answers (text, number, money, date, select, toggle) read as a
    // two-column spec table; long free-text answers stay paragraphs because
    // a table cell is the wrong home for a clause. A step with a single short
    // answer stays a sentence — a one-row table would be noise.
    const remaining = rendered.filter(
      (f) => !groupedKeys.has(f.key) && !repeatKeys.has(f.key)
    );
    const shortFields = remaining.filter((f) => f.kind !== "textarea");
    const longFields = remaining.filter((f) => f.kind === "textarea");

    if (shortFields.length >= 2) {
      blocks.push(
        tableBlock(
          step.titleFa,
          ["موضوع", "شرح"],
          shortFields.map((f) => [f.labelFa, genericValueFa(f, values[f.key])])
        )
      );
    } else {
      for (const f of shortFields) {
        blocks.push(para(`${f.labelFa}: ${genericValueFa(f, values[f.key])}.`));
      }
    }
    for (const f of longFields) {
      blocks.push(para(`${f.labelFa}: ${genericValueFa(f, values[f.key])}`));
    }

    clauses.push(
      clauseFrom(`generic.${step.id}`, `ماده ${index} — ${step.titleFa}`, blocks, false)
    );
    index += 1;
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
    clauses.push(
      ...genericClauses(def, contract.data as GenericContractData, clauses.length + 1)
    );
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

  // Notes + requested changes print AFTER the operative clauses, in a
  // clearly non-operative annex, so they can never be mistaken for a term.
  const supplementary = supplementaryClause(
    contract.data as PropertyRentData | PropertySaleData | GenericContractData,
    (key) =>
      def.wizardSteps.find((s) => s.id === key)?.titleFa ??
      def.sections.find((s) => s.key === key)?.labelFa ??
      key
  );
  if (supplementary) clauses.push(supplementary);

  // The user's own note is the document's LAST section — it explains the
  // contract and prints under its own «یادداشت تکمیلی» heading, after all
  // articles and annexes, exactly as the wizard promised.
  const note = supplementaryNoteClause(
    contract.data as PropertyRentData | PropertySaleData | GenericContractData
  );
  if (note) clauses.push(note);

  const signatureLines = def.roles.flatMap((role) => {
    const party = parties.find((p) => p.role === role);
    const lines = [
      {
        roleFa: partyRoleLabelFa(role),
        nameFa: fullName(party),
        // A legal entity is identified by its registration id; a person
        // by the national id they were actually recorded with.
        nationalId:
          party?.personKind === "legal"
            ? party.identity.companyRegistrationNumber || PLACEHOLDER
            : party?.identity.nationalId || party?.identity.passportNumber || PLACEHOLDER,
      },
    ];
    const rep = party
      ? parties.find(
          (p) => p.role === "legal_representative" && p.representativeOfPartyId === party.id
        )
      : undefined;
    if (party && rep) {
      lines.push({
        roleFa: `${partyRoleLabelFa("legal_representative")} ${fullName(party)}`,
        nameFa: fullName(rep),
        nationalId: rep.identity.nationalId || PLACEHOLDER,
      });
    }
    return lines;
  });

  // Prefer the type's own contract date; fall back to the creation date
  // so the preamble never shows a placeholder where a real date exists.
  const dataDate =
    contract.type === "property_rent"
      ? (contract.data as PropertyRentData).durations.contractDate
      : null;
  const contractDate = dataDate || contract.createdAt.slice(0, 10);

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
    // `clauseParagraphs` projects tables into aligned text rows, so the
    // plain-text export always carries exactly what the sheet shows.
    for (const p of clauseParagraphs(clause)) lines.push(p);
    lines.push("");
  }
  lines.push("امضاها:");
  for (const s of rendered.signatureLines) {
    lines.push(`${s.roleFa}: ${s.nameFa} (کد ملی ${s.nationalId})`);
  }
  lines.push("", rendered.footerFa);
  return lines.join("\n");
}
