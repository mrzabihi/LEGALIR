// ============================================================
// LEGALIR — Phase 11 Profile & Settings Integration Tests
// ============================================================

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import {
  fixtureProfileComplete,
  fixtureProfileIncomplete,
  fixtureProfileUsage,
  fixtureV1SubscriptionGold,
  fixtureV1SubscriptionHistory,
  fixtureV1MemoryItems,
} from "@legalir/testing";

import { ThemeProvider } from "@/lib/theme";
import ProfilePage from "@/app/(app)/profile/page";
import SettingsPage from "@/app/(app)/settings/page";

// ============================================================
// JSDOM polyfills
// ============================================================

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      addListener: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      removeListener: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      addEventListener: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

// ============================================================
// Test Wrapper
// ============================================================

let queryClient: QueryClient;

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div dir="rtl">{children}</div>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function setHandlers(handlers: ReturnType<typeof http.get>[]) {
  server.use(...handlers);
}

// ============================================================
// Helpers
// ============================================================

function setupMe(profile = fixtureProfileComplete) {
  setHandlers([
    http.get("http://localhost:8000/api/v1/me", () =>
      HttpResponse.json({
        data: {
          user: {
            id: profile.userId,
            mobileE164: "+989120000003",
            mobileDisplay: "۰۹۱۲۰۰۰۰۰۰۳",
            status: "active" as const,
          },
          profile,
          preferences: {
            theme: "light" as const,
            locale: "fa-IR" as const,
            notifications: {
              appointments: true,
              contractExpiry: true,
              lawyerResponse: true,
              paymentStatus: true,
              caseUpdate: true,
              marketing: false,
            },
          },
          role: "user" as const,
        },
      })
    ),
    http.get("http://localhost:8000/api/v1/profile/usage", () =>
      HttpResponse.json({ data: fixtureProfileUsage })
    ),
    http.get("http://localhost:8000/api/v1/subscription-history", () =>
      HttpResponse.json({
        data: {
          items: fixtureV1SubscriptionHistory,
          pagination: { page: 1, pageSize: 20, total: 3, totalPages: 1 },
        },
      })
    ),
    // The «اشتراک» card reads the canonical status from this endpoint.
    http.get("http://localhost:8000/api/v1/subscriptions/current", () =>
      HttpResponse.json({ data: fixtureV1SubscriptionGold })
    ),
    http.get("http://localhost:8000/api/v1/me/preferences", () =>
      HttpResponse.json({
        data: {
          theme: "light" as const,
          locale: "fa-IR" as const,
          notifications: {
            appointments: true,
            contractExpiry: true,
            lawyerResponse: true,
            paymentStatus: true,
            caseUpdate: true,
            marketing: false,
          },
          privacy: {
            shareUsageData: true,
            allowAiTraining: false,
            storeConversationHistory: true,
            autoMemoryConsent: false,
          },
        },
      })
    ),
    http.get("http://localhost:8000/api/v1/memories", () =>
      HttpResponse.json({
        data: { items: fixtureV1MemoryItems, memoryEnabled: true },
      })
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

// ============================================================
// Profile Page Tests
// ============================================================

describe("ProfilePage", () => {
  it("renders user avatar with initial", async () => {
    setupMe();
    render(<ProfilePage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // The profile name "مریم محمدی" starts with "م"
      expect(screen.getByText("م")).toBeTruthy();
    });
  });

  it("renders display name", async () => {
    setupMe();
    render(<ProfilePage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText("مریم محمدی")).toBeTruthy();
    });
  });

  it("renders city and occupation inside the collapsible details", async () => {
    setupMe();
    render(<ProfilePage />, { wrapper: TestWrapper });

    // Details are collapsed by default — open them first.
    const toggle = await screen.findByRole("button", { name: /جزئیات پروفایل/ });
    fireEvent.click(toggle);

    await waitFor(() => {
      // "تهران" can appear for both city and province; assert at least one.
      expect(screen.getAllByText("تهران").length).toBeGreaterThan(0);
      expect(screen.getByText("کارشناس حقوقی")).toBeTruthy();
    });
  });

  it("renders profile completion percentage", async () => {
    setupMe();
    render(<ProfilePage />, { wrapper: TestWrapper });

    await waitFor(() => {
      const pctElements = screen.getAllByText(/۸۵/);
      expect(pctElements.length).toBeGreaterThan(0);
    });
  });

  it("renders mobile number as read-only in the account identity section", async () => {
    setupMe();
    render(<ProfilePage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // The identity section labels the mobile and explains it is immutable.
      expect(screen.getByText("شماره موبایل")).toBeTruthy();
      expect(
        screen.getByText("این شماره هنگام ثبت‌نام حساب ثبت شده و قابل تغییر نیست.")
      ).toBeTruthy();
      // Mobile icon should be present (summary + identity section)
      expect(screen.getAllByText(/۰۹۱۲/).length).toBeGreaterThan(0);
    });
  });

  it("renders pie chart for token usage", async () => {
    setupMe();
    render(<ProfilePage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // Pie chart should have SVG elements
      const svg = document.querySelector("svg");
      expect(svg).toBeTruthy();
    });
  });

  it("renders subscription card with plan and manage CTA", async () => {
    setupMe();
    render(<ProfilePage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // The Account Hub shows an «اشتراک» card with the canonical plan name
      // (from /subscriptions/current) and a manage CTA.
      expect(screen.getByText("طلا")).toBeTruthy();
      expect(screen.getByText("مدیریت اشتراک")).toBeTruthy();
    });
  });

  it("shows legal space hub links", async () => {
    setupMe();
    render(<ProfilePage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText("فضای حقوقی من")).toBeTruthy();
      expect(screen.getByText("گفت‌وگوهای من")).toBeTruthy();
      expect(screen.getByText("اسناد من")).toBeTruthy();
      expect(screen.getByText("قراردادهای من")).toBeTruthy();
      expect(screen.getByText("تاریخچه")).toBeTruthy();
      expect(screen.getByText("حافظه و دانش")).toBeTruthy();
    });
  });

  it("shows low completion warning for incomplete profile", async () => {
    setupMe(fixtureProfileIncomplete);
    render(<ProfilePage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // completionPercent = 30 shows "۳۰٪" in the progress bar label
      const elements = screen.getAllByText(/۳۰/);
      expect(elements.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// Settings Page Tests
// ============================================================

describe("SettingsPage (hub)", () => {
  it("renders the page title", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "تنظیمات" })).toBeTruthy();
    });
  });

  it("routes to every dedicated sub-page instead of editing inline", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    const expected = [
      "/settings/notifications",
      "/settings/privacy",
      "/settings/security",
      "/settings/usage",
      "/settings/memory",
      "/settings/data",
      "/settings/account",
    ];

    await waitFor(() => {
      for (const href of expected) {
        expect(document.querySelector(`a[href="${href}"]`)).toBeTruthy();
      }
    });
  });

  it("does not render any inline setting controls (navigation-only hub)", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "تنظیمات" })).toBeTruthy();
    });

    // The hub owns no data source, so it must not render toggles or tabs.
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.queryByText("مصرف")).toBeNull();
  });

  it("marks the account-closure card as dangerous", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      const link = document.querySelector('a[href="/settings/account"]');
      expect(link?.className).toContain("border-error/40");
    });
  });
});

// ============================================================
// Responsive Layout Tests
// ============================================================

describe("Phase 11 — Responsive", () => {
  it("profile page renders without overflow on mobile viewport", async () => {
    setupMe();
    render(<ProfilePage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // The Account Hub outer container is max-w-3xl (replaces max-w-2xl)
      const container = document.querySelector(".max-w-3xl");
      expect(container).toBeTruthy();
    });
  });

  it("settings hub renders its card list on a mobile-size container", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // The hub is a vertical card list — one link per sub-page.
      const links = document.querySelectorAll('a[href^="/settings/"]');
      expect(links.length).toBeGreaterThan(1);
    });
  });
});
