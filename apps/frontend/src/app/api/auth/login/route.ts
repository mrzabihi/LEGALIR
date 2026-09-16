// ============================================================
// LEGALIR — POST /api/auth/login
// ============================================================
// Accepts: { mobile?: string, email?: string, password: string }
// Verifies credentials against SQLite database.
// Returns: { user, sessionId } with session cookie set
// ============================================================

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  findUserByMobile,
  createSession,
  cleanupExpiredSessions,
} from "@/lib/db";
import { clientIpFromHeaders } from "@/lib/user-agent";

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
    if (!password) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "رمز عبور الزامی است",
          fieldErrors: [
            { path: "password", reason: "رمز عبور الزامی است" },
          ],
          retryable: false,
        },
        { status: 400 }
      );
    }

    // --- Identify user by mobile (primary) or email ---
    let foundUser: ReturnType<typeof findUserByMobile> | undefined;

    if (mobile && /^09\d{9}$/.test(mobile)) {
      foundUser = findUserByMobile(mobile);
    } else if (email && email.includes("@")) {
      // Email-based lookup — find by mobile for now since our DB schema is mobile-keyed
      foundUser = findUserByMobile(email); // fallback; email-based lookup not yet supported
    }

    if (!foundUser) {
      if (mobile) {
        return NextResponse.json(
          {
            code: "INVALID_CREDENTIALS",
            message: "شماره موبایل یا رمز عبور اشتباه است",
            fieldErrors: [],
            retryable: false,
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "شماره موبایل معتبر نیست. لطفاً با ۰۹ وارد کنید",
          fieldErrors: [
            { path: "mobile", reason: "شماره موبایل معتبر نیست" },
          ],
          retryable: false,
        },
        { status: 400 }
      );
    }

    // --- Verify password ---
    const isValid = await bcrypt.compare(password, foundUser.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        {
          code: "INVALID_CREDENTIALS",
          message: "شماره موبایل یا رمز عبور اشتباه است",
          fieldErrors: [],
          retryable: false,
        },
        { status: 401 }
      );
    }

    // --- Create session ---
    const session = createSession(foundUser.id, {
      userAgent: request.headers.get("user-agent"),
      ip: clientIpFromHeaders(request.headers),
    });

    // --- Build response ---
    const userResponse = {
      id: foundUser.id,
      mobileE164: "+98" + foundUser.mobile.slice(1),
      mobileDisplay: foundUser.mobile,
      status: "active",
    };

    const response = NextResponse.json(
      {
        data: {
          sessionId: session.id,
          user: userResponse,
          isNewUser: false,
        },
        meta: {
          requestId: crypto.randomUUID(),
        },
      },
      { status: 200 }
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
    console.error("[login] Error:", err);
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
