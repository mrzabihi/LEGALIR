// ============================================================
// LEGALIR — GET /api/v1/energy/ledger
// ============================================================
// The signed-in user's unified energy ledger (subscription credit + reward
// points + consumption) with running balances. Read-only projection.

import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { getEnergyLedger } from "@/lib/energy/ledger";

function getUserIdFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

export async function GET(request: Request) {
  const userId = getUserIdFromCookie(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید", correlationId: crypto.randomUUID(), retryable: false },
      { status: 401 }
    );
  }
  const ledger = getEnergyLedger(userId);
  return NextResponse.json({ data: ledger });
}
