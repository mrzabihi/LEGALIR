// ============================================================
// LEGALIR — Calculator operational settings (server-only)
// ============================================================
// The admin-editable per-calculator policy: enabled/disabled, who may run it
// (access tier), and the energy charged per run. This is the ONE place a
// calculator's operational policy lives — the public run endpoint enforces it
// and the admin panel edits it; there is no parallel config store.
//
// Invariants:
//   • a calculator present in the registry but absent from the store defaults
//     to enabled/free/0-energy, so shipping a new calculator never silently
//     starts charging energy or locks users out;
//   • `energyCost` is charged through the ONE usage engine, so the ledger row
//     is real, and idempotent per (calculator, user, Tehran day) — running the
//     same calculator repeatedly within a day is charged once;
//   • access decisions are a PURE function of the setting + the caller's
//     resolved entitlement, so they are trivially testable without I/O.

import type { CalculatorAccessTier, CalculatorSetting } from "@legalir/types";
import { readTable, writeTable } from "@/lib/db";
import { getCalculator, listCalculators } from "@/lib/calculators";
import { completeUsage, reserveUsage, resolveEntitlement } from "@/lib/usage/engine";
import { tehranDateString } from "@/lib/rewards";

const TABLE = "calculator_settings";

const VALID_TIERS: readonly CalculatorAccessTier[] = [
  "free",
  "subscription",
  "purchase",
  "restricted",
];

/** The policy a calculator has before an admin ever touches it. */
function defaultsFor(slug: string): CalculatorSetting {
  return {
    slug,
    enabled: true,
    accessTier: "free",
    energyCost: 0,
    allowedPlans: [],
    allowedUserIds: [],
    updatedBy: null,
    updatedAt: "",
  };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Every registered calculator's setting, seeding defaults for any calculator
 * that has no stored row yet and dropping rows for calculators that no longer
 * exist — the store can never drift from the registry.
 */
export function listCalculatorSettings(): CalculatorSetting[] {
  const rows = readTable<CalculatorSetting>(TABLE);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const known = listCalculators().map((c) => c.def.slug);

  const out = known.map((slug) => bySlug.get(slug) ?? defaultsFor(slug));
  // Rewrite only when the derived list differs from what is stored (a new
  // calculator appeared, or a removed one left an orphaned row).
  const changed =
    out.length !== rows.length || out.some((s, i) => rows[i]?.slug !== s.slug);
  if (changed) writeTable(TABLE, out);
  return out;
}

/** One calculator's setting (defaults when unset — never undefined). */
export function getCalculatorSetting(slug: string): CalculatorSetting {
  return readTable<CalculatorSetting>(TABLE).find((r) => r.slug === slug) ?? defaultsFor(slug);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export interface SaveCalculatorSettingInput {
  enabled?: boolean;
  accessTier?: CalculatorAccessTier;
  energyCost?: number;
  allowedPlans?: string[];
  allowedUserIds?: string[];
}

/**
 * Upsert one calculator's policy. Validates the tier and that `energyCost` is
 * a non-negative number; an unknown slug is rejected so the store can only
 * ever reference a real calculator.
 */
export function saveCalculatorSetting(
  slug: string,
  input: SaveCalculatorSettingInput,
  actorId?: string
): CalculatorSetting | { error: string } {
  if (!getCalculator(slug)) return { error: "CALCULATOR_NOT_FOUND" };

  if (input.accessTier !== undefined && !VALID_TIERS.includes(input.accessTier)) {
    return { error: "INVALID_ACCESS_TIER" };
  }
  if (
    input.energyCost !== undefined &&
    (!Number.isFinite(input.energyCost) || input.energyCost < 0)
  ) {
    return { error: "INVALID_ENERGY_COST" };
  }

  const rows = readTable<CalculatorSetting>(TABLE);
  const idx = rows.findIndex((r) => r.slug === slug);
  const base = idx >= 0 ? rows[idx]! : defaultsFor(slug);

  const next: CalculatorSetting = {
    slug,
    enabled: input.enabled ?? base.enabled,
    accessTier: input.accessTier ?? base.accessTier,
    energyCost:
      input.energyCost !== undefined ? Math.round(input.energyCost) : base.energyCost,
    allowedPlans: input.allowedPlans ?? base.allowedPlans,
    allowedUserIds: input.allowedUserIds ?? base.allowedUserIds,
    updatedBy: actorId ?? base.updatedBy ?? null,
    updatedAt: new Date().toISOString(),
  };

  if (idx >= 0) rows[idx] = next;
  else rows.push(next);
  writeTable(TABLE, rows);
  return next;
}

// ---------------------------------------------------------------------------
// Access decision (pure)
// ---------------------------------------------------------------------------

/** The caller facts an access decision depends on. */
export interface CalculatorCaller {
  userId: string;
  isFree: boolean;
  planCode: string | null;
}

export type CalculatorAccessReason =
  | "DISABLED"
  | "SUBSCRIPTION_REQUIRED"
  | "RESTRICTED";

export interface CalculatorAccessDecision {
  allowed: boolean;
  reason: CalculatorAccessReason | null;
  messageFa: string;
}

/**
 * Decide whether a caller may run a calculator. Pure — no I/O — so the policy
 * is auditable and testable in isolation.
 *
 *   free         → anyone;
 *   subscription → any non-free entitlement (an active subscription);
 *   purchase     → same gate as subscription (a paid entitlement);
 *   restricted   → only an explicitly allow-listed user id or plan code.
 */
export function decideCalculatorAccess(
  setting: CalculatorSetting,
  caller: CalculatorCaller
): CalculatorAccessDecision {
  if (!setting.enabled) {
    return {
      allowed: false,
      reason: "DISABLED",
      messageFa: "این محاسبه‌گر موقتاً غیرفعال است.",
    };
  }

  if (setting.accessTier === "free") {
    return { allowed: true, reason: null, messageFa: "" };
  }

  if (setting.accessTier === "subscription" || setting.accessTier === "purchase") {
    if (caller.isFree) {
      return {
        allowed: false,
        reason: "SUBSCRIPTION_REQUIRED",
        messageFa: "برای استفاده از این محاسبه‌گر به اشتراک فعال نیاز دارید.",
      };
    }
    return { allowed: true, reason: null, messageFa: "" };
  }

  // restricted
  const byUser = setting.allowedUserIds.includes(caller.userId);
  const byPlan = caller.planCode != null && setting.allowedPlans.includes(caller.planCode);
  if (byUser || byPlan) return { allowed: true, reason: null, messageFa: "" };
  return {
    allowed: false,
    reason: "RESTRICTED",
    messageFa: "دسترسی به این محاسبه‌گر برای حساب شما مجاز نیست.",
  };
}

// ---------------------------------------------------------------------------
// Authorization + real energy charge (used by the public run endpoint)
// ---------------------------------------------------------------------------

export interface CalculatorRunAuth {
  ok: boolean;
  /** Machine code when denied (or null when allowed). */
  code: string | null;
  messageFa: string;
  /** The energy actually charged for this run (0 when free / already charged today). */
  energyCost: number;
  /** The usage transaction id when a charge was made, else null. */
  transactionId: string | null;
  setting: CalculatorSetting;
}

/**
 * Gate a calculator run and — when the policy charges energy — reserve and
 * complete the charge through the ONE usage engine. Idempotent per
 * (calculator, user, Tehran day): the first run of the day charges, repeats
 * within the day are free. The caller runs the calculator ONLY when `ok`.
 */
export function authorizeCalculatorRun(slug: string, userId: string): CalculatorRunAuth {
  const setting = getCalculatorSetting(slug);
  const deny = (code: string, messageFa: string): CalculatorRunAuth => ({
    ok: false,
    code,
    messageFa,
    energyCost: 0,
    transactionId: null,
    setting,
  });

  if (!getCalculator(slug)) return deny("CALCULATOR_NOT_FOUND", "محاسبه‌گر یافت نشد.");

  const ent = resolveEntitlement(userId);
  const decision = decideCalculatorAccess(setting, {
    userId,
    isFree: ent.isFree,
    planCode: ent.planCode,
  });
  if (!decision.allowed) return deny(decision.reason!, decision.messageFa);

  // Free to run: no ledger row, no charge, no daily-request consumption.
  if (setting.energyCost <= 0) {
    return {
      ok: true,
      code: null,
      messageFa: "",
      energyCost: 0,
      transactionId: null,
      setting,
    };
  }

  const day = tehranDateString();
  const res = reserveUsage({
    userId,
    activity: "LEGAL_CALCULATION",
    source: "calculator",
    relatedEntityId: slug,
    idempotencyKey: `calc:${slug}:${userId}:${day}`,
    overridePoints: setting.energyCost,
  });
  if (!res.ok || !res.transaction) {
    return deny(
      res.code ?? "USAGE_DENIED",
      res.messageFa || "انرژی کافی برای اجرای این محاسبه‌گر موجود نیست."
    );
  }

  // The arithmetic is deterministic and synchronous — settle immediately.
  completeUsage(res.transaction.id);

  return {
    ok: true,
    code: null,
    messageFa: "",
    energyCost: res.replayed ? 0 : setting.energyCost,
    transactionId: res.transaction.id,
    setting,
  };
}
