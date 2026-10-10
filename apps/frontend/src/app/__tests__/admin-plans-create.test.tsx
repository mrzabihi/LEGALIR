// ============================================================
// LEGALIR — /admin/plans create dialog · new plans go live
// ============================================================
// Pins the reported defect: a plan created in the admin panel never showed up
// on /subscription. Root cause: the create form defaulted `status` to "draft",
// and the public catalog (/api/v1/plans → isPurchasable) lists ONLY active
// plans — so every freshly created plan was silently filtered out.
//
// This guard asserts the two things the fix owns:
//   • the create dialog's «وضعیت» field defaults to the live status («فعال»),
//   • that default is what actually gets submitted to the API.
// The admin data hooks are mocked, so the test targets the form's contract, not
// the network — the server side is covered by lib/__tests__/admin-plans.test.ts.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";

// Every plan the form actually tries to create, captured from the mutation.
const created = vi.hoisted(() => ({
  payloads: [] as { code?: string; status?: string }[],
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/plans",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/hooks/useAdmin", () => ({
  useAdminMe: () => ({ can: () => true, isStaff: true, role: "SUPER_ADMIN", data: undefined }),
  useAdminPlans: () => ({
    isLoading: false,
    isError: false,
    isFetching: false,
    data: { items: [] },
    refetch: vi.fn(),
  }),
  useAdminPlan: () => ({ data: undefined, isLoading: false, isError: false }),
  useUpdateAdminPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateAdminPlan: () => ({
    mutateAsync: vi.fn(async (input: { code?: string; status?: string }) => {
      created.payloads.push(input);
      return { id: `plan-${input.code}`, code: input.code, nameFa: "پلن آزمون" };
    }),
    isPending: false,
  }),
  useSetAdminPlanStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// The live card preview pulls its own deps; not under test here.
vi.mock("@/components/subscription/plan-card", () => ({ PlanCard: () => null }));

import AdminPlansPage from "@/app/(admin)/admin/plans/page";

beforeEach(() => {
  created.payloads.length = 0;
});

describe("AdminPlansPage — create dialog", () => {
  it("defaults a new plan to the live status and submits it", async () => {
    render(<AdminPlansPage />);

    fireEvent.click(screen.getByRole("button", { name: "ایجاد پلن" }));
    const dialog = await screen.findByRole("dialog");

    // The «وضعیت» select (the dialog's first combobox) opens on «فعال».
    const status = within(dialog).getAllByRole("combobox")[0] as HTMLSelectElement;
    expect(status.value).toBe("active");

    // Fill the two required identity fields…
    fireEvent.change(within(dialog).getByLabelText(/شناسهٔ سیستمی/), {
      target: { value: "pro-annual" },
    });
    fireEvent.change(within(dialog).getByLabelText(/نام نمایشی/), {
      target: { value: "پلن آزمون" },
    });

    // …and save.
    fireEvent.click(within(dialog).getByRole("button", { name: "ایجاد پلن" }));

    await waitFor(() => expect(created.payloads).toHaveLength(1));
    // The submitted plan is ACTIVE — i.e. immediately purchasable on /subscription.
    expect(created.payloads[0]).toMatchObject({ code: "pro-annual", status: "active" });
  });
});
