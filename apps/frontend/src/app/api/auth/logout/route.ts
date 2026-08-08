// ============================================================
// LEGALIR — POST /api/auth/logout
// ============================================================
// Clears the session cookie and deletes the session from DB.
// ============================================================

import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/db";

export async function POST(request: Request) {
  try {
    // Read the session cookie
    const cookieHeader = request.headers.get("cookie") ?? "";
    const sessionId = extractCookie(cookieHeader, "legalir-session");

    // If a session exists, delete it from the DB
    if (sessionId) {
      deleteSession(sessionId);
    }

    // Clear the cookie regardless
    const response = NextResponse.json(
      {
        data: null,
        meta: {
          requestId: crypto.randomUUID(),
        },
      },
      { status: 200 }
    );

    response.cookies.set("legalir-session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0, // Expire immediately
    });

    return response;
  } catch (err) {
    console.error("[logout] Error:", err);
    // Always clear the cookie, even on error
    const response = NextResponse.json(
      {
        data: null,
        meta: {
          requestId: crypto.randomUUID(),
        },
      },
      { status: 200 }
    );

    response.cookies.set("legalir-session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
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
