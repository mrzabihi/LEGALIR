// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/sign  (owner session)
// ============================================================
// POST — the OWNER-side signature workflow. This route only resolves
// the session + contract and delegates to the shared workflow module,
// so the same code path serves both here and the public token-scoped
// invitation route (`/contract-invitations/[token]`).
//
// Actions (see `@/lib/contracts/signature/workflow`):
//   create_request  freeze the current version and open a request
//   request_otp     send a one-time code to a participant's mobile
//   verify_otp      verify the code and record the signature
//   record_physical record a wet-ink signature with its scanned proof
//   decline         record a participant's refusal
//
// LEGAL NOTE: this is «تأیید و امضای الکترونیکی» — never «امضای
// الکترونیکی مطمئن» or «امضای دیجیتال رسمی».
// ============================================================

import {
  badRequest,
  conflict,
  isErrorResponse,
  requireContract,
} from "@/lib/contracts/api-helpers";
import {
  createSignatureRequest,
  declineForParticipant,
  recordPhysicalForParticipant,
  requestOtpForParticipant,
  verifyOtpForParticipant,
  type SignBody,
  type SignContext,
} from "@/lib/contracts/signature/workflow";
import { clientFingerprintFrom } from "@/lib/contracts/signature/fingerprint";
import { isContractFeatureEnabled } from "@/lib/contracts/feature-flags";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;

  if (!isContractFeatureEnabled("CONTRACT_SIGNING_ENABLED")) {
    return conflict("امضای الکترونیکی در حال حاضر فعال نیست.", "FEATURE_DISABLED");
  }

  // A coarse, non-identifying fingerprint is stamped on every event this
  // caller produces, so the audit trail can distinguish clients without
  // ever storing the raw IP (§9).
  const signCtx: SignContext = {
    contract,
    actor: { userId, actorLabel: "کاربر" },
    ownerId: userId,
    fingerprint: clientFingerprintFrom(request),
  };

  // Physical (wet-ink) signing uploads the signed scan itself, so it
  // arrives as multipart; every other action is a small JSON body.
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return badRequest("اطلاعات ارسالی نامعتبر است");
    }
    return recordPhysicalForParticipant(signCtx, form);
  }

  let body: SignBody;
  try {
    body = (await request.json()) as SignBody;
  } catch {
    return badRequest("اطلاعات ارسالی نامعتبر است");
  }

  switch (body.action) {
    case "create_request":
      return createSignatureRequest(signCtx, body);
    case "request_otp":
      return await requestOtpForParticipant(signCtx, body);
    case "verify_otp":
      return verifyOtpForParticipant(signCtx, body);
    case "decline":
      return declineForParticipant(signCtx, body);
    default:
      return badRequest("عملیات درخواستی معتبر نیست", "INVALID_ACTION");
  }
}
