import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
    replace: vi.fn(),
  }),
}));

// ============================================================
// LEGALIR — Dashboard Page Integration Tests
// Tests the full Workplace Dashboard with MSW-backed data
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import {
  fixtureDashboard,
  fixtureDashboardEmpty,
  fixtureUsageSummary,
  fixtureUserPro,
  fixtureProfileComplete,
  fixturePreferences,
} from "@legalir/testing";

import DashboardPage from "@/app/(app)/dashboard/page";

// ============================================================
// Test Wrapper with fresh React Query client per test
// ============================================================

let queryClient: QueryClient;

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl">{children}</div>
    </QueryClientProvider>
  );
}

// ============================================================
// Helper to set up MSW handlers
// ============================================================

function setHandlers(handlers: ReturnType<typeof http.get>[]) {
  server.use(...handlers);
}

// ============================================================
// Pro User Handlers
// ============================================================

function setupProUser() {
  setHandlers([
    http.get("http://localhost:8000/api/v1/me", () =>
      HttpResponse.json({
        data: {
          user: fixtureUserPro,
          profile: fixtureProfileComplete,
          preferences: fixturePreferences,
          role: "user",
        },
      })
    ),
    http.get("http://localhost:8000/api/v1/dashboard/summary", () =>
      HttpResponse.json({ data: fixtureDashboard })
    ),
    http.get("http://localhost:8000/api/v1/usage/summary", () =>
      HttpResponse.json({ data: fixtureUsageSummary })
    ),
    http.get("http://localhost:8000/api/v1/activities/recent", () =>
      HttpResponse.json({
        data: {
          items: fixtureDashboard.recentActivity,
          pagination: { page: 1, pageSize: 10, total: 3, totalPages: 1 },
        },
      })
    ),
  ]);
}

// ============================================================
// New User Handlers
// ============================================================

function setupNewUser() {
  setHandlers([
    http.get("http://localhost:8000/api/v1/me", () =>
      HttpResponse.json({
        data: {
          user: {
            id: "u-new-001",
            mobileE164: "+989120000001",
            mobileDisplay: "۰۹۱۲۰۰۰۰۰۰۱",
            status: "active" as const,
          },
          profile: {
            userId: "u-new-001",
            displayName: null,
            city: null,
            occupation: null,
            completionPercent: 30,
            avatarUrl: null,
          },
          preferences: fixturePreferences,
          role: "user",
        },
      })
    ),
    http.get("http://localhost:8000/api/v1/dashboard/summary", () =>
      HttpResponse.json({ data: fixtureDashboardEmpty })
    ),
    http.get("http://localhost:8000/api/v1/usage/summary", () =>
      HttpResponse.json({
        data: { entitlements: [], periodEnd: "2026-08-30T00:00:00Z", daysRemaining: 23 },
      })
    ),
    http.get("http://localhost:8000/api/v1/activities/recent", () =>
      HttpResponse.json({
        data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      })
    ),
  ]);
}

// ============================================================
// Error (partial loading) Handlers
// ============================================================

function setupPartialError() {
  setHandlers([
    http.get("http://localhost:8000/api/v1/me", () =>
      new HttpResponse(null, { status: 500 })
    ),
    http.get("http://localhost:8000/api/v1/dashboard/summary", () =>
      HttpResponse.json({ data: fixtureDashboard })
    ),
    http.get("http://localhost:8000/api/v1/usage/summary", () =>
      new HttpResponse(null, { status: 500 })
    ),
    http.get("http://localhost:8000/api/v1/activities/recent", () =>
      HttpResponse.json({
        data: { items: fixtureDashboard.recentActivity, pagination: { page: 1, pageSize: 10, total: 3, totalPages: 1 } },
      })
    ),
  ]);
}

// ============================================================
// Tests
// ============================================================

describe("Dashboard Page — Pro User", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    setupProUser();
  });

  it("renders personalized greeting", async () => {
    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/سلام، مریم محمدی/)).toBeInTheDocument();
    });
  });

  it("renders quick actions section always", () => {
    // Quick actions are static and render immediately
    render(<TestWrapper><DashboardPage /></TestWrapper>);
    expect(screen.getByText("مشاوره حقوقی")).toBeInTheDocument();
    expect(screen.getAllByText("بررسی قرارداد").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("تنظیم قرارداد")).toBeInTheDocument();
  });

  it("renders promo banner for gold plan", async () => {
    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/ارتقا به اشتراک الماس/)).toBeInTheDocument();
    });
  });

  it("renders recent activities", async () => {
    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText("مشاوره قرارداد اجاره")).toBeInTheDocument();
    });
  });

  it("renders usage summary with entitlements", async () => {
    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText("پیام هوش مصنوعی")).toBeInTheDocument();
    });
  });

  it("does not render an announcement card on the dashboard", () => {
    render(<TestWrapper><DashboardPage /></TestWrapper>);
    // Notifications moved to the Notification Center behind the header bell.
    expect(screen.queryByText("اعلان جدیدی ندارید")).not.toBeInTheDocument();
  });
});

describe("Dashboard Page — New User (Empty State)", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    setupNewUser();
  });

  it("shows generic greeting for new users without display name", async () => {
    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/سلام، کاربر/)).toBeInTheDocument();
    });
  });

  it("shows profile completion card for incomplete profile", async () => {
    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "تکمیل پروفایل" })).toBeInTheDocument();
    });
  });

  it("shows empty state for recent activities", async () => {
    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/هنوز پیش‌نویسی ندارید/)).toBeInTheDocument();
    });
  });

  it("shows empty state CTA for new users", async () => {
    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      // The empty state CTA section appears when no activities exist
      expect(screen.getByText("شروع کنید!")).toBeInTheDocument();
    });
  });

  it("still shows quick actions for new users", () => {
    render(<TestWrapper><DashboardPage /></TestWrapper>);
    // Quick actions are static
    expect(screen.getByText("مشاوره حقوقی")).toBeInTheDocument();
  });
});

describe("Dashboard Page — Partial Loading (Error Resilience)", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    setupPartialError();
  });

  it("still renders dashboard layout even when some endpoints fail", () => {
    render(<TestWrapper><DashboardPage /></TestWrapper>);
    // Quick actions are static and should always render
    expect(screen.getByText("مشاوره حقوقی")).toBeInTheDocument();
    expect(screen.getAllByText("بررسی قرارداد").length).toBeGreaterThanOrEqual(1);
  });

  it("does not crash when some endpoints fail and others succeed", async () => {
    render(<TestWrapper><DashboardPage /></TestWrapper>);

    // Static content always renders regardless of API failures
    expect(screen.getByText("مشاوره حقوقی")).toBeInTheDocument();

    // Dashboard summary succeeds (handler returns 200), so recent activities should render
    // This proves one failed widget doesn't break a successful one
    await waitFor(() => {
      expect(screen.getByText("مشاوره قرارداد اجاره")).toBeInTheDocument();
    });
  });
});
