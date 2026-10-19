// ============================================================
// LEGALIR — GET /api/v1/subscription/usage/cards
// ============================================================
// One banner per ACTIVE subscription of the signed-in user, carrying that
// subscription's REAL consumption from the same ledger the usage page and the
// admin tab read. No quota is invented: `energyQuota` stays null because the
// plan model defines daily request / token quotas, not a per-subscription
// energy cap.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { readTable } from "@/lib/db";
import { buildSubscriptionUsageCard } from "@/lib/usage/report";
import type { StoredSubscription, SubscriptionUsageCard } from "@legalir/types";

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const now = Date.now();
  const active = readTable<StoredSubscription>("subscriptions")
    .filter(
      (s) =>
        s.user_id === userId &&
        s.status === "active" &&
        new Date(s.end_at).getTime() > now
    )
    .sort((a, b) => b.start_at.localeCompare(a.start_at));

  const items: SubscriptionUsageCard[] = active.map((s) =>
    buildSubscriptionUsageCard({
      id: s.id,
      plan_name_fa: s.plan_name_fa,
      status: s.status,
      start_at: s.start_at,
      end_at: s.end_at,
    })
  );

  return NextResponse.json({ data: { items } });
}
