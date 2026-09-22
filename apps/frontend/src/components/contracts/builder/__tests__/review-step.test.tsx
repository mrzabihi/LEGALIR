// ============================================================
// LEGALIR — ReviewStep (lifecycle workspace) component tests
// ============================================================
// The lifecycle workspace is client-rendered, so the §127/§128 UI
// requirements cannot be verified by curling the page. These tests pin
// them at the component level:
//
//   • the five-stage stepper is drawn from the server's view
//   • under Preview there are EXACTLY three primary choices
//   • the signature is labelled «تأیید و امضای الکترونیکی» and is
//     explicitly disclaimed as NOT «مطمئن» / «رسمی»
//   • a COMPLETED request stays visible (the audit record, not a
//     transient in-flight state) and finalization is offered
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
    lawyerReview: null,
    aiReview: null,
    comments: [],
    canPrepareForSignature: false,
    canSign: false,
    canFinalize: false,
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
        mobileMasked: "0912***0003",
        mobile: "09120000003",
        status: "SIGNED",
        viewedAt: null,
        signedAt: "2026-01-02T00:00:00.000Z",
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

/** The section that holds the three primary choices. */
async function primaryChoicesSection(): Promise<HTMLElement> {
  const description = await screen.findByText(
    "پس از تکمیل اطلاعات، یکی از این سه مسیر را انتخاب کنید"
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

  it("offers exactly the three primary choices under Preview", async () => {
    renderStep(contract(), lifecycleView());

    const section = await primaryChoicesSection();
    const buttons = within(section).getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(buttons.map((b) => b.textContent)).toEqual([
      expect.stringContaining("پرسش از دستیار هوشمند"),
      expect.stringContaining("بررسی توسط وکیل"),
      expect.stringContaining("آماده‌سازی برای امضا"),
    ]);
  });

  it("labels the signature «تأیید و امضای الکترونیکی» and disclaims secure/official equivalence", async () => {
    renderStep(
      contract({ state: "READY_TO_SIGN" }),
      lifecycleView({
        stage: "SIGNATURE",
        steps: buildLifecycleSteps("SIGNATURE"),
        signatureRequest: completedRequest(),
        canSign: true,
      })
    );

    const heading = await screen.findByText("تأیید و امضای الکترونیکی");
    const panel = heading.closest("section")!;

    // The assurance wording is the OTP one, and the panel states in
    // plain words that it is NOT the same as a secure/official signature.
    expect(within(panel).getByText(/یکسان نیست/)).toBeInTheDocument();
    expect(within(panel).getByText(/امضای الکترونیکی مطمئن/)).toBeInTheDocument();
  });

  it("keeps the signature panel and the finalize action visible after the request is COMPLETED", async () => {
    renderStep(
      contract({ state: "SIGNED" }),
      lifecycleView({
        stage: "COMPLETE",
        steps: buildLifecycleSteps("COMPLETE"),
        signatureRequest: completedRequest(),
        canFinalize: true,
      })
    );

    // The participant list is the record of what happened — it must not
    // vanish once the request reaches a terminal status.
    const heading = await screen.findByText("تأیید و امضای الکترونیکی");
    const panel = heading.closest("section")!;
    expect(within(panel).getByText("موجر")).toBeInTheDocument();
    expect(within(panel).getByText("امضا شده")).toBeInTheDocument();

    expect(screen.getByText("نهایی‌سازی قرارداد")).toBeInTheDocument();
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
