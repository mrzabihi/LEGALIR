"use client";

// ============================================================
// LEGALIR — Consultation wizard
// ============================================================
// The client's path to a real consultation request. Four steps:
//
//   1. موضوع و شرح   — category, description, optional urgency
//   2. پیوست‌ها       — attach existing documents or upload new ones
//   3. انتخاب وکیل   — the chosen lawyer, or matched candidates
//   4. بازبینی و تأیید — everything, editable, then submit
//
// ONE authoritative lawyer id. `draft.lawyerId` is the single source of
// truth for the selected lawyer: the preview's name, specialties and fee
// are all fetched from that id, and the submit payload sends that same id.
// The display can therefore never disagree with the request that is sent.
//
// The lawyer id is carried in three places that are kept in step:
//   · the URL (`?lawyerId=`) — an explicit choice from /lawyers, and the
//     value a refresh / back-forward / post-login return resumes from
//   · the localStorage draft — so step navigation and PWA reopen keep it
//   · the in-memory draft state — what the UI renders
//
// The URL always wins over a stale draft: clicking lawyer A after having
// previously drafted lawyer B must show A, never B.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button, SelectableCard, Textarea, Select } from "@legalir/ui";
import { useCreateConsultation } from "@/hooks/useConsultations";
import { useLawyer } from "@/hooks/useLawyers";
import { useDocuments, useInitiateUpload, useCompleteUpload } from "@/hooks/useDocuments";
import { UploadZone } from "@/components/documents/upload-zone";
import { LawyerAvatar } from "@/components/lawyers/lawyer-avatar";
import { LawyerPicker } from "./lawyer-picker";
import { LawyerSelectorDialog } from "./lawyer-selector-dialog";
import { InfoSharingNotice } from "./consultation-banner";
import { formatToman } from "./consultation-status";
import {
  IconArrowBack,
  IconArrowForward,
  IconBalance,
  IconCheck,
  IconClose,
  IconFile,
  IconWarning,
} from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  LEGAL_CATEGORY_FA,
  type LawyerDetail,
  type LawyerListItem,
  type V1DocumentListItem,
} from "@legalir/types";

const DRAFT_KEY = "legalir-consultation-draft";

/** The categories the intake engine supports, in a stable display order. */
const CATEGORY_SLUGS = Object.keys(LEGAL_CATEGORY_FA);

interface WizardDraft {
  step: number;
  category: string;
  title: string;
  description: string;
  urgency: string;
  /** The one authoritative selected lawyer id. */
  lawyerId: string | null;
  attachmentIds: string[];
}

const EMPTY_DRAFT: WizardDraft = {
  step: 0,
  category: "",
  title: "",
  description: "",
  urgency: "normal",
  lawyerId: null,
  attachmentIds: [],
};

const STEP_TITLES = ["موضوع و شرح", "پیوست‌ها", "انتخاب وکیل", "بازبینی و تأیید"];

function loadDraft(): WizardDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WizardDraft>;
    // Older drafts carried a `lawyerName`; it is ignored now — the name is
    // always derived from the id, so a stale name can never be displayed.
    return { ...EMPTY_DRAFT, ...parsed };
  } catch {
    return null;
  }
}

/** A lawyer can receive a request only when verified and accepting. */
function isEligible(lawyer: LawyerDetail | undefined): boolean {
  return !!lawyer && lawyer.verificationStatus === "VERIFIED" && lawyer.acceptingRequests;
}

export function ConsultationWizard({ initialLawyerId }: { initialLawyerId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const create = useCreateConsultation();
  const initiate = useInitiateUpload();
  const complete = useCompleteUpload();
  const { data: documents } = useDocuments({ pageSize: 50 });

  const [draft, setDraft] = useState<WizardDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Hydrate the draft once on mount.
  useEffect(() => {
    setDraft(loadDraft() ?? EMPTY_DRAFT);
    setHydrated(true);
  }, []);

  // The URL lawyer is an explicit choice and always wins over a stale draft.
  // This is what makes «click lawyer A → preview shows A» hold even when a
  // previous draft had lawyer B.
  useEffect(() => {
    if (!hydrated || !initialLawyerId) return;
    setDraft((d) => (d.lawyerId === initialLawyerId ? d : { ...d, lawyerId: initialLawyerId }));
  }, [hydrated, initialLawyerId]);

  // Mirror every change to localStorage so a refresh never loses work.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage full / disabled — the in-memory draft still works.
    }
  }, [draft, hydrated]);

  const patch = useCallback((p: Partial<WizardDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  /**
   * Set the selected lawyer and keep the URL in step, so a refresh,
   * back/forward, or a post-login return resumes with the same lawyer.
   */
  const setLawyer = useCallback(
    (lawyerId: string | null) => {
      setDraft((d) => ({ ...d, lawyerId }));
      const params = new URLSearchParams(searchParams.toString());
      if (lawyerId) params.set("lawyerId", lawyerId);
      else params.delete("lawyerId");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // The chosen lawyer's full profile — the authoritative source for the
  // preview's name, specialties and price.
  const {
    data: chosenLawyer,
    isLoading: lawyerLoading,
    isError: lawyerError,
  } = useLawyer(draft.lawyerId ?? undefined);

  const lawyerEligible = isEligible(chosenLawyer);
  // A selected lawyer that cannot be resolved or cannot accept blocks submit.
  const lawyerBlocked = !!draft.lawyerId && !lawyerLoading && !lawyerEligible;

  const attachments: V1DocumentListItem[] = useMemo(() => {
    const all = documents?.items ?? [];
    return draft.attachmentIds
      .map((id) => all.find((d) => d.id === id))
      .filter((d): d is V1DocumentListItem => Boolean(d));
  }, [documents, draft.attachmentIds]);

  const step = draft.step;
  const canAdvance =
    step === 0
      ? draft.category.length > 0 && draft.title.trim().length > 0 && draft.description.trim().length > 0
      : true;

  function next() {
    if (!canAdvance) return;
    patch({ step: Math.min(STEP_TITLES.length - 1, step + 1) });
  }
  function back() {
    patch({ step: Math.max(0, step - 1) });
  }

  function selectLawyer(l: LawyerListItem) {
    setLawyer(l.id);
  }

  async function handleUpload(file: File) {
    setError(null);
    try {
      const init = await initiate.mutateAsync({
        name: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });
      const doc = await complete.mutateAsync({ id: init.id, file });
      patch({ attachmentIds: [...draft.attachmentIds, doc.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "بارگذاری فایل ناموفق بود");
    }
  }

  async function submit() {
    setError(null);
    // Never send a request against a lawyer the preview could not resolve.
    if (lawyerBlocked) {
      setError("وکیل انتخاب‌شده در دسترس نیست. لطفاً وکیل دیگری انتخاب کنید.");
      return;
    }
    try {
      const created = await create.mutateAsync({
        title: draft.title.trim(),
        category: draft.category,
        intakeAnswers: {
          "شرح موضوع": draft.description.trim(),
          ...(draft.urgency !== "normal" ? { "فوریت": urgencyLabel(draft.urgency) } : {}),
        },
        // The one authoritative id — the same one the preview rendered.
        selectedLawyerId: draft.lawyerId,
        attachmentDocumentIds: draft.attachmentIds,
      });
      // The draft is now a real request — clear it so a new consultation
      // starts clean.
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      router.push(`/consultations/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت درخواست ناموفق بود");
    }
  }

  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-2xl bg-surface-container" />;
  }

  return (
    <div className="rounded-2xl border border-divider/60 bg-surface p-5 tablet:p-6">
      {/* Step indicator */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-caption text-muted">
          <span>
            گام {toPersianNumber(step + 1)} از {toPersianNumber(STEP_TITLES.length)}
          </span>
          <span>{STEP_TITLES[step]}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-divider/60">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1 — topic & description */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-labelLarge text-on-surface">موضوع حقوقی</label>
            <div className="grid grid-cols-1 gap-2 mobile-l:grid-cols-2">
              {CATEGORY_SLUGS.map((slug) => (
                <SelectableCard
                  key={slug}
                  title={LEGAL_CATEGORY_FA[slug]}
                  selected={draft.category === slug}
                  onClick={() => patch({ category: slug })}
                />
              ))}
            </div>
          </div>

          <Textarea
            id="consultation-title"
            label="عنوان درخواست"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            rows={1}
            placeholder="مثلاً: بررسی قرارداد اجاره"
            fullWidth
          />

          <Textarea
            id="consultation-description"
            label="شرح موضوع"
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={5}
            placeholder="موضوع را کامل توضیح دهید تا وکیل بتواند بهتر کمک کند…"
            fullWidth
          />

          <Select
            id="consultation-urgency"
            label="فوریت"
            value={draft.urgency}
            onChange={(e) => patch({ urgency: e.target.value })}
            options={[
              { value: "normal", label: "عادی" },
              { value: "soon", label: "در اسرع وقت" },
              { value: "urgent", label: "فوری" },
            ]}
            fullWidth
          />
        </div>
      )}

      {/* Step 2 — attachments */}
      {step === 1 && (
        <div className="space-y-5">
          <p className="text-body-2 text-muted">
            می‌توانید اسناد مرتبط را پیوست کنید. این مرحله اختیاری است و می‌توانید بعداً هم اضافه کنید.
          </p>

          <UploadZone onFile={handleUpload} disabled={initiate.isPending || complete.isPending} />

          {attachments.length > 0 && (
            <ul className="space-y-2">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-divider/60 px-3 py-2.5"
                >
                  <IconFile size={18} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-body-2 text-on-surface">
                    {a.name}
                  </span>
                  <button
                    type="button"
                    aria-label="حذف پیوست"
                    onClick={() =>
                      patch({ attachmentIds: draft.attachmentIds.filter((id) => id !== a.id) })
                    }
                    className="shrink-0 rounded-full p-1 text-muted transition hover:bg-error/10 hover:text-error"
                  >
                    <IconClose size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {documents && documents.items.length > 0 && (
            <div>
              <p className="mb-2 text-caption text-muted">انتخاب از اسناد موجود</p>
              <div className="flex flex-wrap gap-2">
                {documents.items
                  .filter((d) => !draft.attachmentIds.includes(d.id))
                  .slice(0, 12)
                  .map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => patch({ attachmentIds: [...draft.attachmentIds, d.id] })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-divider/60 px-3 py-1.5 text-caption text-on-surface transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      <IconFile size={14} />
                      {d.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — lawyer */}
      {step === 2 && (
        <div className="space-y-4">
          {draft.lawyerId && chosenLawyer ? (
            <div className="rounded-large border-2 border-control-selected-border bg-control-selected-surface p-4">
              <div className="flex items-center gap-3">
                <LawyerAvatar
                  name={chosenLawyer.fullName}
                  avatarUrl={chosenLawyer.avatarUrl}
                  avatarType={chosenLawyer.avatarType}
                  size={48}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-labelLarge text-on-surface">{chosenLawyer.fullName}</p>
                  <p className="text-caption text-muted">
                    {chosenLawyer.professionalTitle ?? "وکیل"}
                  </p>
                </div>
                <IconCheck size={20} className="shrink-0 text-control-selected" />
              </div>
              <button
                type="button"
                onClick={() => setLawyer(null)}
                className="mt-3 text-caption text-primary hover:underline"
              >
                تغییر وکیل
              </button>
            </div>
          ) : (
            <LawyerPicker
              category={draft.category}
              description={draft.description}
              selectedLawyerId={draft.lawyerId}
              onSelect={selectLawyer}
              onClear={() => setLawyer(null)}
            />
          )}
        </div>
      )}

      {/* Step 4 — review */}
      {step === 3 && (
        <div className="space-y-4">
          <dl className="divide-y divide-divider/60 rounded-xl border border-divider/60">
            <ReviewRow label="موضوع" value={LEGAL_CATEGORY_FA[draft.category] ?? draft.category} />
            <ReviewRow label="عنوان" value={draft.title} />
            <ReviewRow label="شرح" value={draft.description} />
            <ReviewRow label="فوریت" value={urgencyLabel(draft.urgency)} />
          </dl>

          {/* The selected lawyer — name, specialties and fee all derive from
              the one authoritative id, never from a stored display string. */}
          <LawyerReviewSection
            lawyerId={draft.lawyerId}
            lawyer={chosenLawyer}
            loading={lawyerLoading}
            error={lawyerError}
            onOpenSelector={() => setSelectorOpen(true)}
            onGoToStep={() => patch({ step: 2 })}
          />

          <dl className="divide-y divide-divider/60 rounded-xl border border-divider/60">
            <ReviewRow label="روش مشاوره" value="مشاوره متنی امن" />
            <ReviewRow
              label="پیوست‌ها"
              value={
                attachments.length > 0
                  ? `${toPersianNumber(attachments.length)} فایل`
                  : "بدون پیوست"
              }
            />
          </dl>

          {/* Payment is not integrated — show the real price, disable checkout. */}
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-container px-4 py-3">
            <span className="text-body-2 text-muted">پرداخت آنلاین</span>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="cursor-not-allowed rounded-xl bg-surface px-4 py-2 text-button text-muted"
            >
              پرداخت آنلاین — به‌زودی
            </button>
          </div>

          <InfoSharingNotice />

          <p className="text-caption text-muted">
            تا زمانی که وکیل درخواست را نپذیرد، می‌توانید آن را لغو یا به وکیل دیگری ارجاع دهید.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-error/10 px-3 py-2 text-caption text-error">
          <IconWarning size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="outlined"
          onClick={back}
          disabled={step === 0}
          startIcon={<IconArrowBack size={18} />}
        >
          مرحله قبل
        </Button>

        {step < STEP_TITLES.length - 1 ? (
          <Button onClick={next} disabled={!canAdvance} endIcon={<IconArrowForward size={18} />}>
            مرحله بعد
          </Button>
        ) : (
          <Button
            onClick={submit}
            loading={create.isPending}
            disabled={lawyerBlocked}
            startIcon={<IconCheck size={18} />}
          >
            ثبت درخواست مشاوره
          </Button>
        )}
      </div>

      {/* Drill-down replacement selector. Confirming swaps the draft's
          lawyer id; cancelling leaves the draft untouched. */}
      <LawyerSelectorDialog
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onConfirm={(l) => setLawyer(l.id)}
        currentLawyerId={draft.lawyerId}
      />
    </div>
  );
}

/**
 * The selected-lawyer block on the final preview. Renders one of four
 * states from the authoritative id: none chosen, loading, unresolvable /
 * ineligible, or a confirmed lawyer with a «تغییر وکیل» action.
 */
function LawyerReviewSection({
  lawyerId,
  lawyer,
  loading,
  error,
  onOpenSelector,
  onGoToStep,
}: {
  lawyerId: string | null;
  lawyer: LawyerDetail | undefined;
  loading: boolean;
  error: boolean;
  onOpenSelector: () => void;
  onGoToStep: () => void;
}) {
  // No lawyer chosen — a legitimate path (support assigns one), but the
  // selection UI must be offered rather than a silent default.
  if (!lawyerId) {
    return (
      <div className="rounded-xl border border-divider/60 p-4">
        <p className="text-labelLarge text-on-surface">وکیل</p>
        <p className="mt-1 text-body-2 text-muted">
          وکیلی انتخاب نشده است. می‌توانید وکیل انتخاب کنید، یا درخواست را بدون وکیل ثبت کنید تا
          تیم پشتیبانی وکیل مناسب را معرفی کند.
        </p>
        <Button
          variant="outlined"
          className="mt-3"
          onClick={onGoToStep}
          startIcon={<IconBalance size={18} />}
        >
          انتخاب وکیل
        </Button>
      </div>
    );
  }

  if (loading) {
    return <div className="h-28 animate-pulse rounded-xl bg-surface-container" />;
  }

  // The id no longer resolves — never substitute a default lawyer.
  if (error || !lawyer) {
    return (
      <div className="rounded-xl border border-error/40 bg-error/5 p-4">
        <div className="flex items-start gap-2 text-error">
          <IconWarning size={18} className="mt-0.5 shrink-0" />
          <p className="text-body-2">
            وکیل انتخاب‌شده یافت نشد یا دیگر در دسترس نیست. لطفاً وکیل دیگری انتخاب کنید.
          </p>
        </div>
        <Button
          variant="outlined"
          className="mt-3"
          onClick={onOpenSelector}
          startIcon={<IconBalance size={18} />}
        >
          انتخاب وکیل دیگر
        </Button>
      </div>
    );
  }

  const eligible = isEligible(lawyer);
  // Only specialties with a user-facing Persian label — a lawyer may carry
  // internal tags outside the canonical category vocabulary, and those must
  // never surface as a raw English slug.
  const specialties = lawyer.specializations
    .map((s) => s.category)
    .filter((slug) => slug in LEGAL_CATEGORY_FA)
    .map((slug) => LEGAL_CATEGORY_FA[slug]!)
    .join("، ");

  return (
    <div className="rounded-xl border border-divider/60 p-4">
      <div className="flex items-start gap-3">
        <LawyerAvatar
          name={lawyer.fullName}
          avatarUrl={lawyer.avatarUrl}
          avatarType={lawyer.avatarType}
          size={48}
        />
        <div className="min-w-0 flex-1">
          <p className="text-labelLarge text-on-surface">{lawyer.fullName}</p>
          <p className="text-caption text-muted">{lawyer.professionalTitle ?? "وکیل"}</p>
          {specialties && <p className="mt-1 text-caption text-muted">{specialties}</p>}
          <p className="mt-1 text-body-2 text-on-surface">
            هزینه مشاوره: {formatToman(lawyer.pricing.consultationFeeToman)}
          </p>
        </div>
      </div>

      {!eligible && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-error/10 px-3 py-2 text-caption text-error">
          <IconWarning size={16} className="mt-0.5 shrink-0" />
          <span>این وکیل در حال حاضر درخواست جدید نمی‌پذیرد. لطفاً وکیل دیگری انتخاب کنید.</span>
        </div>
      )}

      <button
        type="button"
        onClick={onOpenSelector}
        className="mt-3 text-caption text-primary hover:underline"
      >
        تغییر وکیل
      </button>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 mobile-l:flex-row mobile-l:items-start mobile-l:gap-4">
      <dt className="shrink-0 text-caption text-muted mobile-l:w-28">{label}</dt>
      <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-body-2 text-on-surface">
        {value}
      </dd>
    </div>
  );
}

function urgencyLabel(value: string): string {
  if (value === "urgent") return "فوری";
  if (value === "soon") return "در اسرع وقت";
  return "عادی";
}
