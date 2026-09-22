// ============================================================
// LEGALIR — Lawyer workspace derivation tests (PART 24)
// ============================================================
// The workspace is DERIVED from real events, never fabricated. These
// tests pin:
//   • a user with no lawyer profile gets a null profile and zero stats
//   • only requests assigned to THIS lawyer appear in the inbox
//   • terminal requests are excluded from the inbox
//   • "awaiting lawyer" is derived from the request state
//   • cases are reached only through the lawyer's own requests
//   • upcoming deadlines count only open ones inside the 7-day window
//   • the client's display name is used, never the raw user id
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LawyerProfile, LegalRequest } from "@legalir/types";

const profiles = new Map<string, { displayName: string | null }>();
const lawyerProfiles: LawyerProfile[] = [];
const requests: LegalRequest[] = [];
const cases = new Map<string, Record<string, unknown>>();
const deadlines = new Map<string, Record<string, unknown>[]>();
const tasks = new Map<string, Record<string, unknown>[]>();

vi.mock("../db", () => ({
  getProfile: (userId: string) => ({
    displayName: profiles.get(userId)?.displayName ?? null,
  }),
}));

vi.mock("../lawyer-db", () => ({
  getLawyerProfileByUserId: (userId: string) =>
    lawyerProfiles.find((l) => l.userId === userId),
  computePerformance: () => ({
    acceptedRequests: 3,
    completedCases: 1,
    medianResponseMinutes: 42,
    averageRating: 4.5,
    reviewCount: 2,
  }),
}));

vi.mock("../legal-request-db", () => ({
  listRequestsForLawyer: (lawyerId: string) =>
    requests.filter((r) => r.selectedLawyerId === lawyerId),
}));

vi.mock("../case-db", () => ({
  getCaseById: (caseId: string) => cases.get(caseId),
  getCaseDeadlines: (caseId: string) => deadlines.get(caseId) ?? [],
  getCaseTasks: (caseId: string) => tasks.get(caseId) ?? [],
}));

import { buildLawyerWorkspace, UPCOMING_DEADLINE_DAYS } from "../lawyer-workspace";

const NOW = new Date("2026-09-21T12:00:00Z");

function lawyerProfile(userId: string, id = "law-1"): LawyerProfile {
  return {
    id,
    userId,
    fullName: "وکیل نمونه",
    licenseNumber: null,
    licenseYear: null,
    bio: "",
    avatarUrl: null,
    avatarType: "demo",
    professionalTitle: null,
    verificationStatus: "VERIFIED",
    verifiedAt: null,
    verificationNote: null,
    specializations: [],
    locations: [],
    languages: [],
    pricing: { consultationFeeToman: 0, freeFirstConsultation: false },
    availability: [],
    performance: {
      acceptedRequests: 0,
      completedCases: 0,
      medianResponseMinutes: null,
      averageRating: null,
      reviewCount: 0,
    },
    availabilityStatus: "ACTIVE",
    consultationCapacity: null,
    isDemo: false,
    acceptingRequests: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  } as LawyerProfile;
}

function request(overrides: Partial<LegalRequest> & { id: string }): LegalRequest {
  return {
    userId: "client-1",
    caseId: null,
    conversationId: null,
    title: "درخواست نمونه",
    category: "family",
    state: "ACCEPTED",
    intakeAnswers: {},
    analysisId: null,
    selectedLawyerId: "law-1",
    orgId: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  profiles.clear();
  lawyerProfiles.length = 0;
  requests.length = 0;
  cases.clear();
  deadlines.clear();
  tasks.clear();
});

describe("buildLawyerWorkspace", () => {
  it("returns a null profile and zero stats when the user is not a lawyer", () => {
    const ws = buildLawyerWorkspace("user-A", NOW);
    expect(ws.profile).toBeNull();
    expect(ws.inbox).toHaveLength(0);
    expect(ws.cases).toHaveLength(0);
    expect(ws.stats.activeRequests).toBe(0);
    expect(ws.stats.performance.acceptedRequests).toBe(0);
  });

  it("includes only requests assigned to this lawyer", () => {
    lawyerProfiles.push(lawyerProfile("user-A"));
    requests.push(
      request({ id: "r-mine", selectedLawyerId: "law-1" }),
      request({ id: "r-other", selectedLawyerId: "law-2" })
    );
    const ws = buildLawyerWorkspace("user-A", NOW);
    expect(ws.inbox.map((i) => i.requestId)).toEqual(["r-mine"]);
  });

  it("excludes terminal requests from the inbox", () => {
    lawyerProfiles.push(lawyerProfile("user-A"));
    requests.push(
      request({ id: "r-live", state: "IN_PROGRESS" }),
      request({ id: "r-done", state: "COMPLETED" }),
      request({ id: "r-closed", state: "CLOSED" }),
      request({ id: "r-cancelled", state: "CANCELLED" })
    );
    const ws = buildLawyerWorkspace("user-A", NOW);
    expect(ws.inbox.map((i) => i.requestId)).toEqual(["r-live"]);
  });

  it("flags a request as awaiting the lawyer from its state", () => {
    lawyerProfiles.push(lawyerProfile("user-A"));
    requests.push(
      request({ id: "r-wait", state: "WAITING_FOR_LAWYER" }),
      request({ id: "r-client", state: "WAITING_FOR_CLIENT" })
    );
    const ws = buildLawyerWorkspace("user-A", NOW);
    const byId = new Map(ws.inbox.map((i) => [i.requestId, i]));
    expect(byId.get("r-wait")!.awaitingLawyer).toBe(true);
    expect(byId.get("r-client")!.awaitingLawyer).toBe(false);
    expect(ws.stats.awaitingResponse).toBe(1);
  });

  it("uses the client's display name, never the raw user id", () => {
    lawyerProfiles.push(lawyerProfile("user-A"));
    profiles.set("client-1", { displayName: "مریم محمدی" });
    requests.push(request({ id: "r-1", userId: "client-1" }));
    const ws = buildLawyerWorkspace("user-A", NOW);
    expect(ws.inbox[0]!.clientName).toBe("مریم محمدی");
  });

  it("falls back to a neutral label when the client has no display name", () => {
    lawyerProfiles.push(lawyerProfile("user-A"));
    requests.push(request({ id: "r-1", userId: "client-1" }));
    const ws = buildLawyerWorkspace("user-A", NOW);
    expect(ws.inbox[0]!.clientName).toBe("موکل");
  });

  it("reaches cases only through the lawyer's own requests", () => {
    lawyerProfiles.push(lawyerProfile("user-A"));
    requests.push(
      request({ id: "r-1", caseId: "case-1" }),
      request({ id: "r-2", caseId: "case-2", selectedLawyerId: "law-2" })
    );
    cases.set("case-1", {
      id: "case-1",
      title: "پرونده من",
      category: "family",
      status: "ACTIVE",
      priority: "high",
      updated_at: "2026-09-10T00:00:00Z",
    });
    cases.set("case-2", {
      id: "case-2",
      title: "پرونده دیگری",
      category: "family",
      status: "ACTIVE",
      priority: "low",
      updated_at: "2026-09-10T00:00:00Z",
    });
    const ws = buildLawyerWorkspace("user-A", NOW);
    expect(ws.cases.map((c) => c.caseId)).toEqual(["case-1"]);
    expect(ws.stats.activeCases).toBe(1);
  });

  it("counts only open deadlines inside the upcoming window", () => {
    lawyerProfiles.push(lawyerProfile("user-A"));
    requests.push(request({ id: "r-1", caseId: "case-1" }));
    cases.set("case-1", {
      id: "case-1",
      title: "پرونده",
      category: "family",
      status: "ACTIVE",
      priority: "high",
      updated_at: "2026-09-10T00:00:00Z",
    });
    const soon = new Date(NOW);
    soon.setDate(soon.getDate() + 3);
    const far = new Date(NOW);
    far.setDate(far.getDate() + UPCOMING_DEADLINE_DAYS + 10);
    deadlines.set("case-1", [
      { id: "d-soon", due_at: soon.toISOString(), completed: false },
      { id: "d-far", due_at: far.toISOString(), completed: false },
      { id: "d-done", due_at: soon.toISOString(), completed: true },
    ]);
    const ws = buildLawyerWorkspace("user-A", NOW);
    expect(ws.stats.upcomingDeadlines).toBe(1);
    expect(ws.cases[0]!.nextDeadlineAt).toBe(soon.toISOString());
  });

  it("counts open tasks per case", () => {
    lawyerProfiles.push(lawyerProfile("user-A"));
    requests.push(request({ id: "r-1", caseId: "case-1" }));
    cases.set("case-1", {
      id: "case-1",
      title: "پرونده",
      category: "family",
      status: "ACTIVE",
      priority: "high",
      updated_at: "2026-09-10T00:00:00Z",
    });
    tasks.set("case-1", [
      { id: "t-1", status: "todo" },
      { id: "t-2", status: "done" },
      { id: "t-3", status: "in_progress" },
    ]);
    const ws = buildLawyerWorkspace("user-A", NOW);
    expect(ws.cases[0]!.openTasks).toBe(2);
  });

  it("derives performance from real events for a lawyer with a profile", () => {
    lawyerProfiles.push(lawyerProfile("user-A"));
    const ws = buildLawyerWorkspace("user-A", NOW);
    expect(ws.stats.performance.averageRating).toBe(4.5);
    expect(ws.stats.performance.acceptedRequests).toBe(3);
  });
});
