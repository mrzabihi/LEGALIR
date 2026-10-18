// ============================================================
// LEGALIR — Judicial review stage (draft versions)
// ============================================================
// The last stage. It shows ONE selected version at a time, always labelled with
// its number, producer and time, plus the warnings the composer attached.
//
// Rules this surface keeps:
//   • versions are append-only — saving an edit creates a NEW version and the
//     one it was edited from stays selectable, byte-for-byte;
//   • approval is explicit and applies to the NEWEST version only; approving a
//     superseded one is refused by the server (409 STALE_VERSION);
//   • approval means "the owner confirmed this text", never "filed". No status
//     in this feature claims a judicial act;
//   • on the ready-document path there is no AI draft at all: the artefact is
//     the finished document the user brought, and approval targets that.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { Button, Textarea } from "@legalir/ui";
import type {
  JudicialCompleteness,
  JudicialDraftVersion,
  JudicialReadyDocumentRef,
  JudicialRequest,
} from "@legalir/types";
import {
  JUDICIAL_DOCUMENT_TYPE_FA,
  JUDICIAL_DRAFT_GENERATOR_FA,
  JUDICIAL_REQUEST_STATUS_FA,
} from "@legalir/types";
import { StatusBadge, type StatusTone } from "@/components/shared";
import {
  IconCheck,
  IconFile,
  IconFileText,
  IconInfo,
  IconWarning,
} from "@/lib/icons";
import {
  useApproveJudicialDraft,
  useApproveJudicialReadyDocument,
  useJudicialDrafts,
  useReviseJudicialDraft,
} from "@/hooks/useJudicial";
import { formatFileSize, toPersianDate } from "@/lib/persian-utils";

const DRAFT_STATUS_FA: Record<JudicialDraftVersion["status"], string> = {
  draft: "پیش‌نویس",
  approved: "تأییدشده توسط شما",
  superseded: "نسخهٔ پیشین",
};

const DRAFT_STATUS_TONE: Record<JudicialDraftVersion["status"], StatusTone> = {
  draft: "info",
  approved: "success",
  superseded: "neutral",
};

function requestTone(status: JudicialRequest["status"]): StatusTone {
  if (status === "approved") return "success";
  if (status === "cancelled" || status === "archived") return "neutral";
  if (status === "needs_correction" || status === "needs_answers") return "warning";
  return "info";
}

export interface ReviewPanelProps {
  requestId: string;
  request: JudicialRequest;
  completeness: JudicialCompleteness;
  /** Drafts from the detail payload (also refreshed by the drafts query). */
  initialDrafts: JudicialDraftVersion[];
  readyDocumentPath: boolean;
  readyDocument: JudicialReadyDocumentRef | null;
  onGenerateMore: () => void;
  onFixAnswers: () => void;
  onBackToAnalysis: () => void;
}

export function ReviewPanel({
  requestId,
  request,
  completeness,
  initialDrafts,
  readyDocumentPath,
  readyDocument,
  onGenerateMore,
  onFixAnswers,
  onBackToAnalysis,
}: ReviewPanelProps) {
  const draftsQuery = useJudicialDrafts(requestId);
  const revise = useReviseJudicialDraft(requestId);
  const approveDraft = useApproveJudicialDraft(requestId);
  const approveReady = useApproveJudicialReadyDocument(requestId);

  const drafts = draftsQuery.data?.items ?? initialDrafts;
  const [selectedId, setSelectedId] = useState<string | null>(
    drafts[0]?.id ?? null
  );
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = drafts.find((d) => d.id === selectedId) ?? drafts[0] ?? null;
  const newest = drafts[0] ?? null;
  const isNewest = Boolean(selected && newest && selected.id === newest.id);
  const approvedVersion = drafts.find((d) => d.status === "approved") ?? null;

  // Never leave the editor showing a stale version's text after a switch.
  useEffect(() => {
    setEditing(false);
    setDraftText(selected?.text ?? "");
  }, [selected?.id, selected?.text]);

  async function saveEdit() {
    if (!selected) return;
    setError(null);
    try {
      const result = await revise.mutateAsync({
        draftId: selected.id,
        text: draftText,
      });
      // The edit produced a NEW version — select it so the user sees what was
      // actually saved, while the previous one stays in the list.
      setSelectedId(result.draft.id);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیرهٔ ویرایش ناموفق بود.");
    }
  }

  async function approve() {
    if (!selected) return;
    setError(null);
    try {
      await approveDraft.mutateAsync(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تأیید پیش‌نویس ناموفق بود.");
    }
  }

  async function approveReadyDocument() {
    setError(null);
    try {
      await approveReady.mutateAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تأیید سند ناموفق بود.");
    }
  }

  return (
    <section
      aria-labelledby="judicial-review-title"
      className="space-y-4 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="judicial-review-title"
              className="text-titleMedium text-on-surface"
            >
              پیش‌نویس و بازبینی
            </h2>
            <StatusBadge
              label={JUDICIAL_REQUEST_STATUS_FA[request.status]}
              tone={requestTone(request.status)}
            />
          </div>
          <p className="mt-1 text-body-2 leading-6 text-on-surface-variant">
            {request.documentType
              ? JUDICIAL_DOCUMENT_TYPE_FA[request.documentType]
              : "نوع سند نامشخص"}
            {" · "}
            {request.titleFa}
            {" · "}
            آخرین به‌روزرسانی {toPersianDate(request.updatedAt)}
          </p>
        </div>
        {drafts.length > 0 && (
          <Button
            variant="outlined"
            size="small"
            onClick={onGenerateMore}
            disabled={!completeness.complete}
          >
            ساخت نسخهٔ تازه از پاسخ‌های فعلی
          </Button>
        )}
      </div>

      {/* The standing human-review warning. */}
      <div className="flex items-start gap-2 rounded-medium bg-warning-50 px-3 py-2 text-caption leading-6 text-warning-700">
        <IconWarning size={15} className="mt-1 shrink-0" />
        <span>
          این متن یک پیش‌نویس قابل بازبینی است، نه سند ثبت‌شده در مرجع قضایی.
          پیش از هر اقدامی، متن را خودتان بخوانید و در صورت نیاز با یک وکیل
          بررسی کنید. لیگالیر هیچ سندی را برای شما ثبت، ارسال یا ابلاغ نمی‌کند.
        </span>
      </div>

      {completeness.contradictions.length > 0 && (
        <div className="rounded-medium bg-warning-50 px-3 py-2 text-caption leading-6 text-warning-700">
          <p className="font-medium">پاسخ‌های ناسازگار پیش از تأیید:</p>
          <ul className="mt-1 list-disc space-y-0.5 pe-5">
            {completeness.contradictions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <Button
            variant="outlined"
            size="small"
            className="mt-2"
            onClick={onFixAnswers}
          >
            اصلاح پاسخ‌ها
          </Button>
        </div>
      )}

      {/* Ready-document path: the artefact is the user's own finished file. */}
      {readyDocumentPath && (
        <div className="rounded-medium border border-[color:var(--color-outline-variant)] p-3">
          <h3 className="flex items-center gap-1.5 text-titleSmall text-on-surface">
            <IconFile size={16} className="text-on-surface-variant" />
            سند آمادهٔ شما
          </h3>
          {readyDocument ? (
            <>
              <p className="mt-1 text-body-2 text-on-surface">{readyDocument.name}</p>
              <p className="text-caption text-on-surface-variant">
                {formatFileSize(readyDocument.sizeBytes)}
                {" · "}
                {readyDocument.textReviewed
                  ? "متن استخراج‌شده را بررسی کرده‌اید."
                  : "متن استخراج‌شده هنوز بررسی نشده است؛ متن استخراج‌شده تأیید اصالت سند نیست."}
              </p>
              <div className="mt-3">
                {request.status === "approved" ? (
                  <p className="flex items-center gap-1.5 text-body-2 text-success">
                    <IconCheck size={16} />
                    شما این سند را
                    {request.completedAt
                      ? ` در ${toPersianDate(request.completedAt)}`
                      : ""}{" "}
                    تأیید کرده‌اید.
                  </p>
                ) : (
                  <Button
                    onClick={() => void approveReadyDocument()}
                    loading={approveReady.isPending}
                    startIcon={<IconCheck size={16} />}
                  >
                    تأیید این سند توسط من
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="mt-1 text-body-2 text-on-surface-variant">
              هنوز سندی برای این مسیر انتخاب نشده است. برای تأیید نهایی، ابتدا
              سند را در مرحلهٔ مدارک انتخاب کنید.
            </p>
          )}
        </div>
      )}

      {/* AI-draft path. */}
      {!readyDocumentPath && drafts.length === 0 && (
        <div className="rounded-medium bg-surface-container-low p-3">
          <p className="text-body-2 text-on-surface-variant">
            هنوز پیش‌نویسی ساخته نشده است.
          </p>
          <Button
            className="mt-2"
            onClick={onGenerateMore}
            disabled={!completeness.complete}
          >
            ساخت پیش‌نویس از پاسخ‌های من
          </Button>
          {!completeness.complete && (
            <p className="mt-2 text-caption text-on-surface-variant">
              پیش از ساخت پیش‌نویس، پاسخ‌های ضروری باید کامل شوند.
            </p>
          )}
        </div>
      )}

      {!readyDocumentPath && drafts.length > 0 && selected && (
        <>
          {/* Version list — every version stays selectable. */}
          <div>
            <h3 className="mb-2 text-titleSmall text-on-surface">نسخه‌ها</h3>
            <ul className="flex flex-wrap gap-2">
              {drafts.map((d) => {
                const active = d.id === selected.id;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(d.id)}
                      aria-pressed={active}
                      className={[
                        "rounded-medium border px-3 py-2 text-start transition-colors",
                        active
                          ? "border-primary bg-primary-container"
                          : "border-[color:var(--color-outline-variant)] bg-surface hover:border-primary",
                      ].join(" ")}
                    >
                      <span className="block text-labelLarge text-on-surface">
                        نسخهٔ {d.version.toLocaleString("fa-IR")}
                      </span>
                      <span className="mt-0.5 block text-caption text-on-surface-variant">
                        {DRAFT_STATUS_FA[d.status]}
                        {" · "}
                        {toPersianDate(d.createdAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-medium border border-[color:var(--color-outline-variant)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={DRAFT_STATUS_FA[selected.status]}
                tone={DRAFT_STATUS_TONE[selected.status]}
              />
              <span className="text-caption text-on-surface-variant">
                {JUDICIAL_DRAFT_GENERATOR_FA[selected.generator]}
                {" · "}
                {toPersianDate(selected.createdAt)}
                {" · "}
                {selected.providerConfigured
                  ? `مدل: ${selected.model}`
                  : "بدون مدل بیرونی — چیدمان از پاسخ‌های شما"}
              </span>
              {!isNewest && (
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-caption text-on-surface-variant">
                  نسخهٔ قدیمی‌تر
                </span>
              )}
            </div>

            {selected.warnings.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pe-5 text-caption leading-6 text-warning-700">
                {selected.warnings.map((w, i) => (
                  <li key={`${i}-${w}`}>{w}</li>
                ))}
              </ul>
            )}
            {selected.ambiguitiesFa.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pe-5 text-caption leading-6 text-on-surface-variant">
                {selected.ambiguitiesFa.map((a, i) => (
                  <li key={`${i}-${a}`}>{a}</li>
                ))}
              </ul>
            )}

            <div className="mt-3">
              {editing ? (
                <>
                  <Textarea
                    label="متن پیش‌نویس"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    rows={18}
                    fullWidth
                    maxLength={120_000}
                    showCharCount
                    supportingText="ذخیره، یک نسخهٔ تازه می‌سازد؛ نسخهٔ فعلی دست‌نخورده می‌ماند."
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      onClick={() => void saveEdit()}
                      loading={revise.isPending}
                      disabled={!draftText.trim()}
                    >
                      ذخیره به‌عنوان نسخهٔ تازه
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => {
                        setEditing(false);
                        setDraftText(selected.text);
                      }}
                      disabled={revise.isPending}
                    >
                      انصراف
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div
                    dir="rtl"
                    className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-medium bg-surface-container-low p-3 text-body-2 leading-7 text-on-surface"
                  >
                    {selected.text}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setDraftText(selected.text);
                        setEditing(true);
                      }}
                    >
                      ویرایش متن
                    </Button>
                  </div>
                </>
              )}
            </div>

            {isNewest && selected.status !== "approved" && (
              <div className="mt-3">
                <Button
                  onClick={() => void approve()}
                  loading={approveDraft.isPending}
                  startIcon={<IconCheck size={16} />}
                >
                  تأیید این نسخه توسط من
                </Button>
                <p className="mt-1.5 text-caption leading-6 text-on-surface-variant">
                  تأیید یعنی «متن را خوانده و قبول کرده‌اید»؛ نه ثبت در مرجع
                  قضایی.
                </p>
              </div>
            )}

            {!isNewest && (
              <p className="mt-3 flex items-start gap-1.5 text-caption leading-6 text-on-surface-variant">
                <IconInfo size={14} className="mt-1 shrink-0" />
                فقط جدیدترین نسخه قابل تأیید است. برای ادامه از همین متن، آن را
                ویرایش کنید تا نسخهٔ تازه‌ای ساخته شود.
              </p>
            )}
          </div>

          {selected.references.length > 0 && (
            <div>
              <h3 className="text-titleSmall text-on-surface">
                منابع حقوقی این نسخه
              </h3>
              <ul className="mt-1 space-y-1.5">
                {selected.references.map((r) => (
                  <li
                    key={`${r.sourceId}-${r.locator}`}
                    className="rounded-medium border border-[color:var(--color-outline-variant)] p-2.5"
                  >
                    <p className="text-labelLarge text-on-surface">{r.title}</p>
                    <p className="mt-0.5 text-caption text-on-surface-variant">
                      {r.locator}
                      {" · "}
                      {r.tierFa}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {approvedVersion && !readyDocumentPath && (
        <p className="flex items-center gap-1.5 rounded-medium bg-success-container px-3 py-2 text-body-2 text-success">
          <IconCheck size={16} className="shrink-0" />
          نسخهٔ {approvedVersion.version.toLocaleString("fa-IR")} توسط شما تأیید شده
          است
          {approvedVersion.approvedAt
            ? ` (${toPersianDate(approvedVersion.approvedAt)})`
            : ""}
          . این تأیید ثبت قضایی نیست.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-medium bg-error-container px-3 py-2 text-body-2 text-error"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="text"
          onClick={onBackToAnalysis}
          startIcon={<IconFileText size={16} />}
        >
          بازگشت به جمع‌بندی
        </Button>
      </div>
    </section>
  );
}
