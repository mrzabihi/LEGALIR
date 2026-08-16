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

  return NextResponse.json({ data: conv, meta: { requestId: crypto.randomUUID() } }, { status: 201 });
}
