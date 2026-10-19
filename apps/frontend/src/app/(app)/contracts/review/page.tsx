// ============================================================
// LEGALIR — Contract review intake page (spec §8)
// ============================================================
// The dedicated space for «بررسی قرارداد با هوش مصنوعی». It is the
// SECOND service hosted by the contracts area, and it is deliberately
// separate from the drafting page so the two are never confused:
//
//   /contracts         → build a new draft / manage my contracts
//   /contracts/review  → have an EXISTING contract analysed by AI
//
// The page is a three-step intake (document → context → confirm) that
// assembles the user's OWN answers into a precise question, then hands
// that question to the existing AI-review pipeline. It never fabricates
// an analysis: if the pipeline is not reachable, the user is told so.
//
// HONESTY RULES (spec §1, §8, §10):
//   • a value pre-filled from the document is tagged «از سند استخراج
//     شد» and never presented as something the user confirmed;
//   • «نمی‌دانم» is a first-class answer, never a missing value;
//   • the confirm step states the scope back before anything runs.
// ============================================================

"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  SelectableCard,
  SelectableOption,
  Skeleton,
  Textarea,
  snackbar,
} from "@legalir/ui";
import { useDocuments } from "@/hooks/useDocuments";
import { usePropertyContracts } from "@/hooks/usePropertyContracts";
import { useCreateAiReview } from "@/hooks/useContractLifecycle";
import { useCreateConversation } from "@/hooks/useConversations";
import { toUnifiedPropertyContract } from "@/lib/contracts/unified";
import {
  REVIEW_STEPS,
  REVIEW_SOURCES,
  REVIEW_ROLES,
  REVIEW_PURPOSES,
  REVIEW_STATUSES,
  REVIEW_CONCERNS,
  REVIEW_JURISDICTIONS,
  EMPTY_REVIEW_CONTEXT,
  PASTED_CONTRACT_MIN_CHARS,
  PASTED_CONTRACT_MAX_CHARS,
  reviewStepIndex,
  isReviewContextComplete,
  reviewScopeSummary,
  buildReviewQuestion,
  buildPastedReviewMessage,
  type ReviewStepId,
  type ReviewDocumentSource,
  type ReviewContext,
  type ReviewOption,
} from "@/lib/contracts/review-flow";
import { newPastedReviewToken, stashPastedReview } from "@/lib/contracts/pasted-review";
import {
  IconArrowBack,
  IconChevronRight,
  IconDocument,
  IconFilePen,
  IconFileSearch,
  IconFiles,
  IconFileText,
  IconUpload,
} from "@/lib/icons";

// ------------------------------------------------------------
// Source → icon
// ------------------------------------------------------------

const SOURCE_ICON: Record<ReviewDocumentSource, React.ReactNode> = {
  upload: <IconUpload size={20} />,
  paste: <IconFileText size={20} />,
  drafts: <IconFilePen size={20} />,
  documents: <IconFiles size={20} />,
};

// ------------------------------------------------------------
// Page shell
// ------------------------------------------------------------

export default function ContractReviewPage() {
  return (
    <React.Suspense fallback={null}>
      <ContractReviewFlow />
    </React.Suspense>
  );
}

function ContractReviewFlow() {
  const router = useRouter();

  // --- Wizard state --------------------------------------------------
  const [step, setStep] = React.useState<ReviewStepId>("document");
  const [source, setSource] = React.useState<ReviewDocumentSource | null>(null);
  const [documentId, setDocumentId] = React.useState<string | null>(null);
  const [contractId, setContractId] = React.useState<string | null>(null);
  const [pastedText, setPastedText] = React.useState("");
  const [context, setContext] = React.useState<ReviewContext>(EMPTY_REVIEW_CONTEXT);

  // --- Data ----------------------------------------------------------
  const {
    data: documentsData,
    isLoading: documentsLoading,
    isError: documentsError,
    refetch: refetchDocuments,
  } = useDocuments({});
  const {
    data: contractsData,
    isLoading: contractsLoading,
    isError: contractsError,
    refetch: refetchContracts,
  } = usePropertyContracts({ pageSize: 50 });

  const documents = documentsData?.items ?? [];
  const contracts = React.useMemo(
    () => (contractsData?.items ?? []).map(toUnifiedPropertyContract),
    [contractsData]
  );

  // --- Context helpers ----------------------------------------------
  // Every answer the user gives is tagged `source: "user"` — the flow
  // never invents an `extracted` value, because nothing here parses the
  // document. Extraction, when it happens, is done by the pipeline and
  // surfaced on the result page.
  const setAnswer = (field: "role" | "purpose" | "status" | "jurisdiction", value: string) => {
    setContext((prev) => ({ ...prev, [field]: { value, source: "user" } }));
  };

  const toggleConcern = (value: string) => {
    setContext((prev) => {
      const exists = prev.concerns.some((c) => c.value === value);
      return {
        ...prev,
        concerns: exists
          ? prev.concerns.filter((c) => c.value !== value)
          : [...prev.concerns, { value, source: "user" }],
      };
    });
  };

  const setNotes = (value: string) => {
    setContext((prev) => ({ ...prev, notes: { value, source: "user" } }));
  };

  // --- Step gating ---------------------------------------------------
  const pastedLength = pastedText.trim().length;
  const pastedReady = pastedLength >= PASTED_CONTRACT_MIN_CHARS;
  const documentChosen =
    (source === "upload") ||
    (source === "paste" && pastedReady) ||
    (source === "drafts" && !!contractId) ||
    (source === "documents" && !!documentId);

  const contextComplete = isReviewContextComplete(context);

  const canAdvance =
    step === "document" ? documentChosen : step === "context" ? contextComplete : true;

  const goNext = () => {
    if (step === "document") setStep("context");
    else if (step === "context") setStep("confirm");
  };

  const goBack = () => {
    if (step === "context") setStep("document");
    else if (step === "confirm") setStep("context");
  };

  // --- Run the review ------------------------------------------------
  const createAiReview = useCreateAiReview();
  const createConversation = useCreateConversation();

  const handleRun = async () => {
    const question = buildReviewQuestion(context);

    if (source === "paste" && pastedReady) {
      // Pasted text is NOT uploaded as a document (the pipeline accepts
      // PDF/DOCX/images only). It goes to the chat as the message itself,
      // which is also the surface that renders the analysis and answers
      // follow-ups about it.
      const message = buildPastedReviewMessage(pastedText, context);
      const token = newPastedReviewToken();
      stashPastedReview(token, message);
      try {
        const conversation = await createConversation.mutateAsync({
          title: "بررسی قرارداد جای‌گذاری‌شده",
          category: "contract",
        });
        const params = new URLSearchParams({
          service: "contract_review",
          reviewPasted: token,
        });
        router.push(`/chat/${conversation.id}?${params.toString()}`);
      } catch (e) {
        snackbar.show({
          message: e instanceof Error ? e.message : "شروع بررسی ناموفق بود.",
          variant: "error",
        });
      }
      return;
    }

    if (source === "drafts" && contractId) {
      try {
        const { conversationId } = await createAiReview.mutateAsync({
          id: contractId,
          question,
        });
        router.push(`/chat/${conversationId}`);
      } catch (e) {
        snackbar.show({
          message: e instanceof Error ? e.message : "شروع بررسی ناموفق بود.",
          variant: "error",
        });
      }
      return;
    }

    if (source === "documents" && documentId) {
      // The scope the user just confirmed travels with them, so the analysis
      // is asked exactly what they chose instead of silently ignoring it.
      const params = new URLSearchParams({ ask: question });
      router.push(`/documents/${documentId}?${params.toString()}`);
      return;
    }

    // Upload: hand off to the upload wizard, which returns to this flow
    // with the new document pre-selected.
    const params = new URLSearchParams({
      returnTo: "/contracts/review",
      question,
    });
    router.push(`/documents/upload?${params.toString()}`);
  };

  const scopeLines = reviewScopeSummary(context);
  const stepIndex = reviewStepIndex(step);

  return (
    <div className="mx-auto max-w-3xl space-y-6" dir="rtl">
      {/* Header */}
      <header>
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="flex items-center gap-1.5 text-caption text-muted">
            <li>
              <Link
                href="/contracts"
                className="rounded-small px-1 py-0.5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                قراردادها
              </Link>
            </li>
            <li aria-hidden="true" className="flex items-center text-neutral-300">
              <IconChevronRight size={16} />
            </li>
            <li>
              <span aria-current="page" className="px-1 py-0.5 font-medium text-on-surface">
                بررسی قرارداد
              </span>
            </li>
          </ol>
        </nav>

        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary"
            aria-hidden="true"
          >
            <IconFileSearch size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-h3 font-bold text-on-surface">بررسی قرارداد با هوش مصنوعی</h1>
            <p className="mt-1 text-body-2 leading-relaxed text-on-surface-variant">
              سند خود را انتخاب کنید، چند نکته درباره آن بگویید و بررسی را شروع کنید. نتیجه،
              تحلیل هوش مصنوعی است و جایگزین نظر وکیل نیست.
            </p>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <Stepper current={stepIndex} />

      {/* Step body */}
      <div className="rounded-large border border-divider bg-surface p-5 shadow-elevation-1">
        {step === "document" && (
          <StepDocument
            source={source}
            onSource={(s) => {
              setSource(s);
              setDocumentId(null);
              setContractId(null);
            }}
            documents={documents}
            documentsLoading={documentsLoading}
            documentsError={documentsError}
            onRetryDocuments={() => void refetchDocuments()}
            contracts={contracts}
            contractsLoading={contractsLoading}
            contractsError={contractsError}
            onRetryContracts={() => void refetchContracts()}
            documentId={documentId}
            contractId={contractId}
            pastedText={pastedText}
            onPastedText={setPastedText}
            onPickDocument={setDocumentId}
            onPickContract={setContractId}
          />
        )}

        {step === "context" && (
          <StepContext
            context={context}
            onAnswer={setAnswer}
            onToggleConcern={toggleConcern}
            onNotes={setNotes}
          />
        )}

        {step === "confirm" && (
          <StepConfirm
            source={source}
            documentName={
              source === "documents"
                ? documents.find((d) => d.id === documentId)?.name
                : source === "drafts"
                  ? contracts.find((c) => c.id === contractId)?.title
                  : source === "paste"
                    ? "متن جای‌گذاری‌شده"
                    : undefined
            }
            scopeLines={scopeLines}
          />
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3">
        {step === "document" ? (
          <Link
            href="/contracts"
            className="inline-flex h-11 items-center gap-2 rounded-medium px-4 text-labelLarge text-muted transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <IconArrowBack size={18} aria-hidden="true" />
            بازگشت به قراردادها
          </Link>
        ) : (
          <Button variant="text" size="large" onClick={goBack}>
            مرحله قبل
          </Button>
        )}

        {step === "confirm" ? (
          <Button
            variant="filled"
            size="large"
            startIcon={<IconFileSearch size={20} />}
            onClick={handleRun}
            loading={createAiReview.isPending || createConversation.isPending}
            disabled={createAiReview.isPending || createConversation.isPending}
          >
            شروع بررسی
          </Button>
        ) : (
          <Button variant="filled" size="large" onClick={goNext} disabled={!canAdvance}>
            مرحله بعد
          </Button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Stepper
// ------------------------------------------------------------

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="مراحل بررسی">
      {REVIEW_STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <span
              className={[
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-labelSmall font-medium",
                active
                  ? "bg-primary text-primary-on"
                  : done
                    ? "bg-primary-container text-primary"
                    : "bg-surface-container-high text-muted",
              ].join(" ")}
              aria-current={active ? "step" : undefined}
            >
              {i + 1}
            </span>
            <span
              className={[
                "hidden mobile-l:block text-labelMedium",
                active ? "text-on-surface" : "text-muted",
              ].join(" ")}
            >
              {s.titleFa}
            </span>
            {i < REVIEW_STEPS.length - 1 && (
              <span className="mx-1 h-px flex-1 bg-divider" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------
// Step 1 — document
// ------------------------------------------------------------

interface StepDocumentProps {
  source: ReviewDocumentSource | null;
  onSource: (s: ReviewDocumentSource) => void;
  documents: { id: string; name: string; status: string }[];
  documentsLoading: boolean;
  documentsError: boolean;
  onRetryDocuments: () => void;
  contracts: { id: string; title: string; typeFa: string }[];
  contractsLoading: boolean;
  contractsError: boolean;
  onRetryContracts: () => void;
  documentId: string | null;
  contractId: string | null;
  pastedText: string;
  onPastedText: (value: string) => void;
  onPickDocument: (id: string) => void;
  onPickContract: (id: string) => void;
}

function StepDocument({
  source,
  onSource,
  documents,
  documentsLoading,
  documentsError,
  onRetryDocuments,
  contracts,
  contractsLoading,
  contractsError,
  onRetryContracts,
  documentId,
  contractId,
  pastedText,
  onPastedText,
  onPickDocument,
  onPickContract,
}: StepDocumentProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-titleMedium text-on-surface">سند مورد بررسی را انتخاب کنید</h2>
        <p className="mt-1 text-bodySmall text-muted">
          می‌توانید فایل تازه‌ای بارگذاری کنید، متن قرارداد را جای‌گذاری کنید، یکی از پیش‌نویس‌های
          خود را انتخاب کنید یا از اسناد قبلی لیگالیر استفاده کنید.
        </p>
      </div>

      <div className="grid gap-3 tablet:grid-cols-2">
        {REVIEW_SOURCES.map((s) => (
          <SelectableCard
            key={s.id}
            title={s.titleFa}
            description={s.descriptionFa}
            icon={SOURCE_ICON[s.id]}
            selected={source === s.id}
            onClick={() => onSource(s.id)}
          />
        ))}
      </div>

      {source === "drafts" && (
        <div className="space-y-2">
          <p className="text-labelMedium text-on-surface">پیش‌نویس‌های من</p>
          {contractsLoading ? (
            <ListSkeleton label="در حال بارگذاری پیش‌نویس‌ها" />
          ) : contractsError ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-bodySmall text-error">
                فهرست پیش‌نویس‌ها بارگذاری نشد.
              </p>
              <Button type="button" variant="text" size="small" onClick={onRetryContracts}>
                تلاش مجدد
              </Button>
            </div>
          ) : contracts.length === 0 ? (
            <p className="text-bodySmall text-muted">
              هنوز قراردادی نساخته‌اید. می‌توانید یک سند بارگذاری کنید.
            </p>
          ) : (
            <ul className="space-y-2">
              {contracts.map((c) => (
                <li key={c.id}>
                  <SelectableCard
                    title={c.title}
                    description={c.typeFa}
                    icon={<IconDocument size={18} />}
                    selected={contractId === c.id}
                    onClick={() => onPickContract(c.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {source === "documents" && (
        <div className="space-y-2">
          <p className="text-labelMedium text-on-surface">اسناد لیگالیر</p>
          {documentsLoading ? (
            <ListSkeleton label="در حال بارگذاری اسناد" />
          ) : documentsError ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-bodySmall text-error">
                فهرست اسناد بارگذاری نشد.
              </p>
              <Button type="button" variant="text" size="small" onClick={onRetryDocuments}>
                تلاش مجدد
              </Button>
            </div>
          ) : documents.length === 0 ? (
            <p className="text-bodySmall text-muted">
              سندی در بخش اسناد ندارید. می‌توانید یک فایل تازه بارگذاری کنید.
            </p>
          ) : (
            <ul className="space-y-2">
              {documents.map((d) => (
                <li key={d.id}>
                  <SelectableCard
                    title={d.name}
                    icon={<IconDocument size={18} />}
                    selected={documentId === d.id}
                    onClick={() => onPickDocument(d.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {source === "paste" && (
        <div className="space-y-2">
          <Textarea
            label="متن قرارداد"
            value={pastedText}
            onChange={(event) => onPastedText(event.target.value)}
            rows={8}
            maxLength={PASTED_CONTRACT_MAX_CHARS}
            showCharCount
            fullWidth
            helperText={
              pastedText.trim().length > 0 &&
              pastedText.trim().length < PASTED_CONTRACT_MIN_CHARS
                ? "برای تحلیل، متن بیشتری لازم است؛ حداقل چند بند از قرارداد را جای‌گذاری کنید."
                : "متن جای‌گذاری‌شده فقط برای همین بررسی در گفتگو فرستاده می‌شود و به‌عنوان فایل در حساب شما ذخیره نمی‌شود."
            }
          />
        </div>
      )}

      {source === "upload" && (
        <p className="rounded-medium bg-surface-container-low p-3 text-bodySmall text-muted">
          در مرحله بعد به صفحه بارگذاری می‌روید؛ پس از بارگذاری، همین بررسی با سند جدید ادامه پیدا
          می‌کند.
        </p>
      )}
    </div>
  );
}

/** Placeholder rows while a real list is loading — announced once, not per row. */
function ListSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-medium border border-divider p-3">
          <Skeleton variant="circular" width="36px" height="36px" />
          <div className="flex-1 space-y-1.5">
            <Skeleton variant="text" width="55%" />
            <Skeleton variant="text" width="30%" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// Step 2 — context
// ------------------------------------------------------------

interface StepContextProps {
  context: ReviewContext;
  onAnswer: (field: "role" | "purpose" | "status" | "jurisdiction", value: string) => void;
  onToggleConcern: (value: string) => void;
  onNotes: (value: string) => void;
}

function StepContext({ context, onAnswer, onToggleConcern, onNotes }: StepContextProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-titleMedium text-on-surface">چند نکته درباره این بررسی</h2>
        <p className="mt-1 text-bodySmall text-muted">
          این پاسخ‌ها به هوش مصنوعی کمک می‌کند بررسی را دقیق‌تر انجام دهد. اگر چیزی را نمی‌دانید،
          گزینه «نمی‌دانم» را انتخاب کنید.
        </p>
      </div>

      <OptionGroup
        labelFa="هدف شما از این بررسی"
        required
        options={REVIEW_PURPOSES}
        value={context.purpose?.value}
        onChange={(v) => onAnswer("purpose", v)}
      />

      <OptionGroup
        labelFa="نقش شما در قرارداد"
        options={REVIEW_ROLES}
        value={context.role?.value}
        onChange={(v) => onAnswer("role", v)}
      />

      <OptionGroup
        labelFa="وضعیت سند"
        options={REVIEW_STATUSES}
        value={context.status?.value}
        onChange={(v) => onAnswer("status", v)}
      />

      <OptionGroup
        labelFa="حوزه قضایی"
        options={REVIEW_JURISDICTIONS}
        value={context.jurisdiction?.value}
        onChange={(v) => onAnswer("jurisdiction", v)}
      />

      <div>
        <p className="mb-2 text-labelMedium text-on-surface">
          نکاتی که می‌خواهید بررسی روی آن‌ها تمرکز کند
        </p>
        <div className="flex flex-wrap gap-2">
          {REVIEW_CONCERNS.map((c) => (
            <SelectableOption
              key={c.value}
              label={c.labelFa}
              selected={context.concerns.some((x) => x.value === c.value)}
              onClick={() => onToggleConcern(c.value)}
            />
          ))}
        </div>
      </div>

      <Textarea
        label="توضیح بیشتر (اختیاری)"
        helperText="هر نکته‌ای که فکر می‌کنید در بررسی مهم است."
        value={context.notes?.value ?? ""}
        onChange={(e) => onNotes(e.target.value)}
        rows={3}
        fullWidth
      />
    </div>
  );
}

function OptionGroup({
  labelFa,
  options,
  value,
  onChange,
  required = false,
}: {
  labelFa: string;
  options: ReviewOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-labelMedium text-on-surface">
        {labelFa}
        {required && <span className="text-error"> *</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <SelectableOption
            key={o.value}
            label={o.labelFa}
            selected={value === o.value}
            onClick={() => onChange(o.value)}
          />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Step 3 — confirm
// ------------------------------------------------------------

function StepConfirm({
  source,
  documentName,
  scopeLines,
}: {
  source: ReviewDocumentSource | null;
  documentName: string | undefined;
  scopeLines: { labelFa: string; valueFa: string; extracted: boolean }[];
}) {
  const sourceLabel = REVIEW_SOURCES.find((s) => s.id === source)?.titleFa ?? "—";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-titleMedium text-on-surface">تأیید دامنه بررسی</h2>
        <p className="mt-1 text-bodySmall text-muted">
          آنچه بررسی می‌شود را ببینید. اگر چیزی درست نیست، به مرحله قبل برگردید.
        </p>
      </div>

      <dl className="divide-y divide-divider rounded-medium border border-divider">
        <div className="flex items-center justify-between gap-4 p-3">
          <dt className="text-labelMedium text-muted">سند</dt>
          <dd className="text-labelMedium text-on-surface">
            {documentName ?? sourceLabel}
          </dd>
        </div>
        {scopeLines.map((line) => (
          <div key={line.labelFa} className="flex items-start justify-between gap-4 p-3">
            <dt className="text-labelMedium text-muted">{line.labelFa}</dt>
            <dd className="flex items-center gap-2 text-labelMedium text-on-surface">
              <span>{line.valueFa}</span>
              {line.extracted && (
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-labelSmall text-muted">
                  از سند استخراج شد
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <p className="rounded-medium bg-surface-container-low p-3 text-bodySmall text-muted">
        نتیجه این بررسی، تحلیل هوش مصنوعی لیگالیر است و جایگزین نظر وکیل یا مشاوره حقوقی تخصصی
        نیست. برای هر ایراد، متن سند و منبع قانونی ذکر می‌شود و اگر منبع کافی نباشد، صریح گفته
        می‌شود.
      </p>
    </div>
  );
}
