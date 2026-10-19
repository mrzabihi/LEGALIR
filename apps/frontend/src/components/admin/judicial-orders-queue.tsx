// ============================================================
// LEGALIR — Admin · Judicial tracked orders (سفارش‌های اوراق قضایی)
// ============================================================
// The two provider services (گواهی عدم سوءپیشینه / استعلام اعتبار معاملاتی)
// cannot be fulfilled inside the product — the artifact comes from an
// external authority. What the platform OWNS is this record: the applicant's
// details, declared purpose, attachments, the operator's note and the real
// outcome. The panel therefore never offers "issue a certificate"; it moves
// the request through the states a human actually works through.
//
// `delivered` is refused by the server unless a delivery artifact is
// attached, so the status can never claim a document that does not exist.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { JUDICIAL_ORDER_STATUS_FA, type JudicialOrderStatus } from "@legalir/types";
import {
  useAdminJudicialOrder,
  useAdminJudicialOrders,
  useAdminMe,
  useUpdateAdminJudicialOrder,
} from "@/hooks/useAdmin";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Drawer, snackbar } from "@legalir/ui";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import {
  Badge,
  Button,
  DataTable,
  ErrorBlock,
  Field,
  FilterPills,
  InfoBanner,
  LoadingBlock,
  SearchInput,
  Select,
  StateView,
  Td,
  TextArea,
  Th,
} from "@/components/admin/ui";
import { IconEdit } from "@/lib/icons";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const STATUS_TONE: Record<JudicialOrderStatus, Tone> = {
  draft: "neutral",
  submitted: "warning",
  in_progress: "info",
  waiting_user: "warning",
  ready: "success",
  delivered: "success",
  rejected: "danger",
  cancelled: "neutral",
};

/** The statuses an operator may set, in processing order. */
const OPERATOR_STATUSES: JudicialOrderStatus[] = [
  "submitted",
  "in_progress",
  "waiting_user",
  "ready",
  "delivered",
  "rejected",
  "cancelled",
];

type StatusFilter = "open" | "all" | JudicialOrderStatus;
type ServiceFilter = "all" | "judicial_criminal_record" | "judicial_credit_check";

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

export function JudicialOrdersQueue() {
  const { can } = useAdminMe();
  const canReview = can("admin:judicial:review");

  const [status, setStatus] = useState<StatusFilter>("open");
  const [serviceId, setServiceId] = useState<ServiceFilter>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const query = useAdminJudicialOrders({
    status,
    ...(serviceId !== "all" ? { serviceId } : {}),
    q: debouncedSearch || undefined,
  });

  const counts = query.data?.counts;

  const statusOptions = useMemo(
    () => [
      { value: "open", label: "باز" },
      { value: "all", label: "همه" },
      ...OPERATOR_STATUSES.map((s) => ({ value: s, label: JUDICIAL_ORDER_STATUS_FA[s] })),
    ],
    []
  );

  const serviceFilters = useMemo(
    () => [
      { value: "all", label: "همهٔ خدمات" },
      { value: "judicial_criminal_record", label: "گواهی عدم سوءپیشینه" },
      { value: "judicial_credit_check", label: "استعلام اعتبار معاملاتی" },
    ],
    []
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-title-3 font-bold text-on-surface">سفارش‌های اوراق قضایی</h2>
        <p className="mt-1 max-w-3xl text-body-2 text-muted">
          این دو خدمت را مرجع بیرونی صادر می‌کند؛ آنچه در سامانه ثبت می‌شود خودِ درخواست،
          اطلاعات اعلامی، پیوست‌ها و نتیجهٔ واقعی پیگیری است. وضعیت «تحویل‌شده» فقط با
          پیوست فایل تحویل قابل ثبت است.
        </p>
      </div>

      {counts && (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-caption text-muted">
          <span>باز: {toPersianNumber(counts.open)}</span>
          <span>همه: {toPersianNumber(counts.all)}</span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[240px] flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="جستجو در عنوان، کاربر یا شناسه"
            ariaLabel="جستجو در سفارش‌ها"
          />
        </div>
        <FilterPills
          options={serviceFilters}
          value={serviceId}
          onChange={(v) => setServiceId(v as ServiceFilter)}
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="وضعیت سفارش"
          className="w-52"
        >
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="سفارشی با این فیلتر وجود ندارد."
      >
        {(data) => (
          <DataTable
            head={
              <tr>
                <Th>درخواست</Th>
                <Th>خدمت</Th>
                <Th>کاربر</Th>
                <Th>وضعیت</Th>
                <Th>پیوست‌ها</Th>
                <Th>کارشناس</Th>
                <Th>آخرین تغییر</Th>
                <Th>اقدام</Th>
              </tr>
            }
          >
            {data.items.map((row) => (
              <tr key={row.id}>
                <Td>
                  <div className="flex min-w-[180px] flex-col">
                    <span className="font-medium text-on-surface">{row.titleFa}</span>
                    <span className="font-mono text-caption text-muted" dir="ltr">
                      {row.id.slice(0, 12)}…
                    </span>
                  </div>
                </Td>
                <Td>{row.serviceFa}</Td>
                <Td>
                  <div className="flex flex-col">
                    <span>{row.owner.labelFa}</span>
                    {row.owner.mobile && (
                      <span className="font-mono text-caption text-muted" dir="ltr">
                        {row.owner.mobile}
                      </span>
                    )}
                  </div>
                </Td>
                <Td>
                  <Badge tone={STATUS_TONE[row.status]} dot>
                    {row.statusFa}
                  </Badge>
                </Td>
                <Td className="tabular-nums">{toPersianNumber(row.attachmentIds.length)}</Td>
                <Td className="text-caption">
                  {row.assignedToLabelFa ?? <span className="text-muted">تخصیص‌نشده</span>}
                </Td>
                <Td className="whitespace-nowrap">{toPersianDate(row.updatedAt)}</Td>
                <Td>
                  <Button
                    size="sm"
                    variant="secondary"
                    startIcon={<IconEdit size={15} />}
                    onClick={() => setOpenId(row.id)}
                  >
                    {canReview ? "بررسی" : "مشاهده"}
                  </Button>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </StateView>

      <JudicialOrderDrawer
        orderId={openId}
        canReview={canReview}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

function JudicialOrderDrawer({
  orderId,
  canReview,
  onClose,
}: {
  orderId: string | null;
  canReview: boolean;
  onClose: () => void;
}) {
  const detail = useAdminJudicialOrder(orderId);
  const update = useUpdateAdminJudicialOrder();

  const [nextStatus, setNextStatus] = useState<JudicialOrderStatus | "">("");
  const [operatorNote, setOperatorNote] = useState<string | null>(null);

  const order = detail.data?.order;
  const noteValue = operatorNote ?? order?.operatorNoteFa ?? "";
  const noteChanged = order !== undefined && noteValue !== (order.operatorNoteFa ?? "");

  async function save() {
    if (!orderId) return;
    try {
      await update.mutateAsync({
        orderId,
        input: {
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(noteChanged ? { operatorNoteFa: noteValue } : {}),
        },
      });
      snackbar.show({ message: "سفارش به‌روزرسانی شد.", variant: "success" });
      setNextStatus("");
      setOperatorNote(null);
    } catch (err) {
      snackbar.show({
        message: errMessage(err, "به‌روزرسانی سفارش ناموفق بود"),
        variant: "error",
      });
    }
  }

  return (
    <Drawer
      open={Boolean(orderId)}
      onClose={onClose}
      width={640}
      title={order ? `${order.serviceFa} — ${order.titleFa}` : "سفارش"}
    >
      {detail.isLoading ? (
        <LoadingBlock rows={6} />
      ) : detail.isError || !order ? (
        <ErrorBlock onRetry={() => detail.refetch()} />
      ) : (
        <div className="space-y-4">
          {!canReview && (
            <InfoBanner tone="warning">
              شما مجوز «بررسی اوراق قضایی» را ندارید؛ این نمایش فقط‌خواندنی است.
            </InfoBanner>
          )}

          <div className="rounded-large border border-divider p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[order.status]} dot>
                {order.statusFa}
              </Badge>
              <Badge tone="neutral">{toPersianDate(order.createdAt)}</Badge>
            </div>
            <dl className="mt-3 space-y-1.5 text-body-2">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">کاربر</dt>
                <dd>{order.owner.labelFa}</dd>
              </div>
              {order.owner.mobile && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">موبایل</dt>
                  <dd className="font-mono" dir="ltr">
                    {order.owner.mobile}
                  </dd>
                </div>
              )}
              {order.purposeFa && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">هدف اعلامی</dt>
                  <dd className="text-end">{order.purposeFa}</dd>
                </div>
              )}
              {order.noteFa && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">توضیح کاربر</dt>
                  <dd className="text-end">{order.noteFa}</dd>
                </div>
              )}
            </dl>
          </div>

          {order.answers.length > 0 && (
            <Section title="اطلاعات اعلامی">
              <div className="divide-y divide-divider rounded-medium border border-divider">
                {order.answers.map((a) => (
                  <div key={a.fieldId} className="flex justify-between gap-3 p-2.5 text-body-2">
                    <span className="text-muted">{a.labelFa}</span>
                    <span className="text-end">{a.value}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="پیوست‌ها">
            {order.attachmentIds.length === 0 ? (
              <p className="text-body-2 text-muted">پیوستی ثبت نشده است.</p>
            ) : (
              <ul className="list-inside list-disc text-body-2 text-on-surface-variant">
                {order.attachmentIds.map((id) => (
                  <li key={id} className="font-mono text-caption" dir="ltr">
                    {id}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {order.deliveryNameFa && (
            <Section title="فایل تحویل">
              <p className="text-body-2">{order.deliveryNameFa}</p>
              {order.deliveredAt && (
                <p className="text-caption text-muted tabular-nums">
                  {toPersianDate(order.deliveredAt)}
                </p>
              )}
            </Section>
          )}

          {order.operatorNoteFa && !canReview && (
            <Section title="یادداشت کارشناس (قابل مشاهده توسط کاربر)">
              <p className="whitespace-pre-wrap text-body-2">{order.operatorNoteFa}</p>
            </Section>
          )}

          {canReview && (
            <Section title="اقدام">
              <div className="space-y-3">
                <Field label="وضعیت جدید">
                  <Select
                    value={nextStatus || order.status}
                    onChange={(e) => setNextStatus(e.target.value as JudicialOrderStatus)}
                    aria-label="وضعیت جدید"
                  >
                    {OPERATOR_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {JUDICIAL_ORDER_STATUS_FA[s]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="یادداشت برای کاربر">
                  <TextArea
                    value={noteValue}
                    onChange={(e) => setOperatorNote(e.target.value)}
                    rows={3}
                    placeholder="این متن برای کاربر قابل مشاهده است."
                  />
                </Field>
                <p className="text-caption text-muted">
                  ثبت «تحویل‌شده» بدون پیوست فایل تحویل پذیرفته نمی‌شود؛ سرور آن را رد می‌کند.
                </p>
                <Button
                  variant="primary"
                  disabled={update.isPending || (!nextStatus && !noteChanged)}
                  onClick={() => void save()}
                >
                  ذخیرهٔ تغییرات
                </Button>
              </div>
            </Section>
          )}
        </div>
      )}
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-large border border-divider p-3">
      <h4 className="mb-2 text-body-2 font-bold text-on-surface">{title}</h4>
      {children}
    </div>
  );
}
