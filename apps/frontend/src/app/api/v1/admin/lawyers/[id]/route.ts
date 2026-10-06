// ============================================================
// LEGALIR — GET /api/v1/admin/lawyers/[id]
// ============================================================
// Full registration dossier for a single lawyer, for the admin detail
// drawer. Staff-only (`admin:lawyer:verify`, the same permission that gates
// the queue). Includes contact info (masked mobile + email), licence and
// activity data, specialities, locations, the submitted documents and the
// complete decision history (previous → new, actor, reason, timestamp).
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import {
  getLawyerProfileById,
  listStatusHistory,
  computePerformance,
} from "@/lib/lawyer-db";
import {
  findUserById,
  listMessagesForLawyerProfile,
  normalizeStoredMobile,
} from "@/lib/db";
import { lawyerDecisionBucket } from "@legalir/types";

/** Mask a mobile (first 4 + last 4) — the panel never shows a full number. */
function maskMobile(mobile: string | undefined): string {
  if (!mobile) return "—";
  const m = normalizeStoredMobile(mobile);
  if (m.length <= 8) return "••••";
  return `${m.slice(0, 4)}•••${m.slice(-4)}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, "admin:lawyer:verify");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const profile = getLawyerProfileById(id);
  if (!profile) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  const user = findUserById(profile.userId);
  const history = listStatusHistory(id);
  const messages = listMessagesForLawyerProfile(id);
  const latest = history[0] ?? null;

  return NextResponse.json({
    data: {
      profile: {
        ...profile,
        performance: computePerformance(id),
      },
      contact: {
        mobileMasked: maskMobile(user?.mobile),
        email: user?.email ?? null,
      },
      user: {
        id: profile.userId,
        displayName: user?.displayName ?? null,
        role: user?.role ?? "USER",
        accountType: user?.platformAccountType ?? "PERSONAL",
        createdAt: user?.createdAt ?? profile.createdAt,
      },
      bucket: lawyerDecisionBucket(profile.verificationStatus),
      history,
      lastDecision: latest,
      messages,
      stats: {
        messagesSent: messages.length,
        decisions: history.length,
      },
    },
  });
}
