// ============================================================
// LEGALIR — Admin · SLA policies & working calendar
//              (سیاست‌های مهلت و تقویم کاری)
// ============================================================
// §5 of the lawyer-panel spec: every deadline is computed against a policy
// per service and one shared working calendar. Both are edited here and read
// by `lib/lawyer-portal/sla.ts` when a clock starts — the operator's edit and
// the lawyer's countdown can never disagree.
//
// Two rules the UI must not soften:
//   · the working calendar is platform-wide; a change re-bases every FUTURE
//     deadline, never one already stored on a request;
//   · `pauseBehavior` must be visible and per service, because "does the clock
//     stop while we wait on the client?" is the question lawyers ask most.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { snackbar } from "@legalir/ui";
import type {
  PlatformWorkCalendar,
  ServiceSlaPolicy,
  SlaClockMode,
  SlaPauseBehavior,
} from "@legalir/types";
import { DEFAULT_SLA_SERVICE_KEY } from "@legalir/types";
import {
  useAdminMe,
  useAdminSla,
  useSaveAdminSlaPolicy,
  useSaveAdminWorkCalendar,
} from "@/hooks/useAdmin";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  ErrorBlock,
  Field,
  InlineNotice,
  LoadingBlock,
  PageHeader,
  Select,
  Td,
  TextInput,
  Th,
} from "@/components/admin/ui";
import { ApiClientError } from "@/lib/api/errors";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";

const CLOCK_FA: Record<SlaClockMode, string> = {
  CALENDAR: "ساعت تقویمی (شبانه‌روز و تعطیلات هم حساب می‌شود)",
  BUSINESS_HOURS: "فقط ساعت کاری",
};

const PAUSE_FA: Record<SlaPauseBehavior, string> = {
  PAUSE: "توقف در انتظار کاربر (زمان انتظار اضافه می‌شود)",
  CONTINUE: "ادامه در انتظار کاربر (تأخیر کاربر حساب می‌شود)",
};

/** 0 = Saturday … 6 = Friday — the Iranian week. */
const DAY_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

interface PolicyDraft {
  responseHours: string;
  completionHours: string;
  clock: SlaClockMode;
  pauseBehavior: SlaPauseBehavior;
  warnBeforeHours: string;
  enabled: boolean;
}

function draftFrom(policy: ServiceSlaPolicy): PolicyDraft {
  return {
    responseHours: String(policy.responseHours),
    completionHours: String(policy.completionHours),
    clock: policy.clock,
    pauseBehavior: policy.pauseBehavior,
    warnBeforeHours: String(policy.warnBeforeHours),
    enabled: policy.enabled,
  };
}

export default function AdminSlaSettingsPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:settings:manage");
  const query = useAdminSla();
  const savePolicy = useSaveAdminSlaPolicy();
  const saveCalendar = useSaveAdminWorkCalendar();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The calendar form is local until saved, so an operator can toggle several
  // days and one holiday before committing.
  const [calendar, setCalendar] = useState<PlatformWorkCalendar | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [holidayDraft, setHolidayDraft] = useState("");

  useEffect(() => {
    if (query.data && !calendar) setCalendar(query.data.calendar);
  }, [query.data, calendar]);

  if (query.isLoading) return <LoadingBlock rows={6} />;
  if (query.isError || !query.data)
    return <ErrorBlock message="خطا در بارگذاری تنظیمات مهلت" onRetry={() => query.refetch()} />;

  const { policies } = query.data;

  function openEditor(policy: ServiceSlaPolicy) {
    setError(null);
    setEditingKey(policy.serviceKey);
    setDraft(draftFrom(policy));
  }

  async function submitPolicy() {
    if (!editingKey || !draft) return;
    setError(null);
    const responseHours = Number(draft.responseHours);
    const completionHours = Number(draft.completionHours);
    const warnBeforeHours = Number(draft.warnBeforeHours);
    if (![responseHours, completionHours, warnBeforeHours].every((n) => Number.isFinite(n) && n >= 0)) {
      setError("مهلت‌ها باید عددی نامنفی باشند.");
      return;
    }
    if (responseHours <= 0 || completionHours <= 0) {
      setError("مهلت پاسخ و تکمیل باید بزرگ‌تر از صفر باشند.");
      return;
    }
    if (warnBeforeHours > Math.min(responseHours, completionHours)) {
      setError("ساعت هشدار نمی‌تواند از کوتاه‌ترین مهلت بیشتر باشد.");
      return;
    }
    const current = policies.find((p) => p.serviceKey === editingKey);
    if (!current) {
      setError("سیاست انتخاب‌شده یافت نشد.");
      return;
    }
    try {
      await savePolicy.mutateAsync({
        serviceKey: editingKey,
        input: {
          serviceKey: editingKey,
          labelFa: current.labelFa,
          responseHours,
          completionHours,
          clock: draft.clock,
          pauseBehavior: draft.pauseBehavior,
          warnBeforeHours,
          enabled: draft.enabled,
        },
      });
      snackbar.show({ message: "سیاست مهلت ذخیره شد.", variant: "success" });
      setEditingKey(null);
      setDraft(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : "ذخیرهٔ سیاست ناموفق بود.");
    }
  }

  async function submitCalendar() {
    if (!calendar) return;
    setCalendarError(null);
    try {
      await saveCalendar.mutateAsync({
        timezone: calendar.timezone.trim(),
        workingDays: calendar.workingDays,
        hours: calendar.hours,
        holidays: calendar.holidays,
      });
      snackbar.show({ message: "تقویم کاری ذخیره شد.", variant: "success" });
    } catch (err) {
      setCalendarError(err instanceof ApiClientError ? err.userMessage : "ذخیرهٔ تقویم ناموفق بود.");
    }
  }

  const editing = editingKey ? policies.find((p) => p.serviceKey === editingKey) : undefined;

  return (
    <div>
      <PageHeader
        title="مهلت‌ها و تقویم کاری"
        description="مهلت پاسخ و تکمیل برای هر خدمت، و تقویم کاری مشترکِ همهٔ محاسبات. تغییر تقویم فقط روی مهلت‌های آینده اثر دارد؛ مهلت ثبت‌شده روی درخواست‌های موجود بازنویسی نمی‌شود."
      />

      {!canManage && (
        <InlineNotice tone="info" className="mb-4">
          این نمایش فقط‌خواندنی است. برای تغییر سیاست‌ها به مجوز «مدیریت تنظیمات» نیاز دارید.
        </InlineNotice>
      )}

      <Card className="mb-5">
        <CardHeader
          title="سیاست هر خدمت"
          subtitle="سیاست پیش‌فرض برای درخواست‌هایی است که خدمت مشخصی ندارند."
        />
        <CardBody>
          <DataTable
            minWidth={900}
            head={
              <tr>
                <Th>خدمت</Th>
                <Th>مهلت پاسخ</Th>
                <Th>مهلت تکمیل</Th>
                <Th>نوع ساعت</Th>
                <Th>انتظار کاربر</Th>
                <Th>هشدار پیش از مهلت</Th>
                <Th>وضعیت</Th>
                <Th>عملیات</Th>
              </tr>
            }
          >
            {policies.map((p) => (
              <tr key={p.serviceKey} className="hover:bg-surface-hover">
                <Td>
                  <div className="flex flex-col">
                    <span className="font-medium text-on-surface">{p.labelFa}</span>
                    {p.serviceKey === DEFAULT_SLA_SERVICE_KEY && (
                      <span className="text-caption text-muted">پیش‌فرض همهٔ درخواست‌ها</span>
                    )}
                  </div>
                </Td>
                <Td className="tabular-nums">{toPersianNumber(p.responseHours)} ساعت</Td>
                <Td className="tabular-nums">{toPersianNumber(p.completionHours)} ساعت</Td>
                <Td className="text-caption">
                  {p.clock === "CALENDAR" ? "تقویمی" : "ساعت کاری"}
                </Td>
                <Td className="text-caption">
                  {p.pauseBehavior === "PAUSE" ? "توقف" : "ادامه"}
                </Td>
                <Td className="tabular-nums text-caption">
                  {toPersianNumber(p.warnBeforeHours)} ساعت
                </Td>
                <Td>
                  {p.enabled ? (
                    <Badge tone="success">فعال</Badge>
                  ) : (
                    <Badge tone="neutral">غیرفعال</Badge>
                  )}
                </Td>
                <Td>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!canManage}
                    onClick={() => openEditor(p)}
                  >
                    ویرایش
                  </Button>
                </Td>
              </tr>
            ))}
          </DataTable>
        </CardBody>
      </Card>

      {editing && draft && (
        <Card className="mb-5">
          <CardHeader
            title={`ویرایش سیاست — ${editing.labelFa}`}
            subtitle="این مقدارها فقط وقتی اعمال می‌شوند که یک مهلت تازه آغاز شود."
          />
          <CardBody>
            <div className="grid gap-3 tablet:grid-cols-3">
              <Field label="مهلت پاسخ (ساعت)" required error={error ?? undefined}>
                <TextInput
                  value={draft.responseHours}
                  onChange={(e) => setDraft({ ...draft, responseHours: e.target.value })}
                  inputMode="numeric"
                  dir="ltr"
                />
              </Field>
              <Field label="مهلت تکمیل (ساعت)" required>
                <TextInput
                  value={draft.completionHours}
                  onChange={(e) => setDraft({ ...draft, completionHours: e.target.value })}
                  inputMode="numeric"
                  dir="ltr"
                />
              </Field>
              <Field label="هشدار پیش از مهلت (ساعت)">
                <TextInput
                  value={draft.warnBeforeHours}
                  onChange={(e) => setDraft({ ...draft, warnBeforeHours: e.target.value })}
                  inputMode="numeric"
                  dir="ltr"
                />
              </Field>
              <Field label="نوع ساعت">
                <Select
                  value={draft.clock}
                  onChange={(e) => setDraft({ ...draft, clock: e.target.value as SlaClockMode })}
                >
                  <option value="BUSINESS_HOURS">{CLOCK_FA.BUSINESS_HOURS}</option>
                  <option value="CALENDAR">{CLOCK_FA.CALENDAR}</option>
                </Select>
              </Field>
              <Field label="رفتار هنگام انتظار کاربر">
                <Select
                  value={draft.pauseBehavior}
                  onChange={(e) =>
                    setDraft({ ...draft, pauseBehavior: e.target.value as SlaPauseBehavior })
                  }
                >
                  <option value="PAUSE">{PAUSE_FA.PAUSE}</option>
                  <option value="CONTINUE">{PAUSE_FA.CONTINUE}</option>
                </Select>
              </Field>
              <Field label="وضعیت سیاست">
                <Select
                  value={draft.enabled ? "on" : "off"}
                  onChange={(e) => setDraft({ ...draft, enabled: e.target.value === "on" })}
                >
                  <option value="on">فعال — مهلت اعمال می‌شود</option>
                  <option value="off">غیرفعال — بدون مهلت</option>
                </Select>
              </Field>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingKey(null);
                  setDraft(null);
                  setError(null);
                }}
              >
                انصراف
              </Button>
              <Button onClick={() => void submitPolicy()} loading={savePolicy.isPending}>
                ذخیرهٔ سیاست
              </Button>
            </div>
            <p className="mt-2 text-caption text-muted">
              آخرین تغییر: {editing.updatedBy ? "توسط اپراتور" : "مقدار پیش‌فرض"} —{" "}
              {toPersianDate(editing.updatedAt)}
            </p>
          </CardBody>
        </Card>
      )}

      {calendar && (
        <Card>
          <CardHeader
            title="تقویم کاری مشترک"
            subtitle="مبنای محاسبهٔ «ساعت کاری» برای همهٔ سیاست‌هایی است که این نوع ساعت را انتخاب کرده‌اند."
          />
          <CardBody className="space-y-4">
            {calendarError && <InlineNotice tone="warning">{calendarError}</InlineNotice>}

            <div className="grid gap-3 tablet:grid-cols-3">
              <Field label="منطقهٔ زمانی" required hint="مثلاً Asia/Tehran">
                <TextInput
                  value={calendar.timezone}
                  onChange={(e) => setCalendar({ ...calendar, timezone: e.target.value })}
                  dir="ltr"
                  disabled={!canManage}
                />
              </Field>
              <Field label="ساعت شروع کار" required hint="HH:mm">
                <TextInput
                  value={calendar.hours.startTime}
                  onChange={(e) =>
                    setCalendar({
                      ...calendar,
                      hours: { ...calendar.hours, startTime: e.target.value },
                    })
                  }
                  dir="ltr"
                  disabled={!canManage}
                  placeholder="09:00"
                />
              </Field>
              <Field label="ساعت پایان کار" required hint="HH:mm">
                <TextInput
                  value={calendar.hours.endTime}
                  onChange={(e) =>
                    setCalendar({
                      ...calendar,
                      hours: { ...calendar.hours, endTime: e.target.value },
                    })
                  }
                  dir="ltr"
                  disabled={!canManage}
                  placeholder="17:00"
                />
              </Field>
            </div>

            <div>
              <p className="mb-2 text-caption font-medium text-on-surface-variant">روزهای کاری</p>
              <div className="flex flex-wrap gap-2">
                {DAY_FA.map((label, day) => {
                  const active = calendar.workingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={!canManage}
                      aria-pressed={active}
                      onClick={() =>
                        setCalendar({
                          ...calendar,
                          workingDays: active
                            ? calendar.workingDays.filter((d) => d !== day)
                            : [...calendar.workingDays, day].sort((a, b) => a - b),
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-caption transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        active
                          ? "border-primary bg-primary text-on-primary"
                          : "border-divider bg-surface text-on-surface-variant hover:border-primary"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {calendar.workingDays.length === 0 && (
                <p className="mt-1 text-caption text-error-600">حداقل یک روز کاری لازم است.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-caption font-medium text-on-surface-variant">
                تعطیلات رسمی (YYYY-MM-DD)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {calendar.holidays.map((h) => (
                  <span
                    key={h}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 font-mono text-caption text-on-surface"
                    dir="ltr"
                  >
                    {h}
                    {canManage && (
                      <button
                        type="button"
                        aria-label={`حذف تعطیلی ${h}`}
                        onClick={() =>
                          setCalendar({
                            ...calendar,
                            holidays: calendar.holidays.filter((x) => x !== h),
                          })
                        }
                        className="text-muted hover:text-error-600"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {calendar.holidays.length === 0 && (
                  <span className="text-caption text-muted">تعطیلی ثبت نشده است.</span>
                )}
              </div>
              {canManage && (
                <div className="mt-2 flex items-center gap-2">
                  <TextInput
                    value={holidayDraft}
                    onChange={(e) => setHolidayDraft(e.target.value)}
                    dir="ltr"
                    placeholder="2026-03-21"
                    className="max-w-[180px]"
                    aria-label="تاریخ تعطیلی جدید"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!/^\d{4}-\d{2}-\d{2}$/.test(holidayDraft)}
                    onClick={() => {
                      setCalendar({
                        ...calendar,
                        holidays: [...new Set([...calendar.holidays, holidayDraft])].sort(),
                      });
                      setHolidayDraft("");
                    }}
                  >
                    افزودن
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-3">
              <p className="text-caption text-muted">
                آخرین به‌روزرسانی: {calendar.updatedBy ? "توسط اپراتور" : "مقدار پیش‌فرض"} —{" "}
                {toPersianDate(calendar.updatedAt)}
              </p>
              {canManage && (
                <Button onClick={() => void submitCalendar()} loading={saveCalendar.isPending}>
                  ذخیرهٔ تقویم
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
