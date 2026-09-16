import { NextResponse } from 'next/server';
import { findSessionById, findUserById, getProfile, getPreferences, getAccountType } from '@/lib/db';

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

  const user = findUserById(userId);
  if (!user) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'کاربر یافت نشد' },
      { status: 404 }
    );
  }

  const profile = getProfile(userId);
  const preferences = getPreferences(userId);
  const accountType = getAccountType(userId);

  const data = {
    user: {
      id: user.id,
      mobileE164: `+98${user.mobile.replace(/^0/, '')}`,
      mobileDisplay: user.mobile.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'['0123456789'.indexOf(d)] ?? d),
      status: 'active' as const,
      accountType,
      // Once legal, the account type can never change again.
      accountTypeLocked: accountType === 'legal',
    },
    profile: {
      userId: user.id,
      displayName: profile.displayName ?? user.displayName,
      email: profile.email,
      gender: profile.gender,
      birthDate: profile.birthDate,
      city: profile.city,
      occupation: profile.occupation,
      completionPercent: profile.completionPercent,
      avatarUrl: profile.avatarUrl,
      userType: profile.userType,
      province: profile.province,
      legalInterests: profile.legalInterests,
      primaryUseCase: profile.primaryUseCase,
    },
    preferences,
    role: 'user' as const,
  };

  return NextResponse.json({ data });
}
