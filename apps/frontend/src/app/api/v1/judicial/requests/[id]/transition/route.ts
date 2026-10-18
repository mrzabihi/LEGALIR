// ============================================================
// LEGALIR — POST /api/v1/judicial/requests/[id]/transition
// ============================================================
// The ONLY route through which the owner may move a request by asking for a
// status. The move is validated against JUDICIAL_TRANSITIONS and anything not
// listed is rejected with 409 — the client can request a move, never force one.
//
// `generating`, `draft_ready` and `approved` are NOT reachable here:
//   • `generating`/`draft_ready` belong to the generation route;
//   • `approved` belongs to the explicit draft-approval route.
// A request that could be walked into approval with a bare PATCH would defeat
// the whole review step, so that is refused rather than merely hidden.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { transitionRequest } from "@/lib/judicial/workflow";
import { JUDICIAL_REQUEST_STATUS_FA } from "@legalir/types";
import type { JudicialRequestStatus } from "@legalir/types";

interface Params {
  params: Promise<{ id: string }>;
}

function isStatus(value: unknown): value is JudicialRequestStatus {
  return typeof value === "string" && value in JUDICIAL_REQUEST_STATUS_FA;
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: { to?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنهٔ درخواست نامعتبر است." },
      { status: 400 }
    );
  }

  if (!isStatus(body.to)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "وضعیت مقصد معتبر نیست." },
      { status: 400 }
    );
  }

  const result = transitionRequest(auth.ctx.userId, id, body.to);

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "درخواست یافت نشد." },
        { status: 404 }
      );
    }
    if (result.code === "APPROVAL_REQUIRES_DRAFT") {
      return NextResponse.json(
        {
          code: "APPROVAL_REQUIRES_DRAFT",
          message:
            "تأیید نهایی فقط پس از تأیید صریح یک پیش‌نویس یا سند آماده امکان‌پذیر است.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        code: "ILLEGAL_TRANSITION",
        message: "این تغییر وضعیت برای درخواست در وضعیت فعلی مجاز نیست.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ data: { request: result.request } });
}
