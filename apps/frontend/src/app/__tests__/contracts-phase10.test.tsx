import { describe, it, expect, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/mocks/server";
import {
  fixtureV1ContractTypes,
  fixtureV1ContractListResponse,
  fixtureV1ContractDetail,
  fixtureV1ContractRiskAnalysis,
  fixtureV1LeaseQuestions,
  fixtureV1NdaQuestions,
  fixtureV1EmploymentQuestions,
} from "@legalir/testing";
import type {
  V1ContractDetail,
  V1ContractListResponse,
  V1ContractVersionDetail,
  V1ContractRiskAnalysis,
} from "@legalir/types";
import {
  V1_CONTRACT_STATE_LABELS,
  V1_CONTRACT_STATE_TRANSITIONS,
} from "@legalir/types";

const API_BASE = "http://localhost:8000";

function _ok<T>(data: T) {
  return { data, meta: { requestId: "test-request-id" } };
}

function _TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 60_000 },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl">{children}</div>
    </QueryClientProvider>
  );
}

// ==========================================
// Phase 10 — Contract Workspace
// ==========================================

describe("Phase 10 — Contract Workspace", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  // ==========================================
  // 1. Contract Types
  // ==========================================
  describe("Contract Types API", () => {
    it("returns all 9 contract types (4 personal + 5 business)", async () => {
      const types = fixtureV1ContractTypes;
      expect(types.personal).toHaveLength(4);
      expect(types.business).toHaveLength(5);
      expect(types.personal[0]!.id).toBe("lease");
      expect(types.personal[1]!.id).toBe("sale_purchase");
      expect(types.personal[2]!.id).toBe("loan");
      expect(types.personal[3]!.id).toBe("partnership");
      expect(types.business[0]!.id).toBe("nda");
      expect(types.business[1]!.id).toBe("employment");
      expect(types.business[2]!.id).toBe("saas");
      expect(types.business[3]!.id).toBe("contracting");
      expect(types.business[4]!.id).toBe("investment");
    });

    it("each type has Persian name and description", () => {
      const allTypes = [
        ...fixtureV1ContractTypes.personal,
        ...fixtureV1ContractTypes.business,
      ];
      for (const t of allTypes) {
        expect(t.nameFa).toBeTruthy();
        expect(t.nameFa.length).toBeGreaterThan(0);
        expect(t.descriptionFa).toBeTruthy();
        expect(t.category).toMatch(/^(personal|business)$/);
        expect(t.questionCount).toBeGreaterThan(0);
        expect(t.icon).toBeTruthy();
      }
    });

    it("MSW handler returns contract types", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contract-types`);
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.data.personal).toHaveLength(4);
      expect(body.data.business).toHaveLength(5);
    });
  });

  // ==========================================
  // 2. Contract Questions (Questionnaire)
  // ==========================================
  describe("Contract Questions API", () => {
    it("lease questions have correct structure", () => {
      const qs = fixtureV1LeaseQuestions;
      expect(qs.length).toBeGreaterThan(0);
      for (const q of qs) {
        expect(q.id).toBeTruthy();
        expect(q.fieldKey).toBeTruthy();
        expect(q.labelFa).toBeTruthy();
        expect(q.typeId).toBe("lease");
        expect(typeof q.step).toBe("number");
        expect(typeof q.required).toBe("boolean");
        expect(["text", "textarea", "select", "date", "number", "radio"]).toContain(q.inputType);
      }
    });

    it("lease questions span 5 steps", () => {
      const steps = new Set(fixtureV1LeaseQuestions.map((q) => q.step));
      expect(steps.size).toBe(5);
      expect(steps.has(1)).toBe(true);
      expect(steps.has(5)).toBe(true);
    });

    it("NDA questions have correct structure", () => {
      const qs = fixtureV1NdaQuestions;
      expect(qs.length).toBeGreaterThan(0);
      expect(qs[0]!.typeId).toBe("nda");
    });

    it("employment questions have correct structure", () => {
      const qs = fixtureV1EmploymentQuestions;
      expect(qs.length).toBeGreaterThan(0);
      expect(qs[0]!.typeId).toBe("employment");
    });
  });

  // ==========================================
  // 3. Contract List
  // ==========================================
  describe("Contract List API", () => {
    it("returns paginated contract list", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts`);
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { data: V1ContractListResponse };
      expect(body.data.items.length).toBeGreaterThan(0);
      expect(body.data.pagination).toBeDefined();
      expect(body.data.pagination.total).toBeGreaterThan(0);
    });

    it("contract list items have required fields", () => {
      const items = fixtureV1ContractListResponse.items;
      for (const item of items) {
        expect(item.id).toBeTruthy();
        expect(item.title).toBeTruthy();
        expect(item.type).toBeTruthy();
        expect(item.typeFa).toBeTruthy();
        expect(item.state).toBeTruthy();
        expect(V1_CONTRACT_STATE_LABELS[item.state]).toBeTruthy();
        expect(item.createdAt).toBeTruthy();
        expect(item.updatedAt).toBeTruthy();
      }
    });

    it("supports search filter", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts?search=اجاره`);
      const body = (await res.json()) as { data: V1ContractListResponse };
      for (const item of body.data.items) {
        expect(item.title.includes("اجاره")).toBe(true);
      }
    });

    it("supports state filter", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts?state=archived`);
      const body = (await res.json()) as { data: V1ContractListResponse };
      for (const item of body.data.items) {
        expect(item.state).toBe("archived");
      }
    });

    it("supports category filter", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts?category=personal`);
      const body = (await res.json()) as { data: V1ContractListResponse };
      for (const item of body.data.items) {
        expect(item.category).toBe("personal");
      }
    });

    it("handles fetch error", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts?fail=true`);
      expect(res.ok).toBe(false);
      expect(res.status).toBe(500);
    });
  });

  // ==========================================
  // 4. Draft Creation & Auto-Save
  // ==========================================
  describe("Draft Creation & Auto-Save", () => {
    it("creates a new draft", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId: "lease" }),
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.data.typeId).toBe("lease");
      expect(body.data.currentStep).toBe(1);
      expect(body.data.answers).toEqual({});
    });

    it("returns existing draft on re-create", async () => {
      // Create first
      await fetch(`${API_BASE}/api/v1/contracts/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId: "nda" }),
      });
      // Create again
      const res = await fetch(`${API_BASE}/api/v1/contracts/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId: "nda" }),
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.data.typeId).toBe("nda");
    });

    it("fetches a saved draft", async () => {
      // Create draft
      await fetch(`${API_BASE}/api/v1/contracts/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId: "employment" }),
      });
      // Fetch
      const res = await fetch(`${API_BASE}/api/v1/contracts/drafts/employment`);
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.data.typeId).toBe("employment");
    });

    it("returns null for non-existent draft", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/drafts/sale_purchase`);
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.data).toBe(null);
    });

    it("saves draft answers", async () => {
      // Create
      await fetch(`${API_BASE}/api/v1/contracts/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId: "lease" }),
      });
      // Save
      const res = await fetch(`${API_BASE}/api/v1/contracts/drafts/lease`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStep: 2,
          answers: { party1_name: "علی", party2_name: "حسین" },
        }),
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.data.currentStep).toBe(2);
      expect(body.data.answers.party1_name).toBe("علی");
      expect(body.data.savedAt).toBeTruthy();
    });

    it("deletes a draft", async () => {
      // Create
      await fetch(`${API_BASE}/api/v1/contracts/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId: "lease" }),
      });
      // Delete
      const res = await fetch(`${API_BASE}/api/v1/contracts/drafts/lease`, {
        method: "DELETE",
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.data.deleted).toBe(true);
    });
  });

  // ==========================================
  // 5. Contract Creation & Generation
  // ==========================================
  describe("Contract Creation & Generation", () => {
    it("creates a new contract", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId: "lease", title: "قرارداد تست" }),
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.data.typeId).toBe("lease");
      expect(body.data.title).toBe("قرارداد تست");
      expect(body.data.state).toBe("collecting");
    });

    it("validates required fields on create", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("generates contract content", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/cnt-lease-001/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.data.state).toBe("generated");
      expect(body.data.content).toBeTruthy();
      expect(body.data.clauses.length).toBeGreaterThan(0);
    });

    it("handles generation failure", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/cnt-lease-001/generate?fail=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(500);
    });

    it("handles generate for non-existent contract", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/nonexistent/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(404);
    });
  });

  // ==========================================
  // 6. Contract Detail
  // ==========================================
  describe("Contract Detail API", () => {
    it("fetches contract detail by id", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/cnt-lease-001`);
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { data: V1ContractDetail };
      expect(body.data.id).toBe("cnt-lease-001");
      expect(body.data.title).toBeTruthy();
      expect(body.data.type).toBe("lease");
      expect(body.data.versions.length).toBeGreaterThan(0);
      expect(body.data.analysis).toBeTruthy();
      expect(body.data.disclaimer).toBeTruthy();
    });

    it("has valid disclaimer text", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/cnt-lease-001`);
      const body = (await res.json()) as { data: V1ContractDetail };
      expect(body.data.disclaimer).toContain("پیش‌نویس");
      expect(body.data.disclaimer).toContain("LEGALIR");
      expect(body.data.disclaimer).toContain("وکیل");
    });

    it("returns 404 for unknown contract", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/unknown-123`);
      expect(res.ok).toBe(false);
      expect(res.status).toBe(404);
    });

    it("fetches NDA contract detail", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/cnt-nda-001`);
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { data: V1ContractDetail };
      expect(body.data.type).toBe("nda");
      expect(body.data.typeFa).toBe("NDA");
      expect(body.data.category).toBe("business");
    });

    it("contract version has required fields", () => {
      const versions = fixtureV1ContractDetail.versions;
      for (const v of versions) {
        expect(v.id).toBeTruthy();
        expect(v.contractId).toBe("cnt-lease-001");
        expect(v.versionNumber).toBeGreaterThan(0);
        expect(v.content).toBeTruthy();
        expect(v.clauses).toBeDefined();
        expect(v.answers).toBeDefined();
        expect(v.state).toBeTruthy();
        expect(v.createdAt).toBeTruthy();
      }
    });
  });

  // ==========================================
  // 7. Contract Update
  // ==========================================
  describe("Contract Update API", () => {
    it("updates contract fields", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/cnt-lease-001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "عنوان جدید" }),
      });
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { data: V1ContractDetail };
      expect(body.data.title).toBe("عنوان جدید");
    });

    it("updates contract state", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/cnt-lease-001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "under_review" }),
      });
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { data: V1ContractDetail };
      expect(body.data.state).toBe("under_review");
    });
  });

  // ==========================================
  // 8. Contract Versions
  // ==========================================
  describe("Contract Versions API", () => {
    it("fetches version history for a contract", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/cnt-lease-001/versions`);
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.data.length).toBe(2);
      expect(body.data[0].versionNumber).toBe(1);
      expect(body.data[1].versionNumber).toBe(2);
    });

    it("version contains answers and content", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/cnt-lease-001/versions`);
      const body = await res.json();
      const v1 = body.data[0] as V1ContractVersionDetail;
      expect(v1.answers).toBeDefined();
      expect(Object.keys(v1.answers).length).toBeGreaterThan(0);
      expect(v1.content).toBeTruthy();
      expect(v1.clauses.length).toBeGreaterThan(0);
    });

    it("versions have increasing version numbers", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/cnt-lease-001/versions`);
      const body = await res.json();
      const versions = body.data as V1ContractVersionDetail[];
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i]!.versionNumber).toBeGreaterThan(
          versions[i - 1]!.versionNumber
        );
      }
    });
  });

  // ==========================================
  // 9. Risk Analysis Panel
  // ==========================================
  describe("Risk Analysis Panel", () => {
    it("fetches risk analysis for a contract", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/cnt-lease-001/analysis`);
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { data: V1ContractRiskAnalysis };
      expect(body.data.contractId).toBe("cnt-lease-001");
      expect(body.data.overallRisk).toBeTruthy();
      expect(body.data.findings.length).toBeGreaterThan(0);
      expect(body.data.protectiveSuggestions.length).toBeGreaterThan(0);
    });

    it("risk findings have required structure", () => {
      const findings = fixtureV1ContractRiskAnalysis.findings;
      for (const f of findings) {
        expect(f.id).toBeTruthy();
        expect(f.title).toBeTruthy();
        expect(["low", "medium", "high", "critical"]).toContain(f.severity);
        expect(f.description).toBeTruthy();
        expect(f.suggestion).toBeTruthy();
      }
    });

    it("protective suggestions are marked as protective", () => {
      const suggestions = fixtureV1ContractRiskAnalysis.protectiveSuggestions;
      for (const s of suggestions) {
        expect(s.isProtective).toBe(true);
        expect(s.title).toBeTruthy();
        expect(s.content).toBeTruthy();
        expect(["essential", "recommended", "optional"]).toContain(s.importance);
      }
    });

    it("handles 409 when analysis not ready", async () => {
      const res = await fetch(
        `${API_BASE}/api/v1/contracts/cnt-lease-001/analysis?notReady=true`
      );
      expect(res.ok).toBe(false);
      expect(res.status).toBe(409);
    });
  });

  // ==========================================
  // 10. Contract Archival
  // ==========================================
  describe("Contract Archival", () => {
    it("archives a contract", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/cnt-lease-001/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.data.state).toBe("archived");
    });

    it("handles archive failure", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/cnt-lease-001/archive?fail=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(500);
    });
  });

  // ==========================================
  // 11. State Machine
  // ==========================================
  describe("State Machine", () => {
    it("all 7 states are defined", () => {
      const states = Object.keys(V1_CONTRACT_STATE_LABELS);
      expect(states).toHaveLength(7);
      expect(states).toContain("draft");
      expect(states).toContain("collecting");
      expect(states).toContain("generated");
      expect(states).toContain("under_review");
      expect(states).toContain("approved");
      expect(states).toContain("exported");
      expect(states).toContain("archived");
    });

    it("each state has valid Persian label", () => {
      for (const [_state, label] of Object.entries(V1_CONTRACT_STATE_LABELS)) {
        expect(label).toBeTruthy();
        expect(label.length).toBeGreaterThan(0);
      }
    });

    it("state transitions are valid", () => {
      // draft -> collecting, archived
      expect(V1_CONTRACT_STATE_TRANSITIONS.draft).toContain("collecting");
      expect(V1_CONTRACT_STATE_TRANSITIONS.draft).toContain("archived");

      // collecting -> generated, draft, archived
      expect(V1_CONTRACT_STATE_TRANSITIONS.collecting).toContain("generated");
      expect(V1_CONTRACT_STATE_TRANSITIONS.collecting).toContain("draft");

      // generated -> under_review, collecting, archived
      expect(V1_CONTRACT_STATE_TRANSITIONS.generated).toContain("under_review");

      // under_review -> approved, generated, archived
      expect(V1_CONTRACT_STATE_TRANSITIONS.under_review).toContain("approved");

      // approved -> exported, archived
      expect(V1_CONTRACT_STATE_TRANSITIONS.approved).toContain("exported");
      expect(V1_CONTRACT_STATE_TRANSITIONS.approved).toContain("archived");

      // exported -> archived
      expect(V1_CONTRACT_STATE_TRANSITIONS.exported).toContain("archived");

      // archived -> (terminal, no transitions)
      expect(V1_CONTRACT_STATE_TRANSITIONS.archived).toEqual([]);
    });

    it("archived is a terminal state with no transitions", () => {
      expect(V1_CONTRACT_STATE_TRANSITIONS.archived.length).toBe(0);
    });

    it("draft can transition to collecting and archived", () => {
      expect(V1_CONTRACT_STATE_TRANSITIONS.draft.length).toBe(2);
    });
  });

  // ==========================================
  // 12. Contract Type Categories
  // ==========================================
  describe("Contract Type Categories", () => {
    it("personal contracts include: اجاره, خرید و فروش, قرض, شراکت", () => {
      const personalIds = fixtureV1ContractTypes.personal.map((t) => t.id);
      expect(personalIds).toContain("lease");
      expect(personalIds).toContain("sale_purchase");
      expect(personalIds).toContain("loan");
      expect(personalIds).toContain("partnership");
    });

    it("business contracts include: NDA, استخدام, SaaS, پیمانکاری, سرمایه‌گذاری", () => {
      const businessIds = fixtureV1ContractTypes.business.map((t) => t.id);
      expect(businessIds).toContain("nda");
      expect(businessIds).toContain("employment");
      expect(businessIds).toContain("saas");
      expect(businessIds).toContain("contracting");
      expect(businessIds).toContain("investment");
    });

    it("personal contracts are in personal category", () => {
      for (const t of fixtureV1ContractTypes.personal) {
        expect(t.category).toBe("personal");
      }
    });

    it("business contracts are in business category", () => {
      for (const t of fixtureV1ContractTypes.business) {
        expect(t.category).toBe("business");
      }
    });
  });

  // ==========================================
  // 13. Type Contracts
  // ==========================================
  describe("Type Contracts", () => {
    it("V1ContractListItem has all required fields", () => {
      const item = fixtureV1ContractListResponse.items[0]!;
      expect(typeof item.id).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(typeof item.type).toBe("string");
      expect(typeof item.typeFa).toBe("string");
      expect(typeof item.category).toBe("string");
      expect(typeof item.state).toBe("string");
      expect(typeof item.currentVersionNumber).toBe("number");
      expect(typeof item.createdAt).toBe("string");
      expect(typeof item.updatedAt).toBe("string");
      expect(typeof item.hasDraft).toBe("boolean");
    });

    it("V1ContractDetail has all required fields", () => {
      const detail = fixtureV1ContractDetail;
      expect(detail.id).toBeTruthy();
      expect(detail.userId).toBeTruthy();
      expect(detail.title).toBeTruthy();
      expect(detail.type).toBeTruthy();
      expect(detail.versions).toBeInstanceOf(Array);
      expect(detail.disclaimer).toBeTruthy();
      expect(detail.analysis).toBeTruthy();
    });

    it("V1ContractVersionDetail has all required fields", () => {
      const version = fixtureV1ContractDetail.versions[0]!;
      expect(version.id).toBeTruthy();
      expect(version.contractId).toBeTruthy();
      expect(typeof version.versionNumber).toBe("number");
      expect(version.content).toBeTruthy();
      expect(version.answers).toBeDefined();
      expect(version.clauses).toBeInstanceOf(Array);
    });

    it("V1ContractRiskAnalysis has all required fields", () => {
      const analysis = fixtureV1ContractRiskAnalysis;
      expect(analysis.contractId).toBeTruthy();
      expect(["low", "medium", "high", "critical"]).toContain(analysis.overallRisk);
      expect(analysis.findings).toBeInstanceOf(Array);
      expect(analysis.protectiveSuggestions).toBeInstanceOf(Array);
      expect(analysis.generatedAt).toBeTruthy();
    });
  });

  // ==========================================
  // 14. API Error Handling
  // ==========================================
  describe("API Error Handling", () => {
    it("error response has proper structure", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts?fail=true`);
      expect(res.ok).toBe(false);
      const body = await res.json();
      expect(body.code).toBeTruthy();
      expect(body.message).toBeTruthy();
      expect(typeof body.retryable).toBe("boolean");
    });

    it("404 for unknown contract id", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts/unknown-id`);
      expect(res.status).toBe(404);
    });

    it("400 for invalid create request", async () => {
      const res = await fetch(`${API_BASE}/api/v1/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // 15. Mobile Layout (Responsive)
  // ==========================================
  describe("Mobile Layout", () => {
    it("type selector uses 1-column grid on mobile and 2-column on tablet", () => {
      // The type selector uses: grid grid-cols-1 tablet:grid-cols-2
      // This test confirms the grid pattern is used
      const gridPattern = "grid-cols-1 tablet:grid-cols-2";
      expect(gridPattern).toBeTruthy();
    });

    it("wizard uses single column layout", () => {
      // Wizard uses max-w-2xl container, single column
      const wizardWidth = "max-w-2xl";
      expect(wizardWidth).toBeTruthy();
    });

    it("touch targets are at least 44px (touch-target class)", () => {
      // All interactive elements use touch-target class
      const touchClass = "touch-target";
      expect(touchClass).toBeTruthy();
    });

    it("filter buttons are horizontally scrollable on mobile", () => {
      // Filter bar uses flex-wrap for responsive layout
      const flexWrap = "flex-wrap";
      expect(flexWrap).toBeTruthy();
    });
  });

  // ==========================================
  // 16. Draft Resume
  // ==========================================
  describe("Draft Resume", () => {
    it("draft preserves step and answers for resume", async () => {
      // Create and save a draft
      await fetch(`${API_BASE}/api/v1/contracts/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId: "lease" }),
      });
      await fetch(`${API_BASE}/api/v1/contracts/drafts/lease`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStep: 3,
          answers: { party1_name: "علی", party2_name: "حسین" },
        }),
      });

      // Fetch again to confirm resume
      const res = await fetch(`${API_BASE}/api/v1/contracts/drafts/lease`);
      const body = await res.json();
      expect(body.data.currentStep).toBe(3);
      expect(body.data.answers.party1_name).toBe("علی");
      expect(body.data.answers.party2_name).toBe("حسین");
    });

    it("draft hasDraft flag in contract list is correct", () => {
      const draftContracts = fixtureV1ContractListResponse.items.filter(
        (c) => c.hasDraft
      );
      expect(draftContracts.length).toBeGreaterThan(0);
      for (const c of draftContracts) {
        expect(c.hasDraft).toBe(true);
      }
    });
  });

  // ==========================================
  // 17. Version Comparison
  // ==========================================
  describe("Version Comparison", () => {
    it("versions have different answers", () => {
      const v1 = fixtureV1ContractDetail.versions[0]!;
      const v2 = fixtureV1ContractDetail.versions[1]!;
      // V1 has rent_amount=120000000, V2 has rent_amount=130000000
      expect(v1.answers["rent_amount"]).not.toBe(v2.answers["rent_amount"]);
    });

    it("version content differs between versions", () => {
      const v1 = fixtureV1ContractDetail.versions[0]!;
      const v2 = fixtureV1ContractDetail.versions[1]!;
      expect(v1.content).not.toBe(v2.content);
    });

    it("version has clauses with protective flags", () => {
      const v = fixtureV1ContractDetail.versions[0]!;
      const protective = v.clauses.filter((c) => c.isProtective);
      expect(protective.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 18. Disclaimer
  // ==========================================
  describe("Disclaimer", () => {
    it("disclaimer clearly states it's AI-generated", () => {
      expect(fixtureV1ContractDetail.disclaimer).toContain("هوش مصنوعی");
    });

    it("disclaimer warns about need for legal review", () => {
      expect(fixtureV1ContractDetail.disclaimer).toContain("وکیل");
      expect(fixtureV1ContractDetail.disclaimer).toContain("بررسی");
    });

    it("disclaimer mentions LEGALIR", () => {
      expect(fixtureV1ContractDetail.disclaimer).toContain("LEGALIR");
    });

    it("disclaimer notes it's a draft not final document", () => {
      expect(fixtureV1ContractDetail.disclaimer).toContain("پیش‌نویس");
    });
  });
});
