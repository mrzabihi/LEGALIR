// ============================================================
// LEGALIR — Calculator API client (public run surface)
// ============================================================
// Thin wrappers over apiClient for the public calculator policy + run
// endpoints. The server owns the policy gate and the energy charge (§5); the
// client uses `fetchCalculatorPolicy` to decide whether it may preview a
// result locally (free) or must submit the run for a charge.

import { apiClient } from "./client";
import type {
  CalculationResult,
  CalculatorAccessTier,
  CalculatorRuleRef,
} from "@legalir/types";

/** A DB-backed rule version's sparse rate patch, primed into the client overlay. */
export interface CalculatorRuleOverride {
  datasetId: string;
  versionId: string;
  rates: Record<string, unknown>;
}

/** The non-sensitive public slice of a calculator's operational policy. */
export interface CalculatorPolicy {
  slug: string;
  enabled: boolean;
  accessTier: CalculatorAccessTier;
  energyCost: number;
  /**
   * The DB-backed rule versions currently in force for this calculator's
   * datasets. Empty when the verified CODE seed is the effective source. Used
   * to LABEL a local preview.
   */
  rules: CalculatorRuleRef[];
  /**
   * The in-force sparse rate patches (published versions only) so a FREE
   * calculator's local preview can apply them and match the server run.
   */
  ruleOverrides: CalculatorRuleOverride[];
}

export function fetchCalculatorPolicy(slug: string): Promise<CalculatorPolicy> {
  return apiClient.get<CalculatorPolicy>(`/api/v1/calculators/${slug}`);
}

export interface RunCalculatorResponse {
  result: CalculationResult;
  /** Energy actually charged for this run (0 when free / already charged today). */
  energyCost: number;
  transactionId: string | null;
  /** The DB-backed rule versions the server actually applied for this run. */
  rules: CalculatorRuleRef[];
}

/**
 * Run a calculator on the server, where the admin policy (enabled / tier /
 * energy) is enforced. The raw form input is forwarded as `input`.
 */
export function runCalculatorOnServer(
  slug: string,
  input: Record<string, unknown>
): Promise<RunCalculatorResponse> {
  return apiClient.post<RunCalculatorResponse>(`/api/v1/calculators/${slug}/run`, { input });
}
