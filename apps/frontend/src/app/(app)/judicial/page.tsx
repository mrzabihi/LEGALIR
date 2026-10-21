// ============================================================
// LEGALIR — Judicial drafting launcher (/judicial)
// ============================================================
// The route the /cases card's CTA points at. It is a launcher, not a wizard:
//
//   1. the caller's unfinished requests, resumable where they stopped;
//   2. a short start form — what kind of document, a plain-language
//      description, and the start path;
//   3. the honest note that nothing here files or sends anything.
//
// Nothing is created until the user presses the start button, so browsing this
// page leaves no empty rows behind. Availability is re-read from the server on
// every load — the UI never asserts a status on its own.
// ============================================================

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Textarea, Select, snackbar } from "@legalir/ui";
import {
  JUDICIAL_DOCUMENT_TYPE_FA,
  JUDICIAL_REQUEST_STATUS_FA,
  JUDICIAL_STATUS_FA,
} from "@legalir/types";
import type {
  JudicialDocumentType,
  JudicialRequestSummary,
  JudicialServiceId,
} from "@legalir/types";
import {
  IconArrowBack,
  IconFilePen,
  IconInfo,
  IconRefresh,
  IconWarning,
} from "@/lib/icons";
import {
  CompactPageHeader,
  PageContainer,
  StatusBadge,
} from "@/components/shared";
import {
  useCreateJudicialRequest,
  useJudicialCard,
  useJudicialRequests,
  useJudicialServices,
} from "@/hooks/useJudicial";
import { isJudicialEntryQuery } from "@/lib/judicial/entry";
import {
  JUDICIAL_FAMILY_DESCRIPTION_FA,
  JUDICIAL_FAMILY_EYEBROW_FA,
  JUDICIAL_FAMILY_TITLE_FA,
  JUDICIAL_STATUS_TONE,
} from "@/lib/judicial/identity";
import { toPersianDate } from "@/lib/persian-utils";

/** Every drafting family this surface can start, plus "help me decide". */
const START_TYPES: { value: JudicialDocumentType | "unknown"; labelFa: string; hintFa: string }[] = [
  {
    value: "statement",
    labelFa: JUDICIAL_DOCUMENT_TYPE_FA.statement,
    hintFa: "برای اخطار رسمی و مطالبه از طرف مقابل، پیش از طرح دعوا",
  },
  {
    value: "brief",
    labelFa: JUDICIAL_DOCUMENT_TYPE_FA.brief,
    hintFa: "برای ارائهٔ دفاع، توضیح یا اعتراض در یک پروندهٔ باز",
  },
  {
    value: "petition",
    labelFa: JUDICIAL_DOCUMENT_TYPE_FA.petition,
    hintFa: "برای مطالبهٔ حق، الزام به انجام تعهد یا خسارت در مراجع حقوقی",
  },
  {
    value: "complaint",
    labelFa: JUDICIAL_DOCUMENT_TYPE_FA.complaint,
    hintFa: "برای طرح شکایت از یک رفتار مجرمانه در مراجع کیفری",
  },
  {
    value: "unknown",
    labelFa: "نمی‌دانم کدام درست است",
    hintFa: "شرح موضوع را می‌نویسید و مسیر احتمالی پیشنهاد می‌شود",
  },
];

const SERVICE_FOR_TYPE: Record<JudicialDocumentType | "unknown", JudicialServiceId> = {
  petition: "judicial_petition",
  complaint: "judicial_complaint",
  statement: "judicial_statement",
  brief: "judicial_brief",
  unknown: "judicial_petition",
};

function ResumeRow({ request }: { request: JudicialRequestSummary }) {
  return (
    <article className="flex flex-col gap-2 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-3 tablet:flex-row tablet:items-center tablet:justify-between tablet:p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 truncate text-labelLarge text-on-surface">
            {request.titleFa}
          </span>
          <StatusBadge
            label={JUDICIAL_REQUEST_STATUS_FA[request.status]}
            tone={request.hasApprovedDraft ? "success" : "info"}
            dot={false}
          />
        </div>
        <p className="mt-1 text-caption text-on-surface-variant">
          آخرین به‌روزرسانی: {toPersianDate(request.updatedAt)}
          {request.draftCount > 0
            ? ` · ${request.draftCount.toLocaleString("fa-IR")} پیش‌نویس`
            : ""}
          {request.documentCount > 0
            ? ` · ${request.documentCount.toLocaleString("fa-IR")} مدرک پیوست`
            : ""}
        </p>
      </div>
      <Link
        href={`/judicial/${request.id}`}
        className="inline-flex shrink-0 items-center gap-1 text-labelLarge text-primary hover:underline"
      >
        ادامه
        <IconArrowBack size={16} />
      </Link>
    </article>
  );
}

function JudicialLauncher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const card = useJudicialCard();
  const services = useJudicialServices();
  const requests = useJudicialRequests();
  const create = useCreateJudicialRequest();

  // Entry links from the discovery surfaces carry the family in the query
  // (`/judicial?type=complaint`). Only the four real families are accepted —
  // the value is untrusted URL state, so anything else falls back to the
  // default rather than pre-selecting a service that cannot start.
  //
  // The bare route IS the declaration entry: every «تولید اظهارنامه» card
  // links here without a query, so it must preselect the اظهارنامه family.
  // The /cases family card names its family explicitly (`?type=petition`).
  const requestedType = searchParams.get("type");
  const initialKind: JudicialDocumentType | "unknown" = isJudicialEntryQuery(requestedType)
    ? requestedType
    : "statement";

  const [kind, setKind] = useState<JudicialDocumentType | "unknown">(initialKind);
  const [narrative, setNarrative] = useState("");
  const [startMode, setStartMode] = useState<"ai_draft" | "ready_document">("ai_draft");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = card.data?.summary;
  const capabilities = card.data?.capabilities;

  // The family shell names the page; the SELECTED document type names the
  // form. Reading the chosen service's own row is what keeps an اظهارنامه
  // request from being described with the دادخواست copy — and what keeps its
  // availability honest when only that one family is switched off.
  const kindService = services.data?.items.find((s) => s.id === SERVICE_FOR_TYPE[kind]);
  const enabled = kindService
    ? kindService.availability === "available"
    : (summary?.availability.enabled ?? false);
  // No fallback to the family `settings.descriptionFa`: that string describes the
  // family, which the page header already says. Falling back to it made the
  // form print a second, near-identical sentence a paint after load — visible
  // as a 48 px line appearing under the form heading and pushing the form
  // down (see the `availabilityKnown` note below).
  const kindDescriptionFa = kindService?.descriptionFa ?? JUDICIAL_FAMILY_DESCRIPTION_FA;

  // Availability may only be *stated* once the selected kind's own row has
  // been read. Before that the old code spoke anyway — it fell back to the
  // card summary, whose `enabled` is false until the service row is merged in,
  // so the page asserted "not available", then took it back a paint later.
  // Two answers, two paints: the availability note and the "the start button
  // is disabled" line appeared and vanished, taking everything below them
  // with them (measured 0.41 CLS at 390 px). The button stays inert until the
  // answer is real — it just no longer narrates a state it does not know.
  const availabilityKnown = Boolean(kindService) || services.isSuccess;

  // The declaration is its own service with its own entry point, so the page
  // must name it with its own words. Every other family keeps the shared
  // «دادخواست و شکواییه» shell the /cases card uses — never the reverse, or a
  // declaration visitor would be told they are filing a petition.
  const headerTitleFa =
    kind === "statement"
      ? (kindService?.titleFa ?? JUDICIAL_FAMILY_TITLE_FA)
      : JUDICIAL_FAMILY_TITLE_FA;
  const headerDescriptionFa =
    kind === "statement"
      ? (kindService?.descriptionFa ?? JUDICIAL_FAMILY_DESCRIPTION_FA)
      : JUDICIAL_FAMILY_DESCRIPTION_FA;

  const openRequests = (requests.data?.items ?? []).filter(
    (r) => r.status !== "archived" && r.status !== "cancelled"
  );

  async function start() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const { request } = await create.mutateAsync({
        serviceId: SERVICE_FOR_TYPE[kind],
        startMode,
        documentType: kind === "unknown" ? null : kind,
        narrative: narrative.trim(),
        // One key per logical attempt; a retry of THIS click returns the same
        // request instead of creating a second one.
        idempotencyKey: crypto.randomUUID(),
      });
      router.push(`/judicial/${request.id}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "شروع درخواست ناموفق بود";
      setError(message);
      snackbar.show({ message, variant: "error" });
      setBusy(false);
    }
  }

  return (
    <PageContainer dir="rtl">
      {/* The availability chip used to ride in the header's title row. It is
          written by the same two queries that rename the title, so it never
          appeared in the first paint: the long family title fitted on one line
          alone, then wrapped the moment the chip arrived, then un-wrapped when
          the service's own (shorter) title replaced it — a 34 px jump down and
          back up. Here it sits beside the heading of the block it actually
          gates, on a row that is the chip's own height in every state. */}
      <CompactPageHeader
        eyebrow={JUDICIAL_FAMILY_EYEBROW_FA}
        title={headerTitleFa}
        description={headerDescriptionFa}
        breadcrumb={[{ label: "پرونده‌ها", href: "/cases" }, { label: "تنظیم دادخواست و شکواییه" }]}
        actions={
          <Link
            href="/cases"
            className="inline-flex items-center gap-1 text-labelLarge text-primary hover:underline"
          >
            بازگشت به پرونده‌ها
            <IconArrowBack size={16} />
          </Link>
        }
      />

      {/* Availability — read from the server; never asserted here. */}
      {card.isError && (
        <div className="mt-4 flex flex-col gap-2 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-4">
          <p className="flex items-center gap-2 text-body-2 text-on-surface">
            <IconWarning size={18} className="text-warning" />
            وضعیت این خدمت خوانده نشد.
          </p>
          <Button
            variant="outlined"
            size="small"
            onClick={() => void card.refetch()}
            startIcon={<IconRefresh size={16} />}
            className="self-start"
          >
            تلاش مجدد
          </Button>
        </div>
      )}

      {/* While the service state is still loading there is no page-level
          placeholder: the start form below renders immediately and is already
          inert (`fieldset disabled`, button disabled), so it IS the loading
          state. A pair of generic blocks used to sit here instead — 364 px of
          placeholder above a ~900 px form — and they vanished the moment the
          query resolved, taking the form up with them (measured CLS 0.37 on a
          390 px viewport, past the 0.25 "poor" boundary).
          Only the availability note is reserved, because it is the one thing
          that genuinely arrives late. */}
      {capabilities ? (
        <p className="mt-4 flex items-start gap-2 rounded-medium bg-surface-container-low px-3 py-2 text-caption leading-6 text-on-surface-variant">
          <IconInfo size={15} className="mt-0.5 shrink-0" />
          {capabilities.filingNoteFa}
        </p>
      ) : (
        // Two bars below `tablet`, one above it — the same `leading-6` lines
        // the note wraps to at each width, plus the note's own `py-2`. A flat
        // `min-h-[64px]` matched the phone but left a 24 px gap on desktop,
        // which is exactly the jump it was meant to remove.
        <p
          aria-hidden="true"
          className="mt-4 animate-pulse rounded-medium bg-surface-container-low px-3 py-2"
        >
          <span className="block h-6 rounded bg-surface-container" />
          <span className="block h-6 rounded bg-surface-container tablet:hidden" />
        </p>
      )}

      {/* Resume list — the caller's own unfinished work. */}
      {openRequests.length > 0 && (
        <section aria-labelledby="judicial-resume-title" className="mt-6">
          <h2 id="judicial-resume-title" className="mb-2 text-titleSmall text-on-surface">
            درخواست‌های در جریان
          </h2>
          <div className="space-y-2.5">
            {openRequests.map((r) => (
              <ResumeRow key={r.id} request={r} />
            ))}
          </div>
        </section>
      )}

      {/* Start form */}
      <section
        aria-labelledby="judicial-start-title"
        className="mt-6 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5"
      >
        {/* The chip and the heading are both 26 px, so this row is the same
            height whether or not availability has been read yet. */}
        <div className="flex min-h-[26px] flex-wrap items-center gap-2">
          <h2 id="judicial-start-title" className="text-titleMedium text-on-surface">
            درخواست جدید
          </h2>
          {kindService && (
            <StatusBadge
              label={JUDICIAL_STATUS_FA[kindService.availability]}
              tone={JUDICIAL_STATUS_TONE[kindService.status]}
              dot={false}
            />
          )}
        </div>
        {/* The declaration already explains itself in the page header; a
            second identical line would just repeat it. */}
        {kindDescriptionFa !== headerDescriptionFa && (
          <p className="mt-1 text-body-2 text-on-surface-variant">{kindDescriptionFa}</p>
        )}

        {availabilityKnown && !enabled && (
          <p className="mt-3 rounded-medium bg-surface-container px-3 py-2 text-caption leading-6 text-on-surface-variant">
            {card.data?.summary.availability.noteFa ??
              "این خدمت در حال حاضر برای حساب شما فعال نیست. پس از فعال شدن، از همین صفحه می‌توانید شروع کنید."}
          </p>
        )}

        <fieldset className="mt-4" disabled={!enabled || busy}>
          <legend className="mb-2 text-labelLarge text-on-surface">
            این درخواست برای چه چیزی است؟
          </legend>
          <div className="grid grid-cols-1 gap-2 tablet:grid-cols-3">
            {START_TYPES.map((t) => {
              const selected = kind === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setKind(t.value)}
                  aria-pressed={selected}
                  className={[
                    "rounded-medium border p-3 text-start transition-colors",
                    selected
                      ? "border-primary bg-primary-container"
                      : "border-[color:var(--color-outline-variant)] bg-surface hover:border-primary",
                  ].join(" ")}
                >
                  <span className="block text-labelLarge text-on-surface">{t.labelFa}</span>
                  <span className="mt-0.5 block text-caption leading-6 text-on-surface-variant">
                    {t.hintFa}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <Textarea
              label="موضوع را به زبان خودتان توضیح دهید"
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={5}
              fullWidth
              maxLength={20_000}
              supportingText="هرچه دقیق‌تر بنویسید، پرسش‌های بعدی کمتر و پیش‌نویس نزدیک‌تر به واقعیت خواهد بود. این متن بدون اجازهٔ شما تغییر نمی‌کند."
              placeholder="مثلاً: یک قرارداد اجاره دارم که مستأجر دو ماه است اجاره را پرداخت نکرده…"
            />
          </div>

          <div className="mt-4 max-w-sm">
            <Select
              label="روش شروع"
              value={startMode}
              onChange={(e) =>
                setStartMode(e.target.value as "ai_draft" | "ready_document")
              }
              fullWidth
              options={[
                { value: "ai_draft", label: "پیش‌نویس از پاسخ‌های من ساخته شود" },
                { value: "ready_document", label: "سند آماده‌ام را ثبت و بازبینی می‌کنم" },
              ]}
              supportingText={
                startMode === "ready_document"
                  ? "در این مسیر هیچ متنی توسط لیگالیر تولید نمی‌شود؛ سند خودتان را ثبت و در برابر پاسخ‌ها بازبینی می‌کنید."
                  : "پیش‌نویس پس از تکمیل اطلاعات لازم ساخته می‌شود و تا بازبینی شما فقط پیش‌نویس است."
              }
            />
          </div>
        </fieldset>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-medium bg-error-container px-3 py-2 text-body-2 text-on-surface"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => void start()}
            disabled={!enabled}
            loading={busy}
            startIcon={<IconFilePen size={18} />}
          >
            شروع تنظیم
          </Button>
          {availabilityKnown && !enabled && (
            <span className="text-caption text-on-surface-variant">
              تا فعال شدن خدمت، دکمهٔ شروع غیرفعال است.
            </span>
          )}
        </div>
      </section>
    </PageContainer>
  );
}

/** `useSearchParams` needs a Suspense boundary in the App Router. */
export default function JudicialLauncherPage() {
  return (
    <Suspense
      fallback={
        <PageContainer dir="rtl" aria-label="در حال بارگذاری">
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-64 rounded bg-surface-container" />
            <div className="h-24 rounded-large bg-surface-container" />
            <div className="h-64 rounded-large bg-surface-container" />
          </div>
        </PageContainer>
      }
    >
      <JudicialLauncher />
    </Suspense>
  );
}
