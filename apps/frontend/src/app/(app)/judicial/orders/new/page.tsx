// ============================================================
// LEGALIR — /judicial/orders/new (tracked request intake)
// ============================================================
// The start path for the two provider-dependent services. It is entered from
// the service cards (`/judicial/orders/new?service=judicial_criminal_record`)
// and creates NOTHING until the user saves: this page is a form, not a row.
//
// The service itself is read from `GET /api/v1/judicial/services`, so the
// admin's status, surface flags and requirement note drive this page exactly
// as they drive the discovery cards. A service that is no longer
// `request_only` for this caller renders an explanation and no form.
// ============================================================

"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { snackbar } from "@legalir/ui";
import type { JudicialServiceId } from "@legalir/types";
import { IconArrowBack, IconRefresh, IconWarning } from "@/lib/icons";
import { CompactPageHeader, PageContainer } from "@/components/shared";
import {
  OrderIntakeForm,
  type OrderIntakePayload,
} from "@/components/judicial/order/order-intake-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  judicialKeys,
  useCreateJudicialOrder,
  useJudicialServices,
} from "@/hooks/useJudicial";
import { submitJudicialOrder } from "@/lib/api/judicial";
import {
  judicialOrderConfig,
  orderTitleFa,
  toOrderAnswers,
} from "@/lib/judicial/order-fields";
import { ApiClientError } from "@/lib/api/errors";

function isServiceId(value: string | null): value is JudicialServiceId {
  return (
    value === "judicial_criminal_record" ||
    value === "judicial_credit_check" ||
    value === "judicial_statement" ||
    value === "judicial_brief" ||
    value === "judicial_petition" ||
    value === "judicial_complaint"
  );
}

function OrderIntakePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("service");
  const serviceId = isServiceId(requested) ? requested : null;

  const qc = useQueryClient();
  const services = useJudicialServices();
  const create = useCreateJudicialOrder();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = useMemo(
    () => services.data?.items.find((s) => s.id === serviceId) ?? null,
    [services.data, serviceId]
  );

  const config = service ? judicialOrderConfig(service.id) : null;
  const openForRequests = service?.availability === "request_only";

  async function onSave(payload: OrderIntakePayload, doSubmit: boolean) {
    if (!service || !config) return;
    setError(null);
    try {
      // One key per logical attempt; retrying the same click replays the row
      // instead of creating a second request.
      const { order } = await create.mutateAsync({
        serviceId: service.id,
        titleFa: orderTitleFa(service, payload.values),
        answers: toOrderAnswers(config, payload.values, payload.consent),
        noteFa: payload.note.trim() || null,
        purposeFa: config.requiresPurpose ? payload.purpose.trim() || null : null,
        attachmentIds: payload.attachmentIds,
        submit: false,
        idempotencyKey: crypto.randomUUID(),
      });

      if (doSubmit) {
        setSubmitting(true);
        try {
          const result = await submitJudicialOrder(order.id);
          qc.setQueryData(judicialKeys.order(order.id), result);
          snackbar.show({ message: "درخواست ثبت شد.", variant: "success" });
        } catch (e) {
          // The draft still exists; send the owner to it so nothing is lost.
          snackbar.show({
            message:
              e instanceof ApiClientError
                ? e.message
                : "ثبت نهایی ناموفق بود؛ پیش‌نویس ذخیره شد.",
            variant: "error",
          });
        } finally {
          setSubmitting(false);
        }
        void qc.invalidateQueries({ queryKey: judicialKeys.orders });
        void qc.invalidateQueries({ queryKey: judicialKeys.card });
        router.push(`/judicial/orders/${order.id}`);
        return;
      }

      snackbar.show({ message: "پیش‌نویس ذخیره شد.", variant: "success" });
      router.push(`/judicial/orders/${order.id}`);
    } catch (e) {
      setError(
        e instanceof ApiClientError ? e.message : "ذخیرهٔ درخواست ناموفق بود."
      );
    }
  }

  const busy = create.isPending || submitting;

  return (
    <PageContainer dir="rtl">
      <CompactPageHeader
        title={service ? service.titleFa : "ثبت درخواست"}
        description={
          service?.descriptionFa ??
          "اطلاعات لازم را وارد کنید تا درخواست شما ثبت و توسط کارشناس پیگیری شود."
        }
        breadcrumb={[
          { label: "پرونده‌ها", href: "/cases" },
          { label: "دادخواست‌ها و شکواییه‌ها", href: "/cases?tab=judicial" },
          { label: service?.shortTitleFa ?? "درخواست جدید" },
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

      {services.isLoading && (
        <div className="mt-4 animate-pulse space-y-3">
          <div className="h-20 rounded-large bg-surface-container" />
          <div className="h-64 rounded-large bg-surface-container" />
        </div>
      )}

      {!services.isLoading && (services.isError || !service) && (
        <div className="mt-4 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-8 text-center">
          <div className="mb-4 flex justify-center">
            <IconWarning size={44} className="text-error" />
          </div>
          <h2 className="mb-2 text-titleMedium text-on-surface">
            این خدمت پیدا نشد
          </h2>
          <p className="mb-5 text-body-2 text-on-surface-variant">
            ممکن است نشانی ناقص باشد یا این خدمت دیگر ارائه نشود.
          </p>
          <Link
            href="/cases?tab=judicial"
            className="text-labelLarge text-primary hover:underline"
          >
            بازگشت به فهرست درخواست‌ها
          </Link>
        </div>
      )}

      {service && !config?.available && (
        <div className="mt-4 flex flex-col gap-2 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-5">
          <p className="flex items-center gap-2 text-body-1 text-on-surface">
            <IconRefresh size={18} className="text-primary" />
            این خدمت مسیر مستقل خودش را دارد.
          </p>
          <p className="text-body-2 leading-6 text-on-surface-variant">
            برای این خدمت، از مسیر تنظیم سند استفاده کنید.
          </p>
          <Link
            href="/judicial"
            className="mt-1 self-start text-labelLarge text-primary hover:underline"
          >
            رفتن به تنظیم سند
          </Link>
        </div>
      )}

      {service && config?.available && (
        <section className="mt-4 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5">
          <OrderIntakeForm
            service={service}
            openForRequests={openForRequests}
            busy={busy}
            error={error}
            onSave={(payload, doSubmit) => void onSave(payload, doSubmit)}
          />
        </section>
      )}
    </PageContainer>
  );
}

export default function JudicialOrderNewPage() {
  return (
    <Suspense
      fallback={
        <PageContainer dir="rtl" aria-label="در حال بارگذاری">
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-64 rounded bg-surface-container" />
            <div className="h-64 rounded-large bg-surface-container" />
          </div>
        </PageContainer>
      }
    >
      <OrderIntakePage />
    </Suspense>
  );
}
