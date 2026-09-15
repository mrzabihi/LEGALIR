import { NextResponse } from 'next/server';
import { findSessionById, getPreferences, upsertPreferences } from '@/lib/db';
import type { DbPreferences } from '@/lib/db';

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

  const preferences = getPreferences(userId);
  return NextResponse.json({ data: preferences });
}

export async function PATCH(request: Request) {
  const userId = getUserFromCookie(request);
  if (!userId) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { theme, locale, notifications, privacy, showProfileCompletionPrompt } = body as {
    theme?: string;
    locale?: string;
    notifications?: Partial<DbPreferences['notifications']>;
    privacy?: Partial<DbPreferences['privacy']>;
    showProfileCompletionPrompt?: boolean;
  };

  const updates: Record<string, unknown> = {};
  if (theme !== undefined) updates['theme'] = theme;
  if (locale !== undefined) updates['locale'] = locale;
  if (notifications !== undefined) updates['notifications'] = notifications;
  if (privacy !== undefined) updates['privacy'] = privacy;
  if (showProfileCompletionPrompt !== undefined) updates['showProfileCompletionPrompt'] = showProfileCompletionPrompt;

  const preferences = upsertPreferences(userId, updates as Partial<Omit<DbPreferences, 'user_id'>>);
  return NextResponse.json({ data: preferences });
}
