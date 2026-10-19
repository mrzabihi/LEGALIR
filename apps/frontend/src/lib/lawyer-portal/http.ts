// ============================================================
// LEGALIR — Lawyer portal route helpers (server-only)
// ============================================================
// One authorization shape for every /api/v1/lawyer route:
//   1. the caller must be authenticated,
//   2. the caller must hold the requested permission,
//   3. the caller must own a lawyer profile.
//
// The profile is resolved from the SESSION user id. No route ever accepts a
// lawyer id from the request body or query string, so a caller cannot pick
// whose referrals to read.
// ============================================================

import { NextResponse } from "next/server";
import type { LawyerProfile, Permission } from "@legalir/types";
import { requirePermission, forbidden, notFound, type AuthContext } from "../rbac";
import { getLawyerProfileByUserId } from "../lawyer-db";
import type { CommandActor, CommandResult } from "./store";

export interface LawyerContext {
  ctx: AuthContext;
  profile: LawyerProfile;
  actor: CommandActor;
}

export type LawyerAuthResult =
  | { ok: true; lawyer: LawyerContext }
  | { ok: false; response: NextResponse };

export function requireLawyer(
  request: Request,
  permission: Permission = "lawyer:request:read:assigned"
): LawyerAuthResult {
  const auth = requirePermission(request, permission);
  if (!auth.ok) return auth;

  const profile = getLawyerProfileByUserId(auth.ctx.userId);
  if (!profile) {
    // A non-lawyer calling the lawyer API is a role problem, not a missing
    // resource: 403 keeps the boundary explicit.
    return { ok: false, response: forbidden("این بخش فقط برای حساب وکیل است") };
  }

  return {
    ok: true,
    lawyer: {
      ctx: auth.ctx,
      profile,
      actor: { userId: auth.ctx.userId, role: auth.ctx.role },
    },
  };
}

export function badRequest(message: string, code = "VALIDATION_ERROR"): NextResponse {
  return NextResponse.json({ code, message }, { status: 400 });
}

export function conflict(message: string): NextResponse {
  return NextResponse.json({ code: "ILLEGAL_STATE", message }, { status: 409 });
}

/** Map a store failure onto the response shape the rest of the app uses. */
export function commandError(result: Extract<CommandResult, { ok: false }>): NextResponse {
  switch (result.reason) {
    case "not_found":
      return notFound(result.messageFa);
    case "forbidden":
      return forbidden(result.messageFa);
    case "illegal_state":
      return conflict(result.messageFa);
    case "invalid_input":
      return badRequest(result.messageFa);
    case "conflict":
      return conflict(result.messageFa);
  }
}

/** Read a JSON body, returning null rather than throwing on malformed input. */
export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function strOrNull(value: unknown): string | null {
  const s = str(value);
  return s.length > 0 ? s : null;
}

export function intOr(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return fallback;
}
