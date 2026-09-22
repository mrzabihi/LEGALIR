import { NextResponse } from "next/server";
import { getPreferences, upsertPreferences } from "@/lib/db";
import type { DbPreferences } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/api/server-auth";

const PRIVACY_KEYS = [
  "shareUsageData",
  "allowAiTraining",
  "storeConversationHistory",
  "autoMemoryConsent",
] as const;

/**
 * GET /api/v1/settings/privacy
 * The user's privacy preferences. Stored on the shared preferences record
 * (single source of truth) but exposed as its own resource.
 */
export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }
  return NextResponse.json({ data: getPreferences(userId).privacy });
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
  const updates: Partial<DbPreferences["privacy"]> = {};
  for (const key of PRIVACY_KEYS) {
    if (typeof body[key] === "boolean") updates[key] = body[key] as boolean;
  }

  // deepMerge inside upsertPreferences applies only the provided keys.
  const prefs = upsertPreferences(userId, {
    privacy: updates as DbPreferences["privacy"],
  });
  return NextResponse.json({ data: prefs.privacy });
}
