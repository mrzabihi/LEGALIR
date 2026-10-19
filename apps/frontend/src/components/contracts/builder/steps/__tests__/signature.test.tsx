// ============================================================
// LEGALIR — Signature step tests
// ============================================================
// The stage between the confirmed supplementary material and the final
// review workspace. These tests pin the facts the brief requires:
//
//   • the final version AND the supplementary note are shown before
//     anything is sent (§2.2/§2.3);
//   • the send confirmation names each party and the mobile ALREADY
//     registered on that party — the drafter never retypes a number;
//   • each party is tracked separately (sent / viewed / signed /
//     failed), and a failed delivery never reads as success;
//   • with no approval yet, sending is disabled and the reason is said.
// ============================================================

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import type {
  ContractCompleteness,
  ContractLifecycleView,
  ContractParty,
  PropertyContractDetail,
  PropertyContractVersion,
  SignatureInvitation,
  SignatureParticipant,
  SignatureRequestDetail,
} from "@legalir/types";
import type { ContractFeatureFlags } from "@/lib/contracts/feature-flags";
import { buildLifecycleSteps } from "@/lib/contracts/lifecycle";
import { getContractDefinition } from "@/lib/contracts/registry";
import { WizardProvider } from "../../wizard-context";
import { SignatureStep } from "../signature";

const API_BASE = "http://localhost:8000";
const NOTE_TEXT = "یادداشت تکمیلی یکتا — تمدید تلفنی معتبر نیست.";

function ok<T>(data: T) {
  return { data, meta: { requestId: "test-request-id" } };
}

// --- Fixtures ---------------------------------------------------------------

function party(id: string, role: string, first: string, last: string, mobile: string): ContractParty {
  return {
    id,
    contractId: "ctr-sig",
    role,
    capacity: "owner",
    identity: {
      firstName: first,
      lastName: last,
      fatherName: "پدر",
      nationalId: "0012345678",
      birthCertificateNumber: "1234",
      birthCertificatePlace: "تهران",
      birthDate: null,
      mobile,
      address: "تهران",
      postalCode: "1234567890",
    },
    personKind: "natural",
    nationality: "iranian",
    representativeOfPartyId: null,
    representativePositionFa: "",
    ownershipShare: null,
    powerOfAttorney: null,
    banking: null,
    isInitiator: true,
    createdAt: "2026-09-20T00:00:00.000Z",
  } as unknown as ContractParty;
}

function version(): PropertyContractVersion {
  return {
    id: "ver-2",
    contractId: "ctr-sig",
    versionNumber: 2,
    snapshot: {} as PropertyContractVersion["snapshot"],
    templateVersion: "1.0.0",
    schemaVersion: 1,
    documentHash: "a".repeat(64),
    createdBy: "usr-1",
    createdAt: "2026-10-01T00:00:00.000Z",
  };
}

function contract(overrides: Partial<PropertyContractDetail> = {}): PropertyContractDetail {
  const def = getContractDefinition("property_rent");
  return {
    id: "ctr-sig",
    referenceCode: "LGL-RENT-1405-000009",
    userId: "usr-1",
    domain: "property",
    type: "property_rent",
    typeFa: "اجاره‌نامه",
    state: "READY_TO_SIGN",
    initiatorRole: "landlord",
    initiatorSide: "first",
    title: "اجاره‌نامه آپارتمان",
    currentStep: "signature",
    progress: 100,
    templateVersion: "1.0.0",
    schemaVersion: 1,
    data: {
      ...def.createDefaultData("apartment"),
      customClauses: [],
      supplementary: { notes: NOTE_TEXT },
    },
    currentVersionId: "ver-2",
    currentVersionNumber: 2,
    finalVersionId: null,
    finalizedAt: null,
    publicVerificationId: null,
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    parties: [
      party("pty-landlord", "landlord", "علی", "رضایی", "09121110001"),
      party("pty-tenant", "tenant", "مریم", "محمدی", "09121110002"),
    ],
    payments: [],
    documents: [],
    versions: [version()],
    approvals: [],
    auditLog: [],
    ...overrides,
  } as unknown as PropertyContractDetail;
}

function completeness(): ContractCompleteness {
  return { overall: 100, sections: [], blockers: [] };
}

const FLAGS: ContractFeatureFlags = {
  CONTRACT_SIGNING_ENABLED: true,
  LAWYER_REVIEW_ENABLED: false,
  AI_CONTRACT_REVIEW_ENABLED: false,
  CERTIFIED_SIGNATURE_ENABLED: false,
  CONTRACT_STAMP_ENABLED: true,
};

function participants(): SignatureParticipant[] {
  return [
    {
      id: "p-1",
      signatureRequestId: "sr-1",
      contractId: "ctr-sig",
      partyId: "pty-landlord",
      roleFa: "موجر",
      nameFa: "علی رضایی",
      mobileMasked: "0912***0001",
      mobile: "09121110001",
      status: "VIEWED",
      viewedAt: "2026-10-02T09:00:00.000Z",
      signedAt: null,
      signedMethod: null,
      proofDocumentId: null,
      declinedAt: null,
      declineReason: null,
      createdAt: "2026-10-02T08:00:00.000Z",
    },
    {
      id: "p-2",
      signatureRequestId: "sr-1",
      contractId: "ctr-sig",
      partyId: "pty-tenant",
      roleFa: "مستأجر",
      nameFa: "مریم محمدی",
      mobileMasked: "0912***0002",
      mobile: "09121110002",
      status: "PENDING",
      viewedAt: null,
      signedAt: null,
      signedMethod: null,
      proofDocumentId: null,
      declinedAt: null,
      declineReason: null,
      createdAt: "2026-10-02T08:00:00.000Z",
    },
  ];
}

function invitation(participantId: string, failed: boolean): SignatureInvitation {
  return {
    id: `inv-${participantId}`,
    contractId: "ctr-sig",
    signatureRequestId: "sr-1",
    participantId,
    tokenHash: "b".repeat(64),
    recipientMasked: "0912***0002",
    status: "ACTIVE",
    verifyBeforeView: false,
    expiresAt: "2026-10-09T08:00:00.000Z",
    usedAt: null,
    revokedAt: null,
    createdAt: "2026-10-02T08:00:00.000Z",
    deliveryChannel: failed ? "none" : "sms",
    deliveryStatus: failed ? "FAILED" : "SENT",
    lastSentAt: "2026-10-02T08:00:00.000Z",
  };
}

function requestDetail(): SignatureRequestDetail {
  return {
    id: "sr-1",
    contractId: "ctr-sig",
    contractVersionId: "ver-2",
    documentHash: "a".repeat(64),
    provider: "OTP_SIGNATURE",
    assuranceLevel: "ELECTRONIC_CONFIRMATION",
    status: "SENT",
    expiresAt: null,
    createdBy: "usr-1",
    createdAt: "2026-10-02T08:00:00.000Z",
    updatedAt: "2026-10-02T08:00:00.000Z",
    completedAt: null,
    participants: participants(),
    events: [],
  };
}

function lifecycleView(
  overrides: Partial<ContractLifecycleView> = {}
): ContractLifecycleView & { flags: ContractFeatureFlags } {
  return {
    stage: "SIGNATURE",
    steps: buildLifecycleSteps("SIGNATURE"),
    registrationStatus: "NOT_REQUIRED",
    registrationStatusFa: "ثبت رسمی لازم نیست",
    signatureRequest: null,
    invitations: [],
    lawyerReview: null,
    aiReview: null,
    adminReview: null,
    adminApproved: true,
    stamped: false,
    officialStamp: null,
    comments: [],
    preSignTips: [],
    canPrepareForSignature: true,
    canSign: false,
    canFinalize: false,
    canSubmitForAdminReview: false,
    flags: FLAGS,
    ...overrides,
  };
}

// --- Harness ----------------------------------------------------------------

/**
 * The lifecycle query is stateful: until the `create_request` action is
 * accepted, the view has no request; afterwards it has the request and
 * its invitations, exactly as the server would report.
 */
function renderStep(
  options: { canPrepare?: boolean; secondDeliveryFailed?: boolean; alreadySent?: boolean } = {}
) {
  let sent = options.alreadySent ?? false;
  const actions: string[] = [];
  let lifecycleReads = 0;
  const view = (): ContractLifecycleView & { flags: ContractFeatureFlags } =>
    lifecycleView({
      canPrepareForSignature: options.canPrepare ?? true,
      signatureRequest: sent ? requestDetail() : null,
      invitations: sent ? [invitation("p-1", false), invitation("p-2", options.secondDeliveryFailed ?? false)] : [],
    });

  server.use(
    http.get(`${API_BASE}/api/v1/property-contracts/:id/lifecycle`, () => {
      lifecycleReads += 1;
      return HttpResponse.json(ok(view()));
    }),
    http.post(`${API_BASE}/api/v1/property-contracts/:id/sign`, async ({ request }) => {
      const body = (await request.json()) as { action: string };
      actions.push(body.action);
      if (body.action === "create_request") {
        sent = true;
        return HttpResponse.json(ok({ request: requestDetail(), version: version() }));
      }
      return HttpResponse.json(ok({}));
    }),
    http.post(`${API_BASE}/api/v1/property-contracts/:id/invitations`, async () => {
      actions.push("issue_invitations");
      sent = true;
      return HttpResponse.json(
        ok({
          invitations: [
            { participantId: "p-1", token: "tok-p1", expiresAt: "2026-10-09T08:00:00.000Z", delivered: true, channel: "sms", failureReasonFa: null },
            {
              participantId: "p-2",
              token: "tok-p2",
              expiresAt: "2026-10-09T08:00:00.000Z",
              delivered: !(options.secondDeliveryFailed ?? false),
              channel: options.secondDeliveryFailed ? null : "sms",
              failureReasonFa: options.secondDeliveryFailed ? "شمارهٔ ثبت‌شده در دسترس نیست" : null,
            },
          ],
          expiresAt: "2026-10-09T08:00:00.000Z",
        })
      );
    })
  );

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <WizardProvider contract={contract()} completeness={completeness()}>
        <div dir="rtl">
          <SignatureStep />
        </div>
      </WizardProvider>
    </QueryClientProvider>
  );

  return { actions, readCount: () => lifecycleReads };
}

afterEach(() => {
  server.resetHandlers();
});

// --- Tests ------------------------------------------------------------------

describe("SignatureStep — the facts before sending", () => {
  it("shows the final version number and the supplementary note", async () => {
    renderStep();

    expect(await screen.findByText("نسخهٔ نهایی برای امضا")).toBeInTheDocument();
    expect(screen.getByText("نسخه ۲")).toBeInTheDocument();
    // The note the parties are about to sign is printed here, verbatim.
    expect(screen.getByText(NOTE_TEXT)).toBeInTheDocument();
  });

  it("lists each party with its registered number and sends only after confirmation", async () => {
    const { actions } = renderStep();

    // Before sending, the step promises delivery to the registered number
    // — it never claims a message was already sent.
    expect((await screen.findAllByText("آمادهٔ ارسال به شمارهٔ ثبت‌شده")).length).toBe(2);
    expect(screen.queryByText(/^ارسال شد/)).toBeNull();

    // Sending stays disabled until the lifecycle view has really loaded —
    // the pre-send list alone is not proof the server state is here.
    const sendBtn = screen.getByRole("button", { name: "ارسال برای طرفین جهت امضا" });
    await waitFor(() => expect(sendBtn).not.toBeDisabled());
    fireEvent.click(sendBtn);

    // The confirmation dialog names both parties and the numbers already
    // stored on their party records.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/علی رضایی/)).toBeInTheDocument();
    expect(within(dialog).getByText("09121110001")).toBeInTheDocument();
    expect(within(dialog).getByText(/مریم محمدی/)).toBeInTheDocument();
    expect(within(dialog).getByText("09121110002")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "ارسال به همهٔ طرفین" }));

    // The request is created first, then the invitations are issued.
    await waitFor(() => expect(actions).toContain("issue_invitations"));
    expect(actions[0]).toBe("create_request");

    // Each party is tracked from its own server-reported state.
    expect(await screen.findByText("مشاهده شد — در انتظار امضا")).toBeInTheDocument();
    expect(screen.getByText("ارسال شد — در انتظار مشاهده")).toBeInTheDocument();
  });

  it("never reports a failed delivery as success and surfaces the raw link", async () => {
    renderStep({ secondDeliveryFailed: true });

    const sendBtn = screen.getByRole("button", { name: "ارسال برای طرفین جهت امضا" });
    await waitFor(() => expect(sendBtn).not.toBeDisabled());
    fireEvent.click(sendBtn);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "ارسال به همهٔ طرفین" }));

    // The failed party says so in plain words…
    expect(
      await screen.findByText("ارسال ناموفق — نیازمند ارسال مجدد")
    ).toBeInTheDocument();
    // …and only that party's manual link is shown for a hand-sent message.
    expect(screen.getByText("/contracts/sign/tok-p2")).toBeInTheDocument();
    // The delivered party keeps its own honest status (it has viewed the
    // document), and no row pretends the failed send succeeded.
    expect(screen.getByText("مشاهده شد — در انتظار امضا")).toBeInTheDocument();
    expect(screen.queryByText("ارسال شد — در انتظار مشاهده")).toBeNull();
  });

  it("disables sending and explains why until the version is approved", async () => {
    const { readCount } = renderStep({ canPrepare: false });

    // Wait for the real lifecycle answer: the refusal must come from the
    // server's approval state, not from the query merely being in flight.
    await waitFor(() => expect(readCount()).toBeGreaterThan(0));
    expect(await screen.findByText("هنوز امکان ارسال نیست")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ارسال برای طرفین جهت امضا" })
    ).toBeDisabled();
  });

  it("shows a signed party's real signing time", async () => {
    const view = lifecycleView({
      signatureRequest: {
        ...requestDetail(),
        participants: participants().map((p) =>
          p.id === "p-1"
            ? {
                ...p,
                status: "SIGNED" as const,
                signedAt: "2026-10-03T10:30:00.000Z",
                signedMethod: "OTP_ELECTRONIC" as const,
              }
            : p
        ),
      },
      invitations: [invitation("p-1", false), invitation("p-2", false)],
    });
    server.use(
      http.get(`${API_BASE}/api/v1/property-contracts/:id/lifecycle`, () =>
        HttpResponse.json(ok(view))
      )
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <WizardProvider contract={contract()} completeness={completeness()}>
          <div dir="rtl">
            <SignatureStep />
          </div>
        </WizardProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByText("امضا شد")).toBeInTheDocument();
    // The timestamp is rendered in Jalali, and the row is the real record.
    expect(screen.getByText(/زمان امضا:/)).toBeInTheDocument();
    expect(screen.getByText("۱ از ۲ طرف امضا کرده‌اند")).toBeInTheDocument();
  });
});
