// ============================================================
// LEGALIR — Dev-only admin staff seed (server-only)
// ============================================================
// The admin panel is gated on a platform-staff role. A fresh dev database
// has none, so every operator would hit «دسترسی محدود». This module makes
// the panel reachable in DEVELOPMENT by ensuring exactly one SUPER_ADMIN
// exists — and does nothing in staging/production.
//
// Honesty & safety:
//   • Guarded by NODE_ENV === "development"; never runs in prod.
//   • Idempotent: if ANY super-admin already exists, it is a no-op — so it
//     never overwrites a real operator's role or resurrects a demoted user.
//   • No credential is committed to source. The seeded account authenticates
//     via the development OTP (405405). If a developer sets
//     LEGALIR_DEV_ADMIN_PASSWORD locally, the password tab also works; absent
//     that, the hash is derived from a random, discarded secret.
// ============================================================

import bcrypt from "bcryptjs";
import {
  createUser,
  findUserByMobile,
  setUserRole,
  readTable,
  writeTable,
} from "@/lib/db";
import type { DbUser } from "@/lib/db";
import { PLATFORM_SUPERADMIN_ROLES, type PlatformRole } from "@legalir/types";

/**
 * The dev super-admin's mobile. Overridable with LEGALIR_DEV_ADMIN_MOBILE so a
 * developer can sign in with their own number. Documented in the README.
 */
export const DEV_ADMIN_MOBILE =
  process.env["LEGALIR_DEV_ADMIN_MOBILE"] ?? "+989120000000";

/**
 * Optional fixed dev password. When set (LEGALIR_DEV_ADMIN_PASSWORD) the
 * seeded operator can sign in from the password tab on /auth/mobile; when
 * unset, the account carries no reusable password and is reached via the dev
 * OTP only. Never set this outside local development.
 */
const DEV_ADMIN_PASSWORD = process.env["LEGALIR_DEV_ADMIN_PASSWORD"];

interface RoleRow {
  role?: PlatformRole;
}

/** True when at least one platform super-admin already exists. */
function hasSuperAdmin(): boolean {
  return readTable<RoleRow>("users").some(
    (u) => u.role && PLATFORM_SUPERADMIN_ROLES.includes(u.role)
  );
}

/**
 * A bcrypt hash for the seeded operator: the configured dev password, or a
 * random, discarded secret (OTP-only) when none is configured.
 */
function devPasswordHash(): string {
  const configured = DEV_ADMIN_PASSWORD;
  const secret = configured ?? crypto.randomUUID() + crypto.randomUUID();
  return bcrypt.hashSync(secret, configured ? 12 : 10);
}

/** Overwrite a user's stored password hash (dev seed only). */
function setUserPassword(userId: string, passwordHash: string): void {
  const users = readTable<DbUser>("users");
  const user = users.find((u) => u.id === userId);
  if (!user) return;
  user.passwordHash = passwordHash;
  writeTable("users", users);
}

/**
 * Ensure a development super-admin exists. Returns true when a row was
 * created (or promoted) by this call, false when it was a no-op.
 */
export function ensureDevAdminSeed(): boolean {
  if (process.env["NODE_ENV"] !== "development") return false;

  // Never fight an existing operator: if any super-admin is present, stop.
  if (hasSuperAdmin()) return false;

  const passwordHash = devPasswordHash();
  const existing = findUserByMobile(DEV_ADMIN_MOBILE);
  if (existing) {
    // A user with the dev mobile exists but holds no super-admin role — a
    // half-seeded state. Promote (and set the dev password, when configured)
    // rather than creating a duplicate.
    setUserRole(existing.id, "SUPER_ADMIN");
    if (DEV_ADMIN_PASSWORD) setUserPassword(existing.id, passwordHash);
    return true;
  }

  const user = createUser({
    mobile: DEV_ADMIN_MOBILE,
    passwordHash,
    displayName: "مدیر ارشد (توسعه)",
  });
  setUserRole(user.id, "SUPER_ADMIN");
  return true;
}
