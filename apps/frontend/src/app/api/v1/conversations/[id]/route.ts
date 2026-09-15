import { NextResponse } from 'next/server';
import {
  findSessionById,
  readConversations,
  writeConversations,
  removeActivity,
} from '@/lib/db';
import { getMessages, deleteMessages } from '@/lib/ai/store';

function getUser(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUser(request);
  if (!userId) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' }, { status: 401 });
  }

  const { id } = await params;
  const all = readConversations();
  const conv = all.find(c => c.id === id && c.userId === userId);
  if (!conv) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'گفتگو یافت نشد' }, { status: 404 });
  }

  // Hydrate persisted messages from the AI gateway store.
  const messages = getMessages(id);
  return NextResponse.json({ data: { ...conv, messages, aiRuns: [], references: [] } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUser(request);
  if (!userId) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' }, { status: 401 });
  }

  const { id } = await params;
  const all = readConversations();
  const idx = all.findIndex(c => c.id === id && c.userId === userId);
  if (idx === -1) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'گفتگو یافت نشد' }, { status: 404 });
  }

  const body = await request.json();
  const { title, status: newStatus } = body as { title?: string; status?: string };

  const conv = all[idx]!;
  if (title !== undefined) conv.title = title;
  if (newStatus !== undefined) conv.status = newStatus;
  conv.updatedAt = new Date().toISOString();

  writeConversations(all);

  return NextResponse.json({ data: all[idx] });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUser(request);
  if (!userId) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' }, { status: 401 });
  }

  const { id } = await params;
  const all = readConversations();
  const idx = all.findIndex(c => c.id === id && c.userId === userId);
  if (idx === -1) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'گفتگو یافت نشد' }, { status: 404 });
  }

  // Remove the conversation, its persisted messages, and its history row.
  all.splice(idx, 1);
  writeConversations(all);
  deleteMessages(id);
  removeActivity(userId, id);

  return NextResponse.json({ data: { deleted: true as const } });
}
