// ============================================================
// LEGALIR — GET|PATCH /api/v1/lawyer/profile
// ============================================================
// The professional profile the lawyer may edit themselves. Verification
// status, marketplace visibility, performance and the identity fields an
// operator owns are NOT writable here: only the fields the lawyer is
// responsible for. Every write is audited with a before/after snapshot.
//
// The profile is resolved from the session user id — a caller can only ever
// read or write their own profile.
// ============================================================

import { NextResponse } from "next/server";
import { badRequest, readBody, requireLawyer, str, strOrNull } from "@/lib/lawyer-portal/http";
import { upsertLawyerProfile } from "@/lib/lawyer-db";
import { recordAudit } from "@/lib/admin/audit";
import { profileCompleteness } from "@/lib/lawyer-portal/projections";
import { getBankRecord, listLawyerRates } from "@/lib/lawyer-portal/store";
import type { LawyerLocation, LawyerSpecialty } from "@legalir/types";

function readSpecializations(value: unknown): LawyerSpecialty[] | null {
  if (!Array.isArray(value)) return null;
  const out: LawyerSpecialty[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const category = str((entry as Record<string, unknown>)["category"]);
    if (!category) continue;
    const years = Number((entry as Record<string, unknown>)["yearsExperience"]);
    out.push({ category, yearsExperience: Number.isFinite(years) ? Math.max(0, years) : 0 });
  }
  return out;
}

function readLocations(value: unknown): LawyerLocation[] | null {
  if (!Array.isArray(value)) return null;
  const out: LawyerLocation[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const province = str(rec["province"]);
    const city = str(rec["city"]);
    if (!province && !city) continue;
    out.push({ province, city, remote: rec["remote"] !== false });
  }
  return out;
}

export async function GET(request: Request) {
  const auth = requireLawyer(request, "lawyer:profile:write");
  if (!auth.ok) return auth.response;

  const { profile } = auth.lawyer;
  return NextResponse.json({
    data: {
      profile,
      completeness: profileCompleteness(profile),
      rates: listLawyerRates(profile.id),
      bank: { status: getBankRecord(profile.id).status },
    },
  });
}

export async function PATCH(request: Request) {
  const auth = requireLawyer(request, "lawyer:profile:write");
  if (!auth.ok) return auth.response;

  const body = await readBody(request);
  if (!body) return badRequest("بدنه درخواست نامعتبر است");

  const { profile } = auth.lawyer;
  const patch: Record<string, unknown> = {};

  if (body["fullName"] !== undefined) {
    const fullName = str(body["fullName"]);
    if (fullName.length < 3) return badRequest("نام و نام خانوادگی الزامی است");
    patch["fullName"] = fullName;
  }
  if (body["bio"] !== undefined) patch["bio"] = str(body["bio"]).slice(0, 3000);
  if (body["professionalTitle"] !== undefined) {
    patch["professionalTitle"] = strOrNull(body["professionalTitle"]);
  }
  if (body["licenseNumber"] !== undefined) {
    const licenseNumber = strOrNull(body["licenseNumber"]);
    if (licenseNumber && !/^\d{3,20}$/.test(licenseNumber)) {
      return badRequest("شمارهٔ پروانهٔ وکالت باید فقط رقم باشد");
    }
    patch["licenseNumber"] = licenseNumber;
  }
  if (body["licenseAuthority"] !== undefined) {
    patch["licenseAuthority"] = strOrNull(body["licenseAuthority"]);
  }
  if (body["licenseYear"] !== undefined) {
    const raw = body["licenseYear"];
    const year = raw === null || raw === "" ? null : Number(raw);
    if (year !== null && (!Number.isInteger(year) || year < 1300 || year > 1500)) {
      return badRequest("سال پروانه معتبر نیست");
    }
    patch["licenseYear"] = year;
  }
  if (body["specializations"] !== undefined) {
    const list = readSpecializations(body["specializations"]);
    if (!list) return badRequest("فهرست تخصص‌ها نامعتبر است");
    patch["specializations"] = list;
  }
  if (body["locations"] !== undefined) {
    const list = readLocations(body["locations"]);
    if (!list) return badRequest("فهرست شهر/محدودهٔ خدمات نامعتبر است");
    patch["locations"] = list;
  }
  if (body["acceptingRequests"] !== undefined) {
    patch["acceptingRequests"] = body["acceptingRequests"] === true;
  }
  if (body["acceptingClients"] !== undefined) {
    patch["acceptingClients"] = body["acceptingClients"] === true;
  }
  if (body["avatarUrl"] !== undefined) patch["avatarUrl"] = strOrNull(body["avatarUrl"]);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ data: { profile, completeness: profileCompleteness(profile) } });
  }

  const saved = upsertLawyerProfile({
    ...profile,
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  recordAudit({
    actorUserId: auth.lawyer.ctx.userId,
    actorRole: auth.lawyer.ctx.role,
    orgId: auth.lawyer.ctx.orgId,
    action: "lawyer.profile.update",
    resourceType: "lawyer",
    resourceId: profile.id,
    before: {
      fullName: profile.fullName,
      professionalTitle: profile.professionalTitle,
      licenseNumber: profile.licenseNumber,
      acceptingRequests: profile.acceptingRequests,
    },
    after: {
      fullName: saved.fullName,
      professionalTitle: saved.professionalTitle,
      licenseNumber: saved.licenseNumber,
      acceptingRequests: saved.acceptingRequests,
    },
  });

  return NextResponse.json({ data: { profile: saved, completeness: profileCompleteness(saved) } });
}
