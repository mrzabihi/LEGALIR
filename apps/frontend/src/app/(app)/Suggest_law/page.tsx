// ============================================================
// LEGALIR — /Suggest_law «پیشنهاد مسیر حقوقی»
// ============================================================
// The page that continues the smart intake from /new. Instead of jumping
// straight into a service, it first shows HOW LEGALIR understood the request
// and which REAL, currently-enabled routes it can offer — then lets the user
// correct the understanding or pick a path.
//
// It is the CLIENT half of the discovery flow. The understanding is produced
// by the server engine (`POST /api/v1/intake/analyze`) and persisted as a real
// DRAFT `LegalRequest` (via `useDiscoveryFlow`), so:
//   • the flow is resumable and visible in the user's history / the admin panel;
//   • the description is never lost — the server degrades to a deterministic
//     rules analysis whenever the model is off/unavailable/invalid, and while
//     that call is in flight the client shows an instant, deterministic hint;
//   • the summary separates what the USER stated from what the SYSTEM inferred,
//     and is correctable in place (no silent data loss);
//   • nothing is fabricated: every path is a real, capability-enabled route,
//     and the page points at existing flows only — no legal answer, no article.
//
// The request itself is handed over from /new through a guarded localStorage
// draft (never a query string), so a description or document name can never
// end up in the URL, history or server logs.
// ============================================================

"use client";

import { useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SelectableOption, Textarea, Button } from "@legalir/ui";
import { useCapabilities, capabilityEnabled } from "@/hooks/useCapabilities";
import { useDailyQuota } from "@/hooks/useDashboard";
import { useDiscoveryFlow, type DiscoverySaveState } from "@/hooks/useDiscovery";
import { getServiceContext } from "@/lib/ai/service-context";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IconArrowBack,
  IconCalculator,
  IconChat,
  IconCheck,
  IconEdit,
  IconFileSearch,
  IconFilePen,
  IconFile,
  IconGavel,
  IconHandshake,
  IconInfo,
  IconRefresh,
  IconWarning,
} from "@/lib/icons";
import {
  INTAKE_CATEGORY_CHOICES,
  INTAKE_INTENT_OPTIONS,
  buildConsultationDraft,
  categoryLabel,
  describeDestination,
  destinationHref,
  resolveDestination,
  writeConsultationDraft,
  type IntakeDestination,
  type IntakeIntent,
} from "@/lib/intake/start-request";
import type { LegalRequestDiscoveryPath } from "@legalir/types";
import type { IconComponent } from "@/lib/services/catalog";

// ---------------------------------------------------------------------------
// Presentation maps — deterministic, no legal claims
// ---------------------------------------------------------------------------

const INTENT_ICON: Record<IntakeIntent, IconComponent> = {
  legal_question: IconChat,
  document_review: IconFileSearch,
  draft_document: IconFilePen,
  calculation: IconCalculator,
  next_step: IconGavel,
  lawyer: IconHandshake,
};

/** What the destination needs from the user before it can run. */
function neededFa(intent: IntakeIntent, hasDoc: boolean): string {
  switch (intent) {
    case "document_review":
      return hasDoc ? "سند پیوست انتخاب شده و آمادهٔ تحلیل است." : "باید یک سند بارگذاری یا انتخاب کنی.";
    case "draft_document":
      return "نوع سند و پاسخ به چند پرسش کوتاه لازم است.";
    case "calculation":
      return "مبلغ و نوع محاسبه را داخل خودِ محاسبه‌گر وارد می‌کنی.";
    case "lawyer":
      return "شرح موضوع؛ سپس یک وکیل از فهرست انتخاب می‌کنی.";
    case "next_step":
      return "چیز خاصی لازم نیست؛ فهرست کارهای بازت نمایش داده می‌شود.";
    default:
      return hasDoc ? "شرح و سند پیوست آماده است." : "فقط شرح موضوع؛ می‌توانی سند هم اضافه کنی.";
  }
}

/** The third step of the guide, named after the chosen capability. */
const STEP_ACTION_FA: Record<IntakeIntent, string> = {
  legal_question: "گفت‌وگوی حقوقی",
  document_review: "تحلیل سند",
  draft_document: "تنظیم سند",
  calculation: "محاسبه",
  next_step: "مرور پرونده‌ها",
  lawyer: "مشاوره با وکیل",
};

function intentTitle(intent: IntakeIntent): string {
  return INTAKE_INTENT_OPTIONS.find((o) => o.id === intent)?.titleFa ?? "مسیر پیشنهادی";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SuggestLawPage() {
  const router = useRouter();
  const caps = useCapabilities();
  const { data: quota } = useDailyQuota();

  // The real, admin-managed capability gate. It feeds both the instant client
  // hint and the "which services are offered" states below.
  const isEnabled = useCallback(
    (key: string) => capabilityEnabled(caps.data, key),
    [caps.data]
  );

  const {
    seeded,
    hasRequest,
    draft,
    text,
    intent,
    category,
    documentName,
    editing,
    setEditing,
    setText,
    setIntent,
    setCategory,
    analysis: serverAnalysis,
    isAnalyzing,
    analysisError,
    reanalyze,
    hint,
    requestId,
    saveState,
    choosePath,
  } = useDiscoveryFlow(isEnabled);

  // The full attached document (id/name/mime/size) is needed to carry the file
  // forward to the destination via the same params those flows already accept.
  const document = draft?.document ?? null;
  const hasDoc = document !== null;

  // The resolved understanding: the server analysis once it lands, otherwise the
  // instant deterministic hint. Both share the exact same shape.
  const analysis = serverAnalysis ?? hint;
  const paths = analysis.paths;
  const primary = paths[0] ?? null;
  const alternatives = paths.slice(1);

  // We are still waiting for the first real answer when no path is known yet
  // and either the analysis or the capability set is still in flight.
  const awaitingCapabilities = caps.isLoading && !caps.data;
  const showLoading = paths.length === 0 && (isAnalyzing || awaitingCapabilities);

  const goToNew = () => router.push("/new");
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/new");
  };

  const destFor = useCallback(
    (i: IntakeIntent): IntakeDestination =>
      resolveDestination({
        intent: i,
        text,
        documentId: document?.id ?? null,
        category,
      }),
    [text, document, category]
  );

  const handleGo = useCallback(
    (chosenIntent: IntakeIntent, dest: IntakeDestination) => {
      // Record the pick on the persisted draft (best-effort) so the choice is
      // visible in history and the admin panel.
      choosePath(chosenIntent);
      // The consultation wizard reads its OWN localStorage draft (the same key
      // the intake panel writes), so the description/area/attachment arrive
      // pre-filled without re-entry.
      if (dest.kind === "consultation_wizard") {
        writeConsultationDraft(
          buildConsultationDraft({
            text,
            category: dest.category,
            attachmentIds: document ? [document.id] : [],
          })
        );
      }
      router.push(destinationHref(dest, { text, document }));
    },
    [choosePath, router, text, document]
  );

  const retry = useCallback(() => {
    if (caps.isError) caps.refetch();
    reanalyze();
  }, [caps, reanalyze]);

  // ============================================================
  // Render states
  // ============================================================

  return (
    <div className="mx-auto max-w-3xl p-4 tablet:p-6" dir="rtl">
      {/* Header — a back affordance, the page title and the standing caution. */}
      <div className="mb-5">
        <button
          type="button"
          onClick={goBack}
          className="mb-3 inline-flex items-center gap-1.5 rounded-medium px-2 py-1 text-labelMedium text-muted transition hover:bg-surface-hover hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-target"
        >
          <IconArrowBack size={16} />
          بازگشت
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-h2 text-on-surface">پیشنهاد مسیر حقوقی</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-0.5 text-caption font-medium text-muted">
            <IconInfo size={13} />
            پیشنهاد اولیه
          </span>
        </div>
        <p className="mt-1.5 text-bodyMedium text-muted">
          بر اساس آنچه نوشتی، مسیر مناسب را پیشنهاد می‌کنیم. در این مرحله هیچ تحلیل حقوقی‌ای ساخته
          نمی‌شود و هیچ ماده یا منبعی استناد نمی‌گردد؛ استنادها فقط داخل خودِ سرویس می‌آیند.
        </p>
      </div>

      {!seeded ? (
        <LoadingSkeleton />
      ) : !hasRequest ? (
        <NoRequestState onStart={goToNew} />
      ) : (
        <div className="space-y-5">
          {/* 1 — Summary: stated vs inferred, correctable in place. */}
          <SummaryCard
            text={text}
            documentName={documentName}
            explicitIntent={intent}
            explicitCategory={category}
            inferredCategory={analysis.inferredCategory}
            goalFa={analysis.goalFa}
            summaryFa={analysis.summaryFa}
            source={analysis.source}
            confidence={analysis.confidence}
            needsLawyer={analysis.needsLawyer}
            ambiguities={analysis.ambiguitiesFa}
            editing={editing}
            onToggleEdit={() => setEditing(!editing)}
            onEditFields={
              <EditFields
                text={text}
                intent={intent}
                category={category}
                onText={setText}
                onIntent={setIntent}
                onCategory={setCategory}
              />
            }
          />

          {/* 2 — Capability-gated, server-analysed suggestion. */}
          {primary ? (
            <section className="space-y-4">
              <StepGuide active={2} action={STEP_ACTION_FA[primary.intent as IntakeIntent]} />

              <PrimaryPathCard
                path={primary}
                dest={destFor(primary.intent as IntakeIntent)}
                hasDoc={hasDoc}
                quota={quota}
                onGo={handleGo}
              />

              {alternatives.length > 0 && (
                <Alternatives
                  paths={alternatives}
                  resolve={(i) => destFor(i)}
                  hasDoc={hasDoc}
                  onGo={handleGo}
                />
              )}

              {/* Provenance / refinement notes — never overstate the analysis. */}
              <AnalysisNotes
                isAnalyzing={isAnalyzing}
                analysisError={analysisError}
                source={analysis.source}
                onRetry={retry}
              />
            </section>
          ) : showLoading ? (
            <LoadingCard />
          ) : (
            <ServiceUnavailableState
              capsError={caps.isError}
              onRetry={retry}
              onGoNew={goToNew}
            />
          )}

          {/* 3 — Draft save status, so persistence is visible, not silent. */}
          <SaveNote state={saveState} saved={requestId !== null} />

          {/* 4 — Quality & safety standing disclaimer. */}
          <Card>
            <p className="flex items-start gap-2 text-caption leading-relaxed text-muted">
              <IconWarning size={16} className="mt-0.5 shrink-0 text-[var(--brand-gold)]" />
              <span>
                این صفحه فقط مسیر را پیشنهاد می‌دهد و جایگزین نظر وکیل نیست. هر تحلیل یا پاسخی که
                دریافت می‌کنی اولیه است؛ موارد نامطمئن به‌صراحت اعلام می‌شود و هیچ قانون، ماده یا رأیی
                از خود ساخته نمی‌شود.
              </span>
            </p>
          </Card>

          {/* 5 — Route-level actions. */}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="text" size="large" onClick={goToNew} startIcon={<IconEdit size={18} />}>
              ویرایش کامل در «ساخت جدید»
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Section: summary (stated vs inferred)
// ============================================================

function SummaryCard({
  text,
  documentName,
  explicitIntent,
  explicitCategory,
  inferredCategory,
  goalFa,
  summaryFa,
  source,
  confidence,
  needsLawyer,
  ambiguities,
  editing,
  onToggleEdit,
  onEditFields,
}: {
  text: string;
  documentName: string | null;
  explicitIntent: IntakeIntent | null;
  explicitCategory: string | null;
  inferredCategory: string | null;
  goalFa: string;
  summaryFa: string;
  source: "ai" | "rules";
  confidence: number | null;
  needsLawyer: boolean;
  ambiguities: string[];
  editing: boolean;
  onToggleEdit: () => void;
  onEditFields: ReactNode;
}) {
  // The rules fallback's "summary" is only a restatement of the description, so
  // showing it as an inference would just duplicate «آنچه شما گفتید». Only the
  // model's summary adds information, so it is shown only when it came from the
  // model — never dressed up as something it is not.
  const showSummary = source === "ai" && summaryFa.trim().length > 0;
  const showGoal = goalFa.trim().length > 0;

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h4 font-semibold text-on-surface">برداشت ما از درخواستت</h2>
          <p className="mt-1 text-bodySmall text-muted">
            بخش «شما گفتید» را خودت گفته‌ای؛ بخش «حدس ما» را سیستم استنباط کرده و قابل اصلاح است.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleEdit}
          aria-expanded={editing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-medium border border-divider px-3 py-1.5 text-labelMedium text-on-surface transition hover:border-primary hover:bg-primary-container/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-target"
        >
          <IconEdit size={16} />
          {editing ? "بستن اصلاح" : "اصلاح"}
        </button>
      </div>

      {editing && <div className="mb-4">{onEditFields}</div>}

      <div className="space-y-3">
        {/* Stated by the user */}
        <SummaryGroup tone="stated" title="آنچه شما گفتید">
          <Row label="شرح" value={text.trim() || "—"} />
          {explicitIntent && <Row label="نوع کمک" value={intentTitle(explicitIntent)} />}
          {explicitCategory && (
            <Row label="حوزه" value={categoryLabel(explicitCategory) ?? explicitCategory} />
          )}
          {documentName && <Row label="سند پیوست" value={documentName} icon={<IconFile size={14} />} />}
          {!explicitIntent && !explicitCategory && !documentName && (
            <Row label="یادداشت" value="فقط شرح موضوع را نوشتی." />
          )}
        </SummaryGroup>

        {/* Inferred by the system */}
        <SummaryGroup tone="inferred" title="حدس ما">
          {inferredCategory ? (
            <Row label="حوزهٔ احتمالی" value={categoryLabel(inferredCategory) ?? inferredCategory} />
          ) : (
            <Row label="حوزهٔ احتمالی" value="به‌اندازهٔ کافی روشن نیست" />
          )}
          {showSummary && <Row label="برداشت" value={summaryFa} />}
          {showGoal && <Row label="هدف احتمالی" value={goalFa} />}
          <Row
            label="نیاز به وکیل"
            value={needsLawyer ? "احتمالاً کمک وکیل لازم است" : "فعلاً لازم به نظر نمی‌رسد"}
          />
          {confidence !== null && (
            <Row label="اطمینان تحلیل" value={`${toPersianNumber(confidence)}٪`} />
          )}
        </SummaryGroup>

        {ambiguities.length > 0 && (
          <div className="rounded-medium border border-divider px-4 py-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-labelMedium text-on-surface">
              <IconInfo size={15} className="shrink-0 text-muted" />
              برای دقیق‌ترشدن مسیر
            </p>
            <ul className="list-inside list-disc space-y-1 text-caption text-muted">
              {ambiguities.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="flex items-center gap-1.5 text-caption text-muted">
          <span
            aria-hidden="true"
            className={[
              "inline-block h-1.5 w-1.5 rounded-full",
              source === "ai" ? "bg-primary" : "bg-[var(--brand-gold)]",
            ].join(" ")}
          />
          {source === "ai"
            ? "این برداشت با تحلیل هوش مصنوعی به‌دست آمده و قابل اصلاح است."
            : "این برداشت با قواعد خودکار به‌دست آمده (بدون تحلیل هوش مصنوعی) و قابل اصلاح است."}
        </p>
      </div>
    </Card>
  );
}

function SummaryGroup({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "stated" | "inferred";
  children: ReactNode;
}) {
  return (
    <div className="rounded-medium border border-divider">
      <div className="flex items-center gap-2 border-b border-divider px-4 py-2">
        <span
          aria-hidden="true"
          className={[
            "h-2 w-2 rounded-full",
            tone === "stated" ? "bg-primary" : "bg-[var(--brand-gold)]",
          ].join(" ")}
        />
        <span className="text-labelMedium font-medium text-on-surface">{title}</span>
        {tone === "inferred" && <span className="ms-auto text-caption text-muted">استنباط سیستم</span>}
      </div>
      <dl className="divide-y divide-divider">{children}</dl>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2.5 mobile-l:flex-row mobile-l:items-start mobile-l:gap-3">
      <dt className="shrink-0 text-caption text-muted mobile-l:w-28">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-1.5 break-words whitespace-pre-wrap text-body-2 text-on-surface">
        {icon}
        {value}
      </dd>
    </div>
  );
}

// ============================================================
// Section: inline edit fields
// ============================================================

function EditFields({
  text,
  intent,
  category,
  onText,
  onIntent,
  onCategory,
}: {
  text: string;
  intent: IntakeIntent | null;
  category: string | null;
  onText: (v: string) => void;
  onIntent: (v: IntakeIntent | null) => void;
  onCategory: (v: string | null) => void;
}) {
  return (
    <div className="space-y-4 rounded-medium bg-surface-container p-4">
      <Textarea
        id="suggest-law-text"
        label="شرح موضوع"
        value={text}
        onChange={(e) => onText(e.target.value)}
        rows={3}
        fullWidth
        supportingText="هر تغییری همین‌جا ذخیره می‌شود؛ با رفرش از دست نمی‌رود."
      />

      <div>
        <p className="mb-2 text-labelMedium text-on-surface">چه کمکی لازم داری؟</p>
        <div className="flex flex-wrap gap-2">
          {INTAKE_INTENT_OPTIONS.map((opt) => (
            <SelectableOption
              key={opt.id}
              label={opt.titleFa}
              selected={intent === opt.id}
              onClick={() => onIntent(intent === opt.id ? null : opt.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-labelMedium text-on-surface">حوزهٔ حقوقی</p>
        <div className="flex flex-wrap gap-2">
          {INTAKE_CATEGORY_CHOICES.map((slug) => (
            <SelectableOption
              key={slug}
              label={categoryLabel(slug) ?? slug}
              selected={category === slug}
              onClick={() => onCategory(category === slug ? null : slug)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Section: primary path + step guide
// ============================================================

function PrimaryPathCard({
  path,
  dest,
  hasDoc,
  quota,
  onGo,
}: {
  path: LegalRequestDiscoveryPath;
  dest: IntakeDestination;
  hasDoc: boolean;
  quota: { remaining: number; total: number } | undefined;
  onGo: (intent: IntakeIntent, dest: IntakeDestination) => void;
}) {
  const intent = path.intent as IntakeIntent;
  const Icon = INTENT_ICON[intent];
  const summary = describeDestination(dest);

  return (
    <Card>
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-container px-2.5 py-0.5 text-caption font-medium text-primary">
        <IconCheck size={13} />
        پیشنهاد اصلی
      </span>

      <div className="mt-3 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-medium bg-primary-container text-primary"
        >
          <Icon size={24} />
        </span>
        <div className="min-w-0">
          <h2 className="text-h4 font-semibold text-on-surface">{path.titleFa}</h2>
          <p className="mt-1 text-bodySmall leading-relaxed text-on-surface">{path.rationaleFa}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-bodySmall text-muted">
        <li className="flex items-start gap-2">
          <IconCheck size={16} className="mt-0.5 shrink-0 text-primary" />
          <span>{summary.detailFa}</span>
        </li>
        <li className="flex items-start gap-2">
          <IconInfo size={16} className="mt-0.5 shrink-0 text-muted" />
          <span>چه لازم است: {neededFa(intent, hasDoc)}</span>
        </li>
        {dest.kind === "chat" && (
          <li className="flex items-start gap-2">
            <IconChat size={16} className="mt-0.5 shrink-0 text-muted" />
            <span>نوع سرویس: {getServiceContext(dest.serviceType).label}</span>
          </li>
        )}
      </ul>

      {summary.usesDailyQuota && (
        <p className="mt-4 flex items-start gap-2 rounded-medium bg-surface-container px-3 py-2 text-caption text-muted">
          <IconInfo size={16} className="mt-0.5 shrink-0 text-primary" />
          <span>
            ارسال پرسش در گفت‌وگو از سهمیهٔ روزانهٔ شما استفاده می‌کند
            {quota && quota.total > 0
              ? ` (${toPersianNumber(quota.remaining)} از ${toPersianNumber(quota.total)} باقی مانده).`
              : "."}
          </span>
        </p>
      )}

      <div className="mt-5">
        <Button
          variant="filled"
          size="large"
          onClick={() => onGo(intent, dest)}
          startIcon={<Icon size={18} />}
        >
          ادامه به این مسیر
        </Button>
      </div>
    </Card>
  );
}

function StepGuide({ active, action }: { active: 1 | 2 | 3; action: string }) {
  const steps = ["ثبت مسئله", "انتخاب مسیر", action];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-caption" aria-label="مراحل انجام">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const state = n < active ? "done" : n === active ? "current" : "upcoming";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={state === "current" ? "step" : undefined}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                state === "done" && "bg-primary-container text-primary",
                state === "current" && "bg-primary font-medium text-primary-on",
                state === "upcoming" && "bg-surface-container text-muted",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span aria-hidden="true">{toPersianNumber(n)}</span>
              {label}
            </span>
            {n < 3 && (
              <span aria-hidden="true" className="text-muted">
                ←
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ============================================================
// Section: alternatives
// ============================================================

function Alternatives({
  paths,
  resolve,
  hasDoc,
  onGo,
}: {
  paths: LegalRequestDiscoveryPath[];
  resolve: (i: IntakeIntent) => IntakeDestination;
  hasDoc: boolean;
  onGo: (intent: IntakeIntent, dest: IntakeDestination) => void;
}) {
  return (
    <Card>
      <h2 className="mb-1 text-h4 font-semibold text-on-surface">گزینه‌های دیگر</h2>
      <p className="mb-3 text-bodySmall text-muted">
        اگر مسیر بالا دقیقاً همان چیزی نیست که می‌خواهی، یکی از این راه‌های فعال را انتخاب کن.
      </p>
      <ul className="space-y-3">
        {paths.map((path) => {
          const intent = path.intent as IntakeIntent;
          const dest = resolve(intent);
          const Icon = INTENT_ICON[intent];
          const summary = describeDestination(dest);
          return (
            <li key={path.intent}>
              <div className="flex flex-col gap-3 rounded-medium border border-divider p-4 mobile-l:flex-row mobile-l:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-surface-container text-on-surface"
                  >
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-titleSmall font-semibold text-on-surface">{path.titleFa}</h3>
                    <p className="mt-0.5 text-bodySmall text-muted">
                      {summary.detailFa} {neededFa(intent, hasDoc)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onGo(intent, dest)}
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-medium border border-divider px-4 py-2 text-labelMedium text-on-surface transition hover:border-primary hover:bg-primary-container/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary mobile-l:self-auto touch-target"
                >
                  رفتن
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ============================================================
// Section: analysis provenance / refinement notes
// ============================================================

function AnalysisNotes({
  isAnalyzing,
  analysisError,
  source,
  onRetry,
}: {
  isAnalyzing: boolean;
  analysisError: boolean;
  source: "ai" | "rules";
  onRetry: () => void;
}) {
  if (analysisError) {
    return (
      <Card>
        <div role="alert" className="flex items-start gap-3">
          <IconWarning size={20} className="mt-0.5 shrink-0 text-[var(--brand-gold)]" />
          <div className="min-w-0">
            <p className="text-labelLarge text-on-surface">تحلیل هوشمند در دسترس نبود</p>
            <p className="mt-1 text-bodySmall text-muted">
              مسیرهای بالا به‌صورت خودکار و بدون تحلیل هوش مصنوعی پیشنهاد شده‌اند تا درخواستت معطل
              نماند. می‌توانی تحلیل را دوباره امتحان کنی.
            </p>
            <button
              type="button"
              onClick={onRetry}
              disabled={isAnalyzing}
              className="mt-3 inline-flex items-center gap-2 rounded-medium border border-divider px-4 py-2 text-labelMedium text-on-surface transition hover:border-primary hover:bg-primary-container/40 disabled:opacity-50 touch-target"
            >
              <IconRefresh
                size={16}
                className={isAnalyzing ? "animate-spin motion-reduce:animate-none" : undefined}
              />
              تحلیل مجدد
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (isAnalyzing) {
    return (
      <p role="status" className="flex items-center gap-2 text-caption text-muted">
        <IconRefresh size={14} className="animate-spin motion-reduce:animate-none" />
        در حال تحلیل دقیق‌تر درخواست…
      </p>
    );
  }

  // The rules result stays visible after the model answered, but with an honest
  // note that no AI refinement happened — the recommendation is never dressed up.
  if (source === "rules") {
    return (
      <p className="text-caption text-muted">
        این مسیرها با قواعد خودکار پیشنهاد شده‌اند و قابل اصلاح‌اند.
      </p>
    );
  }

  return null;
}

// ============================================================
// Section: draft save status
// ============================================================

function SaveNote({ state, saved }: { state: DiscoverySaveState; saved: boolean }) {
  if (state === "idle" && !saved) return null;

  if (state === "error") {
    return (
      <p role="status" className="flex items-center gap-2 text-caption text-muted">
        <IconWarning size={14} className="shrink-0 text-[var(--brand-gold)]" />
        ذخیرهٔ خودکار درخواست ممکن نشد؛ اطلاعات روی همین دستگاه نگه داشته می‌شود.
      </p>
    );
  }

  if (state === "creating" || state === "saving") {
    return (
      <p role="status" className="flex items-center gap-2 text-caption text-muted">
        <IconRefresh size={14} className="animate-spin motion-reduce:animate-none" />
        {state === "creating" ? "در حال ثبت درخواست…" : "در حال ذخیرهٔ تغییرات…"}
      </p>
    );
  }

  return (
    <p role="status" className="flex items-center gap-2 text-caption text-muted">
      <IconCheck size={14} className="shrink-0 text-primary" />
      درخواستت ذخیره شد و در تاریخچه قابل پیگیری است.
    </p>
  );
}

// ============================================================
// Section: loading / empty / unavailable states
// ============================================================

function LoadingCard() {
  return (
    <Card>
      <p role="status" className="flex items-center gap-2 text-bodySmall text-muted">
        <IconRefresh size={16} className="animate-spin motion-reduce:animate-none" />
        در حال بررسی درخواست و خدمات در دسترس…
      </p>
    </Card>
  );
}

function NoRequestState({ onStart }: { onStart: () => void }) {
  return (
    <Card>
      <div className="flex flex-col items-center py-6 text-center">
        <span
          aria-hidden="true"
          className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-muted"
        >
          <IconInfo size={26} />
        </span>
        <h2 className="text-h4 font-semibold text-on-surface">درخواستی برای ادامه پیدا نشد</h2>
        <p className="mx-auto mt-2 max-w-md text-bodySmall text-muted">
          این صفحه درخواستی که در «ساخت جدید» نوشته‌ای را ادامه می‌دهد. برای شروع، موضوعت را آنجا
          توضیح بده.
        </p>
        <div className="mt-4">
          <Button variant="filled" size="large" onClick={onStart} startIcon={<IconEdit size={18} />}>
            رفتن به «ساخت جدید»
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ServiceUnavailableState({
  capsError,
  onRetry,
  onGoNew,
}: {
  capsError: boolean;
  onRetry: () => void;
  onGoNew: () => void;
}) {
  return (
    <Card>
      <div role="status" className="flex items-start gap-3">
        <IconWarning size={20} className="mt-0.5 shrink-0 text-[var(--brand-gold)]" />
        <div className="min-w-0">
          <p className="text-labelLarge text-on-surface">
            {capsError
              ? "دریافت وضعیت خدمات ممکن نشد"
              : "در حال حاضر مسیر فعالی برای این درخواست نیست"}
          </p>
          <p className="mt-1 text-bodySmall text-muted">
            {capsError
              ? "نتوانستیم خدمات در دسترس را بررسی کنیم؛ بنابراین برای پرهیز از نمایش مسیر نادرست، پیشنهادی نشان نمی‌دهیم."
              : "بر اساس تنظیمات فعلی سامانه، هیچ‌یک از خدمات مرتبط با این درخواست در دسترس نیست. می‌توانی دوباره تلاش کنی یا با پشتیبانی تماس بگیری."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-medium border border-divider px-4 py-2 text-labelMedium text-on-surface transition hover:border-primary hover:bg-primary-container/40 touch-target"
            >
              <IconRefresh size={16} />
              تلاش دوباره
            </button>
            <button
              type="button"
              onClick={onGoNew}
              className="inline-flex items-center gap-2 rounded-medium border border-divider px-4 py-2 text-labelMedium text-on-surface transition hover:border-primary hover:bg-primary-container/40 touch-target"
            >
              <IconEdit size={16} />
              ویرایش درخواست
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">در حال بارگذاری…</span>
      <div className="h-40 animate-pulse rounded-large bg-surface-container motion-reduce:animate-none" />
      <div className="h-56 animate-pulse rounded-large bg-surface-container motion-reduce:animate-none" />
    </div>
  );
}

// ============================================================
// Shared card surface
// ============================================================

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface p-4 shadow-elevation-1 tablet:p-5">
      {children}
    </section>
  );
}
