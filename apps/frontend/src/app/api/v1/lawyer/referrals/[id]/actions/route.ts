// ============================================================
// LEGALIR — POST /api/v1/lawyer/referrals/[id]/actions
// ============================================================
// Every workflow verb in one endpoint, because they share one authorization
// path and one audit shape:
//
//   ACCEPT         WAITING_FOR_ACCEPTANCE → ACCEPTED (creates the Case)
//   DECLINE        WAITING_FOR_ACCEPTANCE → DECLINED (reason required)
//   START          → IN_PROGRESS (resumes a paused clock)
//   REQUEST_INFO   → WAITING_FOR_CLIENT (pauses the clock when the policy says)
//   COMPLETE       → COMPLETED (summary + optional result documents)
//   SEND_MESSAGE   message on the request's own thread
//   ADD_NOTE       public note (mirrored to the client) or internal note
//   RESUME_CLOCK   manual resume of a paused SLA clock
//
// The store verifies the request is assigned to the session's own lawyer
// profile and returns 404 otherwise, so a crafted request id is never
// authorization.
// ============================================================

import { NextResponse } from "next/server";
import {
  badRequest,
  commandError,
  readBody,
  requireLawyer,
  str,
} from "@/lib/lawyer-portal/http";
import {
  acceptRequest,
  addRequestNote,
  completeRequest,
  declineRequest,
  messageClient,
  requestInformation,
  resumeRequestClock,
  startRequest,
  type CommandResult,
} from "@/lib/lawyer-portal/store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireLawyer(request, "lawyer:request:respond");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = await readBody(request);
  if (!body) return badRequest("بدنه درخواست نامعتبر است");

  const action = str(body["action"]).toUpperCase();
  const { profile, actor } = auth.lawyer;
  const base = { requestId: id, lawyerId: profile.id, actor };

  let result: CommandResult;
  switch (action) {
    case "ACCEPT":
      result = acceptRequest(base);
      break;
    case "DECLINE":
      result = declineRequest({ ...base, reason: str(body["reason"]) });
      break;
    case "START":
      result = startRequest({ ...base, note: str(body["note"]) || null });
      break;
    case "REQUEST_INFO":
      result = requestInformation({ ...base, note: str(body["note"]) });
      break;
    case "COMPLETE":
      result = completeRequest({
        ...base,
        summary: str(body["summary"]),
        documentIds: Array.isArray(body["documentIds"])
          ? (body["documentIds"] as unknown[]).filter(
              (v): v is string => typeof v === "string"
            )
          : [],
      });
      break;
    case "SEND_MESSAGE":
      result = messageClient({ ...base, body: str(body["body"]) });
      break;
    case "ADD_NOTE":
      result = addRequestNote({
        ...base,
        note: str(body["note"]),
        internal: body["internal"] === true,
      });
      break;
    case "RESUME_CLOCK":
      result = resumeRequestClock({ ...base, reason: str(body["reason"]) || undefined });
      break;
    default:
      return badRequest("اقدام نامعتبر است");
  }

  if (!result.ok) return commandError(result);

  return NextResponse.json({
    data: {
      requestId: result.request.id,
      state: result.request.state,
      actionId: result.action?.id ?? null,
    },
  });
}
