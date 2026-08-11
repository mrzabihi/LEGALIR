import { NextResponse } from "next/server";
import { findSessionById, querySubscriptionHistory } from "@/lib/db";

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
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);

  const allItems = querySubscriptionHistory(userId);
  const total = allItems.length;
  const paged = allItems.slice((page - 1) * pageSize, page * pageSize);

  return NextResponse.json({
    data: {
      items: paged,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    },
  });
}
