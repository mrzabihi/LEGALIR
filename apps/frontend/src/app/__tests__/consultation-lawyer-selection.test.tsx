// ============================================================
// LEGALIR — Consultation lawyer selection (regression suite)
// ============================================================
// Locks in the fix for the stale «حسام ساکی» preview bug. The root cause
// was that the wizard rendered a lawyer NAME stored in the draft instead of
// resolving the name from the authoritative lawyer ID, so a draft written
// for one lawyer kept showing that lawyer after the URL named another.
//
// These tests assert the invariant the task demands: the lawyer displayed
// on the final preview, the lawyer the user confirmed, and the lawyer the
// submitted request targets are always the same person.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import {
  fixtureLawyerListItem,
  fixtureLawyerListItemB,
  fixtureLawyerDetail,
  fixtureLawyerDetailB,
} from "@legalir/testing";

import { ConsultationWizard } from "@/components/consultations/consultation-wizard";

// --- Router mocks -----------------------------------------------------------
// The wizard reads the URL (useSearchParams) and rewrites it (router.replace)
// when the lawyer changes. A tiny in-memory router keeps that behaviour real
// enough to assert on, without pulling in the Next.js test harness.

let currentSearch = "";
const replaceSpy = vi.fn((url: string) => {
  const q = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  currentSearch = q;
});
const pushSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceSpy, push: pushSpy }),
  usePathname: () => "/consultations/new",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

// --- Test harness -----------------------------------------------------------

let queryClient: QueryClient;

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl">{children}</div>
    </QueryClientProvider>
  );
}

/** A draft already at the review step, so the preview renders immediately. */
function seedDraft(lawyerId: string | null) {
  localStorage.setItem(
    "legalir-consultation-draft",
    JSON.stringify({
      step: 3,
      category: "family",
      title: "مشاوره حضانت فرزند",
      description: "درخواست مشاوره درباره حضانت فرزند و شرایط ملاقات.",
      urgency: "normal",
      lawyerId,
      attachmentIds: [],
    })
  );
}

/** Capture the body of the next POST /legal-requests. */
let lastCreateBody: Record<string, unknown> | null = null;

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  localStorage.clear();
  currentSearch = "";
  lastCreateBody = null;
  replaceSpy.mockClear();
  pushSpy.mockClear();

  server.use(
    http.post("http://localhost:8000/api/v1/legal-requests", async ({ request }) => {
      lastCreateBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        { data: { id: "created-1", selectedLawyerId: lastCreateBody["selectedLawyerId"] } },
        { status: 201 }
      );
    })
  );
});

// ============================================================
// A. The preview shows the lawyer named by the URL, not a stale draft
// ============================================================

describe("consultation preview — authoritative lawyer", () => {
  it("shows the URL lawyer even when the draft names a different one", async () => {
    // The draft was written for lawyer B; the URL names lawyer A.
    seedDraft(fixtureLawyerListItemB.id);
    currentSearch = `lawyerId=${fixtureLawyerListItem.id}`;

    render(<ConsultationWizard initialLawyerId={fixtureLawyerListItem.id} />, {
      wrapper: Wrapper,
    });

    // A's name and real specialties must appear; B's must not.
    expect(await screen.findByText(fixtureLawyerDetail.fullName)).toBeInTheDocument();
    expect(screen.queryByText(fixtureLawyerDetailB.fullName)).not.toBeInTheDocument();
    expect(screen.getByText("خانواده، قرارداد")).toBeInTheDocument();
  });

  it("shows no lawyer at all when neither the URL nor the draft names one", async () => {
    seedDraft(null);
    currentSearch = "";

    render(<ConsultationWizard initialLawyerId={null} />, { wrapper: Wrapper });

    // No silent default — the selection UI is offered instead.
    expect(
      await screen.findByText(/وکیلی انتخاب نشده است/)
    ).toBeInTheDocument();
    expect(screen.queryByText(fixtureLawyerDetail.fullName)).not.toBeInTheDocument();
    expect(screen.queryByText(fixtureLawyerDetailB.fullName)).not.toBeInTheDocument();
  });

  it("explains an unresolvable lawyer and blocks submission", async () => {
    seedDraft("does-not-exist");
    currentSearch = "lawyerId=does-not-exist";

    render(<ConsultationWizard initialLawyerId="does-not-exist" />, {
      wrapper: Wrapper,
    });

    // The detail query retries once on 404 (hook-level `retry: 1`), and React
    // Query's default retry delay is 1s — allow for that before asserting.
    expect(
      await screen.findByText(
        /وکیل انتخاب‌شده یافت نشد یا دیگر در دسترس نیست/,
        {},
        { timeout: 4000 }
      )
    ).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: /ثبت درخواست مشاوره/ });
    expect(submit).toBeDisabled();
  });
});

// ============================================================
// B. The drill-down selector replaces the lawyer only on confirm
// ============================================================

describe("consultation preview — تغییر وکیل", () => {
  it("keeps the original lawyer when the selector is cancelled", async () => {
    seedDraft(fixtureLawyerListItem.id);
    currentSearch = `lawyerId=${fixtureLawyerListItem.id}`;

    render(<ConsultationWizard initialLawyerId={fixtureLawyerListItem.id} />, {
      wrapper: Wrapper,
    });

    fireEvent.click(await screen.findByRole("button", { name: "تغییر وکیل" }));

    // The dialog opens on the specialty level, derived from real data.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("خانواده")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "انصراف" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    // The original lawyer is untouched.
    expect(screen.getByText(fixtureLawyerDetail.fullName)).toBeInTheDocument();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("replaces the lawyer after an explicit confirm and rewrites the URL", async () => {
    seedDraft(fixtureLawyerListItem.id);
    currentSearch = `lawyerId=${fixtureLawyerListItem.id}`;

    render(<ConsultationWizard initialLawyerId={fixtureLawyerListItem.id} />, {
      wrapper: Wrapper,
    });

    fireEvent.click(await screen.findByRole("button", { name: "تغییر وکیل" }));
    const dialog = await screen.findByRole("dialog");

    // Drill: specialty → lawyer → confirm.
    fireEvent.click(within(dialog).getByRole("button", { name: /کیفری/ }));
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: new RegExp(fixtureLawyerListItemB.fullName),
      })
    );
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: /تأیید و انتخاب این وکیل/,
      })
    );

    // The preview now shows B, and the URL carries B's id.
    expect(await screen.findByText(fixtureLawyerDetailB.fullName)).toBeInTheDocument();
    expect(screen.queryByText(fixtureLawyerDetail.fullName)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(replaceSpy).toHaveBeenCalledWith(
        expect.stringContaining(`lawyerId=${fixtureLawyerListItemB.id}`),
        expect.anything()
      )
    );
  });
});

// ============================================================
// C. The submitted request targets the lawyer shown in the preview
// ============================================================

describe("consultation submit — the payload matches the preview", () => {
  it("submits the URL lawyer's id", async () => {
    seedDraft(fixtureLawyerListItem.id);
    currentSearch = `lawyerId=${fixtureLawyerListItem.id}`;

    render(<ConsultationWizard initialLawyerId={fixtureLawyerListItem.id} />, {
      wrapper: Wrapper,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: /ثبت درخواست مشاوره/ })
    );

    await waitFor(() => expect(lastCreateBody).not.toBeNull());
    expect(lastCreateBody!["selectedLawyerId"]).toBe(fixtureLawyerListItem.id);
  });

  it("submits the replacement lawyer's id after a confirmed change", async () => {
    seedDraft(fixtureLawyerListItem.id);
    currentSearch = `lawyerId=${fixtureLawyerListItem.id}`;

    render(<ConsultationWizard initialLawyerId={fixtureLawyerListItem.id} />, {
      wrapper: Wrapper,
    });

    fireEvent.click(await screen.findByRole("button", { name: "تغییر وکیل" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /کیفری/ }));
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: new RegExp(fixtureLawyerListItemB.fullName),
      })
    );
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: /تأیید و انتخاب این وکیل/,
      })
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /ثبت درخواست مشاوره/ })
    );

    await waitFor(() => expect(lastCreateBody).not.toBeNull());
    // B, not A — the preview and the payload agree.
    expect(lastCreateBody!["selectedLawyerId"]).toBe(fixtureLawyerListItemB.id);
  });
});
