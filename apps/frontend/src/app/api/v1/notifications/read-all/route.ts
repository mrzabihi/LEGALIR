import { NextResponse } from "next/server";
import { deriveNotifications, markAllNotificationsRead } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/api/server-auth";

/**
 * POST /api/v1/notifications/read-all
 * Marks every currently-derived notification read and returns the fresh
 * feed so the client can reconcile in one round-trip.
 */
export async function POST(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  markAllNotificationsRead(userId);
  const items = deriveNotifications(userId);
  return NextResponse.json({ data: { items, unreadCount: 0 } });
}
