// ============================================================
// LEGALIR — Admin · Analytics & BI (تحلیل و هوش تجاری)
// ============================================================
// The BI home: one range control, five tabs. Every tab is presentational over
// a server report — this page only holds the SHARED range so switching tabs or
// changing the window re-scopes all of them from the same real numbers. Access
// is gated on `admin:analytics:read` (the server re-checks it on every route);
// the blocked state is a plain explanation, never a silent empty dashboard.
// ============================================================

"use client";

import { useState } from "react";
import { PageHeader, Tabs, InfoBanner, type TabItem } from "@/components/admin/ui";
import { RangeControl } from "@/components/admin/analytics/kit";
import { OverviewTab } from "@/components/admin/analytics/overview-tab";
import { SubscriptionsTab } from "@/components/admin/analytics/subscriptions-tab";
import { CustomersTab } from "@/components/admin/analytics/customers-tab";
import { EnergyTab } from "@/components/admin/analytics/energy-tab";
import { FinanceTab } from "@/components/admin/analytics/finance-tab";
import { useAdminMe } from "@/hooks/useAdmin";
import type { AnalyticsRangeQuery } from "@/lib/api/analytics";
import { IconGrid } from "@/lib/icons";

type AnalyticsTabKey = "overview" | "subscriptions" | "customers" | "energy" | "finance";

const TABS: TabItem<AnalyticsTabKey>[] = [
  { value: "overview", label: "نمای کلی" },
  { value: "subscriptions", label: "فروش اشتراک" },
  { value: "customers", label: "مشتریان" },
  { value: "energy", label: "انرژی کاربران" },
  { value: "finance", label: "تطبیق مالی" },
];

export default function AdminAnalyticsPage() {
  const { can } = useAdminMe();
  const allowed = can("admin:analytics:read");

  const [tab, setTab] = useState<AnalyticsTabKey>("overview");
  const [range, setRange] = useState<AnalyticsRangeQuery>({ preset: "30d" });

  if (!allowed) {
    return (
      <div>
        <PageHeader
          title="تحلیل و هوش تجاری"
          icon={<IconGrid size={22} />}
          description="تحلیل داده‌های واقعی فروش، انرژی، مشتریان و مال."
        />
        <InfoBanner tone="warning">
          برای مشاهدهٔ تحلیل و هوش تجاری به مجوز «مشاهدهٔ تحلیل» نیاز دارید. این بخش برای حساب شما
          در دسترس نیست.
        </InfoBanner>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="تحلیل و هوش تجاری"
        icon={<IconGrid size={22} />}
        description="همهٔ اعداد از داده‌های واقعی سیستم محاسبه می‌شوند؛ شاخص ناموجود به‌صراحت «ناموجود» گزارش می‌شود و هیچ عدد یا نموداری ساختگی نیست."
        actions={<RangeControl value={range} onChange={setRange} />}
      />

      <Tabs items={TABS} value={tab} onChange={setTab} ariaLabel="بخش‌های تحلیل و هوش تجاری" />

      {tab === "overview" && <OverviewTab range={range} />}
      {tab === "subscriptions" && <SubscriptionsTab range={range} />}
      {tab === "customers" && <CustomersTab range={range} />}
      {tab === "energy" && <EnergyTab range={range} />}
      {tab === "finance" && <FinanceTab range={range} />}
    </div>
  );
}
