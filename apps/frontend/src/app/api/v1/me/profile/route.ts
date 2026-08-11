import { NextResponse } from 'next/server';
import { findSessionById, upsertProfile, updateUserDisplayName, getProfile } from '@/lib/db';

function getUserFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

export async function PATCH(request: Request) {
  const userId = getUserFromCookie(request);
  if (!userId) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const displayName = body["displayName"] as string | undefined;
  if (displayName !== undefined) {
    updateUserDisplayName(userId, displayName);
  }

  // Build updates object — only include keys present in the request body,
  // so undefined values don't overwrite existing data in the DB.
  const knownFields = ["displayName", "city", "occupation", "avatarUrl", "email", "birthDate", "gender"] as const;
  const updates: Record<string, unknown> = {};
  for (const field of knownFields) {
    if (field in body) updates[field] = body[field] ?? null;
  }

  // Upsert first, then compute completion from the MERGED profile
  // (not just the current PATCH body) to avoid resetting to 25%
  // after each single-field edit.
  upsertProfile(userId, updates);

  // Re-read the fully merged profile to compute correct completion
  const merged = getProfile(userId);
  let completionPercent = 0;
  if (merged.displayName || displayName) completionPercent += 25;
  if (merged.city) completionPercent += 25;
  if (merged.occupation) completionPercent += 25;
  if (merged.avatarUrl) completionPercent += 25;

  // Save the corrected completion percent
  const profile = upsertProfile(userId, { completionPercent });

  return NextResponse.json({ data: profile });
}
