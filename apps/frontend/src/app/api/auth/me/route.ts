// ============================================================
// LEGALIR — GET /api/auth/me
// ============================================================
// Returns the currently authenticated user from the session cookie.
// ============================================================

import { NextResponse } from "next/server";
import { findSessionById, findUserById, cleanupExpiredSessions } from "@/lib/db";

export async function GET(request: Request) {
  try {
    cleanupExpiredSessions();

    // Read the session cookie
    const cookieHeader = request.headers.get("cookie") ?? "";
    const sessionId = extractCookie(cookieHeader, "legalir-session");

    if (!sessionId) {
      return NextResponse.json(
        {
          code: "UNAUTHORIZED",
          message: "نیاز به ورود مجدد",
          fieldErrors: [],
          retryable: false,
        },
        { status: 401 }
      );
    }

    // Look up the session
    const session = findSessionById(sessionId);
    if (!session) {
      // Session expired or invalid — clear the cookie
      const clearResponse = NextResponse.json(
        {
          code: "UNAUTHORIZED",
          message: "نیاز به ورود مجدد",
          fieldErrors: [],
          retryable: false,
        },
        { status: 401 }
      );
      clearResponse.cookies.set("legalir-session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return clearResponse;
    }

    // Look up the user
    const user = findUserById(session.userId);
    if (!user) {
      return NextResponse.json(
        {
          code: "UNAUTHORIZED",
          message: "حساب کاربری یافت نشد",
          fieldErrors: [],
          retryable: false,
        },
        { status: 401 }
      );
    }

    // Build response
    return NextResponse.json(
      {
        data: {
          user: {
            id: user.id,
            mobileE164: "+98" + user.mobile.slice(1),
            mobileDisplay: user.mobile,
            status: "active",
          },
          profile: {
            displayName: user.displayName,
            mobile: user.mobile,
            email: user.email ?? null,
          },
        },
        meta: {
          requestId: crypto.randomUUID(),
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[me] Error:", err);
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

/** Extract a named cookie value from the Cookie header string */
function extractCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="));

  if (!match) return null;

  return match.slice(name.length + 1) || null;
}
