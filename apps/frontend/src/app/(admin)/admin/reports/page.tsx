// ============================================================
// LEGALIR — Admin · Reports & Exports (گزارش‌ها و خروجی)
// ============================================================
// Sales analytics over a selectable window: revenue per plan and a daily
// series, both derived from the real orders table. The CSV export is
// generated CLIENT-SIDE from exactly the rows shown on screen — it exports
// the same real numbers, invents nothing, and needs no server round-trip.
// The export button is gated by `admin:reports:export`.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useAdminReports, useAdminMe } from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate, toPersianCurrency } from "@/lib/persian-utils";
import {
  PageHeader,
  Card,
  DataTable,
  Th,
  Td,
  StateView,
  Button,
  FilterPills,
  InfoBanner,
  Section,
} from "@/components/admin/ui";
import { IconDownload } from "@/lib/icons";

const RANGES = [
  { value: "7", label: "۷ روز" },
  { value: "30", label: "۳۰ روز" },
  { value: "90", label: "۹۰ روز" },
];

/** Serialize the on-screen rows to CSV and trigger a download. */
function downloadCsv(filename: string, header: string[], rows: (string | number)[][]): void {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows].map((r) => r.map(escape).join(","));
  // Prepend a BOM so Excel reads the Persian text as UTF-8.
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminReportsPage() {
  const { can } = useAdminMe();
  const canExport = can("admin:reports:export");

  const [range, setRange] = useState<string>("30");
  const query = useAdminReports(Number(range));

  const totalAmount = useMemo(
    () => (query.data ? query.data.byPlan.reduce((s, p) => s + p.amount, 0) : 0),
    [query.data]
  );

  function exportByPlan() {
    if (!query.data) return;
    downloadCsv(
      `legalir-revenue-by-plan-${query.data.rangeDays}d.csv`,
      ["plan_code", "plan_name_fa", "count", "amount_toman"],
      query.data.byPlan.map((p) => [p.planCode, p.planNameFa, p.count, p.amount])
    );
  }

  function exportDaily() {
    if (!query.data) return;
    downloadCsv(
      `legalir-daily-sales-${query.data.rangeDays}d.csv`,
      ["date", "count", "amount_toman"],
      query.data.daily.map((d) => [d.date, d.count, d.amount])
    );
  }

  return (
    <div>
      <PageHeader
        title="گزارش‌ها و خروجی"
        description="تحلیل فروش بر پایه سفارش‌های واقعی. خروجی CSV دقیقاً همان داده‌ای است که در صفحه نمایش داده می‌شود."
        actions={<FilterPills options={RANGES} value={range} onChange={setRange} />}
      />

      {!canExport && (
        <InfoBanner tone="warning">
          شما مجوز خروجی گرفتن را ندارید؛ این گزارش فقط‌خواندنی است.
        </InfoBanner>
      )}

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.byPlan.length === 0 && d.daily.length === 0}
        emptyMessage="در این بازه فروشی ثبت نشده است."
      >
        {(data) => (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-caption text-muted">
              <span>
                بازه: {toPersianNumber(data.rangeDays)} روز · جمع مبلغ فروش:{" "}
                {toPersianCurrency(totalAmount)}
              </span>
              {canExport && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={exportByPlan}>
                    <IconDownload size={14} /> خروجی بر پایه پلن
                  </Button>
                  <Button size="sm" variant="secondary" onClick={exportDaily}>
                    <IconDownload size={14} /> خروجی روزانه
                  </Button>
                </div>
              )}
            </div>

            <Section title="فروش بر پایه پلن" subtitle="تعداد و مبلغ سفارش‌های این بازه به تفکیک پلن.">
              {data.byPlan.length === 0 ? (
                <Card className="p-4 text-body-2 text-muted">فروشی ثبت نشده است.</Card>
              ) : (
                <DataTable
                  head={
                    <tr>
                      <Th>پلن</Th>
                      <Th>شناسه</Th>
                      <Th>تعداد</Th>
                      <Th>مبلغ (تومان)</Th>
                    </tr>
                  }
                >
                  {data.byPlan.map((p) => (
                    <tr key={p.planCode}>
                      <Td className="font-medium text-on-surface">{p.planNameFa}</Td>
                      <Td dir="ltr" className="text-caption text-muted">
                        {p.planCode}
                      </Td>
                      <Td className="tabular-nums">{toPersianNumber(p.count)}</Td>
                      <Td className="tabular-nums">{toPersianCurrency(p.amount)}</Td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </Section>

            <Section title="سری روزانه" subtitle="تعداد و مبلغ سفارش‌ها در هر روز بازه.">
              {data.daily.length === 0 ? (
                <Card className="p-4 text-body-2 text-muted">داده روزانه‌ای موجود نیست.</Card>
              ) : (
                <DataTable
                  head={
                    <tr>
                      <Th>تاریخ</Th>
                      <Th>تعداد</Th>
                      <Th>مبلغ (تومان)</Th>
                    </tr>
                  }
                >
                  {data.daily.map((d) => (
                    <tr key={d.date}>
                      <Td className="whitespace-nowrap">{toPersianDate(d.date)}</Td>
                      <Td className="tabular-nums">{toPersianNumber(d.count)}</Td>
                      <Td className="tabular-nums">{toPersianCurrency(d.amount)}</Td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </Section>
          </>
        )}
      </StateView>
    </div>
  );
}
