// ============================================================
// LEGALIR — Supplementary step tests
// ============================================================
// The step before «بازبینی و پیش‌نمایش» must behave the same for every
// contract type and must never become a second way to edit operative
// data. These tests pin:
//
//   • registry: every type ships the step, immediately before review,
//     and it contributes no completeness section (it can't block).
//   • UI: notes + agreed terms + change requests are separate buckets;
//     rows add / edit / delete; blank rows are not counted or printed.
//   • isolation: the step only ever writes `customClauses` and
//     `supplementary` — never a clause or identity field of another step.
// ============================================================

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  ContractCompleteness,
  PropertyContractDetail,
} from "@legalir/types";

// The wizard autosaves through this module; the step under test only
// needs it to exist and resolve.
const updatePropertyContract = vi.fn();
const uploadContractDocument = vi.fn();
const deleteContractDocument = vi.fn();
vi.mock("@/lib/api/property-contracts", () => ({
  updatePropertyContract: (...args: unknown[]) => updatePropertyContract(...args),
  savePayments: vi.fn().mockResolvedValue([]),
  uploadContractDocument: (...args: unknown[]) => uploadContractDocument(...args),
  deleteContractDocument: (...args: unknown[]) => deleteContractDocument(...args),
  contractDocumentUrl: (id: string, documentId: string) =>
    `/api/v1/property-contracts/${id}/documents/${documentId}`,
}));

import { WizardProvider } from "../../wizard-context";
import { SupplementaryStep } from "../supplementary";
import { implementedContractDefinitions, getContractDefinition } from "@/lib/contracts/registry";

// --- Registry invariants ----------------------------------------------------

describe("supplementary step — registry", () => {
  it("leads straight to signature, with review right after it", () => {
    for (const def of implementedContractDefinitions()) {
      const ids = def.wizardSteps.map((s) => s.id);
      const i = ids.indexOf("supplementary");
      expect(i, `${def.id} has no supplementary step`).toBeGreaterThanOrEqual(0);
      // «تأیید و ادامه به امضا» — the signature stage follows the
      // confirmed supplementary material directly.
      expect(ids[i + 1], `${def.id} puts signature right after supplementary`).toBe("signature");
      expect(ids[i + 2], `${def.id} puts review right after signature`).toBe("review");
    }
  });

  it("declares no completeness section, so it can never block the review", () => {
    for (const def of implementedContractDefinitions()) {
      const step = def.wizardSteps.find((s) => s.id === "supplementary")!;
      expect(step.sections, def.id).toEqual([]);
      // No section may point back at this step either.
      expect(def.sections.some((s) => s.stepId === "supplementary"), def.id).toBe(false);
    }
  });
});

// --- UI behaviour -----------------------------------------------------------

function makeContract(): PropertyContractDetail {
  return {
    id: "pc-supplementary",
    type: "property_rent",
    typeFa: "رهن و اجاره ملک مسکونی",
    state: "DRAFT",
    title: "قرارداد تست",
    referenceCode: "LGL-RENT-1405-000001",
    currentStep: "supplementary",
    progress: 40,
    data: { customClauses: [], supplementary: { notes: "" } },
    payments: [],
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  } as unknown as PropertyContractDetail;
}

const COMPLETENESS = {
  overall: 40,
  sections: [],
  blockers: [],
} as unknown as ContractCompleteness;

function renderStep() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WizardProvider contract={makeContract()} completeness={COMPLETENESS}>
        <SupplementaryStep />
      </WizardProvider>
    </QueryClientProvider>
  );
}

/** The `<section>` card whose heading is `title`. */
function card(title: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: title });
  return heading.closest("section") as HTMLElement;
}

/** Render the step with already-registered contract annexes. */
function renderAnnexStep(
  attachments: NonNullable<
    NonNullable<PropertyContractDetail["data"]["supplementary"]>["attachments"]
  >,
  options: { confirmedAttachments?: boolean } = {}
) {
  const base = makeContract();
  const contract = {
    ...base,
    data: {
      ...(base.data as unknown as Record<string, unknown>),
      supplementary: {
        notes: "",
        attachments,
        attachmentsConfirmedAt:
          options.confirmedAttachments === false
            ? null
            : "2026-10-18T09:20:00.000Z",
      },
    },
  } as unknown as PropertyContractDetail;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WizardProvider contract={contract} completeness={COMPLETENESS}>
        <SupplementaryStep />
      </WizardProvider>
    </QueryClientProvider>
  );
}

beforeAll(() => {
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

describe("supplementary step — UI", () => {
  it("renders the three separate buckets and says nothing replaces the clauses", () => {
    renderStep();

    expect(screen.getByRole("heading", { name: "یادداشت تکمیلی" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "توافقات خاص طرفین" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "درخواست تغییر و یادداشت" })).toBeInTheDocument();

    // The step states its own limits up front (§4: free text must not
    // silently take the place of an operative clause or identity data).
    expect(screen.getByText(/جای بندهای\s+اصلی یا اطلاعات هویتی را نمی‌گیرد/)).toBeInTheDocument();
    expect(screen.getByText("این موارد متن قرارداد را تغییر نمی‌دهند")).toBeInTheDocument();
  });

  it("adds an agreement row and edits it in place", () => {
    renderStep();
    const agreements = card("توافقات خاص طرفین");

    fireEvent.click(within(agreements).getByRole("button", { name: "افزودن توافق" }));

    const title = within(agreements).getByLabelText("عنوان") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "پارکینگ اختصاصی" } });
    const body = within(agreements).getByLabelText("متن") as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: "پارکینگ شمارهٔ ۱۲ در اختیار مستأجر است." } });

    expect(title.value).toBe("پارکینگ اختصاصی");
    expect(body.value).toBe("پارکینگ شمارهٔ ۱۲ در اختیار مستأجر است.");
    // A filled row is counted and announced as visible in the preview.
    expect(screen.getByText(/مورد ثبت شده است و در پیش‌نمایش قرارداد دیده می‌شود/)).toBeInTheDocument();
  });

  it("keeps change requests in their own bucket, never mixed with agreements", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "افزودن یادداشت" }));

    const requests = card("درخواست تغییر و یادداشت");
    const agreements = card("توافقات خاص طرفین");

    expect(within(requests).getByLabelText("عنوان")).toBeInTheDocument();
    expect(within(agreements).queryByLabelText("عنوان")).toBeNull();
  });

  it("shows the inline error when a row has a title but no text", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "افزودن توافق" }));
    const agreements = card("توافقات خاص طرفین");

    fireEvent.change(within(agreements).getByLabelText("عنوان"), {
      target: { value: "شرط اضافه" },
    });
    expect(
      within(agreements).getByText("متن این مورد را بنویسید تا در قرارداد لحاظ شود.")
    ).toBeInTheDocument();

    fireEvent.change(within(agreements).getByLabelText("متن"), {
      target: { value: "متن شرط" },
    });
    expect(
      within(agreements).queryByText("متن این مورد را بنویسید تا در قرارداد لحاظ شود.")
    ).toBeNull();
  });

  it("does not count a blank row as a recorded item", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "افزودن توافق" }));
    // Scaffold-only rows must not read as content and must not print.
    expect(screen.getByText("ردیف‌های خالی در قرارداد چاپ نمی‌شوند.")).toBeInTheDocument();
  });

  it("deletes only the row the user removes", () => {
    renderStep();
    const agreements = card("توافقات خاص طرفین");
    fireEvent.click(within(agreements).getByRole("button", { name: "افزودن توافق" }));
    fireEvent.click(within(agreements).getByRole("button", { name: "افزودن توافق" }));

    const titles = within(agreements).getAllByLabelText("عنوان") as HTMLInputElement[];
    fireEvent.change(titles[0]!, { target: { value: "اول" } });
    fireEvent.change(titles[1]!, { target: { value: "دوم" } });

    const removeButtons = within(agreements).getAllByRole("button", { name: "حذف" });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]!);

    const remaining = within(agreements).getAllByLabelText("عنوان") as HTMLInputElement[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.value).toBe("دوم");
  });

  it("never offers the review or supplementary step as a section target", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "افزودن یادداشت" }));
    const select = within(card("درخواست تغییر و یادداشت")).getByLabelText(
      "بخش مرتبط"
    ) as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);

    expect(labels).toContain("کل قرارداد");
    const def = getContractDefinition("property_rent");
    const reviewTitle = def.wizardSteps.find((s) => s.id === "review")!.titleFa;
    const supplementaryTitle = def.wizardSteps.find((s) => s.id === "supplementary")!.titleFa;
    expect(labels).not.toContain(reviewTitle);
    expect(labels).not.toContain(supplementaryTitle);
  });

  // --- Task 2: review article, explicit confirmations ----------------------

  it("shows «مادهٔ بازبینی» and the exact note guidance copy", () => {
    renderStep();

    expect(screen.getByRole("heading", { name: "مادهٔ بازبینی" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "توضیح یا نکته‌ای دربارهٔ کل قرارداد — این یادداشت در پایان سند و جدا از مواد قرارداد چاپ می‌شود."
      )
    ).toBeInTheDocument();
    // Before anything is written, the review article says so honestly.
    expect(screen.getByText("توافق خاصی برای چاپ وجود ندارد.")).toBeInTheDocument();
  });

  it("confirms the note explicitly and shows its confirmation time", () => {
    renderStep();
    const note = screen.getByLabelText("یادداشت") as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: "تمدید تلفنی معتبر نیست." } });

    // The confirm button only makes sense once there is a note.
    fireEvent.click(screen.getByRole("button", { name: "تأیید یادداشت و ادامه" }));

    expect(screen.getByText("یادداشت تأیید و ذخیره شد.")).toBeInTheDocument();
    // Confirming locks the text; editing it again is an explicit action.
    expect(screen.queryByLabelText("یادداشت")).toBeNull();
    expect(screen.getByRole("button", { name: "ویرایش یادداشت" })).toBeInTheDocument();
  });

  it("blocks confirming the step while a row has a title but no text", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "افزودن توافق" }));
    fireEvent.change(screen.getByLabelText("عنوان"), { target: { value: "شرط نیمه‌کاره" } });

    fireEvent.click(screen.getByRole("button", { name: "تأیید و ادامه به امضا" }));

    expect(
      screen.getByText("پیش از ادامه، متن ۱ مورد نیمه‌کاره را کامل کنید.")
    ).toBeInTheDocument();
  });

  it("blocks confirming the step while a written note is still unconfirmed", () => {
    renderStep();
    fireEvent.change(screen.getByLabelText("یادداشت"), {
      target: { value: "یادداشت تأییدنشده" },
    });

    fireEvent.click(screen.getByRole("button", { name: "تأیید و ادامه به امضا" }));

    expect(
      screen.getByText(
        "یادداشت تکمیلی نوشته شده اما هنوز تأیید نشده است. ابتدا دکمهٔ «تأیید یادداشت و ادامه» را بزنید."
      )
    ).toBeInTheDocument();
  });

  it("records the step confirmation when the user advances to signature", async () => {
    updatePropertyContract.mockResolvedValue({
      ...makeContract(),
      progress: 60,
      completeness: COMPLETENESS,
    });
    renderStep();

    fireEvent.click(screen.getByRole("button", { name: "تأیید و ادامه به امضا" }));

    // The advance schedules the normal autosave with the new step id.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(updatePropertyContract).toHaveBeenCalled();
    const last = updatePropertyContract.mock.calls.at(-1)![1] as {
      currentStep?: string;
      data?: { supplementary?: { confirmedAt?: string | null } };
    };
    expect(last.currentStep).toBe("signature");
    // The approved state is persisted with the navigation — a confirmed
    // step is never "navigated to" without a matching saved timestamp.
    expect(last.data?.supplementary?.confirmedAt).toBeTruthy();
  });

  // --- Task 2 (cont.): contract annexes, kept apart from the note ---------

  it("renders the annex card separately from the note, with its own confirm", () => {
    renderStep();
    const annexCard = card("پیوست قرارداد");
    expect(within(annexCard).getByLabelText("عنوان پیوست")).toBeInTheDocument();
    // Its own confirmation verb — never the note's.
    expect(within(annexCard).getByRole("button", { name: "تأیید پیوست‌ها" })).toBeDisabled();
    expect(
      within(annexCard).getByText(/یادداشت تکمیلی فقط\s+توضیحی دربارهٔ کل قرارداد است/)
    ).toBeInTheDocument();
  });

  it("shows a saved annex with its label and confirm time, and lists it in the review article", () => {
    renderAnnexStep([
      {
        documentId: "doc-annex-1",
        titleFa: "فهرست تجهیزات",
        fileName: "equipment.png",
        mime: "image/png",
        sizeBytes: 120,
        hash: "a".repeat(64),
        addedAt: "2026-10-18T09:12:33.000Z",
      },
    ]);

    const annexCard = card("پیوست قرارداد");
    expect(within(annexCard).getByText("فهرست تجهیزات")).toBeInTheDocument();
    expect(within(annexCard).getByText("پیوست‌ها تأیید و ذخیره شد.")).toBeInTheDocument();

    // The preview names it under its own operative heading — not as a note.
    const preview = card("مادهٔ بازبینی");
    expect(within(preview).getByText("پیوست‌های قرارداد (مادهٔ تعهدآور)")).toBeInTheDocument();
    expect(within(preview).getByText("فهرست تجهیزات:")).toBeInTheDocument();
  });

  it("blocks advancing while annexes are registered but unconfirmed", () => {
    renderAnnexStep([
      {
        documentId: "doc-annex-2",
        titleFa: "پیوست تأییدنشده",
        fileName: "x.png",
        mime: "image/png",
        sizeBytes: 90,
        hash: "b".repeat(64),
        addedAt: "2026-10-18T09:12:33.000Z",
      },
    ], { confirmedAttachments: false });

    fireEvent.click(screen.getByRole("button", { name: "تأیید و ادامه به امضا" }));
    expect(
      screen.getByText(
        "پیوست‌های قرارداد ثبت شده‌اند اما هنوز تأیید نشده‌اند. ابتدا دکمهٔ «تأیید پیوست‌ها» را بزنید."
      )
    ).toBeInTheDocument();
  });

  it("does not show «تأیید شد» when the confirmation could not be persisted", async () => {
    updatePropertyContract.mockRejectedValueOnce(new Error("offline"));
    renderStep();
    fireEvent.change(screen.getByLabelText("یادداشت"), {
      target: { value: "یادداشت مهم" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "تأیید یادداشت و ادامه" }));
      await Promise.resolve();
    });

    // A failed save must never masquerade as a confirmation.
    expect(
      screen.getByRole("button", { name: "تلاش مجدد برای تأیید" })
    ).toBeInTheDocument();
    expect(screen.queryByText("یادداشت تأیید و ذخیره شد.")).toBeNull();
  });

  it("writes only `customClauses` and `supplementary` — never another step's data", async () => {
    // A successful save stops the retry loop the wizard would otherwise
    // schedule when the mocked request returns nothing.
    updatePropertyContract.mockResolvedValue({
      ...makeContract(),
      progress: 50,
      completeness: COMPLETENESS,
    });
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "افزودن توافق" }));
    fireEvent.change(screen.getByLabelText("یادداشت"), {
      target: { value: "یادداشت کل قرارداد" },
    });
    fireEvent.change(screen.getByLabelText("عنوان"), { target: { value: "شرط" } });
    fireEvent.change(screen.getByLabelText("متن"), { target: { value: "متن شرط" } });

    // Let the debounced autosave flush its single request.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(updatePropertyContract).toHaveBeenCalled();
    for (const call of updatePropertyContract.mock.calls) {
      const payload = call[1] as { data?: Record<string, unknown> };
      const keys = Object.keys(payload.data ?? {});
      for (const key of keys) {
        expect(["customClauses", "supplementary"]).toContain(key);
      }
    }
  });
});
