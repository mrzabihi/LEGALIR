// ============================================================
// LEGALIR — Calculators UI types
// ============================================================
// A single option shape shared by the search/filter controls, the
// filter dropdowns and the catalog data functions that feed them. Kept
// in its own module so the controls and the dropdown can both import it
// without a circular dependency.

export interface ControlOption {
  /** The real id (a category id or a calculator status id, or "all"). */
  id: string;
  /** Human label (already Persian, from the registry's own maps). */
  label: string;
  /** How many calculators currently carry this value. */
  count: number;
}
