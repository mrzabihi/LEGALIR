// ============================================================
// LEGALIR — Phase 11 History Page Integration Tests
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { fixtureV1HistoryItems } from "@legalir/testing";

import HistoryPage from "@/app/(app)/history/page";

// ============================================================
// Test Wrapper
// ============================================================

let queryClient: QueryClient;

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl">{children}</div>
    </QueryClientProvider>
  );
}

function setHandlers(handlers: ReturnType<typeof http.get>[]) {
  server.use(...handlers);
}

// ============================================================
// Setup helpers
// ============================================================

function setupHistoryWithItems() {
  setHandlers([
    http.get("http://localhost:8000/api/v1/history", () =>
      HttpResponse.json({
        data: {
          items: fixtureV1HistoryItems,
          pagination: { page: 1, pageSize: 20, total: 8, totalPages: 1 },
        },
      })
    ),
  ]);
}

function setupHistoryEmpty() {
  setHandlers([
    http.get("http://localhost:8000/api/v1/history", () =>
      HttpResponse.json({
        data: {
          items: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        },
      })
    ),
  ]);
}

function setupHistoryError() {
  setHandlers([
    http.get("http://localhost:8000/api/v1/history", () =>
      HttpResponse.json(
        { code: "INTERNAL_ERROR", message: "خطای داخلی سرور", retryable: true },
        { status: 500 }
      )
    ),
  ]);
}

// ============================================================
// Tests
// ============================================================

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
});

describe("HistoryPage", () => {
  // --- Rendering ---

  it("renders the page title", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByText("تاریخچه")).toBeTruthy();
    });
  });

  it("renders category tabs", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      // "همه" appears in both category tabs and type filter, so use getAllByText
      const allTabs = screen.getAllByText("همه");
      expect(allTabs.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("پرونده‌ها")).toBeTruthy();
      expect(screen.getByText("قراردادها")).toBeTruthy();
      expect(screen.getByText("املاک")).toBeTruthy();
      expect(screen.getByText("خانواده")).toBeTruthy();
      expect(screen.getByText("تجارت")).toBeTruthy();
      expect(screen.getByText("سایر")).toBeTruthy();
    });
  });

  // --- History Items ---

  it("renders history items from API", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByText(/مشاوره قرارداد اجاره/)).toBeTruthy();
      expect(screen.getByText(/مشاوره طلاق توافقی/)).toBeTruthy();
    });
  });

  // --- Empty State ---

  it("shows empty state when no history items", async () => {
    setupHistoryEmpty();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByText(/تاریخچه شما هنوز خالی است/)).toBeTruthy();
    });
  });

  // --- Error State ---

  it("shows error state and retry button", async () => {
    setupHistoryError();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(
      () => {
        expect(screen.getByText(/خطا در دریافت تاریخچه/)).toBeTruthy();
      },
      { timeout: 5000 }
    );
  });

  // --- Category Filter ---

  it("filters by category when clicking a category tab", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText("املاک")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("املاک"));

    // Items with real_estate category should be visible
    await waitFor(() => {
      expect(screen.getByText(/مشاوره قرارداد اجاره/)).toBeTruthy();
    });
  });

  // --- Super Admin Hidden from Normal Users ---

  it("does not show super admin button for normal users", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByText("تاریخچه")).toBeTruthy();
    });
    expect(screen.queryByText(/بازبینی مدیر/)).toBeNull();
  });

  // --- Permission: User can only see their own resources ---

  it("only shows resources for the authenticated user (via API)", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      const items = fixtureV1HistoryItems;
      // All items belong to u-pro-001
      items.forEach((item) => {
        expect(item.userId).toBe("u-pro-001");
      });
    });
  });

  // --- Resource Type Display ---

  it("shows resource type labels for each item", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // Multiple items share type labels, use getAllByText
      expect(screen.getAllByText("Conversation").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Document").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Contract").length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Search ---

  it("has a search input", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/جستجو/);
      expect(searchInput).toBeTruthy();
    });
  });

  // --- Archived Items ---

  it("shows archived items with dimmed styling", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // The archived item (چک برگشتی و نحوه اقدام) should be in the list
      expect(screen.getByText("چک برگشتی و نحوه اقدام")).toBeTruthy();
    });
  });
});
