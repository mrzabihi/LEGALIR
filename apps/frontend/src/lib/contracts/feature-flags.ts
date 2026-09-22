// ============================================================
// LEGALIR — Contract lifecycle feature flags (§116)
// ============================================================
// The lifecycle engine ships behind four flags so a capability can be
// turned off without a code change. Flags are read from the
// environment on the SERVER and enforced there; the UI reads the same
// values only to decide whether to render an entry point.
//
// A flag never grants permission — it only removes an option. The
// server still authorizes every action independently.
// ============================================================

export interface ContractFeatureFlags {
  /** Electronic signature (OTP provider v1). */
  CONTRACT_SIGNING_ENABLED: boolean;
  /** Lawyer review requests. */
  LAWYER_REVIEW_ENABLED: boolean;
  /** AI contract review through the existing chat. */
  AI_CONTRACT_REVIEW_ENABLED: boolean;
  /** Certificate-backed signatures. Off until a provider is wired. */
  CERTIFIED_SIGNATURE_ENABLED: boolean;
}

/** Read a boolean env var, defaulting when unset. */
function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

/**
 * The current flag values. Read fresh on every call so a test can
 * stub the environment without a module reset.
 */
export function contractFeatureFlags(): ContractFeatureFlags {
  return {
    CONTRACT_SIGNING_ENABLED: envFlag("CONTRACT_SIGNING_ENABLED", true),
    LAWYER_REVIEW_ENABLED: envFlag("LAWYER_REVIEW_ENABLED", true),
    AI_CONTRACT_REVIEW_ENABLED: envFlag("AI_CONTRACT_REVIEW_ENABLED", true),
    CERTIFIED_SIGNATURE_ENABLED: envFlag("CERTIFIED_SIGNATURE_ENABLED", false),
  };
}

/** True when the named capability is enabled. */
export function isContractFeatureEnabled(flag: keyof ContractFeatureFlags): boolean {
  return contractFeatureFlags()[flag];
}

/**
 * The client-safe subset. `CERTIFIED_SIGNATURE_ENABLED` is included
 * because it only controls whether a future option is shown; no
 * secret is exposed by any of these.
 */
export function publicContractFeatureFlags(): ContractFeatureFlags {
  return contractFeatureFlags();
}
