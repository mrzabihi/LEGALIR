import { NextResponse } from "next/server";
import { getPreferences, upsertPreferences } from "@/lib/db";
import type { DbPreferences } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/api/server-auth";

const NOTIFICATION_KEYS = [
  "appointments",
  "contractExpiry",
  "lawyerResponse",
  "paymentStatus",
  "caseUpdate",
  "marketing",
] as const;

/**
 * GET /api/v1/settings/notifications
 * The user's notification preferences. Stored on the shared preferences
 * record (single source of truth) but exposed as its own resource.
 */
export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }
  return NextResponse.json({ data: getPreferences(userId).notifications });
}

export async function PATCH(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Partial<DbPreferences["notifications"]> = {};
  for (const key of NOTIFICATION_KEYS) {
    if (typeof body[key] === "boolean") updates[key] = body[key] as boolean;
  }

  // deepMerge inside upsertPreferences applies only the provided keys.
  const prefs = upsertPreferences(userId, {
    notifications: updates as DbPreferences["notifications"],
  });
  return NextResponse.json({ data: prefs.notifications });
}
