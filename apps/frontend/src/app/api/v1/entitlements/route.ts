import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { getUsageSummary } from "@/lib/usage/engine";
import { entitlementsFromSummary } from "@/lib/usage/views";

function getUserIdFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

export async function GET(request: Request) {
  const userId = getUserIdFromCookie(request);
  if (!userId) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' },
      { status: 401 }
    );
  }

  // Entitlements are projected from the usage engine — the single source of
  // truth (frozen plan snapshot → period quotas + today's daily credit).
  const summary = getUsageSummary(userId);

  return NextResponse.json({
    data: {
      entitlements: entitlementsFromSummary(summary),
      planCode: summary.planCode ?? "free",
      planNameFa: summary.planNameFa ?? "رایگان",
    },
  });
}
