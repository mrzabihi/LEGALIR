// ============================================================
// LEGALIR — Admin · Organization Settings & Connections
//              (تنظیمات سازمان و اتصال‌ها)
// ============================================================
// The environment/config surface. Everything here is READ from the server
// and reported as-is:
//   • Environment      — environment name, timezone, currency.
//   • Secret storage   — whether a secret store is configured. When it is
//                        NOT, that is stated plainly (and the AI page
//                        disables key entry) — no fake "connected" state.
//   • Integrations     — each integration's REAL configured flag, never a
//                        simulated success.
//   • AI provider keys — only whether a key is present (hasKey), never the
//                        key itself.
//
// There is deliberately no "test connection" button that always reports
// success — the one real test lives on the AI page and reports its actual
// result.
// ============================================================

"use client";

import { useAdminSettings } from "@/hooks/useAdmin";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  PageHeader,
  Card,
  StatCard,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  InfoBanner,
  Section,
} from "@/components/admin/ui";

const ENVIRONMENT_FA: Record<string, string> = {
  development: "توسعه",
  staging: "آزمایشی (staging)",
  production: "تولید",
};

export default function AdminSettingsPage() {
  const query = useAdminSettings();

  return (
    <div>
      <PageHeader
        title="تنظیمات سازمان و اتصال‌ها"
        description="وضعیت پیکربندی محیط و یکپارچه‌سازی‌ها بر پایه مقادیر واقعی سرور. هیچ اتصال ناموجودی به‌صورت موفق نمایش داده نمی‌شود."
      />

      <StateView query={query} loadingRows={6}>
        {(data) => (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 tablet:grid-cols-4">
              <StatCard label="محیط" value={ENVIRONMENT_FA[data.environment] ?? data.environment} />
              <StatCard label="منطقه زمانی" value={data.timezone} />
              <StatCard label="واحد پول" value={data.currency} />
              <StatCard
                label="ذخیره‌سازی اسرار"
                value={data.secretStorageConfigured ? "پیکربندی‌شده" : "پیکربندی‌نشده"}
                tone={data.secretStorageConfigured ? "success" : "warning"}
              />
            </div>

            {!data.secretStorageConfigured && (
              <InfoBanner tone="warning">
                مخزن اسرار (Secret Storage) پیکربندی نشده است؛ بنابراین ثبت کلید API ارائه‌دهنده‌های
                هوش مصنوعی در صفحهٔ «هوش مصنوعی و مدل‌ها» غیرفعال است. تا زمان پیکربندی، هیچ کلیدی
                ذخیره نمی‌شود.
              </InfoBanner>
            )}

            <Section title="یکپارچه‌سازی‌ها" subtitle="وضعیت واقعی هر یکپارچه‌سازی بر پایه پیکربندی سرور.">
              <DataTable
                head={
                  <tr>
                    <Th>یکپارچه‌سازی</Th>
                    <Th>کلید</Th>
                    <Th>وضعیت</Th>
                    <Th>یادداشت</Th>
                  </tr>
                }
              >
                {data.integrations.map((i) => (
                  <tr key={i.key}>
                    <Td className="font-medium text-on-surface">{i.labelFa}</Td>
                    <Td dir="ltr" className="font-mono text-caption text-muted">
                      {i.key}
                    </Td>
                    <Td>
                      {i.configured ? (
                        <Badge tone="success">پیکربندی‌شده</Badge>
                      ) : (
                        <Badge tone="warning">پیکربندی‌نشده</Badge>
                      )}
                    </Td>
                    <Td className="max-w-[320px] text-caption text-muted">{i.noteFa}</Td>
                  </tr>
                ))}
              </DataTable>
            </Section>

            <Section
              title="ارائه‌دهنده‌های هوش مصنوعی"
              subtitle="فقط وجود یا نبود کلید نمایش داده می‌شود؛ خود کلید هرگز نمایش داده نمی‌شود."
            >
              {data.aiProviders.length === 0 ? (
                <Card className="p-4 text-body-2 text-muted">
                  ارائه‌دهنده‌ای ثبت نشده است.
                </Card>
              ) : (
                <DataTable
                  head={
                    <tr>
                      <Th>نام</Th>
                      <Th>وضعیت</Th>
                      <Th>کلید</Th>
                      <Th>پیش‌فرض</Th>
                    </tr>
                  }
                >
                  {data.aiProviders.map((p) => (
                    <tr key={p.id}>
                      <Td className="font-medium text-on-surface">{p.nameFa}</Td>
                      <Td className="text-caption text-muted" dir="ltr">
                        {p.status}
                      </Td>
                      <Td>
                        {p.hasKey ? (
                          <Badge tone="success">ثبت شده</Badge>
                        ) : (
                          <Badge tone="neutral">بدون کلید</Badge>
                        )}
                      </Td>
                      <Td>
                        {p.isDefault ? (
                          <Badge tone="brand">پیش‌فرض</Badge>
                        ) : (
                          <span className="text-caption text-muted">—</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </Section>

            <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
              <StatCard label="سازمان‌ها" value={data.organizations.total} />
              <StatCard label="وکلا" value={data.lawyers.total} />
            </div>

            <p className="mt-3 text-caption text-muted">
              جمع سازمان‌ها: {toPersianNumber(data.organizations.total)} · جمع وکلا:{" "}
              {toPersianNumber(data.lawyers.total)}.
            </p>
          </>
        )}
      </StateView>
    </div>
  );
}
