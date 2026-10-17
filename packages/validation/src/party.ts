// ============================================================
// LEGALIR — Party identity validation (branch-aware)
// ============================================================
// A party is validated against the branch the user actually chose:
//
//   natural + iranian  → name + a 10-digit Iranian national id + mobile
//   natural + foreign  → name + nationality + passport + Gregorian birth
//                        data; an Iranian national id is NEVER required
//   legal              → registered name + registration/national id +
//                        address + a contact mobile; the natural-person
//                        name fields are not required
//
// The same rules feed the form, the completeness scorer and the server
// route, so the three can never disagree about what "complete" means.
// All functions are pure and return `{ code, field, messageFa }[]`, so
// the caller can attach each message to the exact input it belongs to.
// ============================================================

import { normalizeIranMobile, MOBILE_ERROR_MESSAGE } from "./phone";

export type PartyPersonKind = "natural" | "legal";
export type PartyNationality = "iranian" | "foreign";

/** The subset of identity data this module reads. */
export interface PartyIdentityInput {
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  mobile?: string;
  address?: string;
  companyName?: string;
  companyRegistrationNumber?: string;
  companyNationalId?: string;
  nationalityCountryFa?: string;
  passportNumber?: string;
  passportExpiry?: string | null;
  birthPlace?: string;
  birthDateGregorian?: string | null;
  workPermitNumber?: string;
}

export interface PartyValidationIssue {
  /** Machine-readable code, e.g. `NATIONAL_ID_REQUIRED`. */
  code: string;
  /** The identity key the message belongs to. */
  field: string;
  /** Persian message shown next to the field. */
  messageFa: string;
}

export interface PartyValidationInput {
  personKind: PartyPersonKind;
  nationality: PartyNationality;
  identity: PartyIdentityInput;
}

/** True when `value` is a structurally valid 10-digit Iranian national id. */
export function isValidIranNationalId(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{10}$/.test(digits)) return false;
  // A repeated single digit (0000000000, 1111111111, …) is never valid.
  if (/^(\d)\1{9}$/.test(digits)) return false;
  const check = Number(digits[9]);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * (10 - i);
  const remainder = sum % 11;
  return remainder < 2 ? check === remainder : check === 11 - remainder;
}

/** True when `value` is a structurally valid شبا (`IR` + 24 digits). */
export function isValidIban(value: string): boolean {
  const normalized = value.replace(/\s/g, "").toUpperCase();
  return /^IR\d{24}$/.test(normalized);
}

/** True when `value` is a 16-digit payment card number. */
export function isValidCardNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 16;
}

/** True when `value` is an ISO `YYYY-MM-DD` date. */
function isIsoDate(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function filled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

const REQUIRED = (field: string, labelFa: string, code = "REQUIRED"): PartyValidationIssue => ({
  code,
  field,
  messageFa: `${labelFa} الزامی است.`,
});

/**
 * Validate a party's branch-specific identity. `nationalId` is required
 * ONLY for an Iranian natural person; a foreign natural person is never
 * asked for one.
 */
export function validatePartyIdentity(input: PartyValidationInput): PartyValidationIssue[] {
  const { personKind, nationality, identity } = input;
  const issues: PartyValidationIssue[] = [];

  // A contact mobile is required for every kind: it is how the signature
  // invitation reaches the signer.
  // `mobile` is optional on the wire (a draft may not have it yet), so
  // narrow to a string before handing it to the normaliser.
  const mobile = identity.mobile ?? "";
  if (!filled(mobile)) {
    issues.push(REQUIRED("mobile", "شمارهٔ موبایل"));
  } else if (!normalizeIranMobile(mobile)) {
    issues.push({ code: "INVALID_MOBILE", field: "mobile", messageFa: MOBILE_ERROR_MESSAGE });
  }

  if (personKind === "legal") {
    if (!filled(identity.companyName)) {
      issues.push(REQUIRED("companyName", "نام رسمی شرکت / مؤسسه"));
    }
    const hasRegistrationId =
      filled(identity.companyRegistrationNumber) || filled(identity.companyNationalId);
    if (!hasRegistrationId) {
      issues.push(
        REQUIRED("companyRegistrationNumber", "شمارهٔ ثبت یا شناسهٔ ملی شرکت", "COMPANY_ID_REQUIRED")
      );
    }
    if (!filled(identity.address)) {
      issues.push(REQUIRED("address", "نشانی شرکت"));
    }
    return issues;
  }

  // Natural person — shared name fields.
  if (!filled(identity.firstName)) issues.push(REQUIRED("firstName", "نام"));
  if (!filled(identity.lastName)) issues.push(REQUIRED("lastName", "نام خانوادگی"));

  if (nationality === "iranian") {
    const nationalId = identity.nationalId ?? "";
    if (!filled(nationalId)) {
      issues.push(REQUIRED("nationalId", "کد ملی", "NATIONAL_ID_REQUIRED"));
    } else if (!isValidIranNationalId(nationalId)) {
      issues.push({
        code: "INVALID_NATIONAL_ID",
        field: "nationalId",
        messageFa: "کد ملی معتبر نیست؛ ۱۰ رقم و بدون تکرار یکسان.",
      });
    }
  } else {
    if (!filled(identity.nationalityCountryFa)) {
      issues.push(REQUIRED("nationalityCountryFa", "کشور تابعیت"));
    }
    if (!filled(identity.passportNumber)) {
      issues.push(REQUIRED("passportNumber", "شمارهٔ گذرنامه"));
    }
    if (!isIsoDate(identity.passportExpiry)) {
      issues.push({
        code: "PASSPORT_EXPIRY_REQUIRED",
        field: "passportExpiry",
        messageFa: "تاریخ اعتبار گذرنامه الزامی است.",
      });
    }
    if (!filled(identity.birthPlace)) {
      issues.push(REQUIRED("birthPlace", "محل تولد"));
    }
    if (!isIsoDate(identity.birthDateGregorian)) {
      issues.push({
        code: "BIRTH_DATE_REQUIRED",
        field: "birthDateGregorian",
        messageFa: "تاریخ تولد (میلادی) الزامی است.",
      });
    }
  }

  return issues;
}

/** Validate a bank-details block. An empty block is allowed (no banking yet). */
export function validateBanking(input: {
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  cardNumber?: string;
}): PartyValidationIssue[] {
  const touched =
    filled(input.bankName) ||
    filled(input.accountNumber) ||
    filled(input.iban) ||
    filled(input.cardNumber);
  if (!touched) return [];

  const issues: PartyValidationIssue[] = [];
  if (!filled(input.bankName)) issues.push(REQUIRED("bankName", "نام بانک"));
  if (!filled(input.accountNumber)) {
    issues.push(REQUIRED("accountNumber", "شماره حساب"));
  } else if (!/^\d{10,16}$/.test(input.accountNumber!.replace(/\D/g, ""))) {
    issues.push({
      code: "INVALID_ACCOUNT",
      field: "accountNumber",
      messageFa: "شماره حساب باید ۱۰ تا ۱۶ رقم باشد.",
    });
  }
  if (!filled(input.iban)) {
    issues.push(REQUIRED("iban", "شماره شبا"));
  } else if (!isValidIban(input.iban!)) {
    issues.push({
      code: "INVALID_IBAN",
      field: "iban",
      messageFa: "شماره شبا باید با IR شروع شود و ۲۴ رقم پس از آن داشته باشد.",
    });
  }
  if (filled(input.cardNumber) && !isValidCardNumber(input.cardNumber!)) {
    issues.push({
      code: "INVALID_CARD",
      field: "cardNumber",
      messageFa: "شماره کارت باید ۱۶ رقم باشد.",
    });
  }
  return issues;
}
