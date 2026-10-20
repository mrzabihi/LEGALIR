// ============================================================
// LEGALIR — «شروع درخواست حقوقی» panel (smart intake on /new)
// ============================================================
// A single, prominent entry point that lets the user describe their
// legal problem in their own words, optionally attach a document, and
// hand that request to `/Suggest_law` — which then shows how LEGALIR
// understood it and which REAL, currently-enabled routes it can offer.
//
// Design rules it follows:
//   • the main input is the description; the specialist choices are a
//     short optional row, revealed only as far as they help;
//   • a clarifying question (the legal area) is asked only when the
//     description is too thin to route on its own;
//   • confirming does NOT jump to a destination or run anything: it
//     hands the request to /Suggest_law, which owns the "what we
//     understood / where we can go" step (see app/(app)/Suggest_law);
//   • nothing is fabricated: this panel only POINTS at real pages. It
//     creates no chat, form, request or AI run by itself.
//
// It reuses: the shared Textarea/Selectable controls; the existing
// document upload hooks and UploadZone; and the guarded localStorage
// hand-off (`writeSuggestLawDraft`) — never a query string, so a
// description or a document name can never leak into the URL, history
// or server logs.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SelectableOption, Textarea, Button } from "@legalir/ui";
import { UploadZone } from "@/components/documents/upload-zone";
import { useDocuments, useInitiateUpload, useCompleteUpload } from "@/hooks/useDocuments";
import {
  IconCheck,
  IconClose,
  IconDocument,
  IconFile,
  IconInfo,
  IconUpload,
  IconWarning,
} from "@/lib/icons";
import { composerPlaceholder } from "@/lib/ai/service-context";
import {
  INTAKE_INTENT_OPTIONS,
  INTAKE_CATEGORY_CHOICES,
  SUGGEST_LAW_PATH,
  buildSuggestLawDraft,
  categoryLabel,
  needsClarification,
  suggestCategorySlug,
  suggestIntents,
  writeSuggestLawDraft,
  type IntakeIntent,
} from "@/lib/intake/start-request";
import { consumeLandingStartDraft } from "@/lib/intake/landing-start-draft";

interface AttachedDoc {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
}

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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  const { data: documents } = useDocuments({ pageSize: 20 });
  const initiate = useInitiateUpload();
  const complete = useCompleteUpload();

  // A description handed over from the landing card («از کجا شروع کنم؟»).
  // Consumed exactly once — the read also clears it, so reloading the panel
  // never resurrects old text. On mount only: after this the box belongs to
  // the user.
  useEffect(() => {
    const carried = consumeLandingStartDraft();
    if (carried) setText(carried);
  }, []);

  const hasText = text.trim().length > 0;

  // The route the text points at, most-likely first. Deterministic — a
  // hint, never a verdict. /Suggest_law re-derives the same hints and
  // gates them on the platform's real capabilities.
  const suggestions = useMemo(
    () => suggestIntents(text, { hasDocument: document !== null }),
    [text, document]
  );

  // The intent currently hinted at the user, used only for the
  // placeholder + the "پیشنهاد ما" line.
  const effectiveIntent: IntakeIntent = intent ?? suggestions[0] ?? "legal_question";

  // Only ask the clarifying question when the text is too thin AND the
  // user has not already told us what they want.
  const showClarify = needsClarification(text) && intent === null;
  const categorySuggestion = suggestCategorySlug(text);

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

  /**
   * Hand the request to /Suggest_law. We persist the description, the
   * help-type pick, the legal area and any attachment with a guarded
   * localStorage write (the SAME pattern the consultation wizard uses).
   * If storage is unavailable we surface a clear error and stay put —
   * the request is never silently dropped.
   */
  function goToSuggestion() {
    if (!hasText) return;
    setHandoffError(null);
    const ok = writeSuggestLawDraft(
      buildSuggestLawDraft({ text, intent, category, document })
    );
    if (!ok) {
      setHandoffError(
        "ذخیرهٔ موقت درخواست ممکن نشد. لطفاً حافظهٔ مرورگر را بررسی کن یا دوباره تلاش کن."
      );
      return;
    }
    router.push(SUGGEST_LAW_PATH);
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

      {/* Primary input — the user's own words. */}
      <Textarea
        id="start-request-text"
        label="موضوع حقوقی‌ات را بنویس"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setIntent(null); // a changed description invalidates a stale pick
          if (handoffError) setHandoffError(null);
        }}
        rows={4}
        fullWidth
        placeholder={INTENT_PLACEHOLDER[effectiveIntent]}
        supportingText="هرچه دقیق‌تر بنویسی، مسیر دقیق‌تری پیشنهاد می‌شود."
      />

      {/* Attachment — optional, carried into the suggestion step. */}
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => setUploadOpen(true)}
            startIcon={<IconUpload size={18} />}
          >
            افزودن سند (اختیاری)
          </Button>
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

      {handoffError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-medium bg-error-container px-3 py-2 text-caption text-error"
        >
          <IconWarning size={16} className="mt-0.5 shrink-0" />
          <span>{handoffError}</span>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          variant="filled"
          size="large"
          onClick={goToSuggestion}
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
    </section>
  );
}
