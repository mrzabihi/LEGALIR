// ============================================================
// LEGALIR — /api/v1/legal-requests
// ============================================================
// GET  — list the caller's legal requests.
// POST — create a request.
//
// Two creation modes:
//   · No lawyer chosen → DRAFT (the AI-intake path, unchanged).
//   · A lawyer chosen  → WAITING_FOR_ACCEPTANCE, because the client has
//     already made the routing decision. The lawyer must be VERIFIED and
//     accepting requests; a request is never created against a lawyer who
//     cannot receive it.
//
// Authorization: the user id comes from the session. A request is only
// ever listed/created for its owner.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { listRequestsForUser, createRequest } from "@/lib/legal-request-db";
import { getLawyerProfileById } from "@/lib/lawyer-db";
import { isSupportedCategory } from "@/lib/intake-schemas";
import { runIdempotent } from "@/lib/api/idempotency-store";
import type { LegalRequest } from "@legalir/types";

type ErrorPayload = { code: string; message: string };

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: listRequestsForUser(auth.ctx.userId) });
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  let raw: {
    title?: string;
    category?: string;
    intakeAnswers?: Record<string, string>;
    selectedLawyerId?: string | null;
    attachmentDocumentIds?: string[];
  };
  try {
    raw = (await request.json()) as typeof raw;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  // Idempotency: a double-click / retry / refresh must never mint a second
  // request. The first successful response is memoized under the client's
  // Idempotency-Key and replayed verbatim on any repeat (see the store).
  const result = await runIdempotent<LegalRequest | ErrorPayload>(
    request,
    "legal-request:create",
    auth.ctx.userId,
    async () => {
      const body = raw;

      if (!body.title?.trim() || !body.category || !isSupportedCategory(body.category)) {
        return {
          status: 400,
          body: { code: "VALIDATION_ERROR", message: "عنوان و دسته‌بندی معتبر الزامی است" } as ErrorPayload,
        };
      }

      // A chosen lawyer must be real, verified, and currently accepting. A
      // request is never created against a lawyer who cannot receive it.
      let selectedLawyerId: string | null = null;
      if (body.selectedLawyerId) {
        const lawyer = getLawyerProfileById(body.selectedLawyerId);
        if (!lawyer || lawyer.verificationStatus !== "VERIFIED" || !lawyer.acceptingRequests) {
          return {
            status: 400,
            body: { code: "VALIDATION_ERROR", message: "وکیل انتخاب‌شده در دسترس نیست" } as ErrorPayload,
          };
        }
        selectedLawyerId = lawyer.id;
      }

      const now = new Date().toISOString();
      const row: LegalRequest = {
        id: crypto.randomUUID(),
        userId: auth.ctx.userId,
        caseId: null,
        conversationId: null,
        title: body.title.trim(),
        category: body.category,
        // With a lawyer chosen the client has already made the routing
        // decision, so the request starts awaiting the lawyer's response.
        // Without one it stays a DRAFT for the AI-intake path.
        state: selectedLawyerId ? "WAITING_FOR_ACCEPTANCE" : "DRAFT",
        intakeAnswers: body.intakeAnswers ?? {},
        analysisId: null,
        selectedLawyerId,
        attachmentDocumentIds: body.attachmentDocumentIds ?? [],
        orgId: auth.ctx.orgId ?? null,
        createdAt: now,
        updatedAt: now,
      };

      return { status: 201, body: createRequest(row) };
    }
  );

  const isError = typeof result.body === "object" && result.body !== null && "code" in result.body;
  return NextResponse.json(isError ? result.body : { data: result.body }, { status: result.status });
}
