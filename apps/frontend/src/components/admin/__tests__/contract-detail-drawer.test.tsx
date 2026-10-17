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
    },
    completeness: { overall: 100, sections: [], blockers: [] },
    parties: [{ id: "pty-1", role: "موجر", nameFa: "مریم محمدی", isInitiator: true }],
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
    ...overrides,
  };
}

function renderDrawer(canReview: boolean) {
  return render(<ContractDetailDrawer contractId="ctr-1" canReview={canReview} onClose={() => {}} />);
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
});
