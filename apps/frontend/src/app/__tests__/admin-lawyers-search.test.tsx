// ============================================================
// LEGALIR — /admin/lawyers search field · request contract
// ============================================================
// Pins the debounced-search behaviour so it cannot regress into a
// request-per-keystroke:
//   • typing moves only the input — the applied search term (and therefore the
//     API request) is untouched until the operator pauses;
//   • after the pause the list searches ONCE, with the final term;
//   • Enter (a form submit) applies immediately and the pending debounce does
//     NOT fire a second request;
//   • the search button applies the term;
//   • re-applying the already-applied term is a no-op (no re-request);
//   • clearing the field returns the list to its default (no search).
// The data hook is mocked, so the test targets the field's request contract,
// not the network — the real /api/v1/admin/lawyers route is covered elsewhere.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";

// Records every params object the page hands to the lawyers query hook. One
// entry per render; a search term is only ever present once it has been
// *applied* (debounced, submitted or button-clicked), never while typing.
const seen = vi.hoisted(() => ({
  calls: [] as { search?: string; lifecycle?: string }[],
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/lawyers",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/hooks/useAdmin", () => ({
  useAdminMe: () => ({ can: () => true, isStaff: true, role: "SUPER_ADMIN", data: undefined }),
  useAdminLawyers: (params: { search?: string; lifecycle?: string }) => {
    seen.calls.push(params);
    return {
      isLoading: false,
      isError: false,
      isFetching: false,
      data: { items: [], total: 0 },
      refetch: vi.fn(),
    };
  },
  useSetAdminLawyerFeatured: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// The drawer and the marketplace barrel pull in their own admin hooks; neither
// is under test here, so stub them to keep the render focused on the field.
vi.mock("@/components/admin/lawyer-detail-drawer", () => ({
  LawyerDetailDrawer: () => null,
  BUCKET_TONES: { REVIEW: "warning", APPROVED: "success", REJECTED: "danger", SUSPENDED: "danger" },
}));
vi.mock("@/components/lawyers", () => ({ LawyerAvatar: () => null }));

import AdminLawyersPage from "@/app/(admin)/admin/lawyers/page";

/** Every distinct applied search term the list has been queried with. */
const appliedTerms = () => seen.calls.filter((c) => c.search).map((c) => c.search);
/** The most recent applied term (null === no search). */
const lastApplied = () => seen.calls[seen.calls.length - 1]?.search ?? null;

function searchBox() {
  return screen.getByRole("textbox", { name: "جستجوی وکیل" });
}

/** Simulate per-keystroke typing: one change event per incremental value. */
function typeInto(input: HTMLElement, text: string) {
  let value = "";
  for (const ch of text) {
    value += ch;
    fireEvent.change(input, { target: { value } });
  }
  return value;
}

/** Cross the debounce boundary (default 600ms). */
async function pause(ms = 700) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** The form that Enter submits (Enter maps to a submit in the browser). */
function submitForm(input: HTMLElement) {
  const form = input.closest("form");
  if (!form) throw new Error("search input is not inside a form");
  fireEvent.submit(form);
}

beforeEach(() => {
  seen.calls.length = 0;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("AdminLawyersPage — search", () => {
  it("does not search while typing; searches once with the final term after the pause", async () => {
    render(<AdminLawyersPage />);
    typeInto(searchBox(), "احمد");

    // Four keystrokes → still nothing applied.
    expect(appliedTerms()).toHaveLength(0);

    await pause(599);
    expect(appliedTerms()).toHaveLength(0); // strictly before the pause: quiet

    await pause(2); // cross the 600ms boundary
    expect(appliedTerms()).toEqual(["احمد"]); // exactly one request, the whole word
  });

  it("applies immediately on Enter and the pending debounce does not duplicate it", async () => {
    render(<AdminLawyersPage />);
    const box = searchBox();
    typeInto(box, "تهران");
    expect(appliedTerms()).toHaveLength(0);

    submitForm(box); // Enter
    expect(appliedTerms()).toEqual(["تهران"]);

    await pause(1000); // the debounce that was pending must not fire again
    expect(appliedTerms()).toEqual(["تهران"]);
  });

  it("applies when the search button is clicked", async () => {
    render(<AdminLawyersPage />);
    typeInto(searchBox(), "تبریز");

    fireEvent.click(screen.getByRole("button", { name: "اعمال جستجو" }));
    expect(appliedTerms()).toEqual(["تبریز"]);
  });

  it("does not re-request an unchanged term", async () => {
    render(<AdminLawyersPage />);
    const box = searchBox();
    typeInto(box, "قزوین");
    submitForm(box);
    await pause(1000);

    const rendersBefore = seen.calls.length;
    submitForm(box); // same term again → no state change, no new request
    await pause(1000);
    expect(seen.calls.length).toBe(rendersBefore);
  });

  it("clearing the field returns the list to no-search", async () => {
    render(<AdminLawyersPage />);
    const box = searchBox();
    typeInto(box, "اصفهان");
    submitForm(box);
    expect(lastApplied()).toBe("اصفهان");

    fireEvent.change(box, { target: { value: "" } });
    await pause(); // auto-apply the empty term after the pause
    expect(lastApplied()).toBeNull();
  });
});
