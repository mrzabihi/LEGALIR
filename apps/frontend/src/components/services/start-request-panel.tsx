// ============================================================
// LEGALIR — «شروع درخواست حقوقی» panel (smart intake on /new)
// ============================================================
// A single, prominent entry point that lets the user describe their
// legal problem in their own words, optionally attach a document, and
// be routed to the RIGHT existing LEGALIR flow — without knowing the
// service's name or jargon up front.
//
// Design rules it follows:
//   • the main input is the description; the specialist choices are a
//     short optional row, revealed only as far as they help;
//   • a clarifying question (the legal area) is asked only when the
//     description is too thin to route on its own;
//   • the system shows its understanding — the route it picked and why —
//     and the user confirms (or goes back) BEFORE anything runs;
//   • nothing is fabricated: this panel only POINTS at real pages. It
//     creates no chat, form, request or AI run by itself.
//
// It reuses: the shared Textarea/Selectable controls; the existing
// document upload hooks and UploadZone; the chat surface's `?ask=` +
// `?attachedDocument*` params; the consultation wizard's localStorage
// draft; and the calculators/contracts/consultations routes.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SelectableOption, Textarea, Button } from "@legalir/ui";
import { UploadZone } from "@/components/documents/upload-zone";
import { useDocuments, useInitiateUpload, useCompleteUpload } from "@/hooks/useDocuments";
import { useDailyQuota } from "@/hooks/useDashboard";
import {
  IconCheck,
  IconClose,
  IconDocument,
  IconFile,
  IconInfo,
  IconUpload,
  IconWarning,
} from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import { composerPlaceholder } from "@/lib/ai/service-context";
import {
  INTAKE_INTENT_OPTIONS,
  INTAKE_CATEGORY_CHOICES,
  buildConsultationDraft,
  categoryLabel,
  chatQuery,
  describeDestination,
  needsClarification,
  resolveDestination,
  suggestCategorySlug,
  suggestIntents,
  writeConsultationDraft,
  type IntakeIntent,
} from "@/lib/intake/start-request";

interface AttachedDoc {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
}

type Phase = "describe" | "confirm";

const INTENT_PLACEHOLDER: Record<IntakeIntent, string> = {
  legal_question: composerPlaceholder("legal_consultation"),
  document_review: composerPlaceholder("document_analysis"),
  draft_document: composerPlaceholder("contract_drafting"),
  calculation: composerPlaceholder("legal_calculation"),
  next_step: "وضعیت کاری که می‌خواهی ادامه بدهی را توضیح بده…",
  lawyer: "موضوع را طوری بنویس که وکیل بتواند بهتر کمکت کند…",
};

function intentLabel(intent: IntakeIntent): string {
  return INTAKE_INTENT_OPTIONS.find((o) => o.id === intent)?.titleFa ?? "مسیر پیشنهادی";
}

export function StartRequestPanel() {
  const router = useRouter();

  const [text, setText] = useState("");
  const [intent, setIntent] = useState<IntakeIntent | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [document, setDocument] = useState<AttachedDoc | null>(null);
  const [phase, setPhase] = useState<Phase>("describe");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: documents } = useDocuments({ pageSize: 20 });
  const initiate = useInitiateUpload();
  const complete = useCompleteUpload();
  const { data: quota } = useDailyQuota();

  const hasText = text.trim().length > 0;

  // The route the text points at, most-likely first. Deterministic — a
  // hint, never a verdict.
  const suggestions = useMemo(
    () => suggestIntents(text, { hasDocument: document !== null }),
    [text, document]
  );

  // The intent in force: an explicit pick wins, otherwise the top hint.
  const effectiveIntent: IntakeIntent = intent ?? suggestions[0] ?? "legal_question";

  // Only ask the clarifying question when the text is too thin AND the
  // user has not already told us what they want.
  const showClarify = needsClarification(text) && intent === null;
  const categorySuggestion = suggestCategorySlug(text);

  const dest = resolveDestination({
    intent: effectiveIntent,
    text,
    documentId: document?.id ?? null,
    category,
  });
  const summary = describeDestination(dest);

  async function handleAttach(file: File) {
    setUploadError(null);
    try {
      const init = await initiate.mutateAsync({
        name: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });
      const doc = await complete.mutateAsync({ id: init.id, file });
      setDocument({
        id: doc.id,
        name: doc.name,
        mime: doc.mime,
        sizeBytes: doc.sizeBytes,
      });
      setUploadOpen(false);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "بارگذاری فایل ناموفق بود");
    }
  }

  function pickExistingDoc(doc: AttachedDoc) {
    setDocument(doc);
    setUploadOpen(false);
  }

  function confirm() {
    if (!hasText) return;
    setPhase("confirm");
  }

  function execute() {
    switch (dest.kind) {
      case "chat":
        router.push(
          `/chat/new?${chatQuery({
            serviceType: dest.serviceType,
            text,
            document,
          })}`
        );
        return;
      case "document":
        router.push(`/documents/${dest.documentId}`);
        return;
      case "document_upload":
        router.push("/documents/upload");
        return;
      case "contracts_new":
        router.push("/contracts/new");
        return;
      case "calculator":
        router.push(dest.slug ? `/calculators/${dest.slug}` : "/calculators");
        return;
      case "consultations_list":
        router.push("/consultations");
        return;
      case "consultation_wizard":
        // Reuse the wizard's own localStorage draft so the description,
        // category and any attachment arrive pre-filled.
        writeConsultationDraft(
          buildConsultationDraft({
            text,
            category: dest.category,
            attachmentIds: document ? [document.id] : [],
          })
        );
        router.push("/consultations/new");
        return;
    }
  }

  const uploading = initiate.isPending || complete.isPending;

  return (
    <section
      aria-labelledby="start-request-heading"
      className="relative mb-6 overflow-hidden rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface p-5 shadow-elevation-2 tablet:p-6"
    >
      <div className="mb-4 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-primary-container text-primary"
        >
          <IconInfo size={22} />
        </span>
        <div className="min-w-0">
          <h2 id="start-request-heading" className="text-h3 font-bold text-on-surface">
            شروع درخواست حقوقی
          </h2>
          <p className="mt-1 text-body-2 leading-relaxed text-muted">
            موضوع حقوقی‌ات را توضیح بده؛ اگر سندی داری اضافه کن تا مسیر مناسب را پیشنهاد کنیم.
          </p>
        </div>
      </div>

      {phase === "describe" ? (
        <>
          {/* Primary input — the user's own words. */}
          <Textarea
            id="start-request-text"
            label="موضوع حقوقی‌ات را بنویس"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setIntent(null); // a changed description invalidates a stale pick
            }}
            rows={4}
            fullWidth
            placeholder={INTENT_PLACEHOLDER[effectiveIntent]}
            supportingText="هرچه دقیق‌تر بنویسی، مسیر دقیق‌تری پیشنهاد می‌شود."
          />

          {/* Attachment — optional, carried into the destination. */}
          <div className="mt-4">
            {document ? (
              <div className="flex items-center gap-3 rounded-medium border border-divider px-3 py-2.5">
                <IconFile size={18} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-body-2 text-on-surface">
                  {document.name}
                </span>
                <button
                  type="button"
                  aria-label="حذف سند پیوست"
                  onClick={() => setDocument(null)}
                  className="shrink-0 rounded-full p-1 text-muted transition hover:bg-error-container hover:text-error"
                >
                  <IconClose size={16} />
                </button>
              </div>
            ) : !uploadOpen ? (
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="inline-flex items-center gap-2 rounded-medium border border-divider px-4 py-2 text-labelMedium text-on-surface transition-colors hover:border-primary hover:bg-primary-container/40 touch-target"
              >
                <IconUpload size={18} />
                افزودن سند (اختیاری)
              </button>
            ) : (
              <div className="space-y-3 rounded-medium border border-divider p-3">
                <div className="flex items-center justify-between">
                  <span className="text-labelMedium text-on-surface">افزودن سند</span>
                  <button
                    type="button"
                    aria-label="بستن بخش سند"
                    onClick={() => setUploadOpen(false)}
                    className="rounded-full p-1 text-muted transition hover:bg-surface-hover"
                  >
                    <IconClose size={16} />
                  </button>
                </div>

                <UploadZone onFile={handleAttach} disabled={uploading} />

                {documents && documents.items.length > 0 && (
                  <div>
                    <p className="mb-2 text-caption text-muted">یا از اسناد موجود انتخاب کن</p>
                    <div className="flex flex-wrap gap-2">
                      {documents.items.slice(0, 8).map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() =>
                            pickExistingDoc({
                              id: d.id,
                              name: d.name,
                              mime: d.mime,
                              sizeBytes: d.sizeBytes,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-divider px-3 py-1.5 text-caption text-on-surface transition hover:border-primary hover:bg-primary-container"
                        >
                          <IconDocument size={14} />
                          {d.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="flex items-start gap-2 rounded-medium bg-error-container px-3 py-2 text-caption text-error">
                    <IconWarning size={16} className="mt-0.5 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Optional specialist choice — a short, plain-language row. */}
          <div className="mt-5">
            <p className="mb-2 text-labelMedium text-on-surface">
              چه کمکی لازم داری؟ <span className="text-muted">(اختیاری)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {INTAKE_INTENT_OPTIONS.map((opt) => {
                const suggested = suggestions.includes(opt.id) && intent === null;
                return (
                  <SelectableOption
                    key={opt.id}
                    label={suggested ? `${opt.titleFa} · پیشنهاد` : opt.titleFa}
                    selected={intent === opt.id}
                    onClick={() => setIntent(intent === opt.id ? null : opt.id)}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-caption text-muted">
              می‌توانی یکی را انتخاب کنی یا فقط موضوع را بنویسی؛ ما مناسب‌ترین مسیر را پیشنهاد
              می‌دهیم.
            </p>
          </div>

          {/* Progressive clarifying question — only when the text is thin. */}
          {showClarify && (
            <div className="mt-5 rounded-medium bg-surface-container p-4">
              <p className="mb-2 text-labelMedium text-on-surface">موضوع در کدام حوزه است؟</p>
              <div className="flex flex-wrap gap-2">
                {INTAKE_CATEGORY_CHOICES.map((slug) => (
                  <SelectableOption
                    key={slug}
                    label={categoryLabel(slug) ?? slug}
                    selected={category === slug}
                    onClick={() => setCategory(category === slug ? null : slug)}
                  />
                ))}
              </div>
              {categorySuggestion && (
                <p className="mt-2 text-caption text-muted">
                  حدس ما: {categoryLabel(categorySuggestion)}
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              variant="filled"
              size="large"
              onClick={confirm}
              disabled={!hasText}
              startIcon={<IconCheck size={18} />}
            >
              دریافت مسیر پیشنهادی
            </Button>
            {hasText && (
              <p className="text-caption text-muted">
                پیشنهاد ما:{" "}
                <span className="text-on-surface">{intentLabel(suggestions[0] ?? "legal_question")}</span>
              </p>
            )}
          </div>
        </>
      ) : (
        /* Confirm — show what we understood and where we will go, and let
           the user change course before anything runs. */
        <div className="space-y-4">
          <div>
            <h3 className="text-titleMedium text-on-surface">برداشت ما از درخواستت</h3>
            <p className="mt-1 text-bodySmall text-muted">
              اگر درست است ادامه بده؛ در غیر این صورت ویرایش کن یا مسیر را عوض کن.
            </p>
          </div>

          <dl className="divide-y divide-divider rounded-medium border border-divider">
            <SummaryRow label="شرح شما" value={text.trim()} />
            {document && <SummaryRow label="سند پیوست" value={document.name} />}
            {category && <SummaryRow label="حوزه" value={categoryLabel(category) ?? category} />}
            <SummaryRow label="مسیر پیشنهادی" value={summary.titleFa} />
            <SummaryRow label="چه اتفاقی می‌افتد" value={summary.detailFa} />
          </dl>

          {summary.usesDailyQuota && (
            <p className="flex items-start gap-2 rounded-medium bg-surface-container px-3 py-2 text-caption text-muted">
              <IconInfo size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>
                ارسال پرسش در گفت‌وگو از سهمیهٔ روزانهٔ شما استفاده می‌کند
                {quota && quota.total > 0
                  ? ` (${toPersianNumber(quota.remaining)} از ${toPersianNumber(quota.total)} باقی مانده).`
                  : "."}
              </span>
            </p>
          )}

          <p className="flex items-start gap-2 rounded-medium bg-surface-container-low px-3 py-2 text-caption text-muted">
            <IconWarning size={16} className="mt-0.5 shrink-0 text-[var(--brand-gold)]" />
            <span>
              خروجی هوش مصنوعی لیگالیر تحلیل اولیه است و جایگزین نظر وکیل نیست. منبع یا ماده‌ای
              ساختگی تولید نمی‌شود و در صورت نبودن مستند، صریح گفته می‌شود.
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="filled"
              size="large"
              onClick={execute}
              startIcon={<IconCheck size={18} />}
            >
              ادامه
            </Button>
            <Button variant="text" size="large" onClick={() => setPhase("describe")}>
              ویرایش
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 mobile-l:flex-row mobile-l:items-start mobile-l:gap-4">
      <dt className="shrink-0 text-caption text-muted mobile-l:w-28">{label}</dt>
      <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-body-2 text-on-surface">
        {value}
      </dd>
    </div>
  );
}
