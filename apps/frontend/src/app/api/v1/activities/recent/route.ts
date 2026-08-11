import { NextResponse } from "next/server";
import { findSessionById, queryRecentActivity } from "@/lib/db";

function getUserFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

export async function GET(request: Request) {
  const userId = getUserFromCookie(request);
  if (!userId) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') ?? '10', 10);

  const items = queryRecentActivity(userId, limit);

  return NextResponse.json({
    data: {
      items: items.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        status: a.status,
        updatedAt: a.updated_at,
      })),
      pagination: { page: 1, pageSize: limit, total: items.length, totalPages: 1 },
    },
  });
}
