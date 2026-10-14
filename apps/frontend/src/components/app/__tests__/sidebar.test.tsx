// ============================================================
// LEGALIR — Desktop sidebar «ساخت جدید» create-flow tests
// ============================================================
// The sidebar item for `/new` is a verb *and* a destination, exactly like the
// mobile centre button: tapping it first navigates to `/new` (the full
// launcher) and then raises the shared create sheet, so dismissing the sheet
// never dumps the user back on the previous page. These tests prove that
// contract independent of any dev-server behaviour.
//
// The surrounding sidebar chrome (the `useMe` query and the subscription
// badge) is stubbed so the test exercises only the create-flow wiring.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";

// jsdom has no router; the sidebar reads the pathname and pushes `/new` from
// the create item.
let mockPathname = "/dashboard";
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

// The sidebar pulls the current user (React Query) and the subscription badge
// (React Query). Neither is under test here, so pin them to inert stubs.
vi.mock("@/hooks/useDashboard", () => ({
  useMe: () => ({ data: undefined }),
}));
vi.mock("@/components/subscription/subscription-status", () => ({
  SubscriptionStatusBadge: () => null,
}));

import { Sidebar } from "@/components/app/sidebar";

beforeEach(() => {
  mockPathname = "/dashboard";
  mockPush.mockClear();
});

describe("Sidebar — «ساخت جدید» create flow", () => {
  it("renders the create item as a button (a verb), not a link", () => {
    render(<Sidebar userRole="user" />);
    const nav = screen.getByRole("navigation", { name: "ناوبری اصلی" });
    const create = within(nav).getByRole("button", { name: "ساخت جدید" });

    expect(create).toHaveAttribute("aria-haspopup", "dialog");
    expect(create).toHaveAttribute("aria-controls", "create-action-sheet");
    expect(create).toHaveAttribute("aria-expanded", "false");
    // No `/new` link — it is a button only.
    expect(within(nav).queryByRole("link", { name: "ساخت جدید" })).toBeNull();
  });

  it("navigates to /new before opening the sheet", () => {
    render(<Sidebar userRole="user" />);
    const create = screen.getByRole("button", { name: "ساخت جدید" });

    fireEvent.click(create);

    // The launcher must be reached *and* the sheet raised, so dismissing the
    // sheet still leaves the user on the full «ساخت جدید» page.
    expect(mockPush).toHaveBeenCalledWith("/new");
    expect(create).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog");
    // Four AI quick-start cards + the distinct lawyer-consultation card.
    expect(within(dialog).getAllByRole("link")).toHaveLength(5);
  });

  it("does not push again when the create item is tapped while already on /new", () => {
    mockPathname = "/new";
    render(<Sidebar userRole="user" />);
    fireEvent.click(screen.getByRole("button", { name: "ساخت جدید" }));

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("marks the create item as the current page on /new", () => {
    mockPathname = "/new";
    render(<Sidebar userRole="user" />);
    const create = screen.getByRole("button", { name: "ساخت جدید" });
    expect(create).toHaveAttribute("aria-current", "page");
  });

  it("closes the sheet when the route changes elsewhere", async () => {
    const { rerender } = render(<Sidebar userRole="user" />);
    fireEvent.click(screen.getByRole("button", { name: "ساخت جدید" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    mockPathname = "/services";
    rerender(<Sidebar userRole="user" />);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("keeps the sheet open when the create action arrives at /new", async () => {
    const { rerender } = render(<Sidebar userRole="user" />);
    fireEvent.click(screen.getByRole("button", { name: "ساخت جدید" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // The create tap's own navigation lands on /new — that must NOT dismiss
    // the sheet (only an unrelated route change does).
    mockPathname = "/new";
    rerender(<Sidebar userRole="user" />);
    await Promise.resolve();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("toggles the sheet closed from the create item", async () => {
    render(<Sidebar userRole="user" />);
    const create = screen.getByRole("button", { name: "ساخت جدید" });

    fireEvent.click(create);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(create);
    expect(create).toHaveAttribute("aria-expanded", "false");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});
