// ============================================================
// LEGALIR — GET /api/v1/judicial/card
// ============================================================
// Everything the /cases entry card renders, in one authenticated request:
// the admin-managed settings, the caller's EFFECTIVE availability and their
// own open drafting work. Plus the honest capability report.
//
// The card cannot invent availability: when this endpoint says
// `enabled: false`, the card must not render a CTA that the wizard will
// refuse. Hiding the card is a presentation choice; the wizard's own
// routes re-check availability on every call.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { judicialFlagContext } from "@/lib/judicial/context";
import { getJudicialCapabilities, getJudicialCardSummary } from "@/lib/judicial/card";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const ctx = judicialFlagContext({
    userId: auth.ctx.userId,
    orgId: auth.ctx.orgId,
  });
  return NextResponse.json({
    data: {
      summary: getJudicialCardSummary(auth.ctx.userId, ctx),
      capabilities: getJudicialCapabilities(ctx),
    },
  });
}
