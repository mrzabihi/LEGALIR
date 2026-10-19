// ============================================================
// LEGALIR — Official stamp eligibility (pure)
// ============================================================
// The ONE evaluator for "may this stamp action run right now?". The GET
// stamp route returns its verdict to the panel and the POST route
// asserts the SAME verdict before writing anything, so:
//
//   • a disabled button always carries a real, server-authored reason;
//   • a hand-crafted POST cannot reach a state the UI would not offer.
//
// The function is PURE: every fact it needs is passed in, read by the
// route from the real store. Each rule mirrors a gate that already
// exists in the write path — nothing is invented here.
//
// The two actions have DIFFERENT (real) gates, and the panel must not
// conflate them:
//
//   request — needs a frozen version, the stamp master, a valid internal
//             review bound to that version's hash, no valid seal and no
//             open request. It records INTENT; it has no legal effect.
//   apply   — needs an open request bound to the CURRENT hash, and is
//             refused until EVERY party has signed that exact version.
//             The seal is never a substitute for a signature.
//
// So an unsigned contract may legitimately hold an open request while
// the parties sign; the panel then explains what still blocks the seal.
// ============================================================

import type { ContractStampBlocker, ContractStampEligibility } from "@legalir/types";

/** The real facts about one contract's stamp state. */
export interface StampFacts {
  /** The `CONTRACT_STAMP_ENABLED` capability. */
  featureEnabled: boolean;
  /** TRUE when the stamp master image exists on disk. */
  assetAvailable: boolean;
  /** TRUE when the contract has a frozen current version. */
  hasCurrentVersion: boolean;
  /** TRUE when the current version hash carries a valid LEGALIR review. */
  reviewed: boolean;
  /**
   * The signature state of the CURRENT version:
   *   `ready`    — every participant bound to this hash has signed;
   *   `required` — none / not everyone signed;
   *   `stale`    — only requests for a DIFFERENT hash exist.
   */
  signatures: "ready" | "required" | "stale";
  /** The operator's own words for a non-ready signature state. */
  signaturesReasonFa: string | null;
  /** TRUE when a valid seal is already applied to the current version. */
  applied: boolean;
  /** TRUE when an open (PENDING) request exists for this contract. */
  pending: boolean;
  /** TRUE when that open request is bound to the CURRENT version hash. */
  pendingMatchesCurrent: boolean;
  /** TRUE when the caller holds `admin:contracts:stamp:manage`. */
  canManage: boolean;
}

/** Preconditions for opening a request, in the order to resolve them. */
function requestBlockers(facts: StampFacts): ContractStampBlocker[] {
  const blockers: ContractStampBlocker[] = [];

  if (!facts.featureEnabled) {
    blockers.push({
      code: "FEATURE_DISABLED",
      messageFa: "سطح «مهر رسمی لیگالیر» در تنظیمات فعال نیست؛ اقدام مهر در دسترس نیست.",
    });
  }
  if (!facts.hasCurrentVersion) {
    blockers.push({
      code: "NO_VERSION",
      messageFa:
        "این قرارداد هنوز نسخهٔ تثبیت‌شده ندارد؛ ابتدا محتوا باید تثبیت و توسط واحد بررسی حقوقی تأیید شود.",
    });
    return blockers;
  }
  if (!facts.assetAvailable) {
    blockers.push({
      code: "STAMP_ASSET_MISSING",
      messageFa:
        "فایل مهر رسمی لیگالیر در دسترس نیست؛ تا تأمین آن، هیچ اقدامی روی مهر ممکن نیست.",
    });
  }
  if (!facts.reviewed) {
    blockers.push({
      code: "NOT_REVIEWED",
      messageFa:
        "نسخهٔ فعلی هنوز تأیید بررسی داخلی لیگالیر را ندارد؛ درخواست مهر فقط برای نسخهٔ تأییدشده ثبت می‌شود.",
    });
  }
  if (facts.applied) {
    blockers.push({
      code: "ALREADY_STAMPED",
      messageFa: "مهر رسمی روی نسخهٔ فعلی درج شده است؛ درخواست مجدد لازم نیست.",
    });
  }
  if (facts.pending) {
    blockers.push(
      facts.pendingMatchesCurrent
        ? {
            code: "PENDING_REQUEST",
            messageFa: "یک درخواست مهرِ باز برای همین نسخه وجود دارد؛ تصمیم‌گیری روی آن باقی است.",
          }
        : {
            code: "PENDING_REQUEST",
            messageFa:
              "یک درخواست مهرِ باز برای نسخهٔ دیگری از این قرارداد وجود دارد؛ ابتدا آن را لغو یا تعیین تکلیف کنید.",
          }
    );
  }
  return blockers;
}

/** Preconditions for applying the seal (request exists + signatures). */
function applyBlockers(facts: StampFacts): ContractStampBlocker[] {
  const blockers: ContractStampBlocker[] = [];

  if (!facts.featureEnabled) {
    blockers.push({
      code: "FEATURE_DISABLED",
      messageFa: "سطح «مهر رسمی لیگالیر» در تنظیمات فعال نیست؛ اقدام مهر در دسترس نیست.",
    });
  }
  if (!facts.pending) {
    blockers.push({
      code: "NO_PENDING_REQUEST",
      messageFa: "برای صدور مهر، ابتدا باید درخواست مهر ثبت شود.",
    });
  } else if (!facts.pendingMatchesCurrent) {
    // A request bound to another hash cannot be applied at all. Everything
    // below it (review, asset, signatures) is about sealing the CURRENT
    // version, which is moot until this request is cleared — reporting it
    // would send the operator after the wrong fix.
    blockers.push({
      code: "PENDING_REQUEST",
      messageFa:
        "درخواست مهرِ باز به نسخهٔ دیگری از قرارداد گره خورده است؛ ابتدا آن را لغو و برای نسخهٔ فعلی درخواست تازه ثبت کنید.",
    });
    return blockers;
  }
  if (!facts.hasCurrentVersion) {
    blockers.push({
      code: "NO_VERSION",
      messageFa: "نسخهٔ تثبیت‌شده‌ای برای مهر وجود ندارد.",
    });
  }
  if (!facts.assetAvailable) {
    blockers.push({
      code: "STAMP_ASSET_MISSING",
      messageFa: "فایل مهر رسمی لیگالیر از زمان ثبت درخواست در دسترس نیست.",
    });
  }
  if (!facts.reviewed) {
    blockers.push({
      code: "NOT_REVIEWED",
      messageFa: "نسخهٔ فعلی فاقد تأیید معتبر بررسی داخلی است؛ مهر روی آن درج نمی‌شود.",
    });
  }
  if (facts.signatures === "stale") {
    blockers.push({
      code: "SIGNATURES_STALE",
      messageFa:
        facts.signaturesReasonFa ??
        "نسخهٔ فعلی با نسخه‌ای که امضا شده متفاوت است؛ مهر فقط روی نسخهٔ امضاشده درج می‌شود.",
    });
  } else if (facts.signatures === "required") {
    blockers.push({
      code: "SIGNATURES_REQUIRED",
      messageFa:
        facts.signaturesReasonFa ?? "پیش از درج مهر رسمی، همهٔ طرفین باید قرارداد را امضا کنند.",
    });
  }
  return blockers;
}

/**
 * Evaluate every stamp action against the real facts. `blockers` is the
 * list for the action the operator would take NEXT — the open request's
 * decision when one exists, otherwise opening a request — so the panel
 * never shows a condition that is not actually in the way.
 */
export function evaluateStampEligibility(facts: StampFacts): ContractStampEligibility {
  const canRequest = requestBlockers(facts).length === 0 && facts.canManage;

  const canApply =
    applyBlockers(facts).length === 0 && facts.pending && facts.canManage;

  // An open request may always be rejected or cancelled — including one
  // bound to an older hash, which is exactly how a stale request is
  // cleared before a fresh one can be opened.
  const canReject = facts.featureEnabled && facts.pending && facts.canManage;
  const canCancel = canReject;

  const blockers = facts.pending ? applyBlockers(facts) : requestBlockers(facts);

  // Missing permission is the LAST explanation, not the first: an operator
  // who can see the panel should still learn which real condition is
  // unmet. It is reported whenever it is the thing standing between the
  // current facts and an action — otherwise the button would be dead with
  // every listed precondition already met.
  if (!facts.canManage && blockers.length === 0) {
    blockers.push({
      code: "NOT_MANAGER",
      messageFa:
        "این اقدام فقط با مجوز «مدیریت مهر رسمی قراردادها» و در اختیار مدیر ارشد لیگالیر ممکن است.",
    });
  }

  // `none` means no action is meaningful right now: either the seal is
  // already applied, or a permission is missing (nothing the operator can
  // resolve from this panel).
  let nextAction: ContractStampEligibility["nextAction"] = "none";
  if (canApply) nextAction = "apply";
  else if (canRequest) nextAction = "request";
  else if (canReject) nextAction = "reject";

  return { canRequest, canApply, canReject, canCancel, blockers, nextAction };
}

/**
 * The ONE blocker the operator should act on next. Returns null when
 * nothing is blocking.
 */
export function primaryStampBlocker(
  eligibility: ContractStampEligibility
): ContractStampBlocker | null {
  return eligibility.blockers[0] ?? null;
}
