// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/sign
// ============================================================
// POST — the signature workflow, in two steps:
//
//   request_otp  send a one-time code to the signing party's mobile
//   verify_otp   verify the code and record the signature
//
// A signature is recorded as an approval bound to the CURRENT
// version, with the OTP method, a timestamp and an audit entry. The
// contract moves to PARTIALLY_SIGNED after the first signature and
// to SIGNED once every party has signed.
//
// The demo OTP is 405405 (same as login); requests are rate-limited
// per contract+party so the endpoint cannot be used as an SMS pump.
// ============================================================

import type { ContractApproval, ContractParty, PropertyContract } from "@legalir/types";
import {
  audit,
  badRequest,
  conflict,
  isErrorResponse,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import {
  getVersion,
  insertApproval,
  listApprovals,
  listParties,
  updateContractForUser,
} from "@/lib/contracts/db";
import { assertTransition, IllegalTransitionError, isSignable } from "@/lib/contracts/state-machine";
import { partyRoleLabelFa } from "@/lib/contracts/registry";

type Params = { params: Promise<{ id: string }> };

const DEMO_OTP = "405405";
const OTP_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

interface SignChallenge {
  code: string;
  expiresAt: number;
  attempts: number;
}

const globalKey = Symbol.for("legalir.contract.sign.otp");
type ChallengeMap = Map<string, SignChallenge>;
const globalStore = globalThis as unknown as Record<symbol, ChallengeMap>;
const challenges = globalStore[globalKey] ?? (globalStore[globalKey] = new Map<string, SignChallenge>());

const rateKey = Symbol.for("legalir.contract.sign.rate");
type RateMap = Map<string, number[]>;
const rateStore = globalThis as unknown as Record<symbol, RateMap>;
const rateLog = rateStore[rateKey] ?? (rateStore[rateKey] = new Map<string, number[]>());

interface SignBody {
  action?: "request_otp" | "verify_otp";
  partyId?: string;
  code?: string;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;

  let body: SignBody;
  try {
    body = (await request.json()) as SignBody;
  } catch {
    return badRequest("اطلاعات ارسالی نامعتبر است");
  }

  const parties = listParties(contract.id);
  const party = body.partyId
    ? parties.find((p) => p.id === body.partyId)
    : parties.find((p) => p.isInitiator);
  if (!party) return badRequest("طرف امضاکننده مشخص نیست", "NO_PARTY");

  if (body.action === "request_otp") return requestOtp(contract, party);
  if (body.action === "verify_otp") return verifyOtp(userId, contract, party, body.code ?? "");

  return badRequest("عملیات درخواستی معتبر نیست", "INVALID_ACTION");
}

// ------------------------------------------------------------

function requestOtp(contract: PropertyContract, party: ContractParty) {
  if (!isSignable(contract.state)) {
    return conflict("این قرارداد در وضعیت فعلی قابل امضا نیست.", "NOT_SIGNABLE");
  }
  if (!party.identity.mobile.trim()) {
    return badRequest("شماره موبایل این طرف ثبت نشده است.", "NO_MOBILE");
  }

  const key = `${contract.id}:${party.id}`;
  const now = Date.now();
  const recent = (rateLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    return conflict("تعداد درخواست کد بیش از حد مجاز است. کمی بعد تلاش کنید.", "RATE_LIMITED");
  }
  recent.push(now);
  rateLog.set(key, recent);

  challenges.set(key, { code: DEMO_OTP, expiresAt: now + OTP_TTL_MS, attempts: 0 });

  return ok({
    sent: true,
    mobileMasked: maskMobile(party.identity.mobile),
    expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
  });
}

function verifyOtp(
  userId: string,
  contract: PropertyContract,
  party: ContractParty,
  code: string
) {
  if (!isSignable(contract.state)) {
    return conflict("این قرارداد در وضعیت فعلی قابل امضا نیست.", "NOT_SIGNABLE");
  }
  if (!contract.currentVersionId) {
    return conflict("نسخه‌ای برای امضا وجود ندارد.", "NO_VERSION");
  }

  const key = `${contract.id}:${party.id}`;
  const challenge = challenges.get(key);
  if (!challenge) return badRequest("ابتدا کد تأیید را درخواست کنید.", "NO_CHALLENGE");
  if (Date.now() > challenge.expiresAt) {
    challenges.delete(key);
    return badRequest("کد تأیید منقضی شده است.", "OTP_EXPIRED");
  }

  challenge.attempts += 1;
  if (challenge.attempts > 5) {
    challenges.delete(key);
    return conflict("تعداد تلاش‌ها بیش از حد مجاز است.", "TOO_MANY_ATTEMPTS");
  }
  if (code !== challenge.code) {
    return badRequest("کد وارد شده صحیح نیست.", "OTP_INVALID");
  }
  challenges.delete(key);

  const version = getVersion(contract.id, contract.currentVersionId);
  if (!version) return conflict("نسخه جاری یافت نشد.", "NO_VERSION");

  const existing = listApprovals(contract.id).find(
    (a) => a.partyId === party.id && a.contractVersionId === version.id && a.status === "approved"
  );

  const signature: ContractApproval = {
    id: existing?.id ?? `apr-${crypto.randomUUID()}`,
    contractId: contract.id,
    contractVersionId: version.id,
    partyId: party.id,
    status: "approved",
    comment: "امضا با کد یک‌بارمصرف",
    method: "otp",
    approvedAt: new Date().toISOString(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  insertApproval(signature);

  // Determine the next state from how many parties have SIGNED. An
  // approval is not a signature: only an OTP-verified row counts, so
  // a party who merely approved the version still has to sign it.
  const signedPartyIds = new Set(
    listApprovals(contract.id)
      .filter(
        (a) =>
          a.contractVersionId === version.id &&
          a.status === "approved" &&
          a.method === "otp"
      )
      .map((a) => a.partyId)
  );
  const allSigned = listParties(contract.id).every((p) => signedPartyIds.has(p.id));

  // Signing only ever advances to SIGNED. The move to the
  // registration-policy state (FINALIZED / READY_FOR_OFFICIAL_
  // REGISTRATION) is the finalize step's job — jumping there from
  // READY_TO_SIGN is not a legal transition and would strand the
  // contract.
  let nextState = contract.state;
  if (allSigned) {
    nextState = "SIGNED";
  } else if (contract.state === "READY_TO_SIGN") {
    nextState = "PARTIALLY_SIGNED";
  }

  let updated = contract;
  if (nextState !== contract.state) {
    try {
      assertTransition(contract.state, nextState);
      updated = updateContractForUser(userId, contract.id, { state: nextState }) ?? contract;
    } catch (err) {
      if (!(err instanceof IllegalTransitionError)) throw err;
    }
  }

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: partyRoleLabelFa(party.role),
    action: "contract.signed",
    descriptionFa: `${partyRoleLabelFa(party.role)} قرارداد را امضا کرد (نسخه ${version.versionNumber}).`,
    metadata: {
      versionId: version.id,
      versionNumber: version.versionNumber,
      documentHash: version.documentHash,
      partyId: party.id,
      allSigned,
    },
  });

  return ok({ signature, contract: updated, allSigned });
}

/** Mask a mobile number for display, e.g. 0912***0003. */
function maskMobile(mobile: string): string {
  if (mobile.length < 7) return mobile;
  return `${mobile.slice(0, 4)}***${mobile.slice(-4)}`;
}
