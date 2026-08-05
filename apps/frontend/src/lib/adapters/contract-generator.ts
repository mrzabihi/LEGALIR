// ============================================================
// LEGALIR — Contract Generation Adapter Contract
// ============================================================
// Abstracts the contract generation workflow.
// Mock: returns a pre-canned contract after simulated delay.
// Production: calls a long-running generation endpoint that may
// take 10-30 seconds, with optional streaming of partial results.
// ============================================================

/** The generated contract content with metadata. */
export interface ContractGenerationResult {
  contractId: string;
  versionId: string;
  versionNumber: number;
  content: string;
  clauses: {
    id: string;
    title: string;
    content: string;
    isProtective: boolean;
    importance: "essential" | "recommended" | "optional";
  }[];
  state: string;
}

/** Callbacks for generation lifecycle. */
export interface ContractGenerationCallbacks {
  /** Called when generation starts (useful for showing a spinner). */
  onStart: () => void;
  /** Called when generation completes successfully. */
  onComplete: (result: ContractGenerationResult) => void;
  /** Called on any error during generation. */
  onError: (error: { code: string; message: string }) => void;
}

/**
 * Abstract contract generation adapter.
 *
 * Frontend code depends only on this interface.
 * The mock implementation returns a fixture after a delay.
 * Production calls POST /api/v1/contracts/:id/generate with
 * appropriate timeout and retry handling for long generation tasks.
 */
export interface ContractGenerator {
  /**
   * Trigger contract generation.
   * @returns An AbortController-compatible signal to cancel.
   */
  generate(
    contractId: string,
    callbacks: ContractGenerationCallbacks,
    signal?: AbortSignal
  ): void;
}
