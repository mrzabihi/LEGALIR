// ============================================================
// LEGALIR — Bottom navigation behaviour tests
// ============================================================
// Covers the two things the bar is responsible for: lighting the right
// destination for the current path, and opening/closing the «ساخت جدید»
// sheet. The route-matching rules themselves are unit-tested in
// `lib/__tests__/routes.test.ts`; here we assert the rendered result.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";

// jsdom has no router; the bar reads the pathname and pushes `/new` from the
// centre action.
let mockPathname = "/dashboard";
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

import { BottomNav } from "@/components/app/bottom-nav";

beforeEach(() => {
  mockPathname = "/dashboard";
  mockPush.mockClear();
});

describe("BottomNav", () => {
  it("renders the four destinations in RTL visual order with real hrefs", () => {
    render(<BottomNav />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/dashboard",
      "/services",
      "/support",
      "/profile",
    ]);
  });

  it("marks only the active destination with aria-current", () => {
    mockPathname = "/services";
    render(<BottomNav />);
    const active = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page");
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAttribute("href", "/services");
  });

  it("lights no destination when the path is outside the four", () => {
    mockPathname = "/contracts";
    render(<BottomNav />);
    const active = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page");
    expect(active).toHaveLength(0);
  });

  it("opens the create sheet from the centre button", () => {
    render(<BottomNav />);
    const trigger = screen.getByRole("button", { name: "ساخت جدید" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("link")).toHaveLength(4);
  });

  it("closes the sheet on Escape", async () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "ساخت جدید" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    // The sheet plays a short exit animation before unmounting.
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("closes the sheet when the route changes", async () => {
    const { rerender } = render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "ساخت جدید" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    mockPathname = "/services";
    rerender(<BottomNav />);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("keeps the destinations interactive while the sheet is open (non-modal)", () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "ساخت جدید" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // The sheet must not be modal and must not trap focus.
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-modal", "true");

    // Every destination link is still present and clickable.
    const nav = screen.getByRole("navigation", { name: "منوی پایین" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link).not.toHaveAttribute("aria-hidden", "true");
    }
  });

  it("closes the sheet when a destination is tapped", async () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "ساخت جدید" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "خدمات" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("toggles the sheet from the centre button", async () => {
    render(<BottomNav />);
    const trigger = screen.getByRole("button", { name: "ساخت جدید" });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("navigates to /new before opening the sheet", () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "ساخت جدید" }));

    // The launcher must be reached *and* the sheet raised, so dismissing the
    // sheet still leaves the user on the full «ساخت جدید» page.
    expect(mockPush).toHaveBeenCalledWith("/new");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not push again when the centre button is tapped while already on /new", () => {
    mockPathname = "/new";
    render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "ساخت جدید" }));

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the sheet open when the centre action arrives at /new", async () => {
    const { rerender } = render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "ساخت جدید" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // The centre tap's own navigation lands on /new — that must NOT dismiss
    // the sheet (only a destination tap or an unrelated route change does).
    mockPathname = "/new";
    rerender(<BottomNav />);
    await Promise.resolve();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
