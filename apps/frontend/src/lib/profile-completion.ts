// ============================================================
// LEGALIR — Profile Completion (SINGLE SOURCE OF TRUTH)
// ============================================================
// One authoritative, configurable calculation of profile completion.
// Backend/domain computes the percentage; the frontend only displays.
// No magic percentages are scattered across React components.
//
// Model:
//   Basic Profile    = 50%   (the existing /profile fields)
//   Extended Profile = 50%   ("پروفایل حقوقی من" — legal profile)
//   Total            = 100%
// ============================================================

export type BasicProfileField = "displayName" | "city" | "occupation" | "email" | "birthDate";
export type ExtendedProfileField = "userType" | "province" | "legalInterests" | "primaryUseCase";

/** Each Basic field contributes 10% (5 fields × 10% = 50%). */
export const BASIC_PROFILE_FIELDS: readonly BasicProfileField[] = [
  "displayName",
  "city",
  "occupation",
  "email",
  "birthDate",
];

/** Each Extended field contributes 12.5% (4 fields × 12.5% = 50%). */
export const EXTENDED_PROFILE_FIELDS: readonly ExtendedProfileField[] = [
  "userType",
  "province",
  "legalInterests",
  "primaryUseCase",
];

const BASIC_WEIGHT = 50 / BASIC_PROFILE_FIELDS.length; // 10
const EXTENDED_WEIGHT = 50 / EXTENDED_PROFILE_FIELDS.length; // 12.5

export interface ProfileCompletionInput {
  displayName: string | null;
  city: string | null;
  occupation: string | null;
  email: string | null;
  birthDate: string | null;
  userType: string | null;
  province: string | null;
  legalInterests: string[] | null;
  primaryUseCase: string | null;
}

export interface ProfileStageCompletion {
  completed: boolean;
  percentage: number;
  missingFields: string[];
}

export interface ProfileCompletion {
  /** Overall percentage (0–100). May be fractional (e.g. 62.5). */
  percentage: number;
  /** Rounded integer percentage for persisted `completionPercent`. */
  rounded: number;
  basicProfile: ProfileStageCompletion;
  extendedProfile: ProfileStageCompletion;
}

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function computeProfileCompletion(input: Partial<ProfileCompletionInput>): ProfileCompletion {
  const basicFilled = BASIC_PROFILE_FIELDS.filter((f) => isFilled(input[f]));
  const extendedFilled = EXTENDED_PROFILE_FIELDS.filter((f) => isFilled(input[f]));

  const basicPercentage = basicFilled.length * BASIC_WEIGHT;
  const extendedPercentage = extendedFilled.length * EXTENDED_WEIGHT;

  const percentage = basicPercentage + extendedPercentage;

  return {
    percentage,
    rounded: Math.round(percentage),
    basicProfile: {
      completed: basicFilled.length === BASIC_PROFILE_FIELDS.length,
      percentage: basicPercentage,
      missingFields: BASIC_PROFILE_FIELDS.filter((f) => !isFilled(input[f])) as string[],
    },
    extendedProfile: {
      completed: extendedFilled.length === EXTENDED_PROFILE_FIELDS.length,
      percentage: extendedPercentage,
      missingFields: EXTENDED_PROFILE_FIELDS.filter((f) => !isFilled(input[f])) as string[],
    },
  };
}
