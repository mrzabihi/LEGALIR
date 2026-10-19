// ============================================================
// LEGALIR — ReviewStep (lifecycle workspace) component tests
// ============================================================
// The lifecycle workspace is client-rendered, so the §127/§128 UI
// requirements cannot be verified by curling the page. These tests pin
// them at the component level:
//
//   • the five-stage stepper is drawn from the server's view
//   • the stage owns preview + review ONLY: two OPTIONAL support paths and
//     exactly ONE primary action. The signing act belongs to the next step
//     and the archive to the one after it, so no stage is drawn twice.
//   • the AI review is labelled as AI analysis, never a lawyer's opinion
//   • the registration policy comes from the registry, not hard-coded
//   • the freeze action is offered while no version exists
// ============================================================

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import type {
  AiContractReview,
  ContractCompleteness,
  ContractLifecycleView,
  PropertyContractDetail,
  PropertyContractVersion,
  SignatureRequestDetail,
} from "@legalir/types";
import { buildLifecycleSteps } from "@/lib/contracts/lifecycle";
import { getContractDefinition } from "@/lib/contracts/registry";
import type { ContractFeatureFlags } from "@/lib/contracts/feature-flags";
import { WizardProvider } from "../wizard-context";
import { ReviewStep } from "../steps/review";

const API_BASE = "http://localhost:8000";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "ctr-1" }),
  usePathname: () => "/contracts/ctr-1",
  useSearchParams: () => new URLSearchParams(),
}));

function ok<T>(data: T) {
  return { data, meta: { requestId: "test-request-id" } };
}

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

function version(): PropertyContractVersion {
  return {
    id: "ver-1",
    contractId: "ctr-1",
    versionNumber: 1,
    snapshot: {} as PropertyContractVersion["snapshot"],
    templateVersion: "1.0.0",
    schemaVersion: 1,
    documentHash: "a".repeat(64),
    createdBy: "usr-1",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function contract(overrides: Partial<PropertyContractDetail> = {}): PropertyContractDetail {
  const def = getContractDefinition("property_rent");
  return {
    id: "ctr-1",
    referenceCode: "LGL-RENT-1405-000001",
    userId: "usr-1",
    domain: "property",
    type: "property_rent",
    typeFa: "اجاره‌نامه",
    state: "READY_FOR_REVIEW",
    initiatorRole: "landlord",
    initiatorSide: "first",
    title: "اجاره‌نامه آپارتمان",
    currentStep: "review",
    progress: 100,
    templateVersion: "1.0.0",
    schemaVersion: 1,
    data: def.createDefaultData("apartment"),
    currentVersionId: "ver-1",
    currentVersionNumber: 1,
    finalVersionId: null,
    finalizedAt: null,
    publicVerificationId: "pub-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    parties: [],
    payments: [],
    documents: [],
    versions: [version()],
    approvals: [],
    auditLog: [],
    ...overrides,
  };
}

function completeness(overall = 100): ContractCompleteness {
  return { overall, sections: [], blockers: [] };
}

const FLAGS: ContractFeatureFlags = {
  CONTRACT_SIGNING_ENABLED: true,
  LAWYER_REVIEW_ENABLED: true,
  AI_CONTRACT_REVIEW_ENABLED: true,
  CERTIFIED_SIGNATURE_ENABLED: false,
  CONTRACT_STAMP_ENABLED: true,
};

function lifecycleView(
  overrides: Partial<ContractLifecycleView> = {}
): ContractLifecycleView & { flags: ContractFeatureFlags } {
  return {
    stage: "REVIEW",
    steps: buildLifecycleSteps("REVIEW"),
    registrationStatus: "NOT_REQUIRED",
    registrationStatusFa: "ثبت رسمی لازم نیست",
    signatureRequest: null,
    invitations: [],
    lawyerReview: null,
    aiReview: null,
    adminReview: null,
    adminApproved: false,
    stamped: false,
    officialStamp: null,
    comments: [],
    // §7 — informational only; no test here asserts on the tips itself.
    preSignTips: [],
    canPrepareForSignature: false,
    canSign: false,
    canFinalize: false,
    canSubmitForAdminReview: false,
    flags: FLAGS,
    ...overrides,
  };
}

function completedRequest(): SignatureRequestDetail {
  return {
    id: "sr-1",
    contractId: "ctr-1",
    contractVersionId: "ver-1",
    documentHash: "a".repeat(64),
    provider: "OTP_SIGNATURE",
    assuranceLevel: "ELECTRONIC_CONFIRMATION",
    status: "COMPLETED",
    expiresAt: null,
    createdBy: "usr-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    completedAt: "2026-01-02T00:00:00.000Z",
    participants: [
      {
        id: "p-1",
        signatureRequestId: "sr-1",
        contractId: "ctr-1",
        partyId: null,
        roleFa: "موجر",
        nameFa: "علی رضایی",
        mobileMasked: "0912***0003",
        mobile: "09120000003",
        status: "SIGNED",
        viewedAt: null,
        signedAt: "2026-01-02T00:00:00.000Z",
        signedMethod: "OTP_ELECTRONIC",
        proofDocumentId: null,
        declinedAt: null,
        declineReason: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    events: [],
  };
}

function aiReview(): AiContractReview {
  return {
    id: "ai-1",
    contractId: "ctr-1",
    contractVersionId: "ver-1",
    conversationId: "conv-1",
    messageId: "msg-1",
    perspectiveRoleFa: "موجر",
    summaryFa: "این قرارداد از دید موجر متوازن است.",
    citations: [],
    isAiAnalysis: true,
    createdAt: "2026-01-02T00:00:00.000Z",
  };
}

// ------------------------------------------------------------
// Harness
// ------------------------------------------------------------

function renderStep(
  c: PropertyContractDetail,
  view: ContractLifecycleView & { flags: ContractFeatureFlags }
) {
  server.use(
    http.get(`${API_BASE}/api/v1/property-contracts/:id/lifecycle`, () =>
      HttpResponse.json(ok(view))
    )
  );

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WizardProvider contract={c} completeness={completeness()}>
        <div dir="rtl">
          <ReviewStep />
        </div>
      </WizardProvider>
    </QueryClientProvider>
  );
}

/** The one card this stage owns: optional support paths + ONE action. */
async function reviewSection(): Promise<HTMLElement> {
  const description = await screen.findByText(
    "در صورت نیاز از این دو مسیر کمکی استفاده کنید؛ اجباری نیستند"
  );
  return description.closest("section")!;
}

describe("ReviewStep — lifecycle workspace (§127/§128)", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it("draws the five-stage stepper from the server's view", async () => {
    renderStep(contract(), lifecycleView());

    const rail = await screen.findByRole("list", { name: "مراحل قرارداد" });
    // A pending step renders its index number inside the button, so the
    // label is the trailing text after any leading digit.
    const labels = within(rail)
      .getAllByRole("button")
      .map((b) => b.textContent?.trim().replace(/^\d+/, ""));
    expect(labels).toEqual(["اطلاعات", "پیش‌نمایش", "بررسی", "امضا", "تکمیل"]);
  });

  it("offers two OPTIONAL support paths and exactly ONE primary action", async () => {
    renderStep(contract(), lifecycleView());

    const section = await reviewSection();
    const buttons = within(section).getAllByRole("button");

    // Exactly three: the two optional support paths, then the one
    // committing action. A fourth button would mean two competing primaries
    // — the confusion this stage was simplified to remove.
    expect(buttons).toHaveLength(3);
    expect(buttons[0]!.textContent).toContain("پرسش از دستیار هوشمند");
    expect(buttons[1]!.textContent).toContain("بررسی توسط وکیل");
    // The support paths are also explicitly marked optional in the copy.
    expect(within(section).getByText(/اجباری نیستند/)).toBeInTheDocument();
  });

  it("hands over to the signing step when the version is already approved", async () => {
    renderStep(contract(), lifecycleView({ canSubmitForAdminReview: false }));

    const section = await reviewSection();
    // One action, and it is the hand-over — never a second «submit» beside
    // it, and never the signing act itself (that step owns it).
    expect(within(section).getAllByRole("button")).toHaveLength(3);
    expect(within(section).getByText("ادامه به امضای طرفین")).toBeInTheDocument();
    expect(within(section).queryByText("ارسال به بررسی لیگالیر")).toBeNull();
  });

  it("offers the admin-review submit while the version is still unapproved", async () => {
    renderStep(contract(), lifecycleView({ canSubmitForAdminReview: true }));

    const section = await reviewSection();
    // The card's copy is static, so it renders before the lifecycle query
    // resolves. Wait for the view-driven label before asserting on the
    // action slot, or the pre-load branch is what gets measured.
    expect(await within(section).findByText("ارسال به بررسی لیگالیر")).toBeInTheDocument();
    expect(within(section).getAllByRole("button")).toHaveLength(3);
    // The hand-over is NOT offered at the same time. After approval the
    // action flips to it — one primary, one state.
    expect(within(section).queryByText("ادامه به امضای طرفین")).toBeNull();
  });

  it("never draws the signing panel or the finalize action in this stage", async () => {
    renderStep(
      contract({ state: "SIGNED" }),
      lifecycleView({
        stage: "COMPLETE",
        steps: buildLifecycleSteps("COMPLETE"),
        signatureRequest: completedRequest(),
        canFinalize: true,
      })
    );

    await reviewSection();
    // Signing belongs to the «امضای طرفین» step and archiving to
    // «نسخه نهایی»; duplicating them here is the duplicated-stage defect.
    expect(screen.queryByText("تأیید و امضای الکترونیکی")).toBeNull();
    expect(screen.queryByText("نهایی‌سازی قرارداد")).toBeNull();
  });

  it("labels the AI review as AI analysis, never a lawyer's opinion", async () => {
    renderStep(contract(), lifecycleView({ aiReview: aiReview() }));

    expect(await screen.findByText("این تحلیل هوش مصنوعی است")).toBeInTheDocument();
    expect(screen.getByText("این متن جایگزین نظر وکیل نیست.")).toBeInTheDocument();
  });

  it("shows the registration policy from the registry, not a hard-coded string", async () => {
    renderStep(contract(), lifecycleView());

    const def = getContractDefinition("property_rent");
    expect(await screen.findByText(def.registrationPolicy.explanationFa)).toBeInTheDocument();
  });

  it("offers the freeze action while no version exists yet", async () => {
    renderStep(
      contract({ currentVersionId: null, currentVersionNumber: 0, versions: [] }),
      lifecycleView({ stage: "PREVIEW", steps: buildLifecycleSteps("PREVIEW") })
    );

    expect(await screen.findByText("تثبیت نسخه و ارسال برای بررسی")).toBeInTheDocument();
  });
});
