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
vi.mock("@/lib/api/property-contracts", () => ({
  updatePropertyContract: (...args: unknown[]) => updatePropertyContract(...args),
  savePayments: vi.fn().mockResolvedValue([]),
}));

import { WizardProvider } from "../../wizard-context";
import { SupplementaryStep } from "../supplementary";
import { implementedContractDefinitions, getContractDefinition } from "@/lib/contracts/registry";

// --- Registry invariants ----------------------------------------------------

describe("supplementary step — registry", () => {
  it("sits immediately before review for every implemented type", () => {
    for (const def of implementedContractDefinitions()) {
      const ids = def.wizardSteps.map((s) => s.id);
      const i = ids.indexOf("supplementary");
      expect(i, `${def.id} has no supplementary step`).toBeGreaterThanOrEqual(0);
      expect(ids[i + 1], `${def.id} puts review right after supplementary`).toBe("review");
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
