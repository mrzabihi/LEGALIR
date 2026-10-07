// ============================================================
// LEGALIR — Admin · Support & Issue Reports (پشتیبانی و گزارش مشکلات)
// ============================================================
// The support desk. Tickets move open → in_progress → … → closed, each with
// a priority and an SLA target (`slaHours`). Overdue tickets are flagged
// honestly from `dueAt` vs. now — never inferred as "on time" when the
// server says otherwise. Agents (admin:support:manage) can reply, add
// internal notes and change status/priority; everyone with read access can
// inspect the thread. Requester mobiles are shown MASKED.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import {
  useSupportTickets,
  useUpdateSupportTicket,
  useAddSupportMessage,
  useAdminMe,
} from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate, toRelativeTime } from "@/lib/persian-utils";
import {
  SUPPORT_STATUS_FA,
  SUPPORT_PRIORITY_FA,
} from "@legalir/types";
import type { SupportTicket, SupportTicketStatus, SupportTicketPriority } from "@legalir/types";
import {
  PageHeader,
  Card,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  Button,
  Select,
  TextArea,
  InfoBanner,
  FilterPills,
  IdChip,
  ExportButton,
} from "@/components/admin/ui";

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

function TicketPanel({ ticket, onClose }: { ticket: SupportTicket; onClose: () => void }) {
  const { can } = useAdminMe();
  const canManage = can("admin:support:manage");
  const update = useUpdateSupportTicket();
  const addMessage = useAddSupportMessage();

  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(
    null
  );
  const overdue = isOverdue(ticket);

  async function onReply() {
    if (!body.trim()) return;
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
    setFeedback(null);
    try {
      await update.mutateAsync({ id: ticket.id, input: { status } });
      setFeedback({ tone: "success", text: "وضعیت تیکت به‌روزرسانی شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "به‌روزرسانی ناموفق بود") });
    }
  }

  async function onPriority(priority: SupportTicketPriority) {
    setFeedback(null);
    try {
      await update.mutateAsync({ id: ticket.id, input: { priority } });
      setFeedback({ tone: "success", text: "اولویت تیکت به‌روزرسانی شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "به‌روزرسانی ناموفق بود") });
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-h3 font-bold text-onSurface">{ticket.subject}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-caption text-muted">
            <IdChip id={ticket.id} />
            <span>·</span>
            <span>دسته: {ticket.category}</span>
            <span>·</span>
            <span>درخواست‌کننده: {ticket.requesterName}</span>
            {ticket.requesterMobileMasked && <span dir="ltr">{ticket.requesterMobileMasked}</span>}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          بستن
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONES[ticket.status]}>{SUPPORT_STATUS_FA[ticket.status]}</Badge>
        <Badge tone={PRIORITY_TONES[ticket.priority]}>
          اولویت: {SUPPORT_PRIORITY_FA[ticket.priority]}
        </Badge>
        <span className="text-caption text-muted">
          SLA: {toPersianNumber(ticket.slaHours)} ساعت
          {ticket.dueAt ? ` · مهلت: ${toPersianDate(ticket.dueAt)}` : ""}
        </span>
        {overdue && <Badge tone="danger">خارج از SLA</Badge>}
      </div>

      {feedback && (
        <div
          className={`mb-3 rounded-large border p-3 text-body-2 ${
            feedback.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="mb-4 space-y-2">
        {ticket.messages.length === 0 ? (
          <p className="text-body-2 text-muted">هنوز پیامی ثبت نشده است.</p>
        ) : (
          ticket.messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-medium border p-3 text-body-2 ${
                m.isInternal
                  ? "border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/30"
                  : "border-divider"
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

      {canManage ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 tablet:grid-cols-4">
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

          <TextArea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="متن پاسخ…"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-caption text-on-surface-variant">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
              />
              یادداشت داخلی (برای کاربر نمایش داده نمی‌شود)
            </label>
            <Button
              variant="primary"
              onClick={onReply}
              disabled={addMessage.isPending || body.trim().length === 0}
            >
              ثبت پاسخ
            </Button>
          </div>
        </>
      ) : (
        <InfoBanner tone="warning">
          شما مجوز مدیریت تیکت‌ها را ندارید؛ امکان پاسخ یا تغییر وضعیت وجود ندارد.
        </InfoBanner>
      )}
    </Card>
  );
}

export default function AdminSupportPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:support:manage");

  const [status, setStatus] = useState<string>("");
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const query = useSupportTickets({
    status: (status || undefined) as SupportTicketStatus | undefined,
  });

  const filters = useMemo(
    () => [
      { value: "", label: "همه" },
      ...STATUS_ORDER.map((s) => ({ value: s, label: SUPPORT_STATUS_FA[s] })),
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="پشتیبانی و گزارش مشکلات"
        description="تیکت‌های کاربران با اولویت و مهلت SLA. تیکت‌های خارج از SLA به‌صورت واقعی از مهلت و زمان کنونی محاسبه می‌شوند."
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
          {query.data.counts.overdue > 0 && (
            <Badge tone="danger">خارج از SLA: {toPersianNumber(query.data.counts.overdue)}</Badge>
          )}
        </div>
      )}

      <div className="mb-4">
        <FilterPills options={filters} value={status} onChange={setStatus} />
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="تیکتی با این فیلتر یافت نشد."
      >
        {(data) => (
          <DataTable
            head={
              <tr>
                <Th>موضوع</Th>
                <Th>اولویت</Th>
                <Th>وضعیت</Th>
                <Th>SLA</Th>
                <Th>آخرین به‌روزرسانی</Th>
                <Th>جزئیات</Th>
              </tr>
            }
          >
            {data.items.map((t) => {
              const overdue = isOverdue(t);
              return (
                <tr key={t.id}>
                  <Td className="max-w-[280px]">
                    <span className="block truncate font-medium text-on-surface" title={t.subject}>
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
                    <Button size="sm" variant="secondary" onClick={() => setSelected(t)}>
                      مشاهده
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </StateView>

      {selected && (
        <div className="mt-5">
          <TicketPanel ticket={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
