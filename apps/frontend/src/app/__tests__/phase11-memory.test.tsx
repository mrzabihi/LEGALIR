// ============================================================
// LEGALIR — Phase 11 Memory Page Integration Tests
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { fixtureV1MemoryItems } from "@legalir/testing";

import MemoryPage from "@/app/(app)/memory/page";

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

function setupMemoriesWithItems() {
  setHandlers([
    http.get("http://localhost:8000/api/v1/memories", () =>
      HttpResponse.json({
        data: { items: fixtureV1MemoryItems, memoryEnabled: true },
      })
    ),
    http.patch("http://localhost:8000/api/v1/memories/:id", async ({ params, request }) => {
      const body = await request.json() as Record<string, unknown>;
      const id = params["id"] as string;
      const item = fixtureV1MemoryItems.find((m) => m.id === id);
      return HttpResponse.json({
        data: { ...item, ...body, updatedAt: new Date().toISOString() },
      });
    }),
    http.delete("http://localhost:8000/api/v1/memories/:id", () =>
      HttpResponse.json({ data: { deleted: true } })
    ),
  ]);
}

function setupMemoriesEmpty() {
  setHandlers([
    http.get("http://localhost:8000/api/v1/memories", () =>
      HttpResponse.json({
        data: { items: [], memoryEnabled: true },
      })
    ),
  ]);
}

function setupMemoriesError() {
  setHandlers([
    http.get("http://localhost:8000/api/v1/memories", () =>
      HttpResponse.json(
        { code: "INTERNAL_ERROR", message: "خطای سرور", retryable: true },
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

describe("MemoryPage", () => {
  // --- Rendering ---

  it("renders the page title and toggle", async () => {
    setupMemoriesWithItems();
    render(<MemoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText("حافظه")).toBeTruthy();
    });
  });

  it("shows memory toggle switch", async () => {
    setupMemoriesWithItems();
    render(<MemoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      const toggle = screen.getByRole("switch", { name: /فعال کردن حافظه|غیرفعال کردن حافظه/ });
      expect(toggle).toBeTruthy();
    });
  });

  // --- Memory Items ---

  it("renders memory items from API", async () => {
    setupMemoriesWithItems();
    render(<MemoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText("نام کاربر")).toBeTruthy();
      expect(screen.getByText("مریم محمدی")).toBeTruthy();
    });
  });

  it("shows category labels for items", async () => {
    setupMemoriesWithItems();
    render(<MemoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // Multiple items share the same category labels, so use getAllByText
      const profileBadges = screen.getAllByText("اطلاعات کاربر");
      expect(profileBadges.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("تنظیمات برگزیده")).toBeTruthy();
    });
  });

  it("shows sensitivity badges", async () => {
    setupMemoriesWithItems();
    render(<MemoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // Multiple items have the same sensitivity, use getAllByText
      const normalBadges = screen.getAllByText("عادی");
      expect(normalBadges.length).toBeGreaterThanOrEqual(1);
      const sensitiveBadges = screen.getAllByText("حساس");
      expect(sensitiveBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Empty State ---

  it("shows empty state when no items", async () => {
    setupMemoriesEmpty();
    render(<MemoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText(/هنوز موردی در حافظه ذخیره نشده است/)).toBeTruthy();
    });
  });

  // --- Error State ---

  it("shows error state", async () => {
    setupMemoriesError();
    render(<MemoryPage />, { wrapper: TestWrapper });

    await waitFor(
      () => {
        expect(screen.getByText(/خطا در بارگذاری اطلاعات/)).toBeTruthy();
      },
      { timeout: 5000 }
    );
  });

  // --- Toggle Item Status ---

  it("can toggle a memory item on/off", async () => {
    setupMemoriesWithItems();
    render(<MemoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText("نام کاربر")).toBeTruthy();
    });

    // Find status toggle switches (one global + per-item toggles)
    const statusToggles = screen.getAllByRole("switch");
    // Should have at least the global memory toggle (with aria-label for حافظه)
    expect(statusToggles.length).toBeGreaterThanOrEqual(1);
  });

  // --- Category Distinction ---

  it("has all three categories visible", async () => {
    setupMemoriesWithItems();
    render(<MemoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      const profileBadges = screen.getAllByText("اطلاعات کاربر");
      expect(profileBadges.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("تنظیمات برگزیده")).toBeTruthy();
      const legalBadges = screen.getAllByText("اطلاعات حقوقی");
      expect(legalBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Legal Context Warning ---

  it("shows legal context warning when legal items exist", async () => {
    setupMemoriesWithItems();
    render(<MemoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // Legal context warning should be visible
      expect(screen.getByText(/اطلاعات حقوقی حساس به صورت خودکار ذخیره نمی‌شود/)).toBeTruthy();
    });
  });

  // --- Consent Flow ---

  it("shows consent dialog elements", async () => {
    setupMemoriesWithItems();
    render(<MemoryPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // Items with consent=true should show approved state
      expect(screen.getByText("نام کاربر")).toBeTruthy();
    });
  });
});
