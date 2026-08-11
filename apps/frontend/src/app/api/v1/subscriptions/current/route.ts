import { NextResponse } from "next/server";
import { findSessionById, queryActiveSubscription } from "@/lib/db";

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

  const subscription = queryActiveSubscription(userId);
  if (!subscription) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({
    data: {
      id: subscription.id,
      userId,
      planId: `plan-${subscription.planCode}`,
      planCode: subscription.planCode,
      planNameFa: subscription.planNameFa,
      startAt: subscription.startAt,
      endAt: subscription.endAt,
      status: subscription.status,
      autoRenew: subscription.autoRenew,
      cancelledAt: null,
    },
  });
}
