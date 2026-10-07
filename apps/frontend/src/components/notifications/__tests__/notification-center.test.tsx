// ============================================================
// LEGALIR — Notification Center Tests
// ============================================================
// Covers the single reusable row, the header bell (popover + sheet)
// and the full center's tab filtering. All three read the same
// canonical feed, so the unread count can never disagree.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { fixtureNotifications } from "@legalir/testing";

import { NotificationItem } from "../notification-item";
import { NotificationBell } from "../notification-bell";
import NotificationsPage from "@/app/(app)/notifications/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));

// A stable, assertable router — the mobile bell must `push("/notifications")`.
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

/**
 * jsdom applies no media queries, so the bell's `matchMedia` probe decides
 * which entry point is under test. `narrow = true` models a phone
 * (< 600px → navigate); `false` models tablet/desktop (→ popover).
 */
function setViewport(narrow: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: narrow ? /max-width:\s*599px/.test(query) : false,
      media: query,
      onchange: null,
      addListener: () => {
        /* noop — MediaQueryList listeners are unused in these tests */
      },
      removeListener: () => {
        /* noop — MediaQueryList listeners are unused in these tests */
      },
      addEventListener: () => {
        /* noop — MediaQueryList listeners are unused in these tests */
      },
      removeEventListener: () => {
        /* noop — MediaQueryList listeners are unused in these tests */
      },
      dispatchEvent: () => false,
    }),
  });
}

let queryClient: QueryClient;

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl">{children}</div>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  pushMock.mockClear();
  // Default to the desktop/tablet entry point; mobile tests opt in.
  setViewport(false);
});

const unreadPoints = fixtureNotifications[0]!;
const unreadPersonal = fixtureNotifications[1]!;
const readPublic = fixtureNotifications[2]!;

// ============================================================
// NotificationItem — the single reusable row
// ============================================================

describe("NotificationItem", () => {
  it("renders the title and a category label", () => {
    render(
      <TestWrapper>
        <NotificationItem item={unreadPersonal} />
      </TestWrapper>
    );
    expect(screen.getByText("مشاوره حقوقی")).toBeInTheDocument();
    expect(screen.getByText("شخصی")).toBeInTheDocument();
  });

  it("marks unread rows in the accessible name, not by colour alone", () => {
    render(
      <TestWrapper>
        <NotificationItem item={unreadPersonal} />
      </TestWrapper>
    );
    expect(
      screen.getByRole("link", { name: /شخصی: مشاوره حقوقی — خوانده‌نشده/ })
    ).toBeInTheDocument();
  });

  it("omits the unread suffix once read", () => {
    render(
      <TestWrapper>
        <NotificationItem item={readPublic} />
      </TestWrapper>
    );
    expect(
      screen.getByRole("link", { name: "عمومی: کتابخانه حقوقی راه‌اندازی شد" })
    ).toBeInTheDocument();
  });

  it("renders a signed points delta", () => {
    render(
      <TestWrapper>
        <NotificationItem item={unreadPoints} />
      </TestWrapper>
    );
    expect(screen.getByText("+۱۰۰")).toBeInTheDocument();
  });

  it("calls onActivate when the row is clicked", () => {
    const onActivate = vi.fn();
    render(
      <TestWrapper>
        <NotificationItem item={unreadPersonal} onActivate={onActivate} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByRole("link", { name: /مشاوره حقوقی/ }));
    expect(onActivate).toHaveBeenCalledWith(unreadPersonal);
  });

  it("renders a button (not a link) when there is no href", () => {
    render(
      <TestWrapper>
        <NotificationItem item={unreadPoints} />
      </TestWrapper>
    );
    expect(
      screen.getByRole("button", { name: /امتیاز: امتیاز دریافت کردید/ })
    ).toBeInTheDocument();
  });
});

// ============================================================
// NotificationBell — header entry point
// ============================================================

describe("NotificationBell — desktop & tablet (popover)", () => {
  it("exposes the unread count in its accessible name", async () => {
    render(
      <TestWrapper>
        <NotificationBell />
      </TestWrapper>
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "اعلان‌ها، ۲ پیام خوانده‌نشده" })
      ).toBeInTheDocument()
    );
  });

  it("opens a preview dialog listing the canonical feed", async () => {
    render(
      <TestWrapper>
        <NotificationBell />
      </TestWrapper>
    );
    // Wait for the feed to resolve before opening — the preview renders a
    // skeleton until then.
    const bell = await screen.findByRole("button", { name: /پیام خوانده‌نشده/ });
    fireEvent.click(bell);
    expect(
      await screen.findByRole("dialog", { name: "پیش‌نمایش اعلان‌ها" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("مشاوره حقوقی").length).toBeGreaterThan(0);
  });

  it("links to the full center", async () => {
    render(
      <TestWrapper>
        <NotificationBell />
      </TestWrapper>
    );
    fireEvent.click(await screen.findByRole("button", { name: /پیام خوانده‌نشده/ }));
    // Tablet/desktop render exactly one popover, and it must point at the
    // center.
    const link = await screen.findByRole("link", { name: "مشاهده همه اعلان‌ها" });
    expect(link).toHaveAttribute("href", "/notifications");
  });

  it("closes the preview on Escape", async () => {
    render(
      <TestWrapper>
        <NotificationBell />
      </TestWrapper>
    );
    fireEvent.click(await screen.findByRole("button", { name: /اعلان‌ها/ }));
    await screen.findByRole("dialog", { name: "پیش‌نمایش اعلان‌ها" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "پیش‌نمایش اعلان‌ها" })
      ).not.toBeInTheDocument()
    );
  });
});

describe("NotificationBell — phone (direct navigation, no popup)", () => {
  it("navigates straight to /notifications on tap", async () => {
    setViewport(true);
    render(
      <TestWrapper>
        <NotificationBell />
      </TestWrapper>
    );
    const bell = await screen.findByRole("button", { name: /پیام خوانده‌نشده/ });
    fireEvent.click(bell);
    expect(pushMock).toHaveBeenCalledWith("/notifications");
  });

  it("never opens a preview popup or sheet on a phone", async () => {
    setViewport(true);
    render(
      <TestWrapper>
        <NotificationBell />
      </TestWrapper>
    );
    const bell = await screen.findByRole("button", { name: /پیام خوانده‌نشده/ });
    fireEvent.click(bell);
    expect(
      screen.queryByRole("dialog", { name: "پیش‌نمایش اعلان‌ها" })
    ).not.toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith("/notifications");
  });

  it("does not advertise a dialog it never opens", async () => {
    setViewport(true);
    render(
      <TestWrapper>
        <NotificationBell />
      </TestWrapper>
    );
    const bell = await screen.findByRole("button", { name: /پیام خوانده‌نشده/ });
    expect(bell).not.toHaveAttribute("aria-haspopup");
    expect(bell).not.toHaveAttribute("aria-expanded");
  });
});

// ============================================================
// Notification Center — tabs over ONE canonical source
// ============================================================

describe("NotificationsPage", () => {
  it("renders all four tabs", async () => {
    render(
      <TestWrapper>
        <NotificationsPage />
      </TestWrapper>
    );
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /همه پیام‌ها/ })).toBeInTheDocument()
    );
    expect(screen.getByRole("tab", { name: /پیام‌های عمومی/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /پیام‌های شخصی/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /امتیازها/ })).toBeInTheDocument();
  });

  it("filters the feed by category", async () => {
    render(
      <TestWrapper>
        <NotificationsPage />
      </TestWrapper>
    );
    await waitFor(() => expect(screen.getByText("مشاوره حقوقی")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("tab", { name: /امتیازها/ }));
    expect(screen.getByText("امتیاز دریافت کردید")).toBeInTheDocument();
    expect(screen.queryByText("مشاوره حقوقی")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /پیام‌های عمومی/ }));
    expect(screen.getByText("کتابخانه حقوقی راه‌اندازی شد")).toBeInTheDocument();
    expect(screen.queryByText("امتیاز دریافت کردید")).not.toBeInTheDocument();
  });

  it("shows the unread badge and marks all as read", async () => {
    render(
      <TestWrapper>
        <NotificationsPage />
      </TestWrapper>
    );
    await waitFor(() => expect(screen.getByText(/۲ خوانده‌نشده/)).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole("button", { name: "علامت‌گذاری همه به‌عنوان خوانده‌شده" })
    );
    await waitFor(() =>
      expect(screen.queryByText(/خوانده‌نشده/)).not.toBeInTheDocument()
    );
  });
});
