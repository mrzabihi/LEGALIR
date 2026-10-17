/**
 * ============================================================
 * LEGALIR — E2E admin session helper
 * ============================================================
 * The admin specs all need a platform-staff session. The dev OTP path
 * (`405405`) is rate-limited to 3 requests per 5 minutes per mobile, and
 * that bucket is shared with every other process driving the same dev
 * server — so a suite run would intermittently fail on a quota it did
 * not spend.
 *
 * This helper therefore prefers the dev-admin PASSWORD when one is
 * configured in `.env.local` (gitignored) or the process environment,
 * and falls back to the OTP only when no password is available. No
 * credential ever reaches source.
 *
 * It also VERIFIES the resulting session is actually platform staff, so
 * a suite can never "pass" against a page that rendered «دسترسی محدود».
 */

import fs from "node:fs";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";

export const SESSION_COOKIE = "legalir-session";

/** The mobile the dev seed uses when no override is configured. */
export const DEFAULT_ADMIN_MOBILE = "09120000000";
export const DEFAULT_ADMIN_MOBILE_E164 = "+989120000000";

const OTP_CODE = "405405";
const ENV_FILE = path.join(process.cwd(), ".env.local");

/** Read one key from the gitignored `.env.local`; never logs a value. */
function readLocalEnv(key: string): string | undefined {
  if (!fs.existsSync(ENV_FILE)) return undefined;
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    if (line.slice(0, eq).trim() !== key) continue;
    return line.slice(eq + 1).trim() || undefined;
  }
  return undefined;
}

const configuredAdminMobile = (): string =>
  process.env["LEGALIR_DEV_ADMIN_MOBILE"] ??
  readLocalEnv("LEGALIR_DEV_ADMIN_MOBILE") ??
  DEFAULT_ADMIN_MOBILE;

const configuredAdminPassword = (): string | undefined =>
  process.env["LEGALIR_DEV_ADMIN_PASSWORD"] ?? readLocalEnv("LEGALIR_DEV_ADMIN_PASSWORD");

export interface AdminSession {
  sessionId: string;
  /** The mobile the session was opened with, in national `09…` form. */
  mobile: string;
  /** How the session was obtained — useful in a failure message. */
  via: "password" | "otp";
}

async function passwordSession(request: APIRequestContext): Promise<AdminSession | null> {
  const password = configuredAdminPassword();
  if (!password) return null;
  const mobile = configuredAdminMobile();
  const res = await request.post("/api/auth/login", { data: { mobile, password } });
  if (!res.ok()) return null;
  const body = (await res.json()) as {
    data?: { sessionId?: string; user?: { mobileDisplay?: string } };
  };
  const sessionId = body.data?.sessionId;
  if (!sessionId) return null;
  return { sessionId, mobile: body.data?.user?.mobileDisplay ?? mobile, via: "password" };
}

async function otpSession(request: APIRequestContext): Promise<AdminSession> {
  const mobile = DEFAULT_ADMIN_MOBILE;
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile } });
  const reqBody = (await reqRes.json()) as { data?: { challengeId?: string }; code?: string };
  const challengeId = reqBody.data?.challengeId;
  if (!challengeId) {
    throw new Error(
      `admin OTP request failed (${reqBody.code ?? reqRes.status()}). ` +
        "The dev OTP bucket allows 3 requests / 5 min per mobile; set " +
        "LEGALIR_DEV_ADMIN_PASSWORD in .env.local to bypass it."
    );
  }
  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const verifyBody = (await verifyRes.json()) as { data?: { sessionId?: string } };
  const sessionId = verifyBody.data?.sessionId;
  if (!sessionId) throw new Error(`admin OTP verify failed: ${JSON.stringify(verifyBody)}`);
  return { sessionId, mobile, via: "otp" };
}

/** True when the session resolves to a platform-staff role. */
async function isStaff(request: APIRequestContext, sessionId: string): Promise<boolean> {
  const res = await request.get("/api/v1/me", {
    headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
  });
  if (!res.ok()) return false;
  const body = (await res.json()) as { data?: { user?: { role?: string | null } } };
  const role = body.data?.user?.role ?? null;
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "SUPPORT" || role === "ANALYST";
}

let cached: AdminSession | null = null;

/**
 * A cached, verified platform-staff session. Password first (no shared
 * quota), OTP as the fallback. Throws with an actionable message when
 * neither yields a staff account — a silent non-admin session would make
 * every admin assertion pass against the «دسترسی محدود» page.
 */
export async function ensureAdminSession(request: APIRequestContext): Promise<AdminSession> {
  if (cached) return cached;

  const fromPassword = await passwordSession(request);
  if (fromPassword && (await isStaff(request, fromPassword.sessionId))) {
    cached = fromPassword;
    return cached;
  }

  const fromOtp = await otpSession(request);
  if (!(await isStaff(request, fromOtp.sessionId))) {
    throw new Error(
      `the ${fromOtp.via} session for ${fromOtp.mobile} is not platform staff. ` +
        "Run the dev server once so ensureDevAdminSeed() can promote it, or set " +
        "LEGALIR_DEV_ADMIN_MOBILE / _PASSWORD in .env.local."
    );
  }
  cached = fromOtp;
  return cached;
}
