import { NextResponse } from 'next/server';
import { findSessionById } from '@/lib/db';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), '.data');

interface StoredConversation {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  status: string;
  riskLevel: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

function readConversations(): StoredConversation[] {
  const file = path.join(DATA_DIR, 'conversations.json');
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return []; }
}

function writeConversations(data: StoredConversation[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'conversations.json'), JSON.stringify(data, null, 2), 'utf-8');
}

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

  return NextResponse.json({ data: conv });
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
