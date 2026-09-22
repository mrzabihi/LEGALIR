// ============================================================
// LEGALIR — Dashboard Widgets Tests
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  WidgetShell,
  HeroSection,
  PromoBanner,
  ProfileCompletionCard,
  RecentActivities,
  UsageSummaryCard,
} from "../widgets";
import { QuickActions } from "../quick-access";
import { PointsSummaryCard } from "../points-summary-card";
import type { Profile, RecentActivityItem, UsageSummary, Entitlement } from "@legalir/types";

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl">{children}</div>
    </QueryClientProvider>
  );
}

// ============================================================
// WidgetShell
// ============================================================

describe("WidgetShell", () => {
  it("renders loading skeleton when isLoading is true", () => {
    render(
      <TestWrapper>
        <WidgetShell
          title="عنوان تستی"
          isLoading={true}
          error={null}
          isEmpty={false}
          emptyMessage="خالی"
        >
          <p>محتوا</p>
        </WidgetShell>
      </TestWrapper>
    );
    expect(screen.getByText("عنوان تستی")).toBeInTheDocument();
    expect(screen.queryByText("محتوا")).not.toBeInTheDocument();
    expect(document.querySelector("[aria-busy]")).toBeInTheDocument();
  });

  it("renders error state with retry button", () => {
    const onRetry = vi.fn();
    render(
      <TestWrapper>
        <WidgetShell
          title="عنوان تستی"
          isLoading={false}
          error={new Error("خطا")}
          onRetry={onRetry}
          isEmpty={false}
        >
          <p>محتوا</p>
        </WidgetShell>
      </TestWrapper>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    const retryBtn = screen.getByText("تلاش مجدد");
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders empty state when isEmpty is true and no error", () => {
    render(
      <TestWrapper>
        <WidgetShell
          title="عنوان تستی"
          isLoading={false}
          error={null}
          isEmpty={true}
          emptyMessage="داده‌ای یافت نشد"
        >
          <p>محتوا</p>
        </WidgetShell>
      </TestWrapper>
    );
    expect(screen.getByText("داده‌ای یافت نشد")).toBeInTheDocument();
    expect(screen.queryByText("محتوا")).not.toBeInTheDocument();
  });

  it("renders children when data is available", () => {
    render(
      <TestWrapper>
        <WidgetShell
          title="عنوان تستی"
          isLoading={false}
          error={null}
          isEmpty={false}
        >
          <p>محتوای تست</p>
        </WidgetShell>
      </TestWrapper>
    );
    expect(screen.getByText("محتوای تست")).toBeInTheDocument();
  });
});

// ============================================================
// HeroSection
// ============================================================

describe("HeroSection", () => {
  const stats = {
    dailyUsed: 2,
    dailyTotal: 5,
    docCount: 3,
    activeReqCount: 1,
    daysRemaining: 25,
  };

  it("renders personalized greeting with display name", () => {
    render(
      <TestWrapper>
        <HeroSection displayName="مریم" isLoading={false} stats={stats} />
      </TestWrapper>
    );
    expect(screen.getByText(/سلام، مریم/)).toBeInTheDocument();
    expect(screen.getByText(/به محیط کار LEGALIR خوش آمدید/)).toBeInTheDocument();
  });

  it("falls back to generic greeting when no display name", () => {
    render(
      <TestWrapper>
        <HeroSection displayName={null} isLoading={false} stats={stats} />
      </TestWrapper>
    );
    expect(screen.getByText(/سلام، کاربر/)).toBeInTheDocument();
  });

  it("renders skeleton when loading", () => {
    render(
      <TestWrapper>
        <HeroSection displayName="مریم" isLoading={true} stats={stats} />
      </TestWrapper>
    );
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows stat cards with correct values", () => {
    render(
      <TestWrapper>
        <HeroSection displayName="مریم" isLoading={false} stats={stats} />
      </TestWrapper>
    );
    expect(screen.getByText("اسناد")).toBeInTheDocument();
    expect(screen.getByText("درخواست فعال")).toBeInTheDocument();
    expect(screen.getByText("روز باقی‌مانده")).toBeInTheDocument();
  });

  it("renders the points card as the first stat card (RTL right-most)", () => {
    render(
      <TestWrapper>
        <HeroSection displayName="مریم" isLoading={false} stats={stats} />
      </TestWrapper>
    );
    const pointsCard = screen.getByRole("link", { name: /امتیاز من/ });
    expect(pointsCard).toHaveAttribute("href", "/points");

    // DOM order drives RTL visual order — the points card must come first.
    const grid = pointsCard.parentElement!;
    const firstCard = grid.firstElementChild;
    expect(firstCard).toBe(pointsCard);
  });
});

// ============================================================
// PointsSummaryCard — shares the header's rewards source of truth
// ============================================================

describe("PointsSummaryCard", () => {
  it("links to /points and exposes an accessible label", () => {
    render(
      <TestWrapper>
        <PointsSummaryCard />
      </TestWrapper>
    );
    const link = screen.getByRole("link", { name: /امتیاز من/ });
    expect(link).toHaveAttribute("href", "/points");
  });

  it("never renders a fake zero while loading", () => {
    render(
      <TestWrapper>
        <PointsSummaryCard />
      </TestWrapper>
    );
    // Loading → skeleton, not "۰".
    expect(screen.queryByText("۰")).not.toBeInTheDocument();
  });
});

// ============================================================
// PromoBanner
// ============================================================

describe("PromoBanner", () => {
  it("shows upgrade CTA for silver plan", () => {
    render(
      <TestWrapper>
        <PromoBanner planCode="silver" />
      </TestWrapper>
    );
    expect(screen.getByText(/ارتقا به اشتراک طلایی/)).toBeInTheDocument();
  });

  it("shows upgrade CTA for gold plan", () => {
    render(
      <TestWrapper>
        <PromoBanner planCode="gold" />
      </TestWrapper>
    );
    expect(screen.getByText(/ارتقا به اشتراک الماس/)).toBeInTheDocument();
  });

  it("hides when planCode is not upgradeable", () => {
    const { container } = render(
      <TestWrapper>
        <PromoBanner planCode="diamond" />
      </TestWrapper>
    );
    expect(container.querySelector("section")).not.toBeInTheDocument();
  });

  it("hides when planCode is null", () => {
    const { container } = render(
      <TestWrapper>
        <PromoBanner planCode={null} />
      </TestWrapper>
    );
    expect(container.querySelector("section")).not.toBeInTheDocument();
  });
});

// ============================================================
// ProfileCompletionCard
// ============================================================

describe("ProfileCompletionCard", () => {
  const incompleteProfile: Profile = {
    userId: "u-1",
    displayName: "مریم",
    email: null,
    gender: null,
    birthDate: null,
    city: "تهران",
    occupation: null,
    completionPercent: 60,
    avatarUrl: null,
    userType: null,
    province: null,
    legalInterests: null,
    primaryUseCase: null,
  };

  const completeProfile: Profile = {
    ...incompleteProfile,
    completionPercent: 100,
  };

  it("shows completion card when profile is incomplete", () => {
    render(
      <TestWrapper>
        <ProfileCompletionCard profile={incompleteProfile} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByRole("link", { name: "تکمیل پروفایل" })).toBeInTheDocument();
  });

  it("hides card when profile is complete (100%)", () => {
    render(
      <TestWrapper>
        <ProfileCompletionCard profile={completeProfile} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.queryByRole("link", { name: "تکمیل پروفایل" })).not.toBeInTheDocument();
  });

  it("hides card when profile is null", () => {
    render(
      <TestWrapper>
        <ProfileCompletionCard profile={null} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.queryByRole("link", { name: "تکمیل پروفایل" })).not.toBeInTheDocument();
  });

  it("renders skeleton when loading", () => {
    render(
      <TestWrapper>
        <ProfileCompletionCard profile={incompleteProfile} isLoading={true} />
      </TestWrapper>
    );
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows profile completion percentage", () => {
    render(
      <TestWrapper>
        <ProfileCompletionCard profile={incompleteProfile} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText((content) => content.includes("60") && content.includes("٪"))).toBeInTheDocument();
  });
});

// ============================================================
// QuickActions
// ============================================================

describe("QuickActions", () => {
  it("renders the six primary service cards", () => {
    render(
      <TestWrapper>
        <QuickActions />
      </TestWrapper>
    );
    expect(screen.getByText("محاسبه‌گر حقوقی")).toBeInTheDocument();
    expect(screen.getByText("تحلیل اسناد")).toBeInTheDocument();
    expect(screen.getByText("تولید اظهارنامه")).toBeInTheDocument();
    expect(screen.getByText("تنظیم قرارداد")).toBeInTheDocument();
    expect(screen.getByText("بررسی قرارداد")).toBeInTheDocument();
    expect(screen.getByText("مشاوره حقوقی")).toBeInTheDocument();
  });

  it("does not duplicate the calculator as a registry card", () => {
    render(
      <TestWrapper>
        <QuickActions />
      </TestWrapper>
    );
    // `legal_calculation` is covered by the calculator launcher, so the
    // registry title «محاسبات حقوقی» must not appear a second time.
    expect(screen.queryByText("محاسبات حقوقی")).not.toBeInTheDocument();
  });

  it("renders the section header with a link to all services", () => {
    render(
      <TestWrapper>
        <QuickActions />
      </TestWrapper>
    );
    expect(screen.getByText("دسترسی سریع")).toBeInTheDocument();
    expect(screen.getByText("خدمات محبوب لیگالیر در یک نگاه")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /همه خدمات/ })).toHaveAttribute("href", "/services");
  });

  it("deep-links every card with its service context in the URL", () => {
    render(
      <TestWrapper>
        <QuickActions />
      </TestWrapper>
    );
    const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/chat?service=legal_consultation");
    expect(hrefs).toContain("/documents?service=contract_review");
    expect(hrefs).toContain("/contracts?service=contract_drafting");
    expect(hrefs).toContain("/documents?service=document_analysis");
    expect(hrefs).toContain("/chat?service=legal_notice");
  });

  it("features the legal calculator launcher linking to the hub", () => {
    render(
      <TestWrapper>
        <QuickActions />
      </TestWrapper>
    );
    const launcher = screen.getByRole("link", { name: "ورود به محاسبه‌گرهای حقوقی" });
    expect(launcher).toHaveAttribute("href", "/calculators");
    // Every card is equal — the calculator must not span extra columns.
    expect(launcher.className).not.toContain("col-span-2");
  });

  it("keeps the calculator description to a short example list", () => {
    render(
      <TestWrapper>
        <QuickActions />
      </TestWrapper>
    );
    // The card advertises examples only — the hub owns the full directory.
    expect(screen.getByText("دیه، مهریه و هزینه‌های حقوقی")).toBeInTheDocument();
  });

  it("gives every card a single accent and a watermark illustration", () => {
    render(
      <TestWrapper>
        <QuickActions />
      </TestWrapper>
    );
    const launcher = screen.getByRole("link", { name: "ورود به محاسبه‌گرهای حقوقی" });
    // One accent drives the icon, arrow and illustration.
    expect(launcher.getAttribute("style")).toContain("--qa-accent");
    // The watermark is decorative and must stay out of the a11y tree.
    expect(launcher.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});

// ============================================================
// RecentActivities
// ============================================================

describe("RecentActivities", () => {
  const items: RecentActivityItem[] = [
    { id: "a-1", type: "conversation", title: "مشاوره حقوقی", status: "active", updatedAt: "2026-07-29T10:00:00Z" },
    { id: "a-2", type: "document", title: "قرارداد فروش", status: "ready", updatedAt: "2026-07-28T10:00:00Z" },
    { id: "a-3", type: "contract", title: "پیش‌نویس NDA", status: "generated", updatedAt: "2026-07-27T10:00:00Z" },
  ];

  it("renders activity items", () => {
    render(
      <TestWrapper>
        <RecentActivities items={items} isLoading={false} error={null} />
      </TestWrapper>
    );
    expect(screen.getByText("مشاوره حقوقی")).toBeInTheDocument();
    expect(screen.getByText("قرارداد فروش")).toBeInTheDocument();
    expect(screen.getByText("پیش‌نویس NDA")).toBeInTheDocument();
  });

  it("shows empty state with no items", () => {
    render(
      <TestWrapper>
        <RecentActivities items={[]} isLoading={false} error={null} />
      </TestWrapper>
    );
    expect(screen.getByText(/هنوز پیش‌نویسی ندارید/)).toBeInTheDocument();
  });

  it("caps the list at three items to keep the row balanced", () => {
    const many: RecentActivityItem[] = [
      ...items,
      { id: "a-4", type: "document", title: "سند چهارم", status: "ready", updatedAt: "2026-07-26T10:00:00Z" },
      { id: "a-5", type: "contract", title: "قرارداد پنجم", status: "generated", updatedAt: "2026-07-25T10:00:00Z" },
    ];
    render(
      <TestWrapper>
        <RecentActivities items={many} isLoading={false} error={null} />
      </TestWrapper>
    );
    expect(screen.getByText("مشاوره حقوقی")).toBeInTheDocument();
    expect(screen.queryByText("سند چهارم")).not.toBeInTheDocument();
    expect(screen.queryByText("قرارداد پنجم")).not.toBeInTheDocument();
  });

  it("shows error state with retry", () => {
    const onRetry = vi.fn();
    render(
      <TestWrapper>
        <RecentActivities items={undefined} isLoading={false} error={new Error("خطا")} onRetry={onRetry} />
      </TestWrapper>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByText("تلاش مجدد"));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

// ============================================================
// UsageSummaryCard
// ============================================================

describe("UsageSummaryCard", () => {
  const entitlements: Entitlement[] = [
    { featureKey: "AI_CHAT", nameFa: "پیام AI", limit: 100, period: "month", used: 45, isBoolean: false, isEnabled: true },
    { featureKey: "DOC_UPLOAD", nameFa: "بارگذاری سند", limit: 30, period: "month", used: 28, isBoolean: false, isEnabled: true },
    { featureKey: "PRIORITY", nameFa: "اولویت پردازش", limit: null, period: "forever", used: 0, isBoolean: true, isEnabled: false },
  ];

  const usageData: UsageSummary = {
    entitlements,
    periodEnd: "2026-08-30T00:00:00Z",
    daysRemaining: 23,
  };

  it("renders entitlement rows", () => {
    render(
      <TestWrapper>
        <UsageSummaryCard usage={usageData} isLoading={false} error={null} />
      </TestWrapper>
    );
    expect(screen.getByText("پیام AI")).toBeInTheDocument();
    expect(screen.getByText("بارگذاری سند")).toBeInTheDocument();
    expect(screen.getByText("اولویت پردازش")).toBeInTheDocument();
  });

  it("shows boolean entitlement status", () => {
    render(
      <TestWrapper>
        <UsageSummaryCard usage={usageData} isLoading={false} error={null} />
      </TestWrapper>
    );
    expect(screen.getByText("غیرفعال")).toBeInTheDocument();
  });

  it("shows usage counts with correct values", () => {
    render(
      <TestWrapper>
        <UsageSummaryCard usage={usageData} isLoading={false} error={null} />
      </TestWrapper>
    );
    expect(screen.getByText((content) => content.includes("۴۵") && content.includes("۱۰۰"))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("۲۸") && content.includes("۳۰"))).toBeInTheDocument();
  });

  it("shows days remaining", () => {
    render(
      <TestWrapper>
        <UsageSummaryCard usage={usageData} isLoading={false} error={null} />
      </TestWrapper>
    );
    expect(screen.getByText((content) => content.includes("۲۳") && content.includes("روز دیگر"))).toBeInTheDocument();
  });

  it("shows empty state when no usage data", () => {
    render(
      <TestWrapper>
        <UsageSummaryCard usage={undefined} isLoading={false} error={null} />
      </TestWrapper>
    );
    expect(screen.getByText("اطلاعات مصرف در دسترس نیست")).toBeInTheDocument();
  });
});

// ============================================================
// Notifications moved to the Notification Center
// ============================================================
// The dashboard no longer renders an announcement card — the feed now
// lives behind the header bell and at /notifications. See
// src/components/notifications/__tests__ for the center's own tests.
