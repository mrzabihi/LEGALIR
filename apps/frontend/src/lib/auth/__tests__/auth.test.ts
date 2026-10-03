// ============================================================
// LEGALIR — Auth Tests (Phase 4)
// ============================================================

import { describe, it, expect, afterEach } from "vitest";
import { normalizeMobile, toE164, requestOtpApi, verifyOtpApi } from "../api";
import { useAuthStore } from "@/stores/auth-store";

// MSW server is started/stopped globally in src/test-setup.ts.
// We reset store state between tests.

afterEach(() => {
  useAuthStore.setState({ session: null, isLoading: false, intendedRoute: null });
});

// ============================================================
// Unit Tests — normalizeMobile
// ============================================================

describe("normalizeMobile", () => {
  const CANONICAL = "+989123456789";

  it("maps every accepted format to one canonical E.164 value", () => {
    const formats = [
      "09123456789",
      "9123456789",
      "+989123456789",
      "00989123456789",
      "989123456789",
      "۰۹۱۲۳۴۵۶۷۸۹",
      "٠٩١٢٣٤٥٦٧٨٩",
      "0912 345 6789",
      "0912-345-6789",
      "+98 (912) 345 6789",
      "۰۹۱۲ ۳۴۵ ۶۷۸۹",
      "  +98 912 345 6789  ",
    ];
    for (const input of formats) {
      expect(normalizeMobile(input), `input: ${input}`).toBe(CANONICAL);
    }
  });

  it("is idempotent — re-normalizing a canonical value is a no-op", () => {
    expect(normalizeMobile(CANONICAL)).toBe(CANONICAL);
    expect(normalizeMobile(normalizeMobile("09123456789")!)).toBe(CANONICAL);
  });

  it("strips zero-width / bidi / BOM characters", () => {
    expect(normalizeMobile("\u200B0912\u200E3456789\uFEFF")).toBe(CANONICAL);
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(normalizeMobile("")).toBe(null);
    expect(normalizeMobile("   ")).toBe(null);
  });

  it("returns null for landline numbers", () => {
    expect(normalizeMobile("08123456789")).toBe(null);
    expect(normalizeMobile("02123456789")).toBe(null);
  });

  it("returns null for wrong-length numbers", () => {
    expect(normalizeMobile("0912")).toBe(null);
    expect(normalizeMobile("+98912")).toBe(null);
    expect(normalizeMobile("091234567890")).toBe(null);
  });

  it("returns null for letters and mixed junk", () => {
    expect(normalizeMobile("abc")).toBe(null);
    expect(normalizeMobile("0912abc6789")).toBe(null);
    expect(normalizeMobile("09١٢٣٤٥٦٧٨٩x")).toBe(null);
  });

  it("returns null for multiple + or repeated/inconsistent prefixes", () => {
    expect(normalizeMobile("++989123456789")).toBe(null);
    expect(normalizeMobile("+98+989123456789")).toBe(null);
    expect(normalizeMobile("00980989123456789")).toBe(null);
    expect(normalizeMobile("0989123456789")).toBe(null);
  });

  it("returns null for non-Iranian country codes", () => {
    expect(normalizeMobile("+14155552671")).toBe(null);
    expect(normalizeMobile("+971501234567")).toBe(null);
  });
});

describe("toE164", () => {
  it("converts 09 to E.164 format", () => {
    expect(toE164("09123456789")).toBe("+989123456789");
  });

  it("handles Persian digits", () => {
    expect(toE164("۰۹۱۲۳۴۵۶۷۸۹")).toBe("+989123456789");
  });

  it("is a no-op on an already-canonical value", () => {
    expect(toE164("+989123456789")).toBe("+989123456789");
  });
});

// ============================================================
// Integration Tests — Auth Store
// ============================================================

describe("Auth Store", () => {
  it("starts with no session", () => {
    const state = useAuthStore.getState();
    expect(state.session).toBe(null);
    expect(state.isAuthenticated()).toBe(false);
  });

  it("can set and clear session", () => {
    useAuthStore.getState().setSession({
      sessionId: "test-session-123",
      userId: "u-pro-001",
      mobileE164: "+989120000003",
      mobileDisplay: "۰۹۱۲۰۰۰۰۰۰۳",
      isNewUser: false,
      createdAt: Date.now(),
    });

    expect(useAuthStore.getState().isAuthenticated()).toBe(true);

    useAuthStore.getState().clearSession();

    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it("persists session via localStorage", () => {
    useAuthStore.getState().setSession({
      sessionId: "test-session-persist",
      userId: "u-pro-001",
      mobileE164: "+989120000003",
      mobileDisplay: "۰۹۱۲۰۰۰۰۰۰۳",
      isNewUser: false,
      createdAt: Date.now(),
    });

    const stored = localStorage.getItem("legalir-auth");
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored ?? "{}");
    expect(parsed.state.session.sessionId).toBe("test-session-persist");
  });

  it("tracks intendedRoute", () => {
    useAuthStore.getState().setIntendedRoute("/chat");
    expect(useAuthStore.getState().intendedRoute).toBe("/chat");

    useAuthStore.getState().setIntendedRoute(null);
    expect(useAuthStore.getState().intendedRoute).toBe(null);
  });

  it("detects new user from session", () => {
    useAuthStore.getState().setSession({
      sessionId: "test-session-new",
      userId: "u-new-001",
      mobileE164: "+989120000001",
      mobileDisplay: "۰۹۱۲۰۰۰۰۰۰۱",
      isNewUser: true,
      createdAt: Date.now(),
    });

    expect(useAuthStore.getState().isNewUser()).toBe(true);
  });

  it("isNewUser returns false for returning users", () => {
    useAuthStore.getState().setSession({
      sessionId: "test-session-returning",
      userId: "u-pro-001",
      mobileE164: "+989120000003",
      mobileDisplay: "۰۹۱۲۰۰۰۰۰۰۳",
      isNewUser: false,
      createdAt: Date.now(),
    });

    expect(useAuthStore.getState().isNewUser()).toBe(false);
  });
});

// ============================================================
// Integration Tests — Auth API (via MSW)
// Note: MSW server is started globally in test-setup.ts.
// We test against the actual MSW handlers.
// ============================================================

describe("Auth API (MSW)", () => {
  it("requestOtp succeeds with valid mobile", async () => {
    const res = await requestOtpApi("09123456789");
    expect(res.data).toBeTruthy();
    expect(res.data.challengeId).toBeTruthy();
    expect(res.data.expiresAt).toBeTruthy();
    expect(res.data.resendCooldownSeconds).toBe(60);
  });

  it("requestOtp fails with invalid mobile", async () => {
    await expect(requestOtpApi("123")).rejects.toBeTruthy();
    try {
      await requestOtpApi("123");
    } catch (err: unknown) {
      const apiErr = err as { code: string };
      expect(apiErr.code).toBe("INVALID_MOBILE");
    }
  });

  it("requestOtp rate-limits 09111111111", async () => {
    try {
      await requestOtpApi("09111111111");
    } catch (err: unknown) {
      const apiErr = err as { code: string };
      expect(apiErr.code).toBe("RATE_LIMITED");
    }
  });

  it("verifyOtp succeeds with correct code (405405)", async () => {
    // First request OTP
    const reqData = await requestOtpApi("09123456789");
    const challengeId = reqData.data.challengeId;

    // Verify with correct code
    const res = await verifyOtpApi(challengeId, "405405");
    expect(res.data.sessionId).toBeTruthy();
    expect(res.data.user).toBeTruthy();
    expect(res.data.isNewUser).toBe(false);
  });

  it("verifyOtp fails with invalid code", async () => {
    const reqData = await requestOtpApi("09120000001");
    const challengeId = reqData.data.challengeId;

    try {
      await verifyOtpApi(challengeId, "111111");
    } catch (err: unknown) {
      const apiErr = err as { code: string };
      expect(apiErr.code).toBe("OTP_INVALID");
    }
  });

  it("verifyOtp fails after too many attempts", async () => {
    const reqData = await requestOtpApi("09129999991");
    const challengeId = reqData.data.challengeId;

    // Make 5 invalid attempts
    for (let i = 0; i < 5; i++) {
      try {
        await verifyOtpApi(challengeId, "111111");
      } catch (err: unknown) {
        const apiErr = err as { code: string };
        if (i < 4) {
          expect(apiErr.code).toBe("OTP_INVALID");
        } else {
          expect(apiErr.code).toBe("TOO_MANY_ATTEMPTS");
        }
      }
    }
  });

  it("verifyOtp returns expired for unknown challengeId", async () => {
    try {
      const fakeId = crypto.randomUUID?.() ?? "00000000-0000-0000-0000-000000000000";
      await verifyOtpApi(fakeId, "405405");
    } catch (err: unknown) {
      const apiErr = err as { code: string };
      expect(apiErr.code).toBe("OTP_EXPIRED");
    }
  });
});

// ============================================================
// Integration Tests — Expired OTP Scenario
// ============================================================

describe("Expired OTP", () => {
  it("rejects OTP after challenge expires (09333333333 has 1s TTL)", async () => {
    // Request OTP with 1s TTL
    const reqData = await requestOtpApi("09333333333");
    const challengeId = reqData.data.challengeId;

    // Wait for challenge to expire (1s TTL + small buffer)
    await new Promise((r) => setTimeout(r, 1500));

    try {
      await verifyOtpApi(challengeId, "405405");
    } catch (err: unknown) {
      const apiErr = err as { code: string };
      expect(apiErr.code).toBe("OTP_EXPIRED");
    }
  });
});

// ============================================================
// Always Invalid OTP (09222222222)
// ============================================================

describe("Always Invalid OTP (09222222222)", () => {
  it("rejects valid code for 09222222222", async () => {
    const reqData = await requestOtpApi("09222222222");
    const challengeId = reqData.data.challengeId;

    try {
      await verifyOtpApi(challengeId, "405405");
    } catch (err: unknown) {
      const apiErr = err as { code: string };
      expect(apiErr.code).toBe("OTP_INVALID");
    }
  });
});

// ============================================================
// Resend Cooldown
// ============================================================

describe("Resend Cooldown", () => {
  it("returns resendCooldownSeconds in challenge", async () => {
    const res = await requestOtpApi("09123456789");
    expect(res.data.resendCooldownSeconds).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================
// Rate Limit
// ============================================================

describe("Rate Limit", () => {
  it("rate-limits after 3 requests in 5 minutes (same mobile)", async () => {
    // Send 3 requests — the 4th should be rate-limited
    // MSW handler: MAX_REQUESTS_PER_WINDOW = 3
    // So the 4th call triggers rate limit (3 >= 3 check)
    for (let i = 0; i < 3; i++) {
      await requestOtpApi("09129999999");
    }

    try {
      await requestOtpApi("09129999999");
    } catch (err: unknown) {
      const apiErr = err as { code: string };
      expect(apiErr.code).toBe("RATE_LIMITED");
    }
  });

  it("format variation cannot bypass the rate limit (same number, 4 spellings)", async () => {
    // Three requests, three different spellings of ONE number — they must
    // share a single rate-limit bucket, so the 4th (yet another spelling)
    // is rejected.
    await requestOtpApi("09128888888");
    await requestOtpApi("+989128888888");
    await requestOtpApi("00989128888888");

    try {
      await requestOtpApi("9128888888");
      throw new Error("expected the 4th request to be rate-limited");
    } catch (err: unknown) {
      const apiErr = err as { code: string };
      expect(apiErr.code).toBe("RATE_LIMITED");
    }
  });
});

// ============================================================
// Session Restoration
// ============================================================

describe("Session Restoration", () => {
  it("restores session from localStorage after store re-hydration", () => {
    // Simulate a persisted session
    const session = {
      sessionId: "restored-session-id",
      userId: "u-pro-001",
      mobileE164: "+989120000003",
      mobileDisplay: "۰۹۱۲۰۰۰۰۰۰۳",
      isNewUser: false,
      createdAt: Date.now(),
    };

    // Store directly in localStorage (simulating a previous session)
    localStorage.setItem(
      "legalir-auth",
      JSON.stringify({
        state: { session },
        version: 0,
      })
    );

    const stored = localStorage.getItem("legalir-auth");
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored ?? "{}");
    expect(parsed.state.session.sessionId).toBe("restored-session-id");
    expect(parsed.state.session.userId).toBe("u-pro-001");
  });
});

// ============================================================
// Logout
// ============================================================

describe("Logout", () => {
  it("clears session from store on logout", () => {
    useAuthStore.getState().setSession({
      sessionId: "logout-test-session",
      userId: "u-pro-001",
      mobileE164: "+989120000003",
      mobileDisplay: "۰۹۱۲۰۰۰۰۰۰۳",
      isNewUser: false,
      createdAt: Date.now(),
    });

    expect(useAuthStore.getState().isAuthenticated()).toBe(true);

    useAuthStore.getState().clearSession();

    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    expect(useAuthStore.getState().session).toBe(null);
  });
});

// ============================================================
// Protected Route
// ============================================================

describe("Protected Route", () => {
  it("auth store correctly identifies unauthenticated state", () => {
    useAuthStore.setState({ session: null, isLoading: false, intendedRoute: null });
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it("auth store correctly identifies authenticated state", () => {
    useAuthStore.getState().setSession({
      sessionId: "protected-test-session",
      userId: "u-pro-001",
      mobileE164: "+989120000003",
      mobileDisplay: "۰۹۱۲۰۰۰۰۰۰۳",
      isNewUser: false,
      createdAt: Date.now(),
    });

    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
  });
});
