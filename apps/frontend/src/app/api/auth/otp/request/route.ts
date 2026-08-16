// ============================================================
// LEGALIR — POST /api/auth/otp/request
// Accepts: { mobile: string }
// Hardcoded OTP code: 405405 (development)
// ============================================================

import { NextResponse } from 'next/server';

const OTP_CODE = '405405';
const OTP_TTL_MS = 120_000;
const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 60;

interface OtpChallenge {
  challengeId: string;
  mobile: string;
  code: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

const globalKey = Symbol.for('legalir.otp.challenges');
type OtpChallengeMap = Map<string, OtpChallenge>;
const globalStore = globalThis as unknown as Record<symbol, OtpChallengeMap>;
const challenges = globalStore[globalKey] ?? (globalStore[globalKey] = new Map<string, OtpChallenge>());

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;
const MAX_REQUESTS_PER_WINDOW = 3;

function isRateLimited(mobile: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(mobile) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  rateLimitMap.set(mobile, recent);
  return recent.length >= MAX_REQUESTS_PER_WINDOW;
}

function recordRequest(mobile: string): void {
  const timestamps = rateLimitMap.get(mobile) ?? [];
  timestamps.push(Date.now());
  rateLimitMap.set(mobile, timestamps);
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [id, challenge] of challenges) {
    if (now > challenge.expiresAt) challenges.delete(id);
  }
}

export async function POST(request: Request) {
  try {
    cleanupExpired();
    const body = await request.json();
    const { mobile } = body as { mobile?: string };

    if (!mobile || !/^09\d{9}$/.test(mobile)) {
      return NextResponse.json(
        { code: 'INVALID_MOBILE', message: 'شماره موبایل معتبر نیست', retryable: false },
        { status: 400 }
      );
    }

    if (isRateLimited(mobile)) {
      return NextResponse.json(
        { code: 'RATE_LIMITED', message: 'تعداد درخواست‌ها بیش از حد مجاز است', retryable: true },
        { status: 429 }
      );
    }

    recordRequest(mobile);

    const challengeId = crypto.randomUUID();
    const now = Date.now();

    challenges.set(challengeId, {
      challengeId, mobile, code: OTP_CODE,
      expiresAt: now + OTP_TTL_MS, attempts: 0, createdAt: now,
    });

    return NextResponse.json({
      data: {
        challengeId,
        expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
        remainingAttempts: MAX_ATTEMPTS,
        resendCooldownSeconds: COOLDOWN_SECONDS,
      },
    });
  } catch (err) {
    console.error('[otp/request]', err);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'خطای داخلی سرور', retryable: true },
      { status: 500 }
    );
  }
}
