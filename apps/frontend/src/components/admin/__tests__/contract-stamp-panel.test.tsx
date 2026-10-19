// ============================================================
// LEGALIR — Admin · official stamp panel (§9.2 / §9.3)
// ============================================================
// The panel is the ONE surface that can authorise the OFFICIAL LEGALIR
// mark. These tests pin the two behaviours the operator report demanded:
//
//   • a disabled button ALWAYS shows the real, server-authored reason;
//   • `apply` is a recorded act behind a mandatory confirmation that
//     names the contract, the exact version and its fingerprint.
//
// The hooks are mocked, so this targets the panel's contract with the API
// (render the verdict verbatim, post the recorded reason) — not the
// network, which is covered by the route tests. Every fixture is test
// data: no real contract, hash or asset is involved.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MockInstance } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { snackbar } from "@legalir/ui";
import type {
  ContractStampActionRequest,
  ContractStampContextResponse,
  ContractStampDecisionResponse,
  ContractStampRequestDetail,
} from "@legalir/types";

// Every stamp decision the panel submits, captured from the mutation.
const state = vi.hoisted(() => ({
  context: null as ContractStampContextResponse | null,
  payloads: [] as { id: string; input: ContractStampActionRequest }[],
  response: null as ContractStampDecisionResponse | null,
}));

vi.mock("@/hooks/useAdmin", () => ({
  useAdminContractStamp: () => ({
    data: state.context,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useAdminContractStampDecision: () => ({
    isPending: false,
    mutateAsync: vi.fn(async (vars: { id: string; input: ContractStampActionRequest }) => {
      state.payloads.push(vars);
      if (state.response) return state.response;
      return {
        stampRequest: pendingRequest(),
        applied: true,
        notifications: [],
        finalization: null,
      } satisfies ContractStampDecisionResponse;
    }),
  }),
}));

import { ContractStampPanel } from "@/components/admin/contract-stamp-panel";

const HASH = "a".repeat(64);
const STAMP_SHA = "b".repeat(64);

function pendingRequest(
  overrides: Partial<ContractStampRequestDetail> = {}
): ContractStampRequestDetail {
  return {
    id: "req-1",
    contractId: "ctr-1",
    contractVersionId: "ver-2",
    documentHash: HASH,
    stampAssetVersion: "legalir-review-stamp-1",
    stampAssetSha256: STAMP_SHA,
    status: "PENDING",
    requestedById: "usr-1",
    requestedByLabelFa: "ادمین نمونه",
    approvedById: null,
    approvedByLabelFa: null,
    reasonFa: "درخواست مشتری برای نسخهٔ نهایی",
    requestedAt: "2026-10-12T00:00:00.000Z",
    decidedAt: null,
    appliedAt: null,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    events: [],
    ...overrides,
  };
}

function context(
  overrides: Partial<ContractStampContextResponse> = {}
): ContractStampContextResponse {
  return {
    contract: {
      id: "ctr-1",
      referenceCode: "LGL-RENT-1405-000042",
      title: "اجاره‌نامه آپارتمان نمونه",
      typeFa: "اجاره‌نامه",
      state: "READY_TO_SIGN",
    },
    currentVersion: { id: "ver-2", versionNumber: 2, documentHash: HASH },
    stampAsset: {
      available: true,
      version: "legalir-review-stamp-1",
      sha256: STAMP_SHA,
      sizeBytes: 12345,
    },
    reviewed: true,
    signatures: { ready: true, reasonFa: null },
    featureEnabled: true,
    eligibility: {
      canRequest: true,
      canApply: false,
      canReject: false,
      canCancel: false,
      blockers: [],
      nextAction: "request",
    },
    applied: false,
    appliedRequest: null,
    requests: [],
    ...overrides,
  };
}

let show: MockInstance;

beforeEach(() => {
  state.context = context();
  state.payloads = [];
  state.response = null;
  show = vi.spyOn(snackbar, "show").mockImplementation(() => "snackbar-test");
});

afterEach(() => {
  show?.mockRestore();
});

describe("stamp panel — the request step", () => {
  it("offers the request action and states that it has no legal effect", () => {
    render(<ContractStampPanel contractId="ctr-1" />);

    const request = screen.getByRole("button", { name: "ثبت درخواست مهر" });
    expect((request as HTMLButtonElement).disabled).toBe(false);
    expect(
      screen.getByText(/ثبت درخواست، فقط قصد مهر را ثبت می‌کند و هیچ اثر حقوقی ندارد/)
    ).toBeInTheDocument();
  });

  it("disables a blocked action and prints the server's own reason", () => {
    state.context = context({
      reviewed: false,
      eligibility: {
        canRequest: false,
        canApply: false,
        canReject: false,
        canCancel: false,
        blockers: [
          {
            code: "NOT_REVIEWED",
            messageFa: "نسخهٔ فعلی هنوز تأیید بررسی داخلی لیگالیر را ندارد.",
          },
        ],
        nextAction: "none",
      },
    });

    render(<ContractStampPanel contractId="ctr-1" />);

    const request = screen.getByRole("button", { name: "ثبت درخواست مهر" });
    expect((request as HTMLButtonElement).disabled).toBe(true);
    expect(request).toHaveAttribute(
      "title",
      "نسخهٔ فعلی هنوز تأیید بررسی داخلی لیگالیر را ندارد."
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("برای ثبت درخواست مهر:");
    expect(status).toHaveTextContent("نسخهٔ فعلی هنوز تأیید بررسی داخلی لیگالیر را ندارد.");
  });

  it("requires a written reason before a request is submitted", async () => {
    render(<ContractStampPanel contractId="ctr-1" />);

    fireEvent.click(screen.getByRole("button", { name: "ثبت درخواست مهر" }));

    const submit = screen.getByRole("button", { name: /ثبت «ثبت درخواست مهر»/ });
    fireEvent.click(submit);

    expect(state.payloads).toHaveLength(0);
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "warning", message: "ثبت نظر/دلیل الزامی است." })
    );

    fireEvent.change(screen.getByPlaceholderText("دلیل این اقدام را بنویسید…"), {
      target: { value: "درخواست مشتری برای صدور مهر" },
    });
    fireEvent.click(submit);

    await waitFor(() => expect(state.payloads).toHaveLength(1));
    expect(state.payloads[0]).toEqual({
      id: "ctr-1",
      input: { action: "request", reason: "درخواست مشتری برای صدور مهر" },
    });
  });
});

describe("stamp panel — an open request", () => {
  it("shows the decision steps and disables apply with the real reason", () => {
    state.context = context({
      signatures: { ready: false, reasonFa: "همهٔ طرفین امضا نکرده‌اند." },
      eligibility: {
        canRequest: false,
        canApply: false,
        canReject: true,
        canCancel: true,
        blockers: [
          {
            code: "SIGNATURES_REQUIRED",
            messageFa: "مهر فقط پس از امضای همهٔ طرفین این نسخه صادر می‌شود.",
          },
        ],
        nextAction: "apply",
      },
      requests: [pendingRequest()],
    });

    render(<ContractStampPanel contractId="ctr-1" />);

    const apply = screen.getByRole("button", { name: "تأیید و اعمال مهر رسمی" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    expect(apply).toHaveAttribute(
      "title",
      "مهر فقط پس از امضای همهٔ طرفین این نسخه صادر می‌شود."
    );

    // Rejecting a request is still the manager's call, so that step stays open.
    expect(
      (screen.getByRole("button", { name: "رد درخواست" }) as HTMLButtonElement).disabled
    ).toBe(false);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("برای تصمیم روی این درخواست:");
    expect(status).toHaveTextContent("مهر فقط پس از امضای همهٔ طرفین این نسخه صادر می‌شود.");

    // The history shows the request's REAL server state.
    expect(screen.getByText("در انتظار تأیید مدیر ارشد")).toBeInTheDocument();
  });
});

describe("stamp panel — the mandatory apply confirmation (§9.3)", () => {
  function openConfirm() {
    render(<ContractStampPanel contractId="ctr-1" />);
    fireEvent.click(screen.getByRole("button", { name: "تأیید و اعمال مهر رسمی" }));
    return screen.getByRole("dialog");
  }

  beforeEach(() => {
    state.context = context({
      eligibility: {
        canRequest: false,
        canApply: true,
        canReject: true,
        canCancel: true,
        blockers: [],
        nextAction: "apply",
      },
      requests: [pendingRequest()],
    });
  });

  it("names the contract, the exact version and its fingerprint", () => {
    const dialog = openConfirm();

    expect(
      within(dialog).getByText("تأیید اعمال مهر و هولوگرام LEGALIR")
    ).toBeInTheDocument();
    expect(within(dialog).getByText("LGL-RENT-1405-000042")).toBeInTheDocument();
    expect(within(dialog).getByText("اجاره‌نامه آپارتمان نمونه")).toBeInTheDocument();
    expect(within(dialog).getByText("نسخه ۲")).toBeInTheDocument();
    expect(within(dialog).getByText(HASH)).toBeInTheDocument();

    // The preview is the printable artifact itself, not a re-render.
    const preview = within(dialog).getByTitle("پیش‌نمایش نسخهٔ قرارداد") as HTMLIFrameElement;
    expect(preview.getAttribute("src")).toBe("/api/v1/admin/contracts/ctr-1/pdf?version=ver-2");
  });

  it("keeps the confirm button closed until a reason is recorded", async () => {
    const dialog = openConfirm();

    const confirm = within(dialog).getByRole("button", { name: "تأیید و اعمال مهر" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    const field = within(dialog).getByPlaceholderText(
      "نظر نهایی خود دربارهٔ این نسخه را بنویسید…"
    );
    fireEvent.change(field, { target: { value: "اب" } });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(field, { target: { value: "تأیید نهایی" } });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(confirm);

    await waitFor(() => expect(state.payloads).toHaveLength(1));
    expect(state.payloads[0]).toEqual({
      id: "ctr-1",
      input: { action: "apply", reason: "تأیید نهایی", stampRequestId: "req-1" },
    });
  });
});

describe("stamp panel — honest outcome reporting", () => {
  beforeEach(() => {
    state.context = context({
      eligibility: {
        canRequest: false,
        canApply: true,
        canReject: true,
        canCancel: true,
        blockers: [],
        nextAction: "apply",
      },
      requests: [pendingRequest()],
    });
  });

  it("reports a failed finalization instead of claiming success", async () => {
    state.response = {
      stampRequest: pendingRequest({ status: "APPLIED", appliedAt: "2026-10-13T00:00:00.000Z" }),
      applied: true,
      notifications: [],
      finalization: {
        ok: false,
        code: "PDF_FAILED",
        messageFa: "تولید نسخهٔ نهایی ناموفق بود.",
      },
    };

    render(<ContractStampPanel contractId="ctr-1" />);
    fireEvent.click(screen.getByRole("button", { name: "تأیید و اعمال مهر رسمی" }));

    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByPlaceholderText("نظر نهایی خود دربارهٔ این نسخه را بنویسید…"),
      { target: { value: "تأیید نهایی" } }
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "تأیید و اعمال مهر" }));

    await waitFor(() =>
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "warning",
          message: expect.stringContaining("نهایی‌سازی قرارداد ناموفق بود"),
        })
      )
    );
    expect(show).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" })
    );
  });

  it("shows a failed SMS as a failure, not as delivered", async () => {
    state.response = {
      stampRequest: pendingRequest({ status: "APPLIED", appliedAt: "2026-10-13T00:00:00.000Z" }),
      applied: true,
      notifications: [
        {
          participantId: "pty-1",
          roleFa: "موجر",
          delivered: false,
          channel: null,
          failureReasonFa: "شمارهٔ موبایل ثبت نشده است.",
        },
      ],
      finalization: null,
    };

    render(<ContractStampPanel contractId="ctr-1" />);
    fireEvent.click(screen.getByRole("button", { name: "تأیید و اعمال مهر رسمی" }));

    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByPlaceholderText("نظر نهایی خود دربارهٔ این نسخه را بنویسید…"),
      { target: { value: "تأیید نهایی" } }
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "تأیید و اعمال مهر" }));

    expect(await screen.findByText("شمارهٔ موبایل ثبت نشده است.")).toBeInTheDocument();
    expect(
      screen.getByText("هیچ پیامکی به دست طرفین نرسید؛ لینک نسخهٔ نهایی را به‌صورت دستی برای آنان ارسال کنید.")
    ).toBeInTheDocument();
  });
});
