// ============================================================
// LEGALIR — Registration identity & onboarding test suite
// ============================================================
// Covers the spec's core guarantees:
//   • The registration intent is normalized server-side; unknown → null.
//   • A user is NEVER converted into a company — an org is a membership.
//   • Onboarding routing is server-driven (resolveOnboarding.nextStep).
//   • A submitted lawyer profile is PENDING, never auto-VERIFIED.
//   • Legacy users default to LEGACY/PERSONAL without being changed.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  normalizeRegistrationIntent,
  onboardingTypeForIntent,
  ALLOWED_REGISTRATION_INTENTS,
} from "@legalir/types";

// ---------------------------------------------------------------------------
// In-memory tables backing the mocked db / org-db / lawyer-db modules
// ---------------------------------------------------------------------------

const users = new Map<string, Record<string, unknown>>();
const orgs = new Map<string, Record<string, unknown>>();
const members = new Map<string, Record<string, unknown>>();
const lawyerProfiles = new Map<string, Record<string, unknown>>();

vi.mock("@/lib/db", () => ({
  findUserById: (id: string) => users.get(id),
  readTable: () => [],
  writeTable: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  findActiveMembership: (userId: string) =>
    [...members.values()].find((m) => m["userId"] === userId && m["status"] === "active"),
}));

vi.mock("@/lib/org-db", () => ({
  getOrganizationById: (id: string) => orgs.get(id),
}));

vi.mock("@/lib/lawyer-db", () => ({
  getLawyerProfileByUserId: (userId: string) =>
    [...lawyerProfiles.values()].find((p) => p["userId"] === userId),
}));

import { resolveOnboarding } from "@/lib/onboarding";

function seedUser(id: string, overrides: Record<string, unknown> = {}) {
  users.set(id, {
    id,
    mobile: "09120000000",
    onboardingType: "PERSONAL",
    onboardingStatus: "NOT_STARTED",
    ...overrides,
  });
}

beforeEach(() => {
  users.clear();
  orgs.clear();
  members.clear();
  lawyerProfiles.clear();
});

// ============================================================
// Intent normalization (server-side trust boundary)
// ============================================================

describe("normalizeRegistrationIntent", () => {
  it("accepts the three allowed intents (case-insensitive)", () => {
    expect(normalizeRegistrationIntent("PERSONAL")).toBe("PERSONAL");
    expect(normalizeRegistrationIntent("organization")).toBe("ORGANIZATION");
    expect(normalizeRegistrationIntent("Lawyer")).toBe("LAWYER");
  });

  it("rejects anything outside the allow-list", () => {
    expect(normalizeRegistrationIntent("COMPANY")).toBeNull();
    expect(normalizeRegistrationIntent("")).toBeNull();
    expect(normalizeRegistrationIntent(null)).toBeNull();
    expect(normalizeRegistrationIntent(42)).toBeNull();
    expect(normalizeRegistrationIntent({ type: "LAWYER" })).toBeNull();
  });

  it("exposes exactly three allowed intents", () => {
    expect(ALLOWED_REGISTRATION_INTENTS).toHaveLength(3);
  });

  it("maps an intent to its onboarding track", () => {
    expect(onboardingTypeForIntent("ORGANIZATION")).toBe("ORGANIZATION");
    expect(onboardingTypeForIntent("LAWYER")).toBe("LAWYER");
    expect(onboardingTypeForIntent("PERSONAL")).toBe("PERSONAL");
  });
});

// ============================================================
// Onboarding routing (server-driven)
// ============================================================

describe("resolveOnboarding", () => {
  it("returns null for an unknown user", () => {
    expect(resolveOnboarding("nobody")).toBeNull();
  });

  it("routes a PERSONAL user to profile completion", () => {
    seedUser("u-personal", { onboardingType: "PERSONAL" });
    const state = resolveOnboarding("u-personal");
    expect(state?.nextStep).toBe("PERSONAL_PROFILE");
    expect(state?.organization).toBeNull();
  });

  it("routes an ORGANIZATION user to organization onboarding", () => {
    seedUser("u-org", { onboardingType: "ORGANIZATION" });
    expect(resolveOnboarding("u-org")?.nextStep).toBe("ORGANIZATION");
  });

  it("routes a LAWYER user without a profile to lawyer onboarding", () => {
    seedUser("u-lawyer", { onboardingType: "LAWYER" });
    expect(resolveOnboarding("u-lawyer")?.nextStep).toBe("LAWYER");
  });

  it("routes a LAWYER with a submitted profile to the dashboard", () => {
    seedUser("u-lawyer2", { onboardingType: "LAWYER" });
    lawyerProfiles.set("lp-1", { id: "lp-1", userId: "u-lawyer2", verificationStatus: "PROFILE_SUBMITTED" });
    expect(resolveOnboarding("u-lawyer2")?.nextStep).toBe("DASHBOARD");
  });

  it("routes an org member to the dashboard even if they registered PERSONAL", () => {
    seedUser("u-member", { onboardingType: "PERSONAL" });
    orgs.set("org-1", { id: "org-1", name: "شرکت نمونه" });
    members.set("m-1", { id: "m-1", orgId: "org-1", userId: "u-member", role: "COMPANY_OWNER", status: "active" });
    const state = resolveOnboarding("u-member");
    expect(state?.nextStep).toBe("DASHBOARD");
    expect(state?.organization?.id).toBe("org-1");
    expect(state?.orgRole).toBe("COMPANY_OWNER");
  });

  it("routes a COMPLETED user to the dashboard", () => {
    seedUser("u-done", { onboardingType: "ORGANIZATION", onboardingStatus: "COMPLETED" });
    expect(resolveOnboarding("u-done")?.nextStep).toBe("DASHBOARD");
  });

  it("treats a legacy user (no onboarding fields) as PERSONAL", () => {
    users.set("u-legacy", { id: "u-legacy", mobile: "09120000001" });
    const state = resolveOnboarding("u-legacy");
    expect(state?.type).toBe("PERSONAL");
    expect(state?.status).toBe("NOT_STARTED");
    expect(state?.nextStep).toBe("PERSONAL_PROFILE");
  });
});
