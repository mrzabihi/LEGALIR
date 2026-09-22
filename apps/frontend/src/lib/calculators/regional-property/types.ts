// ============================================================
// LEGALIR — Regional property value (ارزش منطقه‌ای ملک) domain types
// ============================================================
// The engine's own vocabulary, kept separate from the UI-facing
// `CalculatorField` list so the valuation model can be read on its own.
//
// Governing instrument: قانون مالیات‌های مستقیم (ماده ۶۴) و آیین‌نامه
// اجرایی آن — ارزش معاملاتی املاک؛ به‌همراه دفترچه ارزش منطقه‌ای
// سالانه سازمان امور مالیاتی.
//
// Pure module — no React, no I/O.

/** How the property is used — drives the street-width and floor rules. */
export type PropertyUsage = "residential" | "commercial" | "office" | "industrial";

/** Construction stage — a statutory completion coefficient. */
export type ConstructionStage =
  | "completed"
  | "finishing"
  | "skeleton"
  | "structure"
  | "foundation";

/** The valuation census the engine reasons over. */
export interface PropertyInput {
  // ---- موقعیت ----
  province: string;
  city: string;
  district: string;
  block: string;

  // ---- عرصه (land) ----
  /** Land area in square metres. */
  landAreaM2: number;
  /** Width of the street the plot fronts, in metres. */
  streetWidthM: number;
  usage: PropertyUsage;

  // ---- اعیان (building) ----
  /** Whether the plot carries a building. */
  hasBuilding: boolean;
  /** Total built area in square metres. */
  buildingAreaM2: number;
  /** Total number of floors in the building. */
  floors: number;
  /** Age of the building, in years. */
  ageYears: number;
  stage: ConstructionStage;
  /** Whether the unit includes a parking space. */
  hasParking: boolean;

  // ---- برنامه حمایتی ----
  /** Whether the first-transfer support discount applies. */
  supportProgram: boolean;
}

/** One line of a result section. */
export interface ValueRow {
  labelFa: string;
  valueFa: string;
  noteFa?: string;
}

/** A titled group of rows (e.g. «عرصه» / «اعیان»). */
export interface ValueSection {
  titleFa: string;
  rows: ValueRow[];
  totalFa?: string;
}

/** The engine's full output. */
export interface PropertyValuation {
  /** Land value in Rial. */
  landValueRial: number;
  /** Building value in Rial. */
  buildingValueRial: number;
  /** Land + building, before any support discount. */
  grossValueRial: number;
  /** Support-program discount in Rial. */
  discountRial: number;
  /** Final value after the discount. */
  netValueRial: number;
  /** The regional land rate actually applied, in Rial/m². */
  landRatePerM2Rial: number;
  /** The construction rate actually applied, in Rial/m². */
  buildingRatePerM2Rial: number;
  /** Street-width coefficient applied to the land rate. */
  streetCoefficient: number;
  /** Age depreciation coefficient applied to the building. */
  ageCoefficient: number;
  /** Stage coefficient applied to the building. */
  stageCoefficient: number;
  /** Floor coefficient applied to the building. */
  floorCoefficient: number;
  /** Structured breakdown for display. */
  sections: ValueSection[];
  /** Plain-Persian «نحوه محاسبه». */
  explanationFa: string;
  /** «مبنای قانونی» — the instruments relied on. */
  legalNotesFa: string[];
  /** Set when the input cannot be valued (e.g. unknown location). */
  unsupportedFa?: string;
}
