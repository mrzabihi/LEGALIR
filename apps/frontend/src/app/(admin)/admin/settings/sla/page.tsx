// ============================================================
// LEGALIR — Admin · SLA policies & working calendar
//              (سیاست‌های مهلت و تقویم کاری)
// ============================================================
// §5 of the lawyer-panel spec: every deadline is computed against a policy
// per service and one shared working calendar. Both are edited here and read
// by `lib/lawyer-portal/sla.ts` when a clock starts — the operator's edit and
// the lawyer's countdown can never disagree.
//
// What a policy row now carries, and why each field is on the screen:
//   · audience — who the window binds (client / lawyer / both);
//   · priority — ordering only, never a clock change;
//   · status   — active / inactive / archived. ONLY `active` starts a new
//                clock; the other two pause new work without losing the
//                numbers, so re-activating restores them unchanged.
//
// Two rules the UI must not soften:
//   · the working calendar is platform-wide; a change re-bases every FUTURE
//     deadline, never one already stored on a request;
//   · `pauseBehavior` must be visible and per service, because "does the clock
//     stop while we wait on the client?" is the question lawyers ask most.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog, Dialog, snackbar } from "@legalir/ui";
import type {
  PlatformWorkCalendar,
  ServiceSlaPolicy,
  SlaAudience,
  SlaClockMode,
  SlaPauseBehavior,
  SlaPolicyStatus,
  SlaPriority,
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
  FilterPills,
  InlineNotice,
  LoadingBlock,
  PageHeader,
  SearchInput,
  Select,
  StatCard,
  Td,
  TextInput,
  Th,
} from "@/components/admin/ui";
import { ApiClientError } from "@/lib/api/errors";
import { normalizePersian, toPersianDate, toPersianNumber } from "@/lib/persian-utils";

const CLOCK_FA: Record<SlaClockMode, string> = {
  CALENDAR: "ساعت تقویمی (شبانه‌روز و تعطیلات هم حساب می‌شود)",
  BUSINESS_HOURS: "فقط ساعت کاری",
};

/** Short forms for the compact table cell — the full text lives in the editor. */
const CLOCK_SHORT_FA: Record<SlaClockMode, string> = {
  CALENDAR: "تقویمی",
  BUSINESS_HOURS: "ساعت کاری",
};

const PAUSE_FA: Record<SlaPauseBehavior, string> = {
  PAUSE: "توقف در انتظار کاربر (زمان انتظار اضافه می‌شود)",
  CONTINUE: "ادامه در انتظار کاربر (تأخیر کاربر حساب می‌شود)",
};

const PAUSE_SHORT_FA: Record<SlaPauseBehavior, string> = {
  PAUSE: "توقف",
  CONTINUE: "ادامه",
};

const AUDIENCE_FA: Record<SlaAudience, string> = {
  user: "کاربر",
  lawyer: "وکیل",
  both: "کاربر و وکیل",
};

const PRIORITY_FA: Record<SlaPriority, string> = {
  HIGH: "بالا",
  NORMAL: "عادی",
  LOW: "پایین",
};

const STATUS_FA: Record<SlaPolicyStatus, string> = {
  active: "فعال",
  inactive: "غیرفعال",
  archived: "بایگانی",
};

/**
 * What a lifecycle change actually does. Shown in the confirmation, because
 * "archive" is the one action an operator should never take blind — it stops
 * every FUTURE clock for the service while leaving stored deadlines intact.
 */
const STATUS_IMPACT_FA: Record<SlaPolicyStatus, string> = {
  active:
    "از این پس برای درخواست‌های تازهٔ این خدمت مهلت محاسبه می‌شود. مهلت‌های ثبت‌شده روی درخواست‌های موجود بازنویسی نمی‌شوند.",
  inactive:
    "مهلت تازه‌ای برای این خدمت آغاز نمی‌شود، اما اعداد سیاست حفظ می‌شوند و با فعال‌سازی دوباره بدون تغییر برمی‌گردند. مهلت‌های ثبت‌شده دست‌نخورده می‌مانند.",
  archived:
    "سیاست از فهرست خارج می‌شود و دیگر مهلت تازه‌ای نمی‌سازد. سابقه و مهلت‌های ثبت‌شدهٔ درخواست‌ها حفظ می‌شوند. بازگرداندن آن با ویرایش همان سیاست ممکن است.",
};

type StatusFilter = SlaPolicyStatus | "all";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "active", label: "فعال" },
  { value: "inactive", label: "غیرفعال" },
  { value: "archived", label: "بایگانی‌شده" },
];

const STATUS_BADGE: Record<SlaPolicyStatus, "success" | "neutral" | "warning"> = {
  active: "success",
  inactive: "neutral",
  archived: "warning",
};

/** 0 = Saturday … 6 = Friday — the Iranian week. */
const DAY_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

interface PolicyDraft {
  labelFa: string;
  responseHours: string;
  completionHours: string;
  warnBeforeHours: string;
  clock: SlaClockMode;
  pauseBehavior: SlaPauseBehavior;
  audience: SlaAudience;
  priority: SlaPriority;
  status: SlaPolicyStatus;
}

function draftFrom(policy: ServiceSlaPolicy): PolicyDraft {
  return {
    labelFa: policy.labelFa,
    responseHours: String(policy.responseHours),
    completionHours: String(policy.completionHours),
    warnBeforeHours: String(policy.warnBeforeHours),
    clock: policy.clock,
    pauseBehavior: policy.pauseBehavior,
    audience: policy.audience,
    priority: policy.priority,
    status: policy.status,
  };
}

/** The default numbers a brand-new policy starts from (matches the store). */
function draftForNew(labelFa: string): PolicyDraft {
  return {
    labelFa,
    responseHours: "24",
    completionHours: "72",
    warnBeforeHours: "6",
    clock: "BUSINESS_HOURS",
    pauseBehavior: "PAUSE",
    audience: "both",
    priority: "NORMAL",
    status: "active",
  };
}

interface StatusChange {
  serviceKey: string;
  labelFa: string;
  from: SlaPolicyStatus;
  to: SlaPolicyStatus;
}

export default function AdminSlaSettingsPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:settings:manage");
  // One fetch that includes archived rows: the pills then filter instantly
  // instead of triggering a round-trip whenever the operator peeks at history.
  const query = useAdminSla(true);
  const savePolicy = useSaveAdminSlaPolicy();
  const saveCalendar = useSaveAdminWorkCalendar();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<StatusChange | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState("");

  // The calendar form is local until saved, so an operator can toggle several
  // days and one holiday before committing. It is re-seeded when the query
  // returns after a save, so the timestamps stay truthful.
  const [calendar, setCalendar] = useState<PlatformWorkCalendar | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [holidayDraft, setHolidayDraft] = useState("");

  useEffect(() => {
    if (query.data && !calendar) setCalendar(query.data.calendar);
  }, [query.data, calendar]);

  const policies = query.data?.policies;
  const visible = useMemo(() => {
    if (!policies) return [];
    const q = normalizePersian(search);
    return policies.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        normalizePersian(p.labelFa).includes(q) || normalizePersian(p.serviceKey).includes(q)
      );
    });
  }, [policies, search, statusFilter]);

  const counts = useMemo(() => {
    const all = policies ?? [];
    return {
      total: all.length,
      active: all.filter((p) => p.status === "active").length,
      paused: all.filter((p) => p.status !== "active").length,
      services: all.filter((p) => p.serviceKey !== DEFAULT_SLA_SERVICE_KEY).length,
    };
  }, [policies]);

  if (query.isLoading) return <LoadingBlock rows={6} />;
  if (query.isError || !query.data)
    return <ErrorBlock message="خطا در بارگذاری تنظیمات مهلت" onRetry={() => query.refetch()} />;

  const { services, defaultServiceKey } = query.data;
  const unconfigured = services.filter((s) => !s.hasPolicy);
  const editing = editingKey ? policies?.find((p) => p.serviceKey === editingKey) : undefined;
  const addService = services.find((s) => s.id === addKey);

  function openEditor(policy: ServiceSlaPolicy) {
    setError(null);
    setEditingKey(policy.serviceKey);
    setDraft(draftFrom(policy));
  }

  function closeEditor() {
    setEditingKey(null);
    setDraft(null);
    setError(null);
  }

  /** Validate the draft and, when the lifecycle changes, route through confirm. */
  function requestSave() {
    if (!editingKey || !draft) return;
    setError(null);
    const responseHours = Number(draft.responseHours);
    const completionHours = Number(draft.completionHours);
    const warnBeforeHours = Number(draft.warnBeforeHours);
    if (
      ![responseHours, completionHours, warnBeforeHours].every(
        (n) => Number.isFinite(n) && n >= 0
      )
    ) {
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
    if (!draft.labelFa.trim()) {
      setError("عنوان سیاست الزامی است.");
      return;
    }
    const current = policies?.find((p) => p.serviceKey === editingKey);
    // A policy whose status is changing gets an explicit confirmation; a plain
    // numeric edit saves straight away (it never touches a stored deadline).
    if (current && current.status !== draft.status) {
      setConfirmStatus({
        serviceKey: editingKey,
        labelFa: draft.labelFa.trim(),
        from: current.status,
        to: draft.status,
      });
      return;
    }
    void persist(editingKey, draft);
  }

  async function persist(serviceKey: string, d: PolicyDraft) {
    try {
      await savePolicy.mutateAsync({
        serviceKey,
        input: {
          serviceKey,
          labelFa: d.labelFa.trim(),
          responseHours: Number(d.responseHours),
          completionHours: Number(d.completionHours),
          clock: d.clock,
          pauseBehavior: d.pauseBehavior,
          warnBeforeHours: Number(d.warnBeforeHours),
          audience: d.audience,
          priority: d.priority,
          status: d.status,
        },
      });
      snackbar.show({ message: "سیاست مهلت ذخیره شد.", variant: "success" });
      closeEditor();
      setConfirmStatus(null);
      setAddOpen(false);
      setAddKey("");
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.userMessage : "ذخیرهٔ سیاست ناموفق بود.";
      if (editingKey) setError(message);
      else snackbar.show({ message, variant: "error" });
    }
  }

  /** A one-click lifecycle action from the row (no numbers touched). */
  async function changeStatus(p: ServiceSlaPolicy, to: SlaPolicyStatus) {
    try {
      await savePolicy.mutateAsync({
        serviceKey: p.serviceKey,
        input: {
          serviceKey: p.serviceKey,
          labelFa: p.labelFa,
          responseHours: p.responseHours,
          completionHours: p.completionHours,
          clock: p.clock,
          pauseBehavior: p.pauseBehavior,
          warnBeforeHours: p.warnBeforeHours,
          audience: p.audience,
          priority: p.priority,
          status: to,
        },
      });
      snackbar.show({
        message: `سیاست «${p.labelFa}» ${STATUS_FA[to]} شد.`,
        variant: "success",
      });
      setConfirmStatus(null);
      closeEditor();
    } catch (err) {
      snackbar.show({
        message: err instanceof ApiClientError ? err.userMessage : "تغییر وضعیت ناموفق بود.",
        variant: "error",
      });
    }
  }

  async function submitCalendar() {
    if (!calendar) return;
    setCalendarError(null);
    try {
      const saved = await saveCalendar.mutateAsync({
        timezone: calendar.timezone.trim(),
        workingDays: calendar.workingDays,
        hours: calendar.hours,
        holidays: calendar.holidays,
      });
      // Re-seed from the server copy so the actor/timestamp line is the truth.
      setCalendar(saved);
      snackbar.show({ message: "تقویم کاری ذخیره شد.", variant: "success" });
    } catch (err) {
      setCalendarError(
        err instanceof ApiClientError ? err.userMessage : "ذخیرهٔ تقویم ناموفق بود."
      );
    }
  }

  return (
    <div>
      <PageHeader
        title="مهلت‌ها و تقویم کاری"
        description="مهلت پاسخ و تکمیل برای هر خدمت، و تقویم کاری مشترکِ همهٔ محاسبات. فقط سیاست «فعال» مهلت تازه می‌سازد؛ تغییر تقویم یا سیاست فقط روی مهلت‌های آینده اثر دارد و مهلت ثبت‌شده روی درخواست‌های موجود بازنویسی نمی‌شود."
      />

      {!canManage && (
        <InlineNotice tone="info" className="mb-4">
          این نمایش فقط‌خواندنی است. برای تغییر سیاست‌ها به مجوز «مدیریت تنظیمات» نیاز دارید.
        </InlineNotice>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 tablet:grid-cols-4">
        <StatCard
          label="سیاست فعال"
          value={toPersianNumber(counts.active)}
          hint="مهلت تازه می‌سازند"
        />
        <StatCard
          label="غیرفعال / بایگانی"
          value={toPersianNumber(counts.paused)}
          hint="اعداد حفظ شده‌اند"
          tone={counts.paused > 0 ? "warning" : "default"}
        />
        <StatCard
          label="سیاست خدمت‌ها"
          value={toPersianNumber(counts.services)}
          hint="به‌جز سیاست پیش‌فرض"
        />
        <StatCard
          label="مجموع سیاست‌ها"
          value={toPersianNumber(counts.total)}
          hint="شامل پیش‌فرض"
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="سیاست هر خدمت"
          subtitle="سیاست پیش‌فرض برای درخواست‌هایی است که خدمت مشخصی ندارند و مبنای خدمت‌های تنظیم‌نشده است."
          actions={
            canManage ? (
              <Button
                size="sm"
                onClick={() => {
                  setAddOpen(true);
                  setAddKey(unconfigured[0]?.id ?? "");
                }}
                disabled={unconfigured.length === 0}
              >
                افزودن سیاست خدمت
              </Button>
            ) : undefined
          }
        />
        <CardBody>
          <div className="mb-3 flex flex-col gap-2 laptop:flex-row laptop:items-center laptop:justify-between">
            <SearchInput
              value={search}
              onChange={(v) => setSearch(v)}
              placeholder="جست‌وجوی خدمت…"
              ariaLabel="جست‌وجوی سیاست مهلت"
            />
            <FilterPills options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
          </div>

          {visible.length === 0 && (
            <p className="mb-3 text-caption text-muted">
              {search || statusFilter !== "all"
                ? "سیاستی با این فیلترها پیدا نشد."
                : "هنوز سیاستی ثبت نشده است."}
            </p>
          )}
          <DataTable
            minWidth={640}
            head={
              <tr>
                <Th>خدمت</Th>
                <Th className="hidden tablet:table-cell">مخاطب</Th>
                <Th className="whitespace-nowrap">پاسخ</Th>
                <Th className="whitespace-nowrap">تکمیل</Th>
                <Th className="hidden laptop:table-cell">ساعت / انتظار</Th>
                <Th className="hidden whitespace-nowrap desktop:table-cell">هشدار</Th>
                <Th>وضعیت</Th>
                <Th>عملیات</Th>
              </tr>
            }
          >
            {visible.map((p) => (
              <tr key={p.serviceKey} className="hover:bg-surface-hover">
                <Td>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-on-surface" title={p.labelFa}>
                      {p.labelFa}
                    </span>
                    <span className="text-caption text-muted">
                      {p.serviceKey === defaultServiceKey
                        ? "پیش‌فرض همهٔ درخواست‌ها"
                        : p.serviceKey}
                    </span>
                    {/* Below tablet the audience/clock columns are hidden — they
                        reappear here as one line rather than being lost. */}
                    <span className="mt-0.5 text-caption text-muted tablet:hidden">
                      {AUDIENCE_FA[p.audience]} · {CLOCK_SHORT_FA[p.clock]} ·{" "}
                      {PAUSE_SHORT_FA[p.pauseBehavior]}
                    </span>
                  </div>
                </Td>
                <Td className="hidden text-caption tablet:table-cell">
                  {AUDIENCE_FA[p.audience]}
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {toPersianNumber(p.responseHours)} ساعت
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {toPersianNumber(p.completionHours)} ساعت
                </Td>
                <Td className="hidden text-caption laptop:table-cell">
                  {CLOCK_SHORT_FA[p.clock]} · {PAUSE_SHORT_FA[p.pauseBehavior]}
                </Td>
                <Td className="hidden whitespace-nowrap tabular-nums text-caption desktop:table-cell">
                  {toPersianNumber(p.warnBeforeHours)} ساعت
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge tone={STATUS_BADGE[p.status]}>{STATUS_FA[p.status]}</Badge>
                    {p.priority === "HIGH" && <Badge tone="info">اولویت بالا</Badge>}
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canManage}
                      onClick={() => openEditor(p)}
                    >
                      ویرایش
                    </Button>
                    {canManage && p.status !== "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirmStatus({
                            serviceKey: p.serviceKey,
                            labelFa: p.labelFa,
                            from: p.status,
                            to: "active",
                          })
                        }
                      >
                        فعال‌سازی
                      </Button>
                    )}
                    {canManage && p.status === "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirmStatus({
                            serviceKey: p.serviceKey,
                            labelFa: p.labelFa,
                            from: p.status,
                            to: "inactive",
                          })
                        }
                      >
                        غیرفعال‌سازی
                      </Button>
                    )}
                    {canManage && p.status !== "archived" && p.serviceKey !== defaultServiceKey && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirmStatus({
                            serviceKey: p.serviceKey,
                            labelFa: p.labelFa,
                            from: p.status,
                            to: "archived",
                          })
                        }
                      >
                        بایگانی
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </DataTable>
        </CardBody>
      </Card>

      {/* ---------------- Create: a service that has no policy yet --------- */}
      <Dialog
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setError(null);
        }}
        title="افزودن سیاست برای یک خدمت"
        description="خدمتی را انتخاب کنید که هنوز سیاست اختصاصی ندارد. اعداد اولیه قابل ویرایش‌اند و پس از ذخیره، این خدمت دیگر از سیاست پیش‌فرض ارث نمی‌برد."
        maxWidth="lg"
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setAddOpen(false);
                setError(null);
              }}
            >
              انصراف
            </Button>
            <Button
              variant="primary"
              disabled={!addKey}
              onClick={() => {
                if (!addService) return;
                // Straight to the full editor: the operator sees every field
                // (audience, clocks, warning) before the first save.
                setEditingKey(addService.id);
                setDraft(draftForNew(addService.nameFa));
                setError(null);
                setAddOpen(false);
                setAddKey("");
              }}
            >
              ادامه و تنظیم
            </Button>
          </>
        }
      >
        <Field label="خدمت" required>
          <Select value={addKey} onChange={(e) => setAddKey(e.target.value)}>
            {unconfigured.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameFa}
              </option>
            ))}
          </Select>
        </Field>
      </Dialog>

      {/* ---------------- Edit an existing (or the just-picked) policy ------ */}
      <Dialog
        open={Boolean(editing && draft)}
        onClose={closeEditor}
        title={editing ? `ویرایش سیاست — ${editing.labelFa}` : ""}
        description="این مقدارها فقط وقتی اعمال می‌شوند که یک مهلت تازه آغاز شود؛ مهلت‌های ثبت‌شده روی درخواست‌های موجود تغییر نمی‌کنند."
        maxWidth="3xl"
        actions={
          <>
            <Button variant="ghost" onClick={closeEditor} disabled={savePolicy.isPending}>
              انصراف
            </Button>
            <Button
              variant="primary"
              onClick={requestSave}
              loading={savePolicy.isPending}
              disabled={savePolicy.isPending}
            >
              ذخیرهٔ سیاست
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            {error && <InlineNotice tone="error">{error}</InlineNotice>}
            <div className="grid gap-3 tablet:grid-cols-2">
              <Field label="عنوان سیاست" required>
                <TextInput
                  value={draft.labelFa}
                  onChange={(e) => setDraft({ ...draft, labelFa: e.target.value })}
                  maxLength={80}
                />
              </Field>
              <Field label="مخاطب مهلت" hint="این مهلت تعهد به کدام طرف است.">
                <Select
                  value={draft.audience}
                  onChange={(e) =>
                    setDraft({ ...draft, audience: e.target.value as SlaAudience })
                  }
                >
                  <option value="both">{AUDIENCE_FA.both}</option>
                  <option value="user">{AUDIENCE_FA.user}</option>
                  <option value="lawyer">{AUDIENCE_FA.lawyer}</option>
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 tablet:grid-cols-3">
              <Field label="مهلت پاسخ (ساعت)" required>
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
            </div>

            <div className="grid gap-3 tablet:grid-cols-2">
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
            </div>

            <div className="grid gap-3 tablet:grid-cols-2">
              <Field label="اولویت" hint="فقط ترتیب نمایش در این فهرست را تغییر می‌دهد.">
                <Select
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value as SlaPriority })}
                >
                  <option value="HIGH">{PRIORITY_FA.HIGH}</option>
                  <option value="NORMAL">{PRIORITY_FA.NORMAL}</option>
                  <option value="LOW">{PRIORITY_FA.LOW}</option>
                </Select>
              </Field>
              <Field label="وضعیت سیاست" hint={STATUS_IMPACT_FA[draft.status]}>
                <Select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value as SlaPolicyStatus })
                  }
                >
                  <option value="active">{STATUS_FA.active} — مهلت اعمال می‌شود</option>
                  <option value="inactive">{STATUS_FA.inactive} — بدون مهلت تازه</option>
                  <option value="archived">{STATUS_FA.archived} — از فهرست خارج می‌شود</option>
                </Select>
              </Field>
            </div>

            {editing && (
              <p className="text-caption text-muted">
                آخرین تغییر: {editing.updatedBy ? "توسط اپراتور" : "مقدار پیش‌فرض"} —{" "}
                {toPersianDate(editing.updatedAt)}
              </p>
            )}
          </div>
        )}
      </Dialog>

      {/* ---------------- Lifecycle confirmation --------------------------- */}
      <ConfirmDialog
        open={confirmStatus !== null}
        onClose={() => !savePolicy.isPending && setConfirmStatus(null)}
        onConfirm={() => {
          if (!confirmStatus) return;
          const policy = policies?.find((p) => p.serviceKey === confirmStatus.serviceKey);
          // From the editor we carry the edited numbers; from a row action the
          // stored ones — either way the lifecycle change is the only delta.
          if (editingKey === confirmStatus.serviceKey && draft) {
            void persist(confirmStatus.serviceKey, { ...draft, status: confirmStatus.to });
          } else if (policy) {
            void changeStatus(policy, confirmStatus.to);
          }
        }}
        title={
          confirmStatus
            ? `${STATUS_FA[confirmStatus.to]} کردن سیاست «${confirmStatus.labelFa}»`
            : ""
        }
        description={confirmStatus ? STATUS_IMPACT_FA[confirmStatus.to] : undefined}
        confirmLabel={confirmStatus ? STATUS_FA[confirmStatus.to] : "تأیید"}
        destructive={confirmStatus?.to === "archived"}
        loading={savePolicy.isPending}
      />

      {/* ---------------- Working calendar -------------------------------- */}
      {calendar && (
        <Card>
          <CardHeader
            title="تقویم کاری مشترک"
            subtitle="مبنای محاسبهٔ «ساعت کاری» برای همهٔ سیاست‌هایی است که این نوع ساعت را انتخاب کرده‌اند. این منطقهٔ زمانی جدا از «منطقهٔ نمایش پنل» در تنظیمات عمومی است."
          />
          <CardBody className="space-y-4">
            {calendarError && <InlineNotice tone="warning">{calendarError}</InlineNotice>}

            <div className="grid gap-3 tablet:grid-cols-3">
              <Field
                label="منطقهٔ زمانی تقویم"
                required
                hint="IANA — مثلاً Asia/Tehran. مبنای محاسبهٔ ساعت‌های کاری است، نه نمایش تاریخ‌ها."
              >
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
