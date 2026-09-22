import { NextResponse } from "next/server";
import { deriveNotifications } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/api/server-auth";

/**
 * GET /api/v1/notifications
 * The canonical notification feed plus its unread count. Both come from
 * the same derivation, so the badge can never disagree with the list.
 */
export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const items = deriveNotifications(userId);
  const unreadCount = items.filter((n) => !n.read).length;
  return NextResponse.json({ data: { items, unreadCount } });
}
