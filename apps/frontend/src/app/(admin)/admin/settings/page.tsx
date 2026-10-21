// ============================================================
// LEGALIR — Admin · Organization Settings & Connections
//              (تنظیمات سازمان و اتصال‌ها)
// ============================================================
// Everything here is READ from the server and reported as-is, EXCEPT the one
// thing an operator may genuinely change: the panel's DISPLAY timezone.
//
// The three zones the panel must never conflate:
//   • `serverTimezone`  — where the Node process runs. Discovered, not set.
//   • `displayTimezone` — this setting. Changes how instants are RENDERED.
//   • the working-calendar zone — the SLA arithmetic input, managed on
//     /admin/settings/sla. This page does not touch it.
//
// Stored instants are ISO-8601 UTC and are never rewritten by a display
// preference; the clock row below renders the SAME `nowUtc` in both zones so
// the operator can see exactly what the setting does.
// ============================================================

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { snackbar } from "@legalir/ui";
import {
  useAdminSettings,
  useAdminMe,
  useUpdateAdminDisplaySettings,
} from "@/hooks/useAdmin";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  toPersianDateTimeInZone,
  toPersianDateInZone,
  toClockInZone,
} from "@/lib/admin/display-time";
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
  InlineNotice,
  Section,
  Field,
  Select,
  Button,
} from "@/components/admin/ui";

const ENVIRONMENT_FA: Record<string, string> = {
  development: "توسعه",
  staging: "آزمایشی (staging)",
  production: "تولید",
};

const SOURCE_FA: Record<string, string> = {
  TZ: "از متغیر محیطی TZ",
  runtime: "از تنظیمات محیط اجرای Node",
};

/** A one-second tick — only used for the live clock cards. */
function useNow(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export default function AdminSettingsPage() {
  const query = useAdminSettings();
  const { can } = useAdminMe();
  const canManage = can("admin:settings:manage");
  const save = useUpdateAdminDisplaySettings();

  const [draft, setDraft] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const data = query.data;
  const displayTimezone = data?.displayTimezone ?? "Asia/Tehran";

  // Seed the select from the server value; re-seed whenever the server value
  // changes (after a save, or on a refetch) so the form never drifts from
  // what is actually stored.
  useEffect(() => {
    setDraft(displayTimezone);
    setError(null);
  }, [displayTimezone]);

  // Tick in whichever zone is being PREVIEWED, so the operator sees the effect
  // of the pending choice before saving it.
  const previewZone = draft || displayTimezone;
  const now = useNow(Boolean(data));

  async function onSubmit() {
    setError(null);
    setSaved(null);
    if (!draft) {
      setError("یک منطقهٔ زمانی انتخاب کنید.");
      return;
    }
    if (draft === displayTimezone) {
      setError("منطقهٔ زمانی انتخاب‌شده همان مقدار فعلی است.");
      return;
    }
    try {
      const res = await save.mutateAsync({ displayTimezone: draft });
      setSaved(res.displayTimezone);
      snackbar.show({
        message: `منطقهٔ زمانی نمایش به «${res.displayTimezone}» تغییر کرد.`,
        variant: "success",
      });
    } catch (err) {
      setError(
        err && typeof err === "object" && "userMessage" in err
          ? String((err as { userMessage: unknown }).userMessage)
          : "ذخیرهٔ منطقهٔ زمانی ناموفق بود."
      );
    }
  }

  return (
    <div>
      <PageHeader
        title="تنظیمات سازمان و اتصال‌ها"
        description="وضعیت پیکربندی محیط و یکپارچه‌سازی‌ها بر پایه مقادیر واقعی سرور. هیچ اتصال ناموجودی به‌صورت موفق نمایش داده نمی‌شود."
      />

      <StateView query={query} loadingRows={6}>
        {(s) => (
          <>
            {/* ------------------------------------------------------------
                Zones — the one editable setting on this page
               ------------------------------------------------------------ */}
            <Section
              title="منطقهٔ زمانی"
              subtitle="زمان‌های ذخیره‌شده همیشه UTC هستند؛ منطقهٔ نمایش فقط نحوهٔ خواندن آن‌ها را تغییر می‌دهد."
            >
              <Card className="p-4">
                <div className="grid gap-4 laptop:grid-cols-2">
                  {/* SERVER — read-only, discovered */}
                  <div className="rounded-medium border border-divider p-3">
                    <p className="text-caption font-medium text-muted">
                      منطقهٔ زمانی سرور (فقط‌خواندنی)
                    </p>
                    <p className="mt-1 text-h4 font-semibold text-onSurface" dir="ltr">
                      {s.serverTimezone}
                    </p>
                    <p className="mt-1 text-caption text-muted">
                      {SOURCE_FA[s.serverTimezoneSource] ?? s.serverTimezoneSource} · این مقدار
                      محل اجرای سرور را نشان می‌دهد و از این پنل قابل تغییر نیست.
                    </p>
                    <p className="mt-2 text-caption text-on-surface-variant tabular-nums">
                      اکنون در سرور: {toPersianDateTimeInZone(now, s.serverTimezone)}
                    </p>
                  </div>

                  {/* DISPLAY — the editable preference */}
                  <div className="rounded-medium border border-divider p-3">
                    <p className="text-caption font-medium text-muted">
                      منطقهٔ زمانی نمایش پنل
                    </p>
                    <p className="mt-1 text-h4 font-semibold text-onSurface" dir="ltr">
                      {s.displayTimezone}
                    </p>
                    <p className="mt-1 text-caption text-muted">
                      فقط برای نمایش؛ هیچ زمان ذخیره‌شده‌ای را تغییر نمی‌دهد و روی محاسبهٔ
                      مهلت‌ها اثر ندارد.
                    </p>
                    <p className="mt-2 text-caption text-on-surface-variant tabular-nums">
                      اکنون در این منطقه: {toPersianDateTimeInZone(now, s.displayTimezone)}
                    </p>
                    {s.displayTimezoneUpdatedAt && (
                      <p className="mt-1 text-caption text-muted">
                        آخرین تغییر: {toPersianDateInZone(s.displayTimezoneUpdatedAt, s.displayTimezone)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-medium border border-divider p-3">
                  <p className="text-caption font-medium text-muted">نمای زندهٔ ساعت</p>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-body-2">
                    <span className="text-on-surface-variant">
                      سرور ({s.serverTimezone}):{" "}
                      <b className="tabular-nums" dir="ltr">
                        {toClockInZone(now, s.serverTimezone)}
                      </b>
                    </span>
                    <span className="text-on-surface-variant">
                      انتخاب شما ({previewZone}):{" "}
                      <b className="tabular-nums" dir="ltr">
                        {toClockInZone(now, previewZone)}
                      </b>
                    </span>
                    <span className="text-caption text-muted">
                      زمان ذخیره‌شده:{" "}
                      <span dir="ltr" className="font-mono">
                        {s.nowUtc}
                      </span>{" "}
                      ({s.storageFormat})
                    </span>
                  </div>
                </div>

                {canManage ? (
                  <div className="mt-4 flex flex-col gap-3 tablet:flex-row tablet:items-end">
                    <div className="tablet:w-[320px]">
                      <Field
                        label="منطقهٔ زمانی نمایش"
                        hint="زمان‌ها در کل پنل با این منطقه نمایش داده می‌شوند."
                        error={error ?? undefined}
                      >
                        <Select
                          value={draft}
                          onChange={(e) => {
                            setDraft(e.target.value);
                            setError(null);
                            setSaved(null);
                          }}
                          aria-invalid={Boolean(error)}
                        >
                          {s.timezoneOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.labelFa} — {o.offsetFa}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <Button
                      variant="primary"
                      onClick={onSubmit}
                      loading={save.isPending}
                      disabled={save.isPending || draft === s.displayTimezone}
                    >
                      ذخیرهٔ منطقهٔ زمانی
                    </Button>
                  </div>
                ) : (
                  <InlineNotice tone="info" className="mt-4">
                    تغییر منطقهٔ زمانی نیازمند مجوز «مدیریت تنظیمات» است.
                  </InlineNotice>
                )}

                {saved && (
                  <InlineNotice tone="success" className="mt-3">
                    منطقهٔ زمانی نمایش روی <b dir="ltr">{saved}</b> ذخیره شد. زمان‌های ذخیره‌شده
                    دست‌نخورده‌اند و فقط نمایش آن‌ها تغییر کرده است.
                  </InlineNotice>
                )}
              </Card>
            </Section>

            <div className="mb-4 grid grid-cols-2 gap-3 tablet:grid-cols-4">
              <StatCard label="محیط" value={ENVIRONMENT_FA[s.environment] ?? s.environment} />
              <StatCard label="واحد پول" value={s.currency} />
              <StatCard
                label="ذخیره‌سازی اسرار"
                value={s.secretStorageConfigured ? "پیکربندی‌شده" : "پیکربندی‌نشده"}
                tone={s.secretStorageConfigured ? "success" : "warning"}
              />
              <StatCard label="قالب زمان ذخیره" value={s.storageFormat} />
            </div>

            {!s.secretStorageConfigured && (
              <InfoBanner tone="warning">
                مخزن اسرار (Secret Storage) پیکربندی نشده است؛ بنابراین ثبت کلید API ارائه‌دهنده‌های
                هوش مصنوعی در صفحهٔ «هوش مصنوعی و مدل‌ها» غیرفعال است. تا زمان پیکربندی، هیچ کلیدی
                ذخیره نمی‌شود.
              </InfoBanner>
            )}

            <Section
              title="مهلت‌ها و تقویم کاری"
              subtitle="سیاست SLA هر خدمت و تقویم کاری مشترک، مستقل از این صفحه ویرایش می‌شود."
            >
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-[560px] text-body-2 text-on-surface-variant">
                    مهلت پاسخ و تکمیل هر خدمت، نوع ساعت (تقویمی یا ساعت کاری)، رفتار توقف هنگام
                    انتظار کاربر و روزها/ساعات کاری در صفحهٔ جداگانه مدیریت می‌شوند. تغییر آن‌ها
                    روی مهلت درخواست‌های موجود اثر ندارد.
                  </p>
                  <Link
                    href="/admin/settings/sla"
                    className="rounded-medium border border-divider px-3 py-2 text-body-2 font-medium text-primary transition-colors hover:border-primary"
                  >
                    مدیریت مهلت‌ها و تقویم →
                  </Link>
                </div>
              </Card>
            </Section>

            <Section title="یکپارچه‌سازی‌ها" subtitle="وضعیت واقعی هر یکپارچه‌سازی بر پایه پیکربندی سرور.">
              <DataTable
                minWidth={520}
                head={
                  <tr>
                    <Th>یکپارچه‌سازی</Th>
                    <Th className="hidden tablet:table-cell">کلید</Th>
                    <Th>وضعیت</Th>
                    <Th className="hidden laptop:table-cell">یادداشت</Th>
                  </tr>
                }
              >
                {s.integrations.map((i) => (
                  <tr key={i.key}>
                    <Td className="font-medium text-on-surface">
                      {i.labelFa}
                      <span className="block text-caption text-muted tablet:hidden">{i.noteFa}</span>
                    </Td>
                    <Td dir="ltr" className="hidden font-mono text-caption text-muted tablet:table-cell">
                      {i.key}
                    </Td>
                    <Td>
                      {i.configured ? (
                        <Badge tone="success">پیکربندی‌شده</Badge>
                      ) : (
                        <Badge tone="warning">پیکربندی‌نشده</Badge>
                      )}
                    </Td>
                    <Td className="hidden max-w-[320px] text-caption text-muted laptop:table-cell">
                      {i.noteFa}
                    </Td>
                  </tr>
                ))}
              </DataTable>
            </Section>

            <Section
              title="ارائه‌دهنده‌های هوش مصنوعی"
              subtitle="فقط وجود یا نبود کلید نمایش داده می‌شود؛ خود کلید هرگز نمایش داده نمی‌شود."
            >
              {s.aiProviders.length === 0 ? (
                <Card className="p-4 text-body-2 text-muted">
                  ارائه‌دهنده‌ای ثبت نشده است.
                </Card>
              ) : (
                <DataTable
                  minWidth={480}
                  head={
                    <tr>
                      <Th>نام</Th>
                      <Th className="hidden tablet:table-cell">وضعیت</Th>
                      <Th>کلید</Th>
                      <Th>پیش‌فرض</Th>
                    </tr>
                  }
                >
                  {s.aiProviders.map((p) => (
                    <tr key={p.id}>
                      <Td className="font-medium text-on-surface">{p.nameFa}</Td>
                      <Td className="hidden text-caption text-muted tablet:table-cell" dir="ltr">
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
              <StatCard label="سازمان‌ها" value={s.organizations.total} />
              <StatCard label="وکلا" value={s.lawyers.total} />
            </div>

            <p className="mt-3 text-caption text-muted">
              جمع سازمان‌ها: {toPersianNumber(s.organizations.total)} · جمع وکلا:{" "}
              {toPersianNumber(s.lawyers.total)}.
            </p>
          </>
        )}
      </StateView>
    </div>
  );
}
