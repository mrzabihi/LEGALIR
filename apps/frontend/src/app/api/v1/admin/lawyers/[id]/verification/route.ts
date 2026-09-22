// ============================================================
// LEGALIR — POST /api/v1/admin/lawyers/[id]/verification
// ============================================================
// Set a lawyer's verification state. Staff-only. The status is validated
// against the known set; the actor is always the session user, never a
// client-supplied id.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { setVerificationStatus } from "@/lib/lawyer-db";
import type { LawyerVerificationStatus } from "@legalir/types";

const VALID_STATUSES: LawyerVerificationStatus[] = [
  "UNVERIFIED",
  "VERIFIED",
  "REJECTED",
  "SUSPENDED",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, "admin:lawyer:verify");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: { status?: string; note?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  if (!body.status || !VALID_STATUSES.includes(body.status as LawyerVerificationStatus)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "وضعیت تأیید معتبر نیست" },
      { status: 400 }
    );
  }

  const updated = setVerificationStatus(
    id,
    body.status as LawyerVerificationStatus,
    body.note ?? null
  );
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: updated.id,
      verificationStatus: updated.verificationStatus,
      verificationNote: updated.verificationNote,
      verifiedAt: updated.verifiedAt,
    },
  });
}
