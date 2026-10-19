// ============================================================
// LEGALIR — Admin contract review drawer · the DECISION surface (§6/§10)
// ============================================================
// §6 requires a compulsory admin approval, and §10 requires it be tested
// "in the UI and the backend". The backend half lives in
// lib/__tests__/admin-contract-review.test.ts; this is the UI half.
//
// The drawer is the operator's ONE surface for judging a contract. It
// must offer EXACTLY the four permitted actions, require a written reason
// for reject / request_info / cancel (never for approve), confirm the two
// destructive ones, and collapse to read-only without the review
// permission. The data hooks are mocked, so the test targets the drawer's
// contract with the API — not the network, which is covered server-side.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { AdminContractDetail } from "@/lib/api/admin";
import type { AdminContractReviewActionRequest } from "@legalir/types";

// Every decision the drawer actually submits, captured from the mutation.
const submitted = vi.hoisted(() => ({
  payloads: [] as { id: string; input: AdminContractReviewActionRequest }[],
}));

// The detail the mocked query returns; each test sets it before render.
const state = vi.hoisted(() => ({
  detail: null as AdminContractDetail | null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/contracts",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/hooks/useAdmin", () => ({
  // The drawer reads the stamp permissions from `useAdminMe`. The review
  // decision itself is gated on the `canReview` prop, so denying every
  // permission here keeps these tests focused on the decision surface.
  useAdminMe: () => ({ can: () => false, role: null, isStaff: false }),
  useAdminContract: (id: string | null) => ({
    data: id ? state.detail : undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useAdminContractReview: () => ({
    mutateAsync: vi.fn(async (vars: { id: string; input: AdminContractReviewActionRequest }) => {
      submitted.payloads.push(vars);
      return { contract: {}, review: {}, approved: false };
    }),
    isPending: false,
  }),
  // Attestations are evidence ABOUT a signature; these tests cover the
  // review decision, so the mutation is inert here.
  useAdminContractAttestation: () => ({
    mutateAsync: vi.fn(async () => ({})),
    isPending: false,
  }),
  // Per-party resend (§5) — inert here; these tests cover the decision surface.
  useAdminResendInvitations: () => ({
    mutateAsync: vi.fn(async () => ({ invitations: [], revokedInvitationIds: [] })),
    isPending: false,
  }),
}));

import { ContractDetailDrawer } from "@/components/admin/contract-detail-drawer";

function detail(overrides: Partial<AdminContractDetail> = {}): AdminContractDetail {
  return {
    contract: {
      id: "ctr-1",
      referenceCode: "LGL-RENT-1405-000001",
      type: "property_rent",
      typeFa: "اجاره‌نامه",
      title: "اجاره‌نامه آپارتمان",
      state: "PENDING_ADMIN_REVIEW",
      stateFa: "در انتظار بررسی",
      progress: 100,
      ownerLabelFa: "کاربر لیگالیر",
      partySummaryFa: "مریم محمدی و رضا کریمی",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      isSample: false,
    },
    completeness: { overall: 100, sections: [], blockers: [] },
    parties: [
      { id: "pty-1", role: "landlord", roleFa: "موجر", nameFa: "مریم محمدی", isInitiator: true },
    ],
    currentVersion: {
      id: "ver-1",
      versionNumber: 1,
      documentHash: "a".repeat(64),
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    versions: [],
    rendered: { titleFa: "اجاره‌نامه", preambleFa: "", clauses: [], footerFa: "" },
    legalBasis: {
      disclaimerFa: "پیوست غیرالزام‌آور",
      citedClauseCount: 0,
      uncitedClauseCount: 0,
      sections: [],
      hasPendingCitations: false,
      flaggedClauses: [],
    },
    // §7 — the type's legal-review report, rendered as its own section.
    legalReview: {
      typeId: "property_rent",
      clauses: [],
      knownClauses: [],
      tips: [],
      reviewedClauseCount: 0,
      pendingClauseCount: 0,
      needsRevisionCount: 0,
      unflaggedCount: 0,
    },
    comments: [],
    adminReview: {
      id: "arev-1",
      contractId: "ctr-1",
      contractVersionId: "ver-1",
      documentHash: "a".repeat(64),
      status: "PENDING",
      reviewerId: null,
      reviewerLabelFa: null,
      reviewerInitials: null,
      reviewingOfficeFa: "واحد بررسی حقوقی لیگالیر",
      reasonFa: "",
      submittedAt: "2026-01-01T00:00:00.000Z",
      decidedAt: null,
      expiresAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      events: [],
    },
    approved: false,
    stamp: { applied: false, text: "لیـــــــگالیر - بررسی شد", disclaimerFa: "..." },
    supplementary: {
      notes: "",
      noteConfirmedAt: null,
      attachments: [],
      attachmentsConfirmedAt: null,
      confirmedAt: null,
    },
    customClauses: [],
    approvals: [],
    signatureRequest: null,
    signatureRequests: [],
    attestations: [],
    finalDocument: null,
    ...overrides,
  };
}

function renderDrawer(canReview: boolean) {
  return render(
    <ContractDetailDrawer contractId="ctr-1" canReview={canReview} onClose={vi.fn()} />
  );
}

beforeEach(() => {
  submitted.payloads.length = 0;
  state.detail = detail();
});

describe("ContractDetailDrawer — the admin decision surface (§6/§10)", () => {
  it("offers EXACTLY the four permitted actions while a review is PENDING", async () => {
    renderDrawer(true);

    expect(await screen.findByRole("button", { name: "تأیید برای صدور نهایی" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "درخواست اصلاح" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "رد" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "لغو بررسی" })).toBeInTheDocument();
  });

  it("submits an approve with NO reason — approval is never gated on a note", async () => {
    renderDrawer(true);

    fireEvent.click(await screen.findByRole("button", { name: "تأیید برای صدور نهایی" }));

    await waitFor(() => expect(submitted.payloads).toHaveLength(1));
    expect(submitted.payloads[0]!.input).toEqual({ action: "approve" });
    expect(submitted.payloads[0]!.input.reason).toBeUndefined();
  });

  it("requires a written reason for reject and only submits after confirmation", async () => {
    renderDrawer(true);

    // Reject opens the reason field instead of submitting straight away.
    fireEvent.click(await screen.findByRole("button", { name: "رد" }));
    const textarea = await screen.findByPlaceholderText("دلیل یا توضیح لازم را بنویسید…");

    // A reason shorter than 3 chars is refused — nothing is submitted.
    fireEvent.change(textarea, { target: { value: "بو" } });
    fireEvent.click(screen.getByRole("button", { name: "ثبت «رد قرارداد»" }));
    expect(submitted.payloads).toHaveLength(0);

    // A valid reason then opens the destructive confirm dialog. The
    // drawer itself is ALSO a role="dialog", so we cannot query by role
    // alone — the confirm dialog's «ثبت تصمیم» button is its unique proof.
    fireEvent.change(textarea, { target: { value: "سند مالکیت ناخوانا است." } });
    fireEvent.click(screen.getByRole("button", { name: "ثبت «رد قرارداد»" }));

    // Nothing is submitted until the operator confirms in that dialog.
    const confirmButton = await screen.findByRole("button", { name: "ثبت تصمیم" });
    expect(submitted.payloads).toHaveLength(0);
    fireEvent.click(confirmButton);

    await waitFor(() => expect(submitted.payloads).toHaveLength(1));
    expect(submitted.payloads[0]!.input).toEqual({
      action: "reject",
      reason: "سند مالکیت ناخوانا است.",
    });
  });

  it("collapses to read-only without the review permission — no decision buttons", async () => {
    renderDrawer(false);

    expect(
      await screen.findByText(/شما مجوز «تأیید\/رد و بررسی قراردادها» را ندارید/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "تأیید برای صدور نهایی" })).toBeNull();
    expect(screen.queryByRole("button", { name: "رد" })).toBeNull();
    expect(screen.queryByRole("button", { name: "درخواست اصلاح" })).toBeNull();
    expect(screen.queryByRole("button", { name: "لغو بررسی" })).toBeNull();
  });

  // ----------------------------------------------------------
  // §2.4 — the record, not just the decision surface
  // ----------------------------------------------------------

  it("prints the supplementary note verbatim with the time it was confirmed", async () => {
    const NOTE = "یادداشت تکمیلی یکتا — تمدید تلفنی معتبر نیست.";
    state.detail = detail({
      supplementary: {
        notes: NOTE,
        noteConfirmedAt: "2026-01-02T09:00:00.000Z",
        attachments: [],
        attachmentsConfirmedAt: null,
        confirmedAt: "2026-01-02T09:05:00.000Z",
      },
    });
    renderDrawer(true);

    expect(await screen.findByText(NOTE)).toBeInTheDocument();
    expect(screen.getByText(/تأیید یادداشت/)).toBeInTheDocument();
    // It is labelled as printing at the end, separate from the clauses.
    expect(screen.getByText(/در پایان سند و جدا از مواد قرارداد چاپ می‌شود/)).toBeInTheDocument();
  });

  it("says plainly when no note exists — nothing is printed in that case", async () => {
    renderDrawer(true);

    expect(
      await screen.findByText(/یادداشت تکمیلی ثبت نشده است؛ در این حالت هیچ بخشی/)
    ).toBeInTheDocument();
  });

  it("lists EVERY version, marking the current and the final one — never collapsing", async () => {
    state.detail = detail({
      currentVersion: {
        id: "ver-2",
        versionNumber: 2,
        documentHash: "b".repeat(64),
        createdAt: "2026-01-03T00:00:00.000Z",
      },
      versions: [
        {
          id: "ver-2",
          versionNumber: 2,
          documentHash: "b".repeat(64),
          templateVersion: "1.0.0",
          createdAt: "2026-01-03T00:00:00.000Z",
          isCurrent: true,
          isFinal: true,
        },
        {
          id: "ver-1",
          versionNumber: 1,
          documentHash: "a".repeat(64),
          templateVersion: "1.0.0",
          createdAt: "2026-01-01T00:00:00.000Z",
          isCurrent: false,
          isFinal: false,
        },
      ],
    });
    renderDrawer(true);

    expect(await screen.findByText(/تاریخچهٔ نسخه‌ها/)).toBeInTheDocument();
    // Both versions survive — the superseded draft is still on record.
    expect(screen.getByText("نسخه ۲")).toBeInTheDocument();
    expect(screen.getByText("نسخه ۱")).toBeInTheDocument();
    expect(screen.getByText("جاری")).toBeInTheDocument();
    expect(screen.getByText("نهایی")).toBeInTheDocument();
  });

  it("distinguishes an agreed clause from a requested change", async () => {
    state.detail = detail({
      customClauses: [
        {
          id: "cc-1",
          kind: "agreement",
          title: "بند توافقی یکتا",
          body: "متن بند توافقی.",
          sectionRef: "financial",
          sectionTitleFa: "شرایط مالی",
          createdAt: "2026-01-02T00:00:00.000Z",
        },
        {
          id: "cc-2",
          kind: "change_request",
          title: "درخواست تغییر یکتا",
          body: "متن درخواست تغییر.",
          sectionRef: null,
          sectionTitleFa: null,
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    renderDrawer(true);

    expect(await screen.findByText("بند توافقی یکتا")).toBeInTheDocument();
    expect(screen.getByText("درخواست تغییر یکتا")).toBeInTheDocument();
    expect(screen.getByText("بند توافقی")).toBeInTheDocument();
    expect(screen.getByText("درخواست تغییر")).toBeInTheDocument();
    expect(screen.getByText(/بخش مرتبط: شرایط مالی/)).toBeInTheDocument();
  });

  it("tracks each signing party separately and never reports a failed delivery as sent", async () => {
    state.detail = detail({
      versions: [
        {
          id: "ver-1",
          versionNumber: 1,
          documentHash: "a".repeat(64),
          templateVersion: "1.0.0",
          createdAt: "2026-01-01T00:00:00.000Z",
          isCurrent: true,
          isFinal: false,
        },
      ],
      signatureRequest: {
        id: "sr-1",
        contractId: "ctr-1",
        contractVersionId: "ver-1",
        documentHash: "a".repeat(64),
        provider: "OTP_SIGNATURE",
        assuranceLevel: "ELECTRONIC_CONFIRMATION",
        status: "SENT",
        expiresAt: null,
        createdBy: "usr-1",
        createdAt: "2026-01-02T08:00:00.000Z",
        updatedAt: "2026-01-02T08:00:00.000Z",
        completedAt: null,
        statusFa: "ارسال‌شده",
        events: [],
        participants: [
          {
            id: "p-1",
            signatureRequestId: "sr-1",
            contractId: "ctr-1",
            partyId: "pty-1",
            roleFa: "موجر",
            nameFa: "مریم محمدی",
            mobileMasked: "0912***0001",
            mobile: "09121110001",
            status: "SIGNED",
            viewedAt: "2026-01-02T09:00:00.000Z",
            signedAt: "2026-01-03T09:00:00.000Z",
            signedMethod: "OTP_ELECTRONIC",
            proofDocumentId: null,
            declinedAt: null,
            declineReason: null,
            createdAt: "2026-01-02T08:00:00.000Z",
            statusFa: "امضا‌شده",
          },
          {
            id: "p-2",
            signatureRequestId: "sr-1",
            contractId: "ctr-1",
            partyId: null,
            roleFa: "مستأجر",
            nameFa: "رضا کریمی",
            mobileMasked: "0912***0002",
            mobile: "09121110002",
            status: "PENDING",
            viewedAt: null,
            signedAt: null,
            signedMethod: null,
            proofDocumentId: null,
            declinedAt: null,
            declineReason: null,
            createdAt: "2026-01-02T08:00:00.000Z",
            statusFa: "در انتظار",
          },
        ],
        invitations: [
          {
            id: "inv-1",
            participantId: "p-1",
            recipientMasked: "0912***0001",
            status: "USED",
            deliveryChannel: "sms",
            deliveryStatus: "SENT",
            lastSentAt: "2026-01-02T08:00:00.000Z",
            expiresAt: "2026-01-09T08:00:00.000Z",
            usedAt: "2026-01-03T09:00:00.000Z",
            revokedAt: null,
          },
          {
            id: "inv-2",
            participantId: "p-2",
            recipientMasked: "0912***0002",
            status: "ACTIVE",
            deliveryChannel: "none",
            deliveryStatus: "FAILED",
            lastSentAt: "2026-01-02T08:00:00.000Z",
            expiresAt: "2026-01-09T08:00:00.000Z",
            usedAt: null,
            revokedAt: null,
          },
        ],
      },
    });
    renderDrawer(true);

    expect(await screen.findByText(/درخواست امضا و وضعیت هر طرف/)).toBeInTheDocument();
    // Each party keeps its own real status.
    expect(screen.getByText("امضا‌شده")).toBeInTheDocument();
    expect(screen.getByText("در انتظار")).toBeInTheDocument();
    // The signed party's real time and method are shown.
    expect(screen.getByText(/امضا:/)).toBeInTheDocument();
    expect(screen.getByText(/امضای الکترونیکی \(کد یک‌بارمصرف پیامکی\)/)).toBeInTheDocument();
    // The failed delivery is stated as a failure, never as sent.
    expect(screen.getByText(/ارسال دعوت ناموفق بود/)).toBeInTheDocument();
  });

  it("shows party approvals with the version they approved and their time", async () => {
    state.detail = detail({
      approvals: [
        {
          id: "ap-1",
          contractVersionId: "ver-1",
          partyId: "pty-1",
          partyRoleFa: "موجر",
          partyNameFa: "مریم محمدی",
          status: "approved",
          comment: "",
          method: "explicit_consent",
          approvedAt: "2026-01-04T10:00:00.000Z",
          createdAt: "2026-01-04T09:00:00.000Z",
        },
      ],
    });
    renderDrawer(true);

    expect(await screen.findByText(/تأییدهای طرفین/)).toBeInTheDocument();
    expect(screen.getByText(/تأیید شد/)).toBeInTheDocument();
    expect(screen.getByText(/نسخه ۱/)).toBeInTheDocument();
  });

  it("hides the decision panel once the review is no longer PENDING", async () => {
    // A decided review is terminal: the decision can never be replayed.
    state.detail = detail({
      adminReview: { ...detail().adminReview!, status: "APPROVED" },
      approved: true,
    });
    renderDrawer(true);

    await screen.findByText(/آخرین تصمیم/);
    expect(screen.queryByRole("button", { name: "تأیید برای صدور نهایی" })).toBeNull();
  });

  // ----------------------------------------------------------
  // §4/§7 — the operator must SEE the stamped artifact
  // ----------------------------------------------------------

  it("says the stamped artifact does not exist yet — never implies a sealed copy", async () => {
    renderDrawer(true);

    expect(await screen.findByText(/سند نهایی و مهر رسمی/)).toBeInTheDocument();
    expect(
      screen.getByText(/سند نهایی هنوز تولید نشده است/),
    ).toBeInTheDocument();
    expect(screen.queryByTitle(/سند نهایی/)).toBeNull();
  });

  it("opens the stored final PDF the moment it exists, and reports the seal binding", async () => {
    state.detail = detail({
      finalDocument: {
        documentId: "doc-final-1",
        fileName: "LGL-RENT-1405-000001-final.pdf",
        sizeBytes: 4_349_543,
        hash: "c".repeat(64),
        uploadedAt: "2026-01-05T11:00:00.000Z",
        sealed: true,
        sealAssetVersion: "seal-2026-01",
        sealedAt: "2026-01-05T10:57:29.000Z",
        url: "/api/v1/admin/contracts/ctr-1/final-document",
        downloadUrl: "/api/v1/admin/contracts/ctr-1/final-document?download=1",
      },
    });
    renderDrawer(true);

    // The document is shown inline from the ADMIN route — the owner-facing
    // route is owner-scoped, so an operator could not open it.
    const frame = await screen.findByTitle(/سند نهایی LGL-RENT-1405-000001-final\.pdf/);
    expect(frame.getAttribute("src")).toBe(
      "/api/v1/admin/contracts/ctr-1/final-document",
    );

    // The seal + hologram claim is the reason this section exists.
    expect(
      screen.getByText("مهر رسمی + هولوگرام روی همهٔ صفحات"),
    ).toBeInTheDocument();

    // Evidence is downloadable, and the hash is printed verbatim so the
    // operator can match the bytes against the finalization record.
    const download = screen.getByRole("link", { name: /دانلود نسخهٔ مهرشده/ });
    expect(download.getAttribute("href")).toBe(
      "/api/v1/admin/contracts/ctr-1/final-document?download=1",
    );
    expect(screen.getByText("c".repeat(64))).toBeInTheDocument();
    expect(screen.getByText("seal-2026-01")).toBeInTheDocument();
  });

  it("flags a stored artifact whose stamp is no longer bound to the final hash", async () => {
    state.detail = detail({
      finalDocument: {
        documentId: "doc-final-1",
        fileName: "final.pdf",
        sizeBytes: 1024,
        hash: "d".repeat(64),
        uploadedAt: "2026-01-05T11:00:00.000Z",
        sealed: false,
        sealAssetVersion: null,
        sealedAt: null,
        url: "/api/v1/admin/contracts/ctr-1/final-document",
        downloadUrl: "/api/v1/admin/contracts/ctr-1/final-document?download=1",
      },
    });
    renderDrawer(true);

    expect(await screen.findByText("بدون مهر معتبر")).toBeInTheDocument();
    expect(
      screen.getByText(/مهر رسمی آن دیگر به محتوای فعلی گره نخورده/),
    ).toBeInTheDocument();
  });
});
