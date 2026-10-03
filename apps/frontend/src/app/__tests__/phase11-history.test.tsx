// ============================================================
// LEGALIR — Phase 11 History Page Integration Tests
// ============================================================

import { vi } from "vitest";

// The workspace reads `?archived=true` from the URL and pushes on edit.
const pushMock = vi.fn();
let currentSearch = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

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

/** A history GET handler that honours the `archived` query param. */
function historyHandler() {
  return http.get("http://localhost:8000/api/v1/history", ({ request }) => {
    const url = new URL(request.url);
    const archivedView = url.searchParams.get("archived") === "true";
    const items = fixtureV1HistoryItems.filter((i) => i.archived === archivedView);
    return HttpResponse.json({
      data: {
        items,
        pagination: { page: 1, pageSize: 20, total: items.length, totalPages: 1 },
        archivedCount: fixtureV1HistoryItems.filter((i) => i.archived).length,
        retention: { maxItems: 100, maxAgeDays: 31 },
      },
    });
  });
}

function setupHistoryWithItems() {
  setHandlers([historyHandler()]);
}

function setupHistoryEmpty() {
  setHandlers([
    http.get("http://localhost:8000/api/v1/history", () =>
      HttpResponse.json({
        data: {
          items: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          archivedCount: 0,
          retention: { maxItems: 100, maxAgeDays: 31 },
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
  currentSearch = "";
  pushMock.mockClear();
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

  // --- Search ---

  it("has a search input", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/جستجو/);
      expect(searchInput).toBeTruthy();
    });
  });

  // --- Retention note ---

  it("shows the retention note on the active view", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByText(/۱۰۰ مورد و حداکثر ۳۱ روز/)).toBeTruthy();
    });
  });

  // --- Archive entry point ---

  it("shows an archive button with the archived count", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByLabelText(/بایگانی \(1 مورد\)/)).toBeTruthy();
    });
  });

  it("renders the archive view when ?archived=true", async () => {
    currentSearch = "archived=true";
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByText("بایگانی")).toBeTruthy();
      expect(screen.getByText(/از پاک‌سازی خودکار تاریخچه مستثنا هستند/)).toBeTruthy();
      // The archived fixture item is listed.
      expect(screen.getByText("چک برگشتی و نحوه اقدام")).toBeTruthy();
    });
  });

  // --- Per-status actions ---

  it("shows a continue action for a draft item", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getAllByText("ادامه").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows a view-result action for a completed item", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getAllByText("مشاهده نتیجه").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows a retry action for a failed item", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByText("مشاهده جزئیات خطا")).toBeTruthy();
      // Retry is a secondary icon action — labelled, not visible text.
      expect(screen.getByLabelText("تلاش مجدد")).toBeTruthy();
    });
  });

  // --- Delete confirmation ---

  it("opens the permanent-delete dialog and cancels without deleting", async () => {
    setupHistoryWithItems();
    render(<HistoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getAllByLabelText("حذف").length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByLabelText("حذف")[0]!);

    await waitFor(() => {
      expect(screen.getByText("حذف دائمی این مورد؟")).toBeTruthy();
      expect(screen.getByText("مطمئنم، حذف کن")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("انصراف"));

    await waitFor(() => {
      expect(screen.queryByText("حذف دائمی این مورد؟")).toBeNull();
    });
  });

  it("deletes the item when the dialog is confirmed", async () => {
    let deletedId: string | null = null;
    setHandlers([
      historyHandler(),
      http.delete("http://localhost:8000/api/v1/history", ({ request }) => {
        deletedId = new URL(request.url).searchParams.get("id");
        return HttpResponse.json({ data: { id: deletedId, title: "x", kind: "conversation" } });
      }),
    ]);

    render(<HistoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getAllByLabelText("حذف").length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByLabelText("حذف")[0]!);
    await waitFor(() => expect(screen.getByText("مطمئنم، حذف کن")).toBeTruthy());
    fireEvent.click(screen.getByText("مطمئنم، حذف کن"));

    await waitFor(() => {
      expect(deletedId).not.toBeNull();
    });
  });

  // --- Edit (fork) ---

  it("forks a completed item into a new process and navigates", async () => {
    setHandlers([
      historyHandler(),
      http.post("http://localhost:8000/api/v1/history/:id/edit", ({ params }) =>
        HttpResponse.json(
          { data: { id: `new-${params["id"]}`, href: "/chat/new", title: "نسخه جدید" } },
          { status: 201 }
        )
      ),
    ]);

    render(<HistoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getAllByLabelText("ویرایش").length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByLabelText("ویرایش")[0]!);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/chat/new");
    });
  });
});
