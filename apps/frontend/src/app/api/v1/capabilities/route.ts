// ============================================================
// LEGALIR — GET /api/v1/capabilities
// ============================================================
// The consumer-facing view of the admin-managed feature flags. It reuses the
// EXACT flag engine the admin panel writes to (`lib/admin/flags`) and evaluates
// each flag for the caller's plan, so a service an operator switched off in
// /admin/services is never offered in the app.
//
// It is a read-only projection: no flag is written here, and the value carries
// no secret — only the capability key, its Persian name and the boolean the UI
// needs. The server still authorizes every action independently; this endpoint
// only tells the UI what to render.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getUsageSummary } from "@/lib/usage/engine";
import { currentEnvironment, isFlagEnabled, listFlags } from "@/lib/admin/flags";
import type { V1CapabilitiesResponse } from "@legalir/types";

/**
 * A stable 0–99 bucket for the caller, so a "limited" rollout treats the same
 * user consistently across requests (rather than everyone landing in bucket 0
 * and a 30% rollout meaning "everyone"). A tiny FNV-style hash — no storage,
 * no secret.
 */
function rolloutBucket(userId: string): number {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 100;
}

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const env = currentEnvironment();
  const summary = getUsageSummary(userId);
  const planCode = summary.planCode ?? "free";
  const bucket = rolloutBucket(userId);

  const capabilities = listFlags().map((flag) => ({
    key: flag.key,
    nameFa: flag.nameFa,
    status: flag.status,
    enabled: isFlagEnabled(flag.key, { env, planCode, bucket }),
  }));

  const body: V1CapabilitiesResponse = { capabilities, environment: env };
  return NextResponse.json({ data: body });
}
