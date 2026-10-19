// ============================================================
// LEGALIR — /judicial/orders/[id] (tracked request, owner side)
// ============================================================
// One provider-service request as its owner sees it:
//
//   status + what was submitted → the operator's visible note →
//   the delivered artifact (when one exists) → the editable draft form.
//
// Every displayed fact comes from the stored row. «تحویل‌شده» is never shown
// without `deliveryDocumentId`, and the download link points at the real
// document — Ligalir does not fabricate an artifact for these two services.
//
// While the row is a draft (or returned as `waiting_user`) the same intake
// form used at creation edits it. Submitting re-checks availability and the
// required fields on the server; when the service has been switched off the
// form stays readable and savable, and only the hand-off is closed.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, ConfirmDialog, snackbar } from "@legalir/ui";
import {
  JUDICIAL_ORDER_STATUS_FA,
  type JudicialOrderStatus,
} from "@legalir/types";
import {
  IconArrowBack,
  IconCheckCircle,
  IconDownload,
  IconInfo,
  IconRefresh,
  IconWarning,
} from "@/lib/icons";
import {
  CompactPageHeader,
  PageContainer,
  StatusBadge,
  type StatusTone,
} from "@/components/shared";
import {
  OrderIntakeForm,
  type OrderIntakePayload,
} from "@/components/judicial/order/order-intake-form";
import { useDocuments } from "@/hooks/useDocuments";
import {
  useCancelJudicialOrder,
  useJudicialOrder,
  useJudicialServices,
  useSubmitJudicialOrder,
  useUpdateJudicialOrder,
} from "@/hooks/useJudicial";
import {
  fromOrderAnswers,
  judicialOrderConfig,
  toOrderAnswers,
} from "@/lib/judicial/order-fields";
import { ApiClientError } from "@/lib/api/errors";
import { formatFileSize, toPersianDate } from "@/lib/persian-utils";

const STATUS_TONE: Record<JudicialOrderStatus, StatusTone> = {
  draft: "neutral",
  submitted: "info",
  in_progress: "info",
  waiting_user: "warning",
  ready: "brand",
  delivered: "success",
  rejected: "error",
  cancelled: "neutral",
};

const EDITABLE: readonly JudicialOrderStatus[] = ["draft", "waiting_user"];

function documentDownloadUrl(id: string): string {
  return `/api/v1/documents/${encodeURIComponent(id)}/download`;
}

export default function JudicialOrderPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id ?? "";
  const order = useJudicialOrder(orderId);
  const services = useJudicialServices();
  const documents = useDocuments({ pageSize: 60 });
  const update = useUpdateJudicialOrder(orderId);
  const submit = useSubmitJudicialOrder(orderId);
  const cancel = useCancelJudicialOrder();

  const [formError, setFormError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const row = order.data?.order ?? null;
  const service = useMemo(
    () => services.data?.items.find((s) => s.id === row?.serviceId) ?? null,
    [services.data, row?.serviceId]
  );

  const config = row ? judicialOrderConfig(row.serviceId) : null;
  const openForRequests = service?.availability === "request_only";
  const editable = row ? EDITABLE.includes(row.status) && config?.available : false;

  const initial: OrderIntakePayload | undefined = useMemo(() => {
    if (!row || !config) return undefined;
    const { values, consent } = fromOrderAnswers(config, row.answers);
    return {
      values,
      purpose: row.purposeFa ?? "",
      consent,
      note: row.noteFa ?? "",
      attachmentIds: row.attachmentIds,
    };
  }, [row, config]);

  const documentNames = useMemo(() => {
    const items = documents.data?.items ?? [];
    return new Map(items.map((d) => [d.id, d]));
  }, [documents.data]);

  async function save(payload: OrderIntakePayload, doSubmit: boolean) {
    if (!row || !config) return;
    setFormError(null);
    try {
      await update.mutateAsync({
        answers: toOrderAnswers(config, payload.values, payload.consent),
        noteFa: payload.note.trim() || null,
        purposeFa: config.requiresPurpose ? payload.purpose.trim() || null : null,
        attachmentIds: payload.attachmentIds,
      });
      if (doSubmit) {
        await submit.mutateAsync();
        snackbar.show({ message: "درخواست ثبت شد.", variant: "success" });
      } else {
        snackbar.show({ message: "پیش‌نویس ذخیره شد.", variant: "success" });
      }
    } catch (e) {
      // The server's message is the source of truth (e.g. «این درخواست دیگر
      // قابل ویرایش نیست» or the availability refusal on submit).
      setFormError(
        e instanceof ApiClientError ? e.message : "ذخیرهٔ تغییرات ناموفق بود."
      );
    }
  }

  function doCancel() {
    cancel.mutate(orderId, {
      onSuccess: () => {
        setConfirmCancel(false);
        snackbar.show({ message: "درخواست لغو شد.", variant: "success" });
      },
      onError: (e) => {
        setConfirmCancel(false);
        snackbar.show({
          message:
            e instanceof ApiClientError ? e.message : "لغو درخواست ناموفق بود.",
          variant: "error",
        });
      },
    });
  }

  return (
    <PageContainer dir="rtl">
      <CompactPageHeader
        title={row?.titleFa ?? "درخواست"}
        description={
          service?.titleFa ??
          "درخواست پیگیری‌شده در یکی از خدمات وابسته به مرجع رسمی"
        }
        breadcrumb={[
          { label: "پرونده‌ها", href: "/cases" },
          { label: "دادخواست‌ها و شکواییه‌ها", href: "/cases?tab=judicial" },
          { label: "درخواست" },
        ]}
        actions={
          <Link
            href="/cases?tab=judicial"
            className="inline-flex items-center gap-1 text-labelLarge text-primary hover:underline"
          >
            بازگشت
            <IconArrowBack size={16} />
          </Link>
        }
      />

      {order.isLoading && (
        <div className="mt-4 animate-pulse space-y-3">
          <div className="h-20 rounded-large bg-surface-container" />
          <div className="h-56 rounded-large bg-surface-container" />
        </div>
      )}

      {!order.isLoading && order.isError && (
        <div className="mt-4 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-8 text-center">
          <div className="mb-4 flex justify-center">
            <IconWarning size={44} className="text-error" />
          </div>
          <h2 className="mb-2 text-titleMedium text-on-surface">
            درخواست خوانده نشد
          </h2>
          <p className="mb-5 text-body-2 text-on-surface-variant">
            ممکن است درخواست وجود نداشته باشد یا اتصال برقرار نشده باشد.
          </p>
          <Button
            onClick={() => void order.refetch()}
            startIcon={<IconRefresh size={16} />}
          >
            تلاش مجدد
          </Button>
        </div>
      )}

      {row && (
        <div className="mt-4 space-y-4">
          {/* --- Status + dates --- */}
          <section className="rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={JUDICIAL_ORDER_STATUS_FA[row.status]}
                tone={STATUS_TONE[row.status]}
              />
              <span className="text-caption text-on-surface-variant">
                ثبت: {toPersianDate(row.createdAt)} · آخرین به‌روزرسانی:{" "}
                {toPersianDate(row.updatedAt)}
              </span>
            </div>

            {row.operatorNoteFa && (
              <p className="mt-3 flex items-start gap-2 rounded-medium bg-surface-container-low px-3 py-2 text-caption leading-6 text-on-surface-variant">
                <IconInfo size={15} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium text-on-surface">پیام کارشناس: </span>
                  {row.operatorNoteFa}
                </span>
              </p>
            )}

            {row.status === "delivered" && row.deliveryDocumentId && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-medium bg-success-container px-3 py-2.5">
                <p className="flex items-center gap-2 text-labelLarge text-on-surface">
                  <IconCheckCircle size={17} />
                  {row.deliveryNameFa ?? "سند تحویل‌شده"}
                  {row.deliveredAt ? ` — ${toPersianDate(row.deliveredAt)}` : ""}
                </p>
                <a
                  href={documentDownloadUrl(row.deliveryDocumentId)}
                  className="inline-flex items-center gap-1 text-labelLarge text-primary hover:underline"
                >
                  <IconDownload size={16} />
                  دریافت سند
                </a>
              </div>
            )}
          </section>

          {/* --- The submitted facts --- */}
          <section className="rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5">
            <h2 className="mb-3 text-titleSmall text-on-surface">اطلاعات ثبت‌شده</h2>
            <dl className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
              {row.answers.map((answer) => (
                <div key={answer.fieldId} className="min-w-0">
                  <dt className="text-caption text-on-surface-variant">
                    {answer.labelFa}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-body-2 text-on-surface">
                    {answer.value}
                  </dd>
                </div>
              ))}
              {row.purposeFa && (
                <div className="min-w-0">
                  <dt className="text-caption text-on-surface-variant">هدف مشروع</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-body-2 text-on-surface">
                    {row.purposeFa}
                  </dd>
                </div>
              )}
              {row.noteFa && (
                <div className="min-w-0">
                  <dt className="text-caption text-on-surface-variant">
                    توضیح تکمیلی
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-body-2 text-on-surface">
                    {row.noteFa}
                  </dd>
                </div>
              )}
            </dl>

            {row.attachmentIds.length > 0 && (
              <div className="mt-4">
                <h3 className="text-caption text-on-surface-variant">پیوست‌ها</h3>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {row.attachmentIds.map((id) => {
                    const doc = documentNames.get(id);
                    return (
                      <li key={id}>
                        <a
                          href={documentDownloadUrl(id)}
                          className="inline-flex items-center gap-1.5 rounded-medium border border-[color:var(--color-outline-variant)] px-2.5 py-1.5 text-caption text-on-surface hover:border-primary"
                        >
                          {doc?.name ?? "مدرک پیوست"}
                          {doc ? ` · ${formatFileSize(doc.sizeBytes)}` : ""}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* --- Edit / submit --- */}
          {editable && service && initial && (
            <section className="rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5">
              <h2 className="mb-1 text-titleSmall text-on-surface">ویرایش پیش‌نویس</h2>
              <p className="mb-4 text-caption leading-6 text-on-surface-variant">
                تا زمانی که درخواست ثبت نشده، می‌توانید اطلاعات آن را تغییر دهید.
              </p>
              <OrderIntakeForm
                service={service}
                openForRequests={openForRequests}
                initial={initial}
                busy={update.isPending || submit.isPending}
                error={formError}
                onSave={(payload, doSubmit) => void save(payload, doSubmit)}
              />
            </section>
          )}

          {/* --- Cancel --- */}
          {row.status !== "delivered" && row.status !== "cancelled" && (
            <div className="flex justify-end">
              <Button variant="text" onClick={() => setConfirmCancel(true)}>
                لغو درخواست
              </Button>
            </div>
          )}

          <ConfirmDialog
            open={confirmCancel}
            onClose={() => setConfirmCancel(false)}
            onConfirm={doCancel}
            loading={cancel.isPending}
            destructive
            title="لغو این درخواست؟"
            description="درخواست از صف پیگیری خارج می‌شود اما حذف نمی‌شود؛ سابقهٔ آن نزد شما می‌ماند."
            confirmLabel="لغو کن"
            cancelLabel="انصراف"
          />
        </div>
      )}
    </PageContainer>
  );
}
