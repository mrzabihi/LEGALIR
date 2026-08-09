// ============================================================
// LEGALIR — POST /api/auth/otp/verify
// Verifies 6-digit code against hardcoded '405405'
// Creates user on first login, creates session on success
// ============================================================

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findUserByMobile, createUser, createSession, cleanupExpiredSessions } from '@/lib/db';

const OTP_CODE = '405405';
const MAX_ATTEMPTS = 5;

interface OtpChallenge {
  challengeId: string;
  mobile: string;
  code: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

const globalKey = Symbol.for('legalir.otp.challenges');
const challenges = ((globalThis as any)[globalKey] ?? ((globalThis as any)[globalKey] = new Map<string, OtpChallenge>())) as Map<string, OtpChallenge>;

export async function POST(request: Request) {
  try {
    cleanupExpiredSessions();
    const body = await request.json();
    const { challengeId, code } = body as { challengeId?: string; code?: string };

    if (!challengeId || typeof challengeId !== 'string') {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'شناسه درخواست نامعتبر است', retryable: false },
        { status: 400 }
      );
    }

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'کد تأیید باید ۶ رقم باشد', retryable: false },
        { status: 400 }
      );
    }

    const challenge = challenges.get(challengeId);
    if (!challenge) {
      return NextResponse.json(
        { code: 'CHALLENGE_NOT_FOUND', message: 'درخواست تأیید یافت نشد', retryable: false },
        { status: 404 }
      );
    }

    if (Date.now() > challenge.expiresAt) {
      challenges.delete(challengeId);
      return NextResponse.json(
        { code: 'OTP_EXPIRED', message: 'کد تأیید منقضی شده است', retryable: false },
        { status: 410 }
      );
    }

    challenge.attempts += 1;
    if (challenge.attempts > MAX_ATTEMPTS) {
      challenges.delete(challengeId);
      return NextResponse.json(
        { code: 'TOO_MANY_ATTEMPTS', message: 'تعداد تلاش‌ها بیش از حد مجاز است', retryable: false },
        { status: 429 }
      );
    }

    if (code !== OTP_CODE && code !== challenge.code) {
      return NextResponse.json(
        { code: 'OTP_INVALID', message: 'کد وارد شده صحیح نیست', retryable: true },
        { status: 401 }
      );
    }

    challenges.delete(challengeId);

    let user = findUserByMobile(challenge.mobile);
    let isNewUser = false;

    if (!user) {
      const hash = await bcrypt.hash(crypto.randomUUID(), 10);
      user = createUser({ mobile: challenge.mobile, passwordHash: hash });
      isNewUser = true;
    }

    const session = createSession(user.id);

    const response = NextResponse.json({
      data: {
        sessionId: session.id,
        userId: user.id,
        isNewUser,
        user: {
          id: user.id,
          mobileE164: '+98' + user.mobile.slice(1),
          mobileDisplay: user.mobile,
          status: 'active',
        },
        mobileE164: '+98' + user.mobile.slice(1),
        mobileDisplay: user.mobile,
      },
      meta: { requestId: crypto.randomUUID() },
    });

    response.cookies.set('legalir-session', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error('[otp/verify]', err);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'خطای داخلی سرور', retryable: true },
      { status: 500 }
    );
  }
}
