// ============================================================
// LEGALIR — POST /api/v1/judicial/requests/[id]/draft
// ============================================================
// The ONLY route that produces a draft version.
//
// It refuses with the follow-up questions (409 INCOMPLETE_INPUTS) until the
// required facts exist — a draft is never assembled around invented values.
// It is idempotent on the INPUT HASH: the same inputs return the same version
// and cost nothing, so a refresh or double-click cannot create a second
// version or a second charge.
//
// Charging happens in `lib/judicial/generate` through the Entitlement & Usage
// Engine; this route only maps the outcome to HTTP. A refusal at any stage
// leaves the stored request and its earlier drafts untouched.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { judicialFlagContext } from "@/lib/judicial/context";
import { isJudicialServiceEnterable } from "@/lib/judicial/service-config";
import { generateDraft } from "@/lib/judicial/generate";
import { getOwnedRequest, serviceIdForType } from "@/lib/judicial/db";
import { getUsageSummary } from "@/lib/usage/engine";
import type { JudicialGenerateDraftInput } from "@legalir/types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const userId = auth.ctx.userId;

  const { id } = await params;

  let body: Partial<JudicialGenerateDraftInput> = {};
  try {
    body = (await req.json()) as Partial<JudicialGenerateDraftInput>;
  } catch {
    // An absent/blank body is fine — the route is safe to call without one.
  }
  const idempotencyKey = (
    body.idempotencyKey?.trim() ||
    req.headers.get("Idempotency-Key")?.trim() ||
    ""
  ).slice(0, 120);
  if (!idempotencyKey) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "شناسهٔ یکتای درخواست ارسال نشده است." },
      { status: 400 }
    );
  }

  // Ownership first — a foreign id is a 404 before anything else is revealed.
  const request = getOwnedRequest(userId, id);
  if (!request) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست یافت نشد." },
      { status: 404 }
    );
  }

  // Availability is re-checked here, not inherited from the page that linked
  // in: disabling the service takes effect on the very next call.
  const serviceId = request.documentType
    ? serviceIdForType(request.documentType)
    : request.serviceId;
  const ctx = judicialFlagContext({ userId, orgId: auth.ctx.orgId });
  if (!isJudicialServiceEnterable(serviceId, ctx)) {
    return NextResponse.json(
      {
        code: "SERVICE_UNAVAILABLE",
        message: "این خدمت در حال حاضر برای حساب شما فعال نیست.",
      },
      { status: 403 }
    );
  }

  const outcome = await generateDraft({ userId, requestId: id, idempotencyKey });
  if (outcome.ok) {
    return NextResponse.json(
      {
        data: {
          draft: outcome.draft,
          replayed: outcome.replayed,
          completeness: outcome.completeness,
        },
      },
      { status: outcome.replayed ? 200 : 201 }
    );
  }

  switch (outcome.code) {
    case "NOT_FOUND":
      return NextResponse.json(
        { code: "NOT_FOUND", message: outcome.messageFa },
        { status: 404 }
      );
    case "USAGE_DENIED":
      // The engine's own Persian message is preserved, plus the live usage
      // summary so the UI can show the limit and the way out.
      return NextResponse.json(
        {
          code: "QUOTA_EXHAUSTED",
          message: outcome.messageFa,
          usage: getUsageSummary(userId),
        },
        { status: 429 }
      );
    case "INCOMPLETE_INPUTS":
      return NextResponse.json(
        {
          code: "INCOMPLETE_INPUTS",
          message: outcome.messageFa,
          completeness: outcome.completeness ?? null,
          missing: outcome.missing ?? [],
        },
        { status: 409 }
      );
    default:
      return NextResponse.json(
        { code: outcome.code, message: outcome.messageFa },
        { status: 409 }
      );
  }
}
