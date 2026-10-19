// ============================================================
// LEGALIR — Judicial review workspace (owner side)
// ============================================================
// The one surface where the owner hands a draft to a human and receives the
// issued artifact. It renders ONLY what the server reports:
//
//   • the request's reviews, newest first, each with its OWNER-VISIBLE
//     timeline — internal operator notes are filtered in the persistence
//     layer, so nothing here needs to decide what is safe to show;
//   • a submit form bound to a concrete, selected draft version (the review
//     binds to that version's sha256; any later edit invalidates approval);
//   • the owner's own actions on an OPEN review — reply, resubmit a newer
//     version, or withdraw — all of which append history, never overwrite it;
//   • the issued artifact once an admin approval has produced it: inline
//     preview, download of those exact bytes, and the share/copy affordance.
//
// What it never does: claim the document was filed, promise an outcome, show
// an internal note, or issue anything itself. Only an admin decision can
// create the final document, and this component merely reads the register.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { Button, Textarea, snackbar } from "@legalir/ui";
import type {
  JudicialDraftVersion,
  JudicialFinalDocument,
  JudicialRequest,
  JudicialReviewDetail,
  JudicialReviewEvent,
  JudicialReviewStatus,
} from "@legalir/types";
import {
  JUDICIAL_REVIEW_KIND_FA,
  JUDICIAL_REVIEW_STATUS_FA,
} from "@legalir/types";
import { StatusBadge, type StatusTone } from "@/components/shared";
import {
  IconCheck,
  IconDownload,
  IconFileText,
  IconInfo,
  IconRefresh,
  IconSend,
  IconShare,
  IconWarning,
} from "@/lib/icons";
import {
  useActOnJudicialReview,
  useJudicialReviews,
  useSubmitJudicialReview,
} from "@/hooks/useJudicial";
import { judicialFinalDocumentUrl } from "@/lib/api/judicial";
import { formatFileSize, toPersianDate } from "@/lib/persian-utils";

const REVIEW_TONE: Record<JudicialReviewStatus, StatusTone> = {
  pending: "info",
  in_progress: "info",
  waiting_user: "warning",
  changes_requested: "warning",
  approved: "success",
  rejected: "error",
  cancelled: "neutral",
};

/** A review the owner can still act on. */
const OPEN_REVIEW: readonly JudicialReviewStatus[] = [
  "pending",
  "in_progress",
  "waiting_user",
  "changes_requested",
];

/** Event kinds whose body is a message the owner may read. */
const MESSAGE_KINDS = new Set<JudicialReviewEvent["kind"]>([
  "note",
  "change_request",
  "approval_note",
  "user_reply",
  "revision",
  "resubmitted",
  "approved",
  "rejected",
  "cancelled",
]);

const EVENT_LABEL_FA: Record<JudicialReviewEvent["kind"], string> = {
  submitted: "ارسال برای بررسی",
  assigned: "تخصیص به کارشناس",
  note: "یادداشت",
  change_request: "درخواست اصلاح",
  approval_note: "یادداشت تأیید",
  revision: "بازبینی نسخه",
  user_reply: "پاسخ شما",
  resubmitted: "ارسال نسخهٔ جدید",
  approved: "تأیید و صدور نسخهٔ نهایی",
  rejected: "رد درخواست",
  cancelled: "لغو بررسی",
  final_issued: "صدور نسخهٔ نهایی",
  status_changed: "تغییر وضعیت",
};

const AUTHOR_FA: Record<JudicialReviewEvent["authorKind"], string> = {
  owner: "شما",
  admin: "کارشناس لیگالیر",
  lawyer: "وکیل",
  system: "سامانه",
};

// ============================================================
// Timeline
// ============================================================

function ReviewTimeline({ review }: { review: JudicialReviewDetail }) {
  // The projection may include internal notes in some payloads; `visibleToOwner`
  // is the server's own answer about what may be shown, so it is honoured here
  // too rather than relying on the projection alone.
  const events = useMemo(
    () => review.events.filter((e) => e.visibleToOwner !== false),
    [review.events]
  );

  if (events.length === 0) {
    return (
      <p className="text-caption text-on-surface-variant">
        هنوز رویدادی برای این بررسی ثبت نشده است.
      </p>
    );
  }

  return (
    <ol className="relative ms-2 space-y-3 border-s border-[color:var(--color-outline-variant)] ps-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            aria-hidden="true"
            className="absolute -start-[1.36rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--color-outline)] ring-4 ring-[color:var(--color-surface)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-labelLarge text-on-surface">
              {EVENT_LABEL_FA[event.kind] ?? event.kind}
            </span>
            <span className="text-caption text-on-surface-variant">
              {event.authorLabelFa || AUTHOR_FA[event.authorKind]}
              {event.versionNumber
                ? ` · نسخهٔ ${event.versionNumber.toLocaleString("fa-IR")}`
                : ""}
              {" · "}
              {toPersianDate(event.createdAt)}
            </span>
          </div>
          {event.bodyFa && MESSAGE_KINDS.has(event.kind) && (
            <p className="mt-1 whitespace-pre-wrap rounded-medium bg-surface-container-low px-3 py-2 text-body-2 leading-7 text-on-surface">
              {event.bodyFa}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

// ============================================================
// The issued artifact
// ============================================================

function FinalDocumentCard({
  requestId,
  document,
}: {
  requestId: string;
  document: JudicialFinalDocument;
}) {
  const [shared, setShared] = useState(false);

  async function share() {
    const url = `${window.location.origin}${judicialFinalDocumentUrl(requestId)}`;
    const data = {
      title: `نسخهٔ نهایی ${document.fileName}`,
      text: `نسخهٔ نهایی لیگالیر — شمارهٔ ${document.serialFa}`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      snackbar.show({ message: "پیوند نسخهٔ نهایی کپی شد", variant: "success" });
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      // A dismissed share sheet is not an error the user needs to see.
    }
  }

  return (
    <div className="rounded-large border border-[color:var(--color-outline-variant)] bg-success-container/40 p-4">
      <h3 className="flex items-center gap-2 text-titleSmall text-on-surface">
        <IconCheck size={18} className="text-success" aria-hidden="true" />
        نسخهٔ نهایی صادر شده است
      </h3>
      <p className="mt-1 text-body-2 text-on-surface-variant">
        شمارهٔ سند: <span className="font-medium text-on-surface">{document.serialFa}</span>
        {" · "}
        نسخهٔ {document.versionNumber.toLocaleString("fa-IR")}
        {" · "}
        {toPersianDate(document.issuedAt)}
      </p>
      <p className="mt-0.5 text-caption text-on-surface-variant">
        {document.fileName} · {formatFileSize(document.sizeBytes)} ·{" "}
        {document.pageCount.toLocaleString("fa-IR")} صفحه
        {document.approvedByInitials ? ` · تأیید: ${document.approvedByInitials}` : ""}
      </p>
      <p className="mt-1 break-all text-caption text-on-surface-variant" dir="ltr">
        SHA-256: {document.pdfHash}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={judicialFinalDocumentUrl(requestId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex"
        >
          <Button variant="outlined" size="small" startIcon={<IconFileText size={16} />}>
            پیش‌نمایش سند
          </Button>
        </a>
        <a href={judicialFinalDocumentUrl(requestId, true)} className="inline-flex">
          <Button size="small" startIcon={<IconDownload size={16} />}>
            دانلود PDF
          </Button>
        </a>
        <Button
          variant="outlined"
          size="small"
          onClick={() => void share()}
          startIcon={<IconShare size={16} />}
        >
          {shared ? "کپی شد" : "اشتراک‌گذاری"}
        </Button>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-caption leading-6 text-on-surface-variant">
        <IconInfo size={14} className="mt-1 shrink-0" />
        این نسخه دقیقاً همان متنی است که کارشناس تأیید کرده است. لیگالیر آن را
        ثبت، ارسال یا ابلاغ نمی‌کند؛ اقدام قضایی با خودتان یا وکیل است.
      </p>
    </div>
  );
}

// ============================================================
// One review
// ============================================================

function ReviewCard({
  requestId,
  review,
  drafts,
  onChanged,
}: {
  requestId: string;
  review: JudicialReviewDetail;
  drafts: JudicialDraftVersion[];
  onChanged: () => void;
}) {
  const act = useActOnJudicialReview(requestId);
  const [reply, setReply] = useState("");
  const [resubmitId, setResubmitId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const isOpen = OPEN_REVIEW.includes(review.status);
  const canCancel = review.status !== "approved" && review.status !== "rejected";

  // A resubmission must be a version the review has not already bound to.
  const candidates = drafts.filter(
    (d) => d.id !== review.submittedVersionId && d.text.trim().length > 0
  );

  function run(action: "reply" | "resubmit" | "cancel") {
    setError(null);
    setBusyAction(action);
    act.mutate(
      {
        reviewId: review.id,
        action,
        bodyFa: action === "reply" ? reply.trim() : undefined,
        versionId: action === "resubmit" ? resubmitId : undefined,
      },
      {
        onSuccess: () => {
          setReply("");
          setResubmitId("");
          snackbar.show({
            message:
              action === "cancel"
                ? "بررسی لغو شد"
                : action === "resubmit"
                  ? "نسخهٔ جدید ارسال شد"
                  : "پاسخ شما ثبت شد",
            variant: "success",
          });
          onChanged();
        },
        onError: (e) => {
          setError(e instanceof Error ? e.message : "این عملیات انجام نشد.");
        },
        onSettled: () => setBusyAction(null),
      }
    );
  }

  return (
    <div className="rounded-medium border border-[color:var(--color-outline-variant)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={JUDICIAL_REVIEW_STATUS_FA[review.status]}
          tone={REVIEW_TONE[review.status]}
        />
        <span className="text-labelLarge text-on-surface">
          {JUDICIAL_REVIEW_KIND_FA[review.kind]}
        </span>
        <span className="text-caption text-on-surface-variant">
          نسخهٔ {review.submittedVersionNumber.toLocaleString("fa-IR")}
          {" · "}
          {toPersianDate(review.createdAt)}
          {review.decidedAt ? ` · تعیین تکلیف: ${toPersianDate(review.decidedAt)}` : ""}
        </span>
      </div>

      {review.noteFa && (
        <p className="mt-2 whitespace-pre-wrap rounded-medium bg-surface-container-low px-3 py-2 text-body-2 leading-7 text-on-surface">
          <span className="text-caption text-on-surface-variant">پرسش شما: </span>
          {review.noteFa}
        </p>
      )}

      {review.decisionNoteFa && (
        <p
          className={[
            "mt-2 whitespace-pre-wrap rounded-medium px-3 py-2 text-body-2 leading-7",
            review.status === "changes_requested" || review.status === "rejected"
              ? "bg-warning-50 text-warning-700"
              : "bg-success-container/50 text-on-surface",
          ].join(" ")}
        >
          <span className="text-caption opacity-80">نظر کارشناس: </span>
          {review.decisionNoteFa}
        </p>
      )}

      <div className="mt-3">
        <h4 className="mb-2 text-labelLarge text-on-surface">رویدادها</h4>
        <ReviewTimeline review={review} />
      </div>

      {isOpen && (
        <div className="mt-3 space-y-3 border-t border-divider pt-3">
          <div>
            <Textarea
              label="پاسخ یا توضیح تکمیلی"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              fullWidth
              maxLength={4000}
              supportingText="پاسخ شما در تاریخچهٔ همین بررسی ثبت می‌شود و برای کارشناس قابل مشاهده است."
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="small"
                onClick={() => run("reply")}
                disabled={!reply.trim() || busyAction !== null}
                loading={busyAction === "reply"}
                startIcon={<IconSend size={16} />}
              >
                ثبت پاسخ
              </Button>
            </div>
          </div>

          {candidates.length > 0 && (
            <div className="rounded-medium bg-surface-container-low p-3">
              <p className="text-labelLarge text-on-surface">
                ارسال نسخهٔ تازه برای همین بررسی
              </p>
              <p className="mt-0.5 text-caption leading-6 text-on-surface-variant">
                بررسی به نسخهٔ ارسال‌شده گره خورده است؛ اگر متن را اصلاح کرده‌اید،
                نسخهٔ جدید را انتخاب کنید تا کارشناس همان را ببیند.
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {candidates.map((d) => {
                  const active = resubmitId === d.id;
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => setResubmitId(active ? "" : d.id)}
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
                          {toPersianDate(d.createdAt)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Button
                size="small"
                variant="outlined"
                className="mt-2"
                onClick={() => run("resubmit")}
                disabled={!resubmitId || busyAction !== null}
                loading={busyAction === "resubmit"}
              >
                ارسال نسخهٔ انتخاب‌شده
              </Button>
            </div>
          )}

          {canCancel && (
            <Button
              size="small"
              variant="text"
              onClick={() => run("cancel")}
              disabled={busyAction !== null}
              loading={busyAction === "cancel"}
            >
              لغو این بررسی
            </Button>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-medium bg-error-container px-3 py-2 text-body-2 text-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================================
// Submit form
// ============================================================

function SubmitReviewForm({
  requestId,
  drafts,
  hasOpenReview,
  onSubmitted,
}: {
  requestId: string;
  drafts: JudicialDraftVersion[];
  hasOpenReview: boolean;
  onSubmitted: () => void;
}) {
  const submit = useSubmitJudicialReview(requestId);
  // One key per logical attempt: a double click never opens a second review.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [draftId, setDraftId] = useState<string>(
    drafts.find((d) => d.status === "approved")?.id ?? drafts[0]?.id ?? ""
  );
  const [kind, setKind] = useState<"legalir" | "lawyer">("legalir");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (hasOpenReview) {
    return (
      <p className="rounded-medium bg-surface-container-low px-3 py-2 text-caption leading-6 text-on-surface-variant">
        یک بررسی در جریان است. تا تعیین تکلیف آن، ارسال دوباره ممکن نیست؛
        می‌توانید در همان بررسی پاسخ بدهید یا نسخهٔ تازه بفرستید.
      </p>
    );
  }

  if (drafts.length === 0) {
    return (
      <p className="rounded-medium bg-surface-container-low px-3 py-2 text-caption leading-6 text-on-surface-variant">
        برای ارسال به بررسی، ابتدا یک پیش‌نویس بسازید. بررسی روی متن مشخص انجام
        می‌شود، نه روی پاسخ‌ها.
      </p>
    );
  }

  async function send() {
    setError(null);
    try {
      await submit.mutateAsync({
        draftId,
        note: note.trim() || undefined,
        kind,
        idempotencyKey,
      });
      // A NEW logical attempt needs a NEW key.
      setIdempotencyKey(crypto.randomUUID());
      setNote("");
      snackbar.show({ message: "برای بررسی ارسال شد", variant: "success" });
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ارسال برای بررسی ناموفق بود.");
    }
  }

  return (
    <div className="rounded-medium border border-[color:var(--color-outline-variant)] p-3">
      <h4 className="text-titleSmall text-on-surface">ارسال برای بررسی انسانی</h4>
      <p className="mt-1 text-caption leading-6 text-on-surface-variant">
        متن انتخاب‌شده برای یک کارشناس ثبت می‌شود. نظر کارشناس در همین صفحه
        نمایش داده می‌شود و فقط پس از تأیید آن، نسخهٔ نهایی صادر می‌شود.
      </p>

      <div className="mt-3">
        <p className="mb-2 text-labelLarge text-on-surface">نسخهٔ ارسالی</p>
        <ul className="flex flex-wrap gap-2">
          {drafts.map((d) => {
            const active = draftId === d.id;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDraftId(d.id)}
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
                    {toPersianDate(d.createdAt)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-3">
        <p className="mb-2 text-labelLarge text-on-surface">نوع بررسی</p>
        <div className="flex flex-wrap gap-2">
          {(["legalir", "lawyer"] as const).map((value) => {
            const active = kind === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setKind(value)}
                className={[
                  "rounded-full border px-3 py-1.5 text-labelSmall transition-colors",
                  active
                    ? "border-primary bg-primary-container text-on-surface"
                    : "border-[color:var(--color-outline-variant)] text-on-surface-variant hover:border-primary",
                ].join(" ")}
              >
                {JUDICIAL_REVIEW_KIND_FA[value]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        <Textarea
          label="پرسش یا نکته‌ای برای کارشناس (اختیاری)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          fullWidth
          maxLength={4000}
          supportingText="این متن برای کارشناس نمایش داده می‌شود."
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-medium bg-error-container px-3 py-2 text-body-2 text-error"
        >
          {error}
        </p>
      )}

      <div className="mt-3">
        <Button
          onClick={() => void send()}
          loading={submit.isPending}
          disabled={!draftId}
          startIcon={<IconSend size={16} />}
        >
          ارسال برای بررسی
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// The workspace
// ============================================================

export function ReviewWorkspace({
  request,
  drafts,
  finalDocument,
}: {
  request: JudicialRequest;
  drafts: JudicialDraftVersion[];
  finalDocument: JudicialFinalDocument | null;
}) {
  const reviewsQuery = useJudicialReviews(request.id);

  const reviews = reviewsQuery.data?.items ?? [];
  const hasOpenReview = reviews.some((r) => OPEN_REVIEW.includes(r.status));

  return (
    <section
      aria-labelledby="judicial-review-workspace-title"
      className="space-y-4 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5"
    >
      <div>
        <h2
          id="judicial-review-workspace-title"
          className="text-titleMedium text-on-surface"
        >
          بررسی انسانی و نسخهٔ نهایی
        </h2>
        <p className="mt-1 text-body-2 leading-6 text-on-surface-variant">
          می‌توانید متن آماده‌شده را برای بررسی لیگالیر یا وکیل ارسال کنید.
          نتیجهٔ بررسی و یادداشت‌های قابل‌اشتراک در همین بخش ثبت می‌شوند.
        </p>
      </div>

      {finalDocument && (
        <FinalDocumentCard requestId={request.id} document={finalDocument} />
      )}

      {reviewsQuery.isLoading && (
        <div className="animate-pulse space-y-2">
          <div className="h-20 rounded-medium bg-surface-container" />
          <div className="h-20 rounded-medium bg-surface-container" />
        </div>
      )}

      {!reviewsQuery.isLoading && reviewsQuery.isError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-medium bg-surface-container-low px-3 py-2">
          <p className="flex items-center gap-1.5 text-caption text-on-surface-variant">
            <IconWarning size={14} className="text-warning" />
            وضعیت بررسی خوانده نشد.
          </p>
          <Button
            variant="outlined"
            size="small"
            onClick={() => void reviewsQuery.refetch()}
            startIcon={<IconRefresh size={16} />}
          >
            تلاش مجدد
          </Button>
        </div>
      )}

      {!reviewsQuery.isLoading && !reviewsQuery.isError && (
        <>
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              requestId={request.id}
              review={review}
              drafts={drafts}
              onChanged={() => void reviewsQuery.refetch()}
            />
          ))}

          <SubmitReviewForm
            requestId={request.id}
            drafts={drafts}
            hasOpenReview={hasOpenReview}
            onSubmitted={() => void reviewsQuery.refetch()}
          />
        </>
      )}

      <p className="flex items-start gap-1.5 rounded-medium bg-surface-container-low px-3 py-2 text-caption leading-6 text-on-surface-variant">
        <IconInfo size={14} className="mt-1 shrink-0" />
        بررسی لیگالیر جایگزین مشاورهٔ حقوقی مستقل نیست و نتیجهٔ قضایی را تضمین
        نمی‌کند. یادداشت‌های داخلی کارشناسان در این بخش نمایش داده نمی‌شود.
      </p>
    </section>
  );
}
