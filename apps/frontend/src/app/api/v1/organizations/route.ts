// ============================================================
// LEGALIR — /api/v1/organizations
// ============================================================
// GET  — the organizations the caller belongs to (membership-scoped).
// POST — create a legal entity and make the caller its OWNER.
//
// Authorization is membership-based: a user only ever sees organizations
// they are an active member of. The registration intent is irrelevant here.
//
// A user is NEVER converted into a company. Creating an organization adds
// a membership; the user keeps their personal identity and may represent
// several organizations over time.
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth, findActiveMembership } from "@/lib/rbac";
import { findUserById, setOnboardingStatus } from "@/lib/db";
import {
  createOrganizationWithOwner,
  findOrganizationByNationalId,
  getOrganizationById,
} from "@/lib/org-db";
import type {
  Organization,
  OrganizationLegalType,
  OrganizationStatus,
} from "@legalir/types";

const LEGAL_TYPES: OrganizationLegalType[] = [
  "JOINT_STOCK",
  "LIMITED_LIABILITY",
  "PRIVATE_JOINT_STOCK",
  "COOPERATIVE",
  "SOLE_PROPRIETORSHIP",
  "INSTITUTE",
  "OTHER",
];

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const items: Array<{ org: Organization; role: string }> = [];
  const membership = findActiveMembership(auth.ctx.userId);
  if (membership) {
    const org = getOrganizationById(membership.orgId);
    if (org) items.push({ org, role: membership.role });
  }

  return NextResponse.json({ data: { items } });
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

  const name = str(body["name"]);
  if (!name) {
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: "نام شرکت / شخصیت حقوقی الزامی است",
        fieldErrors: [{ path: "name", reason: "نام شرکت الزامی است" }],
      },
      { status: 400 }
    );
  }

  const nationalId = str(body["nationalId"]);
  // Duplicate guard: the same legal entity must not be registered twice.
  if (nationalId) {
    const existing = findOrganizationByNationalId(nationalId);
    if (existing) {
      return NextResponse.json(
        {
          code: "ORGANIZATION_EXISTS",
          message: "این شخصیت حقوقی قبلاً در لیگالیر ثبت شده است",
          fieldErrors: [{ path: "nationalId", reason: "شناسه ملی تکراری است" }],
        },
        { status: 409 }
      );
    }
  }

  const legalTypeRaw = str(body["legalType"]);
  const legalType =
    legalTypeRaw && (LEGAL_TYPES as string[]).includes(legalTypeRaw)
      ? (legalTypeRaw as OrganizationLegalType)
      : null;

  const now = new Date().toISOString();
  const status: OrganizationStatus = "PROFILE_COMPLETE";

  const org: Organization = {
    id: crypto.randomUUID(),
    name,
    tradeName: str(body["tradeName"]),
    legalType,
    nationalId,
    registrationNumber: str(body["registrationNumber"]),
    economicCode: str(body["economicCode"]),
    registrationDate: str(body["registrationDate"]),
    industry: str(body["industry"]),
    province: str(body["province"]),
    city: str(body["city"]),
    address: str(body["address"]),
    postalCode: str(body["postalCode"]),
    phone: str(body["phone"]),
    email: str(body["email"]),
    website: str(body["website"]),
    status,
    ownerUserId: auth.ctx.userId,
    createdByUserId: auth.ctx.userId,
    createdAt: now,
    updatedAt: now,
  };

  const representativeTitle = str(body["representativeTitle"]);
  const { org: created, member } = createOrganizationWithOwner({
    org,
    ownerUserId: auth.ctx.userId,
    representativeTitle,
  });

  // The organization track is complete once the entity exists.
  setOnboardingStatus(auth.ctx.userId, "COMPLETED");

  const user = findUserById(auth.ctx.userId);
  return NextResponse.json(
    {
      data: {
        organization: created,
        membership: { role: member.role, status: member.status },
        onboardingStatus: user?.onboardingStatus ?? "COMPLETED",
      },
    },
    { status: 201 }
  );
}
