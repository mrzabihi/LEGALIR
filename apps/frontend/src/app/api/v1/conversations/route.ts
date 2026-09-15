import { NextResponse } from 'next/server';
import {
  findSessionById,
  readConversations,
  writeConversations,
  recordActivity,
  type StoredConversation,
} from '@/lib/db';

function getUser(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

export async function GET(request: Request) {
  const userId = getUser(request);
  if (!userId) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' }, { status: 401 });
  }

  const url = new URL(request.url);
  const pageSize = parseInt(url.searchParams.get('pageSize') ?? '50');

  const all = readConversations()
    .filter(c => c.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, pageSize);

  return NextResponse.json({
    data: all,
    meta: { requestId: crypto.randomUUID() },
  });
}

export async function POST(request: Request) {
  const userId = getUser(request);
  if (!userId) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' }, { status: 401 });
  }

  const body = await request.json();
  const { title, category } = body as { title?: string; category?: string };

  if (!title || !title.trim()) {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'عنوان گفتگو الزامی است' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const conv: StoredConversation = {
    id: crypto.randomUUID(),
    userId,
    title: title.trim(),
    category: category ?? null,
    status: 'active',
    riskLevel: null,
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const all = readConversations();
  all.push(conv);
  writeConversations(all);

  // Record the new conversation in the durable activity log.
  recordActivity({
    userId,
    type: "conversation",
    title: conv.title,
    status: "active",
    statusFa: "فعال",
    description: null,
    category: conv.category,
    categoryFa: null,
    sourceId: conv.id,
  });

  return NextResponse.json({ data: conv, meta: { requestId: crypto.randomUUID() } }, { status: 201 });
}
