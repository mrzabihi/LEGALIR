// ============================================================
// LEGALIR — /contracts/[id] serves BOTH contract lifecycles
// ============================================================
// The contracts hub lists Contract-OS contracts AND legacy V1 contracts,
// and every card links to `/contracts/${id}`. Before this guard the route
// only knew the OS lifecycle, so clicking a V1 card dead-ended on "قرارداد
// یافت نشد" even though the contract existed.
//
// The switch is the OS endpoint's 404 (a V1 id has no OS record), so these
// tests pin exactly that:
//   • an OS contract renders the builder and never queries V1;
//   • a V1-only id renders the V1 detail view instead of the error card;
//   • a genuine unknown id still shows the not-found state.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";

const harness = vi.hoisted(() => ({
  os: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    error: null as unknown,
    refetch: () => undefined,
  },
  v1: { data: undefined as unknown, isLoading: false },
  v1RequestedId: null as string | null,
}));

vi.mock("@/hooks/usePropertyContracts", () => ({
  usePropertyContract: () => harness.os,
}));

vi.mock("@/hooks/useContracts", () => ({
  useContractDetail: (id: string | undefined) => {
    if (!id) return { data: undefined, isLoading: false };
    harness.v1RequestedId = id;
    return harness.v1;
  },
}));

vi.mock("@/components/contracts/builder/wizard-shell", () => ({
  ContractBuilder: ({ contract }: { contract: { id: string } }) => (
    <div>OS-BUILDER:{contract.id}</div>
  ),
}));

vi.mock("@/components/contracts/contract-detail", () => ({
  ContractDetailView: ({ contract }: { contract: { id: string; title: string } }) => (
    <div>
      V1-DETAIL:{contract.id}:{contract.title}
    </div>
  ),
}));

import ContractDetailPage from "@/app/(app)/contracts/[id]/page";

/**
 * The page unwraps `params` with React's `use()`, so the first render
 * suspends on the thenable. `act` flushes that microtask before the
 * assertion runs; without it every query sees the fallback.
 */
async function renderRoute(id: string) {
  await act(async () => {
    render(<ContractDetailPage params={Promise.resolve({ id })} />);
  });
}

beforeEach(() => {
  harness.os = { data: undefined, isLoading: false, isError: false, error: null, refetch: () => undefined };
  harness.v1 = { data: undefined, isLoading: false };
  harness.v1RequestedId = null;
});

describe("/contracts/[id] — lifecycle routing", () => {
  it("renders the builder for a Contract-OS contract", async () => {
    harness.os = {
      ...harness.os,
      data: { id: "cnt-os", completeness: { overall: 80, sections: [], blockers: [] } },
    };
    await renderRoute("cnt-os");

    expect(await screen.findByText("OS-BUILDER:cnt-os")).toBeTruthy();
    // The V1 query is never issued for an OS contract.
    expect(harness.v1RequestedId).toBeNull();
  });

  it("renders the V1 detail view when the OS endpoint answers 404", async () => {
    harness.os = {
      ...harness.os,
      isError: true,
      error: new Error("قرارداد یافت نشد"),
    };
    harness.v1 = {
      data: { id: "v1-1", title: "قرارداد همکاری", versions: [] },
      isLoading: false,
    };
    await renderRoute("v1-1");

    expect(await screen.findByText("V1-DETAIL:v1-1:قرارداد همکاری")).toBeTruthy();
    expect(screen.queryByText("قرارداد یافت نشد")).toBeNull();
  });

  it("keeps the not-found state for an id that exists in neither lifecycle", async () => {
    harness.os = {
      ...harness.os,
      isError: true,
      error: new Error("قرارداد یافت نشد"),
    };
    await renderRoute("ghost");

    expect(await screen.findByText("قرارداد یافت نشد")).toBeTruthy();
  });
});
