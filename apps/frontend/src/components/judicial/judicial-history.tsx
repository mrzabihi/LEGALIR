// ============================================================
// LEGALIR — /cases › «دادخواست‌ها و شکواییه‌ها» history tab
// ============================================================
// The second history list on /cases. It shows TWO lanes, because the owner
// has two kinds of work and a single list would hide one of them:
//
//   • دادخواست‌ها و شکواییه‌ها — drafting requests, in the same compact
//     scan-list language as the case rows above them:
//     identity (family-tinted tile · title · type) → status → actions;
//   • درخواست‌های پیگیری — tracked orders for the two provider services,
//     which never produce a draft and therefore have no wizard to resume.
//
// Everything shown here is a server fact: the status label, the created /
// last-edited dates, the draft and attachment counts, and — crucially —
// `hasFinalDocument`, which is derived from the stored final-document row.
// «دریافت نسخهٔ نهایی» is therefore offered only when a real artifact
// exists to serve; it never guesses from the status name.
//
// Deletion is a hard delete of the request and every row private to it, so
// it always sits behind a confirmation. A request whose final document has
// been issued cannot be deleted (the server answers 409); the row offers the
// archive path instead, and the server message is surfaced verbatim if the
// state changed underneath us.
// ============================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Dialog, snackbar, buttonClasses } from "@legalir/ui";
import {
  JUDICIAL_DOCUMENT_TYPE_FA,
  JUDICIAL_ORDER_STATUS_FA,
  JUDICIAL_REQUEST_STATUS_FA,
} from "@legalir/types";
import type {
  JudicialOrder,
  JudicialOrderStatus,
  JudicialRequestStatus,
  JudicialRequestSummary,
} from "@legalir/types";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import {
  IconArchive,
  IconCopy,
  IconDelete,
  IconDownload,
  IconFilePen,
  IconInfo,
  IconRefresh,
  IconScale,
  IconSend,
  IconWarning,
} from "@/lib/icons";
import { OverflowMenu, StatusBadge, type StatusTone } from "@/components/shared";
import {
  useDeleteJudicialRequest,
  useJudicialCard,
  useJudicialOrders,
  useJudicialRequests,
  useJudicialServices,
  useTransitionJudicialRequest,
} from "@/hooks/useJudicial";
import { judicialFinalDocumentUrl } from "@/lib/api/judicial";
import { ApiClientError } from "@/lib/api/errors";

// ============================================================
// Status vocabulary → shared tone
// ============================================================

const STATUS_TONE: Record<JudicialRequestStatus, StatusTone> = {
  draft: "neutral",
  collecting: "info",
  needs_answers: "warning",
  ready_to_generate: "info",
  generating: "info",
  draft_ready: "info",
  ready_to_review: "brand",
  under_review: "warning",
  needs_correction: "warning",
  approved: "success",
  finalized: "success",
  cancelled: "neutral",
  archived: "neutral",
};

/**
 * The leading tile's fill, derived from the SAME status the badge names so a
 * row's state is legible from the edge of the list before any word is read.
 * The badge always repeats it in text, so colour is never the only carrier.
 */
const TILE_TONE: Record<JudicialRequestStatus, string> = {
  draft: "bg-surface-container text-on-surface-variant",
  collecting: "bg-info-container text-info",
  needs_answers: "bg-warning-container text-warning",
  ready_to_generate: "bg-info-container text-info",
  generating: "bg-info-container text-info",
  draft_ready: "bg-info-container text-info",
  ready_to_review: "bg-control-selected-surface text-control-selected-text",
  under_review: "bg-warning-container text-warning",
  needs_correction: "bg-warning-container text-warning",
  approved: "bg-success-container text-success",
  finalized: "bg-success-container text-success",
  cancelled: "bg-surface-container text-on-surface-variant",
  archived: "bg-surface-container text-on-surface-variant",
};

/** Statuses the owner can still usefully continue filling in the wizard. */
const EDITABLE: readonly JudicialRequestStatus[] = [
  "draft",
  "collecting",
  "needs_answers",
  "ready_to_generate",
  "draft_ready",
  "needs_correction",
];

/** Statuses from which the archive transition is legal server-side. */
const ARCHIVABLE: readonly JudicialRequestStatus[] = [
  "approved",
  "finalized",
  "cancelled",
];

/** The single primary action for a row, always true to its status. */
function primaryAction(request: JudicialRequestSummary): {
  label: string;
  href: string;
} {
  if (request.status === "needs_correction") {
    return { label: "ادامهٔ اصلاح", href: `/judicial/${request.id}` };
  }
  if (EDITABLE.includes(request.status)) {
    return { label: "ادامهٔ تکمیل", href: `/judicial/${request.id}` };
  }
  return { label: "مشاهده", href: `/judicial/${request.id}` };
}

function typeLabel(request: JudicialRequestSummary): string {
  return request.documentType
    ? JUDICIAL_DOCUMENT_TYPE_FA[request.documentType]
    : "نوع سند هنوز مشخص نشده";
}

function copyId(id: string) {
  navigator.clipboard
    .writeText(id)
    .then(() => snackbar.show({ message: "شناسه کپی شد", variant: "success" }))
    .catch(() => snackbar.show({ message: "کپی ناموفق بود", variant: "error" }));
}

// ============================================================
// One row
// ============================================================

function RequestRow({
  request,
  onDelete,
}: {
  request: JudicialRequestSummary;
  onDelete: (request: JudicialRequestSummary) => void;
}) {
  const archive = useTransitionJudicialRequest(request.id);
  const action = primaryAction(request);
  const canArchive = ARCHIVABLE.includes(request.status);

  function handleArchive() {
    archive.mutate("archived", {
      onSuccess: () =>
        snackbar.show({ message: "درخواست بایگانی شد", variant: "success" }),
      onError: () =>
        snackbar.show({
          message: "بایگانی ناموفق بود؛ دوباره تلاش کنید",
          variant: "error",
        }),
    });
  }

  return (
    <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-3 transition-colors duration-short3 hover:border-[color:var(--color-outline)] tablet:grid-cols-[minmax(0,1fr)_9.5rem_auto] tablet:gap-x-5 tablet:p-4">
      {/* --- Identity --- */}
      <div className="col-span-2 flex min-w-0 items-center gap-3 tablet:col-span-1">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-medium ${TILE_TONE[request.status]}`}
          aria-hidden="true"
        >
          <IconScale size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="min-w-0 truncate text-titleSmall font-semibold text-on-surface">
            {request.titleFa}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-caption text-on-surface-variant">
            <span className="font-medium text-on-surface-variant">
              {typeLabel(request)}
            </span>
            <span aria-hidden="true" className="text-divider">
              ·
            </span>
            <span>ایجاد: {toPersianDate(request.createdAt)}</span>
            <span aria-hidden="true" className="text-divider">
              ·
            </span>
            <span>آخرین ویرایش: {toPersianDate(request.updatedAt)}</span>
            {request.draftCount > 0 && (
              <>
                <span aria-hidden="true" className="text-divider">
                  ·
                </span>
                <span>{toPersianNumber(request.draftCount)} پیش‌نویس</span>
              </>
            )}
            {request.documentCount > 0 && (
              <>
                <span aria-hidden="true" className="text-divider">
                  ·
                </span>
                <span>{toPersianNumber(request.documentCount)} مدرک</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* --- Status (its own column, aligned across rows) --- */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 tablet:flex-col tablet:items-start tablet:gap-1">
        <StatusBadge
          label={JUDICIAL_REQUEST_STATUS_FA[request.status]}
          tone={STATUS_TONE[request.status]}
        />
      </div>

      {/* --- Actions --- */}
      <div className="flex shrink-0 items-center justify-end gap-1.5 tablet:border-s tablet:border-divider tablet:ps-5">
        {/* The issued artifact — only when a real file row exists. */}
        {request.hasFinalDocument && (
          <a
            href={judicialFinalDocumentUrl(request.id, true)}
            className={buttonClasses({ variant: "outlined", size: "small" })}
          >
            <IconDownload size={16} className="me-1" aria-hidden="true" />
            دریافت نسخهٔ نهایی
          </a>
        )}

        <Link
          href={action.href}
          className={buttonClasses({ variant: "outlined", size: "small" })}
        >
          {action.label}
        </Link>

        <OverflowMenu
          label="گزینه‌های این درخواست"
          size="small"
          className="shrink-0"
          items={[
            {
              key: "copy",
              label: "کپی شناسه",
              icon: <IconCopy size={16} />,
              onSelect: () => copyId(request.id),
            },
            ...(canArchive
              ? [
                  {
                    key: "archive",
                    label: "بایگانی",
                    icon: <IconArchive size={16} />,
                    disabled: archive.isPending,
                    onSelect: handleArchive,
                  },
                ]
              : []),
            // A request that already produced a final document cannot be
            // deleted (server refuses with 409); the archive path above is
            // the honest alternative, so no delete item is offered for it.
            ...(!request.hasFinalDocument
              ? [
                  {
                    key: "delete",
                    label: "حذف",
                    icon: <IconDelete size={16} />,
                    destructive: true,
                    onSelect: () => onDelete(request),
                  },
                ]
              : []),
          ]}
        />
      </div>
    </article>
  );
}

// ============================================================
// Tracked orders (the two provider services)
// ============================================================

const ORDER_TONE: Record<JudicialOrderStatus, StatusTone> = {
  draft: "neutral",
  submitted: "info",
  in_progress: "info",
  waiting_user: "warning",
  ready: "brand",
  delivered: "success",
  rejected: "error",
  cancelled: "neutral",
};

const ORDER_TILE: Record<JudicialOrderStatus, string> = {
  draft: "bg-surface-container text-on-surface-variant",
  submitted: "bg-info-container text-info",
  in_progress: "bg-info-container text-info",
  waiting_user: "bg-warning-container text-warning",
  ready: "bg-control-selected-surface text-control-selected-text",
  delivered: "bg-success-container text-success",
  rejected: "bg-error-container text-error",
  cancelled: "bg-surface-container text-on-surface-variant",
};

const OPEN_ORDER: readonly JudicialOrderStatus[] = [
  "draft",
  "waiting_user",
  "submitted",
  "in_progress",
  "ready",
];

function OrderRow({
  order,
  serviceTitleFa,
}: {
  order: JudicialOrder;
  serviceTitleFa: string;
}) {
  const resumable = OPEN_ORDER.includes(order.status);
  return (
    <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-3 transition-colors duration-short3 hover:border-[color:var(--color-outline)] tablet:grid-cols-[minmax(0,1fr)_9.5rem_auto] tablet:gap-x-5 tablet:p-4">
      <div className="col-span-2 flex min-w-0 items-center gap-3 tablet:col-span-1">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-medium ${ORDER_TILE[order.status]}`}
          aria-hidden="true"
        >
          <IconSend size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="min-w-0 truncate text-titleSmall font-semibold text-on-surface">
            {order.titleFa}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-caption text-on-surface-variant">
            <span className="font-medium">{serviceTitleFa}</span>
            <span aria-hidden="true" className="text-divider">
              ·
            </span>
            <span>ثبت: {toPersianDate(order.createdAt)}</span>
            <span aria-hidden="true" className="text-divider">
              ·
            </span>
            <span>آخرین به‌روزرسانی: {toPersianDate(order.updatedAt)}</span>
            {order.attachmentIds.length > 0 && (
              <>
                <span aria-hidden="true" className="text-divider">
                  ·
                </span>
                <span>{toPersianNumber(order.attachmentIds.length)} مدرک</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <StatusBadge
          label={JUDICIAL_ORDER_STATUS_FA[order.status]}
          tone={ORDER_TONE[order.status]}
        />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5 tablet:border-s tablet:border-divider tablet:ps-5">
        <Link
          href={`/judicial/orders/${order.id}`}
          className={buttonClasses({ variant: "outlined", size: "small" })}
        >
          {resumable ? "پیگیری" : "مشاهده"}
        </Link>
      </div>
    </article>
  );
}

// ============================================================
// Delete confirmation
// ============================================================

function DeleteRequestDialog({
  target,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  target: JudicialRequestSummary | null;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={target !== null}
      onClose={onCancel}
      maxWidth="sm"
      actions={
        <>
          <Button variant="text" onClick={onCancel} disabled={pending}>
            انصراف
          </Button>
          <Button
            variant="filled"
            onClick={onConfirm}
            loading={pending}
            disabled={error !== null}
          >
            حذف کن
          </Button>
        </>
      }
    >
      <h2 className="mb-3 text-headlineSmall text-on-surface">حذف این درخواست؟</h2>
      <p className="text-body-2 leading-relaxed text-on-surface-variant">
        درخواست
        <span className="font-medium text-on-surface">
          {" «"}
          {target?.titleFa ?? ""}
          {"» "}
        </span>
        و همهٔ پاسخ‌ها، مدارک پیوست و پیش‌نویس‌های آن حذف می‌شود. این اقدام
        قابل بازگشت نیست.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-medium bg-error-container px-3 py-2 text-caption leading-6 text-on-surface"
        >
          <IconWarning size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </Dialog>
  );
}

// ============================================================
// The tab
// ============================================================

export function JudicialHistory() {
  // Archived rows are hidden by default (the card promise: previous work is
  // never removed, it is just out of the way). The toggle reads the same
  // owner-scoped list with `includeArchived`.
  const [includeArchived, setIncludeArchived] = useState(false);
  const requests = useJudicialRequests(includeArchived);
  const orders = useJudicialOrders();
  const services = useJudicialServices();
  const card = useJudicialCard();
  const remove = useDeleteJudicialRequest();

  const serviceTitle = (id: JudicialOrder["serviceId"]): string =>
    services.data?.items.find((s) => s.id === id)?.titleFa ?? "خدمت قضایی";

  const [deleteTarget, setDeleteTarget] = useState<JudicialRequestSummary | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const items = requests.data?.items ?? [];
  const orderItems = orders.data?.items ?? [];

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    remove.mutate(deleteTarget.id, {
      onSuccess: () => {
        snackbar.show({ message: "درخواست حذف شد", variant: "success" });
        setDeleteTarget(null);
      },
      onError: (e) => {
        // The server's message is the source of truth (e.g. the 409 that
        // explains an issued final document cannot be deleted). Never replace
        // it with a generic "failed" line.
        const message =
          e instanceof ApiClientError
            ? e.message
            : "حذف ناموفق بود؛ دوباره تلاش کنید";
        setDeleteError(message);
      },
    });
  }

  return (
    <div className="mt-3 tablet:mt-4">
      {/* Honesty line — served by the API, never asserted locally. */}
      {card.data && (
        <p className="mb-3 flex items-start gap-2 rounded-medium bg-surface-container-low px-3 py-2 text-caption leading-6 text-on-surface-variant">
          <IconInfo size={15} className="mt-0.5 shrink-0" />
          {card.data.capabilities.filingNoteFa}
        </p>
      )}

      {requests.isLoading && (
        <div className="space-y-2.5" aria-label="در حال بارگذاری درخواست‌ها">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-3 tablet:p-4"
            >
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-medium bg-surface-container" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-surface-container" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-surface-container" />
              </div>
              <div className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-surface-container" />
            </div>
          ))}
        </div>
      )}

      {!requests.isLoading && requests.isError && (
        <div className="rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-8 text-center">
          <div className="mb-4 flex justify-center">
            <IconWarning size={44} className="text-error" />
          </div>
          <h3 className="mb-2 text-titleMedium text-on-surface">
            خطا در دریافت درخواست‌ها
          </h3>
          <p className="mb-6 text-body-2 text-on-surface-variant">
            اتصال برقرار نشد؛ دوباره تلاش کنید.
          </p>
          <Button
            onClick={() => void requests.refetch()}
            startIcon={<IconRefresh size={16} />}
          >
            تلاش مجدد
          </Button>
        </div>
      )}

      {!requests.isLoading &&
        !requests.isError &&
        items.length === 0 &&
        orderItems.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
              <IconFilePen size={26} aria-hidden="true" />
            </div>
            <p className="text-body-1 font-medium text-on-surface">
              هنوز دادخواست یا شکواییه‌ای شروع نشده است
            </p>
            <p className="max-w-md text-body-2 text-on-surface-variant">
              موضوع را توضیح دهید، به پرسش‌های لازم پاسخ دهید و پیش‌نویس خود را
              مرحله‌به‌مرحله آماده کنید.
            </p>
            {/* Family start. The bare /judicial route is the declaration
                entry now, so a generic family start names its family. */}
            <Link href="/judicial?type=petition" className={`${buttonClasses()} mt-2`}>
              شروع تنظیم
            </Link>
          </div>
        )}

      {!requests.isLoading && !requests.isError && items.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            <span className="text-caption text-on-surface-variant">
              {toPersianNumber(items.length)} درخواست
            </span>
            <button
              type="button"
              aria-pressed={includeArchived}
              onClick={() => setIncludeArchived((v) => !v)}
              className={[
                "rounded-full border px-3 py-1 text-caption transition-colors duration-short3",
                includeArchived
                  ? "border-primary bg-primary-container text-on-surface"
                  : "border-[color:var(--color-outline-variant)] text-on-surface-variant hover:border-[color:var(--color-outline)]",
              ].join(" ")}
            >
              نمایش بایگانی‌شده‌ها
            </button>
          </div>

          {items.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              onDelete={(target) => {
                setDeleteError(null);
                setDeleteTarget(target);
              }}
            />
          ))}
        </div>
      )}

      {/* Tracked orders — a separate lane, never mixed into the request count
          above because these rows have no drafts and no wizard. */}
      {orderItems.length > 0 && (
        <section aria-labelledby="judicial-orders-title" className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
            <h2 id="judicial-orders-title" className="text-titleSmall text-on-surface">
              درخواست‌های پیگیری
            </h2>
            <span className="text-caption text-on-surface-variant">
              {toPersianNumber(orderItems.length)} درخواست
            </span>
          </div>
          <p className="mb-3 text-caption leading-6 text-on-surface-variant">
            این درخواست‌ها توسط کارشناس پیگیری می‌شوند؛ تحویل نتیجه به مرجع رسمی
            وابسته است و در همین صفحه وضعیت آن را می‌بینید.
          </p>
          <div className="space-y-2.5">
            {orderItems.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                serviceTitleFa={serviceTitle(order.serviceId)}
              />
            ))}
          </div>
        </section>
      )}

      <DeleteRequestDialog
        target={deleteTarget}
        pending={remove.isPending}
        error={deleteError}
        onCancel={() => {
          if (!remove.isPending) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
