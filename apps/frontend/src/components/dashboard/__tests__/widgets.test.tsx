// ============================================================
// LEGALIR — Dashboard Widgets Tests
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  WidgetShell,
  GreetingHeader,
  ProfileCompletionCard,
  SubscriptionSummaryCard,
  QuickActions,
  RecentActivities,
  UsageSummaryCard,
  NotificationsPlaceholder,
} from "../widgets";
import type { Profile, Subscription, RecentActivityItem, UsageSummary, Entitlement } from "@legalir/types";

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <div dir="rtl">{children}</div>;
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
// GreetingHeader
// ============================================================

describe("GreetingHeader", () => {
  it("renders personalized greeting with display name", () => {
    render(
      <TestWrapper>
        <GreetingHeader displayName="مریم" isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText(/سلام، مریم/)).toBeInTheDocument();
    expect(screen.getByText(/به محیط کار LEGALIR خوش آمدید/)).toBeInTheDocument();
  });

  it("falls back to generic greeting when no display name", () => {
    render(
      <TestWrapper>
        <GreetingHeader displayName={null} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText(/سلام، کاربر/)).toBeInTheDocument();
  });

  it("renders skeleton when loading", () => {
    render(
      <TestWrapper>
        <GreetingHeader displayName="مریم" isLoading={true} />
      </TestWrapper>
    );
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
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
    // The card contains both a label span and a link button with "تکمیل پروفایل"
    expect(screen.getByRole("link", { name: "تکمیل پروفایل" })).toBeInTheDocument();
  });

  it("hides card when profile is complete (100%)", () => {
    const { container: _container } = render(
      <TestWrapper>
        <ProfileCompletionCard profile={completeProfile} isLoading={false} />
      </TestWrapper>
    );
    // The TestWrapper <div dir="rtl"> is always present, so firstChild isn't null
    // But the card itself should not be rendered
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
    // The text is "تکمیل پروفایل 60٪" split between elements
    // Check the number is there
    expect(screen.getByText((content) => content.includes("60") && content.includes("٪"))).toBeInTheDocument();
  });
});

// ============================================================
// SubscriptionSummaryCard
// ============================================================

describe("SubscriptionSummaryCard", () => {
  const activeSubscription: Subscription = {
    id: "sub-1",
    userId: "u-1",
    planId: "plan-pro",
    planCode: "gold",
    startAt: "2026-07-01T00:00:00Z",
    endAt: "2026-10-01T00:00:00Z",
    status: "active",
  };

  it("shows subscription details when active", () => {
    render(
      <TestWrapper>
        <SubscriptionSummaryCard subscription={activeSubscription} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText("پرو")).toBeInTheDocument();
    expect(screen.getByText("فعال")).toBeInTheDocument();
  });

  it("shows empty state when no subscription", () => {
    render(
      <TestWrapper>
        <SubscriptionSummaryCard subscription={null} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText("شما هنوز اشتراک فعالی ندارید")).toBeInTheDocument();
  });

  it("shows skeleton when loading", () => {
    render(
      <TestWrapper>
        <SubscriptionSummaryCard subscription={activeSubscription} isLoading={true} />
      </TestWrapper>
    );
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });
});

// ============================================================
// QuickActions
// ============================================================

describe("QuickActions", () => {
  it("renders all 3 quick action cards", () => {
    render(
      <TestWrapper>
        <QuickActions />
      </TestWrapper>
    );
    expect(screen.getByText("مشاوره حقوقی جدید")).toBeInTheDocument();
    expect(screen.getByText("تحلیل سند")).toBeInTheDocument();
    expect(screen.getByText("ساخت قرارداد")).toBeInTheDocument();
  });

  it("all actions are links with correct hrefs", () => {
    render(
      <TestWrapper>
        <QuickActions />
      </TestWrapper>
    );
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(3);
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/chat");
    expect(hrefs).toContain("/documents");
    expect(hrefs).toContain("/contracts");
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
    expect(screen.getByText(/هنوز فعالیتی ندارید/)).toBeInTheDocument();
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
    // used is displayed as raw number (Western), limit is localized (Persian)
    // e.g. "45 از ۱۰۰" — "45" is Western, "۱۰۰" is Persian
    expect(screen.getByText((content) => content.includes("45") && content.includes("۱۰۰"))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("28") && content.includes("۳۰"))).toBeInTheDocument();
  });

  it("shows days remaining", () => {
    render(
      <TestWrapper>
        <UsageSummaryCard usage={usageData} isLoading={false} error={null} />
      </TestWrapper>
    );
    expect(screen.getByText((content) => content.includes("23") && content.includes("روز دیگر"))).toBeInTheDocument();
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
// NotificationsPlaceholder
// ============================================================

describe("NotificationsPlaceholder", () => {
  it("renders empty notification state", () => {
    render(
      <TestWrapper>
        <NotificationsPlaceholder />
      </TestWrapper>
    );
    expect(screen.getByText("اعلان جدیدی ندارید")).toBeInTheDocument();
  });
});
