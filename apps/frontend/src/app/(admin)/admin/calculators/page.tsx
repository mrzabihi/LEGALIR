// ============================================================
// LEGALIR — Admin · Calculators & Legal Data (ماشین‌حساب‌ها و داده‌های حقوقی)
// ============================================================
// READ-ONLY inventory. Every rate a legal calculator multiplies by lives in
// a versioned code module, not a database row — so the annual update is a
// reviewed code change with full provenance, never an ad-hoc admin edit.
// This surface therefore reports the inventory and the data-quality flags
// (unavailable calculators, stale or missing datasets); it offers no write
// path by design.
//
// Honesty: "needs annual update" is DERIVED from the data (a dataset whose
// year trails the newest year on the platform), never asserted here.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useCalculatorsInventory } from "@/hooks/useAdmin";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  PageHeader,
  StatCard,
  Card,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  FilterPills,
  InfoBanner,
  Section,
} from "@/components/admin/ui";

const CONFIDENCE_FA: Record<string, string> = {
  high: "قطعیت بالا",
  medium: "قطعیت متوسط",
  low: "قطعیت پایین",
};

const CONFIDENCE_TONES: Record<
  string,
  "success" | "warning" | "danger" | "neutral"
> = {
  high: "success",
  medium: "warning",
  low: "danger",
};

const CATEGORY_FA: Record<string, string> = {
  civil: "مدنی",
  contracts: "قراردادها",
  employment: "کار و استخدام",
  family: "خانواده",
  injury: "صدمات بدنی",
  judicial: "قضایی",
  property: "اموال و املاک",
};

type Scope = "" | "available" | "unavailable";

export default function AdminCalculatorsPage() {
  const query = useCalculatorsInventory();
  const [scope, setScope] = useState<Scope>("");

  const filters = useMemo(
    () => [
      { value: "" as Scope, label: "همه" },
      { value: "available" as Scope, label: "فعال" },
      { value: "unavailable" as Scope, label: "نیازمند تکمیل" },
    ],
    []
  );

  const needing = query.data
    ? query.data.totalCalculators - query.data.availableCalculators
    : 0;

  return (
    <div>
      <PageHeader
        title="ماشین‌حساب‌ها و داده‌های حقوقی"
        description="سیاههٔ ماشین‌حساب‌های حقوقی و مجموعه‌داده‌های نرخ. این نما فقط‌خواندنی است؛ به‌روزرسانی سالانه از طریق بازبینی کد انجام می‌شود، نه ویرایش دلخواه."
      />

      {query.data && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 tablet:grid-cols-4">
            <StatCard label="کل ماشین‌حساب‌ها" value={query.data.totalCalculators} />
            <StatCard
              label="فعال"
              value={query.data.availableCalculators}
              tone="success"
            />
            <StatCard
              label="نیازمند تکمیل"
              value={needing}
              tone={needing > 0 ? "warning" : "default"}
            />
            <StatCard
              label="سال جاری محاسبه"
              value={query.data.currentYear}
              hint="جدیدترین سال موجود در مجموعه‌داده‌ها"
            />
          </div>

          {query.data.staleDatasets.length > 0 && (
            <InfoBanner tone="warning">
              {toPersianNumber(query.data.staleDatasets.length)} مجموعه‌داده سال
              عقب‌تر از سال جاری است و نیازمند به‌روزرسانی سالانه است. فهرست در
              جدول پایین با برچسب «نیاز به به‌روزرسانی» مشخص شده است.
            </InfoBanner>
          )}
        </>
      )}

      <Section title="ماشین‌حساب‌ها" subtitle="وضعیت پیاده‌سازی و کیفیت دادهٔ هر ماشین‌حساب.">
        <div className="mb-3">
          <FilterPills options={filters} value={scope} onChange={setScope} />
        </div>

        <StateView
          query={query}
          loadingRows={8}
          isEmpty={(d) => d.calculators.length === 0}
          emptyMessage="ماشین‌حسابی ثبت نشده است."
        >
          {(data) => {
            const rows = data.calculators.filter((c) =>
              scope === "" ? true : scope === "available" ? c.available : !c.available
            );
            return (
              <DataTable
                head={
                  <tr>
                    <Th>عنوان</Th>
                    <Th>دسته</Th>
                    <Th>مبنای قانونی</Th>
                    <Th>قطعیت</Th>
                    <Th>وضعیت</Th>
                    <Th>هشدارها</Th>
                  </tr>
                }
              >
                {rows.map((c) => (
                  <tr key={c.id}>
                    <Td className="max-w-[240px]">
                      <span
                        className="block truncate font-medium text-on-surface"
                        title={c.titleFa}
                      >
                        {c.titleFa}
                      </span>
                      <span className="text-caption text-muted" dir="ltr">
                        {c.slug}
                      </span>
                    </Td>
                    <Td className="text-caption text-muted">
                      {CATEGORY_FA[c.category] ?? c.category}
                    </Td>
                    <Td className="max-w-[260px]">
                      <span
                        className="block truncate text-caption text-muted"
                        title={c.legalBasisFa}
                      >
                        {c.legalBasisFa}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={CONFIDENCE_TONES[c.confidence] ?? "neutral"}>
                        {CONFIDENCE_FA[c.confidence] ?? c.confidence}
                      </Badge>
                    </Td>
                    <Td>
                      {c.available ? (
                        <Badge tone="success">فعال</Badge>
                      ) : (
                        <Badge tone="warning">تکمیل‌نشده</Badge>
                      )}
                    </Td>
                    <Td className="max-w-[260px]">
                      {c.warningsFa.length === 0 ? (
                        <span className="text-caption text-muted">—</span>
                      ) : (
                        <ul className="list-inside list-disc text-caption text-amber-700 dark:text-amber-300">
                          {c.warningsFa.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      )}
                    </Td>
                  </tr>
                ))}
              </DataTable>
            );
          }}
        </StateView>
      </Section>

      <Section
        title="مجموعه‌داده‌های نرخ"
        subtitle="نسخه، مرجع و بازهٔ اعتبار هر مجموعه‌داده به همراه وضعیت به‌روزرسانی سالانه."
      >
        <StateView
          query={query}
          loadingRows={6}
          isEmpty={(d) => d.datasets.length === 0}
          emptyMessage="مجموعه‌داده‌ای ثبت نشده است."
        >
          {(data) => (
            <DataTable
              head={
                <tr>
                  <Th>عنوان</Th>
                  <Th>سال</Th>
                  <Th>نسخه</Th>
                  <Th>مرجع</Th>
                  <Th>اعتبار</Th>
                  <Th>بازبینی</Th>
                  <Th>وضعیت سالانه</Th>
                </tr>
              }
            >
              {data.datasets.map((d) => (
                <tr key={d.id}>
                  <Td className="max-w-[240px]">
                    <span
                      className="block truncate font-medium text-on-surface"
                      title={d.titleFa}
                    >
                      {d.titleFa}
                    </span>
                    {d.notes && (
                      <span className="text-caption text-muted">{d.notes}</span>
                    )}
                  </Td>
                  <Td className="tabular-nums">{toPersianNumber(d.calculationYear)}</Td>
                  <Td dir="ltr" className="text-caption text-muted">
                    {d.version}
                  </Td>
                  <Td className="max-w-[240px]">
                    <span
                      className="block truncate text-caption text-muted"
                      title={`${d.sourceAuthority} — ${d.sourceTitle}`}
                    >
                      {d.sourceAuthority}
                    </span>
                  </Td>
                  <Td className="text-caption text-muted" dir="ltr">
                    {d.effectiveFrom}
                    {d.effectiveTo ? ` → ${d.effectiveTo}` : " → کنون"}
                  </Td>
                  <Td className="text-caption text-muted" dir="ltr">
                    {d.verifiedAt}
                  </Td>
                  <Td>
                    {d.isCurrentYear ? (
                      <Badge tone="success">به‌روز</Badge>
                    ) : d.needsAnnualUpdate ? (
                      <Badge tone="warning">نیاز به به‌روزرسانی</Badge>
                    ) : (
                      <Badge tone="neutral">—</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </DataTable>
          )}
        </StateView>
      </Section>

      <Card className="p-4 text-caption text-muted">
        یادآوری: ماشین‌حساب‌ها نرخ‌ها را از ماژول‌های نسخه‌دار کد می‌خوانند؛
        ویرایش در این پنل وجود ندارد. برای به‌روزرسانی سالانه، مجموعه‌دادهٔ سال
        جدید را در کد اضافه و بازبینی کنید.
      </Card>
    </div>
  );
}
