// ============================================================
// LEGALIR — POST /api/auth/register
// ============================================================
// Accepts: { mobile: string, email?: string, password: string }
// Returns: { user, sessionId } with session cookie set
// ============================================================

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  findUserByMobile,
  createUser,
  createSession,
  cleanupExpiredSessions,
} from "@/lib/db";

const BCRYPT_ROUNDS = 12;

export async function POST(request: Request) {
  try {
    cleanupExpiredSessions();

    const body = await request.json();
    const { mobile, email, password } = body as {
      mobile?: string;
      email?: string;
      password?: string;
    };

    // --- Validate required fields ---
    if (!mobile || !/^09\d{9}$/.test(mobile)) {
      return NextResponse.json(
        {
          code: "INVALID_MOBILE",
          message: "شماره موبایل معتبر نیست. لطفاً با ۰۹ وارد کنید",
          fieldErrors: [{ path: "mobile", reason: "شماره موبایل معتبر نیست" }],
          retryable: false,
        },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        {
          code: "WEAK_PASSWORD",
          message: "رمز عبور باید حداقل ۶ کاراکتر باشد",
          fieldErrors: [
            { path: "password", reason: "رمز عبور باید حداقل ۶ کاراکتر باشد" },
          ],
          retryable: false,
        },
        { status: 400 }
      );
    }

    if (password.length > 128) {
      return NextResponse.json(
        {
          code: "WEAK_PASSWORD",
          message: "رمز عبور نمی‌تواند بیش از ۱۲۸ کاراکتر باشد",
          fieldErrors: [
            { path: "password", reason: "رمز عبور نمی‌تواند بیش از ۱۲۸ کاراکتر باشد" },
          ],
          retryable: false,
        },
        { status: 400 }
      );
    }

    // --- Check if mobile already exists ---
    const existing = findUserByMobile(mobile);
    if (existing) {
      return NextResponse.json(
        {
          code: "MOBILE_EXISTS",
          message: "این شماره موبایل قبلاً ثبت‌نام شده است",
          fieldErrors: [],
          retryable: false,
        },
        { status: 409 }
      );
    }

    // --- Hash password ---
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, salt);

    // --- Create user ---
    const user = createUser({
      mobile,
      email,
      passwordHash,
      displayName: undefined,
    });

    // --- Create session ---
    const session = createSession(user.id);

    // --- Build response ---
    const userResponse = {
      id: user.id,
      mobileE164: "+98" + user.mobile.slice(1),
      mobileDisplay: user.mobile,
      status: "active",
    };

    const response = NextResponse.json(
      {
        data: {
          sessionId: session.id,
          user: userResponse,
          isNewUser: true,
        },
        meta: {
          requestId: crypto.randomUUID(),
        },
      },
      { status: 201 }
    );

    // Set session cookie
    response.cookies.set("legalir-session", session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err) {
    console.error("[register] Error:", err);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "خطای داخلی سرور. لطفاً دوباره تلاش کنید",
        fieldErrors: [],
        retryable: true,
        correlationId: crypto.randomUUID(),
      },
      { status: 500 }
    );
  }
}
