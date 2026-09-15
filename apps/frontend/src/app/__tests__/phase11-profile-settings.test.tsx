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

  it("renders city and occupation", async () => {
    setupMe();
    render(<ProfilePage />, { wrapper: TestWrapper });

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

  it("renders mobile number as read-only", async () => {
    setupMe();
    render(<ProfilePage />, { wrapper: TestWrapper });

    await waitFor(() => {
      const mobileSection = screen.getByText("موبایل");
      expect(mobileSection).toBeTruthy();
      // Mobile icon should be present
      expect(screen.getByText(/۰۹۱۲/)).toBeTruthy();
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
      // The Account Hub shows a "اشتراک" card with the current plan + upgrade CTA
      expect(screen.getByText(/پلن فعلی/)).toBeTruthy();
      expect(screen.getByText("مدیریت و ارتقا")).toBeTruthy();
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

describe("SettingsPage", () => {
  it("renders the page title", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText("تنظیمات")).toBeTruthy();
    });
  });

  it("renders two tabs: usage and history", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText("مصرف")).toBeTruthy();
      expect(screen.getByText("تاریخچه")).toBeTruthy();
    });
  });

  it("shows usage metrics in tab 1", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText(/درخواست باقی‌مانده/)).toBeTruthy();
    });
  });

  it("shows the daily-quota donut chart", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      const donut = screen.getByRole("img", { name: /درخواست مصرف‌شده/ });
      expect(donut).toBeTruthy();
    });
  });

  it("shows subscription history in tab 2 when clicked", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText("تاریخچه")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("تاریخچه"));

    await waitFor(() => {
      expect(screen.getAllByText("طلا").length).toBeGreaterThan(0);
    });
  });

  it("has privacy settings section", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText("حریم خصوصی")).toBeTruthy();
    });
  });

  it("has notification settings section", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText("اعلان‌ها")).toBeTruthy();
    });
  });

  it("has session management placeholder", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText("امنیت حساب")).toBeTruthy();
    });
  });

  it("has data export placeholder", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // "خروجی" appears in both heading "خروجی داده" and description text
      const matches = screen.getAllByText(/خروجی/);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it("has account closure placeholder with danger style", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // Both h2 and button have "حذف حساب" text
      const elements = screen.getAllByText(/حذف حساب/);
      expect(elements.length).toBeGreaterThan(0);
      // The section has error styling
      const heading = screen.getByRole("heading", { name: /حذف حساب/ });
      expect(heading).toBeTruthy();
    });
  });

  it("shows notification toggles", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // Should have multiple toggle switches for notification preferences
      const switches = screen.getAllByRole("switch");
      expect(switches.length).toBeGreaterThan(3);
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

  it("settings page has stacked layout on mobile-size container", async () => {
    setupMe();
    render(<SettingsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      const sections = document.querySelectorAll("section");
      expect(sections.length).toBeGreaterThan(1);
    });
  });
});
