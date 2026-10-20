// ============================================================
// LEGALIR — Admin · Support & Issue Reports (پشتیبانی و گزارش مشکلات)
// ============================================================
// The support desk. Tickets move open → in_progress → … → closed, each with
// a priority and an SLA target (`slaHours`). Overdue tickets are flagged
// honestly from `dueAt` vs. now — never inferred as "on time" when the
// server says otherwise.
//
// The detail lives in a Drawer (not an inline card) so the queue stays on
// screen while an operator works: the thread, assignment/referral and the
// append-only history are three tabs of the same ticket. Every write goes
// through the admin API; nothing is fabricated locally.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAdminMe,
  useSupportTickets,
  useSupportTicket,
  useSupportTicketHistory,
  useUpdateSupportTicket,
  useAddSupportMessage,
} from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate, toRelativeTime } from "@/lib/persian-utils";
import {
  SUPPORT_STATUS_FA,
  SUPPORT_PRIORITY_FA,
  SUPPORT_TICKET_EVENT_FA,
} from "@legalir/types";
import type {
  SupportAgent,
  SupportTicket,
  SupportTicketEvent,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@legalir/types";
import {
  PageHeader,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  Button,
  Select,
  TextArea,
  InfoBanner,
  InlineNotice,
  FilterPills,
  IdChip,
  ExportButton,
  Pagination,
  SearchInput,
  Tabs,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/components/admin/ui";
import { Drawer, Switch } from "@legalir/ui";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const STATUS_TONES: Record<
  SupportTicketStatus,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  open: "info",
  in_progress: "brand",
  waiting: "warning",
  resolved: "success",
  closed: "neutral",
};

const PRIORITY_TONES: Record<
  SupportTicketPriority,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
};

const STATUS_ORDER: SupportTicketStatus[] = [
  "open",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
];

const PRIORITY_ORDER: SupportTicketPriority[] = ["low", "normal", "high", "urgent"];

type AssignmentFilter = "" | "unassigned" | "mine";
type SortKey = "updated" | "priority-desc" | "due";
type DrawerTab = "thread" | "assign" | "history";

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

function isOverdue(t: SupportTicket): boolean {
  if (!t.dueAt) return false;
  if (t.status === "resolved" || t.status === "closed") return false;
  return new Date(t.dueAt).getTime() < Date.now();
}

/** Human sentence for one history row. Values are the stored codes/names. */
function describeEvent(e: SupportTicketEvent): string {
  switch (e.kind) {
    case "created":
      return "تیکت ایجاد شد.";
    case "status":
      return `${SUPPORT_STATUS_FA[e.from as SupportTicketStatus] ?? e.from ?? "—"} ← ${
        SUPPORT_STATUS_FA[e.to as SupportTicketStatus] ?? e.to ?? "—"
      }`;
    case "priority":
      return `${SUPPORT_PRIORITY_FA[e.from as SupportTicketPriority] ?? e.from ?? "—"} ← ${
        SUPPORT_PRIORITY_FA[e.to as SupportTicketPriority] ?? e.to ?? "—"
      }`;
    case "assignment":
      return `${e.from ?? "بدون مسئول"} ← ${e.to ?? "بدون مسئول"}`;
    case "message":
      return "پاسخ عمومی ثبت شد.";
    case "internal_note":
      return "یادداشت داخلی ثبت شد.";
  }
}

// ============================================================
// Drawer
// ============================================================

function TicketDrawer({
  ticketId,
  agents,
  canManage,
  onClose,
}: {
  ticketId: string | null;
  agents: SupportAgent[];
  canManage: boolean;
  onClose: () => void;
}) {
  const detail = useSupportTicket(ticketId);
  const history = useSupportTicketHistory(ticketId);
  const update = useUpdateSupportTicket();
  const addMessage = useAddSupportMessage();

  const [tab, setTab] = useState<DrawerTab>("thread");
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [referralNote, setReferralNote] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(
    null
  );

  const ticket = detail.data?.ticket ?? null;

  // A different ticket is a different form: never carry the previous reply,
  // referral note or tab into it.
  useEffect(() => {
    setTab("thread");
    setBody("");
    setInternal(false);
    setReferralNote("");
    setFeedback(null);
  }, [ticketId]);

  useEffect(() => {
    setAssignee(ticket?.assigneeUserId ?? "");
  }, [ticket?.assigneeUserId]);

  async function onReply() {
    if (!ticket || !body.trim()) return;
    setFeedback(null);
    try {
      await addMessage.mutateAsync({ id: ticket.id, body: body.trim(), isInternal: internal });
      setBody("");
      setInternal(false);
      setFeedback({ tone: "success", text: "پاسخ ثبت شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "ثبت پاسخ ناموفق بود") });
    }
  }

  async function onStatus(status: SupportTicketStatus) {
    if (!ticket || status === ticket.status) return;
    setFeedback(null);
    try {
      await update.mutateAsync({ id: ticket.id, input: { status } });
      setFeedback({ tone: "success", text: "وضعیت تیکت به‌روزرسانی شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "به‌روزرسانی ناموفق بود") });
    }
  }

  async function onPriority(priority: SupportTicketPriority) {
    if (!ticket || priority === ticket.priority) return;
    setFeedback(null);
    try {
      await update.mutateAsync({ id: ticket.id, input: { priority } });
      setFeedback({ tone: "success", text: "اولویت تیکت به‌روزرسانی شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "به‌روزرسانی ناموفق بود") });
    }
  }

  async function onAssign(nextAssignee: string | null, note: string | null) {
    if (!ticket) return;
    setFeedback(null);
    try {
      await update.mutateAsync({
        id: ticket.id,
        input: { assigneeUserId: nextAssignee, referralNote: note },
      });
      setReferralNote("");
      setFeedback({ tone: "success", text: "واگذاری ثبت شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "واگذاری ناموفق بود") });
    }
  }

  const title = ticket ? `تیکت — ${ticket.subject}` : "جزئیات تیکت";

  return (
    <Drawer open={Boolean(ticketId)} onClose={onClose} width={720} title={title}>
      {detail.isLoading ? (
        <LoadingBlock rows={5} label="در حال دریافت تیکت…" />
      ) : detail.isError ? (
        <ErrorBlock
          message={errMessage(detail.error, "دریافت تیکت ناموفق بود")}
          onRetry={() => void detail.refetch()}
        />
      ) : ticket ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONES[ticket.status]}>{SUPPORT_STATUS_FA[ticket.status]}</Badge>
            <Badge tone={PRIORITY_TONES[ticket.priority]}>
              اولویت: {SUPPORT_PRIORITY_FA[ticket.priority]}
            </Badge>
            {isOverdue(ticket) && <Badge tone="danger">خارج از SLA</Badge>}
            <span className="text-caption text-muted">
              SLA: {toPersianNumber(ticket.slaHours)} ساعت
              {ticket.dueAt ? ` · مهلت: ${toPersianDate(ticket.dueAt)}` : ""}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-caption text-muted">
            <IdChip id={ticket.id} />
            <span>·</span>
            <span>دسته: {ticket.category}</span>
            <span>·</span>
            <span>درخواست‌کننده: {ticket.requesterName}</span>
            {ticket.requesterMobileMasked && <span dir="ltr">{ticket.requesterMobileMasked}</span>}
            <span>·</span>
            <span>
              مسئول فعلی:{" "}
              {ticket.assigneeName ?? (ticket.assigneeUserId ? "کاربر حذف‌شده" : "بدون مسئول")}
            </span>
          </div>

          {feedback && <InlineNotice tone={feedback.tone}>{feedback.text}</InlineNotice>}

          {canManage ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-caption font-medium text-on-surface-variant">
                  وضعیت
                </span>
                <Select
                  value={ticket.status}
                  onChange={(e) => onStatus(e.target.value as SupportTicketStatus)}
                  disabled={update.isPending}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {SUPPORT_STATUS_FA[s]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-caption font-medium text-on-surface-variant">
                  اولویت
                </span>
                <Select
                  value={ticket.priority}
                  onChange={(e) => onPriority(e.target.value as SupportTicketPriority)}
                  disabled={update.isPending}
                >
                  {PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {SUPPORT_PRIORITY_FA[p]}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          ) : (
            <InfoBanner tone="warning">
              شما مجوز مدیریت تیکت‌ها را ندارید؛ امکان پاسخ، واگذاری یا تغییر وضعیت وجود ندارد.
            </InfoBanner>
          )}

          <Tabs<DrawerTab>
            ariaLabel="بخش‌های تیکت"
            value={tab}
            onChange={setTab}
            items={[
              { value: "thread", label: "گفتگو", badge: toPersianNumber(ticket.messages.length) },
              { value: "assign", label: "واگذاری و ارجاع" },
              {
                value: "history",
                label: "تاریخچه",
                badge: history.data ? toPersianNumber(history.data.items.length) : undefined,
              },
            ]}
          />

          {tab === "thread" && (
            <>
              <div className="space-y-2">
                {ticket.messages.length === 0 ? (
                  <EmptyBlock message="هنوز پیامی ثبت نشده است." />
                ) : (
                  ticket.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-medium border p-3 text-body-2 ${
                        m.isInternal ? "border-warning-200 bg-warning-soft" : "border-divider"
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-caption text-muted">
                        <span className="font-medium text-on-surface-variant">{m.authorName}</span>
                        {m.isBot && <Badge tone="neutral">خودکار</Badge>}
                        {m.isInternal && <Badge tone="warning">یادداشت داخلی</Badge>}
                        <span>· {toRelativeTime(m.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed text-on-surface-variant">
                        {m.body}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {canManage && (
                <>
                  <TextArea
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="متن پاسخ…"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="rounded-medium border border-divider px-3 py-1.5">
                      <Switch
                        checked={internal}
                        onChange={(e) => setInternal(e.target.checked)}
                        label="یادداشت داخلی"
                        description="برای کاربر نمایش داده نمی‌شود."
                        tone="selection"
                      />
                    </div>
                    <Button
                      variant="primary"
                      onClick={onReply}
                      disabled={addMessage.isPending || body.trim().length === 0}
                    >
                      ثبت پاسخ
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {tab === "assign" && (
            <div className="space-y-3">
              {!canManage ? (
                <InfoBanner tone="warning">
                  برای واگذاری یا ارجاع، مجوز مدیریت تیکت‌ها لازم است.
                </InfoBanner>
              ) : (
                <>
                  <p className="text-caption text-muted">
                    تیکت را به یکی از کارشناسان دارای مجوز پشتیبانی بسپارید. فهرست از همان
                    ماتریس نقش/مجوز سرور می‌آید، پس هر گزینه واقعاً قابل واگذاری است.
                  </p>
                  <div className="grid gap-3 tablet:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-caption font-medium text-on-surface-variant">
                        کارشناس
                      </span>
                      <Select
                        value={assignee}
                        onChange={(e) => setAssignee(e.target.value)}
                        disabled={update.isPending}
                      >
                        <option value="">بدون مسئول (بازگشت به صف)</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.displayName} — {a.roleFa}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <div className="flex items-end">
                      <Button
                        variant="primary"
                        className="w-full"
                        onClick={() => onAssign(assignee || null, referralNote || null)}
                        disabled={update.isPending || (assignee || null) === ticket.assigneeUserId}
                      >
                        ثبت واگذاری
                      </Button>
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-caption font-medium text-on-surface-variant">
                      توضیح ارجاع (اختیاری)
                    </span>
                    <TextArea
                      rows={3}
                      value={referralNote}
                      onChange={(e) => setReferralNote(e.target.value)}
                      placeholder="مثلاً: نیازمند بررسی حقوقی قرارداد است."
                      disabled={update.isPending}
                    />
                  </label>
                </>
              )}
            </div>
          )}

          {tab === "history" && (
            <div>
              {history.isLoading ? (
                <LoadingBlock rows={4} label="در حال دریافت تاریخچه…" />
              ) : history.isError ? (
                <ErrorBlock
                  message={errMessage(history.error, "دریافت تاریخچه ناموفق بود")}
                  onRetry={() => void history.refetch()}
                />
              ) : (history.data?.items.length ?? 0) === 0 ? (
                <EmptyBlock message="هنوز رویدادی برای این تیکت ثبت نشده است." />
              ) : (
                <ol className="space-y-3">
                  {history.data!.items.map((e) => (
                    <li key={e.id} className="border-s-2 border-divider ps-3">
                      <div className="flex flex-wrap items-center gap-2 text-caption">
                        <span className="font-medium text-on-surface">
                          {SUPPORT_TICKET_EVENT_FA[e.kind]}
                        </span>
                        <span className="text-muted">{e.actorName}</span>
                        <span className="text-muted" title={toPersianDate(e.at)}>
                          · {toRelativeTime(e.at)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-body-2 text-on-surface-variant">
                        {describeEvent(e)}
                      </p>
                      {e.note && (
                        <p className="mt-1 rounded-medium bg-surface-container px-3 py-2 text-caption text-on-surface-variant">
                          {e.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}

// ============================================================
// Page
// ============================================================

export default function AdminSupportPage() {
  const { can, data: me } = useAdminMe();
  const canManage = can("admin:support:manage");
  const meId = me?.user.id ?? null;

  const [status, setStatus] = useState<SupportTicketStatus | "">("");
  const [priority, setPriority] = useState<SupportTicketPriority | "">("");
  const [assignment, setAssignment] = useState<AssignmentFilter>("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("updated");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filter = useMemo(
    () => ({
      status: status || undefined,
      priority: priority || undefined,
      unassigned: assignment === "unassigned" ? true : undefined,
      assigneeUserId: assignment === "mine" ? (meId ?? undefined) : undefined,
      overdue: overdueOnly || undefined,
      search: debouncedSearch.trim() || undefined,
      sort,
    }),
    [status, priority, assignment, meId, overdueOnly, debouncedSearch, sort]
  );

  const query = useSupportTickets(filter);
  const tickets = query.data?.items ?? [];
  const agents = query.data?.agents ?? [];
  const pager = useClientPagination(tickets);
  const { reset: resetPager } = pager;

  // Any narrowing change must put the operator back on page 1 — staying on
  // page 7 of a list that now has 2 rows would look like an empty desk.
  useEffect(
    () => resetPager(),
    [resetPager, status, priority, assignment, overdueOnly, debouncedSearch, sort]
  );

  const statusFilters = useMemo(
    () => [
      { value: "" as SupportTicketStatus | "", label: "همه" },
      ...STATUS_ORDER.map((s) => ({
        value: s as SupportTicketStatus | "",
        label: SUPPORT_STATUS_FA[s],
      })),
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="پشتیبانی و گزارش مشکلات"
        description="تیکت‌های کاربران با اولویت، مسئول و مهلت SLA. تیکت‌های خارج از SLA به‌صورت واقعی از مهلت و زمان کنونی محاسبه می‌شوند."
        actions={<ExportButton kind="support-tickets" label="خروجی تیکت‌ها" />}
      />

      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت تیکت‌ها را ندارید؛ این فهرست فقط‌خواندنی است.
        </InfoBanner>
      )}

      {query.data && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-caption">
          {STATUS_ORDER.map((s) =>
            query.data.counts.byStatus[s] !== undefined ? (
              <Badge key={s} tone={STATUS_TONES[s]}>
                {SUPPORT_STATUS_FA[s]}: {toPersianNumber(query.data.counts.byStatus[s])}
              </Badge>
            ) : null
          )}
          {PRIORITY_ORDER.map((p) =>
            query.data.counts.byPriority?.[p] ? (
              <Badge key={p} tone={PRIORITY_TONES[p]}>
                {SUPPORT_PRIORITY_FA[p]}: {toPersianNumber(query.data.counts.byPriority[p])}
              </Badge>
            ) : null
          )}
          {query.data.counts.overdue > 0 && (
            <Badge tone="danger">خارج از SLA: {toPersianNumber(query.data.counts.overdue)}</Badge>
          )}
          {query.data.counts.unassigned > 0 && (
            <Badge tone="warning">بدون مسئول: {toPersianNumber(query.data.counts.unassigned)}</Badge>
          )}
        </div>
      )}

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="جست‌وجو در موضوع، درخواست‌کننده یا شناسه…"
            className="min-w-[240px] flex-1"
            ariaLabel="جست‌وجوی تیکت"
          />
          <Select
            aria-label="فیلتر مسئول"
            value={assignment}
            onChange={(e) => setAssignment(e.target.value as AssignmentFilter)}
            className="w-auto"
          >
            <option value="">همهٔ مسئول‌ها</option>
            <option value="unassigned">بدون مسئول</option>
            {meId && <option value="mine">واگذارشده به من</option>}
          </Select>
          <Select
            aria-label="فیلتر اولویت"
            value={priority}
            onChange={(e) => setPriority(e.target.value as SupportTicketPriority | "")}
            className="w-auto"
          >
            <option value="">همهٔ اولویت‌ها</option>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {SUPPORT_PRIORITY_FA[p]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="ترتیب"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-auto"
          >
            <option value="updated">آخرین به‌روزرسانی</option>
            <option value="priority-desc">اولویت (فوری اول)</option>
            <option value="due">نزدیک‌ترین مهلت</option>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <FilterPills options={statusFilters} value={status} onChange={setStatus} />
          <FilterPills<"all" | "overdue">
            options={[
              { value: "all", label: "همهٔ مهلت‌ها" },
              { value: "overdue", label: "خارج از SLA" },
            ]}
            value={overdueOnly ? "overdue" : "all"}
            onChange={(v) => setOverdueOnly(v === "overdue")}
          />
        </div>
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="تیکتی با این فیلتر یافت نشد."
      >
        {() => (
          <>
            <DataTable
              head={
                <tr>
                  <Th>موضوع</Th>
                  <Th>اولویت</Th>
                  <Th>وضعیت</Th>
                  <Th>مسئول</Th>
                  <Th>SLA</Th>
                  <Th>آخرین به‌روزرسانی</Th>
                  <Th>جزئیات</Th>
                </tr>
              }
            >
              {pager.pageItems.map((t) => {
                const overdue = isOverdue(t);
                return (
                  <tr key={t.id} className="cursor-pointer" onClick={() => setSelectedId(t.id)}>
                    <Td className="max-w-[280px]">
                      <span
                        className="block truncate font-medium text-on-surface"
                        title={t.subject}
                      >
                        {t.subject}
                      </span>
                      <span className="text-caption text-muted">
                        {t.requesterName} · {t.category}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={PRIORITY_TONES[t.priority]}>
                        {SUPPORT_PRIORITY_FA[t.priority]}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONES[t.status]}>{SUPPORT_STATUS_FA[t.status]}</Badge>
                    </Td>
                    <Td className="text-caption">
                      {t.assigneeName ? (
                        <span className="text-on-surface-variant">{t.assigneeName}</span>
                      ) : t.assigneeUserId ? (
                        <span className="text-muted">کاربر حذف‌شده</span>
                      ) : (
                        <Badge tone="warning">بدون مسئول</Badge>
                      )}
                    </Td>
                    <Td>
                      {overdue ? (
                        <Badge tone="danger">خارج از SLA</Badge>
                      ) : (
                        <span className="text-caption text-muted">
                          {t.dueAt ? toPersianDate(t.dueAt) : "—"}
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-caption text-muted">
                      {toRelativeTime(t.updatedAt)}
                    </Td>
                    <Td>
                      {/* The whole row is clickable and this sets the same id,
                          so no event distinction is needed here. */}
                      <Button size="sm" variant="secondary" onClick={() => setSelectedId(t.id)}>
                        مشاهده
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </DataTable>

            <Pagination
              page={pager.page}
              pageSize={pager.pageSize}
              total={pager.total}
              totalPages={pager.totalPages}
              itemLabel="تیکت"
              onPageChange={pager.setPage}
              onPageSizeChange={pager.setPageSize}
            />
          </>
        )}
      </StateView>

      <TicketDrawer
        ticketId={selectedId}
        agents={agents}
        canManage={canManage}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
