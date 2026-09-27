"use client";

// ============================================================
// LEGALIR — Consultation case room
// ============================================================
// The private, case-scoped room where the client and the assigned lawyer
// talk. It is deliberately NOT the AI chat: a persistent banner states the
// distinction, and the AI conversation history is never auto-shared.
//
// The server decides who the viewer is (`viewerRole`) and what they may do;
// this component only renders the actions that role is allowed to take:
//
//   · client — cancel / reassign while awaiting or declined, close a
//     completed case, and message once the lawyer has accepted.
//   · lawyer — accept / decline while awaiting, message, mark complete.
//
// Every action is a request; the server re-validates and may reject it.
// ============================================================

import { useState } from "react";
import Link from "next/link";
import { Button, ConfirmDialog, Textarea } from "@legalir/ui";
import { useConsultation, useRespondToConsultation, useSendConsultationMessage } from "@/hooks/useConsultations";
import { useTransitionLegalRequest } from "@/hooks/useLegalRequests";
import { LawyerAvatar } from "@/components/lawyers/lawyer-avatar";
import { ConsultationBanner } from "./consultation-banner";
import { ConsultationTimeline } from "./consultation-timeline";
import { AttachmentList } from "./attachment-list";
import { ConsultationStatusBadge, formatDateTime, formatToman } from "./consultation-status";
import {
  IconArrowBack,
  IconCheck,
  IconClose,
  IconFile,
  IconRefresh,
  IconSend,
  IconWarning,
} from "@/lib/icons";
import {
  CONSULTATION_METHOD_FA,
  LEGAL_CATEGORY_FA,
  type ConsultationDetail,
  type ConsultationMessageView,
  type LegalRequestState,
} from "@legalir/types";

/** States in which the client may still cancel or reassign. */
const CLIENT_ACTIVE_STATES: LegalRequestState[] = [
  "WAITING_FOR_ACCEPTANCE",
  "DECLINED",
  "LAWYER_PROPOSED",
  "LAWYER_SELECTED",
];

export function ConsultationRoom({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useConsultation(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
        <div className="h-64 animate-pulse rounded-2xl bg-surface-container" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
        <div className="flex flex-col items-center gap-3 rounded-large bg-error/10 p-8 text-center">
          <p className="text-body-1 text-error">این مشاوره یافت نشد یا به آن دسترسی ندارید</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-body-2 text-primary transition hover:bg-primary/10"
          >
            <IconRefresh size={16} />
            تلاش مجدد
          </button>
          <Link href="/consultations" className="text-body-2 text-primary hover:underline">
            بازگشت به مشاوره‌های من
          </Link>
        </div>
      </div>
    );
  }

  return <RoomBody id={id} detail={data} />;
}

function RoomBody({ id, detail }: { id: string; detail: ConsultationDetail }) {
  const { request, events, viewerRole, lawyer, messages, attachments, method } = detail;
  const respond = useRespondToConsultation(id);
  const transition = useTransitionLegalRequest(id);
  const send = useSendConsultationMessage(id);

  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [draft, setDraft] = useState("");

  const isClient = viewerRole === "client";
  const awaiting = request.state === "WAITING_FOR_ACCEPTANCE";
  const declined = request.state === "DECLINED";
  const completed = request.state === "COMPLETED";
  const closed = request.state === "CLOSED" || request.state === "CANCELLED";
  const canMessage = !awaiting && !declined && !closed;

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    }
  }

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    await run(async () => {
      await send.mutateAsync(body);
      setDraft("");
    }, "ارسال پیام ناموفق بود");
  }

  return (
    <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
      <Link
        href="/consultations"
        className="mb-4 inline-flex items-center gap-1.5 text-body-2 text-muted transition hover:text-primary"
      >
        <IconArrowBack size={18} />
        مشاوره‌های من
      </Link>

      <ConsultationBanner />

      {/* Header */}
      <div className="mb-6 rounded-2xl border border-divider/60 bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-h2 text-on-surface">{request.title}</h1>
            <p className="mt-1 text-body-2 text-muted">
              {LEGAL_CATEGORY_FA[request.category] ?? request.category}
            </p>
          </div>
          <ConsultationStatusBadge state={request.state} />
        </div>
        <p className="mt-3 text-caption text-muted">
          آخرین به‌روزرسانی: {formatDateTime(request.updatedAt)}
        </p>
        {awaiting && (
          <p className="mt-2 text-body-2 text-muted">
            {isClient
              ? "درخواست شما برای وکیل ارسال شده است. تا زمان پذیرش می‌توانید آن را لغو یا به وکیل دیگری ارجاع دهید."
              : "این درخواست در انتظار پاسخ شماست."}
          </p>
        )}
        {declined && (
          <p className="mt-2 text-body-2 text-muted">
            وکیل این درخواست را نپذیرفت. می‌توانید آن را به وکیل دیگری ارجاع دهید یا لغو کنید.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 tablet:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 tablet:col-span-2">
          {/* Message room */}
          <section className="rounded-2xl border border-divider/60 bg-surface p-5">
            <h2 className="mb-4 text-h3 text-on-surface">گفت‌وگوی پرونده</h2>

            {messages.length === 0 ? (
              <p className="text-body-2 text-muted">
                {canMessage
                  ? "هنوز پیامی رد و بدل نشده است. اولین پیام را بفرستید."
                  : "پس از پذیرش درخواست توسط وکیل، گفت‌وگو در همین بخش آغاز می‌شود."}
              </p>
            ) : (
              <ul className="space-y-3">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              </ul>
            )}

            {canMessage && (
              <div className="mt-4 space-y-2">
                <Textarea
                  id="consultation-message"
                  label="پیام شما"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder="پیام خود را بنویسید…"
                  fullWidth
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSend}
                    loading={send.isPending}
                    disabled={draft.trim().length === 0}
                    startIcon={<IconSend size={18} />}
                  >
                    ارسال پیام
                  </Button>
                </div>
              </div>
            )}
          </section>

          <ConsultationTimeline events={events} />

          <AttachmentList requestId={id} attachments={attachments} />
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* Lawyer card */}
          <section className="rounded-2xl border border-divider/60 bg-surface p-5">
            <h2 className="mb-3 text-h3 text-on-surface">وکیل</h2>
            {lawyer ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <LawyerAvatar
                    name={lawyer.fullName}
                    avatarUrl={lawyer.avatarUrl}
                    avatarType={lawyer.avatarType}
                    size={48}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-labelLarge text-on-surface">{lawyer.fullName}</p>
                    <p className="text-caption text-muted">
                      {lawyer.professionalTitle ?? "وکیل"}
                    </p>
                  </div>
                </div>
                <dl className="space-y-1.5 text-body-2">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-caption text-muted">هزینه مشاوره</dt>
                    <dd className="text-on-surface">
                      {formatToman(lawyer.pricing.consultationFeeToman)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-caption text-muted">روش مشاوره</dt>
                    <dd className="text-on-surface">{CONSULTATION_METHOD_FA[method]}</dd>
                  </div>
                </dl>
                <Link
                  href={`/lawyers/${lawyer.id}`}
                  className="block rounded-xl border border-divider/60 px-4 py-2.5 text-center text-body-2 text-primary transition hover:bg-primary/5"
                >
                  مشاهده پروفایل وکیل
                </Link>
              </div>
            ) : (
              <p className="text-body-2 text-muted">
                وکیلی برای این درخواست تعیین نشده است. تیم پشتیبانی وکیل مناسب را معرفی می‌کند.
              </p>
            )}
          </section>

          {/* Actions */}
          <section className="rounded-2xl border border-divider/60 bg-surface p-5">
            <h2 className="mb-3 text-h3 text-on-surface">اقدام‌ها</h2>

            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-error/10 px-3 py-2 text-caption text-error">
                <IconWarning size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Lawyer: accept / decline while awaiting */}
            {!isClient && awaiting && (
              <div className="space-y-2">
                <Button
                  fullWidth
                  onClick={() => run(() => respond.mutateAsync({ action: "accept" }), "پذیرش ناموفق بود")}
                  loading={respond.isPending}
                  startIcon={<IconCheck size={18} />}
                >
                  پذیرش درخواست
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => run(() => respond.mutateAsync({ action: "decline" }), "رد درخواست ناموفق بود")}
                  disabled={respond.isPending}
                  startIcon={<IconClose size={18} />}
                >
                  رد درخواست
                </Button>
              </div>
            )}

            {/* Lawyer: mark complete while active */}
            {!isClient && !awaiting && !declined && !completed && !closed && (
              <Button
                fullWidth
                onClick={() =>
                  run(() => transition.mutateAsync({ to: "COMPLETED" }), "تکمیل ناموفق بود")
                }
                loading={transition.isPending}
                startIcon={<IconCheck size={18} />}
              >
                اتمام مشاوره
              </Button>
            )}

            {/* Client: cancel / reassign while active */}
            {isClient && CLIENT_ACTIVE_STATES.includes(request.state) && (
              <div className="space-y-2">
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setConfirmCancel(true)}
                  startIcon={<IconClose size={18} />}
                >
                  لغو درخواست
                </Button>
                <Button
                  fullWidth
                  variant="text"
                  onClick={() =>
                    run(
                      () => transition.mutateAsync({ to: "LAWYER_PROPOSED" }),
                      "ارجاع مجدد ناموفق بود"
                    )
                  }
                  loading={transition.isPending}
                >
                  ارجاع به وکیل دیگر
                </Button>
              </div>
            )}

            {/* Client: close a completed case */}
            {isClient && completed && (
              <Button
                fullWidth
                variant="outlined"
                onClick={() => run(() => transition.mutateAsync({ to: "CLOSED" }), "بستن پرونده ناموفق بود")}
                loading={transition.isPending}
              >
                بستن پرونده
              </Button>
            )}

            {closed && (
              <p className="text-body-2 text-muted">این مشاوره بسته شده است.</p>
            )}

            <p className="mt-3 text-caption text-muted">
              در صورت بروز مشکل، از طریق بخش پشتیبانی پیگیری کنید.
            </p>
          </section>

          {/* Intake answers */}
          {Object.keys(request.intakeAnswers).length > 0 && (
            <section className="rounded-2xl border border-divider/60 bg-surface p-5">
              <h2 className="mb-3 text-h3 text-on-surface">اطلاعات ثبت‌شده</h2>
              <dl className="space-y-2 text-body-2">
                {Object.entries(request.intakeAnswers).map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-0.5">
                    <dt className="text-caption text-muted">{k}</dt>
                    <dd className="whitespace-pre-wrap break-words text-on-surface">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          void run(() => transition.mutateAsync({ to: "CANCELLED" }), "لغو درخواست ناموفق بود");
        }}
        title="لغو درخواست مشاوره"
        description="با لغو، این درخواست برای وکیل بسته می‌شود. می‌توانید بعداً درخواست جدیدی ثبت کنید."
        confirmLabel="لغو درخواست"
        cancelLabel="انصراف"
        destructive
        loading={transition.isPending}
      />
    </div>
  );
}

/** One message bubble, aligned by sender. */
function MessageBubble({ message }: { message: ConsultationMessageView }) {
  return (
    <li className={message.isMine ? "flex justify-start" : "flex justify-end"}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-2.5",
          message.isMine
            ? "bg-primary/10 text-on-surface"
            : "bg-surface-container text-on-surface",
        ].join(" ")}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="text-caption font-medium text-muted">{message.senderName}</span>
          <span className="text-caption text-muted">{formatDateTime(message.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-body-2">{message.body}</p>
        {message.attachments.length > 0 && (
          <ul className="mt-2 space-y-1">
            {message.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-1.5 text-caption text-muted">
                <IconFile size={14} />
                {a.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
