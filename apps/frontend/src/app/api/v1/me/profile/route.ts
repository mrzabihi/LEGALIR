import { NextResponse } from 'next/server';
import { findSessionById, upsertProfile, updateUserDisplayName, getProfile, claimProfileCompletedReward } from '@/lib/db';

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
  const knownFields = [
    "displayName", "city", "occupation", "avatarUrl", "email", "birthDate", "gender",
    "userType", "province", "legalInterests", "primaryUseCase",
  ] as const;
  const updates: Record<string, unknown> = {};
  for (const field of knownFields) {
    if (field in body) updates[field] = body[field] ?? null;
  }

  // Upsert recomputes `completionPercent` from the authoritative domain rules
  // (see src/lib/profile-completion.ts) — single source of truth, no stale 25%.
  const profile = upsertProfile(userId, updates);

  // First time the profile reaches 100%: award the PROFILE_COMPLETED reward.
  // Idempotent — the ledger key `profile-completed:${userId}` prevents double-award.
  if (profile.completionPercent >= 100) {
    claimProfileCompletedReward(userId);
  }

  return NextResponse.json({ data: getProfile(userId) });
}
