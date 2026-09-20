import { NextResponse } from "next/server";
import { deriveNotifications, markNotificationRead } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/api/server-auth";

/**
 * POST /api/v1/notifications/:id/read
 * Marks a single notification read. The id is the stable derived id
 * (e.g. `points:<ledgerId>`), so it survives across requests.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const notificationId = decodeURIComponent(id);
  markNotificationRead(userId, notificationId);

  const items = deriveNotifications(userId);
  const unreadCount = items.filter((n) => !n.read).length;
  return NextResponse.json({ data: { items, unreadCount } });
}
