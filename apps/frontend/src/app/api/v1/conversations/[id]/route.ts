import { NextResponse } from 'next/server';
import {
  findSessionById,
  readConversations,
  writeConversations,
  removeActivity,
} from '@/lib/db';
import { getMessages, deleteMessages } from '@/lib/ai/store';
import { getAttachmentRefsByMessage, deleteConversationAttachments } from '@/lib/ai/attachments';
import { getLatestRunForConversation, toRunView } from '@/lib/ai/pipeline/run';

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

  // Hydrate persisted messages from the AI gateway store, decorating each
  // with the documents the user attached to it (references only).
  const attachmentsByMessage = getAttachmentRefsByMessage(id);
  const messages = getMessages(id).map((m) => ({
    ...m,
    attachments: attachmentsByMessage[m.id] ?? [],
  }));

  // The most recent processing run, projected to its user-safe view, so the
  // progress timeline survives a refresh (§37) and a WAITING_FOR_USER state
  // can be restored (§43).
  const latestRun = getLatestRunForConversation(id);
  const processingRun = latestRun ? toRunView(latestRun) : null;

  return NextResponse.json({
    data: { ...conv, messages, aiRuns: [], references: [], processingRun },
  });
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
  deleteConversationAttachments(id);
  removeActivity(userId, id);

  return NextResponse.json({ data: { deleted: true as const } });
}
