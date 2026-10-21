// ============================================================
// LEGALIR — Lawyer workbench · Case workbench (پرونده)
// ============================================================
// One case, as the assigned lawyer works it. The data is the SAME
// `/api/v1/cases/[id]` response the client portal and the admin drawer read —
// there is no lawyer-only projection to drift out of sync. The lawyer reaches
// it because accepting the referral granted an ACTIVE `case_members` row, and
// `resolveCaseAccess` answers 404 (never 403) when that row is missing.
//
// Five tabs, mirroring the case's own taxonomy:
//   · نمای کلی — lifecycle, stage, the computed next action, the primary
//     proceeding's authority details;
//   · وظایف — every task with its state and a one-tap status change;
//   · مهلت‌ها — legal / internal / hearing deadlines kept SEPARATE, with the
//     server-derived operational state (never a client-side guess);
//   · طرف‌ها — parties and the members who can see the case;
//   · تایم‌لاین — the recorded events, already filtered per viewer server-side.
//
// Nothing here invents data: an empty collection renders an explicit empty
// state, and a missing stage renders «ثبت نشده» rather than a default.
// ============================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLawyerCase, useUpdateLawyerCaseTask } from "@/hooks/useLawyerPortal";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  Tabs,
  Select,
} from "@/components/admin/ui";
import { snackbar } from "@legalir/ui";
import { ApiClientError } from "@/lib/api/errors";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import {
  CASE_CATEGORY_FA,
  CASE_DEADLINE_KIND_FA,
  CASE_DEADLINE_OPERATIONAL_FA,
  CASE_EVENT_FA,
  CASE_INFO_SOURCE_FA,
  CASE_LEGAL_ROLE_FA,
  CASE_LIFECYCLE_FA,
  CASE_MEMBER_ROLE_FA,
  CASE_PRIORITY_FA,
  CASE_STAGE_FA,
  CASE_TASK_ACTION_FA,
  CASE_TASK_STATUS_V2_FA,
  type CaseCategory,
  type CaseDeadlineOperationalState,
  type CaseLifecycleStatus,
  type CasePriority,
  type CaseStageKey,
  type CaseTaskStatusV2,
} from "@legalir/types";
import { IconArrowBack, IconBriefcase, IconWarning } from "@/lib/icons";

type TabKey = "overview" | "tasks" | "deadlines" | "parties" | "timeline";

const TABS: { value: TabKey; label: string }[] = [
  { value: "overview", label: "نمای کلی" },
  { value: "tasks", label: "وظایف" },
  { value: "deadlines", label: "مهلت‌ها" },
  { value: "parties", label: "طرف‌ها" },
  { value: "timeline", label: "تایم‌لاین" },
];

const LIFECYCLE_TONE: Record<CaseLifecycleStatus, "success" | "warning" | "info" | "neutral"> = {
  ACTIVE: "success",
  ON_HOLD: "warning",
  CLOSED: "info",
  ARCHIVED: "neutral",
};

const TASK_TONE: Record<CaseTaskStatusV2, "neutral" | "info" | "warning" | "success"> = {
  todo: "neutral",
  in_progress: "info",
  blocked: "warning",
  done: "success",
  cancelled: "neutral",
};

const OPERATIONAL_TONE: Record<
  CaseDeadlineOperationalState,
  "neutral" | "warning" | "danger" | "success" | "info"
> = {
  open: "neutral",
  action_done: "success",
  // The server marks a past-due deadline that still needs a decision. It is
  // the closest stored state to "overdue", so it carries the alarm tone.
  needs_review_after_due: "danger",
  cancelled: "neutral",
};

/** A deadline still counts as overdue only while nothing has settled it. */
function isOverdueDeadline(d: { operationalState: CaseDeadlineOperationalState; dueAt: string }): boolean {
  if (d.operationalState === "action_done" || d.operationalState === "cancelled") return false;
  return Date.parse(d.dueAt) < Date.now();
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="text-body-2 text-on-surface">{value}</dd>
    </div>
  );
}

export default function LawyerCasePage() {
  const params = useParams();
  const id = params["id"] as string;
  const query = useLawyerCase(id);
  const updateTask = useUpdateLawyerCaseTask(id);
  const [tab, setTab] = useState<TabKey>("overview");

  if (query.isLoading) return <LoadingBlock rows={7} />;
  if (query.isError || !query.data)
    return (
      <div>
        <ErrorBlock
          message="پرونده بارگذاری نشد. ممکن است دسترسی شما به آن لغو شده باشد."
          onRetry={() => query.refetch()}
        />
        <div className="mt-4">
          <Link
            href="/lawyer/cases"
            className="inline-flex items-center gap-1 text-caption font-medium text-primary hover:underline"
          >
            <IconArrowBack size={14} /> بازگشت به پرونده‌ها
          </Link>
        </div>
      </div>
    );

  const data = query.data;
  const c = data.case;
  const lifecycle = c.lifecycle as CaseLifecycleStatus;
  const stage = data.proceeding?.stage;
  const openTasks = data.tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const overdueDeadlines = data.deadlines.filter(isOverdueDeadline).length;

  async function changeTaskStatus(taskId: string, status: CaseTaskStatusV2) {
    try {
      await updateTask.mutateAsync({ taskId, status });
      snackbar.show({ message: "وضعیت وظیفه به‌روزرسانی شد.", variant: "success" });
    } catch (err) {
      snackbar.show({
        message: err instanceof ApiClientError ? err.userMessage : "به‌روزرسانی وظیفه ناموفق بود.",
        variant: "error",
      });
    }
  }

  return (
    <div>
      <Link
        href="/lawyer/cases"
        className="mb-3 inline-flex items-center gap-1 text-caption font-medium text-muted hover:text-primary"
      >
        <IconArrowBack size={14} /> پرونده‌ها
      </Link>

      <PageHeader
        title={c.title}
        description={`${CASE_CATEGORY_FA[c.category as CaseCategory] ?? c.category} · ${c.internalRef}`}
        icon={<IconBriefcase size={22} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={LIFECYCLE_TONE[lifecycle]}>{CASE_LIFECYCLE_FA[lifecycle]}</Badge>
            <Badge tone={c.priority === "urgent" ? "danger" : "neutral"}>
              {CASE_PRIORITY_FA[c.priority as CasePriority]}
            </Badge>
            {overdueDeadlines > 0 && (
              <Badge tone="danger">
                <IconWarning size={12} className="me-1" aria-hidden="true" />
                {toPersianNumber(overdueDeadlines)} مهلت گذشته
              </Badge>
            )}
          </div>
        }
      />

      {/* The one computed next action — same value the overview tab shows. */}
      {data.nextAction.kind !== "none" && (
        <div className="mb-4 rounded-large border border-primary-200 bg-primary-container p-4">
          <p className="text-caption text-muted">اقدام بعدی</p>
          <p className="mt-0.5 text-titleMedium font-semibold text-on-surface">
            {data.nextAction.title}
          </p>
          <p className="mt-1 text-body-2 text-muted">{data.nextAction.reason}</p>
          {data.nextAction.dueAt && (
            <p className="mt-2 text-caption tabular-nums text-muted">
              موعد: {toPersianDate(data.nextAction.dueAt)}
            </p>
          )}
        </div>
      )}

      <div className="mb-4">
        <Tabs<TabKey>
          items={TABS.map((t) => ({
            ...t,
            badge:
              t.value === "tasks" && openTasks > 0
                ? toPersianNumber(openTasks)
                : t.value === "deadlines" && overdueDeadlines > 0
                  ? toPersianNumber(overdueDeadlines)
                  : undefined,
          }))}
          value={tab}
          onChange={setTab}
          ariaLabel="بخش‌های پرونده"
        />
      </div>

      {tab === "overview" && (
        <div className="grid gap-5 laptop:grid-cols-2">
          <Section title="وضعیت پرونده">
            <dl className="space-y-2">
              <Row label="چرخهٔ عمر" value={CASE_LIFECYCLE_FA[lifecycle]} />
              <Row label="مرحله" value={stage ? CASE_STAGE_FA[stage as CaseStageKey] : "ثبت نشده"} />
              <Row label="اولویت" value={CASE_PRIORITY_FA[c.priority as CasePriority]} />
              <Row
                label="دسته"
                value={CASE_CATEGORY_FA[c.category as CaseCategory] ?? c.category}
              />
              <Row label="آخرین تغییر" value={toPersianDate(c.updatedAt)} />
              {c.description && (
                <div className="pt-1">
                  <dt className="text-caption text-muted">شرح</dt>
                  <dd className="mt-1 whitespace-pre-line text-body-2 text-on-surface-variant">
                    {c.description}
                  </dd>
                </div>
              )}
            </dl>
          </Section>

          <Section title="مرجع رسیدگی" subtitle="شماره‌ها همان‌طور که ثبت شده‌اند نگه داشته می‌شوند.">
            {data.proceeding ? (
              <dl className="space-y-2">
                <Row label="مرجع" value={data.proceeding.authority || "ثبت نشده"} />
                <Row label="شعبه" value={data.proceeding.branch || "ثبت نشده"} />
                <Row label="شمارهٔ قضایی" value={data.proceeding.judicialNumber || "ثبت نشده"} />
                <Row label="شمارهٔ بایگانی" value={data.proceeding.archiveNumber || "ثبت نشده"} />
                <Row
                  label="استان / شهر"
                  value={`${data.proceeding.province || "—"} / ${data.proceeding.city || "—"}`}
                />
                <Row
                  label="منبع مرحله"
                  value={CASE_INFO_SOURCE_FA[data.proceeding.stageSource] ?? data.proceeding.stageSource}
                />
              </dl>
            ) : (
              <p className="text-body-2 text-muted">
                هنوز مسیر رسیدگی برای این پرونده ثبت نشده است.
              </p>
            )}
          </Section>

          <Section title="خلاصهٔ کار" subtitle="اعداد از همان ردیف‌های وظایف و مهلت‌ها محاسبه شده‌اند.">
            <dl className="space-y-2">
              <Row label="وظایف باز" value={toPersianNumber(openTasks)} />
              <Row
                label="وظایف مسدود"
                value={toPersianNumber(data.tasks.filter((t) => t.status === "blocked").length)}
              />
              <Row label="مهلت‌های ثبت‌شده" value={toPersianNumber(data.deadlines.length)} />
              <Row label="اسناد پیوست" value={toPersianNumber(data.documents.length)} />
              <Row label="طرف‌های پرونده" value={toPersianNumber(data.parties.length)} />
            </dl>
          </Section>

          <Section title="اسناد پیوست">
            {data.documents.length === 0 ? (
              <p className="text-body-2 text-muted">سندی به این پرونده پیوست نشده است.</p>
            ) : (
              <ul className="divide-y divide-divider">
                {data.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-body-2 text-on-surface">{d.name}</span>
                    <span className="shrink-0 text-caption tabular-nums text-muted">
                      {toPersianDate(d.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {tab === "tasks" && (
        <div className="space-y-3">
          {data.tasks.length === 0 ? (
            <EmptyBlock message="وظیفه‌ای برای این پرونده ثبت نشده است." />
          ) : (
            data.tasks.map((t) => (
              <Card key={t.id}>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-on-surface">{t.title}</p>
                      {t.description && (
                        <p className="mt-1 text-caption text-muted">{t.description}</p>
                      )}
                      <p className="mt-1 text-caption text-muted">
                        {CASE_TASK_ACTION_FA[t.actionType]} · {CASE_PRIORITY_FA[t.priority]}
                        {t.dueDate ? ` · موعد: ${toPersianDate(t.dueDate)}` : ""}
                      </p>
                      {t.result && (
                        <p className="mt-1 text-caption text-on-surface-variant">
                          نتیجه: {t.result}
                          {t.resultIsClaim && <span className="ms-1 text-warning-700">(اعلامی)</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={TASK_TONE[t.status]}>{CASE_TASK_STATUS_V2_FA[t.status]}</Badge>
                      <Select
                        value={t.status}
                        aria-label={`تغییر وضعیت ${t.title}`}
                        onChange={(e) =>
                          void changeTaskStatus(t.id, e.target.value as CaseTaskStatusV2)
                        }
                        disabled={updateTask.isPending}
                        className="w-40"
                      >
                        {(Object.keys(CASE_TASK_STATUS_V2_FA) as CaseTaskStatusV2[]).map((s) => (
                          <option key={s} value={s}>
                            {CASE_TASK_STATUS_V2_FA[s]}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "deadlines" && (
        <div className="space-y-3">
          {data.deadlines.length === 0 ? (
            <EmptyBlock
              message="مهلتی ثبت نشده است."
              hint="پرونده‌ای بدون مهلت، در فهرست با «بدون اقدام زمان‌دار» نمایش داده می‌شود."
            />
          ) : (
            data.deadlines.map((d) => (
              <Card key={d.id}>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-on-surface">{d.title}</p>
                      <p className="mt-1 text-caption text-muted">
                        {CASE_DEADLINE_KIND_FA[d.kind]} · {toPersianDate(d.dueAt)}
                        {d.dateOnly ? " (تاریخ بدون ساعت)" : ""}
                      </p>
                      {d.announcedDueAt && (
                        <p className="mt-1 text-caption text-muted">
                          تاریخ اعلامی مرجع: {toPersianDate(d.announcedDueAt)}
                        </p>
                      )}
                      {d.overrideReason && (
                        <p className="mt-1 text-caption text-on-surface-variant">
                          اصلاح دستی: {d.overrideReason}
                        </p>
                      )}
                    </div>
                    <Badge tone={OPERATIONAL_TONE[d.operationalState]}>
                      {CASE_DEADLINE_OPERATIONAL_FA[d.operationalState]}
                    </Badge>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "parties" && (
        <div className="grid gap-5 laptop:grid-cols-2">
          <Section title="طرف‌های پرونده" subtitle="نام بردن یک طرف، دسترسی ایجاد نمی‌کند.">
            {data.parties.length === 0 ? (
              <p className="text-body-2 text-muted">طرفی ثبت نشده است.</p>
            ) : (
              <ul className="divide-y divide-divider">
                {data.parties.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-body-2 text-on-surface">{p.name}</p>
                      <p className="text-caption text-muted">{CASE_LEGAL_ROLE_FA[p.legalRole]}</p>
                    </div>
                    {p.phone && (
                      <span className="shrink-0 font-mono text-caption text-muted" dir="ltr">
                        {p.phone}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="اعضای دارای دسترسی" subtitle="شامل نقش خود شما در این پرونده.">
            {data.members.length === 0 ? (
              <p className="text-body-2 text-muted">عضوی ثبت نشده است.</p>
            ) : (
              <ul className="divide-y divide-divider">
                {data.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-mono text-caption text-muted" dir="ltr">
                      {m.accountId}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge tone={m.status === "active" ? "success" : "neutral"}>
                        {m.status === "active" ? "فعال" : m.status}
                      </Badge>
                      <span className="text-caption text-on-surface">
                        {CASE_MEMBER_ROLE_FA[m.role]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {tab === "timeline" && (
        <Section
          title="تایم‌لاین"
          subtitle="رویدادهای خصوصی غیرمجاز پیش از رسیدن به این صفحه حذف شده‌اند."
        >
          {data.timeline.length === 0 ? (
            <p className="text-body-2 text-muted">رویدادی ثبت نشده است.</p>
          ) : (
            <ol className="space-y-3">
              {data.timeline.map((e) => (
                <li key={e.id} className="rounded-medium bg-surface-container px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-body-2 font-medium text-on-surface">{e.title}</span>
                    <span className="text-caption tabular-nums text-muted">
                      {toPersianDate(e.occurredAt)}
                    </span>
                  </div>
                  {e.description && (
                    <p className="mt-1 text-caption text-on-surface-variant">{e.description}</p>
                  )}
                  <p className="mt-1 text-caption text-muted">{CASE_EVENT_FA[e.eventType]}</p>
                </li>
              ))}
            </ol>
          )}
        </Section>
      )}
    </div>
  );
}
