import { NextResponse } from "next/server";
import { findSessionById, queryActiveSubscription } from "@/lib/db";
import { reconcileSubscriptionStatuses } from "@/lib/subscription/lifecycle";

// One-time, idempotent data reconciliation (the §8 migration sweep). Legacy
// stores may hold `active` rows whose `end_at` has passed, or more than one
// `active` row for a user. Running it once per process — here, on the canonical
// subscription read — normalises stored status WITHOUT deleting history, and
// writes only when a row actually changes. The load-bearing guarantee is still
// `queryActiveSubscription` picking the newest active row; this just tidies the
// persisted state so history/status are consistent everywhere.
let reconciled = false;

function reconcileOnce(): void {
  if (reconciled) return;
  reconciled = true;
  try {
    reconcileSubscriptionStatuses();
  } catch {
    // A reconciliation failure must never break a read — fall through to the
    // (already-correct) resolution below.
  }
}

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

  reconcileOnce();

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
