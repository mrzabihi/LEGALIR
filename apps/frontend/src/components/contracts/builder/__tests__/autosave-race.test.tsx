// ============================================================
// LEGALIR — Autosave race tests
// ============================================================
// The wizard keeps the working data in local state and pushes it to
// the server through a debounced autosave. These tests pin the three
// properties the spec demands: edits are debounced (not one request
// per keystroke), a save that is in flight never swallows a newer
// edit, and a failed save is retried.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropertyContractDetail, ContractCompleteness } from "@legalir/types";
import type { PropertyContractDetailWithCompleteness } from "@/lib/api/property-contracts";

// The autosave talks to the API through this module; mock it so the
// test controls exactly when each PATCH resolves.
const updatePropertyContract = vi.fn();
vi.mock("@/lib/api/property-contracts", () => ({
  updatePropertyContract: (...args: unknown[]) => updatePropertyContract(...args),
  savePayments: vi.fn().mockResolvedValue([]),
}));

import { WizardProvider, useWizard } from "../wizard-context";

// --- Fixtures ---------------------------------------------------------------

function makeContract(): PropertyContractDetail {
  return {
    id: "pc-test",
    type: "property_rent",
    typeFa: "رهن و اجاره ملک مسکونی",
    state: "DRAFT",
    title: "قرارداد تست",
    referenceCode: "LGL-RENT-1405-000001",
    currentStep: "parties",
    progress: 10,
    data: { property: { address: "" } },
    payments: [],
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  } as unknown as PropertyContractDetail;
}

const COMPLETENESS: ContractCompleteness = {
  percent: 10,
  sections: [],
  missingRequired: [],
} as unknown as ContractCompleteness;

/** A promise whose resolution the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Captures the live wizard context so the test can drive it. */
let wizard: ReturnType<typeof useWizard> | null = null;
function Probe() {
  wizard = useWizard();
  return null;
}

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WizardProvider contract={makeContract()} completeness={COMPLETENESS}>
        <Probe />
      </WizardProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  wizard = null;
  updatePropertyContract.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("autosave — debounce", () => {
  it("coalesces rapid edits into a single request", async () => {
    updatePropertyContract.mockResolvedValue({
      ...makeContract(),
      progress: 20,
      completeness: COMPLETENESS,
    });

    renderWizard();

    // Five edits in quick succession, all inside the debounce window.
    act(() => {
      wizard!.patchData({ property: { address: "الف" } } as never);
      wizard!.patchData({ property: { address: "الف ب" } } as never);
      wizard!.patchData({ property: { address: "الف ب پ" } } as never);
      wizard!.patchData({ property: { address: "الف ب پ ت" } } as never);
      wizard!.patchData({ property: { address: "الف ب پ ت ث" } } as never);
    });

    expect(updatePropertyContract).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(updatePropertyContract).toHaveBeenCalledTimes(1);
    // The single request carries the LAST value, not an intermediate one.
    const payload = updatePropertyContract.mock.calls[0]![1] as {
      data: { property: { address: string } };
    };
    expect(payload.data.property.address).toBe("الف ب پ ت ث");
  });
});

describe("autosave — race safety", () => {
  it("does not lose an edit that lands while a save is in flight", async () => {
    const first = deferred<PropertyContractDetailWithCompleteness>();
    updatePropertyContract.mockReturnValueOnce(first.promise);
    updatePropertyContract.mockResolvedValue({
      ...makeContract(),
      progress: 40,
      completeness: COMPLETENESS,
    });

    renderWizard();

    // First edit → debounce fires → request #1 goes in flight.
    act(() => {
      wizard!.patchData({ property: { address: "اول" } } as never);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(updatePropertyContract).toHaveBeenCalledTimes(1);

    // A newer edit arrives while request #1 is still pending.
    act(() => {
      wizard!.patchData({ property: { address: "دوم" } } as never);
    });

    // Resolve request #1 — the newer edit must NOT be considered saved.
    await act(async () => {
      first.resolve({ ...makeContract(), progress: 20, completeness: COMPLETENESS });
      await first.promise;
    });

    // A follow-up save must be scheduled and must carry the newer value.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(updatePropertyContract).toHaveBeenCalledTimes(2);
    const secondPayload = updatePropertyContract.mock.calls[1]![1] as {
      data: { property: { address: string } };
    };
    expect(secondPayload.data.property.address).toBe("دوم");
  });

  it("refreshes server-derived progress even when a newer edit landed", async () => {
    const first = deferred<PropertyContractDetailWithCompleteness>();
    updatePropertyContract.mockReturnValueOnce(first.promise);
    updatePropertyContract.mockResolvedValue({
      ...makeContract(),
      progress: 55,
      completeness: COMPLETENESS,
    });

    renderWizard();
    expect(wizard!.progress).toBe(10);

    act(() => {
      wizard!.patchData({ property: { address: "اول" } } as never);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    // Newer edit mid-flight.
    act(() => {
      wizard!.patchData({ property: { address: "دوم" } } as never);
    });

    await act(async () => {
      first.resolve({ ...makeContract(), progress: 55, completeness: COMPLETENESS });
      await first.promise;
    });

    // Progress is server-derived, so it must adopt the response even
    // though the local data was newer.
    expect(wizard!.progress).toBe(55);
  });
});

describe("autosave — retry", () => {
  it("retries a failed save with backoff and eventually succeeds", async () => {
    updatePropertyContract
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ ...makeContract(), progress: 30, completeness: COMPLETENESS });

    renderWizard();

    act(() => {
      wizard!.patchData({ property: { address: "الف" } } as never);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(updatePropertyContract).toHaveBeenCalledTimes(1);
    expect(wizard!.saveStatus).toBe("error");

    // First backoff is 1000ms.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    expect(updatePropertyContract).toHaveBeenCalledTimes(2);
    expect(wizard!.saveStatus).toBe("saved");
  });
});
