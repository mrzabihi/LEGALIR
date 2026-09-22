// ============================================================
// LEGALIR — Registration Policy Engine
// ============================================================
// The single place that answers: "does this contract need official
// registration, and what does finalizing it in Legalier actually
// mean?" The answer is DATA (declared per contract type in the
// registry), never a hard-coded `if (type === "sale")`.
//
// The critical legal rule this module enforces:
//
//   «نهایی‌شدن قرارداد در لِگال‌آی‌آر» ≠ «انتقال رسمی مالکیت»
//
// A finalized sale contract lands in READY_FOR_OFFICIAL_REGISTRATION,
// never in a state that implies ownership has transferred.
// ============================================================

import type { ContractTypeId, PropertyContractState } from "@legalir/types";
import { getContractDefinition, type RegistrationPolicy } from "./registry";

export interface RegistrationOutcome {
  policy: RegistrationPolicy;
  /** The state the contract moves to once every party has signed. */
  postSignState: PropertyContractState;
  /** Persian headline shown on the finalize screen. */
  headlineFa: string;
  /** Persian body explaining what has and has not happened. */
  bodyFa: string;
  /** True when the user must still go to a notary office. */
  requiresNotaryVisit: boolean;
}

/** Evaluate the registration policy for a contract type. */
export function evaluateRegistrationPolicy(typeId: ContractTypeId): RegistrationOutcome {
  const policy = getContractDefinition(typeId).registrationPolicy;

  if (policy.officialRegistrationRequired) {
    return {
      policy,
      postSignState: "READY_FOR_OFFICIAL_REGISTRATION",
      headlineFa: "قرارداد امضا شد — ثبت رسمی لازم است",
      bodyFa:
        "این قرارداد با امضای طرفین اعتبار دارد، اما انتقال مالکیت تنها با تنظیم سند رسمی در دفتر اسناد رسمی انجام می‌شود. لِگال‌آی‌آر انتقال رسمی مالکیت را انجام نمی‌دهد و صرفاً قرارداد را برای ثبت آماده می‌کند.",
      requiresNotaryVisit: true,
    };
  }

  return {
    policy,
    postSignState: "FINALIZED",
    headlineFa: "قرارداد نهایی شد",
    bodyFa:
      "این قرارداد با امضای طرفین نهایی و معتبر است. ثبت رسمی اختیاری است و در صورت تمایل می‌توانید در دفتر اسناد رسمی نیز ثبت کنید.",
    requiresNotaryVisit: false,
  };
}

/**
 * True when the given state means "the parties have finished their
 * part in Legalier" — regardless of whether official registration
 * has happened outside the platform.
 */
export function isLegallyConcluded(state: PropertyContractState): boolean {
  return state === "FINALIZED" || state === "READY_FOR_OFFICIAL_REGISTRATION";
}

/**
 * The Persian status line shown on the verification page. It never
 * claims ownership transfer for a sale contract.
 */
export function verificationStatusFa(
  typeId: ContractTypeId,
  state: PropertyContractState
): string {
  const outcome = evaluateRegistrationPolicy(typeId);
  if (state === "READY_FOR_OFFICIAL_REGISTRATION") {
    return "امضاشده — در انتظار ثبت رسمی در دفتر اسناد رسمی";
  }
  if (state === "FINALIZED") {
    return outcome.requiresNotaryVisit
      ? "نهایی‌شده در لِگال‌آی‌آر — انتقال رسمی مالکیت مستقل از این سند است"
      : "نهایی‌شده و معتبر";
  }
  if (state === "SIGNED" || state === "PARTIALLY_SIGNED") return "در حال امضا";
  if (state === "CANCELLED") return "لغو‌شده";
  if (state === "ARCHIVED") return "بایگانی‌شده";
  return "در حال تنظیم — هنوز امضا نشده است";
}
