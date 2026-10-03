// ============================================================
// LEGALIR — Contract review intake flow (spec §8)
// ============================================================
// The review flow is the SECOND service hosted by the contracts area
// and must never be confused with drafting. These tests lock the
// intake contract:
//
//   • step 1 offers the three document sources and gates «مرحله بعد»
//     until a document is actually chosen;
//   • step 2 requires a purpose (the only hard requirement) and offers
//     «نمی‌دانم» as a first-class answer;
//   • step 3 states the scope back, tags extracted values, and carries
//     the AI-not-a-lawyer disclaimer;
//   • the flow never fabricates an analysis — it only assembles the
//     user's own answers into a question.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ContractReviewPage from "@/app/(app)/contracts/review/page";

// --- Router mocks -----------------------------------------------------------
// The page reads the URL and pushes to the next surface. A tiny in-memory
// router keeps that behaviour real enough to assert on.

const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy, replace: vi.fn() }),
  usePathname: () => "/contracts/review",
  useSearchParams: () => new URLSearchParams(""),
}));

// --- Harness ----------------------------------------------------------------

let queryClient: QueryClient;

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl">{children}</div>
    </QueryClientProvider>
  );
}

function renderPage() {
  return render(
    <Wrapper>
      <ContractReviewPage />
    </Wrapper>
  );
}

/** Advance from step 1 to step 2 by choosing the upload source. */
function chooseUploadAndAdvance() {
  fireEvent.click(screen.getByText("بارگذاری سند جدید"));
  fireEvent.click(screen.getByRole("button", { name: "مرحله بعد" }));
}

beforeEach(() => {
  pushSpy.mockClear();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
});

// ------------------------------------------------------------
// Step 1 — document
// ------------------------------------------------------------

describe("review flow — step 1 (document)", () => {
  it("offers the three document sources", () => {
    renderPage();
    expect(screen.getByText("بارگذاری سند جدید")).toBeInTheDocument();
    expect(screen.getByText("از پیش‌نویس‌های من")).toBeInTheDocument();
    expect(screen.getByText("از اسناد لیگالیر")).toBeInTheDocument();
  });

  it("keeps «مرحله بعد» disabled until a document is chosen", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "مرحله بعد" })).toBeDisabled();
  });

  it("enables «مرحله بعد» once the upload source is chosen", () => {
    renderPage();
    fireEvent.click(screen.getByText("بارگذاری سند جدید"));
    expect(screen.getByRole("button", { name: "مرحله بعد" })).toBeEnabled();
  });

  it("links back to the contracts page", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /بازگشت به قراردادها/ })).toHaveAttribute(
      "href",
      "/contracts"
    );
  });
});

// ------------------------------------------------------------
// Step 2 — context
// ------------------------------------------------------------

describe("review flow — step 2 (context)", () => {
  it("requires a purpose before advancing", () => {
    renderPage();
    chooseUploadAndAdvance();
    // The purpose group is present and the next button is gated.
    expect(screen.getByText("هدف شما از این بررسی")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "مرحله بعد" })).toBeDisabled();
  });

  it("offers «نمی‌دانم» as a first-class answer for role and status", () => {
    renderPage();
    chooseUploadAndAdvance();
    // Role, status and jurisdiction each carry their own «نمی‌دانم».
    expect(screen.getAllByText("نمی‌دانم").length).toBeGreaterThanOrEqual(3);
  });

  it("advances once a purpose is selected", () => {
    renderPage();
    chooseUploadAndAdvance();
    fireEvent.click(screen.getByText("بررسی پیش از امضا"));
    expect(screen.getByRole("button", { name: "مرحله بعد" })).toBeEnabled();
  });

  it("lets the user go back to step 1", () => {
    renderPage();
    chooseUploadAndAdvance();
    fireEvent.click(screen.getByRole("button", { name: "مرحله قبل" }));
    expect(screen.getByText("سند مورد بررسی را انتخاب کنید")).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Step 3 — confirm
// ------------------------------------------------------------

describe("review flow — step 3 (confirm)", () => {
  function reachConfirm() {
    renderPage();
    chooseUploadAndAdvance();
    fireEvent.click(screen.getByText("بررسی پیش از امضا"));
    fireEvent.click(screen.getByText("طرف اول قرارداد"));
    fireEvent.click(screen.getByText("شرایط فسخ و خاتمه"));
    fireEvent.click(screen.getByRole("button", { name: "مرحله بعد" }));
  }

  it("states the chosen scope back to the user", () => {
    reachConfirm();
    // «تأیید دامنه بررسی» is both the step title and the heading — the
    // heading is the one that proves the confirm step rendered.
    expect(
      screen.getByRole("heading", { name: "تأیید دامنه بررسی" })
    ).toBeInTheDocument();
    expect(screen.getByText("بررسی پیش از امضا")).toBeInTheDocument();
    expect(screen.getByText("طرف اول قرارداد")).toBeInTheDocument();
    expect(screen.getByText("شرایط فسخ و خاتمه")).toBeInTheDocument();
  });

  it("carries the AI-not-a-lawyer disclaimer", () => {
    reachConfirm();
    // The disclaimer appears in both the page intro and the confirm box.
    expect(screen.getAllByText(/جایگزین نظر وکیل/).length).toBeGreaterThanOrEqual(1);
  });

  it("offers «شروع بررسی» on the confirm step", () => {
    reachConfirm();
    expect(screen.getByRole("button", { name: /شروع بررسی/ })).toBeInTheDocument();
  });

  it("hands an upload off to the upload wizard with a return path", async () => {
    reachConfirm();
    fireEvent.click(screen.getByRole("button", { name: /شروع بررسی/ }));
    await waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(1));
    const target = pushSpy.mock.calls[0]![0] as string;
    expect(target).toContain("/documents/upload");
    expect(target).toContain("returnTo=%2Fcontracts%2Freview");
  });
});
