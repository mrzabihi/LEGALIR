// ============================================================
// LEGALIR — Judicial drafting wizard (/judicial/[id])
// ============================================================
// The staged, resumable surface behind every link the /cases card and the
// launcher create. Six stages, each one backed by a real endpoint:
//
//   kind          → PATCH documentType (an explicit pick beats a suggestion)
//   narrative     → PATCH narrative  (the user's own words, never rewritten)
//   questionnaire → POST answers     (version-pinned, one schema step at a time)
//   documents     → POST documents / DELETE attachments (references, no copies)
//   analysis      → POST analysis    (derived, never stored)
//   review        → POST draft / PATCH draft / POST approve
//
// What this page deliberately does NOT have:
//   • no "send to court" action, because no such integration exists;
//   • no status the server did not set — every badge renders stored state;
//   • no invented legal text — a draft is either an assembly of the user's own
//     answers or explicitly labelled as model-refined.
//
// Resume is server-driven: `resumeStep` decides where an existing request lands,
// and each navigation persists the current step so a reload returns there.
// ============================================================

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Select, Textarea, snackbar } from "@legalir/ui";
import type {
  JudicialAnalysis,
  JudicialDocumentType,
  JudicialMissingField,
  JudicialRequestStep,
} from "@legalir/types";
import {
  JUDICIAL_DOCUMENT_TYPE_FA,
  JUDICIAL_REQUEST_STATUS_FA,
  JUDICIAL_STEP_FA,
} from "@legalir/types";
import {
  IconArrowBack,
  IconCheck,
  IconFilePen,
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
import { QuestionForm } from "@/components/judicial/wizard/question-form";
import { DocumentsPanel } from "@/components/judicial/wizard/documents-panel";
import { AnalysisPanel } from "@/components/judicial/wizard/analysis-panel";
import { ReviewPanel } from "@/components/judicial/wizard/review-panel";
import {
  useAnalyzeJudicialRequest,
  useGenerateJudicialDraft,
  useJudicialRequest,
  useUpdateJudicialRequest,
} from "@/hooks/useJudicial";
import { resumeStep } from "@/lib/judicial/schemas";
import { toPersianDate } from "@/lib/persian-utils";

/** The order the rail renders; `kind` is a picker, not prose. */
const STEP_ORDER: JudicialRequestStep[] = [
  "kind",
  "narrative",
  "questionnaire",
  "documents",
  "analysis",
  "review",
];

/** Every drafting family this wizard can produce — each has its own schema. */
const FAMILY_CHOICES: {
  value: JudicialDocumentType;
  hintFa: string;
}[] = [
  {
    value: "statement",
    hintFa: "برای اخطار رسمی و مطالبه از طرف مقابل، پیش از طرح دعوا",
  },
  {
    value: "brief",
    hintFa: "برای ارائهٔ دفاع، توضیح یا اعتراض در یک پروندهٔ باز",
  },
  {
    value: "petition",
    hintFa: "برای مطالبهٔ حق، الزام به انجام تعهد یا خسارت در مراجع حقوقی",
  },
  {
    value: "complaint",
    hintFa: "برای طرح شکایت از یک رفتار مجرمانه در مراجع کیفری",
  },
];

const STATUS_TONE: Partial<Record<string, StatusTone>> = {
  approved: "success",
  draft_ready: "success",
  ready_to_review: "success",
  needs_answers: "warning",
  needs_correction: "warning",
  cancelled: "neutral",
  archived: "neutral",
};

function apiCode(e: unknown): string | undefined {
  return e && typeof e === "object" && "code" in e
    ? String((e as { code: unknown }).code)
    : undefined;
}

function messageOf(e: unknown, fallback: string): string {
  return e && typeof e === "object" && "message" in e
    ? String((e as { message: unknown }).message)
    : fallback;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function Wizard({ id }: { id: string }) {
  const detailQuery = useJudicialRequest(id);
  const update = useUpdateJudicialRequest(id);
  const analyze = useAnalyzeJudicialRequest(id);
  const generate = useGenerateJudicialDraft(id);

  const [step, setStep] = useState<JudicialRequestStep | null>(null);
  const [narrative, setNarrative] = useState("");
  const [narrativeSeeded, setNarrativeSeeded] = useState(false);
  const [analysis, setAnalysis] = useState<JudicialAnalysis | null>(null);
  const [missing, setMissing] = useState<JudicialMissingField[]>([]);
  const [refusalFa, setRefusalFa] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [familyNotice, setFamilyNotice] = useState<string | null>(null);

  const detail = detailQuery.data;

  // Seed the local narrative once, then let the user edit freely. A refetch
  // never clobbers what they are typing.
  useEffect(() => {
    if (detail && !narrativeSeeded) {
      setNarrative(detail.request.narrative);
      setNarrativeSeeded(true);
    }
  }, [detail, narrativeSeeded]);

  // The landing step is derived from stored state, not from a guess.
  useEffect(() => {
    if (detail && step === null) {
      setStep(resumeStep(detail.request));
    }
  }, [detail, step]);

  // An error must be checked BEFORE the skeleton: a failed fetch never resolves
  // into data, so testing `!detail` first would spin forever.
  if (detailQuery.isError) {
    const notFound = apiCode(detailQuery.error) === "NOT_FOUND";
    return (
      <PageContainer dir="rtl">
        <div className="rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-6 text-center">
          <p className="text-titleSmall text-on-surface">
            {notFound ? "این درخواست در حساب شما یافت نشد." : "درخواست خوانده نشد."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/judicial"
              className="inline-flex items-center gap-1 text-labelLarge text-primary hover:underline"
            >
              بازگشت به فهرست درخواست‌ها
              <IconArrowBack size={16} />
            </Link>
            {!notFound && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => void detailQuery.refetch()}
                startIcon={<IconRefresh size={16} />}
              >
                تلاش مجدد
              </Button>
            )}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!detail || step === null) {
    return (
      <PageContainer dir="rtl" aria-label="در حال بارگذاری درخواست">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-surface-container" />
          <div className="h-4 w-96 rounded bg-surface-container" />
          <div className="h-11 w-full rounded-medium bg-surface-container" />
          <div className="h-64 rounded-large bg-surface-container" />
        </div>
      </PageContainer>
    );
  }

  const {
    request,
    questionnaire,
    attachments,
    drafts,
    completeness,
    linkableCases,
  } = detail;

  function go(next: JudicialRequestStep) {
    setStep(next);
    setError(null);
    // Persist the position so a reload resumes here. A failed write is not
    // worth blocking navigation — the step is a preference, not data.
    update.mutate({ currentStep: next });
  }

  async function chooseFamily(value: JudicialDocumentType | null) {
    setError(null);
    setFamilyNotice(null);
    try {
      await update.mutateAsync({ documentType: value });
      go("narrative");
    } catch (e) {
      setError(messageOf(e, "انتخاب نوع سند ناموفق بود."));
    }
  }

  async function saveNarrative() {
    setError(null);
    try {
      await update.mutateAsync({ narrative, currentStep: "questionnaire" });
      setStep("questionnaire");
    } catch (e) {
      setError(messageOf(e, "ذخیرهٔ روایت ناموفق بود."));
    }
  }

  async function linkCase(caseId: string) {
    setError(null);
    try {
      await update.mutateAsync({ caseId: caseId || null });
    } catch (e) {
      setError(messageOf(e, "اتصال پرونده ناموفق بود."));
    }
  }

  async function runAnalysis() {
    setError(null);
    setRefusalFa(null);
    try {
      const result = await analyze.mutateAsync();
      setAnalysis(result.analysis);
      setMissing([]);
    } catch (e) {
      setError(messageOf(e, "جمع‌بندی انجام نشد."));
      if (apiCode(e) === "TYPE_UNDETERMINED") setFamilyNotice(messageOf(e, ""));
    }
  }

  async function buildDraft() {
    setError(null);
    setRefusalFa(null);
    setMissing([]);
    try {
      // One key per logical attempt: a retry of THIS click returns the same
      // version and charges nothing, while a changed input is a new version.
      await generate.mutateAsync(crypto.randomUUID());
      setStep("review");
      snackbar.show({ message: "پیش‌نویس ساخته شد.", variant: "success" });
    } catch (e) {
      const message = messageOf(e, "ساخت پیش‌نویس ناموفق بود.");
      setRefusalFa(message);
      if (apiCode(e) === "INCOMPLETE_INPUTS") {
        const payload = e as { missing?: JudicialMissingField[] };
        setMissing(payload.missing ?? completeness.missing);
      }
    }
  }

  const hints: Partial<Record<JudicialRequestStep, string>> = {
    kind: request.documentType
      ? `نوع انتخاب‌شده: ${JUDICIAL_DOCUMENT_TYPE_FA[request.documentType]}`
      : "هنوز نوع سند انتخاب نشده است.",
    narrative: request.narrative
      ? `آخرین ذخیره: ${toPersianDate(request.narrativeUpdatedAt ?? request.updatedAt)}`
      : "هنوز روایتی ذخیره نشده است.",
    questionnaire: `${Object.keys(
      request.answers
    ).length.toLocaleString("fa-IR")} پاسخ ثبت شده است.`,
    documents: `${attachments.length.toLocaleString("fa-IR")} مدرک پیوست شده است.`,
    analysis: completeness.complete
      ? "اطلاعات ضروری کامل است."
      : `${completeness.missing.length.toLocaleString("fa-IR")} مورد هنوز ناقص است.`,
    review: drafts.length
      ? `${drafts.length.toLocaleString("fa-IR")} نسخهٔ پیش‌نویس`
      : "هنوز پیش‌نویسی ساخته نشده است.",
  };

  return (
    <PageContainer dir="rtl">
      <CompactPageHeader
        title={request.titleFa}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={JUDICIAL_REQUEST_STATUS_FA[request.status]}
              tone={STATUS_TONE[request.status] ?? "info"}
              dot={false}
            />
            <span>
              {request.documentType
                ? JUDICIAL_DOCUMENT_TYPE_FA[request.documentType]
                : "نوع سند نامشخص"}
              {" · "}
              آخرین به‌روزرسانی {toPersianDate(request.updatedAt)}
            </span>
          </span>
        }
        breadcrumb={[
          { label: "پرونده‌ها", href: "/cases" },
          { label: "تنظیم دادخواست و شکواییه", href: "/judicial" },
          { label: request.titleFa },
        ]}
        actions={
          <Link
            href="/judicial"
            className="inline-flex items-center gap-1 text-labelLarge text-primary hover:underline"
          >
            بازگشت به فهرست
            <IconArrowBack size={16} />
          </Link>
        }
      />

      {/* Step rail — the stored step is marked, every stage stays reachable. */}
      <nav aria-label="مراحل تنظیم" className="mt-4 overflow-x-auto">
        <ol className="flex min-w-max items-center gap-1.5">
          {STEP_ORDER.map((s, index) => {
            const active = step === s;
            return (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => go(s)}
                  aria-current={active ? "step" : undefined}
                  className={[
                    "flex items-center gap-1.5 rounded-full border px-3 py-2 text-labelSmall transition-colors",
                    active
                      ? "border-primary bg-primary-container text-on-primary-container"
                      : "border-[color:var(--color-outline-variant)] bg-surface text-on-surface-variant hover:border-primary",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-caption",
                      active
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container text-on-surface-variant",
                    ].join(" ")}
                  >
                    {(index + 1).toLocaleString("fa-IR")}
                  </span>
                  {JUDICIAL_STEP_FA[s]}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {hints[step] && (
        <p className="mt-2 text-caption text-on-surface-variant">{hints[step]}</p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-medium bg-error-container px-3 py-2 text-body-2 text-on-surface"
        >
          {error}
        </p>
      )}

      <div className="mt-4">
        {/* 0 — kind */}
        {step === "kind" && (
          <section
            aria-labelledby="judicial-kind-title"
            className="rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5"
          >
            <h2
              id="judicial-kind-title"
              className="text-titleMedium text-on-surface"
            >
              این درخواست برای چه چیزی است؟
            </h2>
            <p className="mt-1 text-body-2 leading-6 text-on-surface-variant">
              اگر مطمئن نیستید، «نمی‌دانم» را انتخاب کنید؛ بر اساس توضیح شما یک
              مسیر احتمالی پیشنهاد می‌شود و تصمیم نهایی با خودتان است.
            </p>

            {Object.keys(request.answers).length > 0 && (
              <p className="mt-3 rounded-medium bg-warning-50 px-3 py-2 text-caption leading-6 text-warning-700">
                با تغییر نوع سند، پاسخ‌های پرسش‌نامهٔ نوع قبلی پاک می‌شوند، چون به
                ساختار همان نوع تعلق دارند.
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 tablet:grid-cols-3">
              {FAMILY_CHOICES.map((choice) => {
                const selected = request.documentType === choice.value;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => void chooseFamily(choice.value)}
                    aria-pressed={selected}
                    disabled={update.isPending}
                    className={[
                      "rounded-medium border p-3 text-start transition-colors",
                      selected
                        ? "border-primary bg-primary-container"
                        : "border-[color:var(--color-outline-variant)] bg-surface hover:border-primary",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-1.5 text-labelLarge text-on-surface">
                      {selected && <IconCheck size={16} className="text-primary" />}
                      {JUDICIAL_DOCUMENT_TYPE_FA[choice.value]}
                    </span>
                    <span className="mt-0.5 block text-caption leading-6 text-on-surface-variant">
                      {choice.hintFa}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => void chooseFamily(null)}
                aria-pressed={request.documentType === null}
                disabled={update.isPending}
                className={[
                  "rounded-medium border p-3 text-start transition-colors",
                  request.documentType === null
                    ? "border-primary bg-primary-container"
                    : "border-[color:var(--color-outline-variant)] bg-surface hover:border-primary",
                ].join(" ")}
              >
                <span className="block text-labelLarge text-on-surface">
                  نمی‌دانم کدام درست است
                </span>
                <span className="mt-0.5 block text-caption leading-6 text-on-surface-variant">
                  توضیح می‌دهید و مسیر احتمالی پیشنهاد می‌شود
                </span>
              </button>
            </div>

            {request.routing && request.routing.suggested !== "undetermined" && (
              <div className="mt-4 rounded-medium bg-surface-container-low p-3">
                <p className="flex flex-wrap items-center gap-2 text-labelLarge text-on-surface">
                  مسیر پیشنهادی (غیرقطعی):
                  <span>{JUDICIAL_DOCUMENT_TYPE_FA[request.routing.suggested]}</span>
                  {request.routing.basis === "user_choice" && (
                    <span className="text-caption text-on-surface-variant">
                      انتخاب خودتان
                    </span>
                  )}
                </p>
                <p className="mt-1 text-caption leading-6 text-on-surface-variant">
                  {request.routing.reasonFa}
                </p>
                {request.routing.needsClarification &&
                  request.routing.clarificationFa && (
                    <p className="mt-1 flex items-start gap-1.5 text-caption leading-6 text-warning-700">
                      <IconWarning size={14} className="mt-1 shrink-0" />
                      {request.routing.clarificationFa}
                    </p>
                  )}
              </div>
            )}

            <p className="mt-4 flex items-start gap-1.5 text-caption leading-6 text-on-surface-variant">
              <IconInfo size={14} className="mt-1 shrink-0" />
              انتخاب نوع سند یعنی انتخاب پرسش‌نامه و قالب پیش‌نویس؛ به‌معنای تشخیص
              قطعی مرجع صالح یا ثبت در مرجع قضایی نیست.
            </p>
          </section>
        )}

        {/* 1 — narrative */}
        {step === "narrative" && (
          <section
            aria-labelledby="judicial-narrative-title"
            className="rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5"
          >
            <h2
              id="judicial-narrative-title"
              className="text-titleMedium text-on-surface"
            >
              موضوع را به زبان خودتان توضیح دهید
            </h2>
            <p className="mt-1 text-body-2 leading-6 text-on-surface-variant">
              چه اتفاقی افتاده، چه نتیجه‌ای می‌خواهید، چه زمانی رخ داده، طرف
              مقابل چه کسی است و چه مدرکی دارید. متن شما بدون اجازهٔ شما تغییر
              نمی‌کند.
            </p>

            {familyNotice && (
              <p className="mt-3 rounded-medium bg-warning-50 px-3 py-2 text-caption leading-6 text-warning-700">
                {familyNotice}
              </p>
            )}

            <div className="mt-4">
              <Textarea
                label="شرح موضوع"
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={8}
                fullWidth
                maxLength={20_000}
                showCharCount
                placeholder="مثلاً: یک قرارداد اجاره دارم که مستأجر دو ماه است اجاره را پرداخت نکرده…"
                supportingText="هرچه دقیق‌تر بنویسید، پرسش‌های بعدی کمتر می‌شود."
              />
            </div>

            {linkableCases.length > 0 && (
              <div className="mt-4 max-w-sm">
                <Select
                  label="اتصال به یکی از پرونده‌های من (اختیاری)"
                  value={request.caseId ?? ""}
                  onChange={(e) => void linkCase(e.target.value)}
                  fullWidth
                  options={[
                    { value: "", label: "بدون اتصال" },
                    ...linkableCases.map((c) => ({
                      value: c.id,
                      label: c.internalRef
                        ? `${c.titleFa} (${c.internalRef})`
                        : c.titleFa,
                    })),
                  ]}
                  supportingText="اتصال، داده‌های پرونده را در دسترس این درخواست قرار می‌دهد؛ وضعیت پرونده تغییر نمی‌کند."
                />
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => void saveNarrative()}
                loading={update.isPending}
                disabled={!narrative.trim()}
                startIcon={<IconFilePen size={16} />}
              >
                ذخیره و ادامه
              </Button>
              <Button variant="text" onClick={() => go("kind")}>
                مرحلهٔ قبل
              </Button>
            </div>
          </section>
        )}

        {/* 2 — questionnaire */}
        {step === "questionnaire" && (
          <QuestionForm
            key={`${questionnaire.id}:${questionnaire.version}`}
            requestId={id}
            questionnaire={questionnaire}
            initialAnswers={request.answers}
            completeness={completeness}
            onDone={() => go("documents")}
            onReload={() => void detailQuery.refetch()}
            onRevisitKind={() => go("kind")}
          />
        )}

        {/* 3 — documents */}
        {step === "documents" && (
          <DocumentsPanel
            requestId={id}
            readyDocumentPath={request.startMode === "ready_document"}
            readyDocument={request.readyDocument}
            onContinue={() => go("analysis")}
          />
        )}

        {/* 4 — analysis */}
        {step === "analysis" && (
          <AnalysisPanel
            analysis={analysis ?? detail.analysis}
            completeness={completeness}
            missing={missing}
            generating={generate.isPending}
            analyzing={analyze.isPending}
            refusalFa={refusalFa}
            onAnalyze={() => void runAnalysis()}
            onGenerate={() => void buildDraft()}
            onFixAnswers={() => go("questionnaire")}
          />
        )}

        {/* 5 — review */}
        {step === "review" && (
          <ReviewPanel
            requestId={id}
            request={request}
            completeness={completeness}
            initialDrafts={drafts}
            readyDocumentPath={request.startMode === "ready_document"}
            readyDocument={request.readyDocument}
            onGenerateMore={() => void buildDraft()}
            onFixAnswers={() => go("questionnaire")}
            onBackToAnalysis={() => go("analysis")}
          />
        )}
      </div>

      {/* The honest footer — always present, never buried in prose. */}
      <p className="mt-6 flex items-start gap-1.5 rounded-medium bg-surface-container-low px-3 py-2 text-caption leading-6 text-on-surface-variant">
        <IconInfo size={14} className="mt-1 shrink-0" />
        لیگالیر هیچ سندی را برای شما ثبت، ارسال یا ابلاغ نمی‌کند و این درخواست
        جایگزین بررسی حقوقی توسط وکیل نیست.
      </p>
    </PageContainer>
  );
}

export default function JudicialWizardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <Wizard key={id} id={id} />;
}
