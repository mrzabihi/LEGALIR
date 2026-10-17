// ============================================================
// LEGALIR — POST /api/v1/intake/analyze
// ============================================================
// Turns a described legal problem into the structured path analysis behind
// «از کجا شروع کنم؟». It is the server half of the discovery flow: the client
// sends only the user's own words (plus the optional hint picks) and receives
// a validated `LegalRequestDiscovery`.
//
// Guarantees:
//   · Authorization: the caller must be authenticated; the analysis is gated
//     to their plan/org (the model is called only when their AI capability is
//     really enabled — otherwise the deterministic rules run).
//   · The user's text is NEVER lost: an engine error degrades to the rules
//     fallback rather than a 5xx that would strand the description.
//   · It invents nothing: every returned path is clamped to a real, enabled
//     intent (enforced inside the engine/schema).
//
// Stateless: this route persists nothing. The client saves the analysis onto
// the draft request through the legal-requests API.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac";
import { analyzeDiscovery } from "@/lib/intake/discovery-engine";
import { DISCOVERY_MAX_INPUT_CHARS } from "@/lib/intake/discovery";

const intentEnum = z.enum([
  "legal_question",
  "document_review",
  "draft_document",
  "calculation",
  "next_step",
  "lawyer",
]);

const analyzeBodySchema = z.object({
  text: z.string().trim().min(1).max(DISCOVERY_MAX_INPUT_CHARS),
  intent: intentEnum.nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  hasDocument: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const parsed = analyzeBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "شرح مسئله نامعتبر یا خالی است" },
      { status: 400 }
    );
  }

  const body = parsed.data;

  try {
    const analysis = await analyzeDiscovery(
      {
        text: body.text,
        intent: body.intent ?? null,
        category: body.category ?? null,
        hasDocument: body.hasDocument ?? false,
      },
      { userId: auth.ctx.userId, orgId: auth.ctx.orgId }
    );
    return NextResponse.json({ data: analysis });
  } catch {
    // analyzeDiscovery is designed never to throw, but a defensive 5xx must
    // still avoid leaking internals — the client keeps the user's text and
    // offers a retry.
    return NextResponse.json(
      { code: "ANALYSIS_FAILED", message: "تحلیل در دسترس نیست؛ لطفاً دوباره تلاش کنید" },
      { status: 503 }
    );
  }
}
