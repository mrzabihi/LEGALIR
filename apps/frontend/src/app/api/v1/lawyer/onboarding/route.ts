// ============================================================
// LEGALIR — /api/v1/lawyer/onboarding
// ============================================================
// GET  — the caller's lawyer onboarding state.
// POST — submit the lawyer profile for review.
//
// A submitted profile is NEVER auto-verified. Completing the form only
// moves the profile to PROFILE_SUBMITTED (pending review); the lawyer
// gains no marketplace visibility or permissions until an admin verifies.
//
// Authorization: the user id comes from the session, never the request.
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { findUserById, setOnboardingStatus } from "@/lib/db";
import { getLawyerProfileByUserId, upsertLawyerProfile } from "@/lib/lawyer-db";
import type {
  LawyerActivityType,
  LawyerOnboardingState,
  LawyerProfile,
  LawyerSpecialty,
} from "@legalir/types";

const ACTIVITY_TYPES: LawyerActivityType[] = [
  "INDEPENDENT",
  "LAW_FIRM",
  "LEGAL_ADVISOR",
  "ARBITRATOR",
  "OTHER",
];

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => str(v))
    .filter((v): v is string => v !== null);
}

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const user = findUserById(auth.ctx.userId);
  if (!user) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "کاربر یافت نشد" },
      { status: 404 }
    );
  }

  const profile = getLawyerProfileByUserId(auth.ctx.userId) ?? null;
  const state: LawyerOnboardingState = {
    status: user.onboardingStatus ?? "NOT_STARTED",
    profile,
    pendingVerification: profile?.verificationStatus === "PROFILE_SUBMITTED",
  };

  return NextResponse.json({ data: state });
}

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const fullName = str(body["fullName"]);
  if (!fullName) {
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: "نام و نام خانوادگی الزامی است",
        fieldErrors: [{ path: "fullName", reason: "نام وکیل الزامی است" }],
      },
      { status: 400 }
    );
  }

  const activityTypeRaw = str(body["activityType"]);
  const activityType =
    activityTypeRaw && (ACTIVITY_TYPES as string[]).includes(activityTypeRaw)
      ? (activityTypeRaw as LawyerActivityType)
      : null;

  const province = str(body["province"]);
  const city = str(body["city"]);
  const yearsExperience = num(body["yearsExperience"]);
  const specializations: LawyerSpecialty[] = strArray(body["specializations"]).map(
    (category) => ({ category, yearsExperience: yearsExperience ?? 0 })
  );

  const now = new Date().toISOString();
  const existing = getLawyerProfileByUserId(auth.ctx.userId);

  const profile: LawyerProfile = {
    id: existing?.id ?? crypto.randomUUID(),
    userId: auth.ctx.userId,
    fullName,
    licenseNumber: str(body["licenseNumber"]),
    licenseYear: num(body["licenseYear"]),
    bio: str(body["bio"]) ?? "",
    avatarUrl: str(body["avatarUrl"]),
    avatarType: "real",
    professionalTitle: str(body["professionalTitle"]),
    activityType,
    licenseAuthority: str(body["licenseAuthority"]),
    // A submitted profile is PENDING — never auto-verified.
    verificationStatus: "PROFILE_SUBMITTED",
    verifiedAt: null,
    verificationNote: null,
    specializations,
    locations: province || city
      ? [{ province: province ?? "", city: city ?? "", remote: true }]
      : [],
    languages: existing?.languages ?? [],
    pricing: existing?.pricing ?? {
      consultationFeeToman: 0,
      freeFirstConsultation: false,
    },
    availability: existing?.availability ?? [],
    performance: existing?.performance ?? {
      acceptedRequests: 0,
      completedCases: 0,
      medianResponseMinutes: null,
      averageRating: null,
      reviewCount: 0,
    },
    // Not yet visible in the marketplace until verified.
    availabilityStatus: "INACTIVE",
    consultationCapacity: null,
    isDemo: false,
    acceptingRequests: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const saved = upsertLawyerProfile(profile);
  setOnboardingStatus(auth.ctx.userId, "COMPLETED");

  const state: LawyerOnboardingState = {
    status: "COMPLETED",
    profile: saved,
    pendingVerification: true,
  };

  return NextResponse.json({ data: state }, { status: 201 });
}
