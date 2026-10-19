// ============================================================
// LEGALIR — Admin · Judicial review drawer (بررسی پروندهٔ قضایی)
// ============================================================
// The operator's ONE workspace for a submitted judicial draft. It shows what
// the reviewer must actually judge — the EXACT submitted text, the resolved
// answers, every draft version, the attachments and the complete timeline
// (internal notes included, each marked as internal) — and offers only the
// actions the backend permits:
//
//   assign           سپردن بررسی به کارشناسی که واقعاً دسترسی صف دارد
//   note             یادداشت؛ به‌صورت پیش‌فرض داخلی و هرگز برای کاربر
//   request_changes  بازگرداندن با اصلاحات مشخص (برای کاربر دیده می‌شود)
//   approve          تأیید نسخهٔ ارسال‌شده؛ همین درخواست نسخهٔ نهایی را صادر می‌کند
//   reject           رد با دلیل
//   cancel           لغو بررسی
//
// Approval is bound to the review's submitted version server-side: this
// drawer can only name that version, never invent another. When the server
// refuses (a stale version, a closed review) the reason is shown verbatim.
// ============================================================

"use client";

import { useState } from "react";
import { ConfirmDialog, Drawer, snackbar } from "@legalir/ui";
import {
  JUDICIAL_DRAFT_GENERATOR_FA,
  JUDICIAL_REVIEW_STATUS_FA,
  JUDICIAL_REVIEW_TERMINAL,
  type JudicialReviewAction,
  type JudicialReviewEvent,
  type JudicialReviewStatus,
} from "@legalir/types";
import {
  useAdminJudicialReview,
  useAdminJudicialReviewAction,
} from "@/hooks/useAdmin";
import { adminJudicialFinalDocumentUrl } from "@/lib/api/admin";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import {
  Badge,
  Button,
  ErrorBlock,
  Field,
  InfoBanner,
  LoadingBlock,
  Select,
  TextArea,
} from "@/components/admin/ui";
import {
  IconCheckCircle,
  IconDownload,
  IconDocument,
  IconInfo,
  IconOpenInNew,
  IconSend,
} from "@/lib/icons";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const STATUS_TONE: Record<JudicialReviewStatus, Tone> = {
  pending: "warning",
  in_progress: "info",
  waiting_user: "warning",
  changes_requested: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

/** The event kinds, in Persian. One map, used by the timeline only. */
const EVENT_KIND_FA: Record<JudicialReviewEvent["kind"], string> = {
  submitted: "ارسال برای بررسی",
  assigned: "تخصیص",
  note: "یادداشت",
  change_request: "درخواست اصلاح",
  approval_note: "یادداشت تأیید",
  revision: "اصلاح متن توسط کارشناس",
  user_reply: "پاسخ کاربر",
  resubmitted: "ارسال دوباره",
  approved: "تأیید",
  rejected: "رد",
  cancelled: "لغو",
  final_issued: "صدور نسخهٔ نهایی",
  status_changed: "تغییر وضعیت",
};

const ACTION_FA: Record<JudicialReviewAction, string> = {
  assign: "تخصیص به کارشناس",
  note: "ثبت یادداشت",
  request_changes: "درخواست اصلاح",
  approve: "تأیید و صدور نسخهٔ نهایی",
  reject: "رد درخواست",
  cancel: "لغو بررسی",
};

/** Actions that confirm before they are sent. */
const CONFIRM_ACTIONS: JudicialReviewAction[] = ["approve", "reject", "cancel"];

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${toPersianNumber(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${toPersianNumber(Math.round(bytes / 1024))} کیلوبایت`;
  return `${toPersianNumber(Math.round(bytes / (1024 * 1024)))} مگابایت`;
}

export function JudicialReviewDrawer({
  reviewId,
  canReview,
  onClose,
}: {
  reviewId: string | null;
  canReview: boolean;
  onClose: () => void;
}) {
  const detail = useAdminJudicialReview(reviewId);
  const action = useAdminJudicialReviewAction();

  const [pending, setPending] = useState<JudicialReviewAction | null>(null);
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState(true);
  const [assignee, setAssignee] = useState("");

  const data = detail.data;
  const review = data?.review;
  const closed = review ? JUDICIAL_REVIEW_TERMINAL.includes(review.status) : true;
  // A decision is only possible while the review is open; the server refuses a
  // closed review regardless of what the panel shows.
  const canDecide = canReview && review !== undefined && !closed;

  function resetForm() {
    setPending(null);
    setNote("");
    setInternalNote(true);
  }

  async function submit(actionName: JudicialReviewAction, noteText: string) {
    if (!reviewId) return;
    try {
      const result = await action.mutateAsync({
        reviewId,
        input: {
          action: actionName,
          ...(noteText.trim() ? { noteFa: noteText.trim() } : {}),
          ...(actionName === "note" ? { internalNote } : {}),
          ...(actionName === "assign" ? { assigneeUserId: assignee || null } : {}),
          // The reviewed version is the one the owner submitted — the panel
          // cannot name any other, and the server refuses a mismatch.
          ...(actionName === "approve" && review
            ? { versionId: review.submittedVersionId }
            : {}),
        },
      });
      if (actionName === "approve") {
        snackbar.show({
          message: result.finalDocument?.serialFa
            ? `تأیید شد و نسخهٔ نهایی با شمارهٔ ${result.finalDocument.serialFa} صادر شد.`
            : "تأیید ثبت شد.",
          variant: "success",
        });
      } else {
        snackbar.show({ message: `${ACTION_FA[actionName]} انجام شد.`, variant: "success" });
      }
      resetForm();
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ثبت عملیات ناموفق بود"), variant: "error" });
      resetForm();
    }
  }

  function begin(actionName: JudicialReviewAction) {
    if (CONFIRM_ACTIONS.includes(actionName)) setPending(actionName);
    else void submit(actionName, note);
  }

  return (
    <>
      <Drawer
        open={Boolean(reviewId)}
        onClose={onClose}
        width={760}
        title={
          data
            ? `${data.serviceFa}${data.documentTypeFa ? ` — ${data.documentTypeFa}` : ""}`
            : "بررسی پروندهٔ قضایی"
        }
      >
        {detail.isLoading ? (
          <LoadingBlock rows={8} />
        ) : detail.isError || !data || !review ? (
          <ErrorBlock onRetry={() => detail.refetch()} />
        ) : (
          <div className="space-y-5">
            {!canReview && (
              <InfoBanner tone="warning">
                شما مجوز «بررسی و تأیید اوراق قضایی» را ندارید؛ این نمایش فقط‌خواندنی است.
              </InfoBanner>
            )}

            {/* --- Identity --- */}
            <div className="rounded-large border border-divider p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[review.status]} dot>
                  {JUDICIAL_REVIEW_STATUS_FA[review.status]}
                </Badge>
                <Badge tone="info">
                  {review.kind === "lawyer" ? "ارجاع به وکیل" : "بررسی لیگالیر"}
                </Badge>
                <Badge tone="neutral">
                  نسخهٔ {toPersianNumber(review.submittedVersionNumber)}
                </Badge>
                {data.finalDocument && (
                  <Badge tone="success">
                    <IconCheckCircle size={13} /> نسخهٔ نهایی صادر شده
                  </Badge>
                )}
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-body-2 max-tablet:grid-cols-1 tablet:grid-cols-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">عنوان پرونده</dt>
                  <dd className="text-end font-medium">{data.request?.titleFa ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">کاربر</dt>
                  <dd className="text-end">
                    {data.owner.labelFa}
                    {data.owner.mobile && (
                      // Operators see the real contact, LTR — the same rule as
                      // the users panel.
                      <span className="ms-2 font-mono text-caption text-muted" dir="ltr">
                        {data.owner.mobile}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">وضعیت پرونده</dt>
                  <dd className="text-end">{data.request?.statusFa ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">کارشناس</dt>
                  <dd className="text-end">{review.assignedToLabelFa ?? "تخصیص‌نشده"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">ارسال</dt>
                  <dd className="text-end tabular-nums">{toPersianDate(review.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">آخرین تغییر</dt>
                  <dd className="text-end tabular-nums">{toPersianDate(review.updatedAt)}</dd>
                </div>
              </dl>

              {review.noteFa && (
                <div className="mt-3 rounded-medium bg-surface-container p-2.5 text-body-2">
                  <div className="mb-1 text-caption text-muted">توضیح کاربر</div>
                  {review.noteFa}
                </div>
              )}
            </div>

            {/* --- The exact text the owner submitted --- */}
            <Section title="متن ارسال‌شده" icon={<IconDocument size={16} />}>
              <p className="mb-2 text-caption text-muted">
                این همان متنی است که کاربر ارسال کرده و تأیید به همین نسخه گره می‌خورد؛
                هر تغییری پس از این، تأیید را باطل می‌کند.
              </p>
              <div
                dir="rtl"
                className="max-h-80 overflow-auto whitespace-pre-wrap rounded-medium border border-divider bg-surface-container p-3 text-body-2 leading-relaxed"
              >
                {review.submittedText.trim() || "—"}
              </div>
            </Section>

            {/* --- Resolved answers --- */}
            {data.answers.length > 0 && (
              <Section title="پاسخ‌های پرسش‌نامه" icon={<IconInfo size={16} />}>
                <p className="mb-2 text-caption text-muted">
                  پاسخ‌ها با همان نسخهٔ پرسش‌نامه‌ای بازخوانی شده‌اند که کاربر پر کرده است.
                </p>
                <div className="divide-y divide-divider rounded-medium border border-divider">
                  {data.answers.map((a) => (
                    <div
                      key={a.questionId}
                      className="flex flex-wrap items-start justify-between gap-2 p-2.5 text-body-2"
                    >
                      <div className="min-w-[45%]">
                        <div className="text-on-surface-variant">{a.labelFa}</div>
                        <div className="text-caption text-muted">{a.stepTitleFa}</div>
                      </div>
                      <div className="max-w-[50%] text-end">
                        {a.valueFa}
                        {a.sensitive && (
                          <span className="ms-2 inline-block">
                            <Badge tone="warning">حساس</Badge>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* --- Versions --- */}
            <Section title="نسخه‌های پیش‌نویس" icon={<IconDocument size={16} />}>
              {data.drafts.length === 0 ? (
                <p className="text-body-2 text-muted">نسخه‌ای ثبت نشده است.</p>
              ) : (
                <ol className="divide-y divide-divider rounded-medium border border-divider">
                  {[...data.drafts]
                    .sort((a, b) => b.version - a.version)
                    .map((d) => {
                      const isSubmitted = d.id === review.submittedVersionId;
                      return (
                        <li key={d.id} className="flex items-center justify-between gap-3 p-2.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <Badge tone={isSubmitted ? "brand" : "neutral"}>
                              نسخهٔ {toPersianNumber(d.version)}
                            </Badge>
                            {isSubmitted && <Badge tone="info">ارسال‌شده</Badge>}
                            <span className="text-caption text-muted">
                              {toPersianDate(d.createdAt)}
                            </span>
                          </div>
                          <span className="text-caption text-muted">
                            {JUDICIAL_DRAFT_GENERATOR_FA[d.generator] ?? d.generator}
                          </span>
                        </li>
                      );
                    })}
                </ol>
              )}
            </Section>

            {/* --- Attachments --- */}
            <Section title="پیوست‌ها" icon={<IconDocument size={16} />}>
              {data.attachments.length === 0 ? (
                <p className="text-body-2 text-muted">پیوستی ثبت نشده است.</p>
              ) : (
                <ul className="divide-y divide-divider rounded-medium border border-divider">
                  {data.attachments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 p-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-body-2">{a.nameFa}</div>
                        <div className="text-caption text-muted">{a.roleFa}</div>
                      </div>
                      <span className="shrink-0 text-caption text-muted tabular-nums">
                        {formatBytes(a.sizeBytes)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* --- Timeline (internal notes included) --- */}
            <Section title="سابقهٔ بررسی" icon={<IconInfo size={16} />}>
              {data.events.length === 0 ? (
                <p className="text-body-2 text-muted">رویدادی ثبت نشده است.</p>
              ) : (
                <ol className="space-y-2.5">
                  {[...data.events]
                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                    .map((e) => (
                      <li
                        key={e.id}
                        className={`rounded-medium border p-2.5 text-body-2 ${
                          e.visibleToOwner
                            ? "border-divider"
                            : "border-warning/40 bg-warning-soft/40"
                        }`}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge tone={e.visibleToOwner ? "neutral" : "warning"}>
                            {EVENT_KIND_FA[e.kind]}
                          </Badge>
                          {!e.visibleToOwner && (
                            <Badge tone="warning">
                              یادداشت داخلی — برای کاربر نمایش داده نمی‌شود
                            </Badge>
                          )}
                          <span className="text-caption text-muted">{e.authorLabelFa}</span>
                          {e.versionNumber != null && (
                            <span className="text-caption text-muted">
                              نسخهٔ {toPersianNumber(e.versionNumber)}
                            </span>
                          )}
                          <span className="ms-auto text-caption text-muted tabular-nums">
                            {toPersianDate(e.createdAt)}
                          </span>
                        </div>
                        {e.bodyFa && (
                          <p className="whitespace-pre-wrap text-on-surface-variant">{e.bodyFa}</p>
                        )}
                      </li>
                    ))}
                </ol>
              )}
            </Section>

            {/* --- Final artifact --- */}
            {data.finalDocument && (
              <Section title="نسخهٔ نهایی صادرشده" icon={<IconCheckCircle size={16} />}>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-medium border border-divider p-3">
                  <div>
                    <div className="font-medium">{data.finalDocument.serialFa}</div>
                    <div className="text-caption text-muted">
                      نسخهٔ {toPersianNumber(data.finalDocument.versionNumber)} —{" "}
                      {toPersianDate(data.finalDocument.issuedAt)} —{" "}
                      {toPersianNumber(data.finalDocument.pageCount)} صفحه
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      startIcon={<IconOpenInNew size={15} />}
                      onClick={() =>
                        window.open(
                          adminJudicialFinalDocumentUrl(review.id),
                          "_blank",
                          "noopener"
                        )
                      }
                    >
                      مشاهده
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      startIcon={<IconDownload size={15} />}
                      onClick={() => {
                        window.location.href = adminJudicialFinalDocumentUrl(review.id, true);
                      }}
                    >
                      دانلود
                    </Button>
                  </div>
                </div>
              </Section>
            )}

            {/* --- Actions --- */}
            {canDecide && (
              <Section title="اقدام" icon={<IconSend size={16} />}>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="تخصیص به کارشناس">
                      <Select
                        value={assignee}
                        onChange={(e) => setAssignee(e.target.value)}
                        aria-label="کارشناس بررسی"
                      >
                        <option value="">— بدون تخصیص —</option>
                        {data.assignableStaff.map((s) => (
                          <option key={s.userId} value={s.userId}>
                            {s.labelFa} ({s.roleFa})
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Button
                      variant="secondary"
                      disabled={action.isPending || assignee === (review.assignedToUserId ?? "")}
                      onClick={() => void submit("assign", "")}
                    >
                      ثبت تخصیص
                    </Button>
                  </div>

                  <Field label="متن یادداشت / دلیل">
                    <TextArea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={4}
                      placeholder="برای «درخواست اصلاح» و «رد»، متن الزامی است."
                    />
                  </Field>

                  <label className="flex items-center gap-2 text-body-2">
                    <input
                      type="checkbox"
                      checked={internalNote}
                      onChange={(e) => setInternalNote(e.target.checked)}
                    />
                    یادداشت داخلی (در خروجی کاربر و نسخهٔ نهایی نمایش داده نمی‌شود)
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={action.isPending || !note.trim()}
                      onClick={() => begin("note")}
                    >
                      ثبت یادداشت
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={action.isPending || !note.trim()}
                      onClick={() => begin("request_changes")}
                    >
                      درخواست اصلاح
                    </Button>
                    <Button
                      variant="primary"
                      startIcon={<IconCheckCircle size={16} />}
                      disabled={action.isPending}
                      onClick={() => begin("approve")}
                    >
                      تأیید و صدور نسخهٔ نهایی
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={action.isPending || !note.trim()}
                      onClick={() => begin("reject")}
                    >
                      رد
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={action.isPending}
                      onClick={() => begin("cancel")}
                    >
                      لغو بررسی
                    </Button>
                  </div>

                  <p className="text-caption text-muted">
                    تأیید به نسخهٔ {toPersianNumber(review.submittedVersionNumber)} گره می‌خورد؛
                    اگر متن پس از ارسال تغییر کرده باشد، سرور تأیید را نمی‌پذیرد.
                  </p>
                </div>
              </Section>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => pending && submit(pending, note)}
        title={pending ? ACTION_FA[pending] : "تأیید عملیات"}
        description={
          pending === "approve"
            ? "با تأیید، نسخهٔ نهایی همین درخواست صادر و برای کاربر قابل دریافت می‌شود. این عمل در لاگ حسابرسی ثبت می‌شود."
            : pending
              ? `آیا از «${ACTION_FA[pending]}» مطمئن هستید؟ این عمل در لاگ حسابرسی ثبت می‌شود.`
              : undefined
        }
        confirmLabel="ثبت"
        destructive={pending === "reject" || pending === "cancel"}
        loading={action.isPending}
      />
    </>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-large border border-divider p-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-body-2 font-bold text-on-surface">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}
