// ============================================================
// LEGALIR — Lawyer workbench · Referral detail (جزئیات درخواست)
// ============================================================
// The working surface for one assigned request, laid out in the sections the
// spec asks for: core info · documents · state + SLA · messages · actions ·
// history.
//
// Everything shown here is server-projected (`LawyerReferralDetail`): the
// client identity is pre-masked, the SLA block carries the policy note, the
// prices are the frozen `agreedRate` (and the live catalogue rate only as
// context), and `allowedActions` is the server's word on which verbs will be
// accepted right now — the buttons never invent a transition.
//
// Sensitive verbs (decline / complete / request-info) require a form and a
// confirmation; client-visible messages and internal notes are separate
// surfaces so an internal note can never leak into the client's thread.
// ============================================================

"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useLawyerReferral, useLawyerReferralAction } from "@/hooks/useLawyerPortal";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyBlock,
  ErrorBlock,
  Field,
  IdChip,
  LoadingBlock,
  PageHeader,
  TextArea,
} from "@/components/admin/ui";
import { StateBadge, SlaBadge } from "@/components/lawyer/sla-badge";
import type { LawyerReferralActionPayload } from "@/lib/api/lawyer-portal";
import { ApiClientError } from "@/lib/api/errors";
import { formatRemaining } from "@/lib/lawyer-portal/sla";
import {
  formatFileSize,
  toPersianCurrency,
  toPersianDate,
  toPersianNumber,
} from "@/lib/persian-utils";
import {
  LAWYER_RATE_UNIT_FA,
  type LawyerReferralDetail,
  type RequestTimelineEntry,
  type SlaPhase,
} from "@legalir/types";
import { ConfirmDialog, Dialog, snackbar } from "@legalir/ui";
import {
  IconArrowBack,
  IconAttach,
  IconCheckCircle,
  IconClock,
  IconDocument,
  IconDownload,
  IconInfo,
  IconRefresh,
  IconSend,
  IconWarning,
} from "@/lib/icons";

const PHASE_FA: Record<SlaPhase, string> = {
  RESPONSE: "مهلت پاسخ‌گویی",
  COMPLETION: "مهلت تکمیل کار",
  DONE: "پایان‌یافته",
};

/** A form-gated verb. `accept` only needs a yes/no confirmation. */
type Verb = "accept" | "decline" | "start" | "requestInfo" | "complete";

const VERB_TITLE: Record<Verb, string> = {
  accept: "پذیرش درخواست",
  decline: "رد درخواست",
  start: "شروع کار",
  requestInfo: "درخواست اطلاعات تکمیلی از کاربر",
  complete: "ثبت نتیجه و تکمیل درخواست",
};

function TimelineRow({ entry }: { entry: RequestTimelineEntry }) {
  const internal = entry.visibility === "internal";
  return (
    <li className="relative border-s border-divider ps-4 pb-4 last:pb-0">
      <span
        aria-hidden="true"
        className={`absolute -start-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${
          internal ? "bg-warning-400" : "bg-primary-400"
        }`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption font-medium text-on-surface">{entry.titleFa}</span>
        {internal && <Badge tone="warning">یادداشت داخلی</Badge>}
      </div>
      <p className="mt-0.5 text-caption text-muted">
        {entry.actorLabel} · {toPersianDate(entry.at)}
      </p>
      {entry.body && (
        <p className="mt-1 whitespace-pre-wrap text-body-2 text-on-surface-variant" dir="auto">
          {entry.body}
        </p>
      )}
    </li>
  );
}

function PriceRow({
  label,
  amount,
  unit,
  hint,
}: {
  label: string;
  amount: number;
  unit: LawyerReferralDetail["currentRate"] extends infer R
    ? R extends { unit: infer U }
      ? U
      : never
    : never;
  hint?: string;
}) {
  return (
    <div className="rounded-medium bg-surface-container px-3 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-caption text-muted">{label}</span>
        <span className="text-body-2 font-medium tabular-nums text-on-surface">
          {toPersianCurrency(amount, "IRT")}
        </span>
      </div>
      <p className="mt-0.5 text-caption text-muted">
        {LAWYER_RATE_UNIT_FA[unit]}
        {hint ? ` — ${hint}` : ""}
      </p>
    </div>
  );
}

function DetailContent({ id }: { id: string }) {
  const query = useLawyerReferral(id);
  const action = useLawyerReferralAction(id);

  const [verb, setVerb] = useState<Verb | null>(null);
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState("");
  const [startNote, setStartNote] = useState("");
  const [infoNote, setInfoNote] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const data = query.data;
  const pending = action.isPending;

  function open(v: Verb) {
    setTouched(false);
    setVerb(v);
  }

  function close() {
    if (pending) return;
    setVerb(null);
    setTouched(false);
  }

  /** Run one server verb; returns true only when the request was accepted. */
  async function run(payload: LawyerReferralActionPayload, success: string): Promise<boolean> {
    try {
      await action.mutateAsync(payload);
      snackbar.show({ message: success, variant: "success" });
      return true;
    } catch (err) {
      const text =
        err instanceof ApiClientError ? err.userMessage : "خطا در انجام عملیات. دوباره تلاش کنید.";
      snackbar.show({ message: text, variant: "error" });
      return false;
    }
  }

  if (query.isLoading) return <LoadingBlock rows={8} />;

  if (query.isError || !data) {
    const status = query.error instanceof ApiClientError ? query.error.status : 0;
    if (status === 404) {
      return (
        <div>
          <PageHeader
            title="درخواست یافت نشد"
            icon={<IconDocument size={22} />}
            actions={
              <Link
                href="/lawyer/referrals"
                className="inline-flex items-center gap-1 text-caption font-medium text-primary hover:underline"
              >
                <IconArrowBack size={14} /> بازگشت به فهرست
              </Link>
            }
          />
          <Card className="p-8 text-center">
            <p className="text-body-2 text-on-surface">این درخواست به شما ارجاع نشده است.</p>
            <p className="mt-1 text-caption text-muted">
              تنها درخواست‌های ارجاع‌شده به حساب شما در دسترس‌اند.
            </p>
          </Card>
        </div>
      );
    }
    return <ErrorBlock message="خطا در بارگذاری درخواست" onRetry={() => query.refetch()} />;
  }

  const allowed = new Set(data.allowedActions);
  const sla = data.sla;
  const snapshot = sla.snapshot;
  const stateTimes = sla.state;
  const history: { label: string; at: string | null }[] = [
    { label: "ارجاع به شما", at: stateTimes?.assignedAt ?? null },
    { label: "مشاهدهٔ درخواست", at: stateTimes?.viewedAt ?? null },
    { label: "پاسخ به درخواست", at: stateTimes?.respondedAt ?? null },
    { label: "پذیرش", at: stateTimes?.acceptedAt ?? null },
    { label: "رد درخواست", at: stateTimes?.declinedAt ?? null },
    { label: "شروع کار", at: stateTimes?.startedAt ?? null },
    { label: "درخواست اطلاعات", at: stateTimes?.infoRequestedAt ?? null },
    { label: "تکمیل", at: stateTimes?.completedAt ?? null },
  ];

  const declineError = touched && reason.trim().length < 5 ? "دلیل را دست‌کم در ۵ نویسه بنویسید." : undefined;
  const completeError =
    touched && summary.trim().length < 10 ? "خلاصهٔ نتیجه را دست‌کم در ۱۰ نویسه بنویسید." : undefined;
  const infoError =
    touched && infoNote.trim().length < 5 ? "موردی که از کاربر می‌خواهید را بنویسید." : undefined;

  async function submitVerb() {
    if (!verb) return;
    switch (verb) {
      case "accept": {
        const ok = await run({ action: "ACCEPT" }, "درخواست پذیرفته شد.");
        if (ok) close();
        return;
      }
      case "decline": {
        setTouched(true);
        if (reason.trim().length < 5) return;
        const ok = await run(
          { action: "DECLINE", reason: reason.trim() },
          "درخواست رد شد و به کارتابل ارجاع‌دهنده بازگشت."
        );
        if (ok) {
          setReason("");
          close();
        }
        return;
      }
      case "start": {
        const ok = await run({ action: "START", note: startNote.trim() || undefined }, "کار آغاز شد.");
        if (ok) {
          setStartNote("");
          close();
        }
        return;
      }
      case "requestInfo": {
        setTouched(true);
        if (infoNote.trim().length < 5) return;
        const ok = await run(
          { action: "REQUEST_INFO", note: infoNote.trim() },
          "درخواست اطلاعات برای کاربر ارسال شد."
        );
        if (ok) {
          setInfoNote("");
          close();
        }
        return;
      }
      case "complete": {
        setTouched(true);
        if (summary.trim().length < 10) return;
        const ok = await run(
          { action: "COMPLETE", summary: summary.trim() },
          "نتیجه ثبت و درخواست تکمیل شد."
        );
        if (ok) {
          setSummary("");
          close();
        }
        return;
      }
    }
  }

  async function sendMessage() {
    const body = message.trim();
    if (!body) return;
    const ok = await run({ action: "SEND_MESSAGE", body }, "پیام برای کاربر ارسال شد.");
    if (ok) setMessage("");
  }

  async function saveNote() {
    const body = note.trim();
    if (!body) return;
    const ok = await run(
      { action: "ADD_NOTE", note: body, internal: true },
      "یادداشت داخلی ثبت شد."
    );
    if (ok) setNote("");
  }

  return (
    <div>
      <PageHeader
        title={data.title || "درخواست بدون عنوان"}
        description={`${data.serviceLabelFa} · ${data.categoryLabelFa}`}
        icon={<IconDocument size={22} />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/lawyer/referrals"
              className="inline-flex items-center gap-1 text-caption font-medium text-primary hover:underline"
            >
              <IconArrowBack size={14} /> فهرست درخواست‌ها
            </Link>
            <Button
              variant="secondary"
              size="sm"
              loading={query.isFetching}
              onClick={() => void query.refetch()}
              startIcon={<IconRefresh size={15} />}
            >
              به‌روزرسانی
            </Button>
          </div>
        }
      />

      {/* ---------------------------------------------------------------- */}
      {/* SLA banner — the clock, the deadline, the pause rule.            */}
      {/* ---------------------------------------------------------------- */}
      <Card className="mb-5 p-4 tablet:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge state={data.state} />
              <SlaBadge sla={snapshot} />
              <Badge tone="neutral">{PHASE_FA[snapshot.phase]}</Badge>
            </div>
            <p className="mt-2 text-caption text-muted">{sla.policyNoteFa}</p>
          </div>
          <div className="text-end">
            <p className="text-caption text-muted">مهلت</p>
            <p className="text-body-2 font-medium tabular-nums text-on-surface">
              {snapshot.dueAt ? toPersianDate(snapshot.dueAt) : "—"}
            </p>
            {snapshot.health !== "NONE" && !snapshot.done && (
              <p
                className={`mt-0.5 text-caption ${
                  snapshot.breached
                    ? "text-error-600 dark:text-error-400"
                    : snapshot.atRisk
                      ? "text-warning-700 dark:text-warning-400"
                      : "text-muted"
                }`}
              >
                {formatRemaining(snapshot.remainingMs)}
              </p>
            )}
          </div>
        </div>
        {snapshot.paused && (
          <p className="mt-3 flex items-center gap-2 rounded-medium bg-warning-soft px-3 py-2 text-caption text-warning-700">
            <IconWarning size={15} aria-hidden="true" />
            ساعت پاسخ‌گویی متوقف است — منتظر پاسخ کاربر.
          </p>
        )}
      </Card>

      <div className="grid gap-5 laptop:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        {/* ============================ MAIN ============================ */}
        <div className="space-y-5">
          {/* Core info */}
          <Card>
            <CardHeader title="اطلاعات اصلی" />
            <CardBody>
              <dl className="grid gap-3 tablet:grid-cols-2">
                <div>
                  <dt className="text-caption text-muted">شناسهٔ درخواست</dt>
                  <dd className="mt-1">
                    <IdChip id={data.requestId} />
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-muted">تاریخ ارجاع</dt>
                  <dd className="mt-1 text-body-2 text-on-surface">
                    {toPersianDate(data.referredAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-muted">کاربر</dt>
                  <dd className="mt-1 text-body-2 text-on-surface">
                    {data.client.organizationName ?? data.client.displayName}
                  </dd>
                  {data.client.organizationName && (
                    <dd className="text-caption text-muted">
                      نماینده: {data.client.representativeName ?? data.client.displayName}
                    </dd>
                  )}
                  {(data.client.representativeMobileMasked ?? data.client.mobileMasked) && (
                    <dd className="mt-0.5 text-caption tabular-nums text-muted" dir="ltr">
                      {data.client.representativeMobileMasked ?? data.client.mobileMasked}
                    </dd>
                  )}
                </div>
                <div>
                  <dt className="text-caption text-muted">خدمت</dt>
                  <dd className="mt-1 text-body-2 text-on-surface">{data.serviceLabelFa}</dd>
                </div>
              </dl>

              {Object.keys(data.intakeAnswers).length > 0 && (
                <div className="mt-4 border-t border-divider pt-3">
                  <h3 className="mb-2 text-body-2 font-bold text-on-surface">پاسخ‌های فرم درخواست</h3>
                  <dl className="space-y-2">
                    {Object.entries(data.intakeAnswers).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-caption text-muted" dir="auto">
                          {key}
                        </dt>
                        <dd className="whitespace-pre-wrap text-body-2 text-on-surface-variant" dir="auto">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader
              title="فایل‌های درخواست"
              subtitle="مدارکی که کاربر همراه درخواست فرستاده است."
            />
            <CardBody>
              {data.attachments.length === 0 ? (
                <p className="text-body-2 text-muted">فایلی پیوست نشده است.</p>
              ) : (
                <ul className="divide-y divide-divider">
                  {data.attachments.map((file) => (
                    <li key={file.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <IconAttach size={16} className="shrink-0 text-muted" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate text-body-2 text-on-surface" dir="auto">
                            {file.name}
                          </p>
                          <p className="text-caption text-muted">
                            {formatFileSize(file.sizeBytes)} · {toPersianDate(file.createdAt)}
                          </p>
                        </div>
                      </div>
                      <a
                        href={`/api/v1/documents/${file.id}/download`}
                        className="inline-flex shrink-0 items-center gap-1 text-caption font-medium text-primary hover:underline"
                      >
                        <IconDownload size={14} /> دانلود
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Delivered result — retained forever */}
          {data.result && (
            <Card>
              <CardHeader
                title="نتیجهٔ تحویل‌شده"
                subtitle={`${toPersianDate(data.result.deliveredAt)} · ${
                  data.result.documentIds.length > 0
                    ? `${toPersianNumber(data.result.documentIds.length)} فایل ضمیمه`
                    : "بدون فایل ضمیمه"
                }`}
              />
              <CardBody>
                <p className="whitespace-pre-wrap text-body-2 leading-7 text-on-surface-variant" dir="auto">
                  {data.result.summary}
                </p>
              </CardBody>
            </Card>
          )}

          {/* Client-visible conversation */}
          <Card>
            <CardHeader
              title="پیام‌ها"
              subtitle="این گفت‌وگو در همان مسیر درخواست کاربر نمایش داده می‌شود."
            />
            <CardBody>
              {data.messages.length === 0 ? (
                <p className="text-body-2 text-muted">هنوز پیامی رد و بدل نشده است.</p>
              ) : (
                <ul className="space-y-3">
                  {data.messages.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-medium px-3 py-2 ${
                        m.isMine ? "bg-primary-soft" : "bg-surface-container"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-caption font-medium text-on-surface">
                          {m.senderName}
                        </span>
                        <span className="text-caption text-muted">{toPersianDate(m.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-body-2 text-on-surface-variant" dir="auto">
                        {m.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 border-t border-divider pt-3">
                <Field label="پاسخ به کاربر">
                  <TextArea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="پاسخ شما برای کاربر ارسال می‌شود…"
                  />
                </Field>
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    disabled={!message.trim() || pending}
                    loading={pending && verb === null && message.trim().length > 0}
                    onClick={() => void sendMessage()}
                    startIcon={<IconSend size={14} />}
                  >
                    ارسال پیام
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Internal notes — never sent to the client */}
          <Card>
            <CardHeader
              title="یادداشت داخلی"
              subtitle="فقط برای شما و تیم پشتیبانی؛ کاربر این یادداشت را نمی‌بیند."
            />
            <CardBody>
              <Field label="یادداشت">
                <TextArea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="مثلاً: منتظر ارسال سند مالکیت از سوی کاربر…"
                />
              </Field>
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!note.trim() || pending}
                  onClick={() => void saveNote()}
                >
                  ثبت یادداشت
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* History */}
          <Card>
            <CardHeader
              title="تاریخچه"
              subtitle="همهٔ وضعیت‌ها، اقدام‌ها و پیام‌ها، با تاریخ و عامل."
            />
            <CardBody>
              {data.timeline.length === 0 ? (
                <EmptyBlock message="رویدادی ثبت نشده است." />
              ) : (
                <ol className="ms-1">
                  {data.timeline.map((entry) => (
                    <TimelineRow key={entry.id} entry={entry} />
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ============================ SIDE ============================ */}
        <div className="space-y-5">
          {/* Actions */}
          <Card>
            <CardHeader title="اقدام‌ها" subtitle="فقط گزینه‌هایی که اکنون مجاز است." />
            <CardBody>
              <div className="flex flex-col gap-2">
                {allowed.has("ACCEPT") && (
                  <Button onClick={() => open("accept")} startIcon={<IconCheckCircle size={16} />}>
                    پذیرش درخواست
                  </Button>
                )}
                {allowed.has("START") && (
                  <Button
                    variant="secondary"
                    onClick={() => open("start")}
                    startIcon={<IconClock size={16} />}
                  >
                    شروع کار
                  </Button>
                )}
                {allowed.has("REQUEST_INFO") && (
                  <Button
                    variant="secondary"
                    onClick={() => open("requestInfo")}
                    startIcon={<IconInfo size={16} />}
                  >
                    درخواست اطلاعات از کاربر
                  </Button>
                )}
                {allowed.has("COMPLETE") && (
                  <Button
                    variant="secondary"
                    onClick={() => open("complete")}
                    startIcon={<IconCheckCircle size={16} />}
                  >
                    ثبت نتیجه و تکمیل
                  </Button>
                )}
                {allowed.has("DECLINE") && (
                  <Button
                    variant="ghost"
                    onClick={() => open("decline")}
                    startIcon={<IconWarning size={16} />}
                    className="!text-error-600 dark:!text-error-400"
                  >
                    رد درخواست
                  </Button>
                )}
                {!allowed.has("ACCEPT") &&
                  !allowed.has("START") &&
                  !allowed.has("REQUEST_INFO") &&
                  !allowed.has("COMPLETE") &&
                  !allowed.has("DECLINE") && (
                    <p className="text-caption text-muted">
                      در وضعیت فعلی اقدام گردش‌کاری در دسترس نیست.
                    </p>
                  )}
              </div>
            </CardBody>
          </Card>

          {/* Price */}
          <Card>
            <CardHeader title="دستمزد" subtitle="قیمت پذیرش‌شده برای این درخواست ثابت می‌ماند." />
            <CardBody className="space-y-2">
              {data.agreedRate ? (
                <PriceRow
                  label="توافق‌شده (قفل‌شده)"
                  amount={data.agreedRate.amountToman}
                  unit={data.agreedRate.unit}
                  hint={`از ${toPersianDate(data.agreedRate.agreedAt)}`}
                />
              ) : (
                <p className="text-body-2 text-muted">
                  دستمزد هنگام پذیرش تثبیت می‌شود.
                </p>
              )}
              {data.currentRate &&
                (!data.agreedRate || data.currentRate.amountToman !== data.agreedRate.amountToman) && (
                  <PriceRow
                    label="قیمت فعلی خدمت"
                    amount={data.currentRate.amountToman}
                    unit={data.currentRate.unit}
                    hint="فقط برای اطلاع — روی درخواست جاری اثری ندارد"
                  />
                )}
              {!data.currentRate && !data.agreedRate && (
                <p className="text-caption text-muted">
                  برای این خدمت قیمتی ثبت نکرده‌اید.{" "}
                  <Link href="/lawyer/rates" className="text-primary hover:underline">
                    ثبت قیمت
                  </Link>
                </p>
              )}
            </CardBody>
          </Card>

          {/* Recorded clock points */}
          <Card>
            <CardHeader
              title="زمان‌های ثبت‌شده"
              subtitle="هر مرحله جداگانه ثبت می‌شود و مبنای محاسبهٔ مهلت است."
            />
            <CardBody>
              <ul className="space-y-2">
                {history
                  .filter((h) => h.at)
                  .map((h) => (
                    <li key={h.label} className="flex items-baseline justify-between gap-2">
                      <span className="text-caption text-muted">{h.label}</span>
                      <span className="text-caption tabular-nums text-on-surface">
                        {toPersianDate(h.at as string)}
                      </span>
                    </li>
                  ))}
                {history.every((h) => !h.at) && (
                  <li className="text-caption text-muted">زمانی ثبت نشده است.</li>
                )}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ---------------------------- Dialogs ---------------------------- */}
      <ConfirmDialog
        open={verb === "accept"}
        onClose={close}
        onConfirm={() => void submitVerb()}
        title={VERB_TITLE.accept}
        description="با پذیرش، دستمزد این خدمت برای این درخواست تثبیت می‌شود و مهلت تکمیل آغاز می‌گردد."
        confirmLabel="پذیرش"
        loading={pending}
      />

      <Dialog
        open={verb === "decline"}
        onClose={close}
        title={VERB_TITLE.decline}
        description="دلیل رد برای ارجاع‌دهنده ثبت می‌شود. دلیل اجباری است."
        maxWidth="md"
        actions={
          <>
            <Button variant="ghost" onClick={close} disabled={pending}>
              انصراف
            </Button>
            <Button
              onClick={() => void submitVerb()}
              loading={pending}
              className="!bg-error text-onError"
            >
              رد درخواست
            </Button>
          </>
        }
      >
        <Field label="دلیل رد" required error={declineError}>
          <TextArea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثلاً: موضوع در حوزهٔ تخصصی من نیست…"
          />
        </Field>
      </Dialog>

      <Dialog
        open={verb === "start"}
        onClose={close}
        title={VERB_TITLE.start}
        description="شروع کار به کاربر اطلاع داده می‌شود."
        maxWidth="md"
        actions={
          <>
            <Button variant="ghost" onClick={close} disabled={pending}>
              انصراف
            </Button>
            <Button onClick={() => void submitVerb()} loading={pending}>
              شروع کار
            </Button>
          </>
        }
      >
        <Field label="توضیح (اختیاری)" hint="اگر برنامهٔ روشنی دارید، کوتاه بنویسید.">
          <TextArea
            rows={3}
            value={startNote}
            onChange={(e) => setStartNote(e.target.value)}
            placeholder="مثلاً: بررسی مدارک را از امروز آغاز می‌کنم…"
          />
        </Field>
      </Dialog>

      <Dialog
        open={verb === "requestInfo"}
        onClose={close}
        title={VERB_TITLE.requestInfo}
        description="تا پاسخ کاربر، ساعت پاسخ‌گویی مطابق سیاست این خدمت متوقف می‌شود."
        maxWidth="md"
        actions={
          <>
            <Button variant="ghost" onClick={close} disabled={pending}>
              انصراف
            </Button>
            <Button onClick={() => void submitVerb()} loading={pending}>
              ارسال درخواست
            </Button>
          </>
        }
      >
        <Field label="اطلاعات موردنیاز" required error={infoError}>
          <TextArea
            rows={4}
            value={infoNote}
            onChange={(e) => setInfoNote(e.target.value)}
            placeholder="دقیقاً بگویید چه سند یا توضیحی لازم است…"
          />
        </Field>
      </Dialog>

      <Dialog
        open={verb === "complete"}
        onClose={close}
        title={VERB_TITLE.complete}
        description="خلاصهٔ نتیجه برای کاربر ارسال و درخواست تکمیل می‌شود. این سابقه حذف نمی‌شود."
        maxWidth="lg"
        actions={
          <>
            <Button variant="ghost" onClick={close} disabled={pending}>
              انصراف
            </Button>
            <Button onClick={() => void submitVerb()} loading={pending}>
              ثبت و تکمیل
            </Button>
          </>
        }
      >
        <Field label="خلاصهٔ نتیجه" required error={completeError}>
          <TextArea
            rows={6}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="نتیجهٔ کار، توصیه‌ها و گام‌های بعدی…"
          />
        </Field>
      </Dialog>
    </div>
  );
}

export default function LawyerReferralDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DetailContent id={id} />;
}
