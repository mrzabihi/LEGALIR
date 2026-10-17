// ============================================================
// LEGALIR — Admin · Official stamp panel (مهر و هولوگرام رسمی)
// ============================================================
// The ONE surface that can authorise the OFFICIAL LEGALIR mark. It is a
// stronger act than the internal review, so this panel is deliberately
// explicit about the two hard gates the backend enforces:
//
//   1. the current version must carry a valid internal review;
//   2. every participant bound to THAT version must have signed.
//
// The panel never decides either rule itself — it reads them from the
// stamp context and simply does not offer an action the server would
// reject. `apply` requires a written opinion (the mandatory reason), and
// once the server applies the stamp the panel shows the REAL per-party
// SMS outcome: a failure is reported, never dressed up as success.
//
// The seal and hologram previews load from the private asset route, so
// what the operator approves is exactly the bytes the hash binds to. The
// hologram's inner ink is print-only and never shown here — a screen
// preview is not a printed hologram.
// ============================================================

"use client";

import { useState } from "react";
import { snackbar } from "@legalir/ui";
import type {
  ContractStampActionRequest,
  ContractStampNotification,
  ContractStampRequestDetail,
  ContractStampStatus,
} from "@legalir/types";
import { CONTRACT_STAMP_STATUS_FA } from "@legalir/types";
import { useAdminContractStamp, useAdminContractStampDecision } from "@/hooks/useAdmin";
import {
  Badge,
  Button,
  ErrorBlock,
  Field,
  InfoBanner,
  LoadingBlock,
  TextArea,
} from "@/components/admin/ui";
import { IconCheckCircle, IconClose, IconShieldCheck, IconWarning } from "@/lib/icons";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";

type StampAction = ContractStampActionRequest["action"];

const ACTION_FA: Record<StampAction, string> = {
  request: "ثبت درخواست مهر",
  apply: "صدور مهر رسمی",
  reject: "رد درخواست مهر",
  cancel: "لغو درخواست مهر",
};

const STATUS_TONES: Record<ContractStampStatus, "neutral" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPLIED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

const EVENT_FA: Record<string, string> = {
  request: "ثبت درخواست",
  apply: "صدور مهر",
  reject: "رد درخواست",
  cancel: "لغو درخواست",
  notify: "اطلاع به طرفین",
};

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

/** A delivery row: honest about channel and failure, never optimistic. */
function DeliveryRow({ n }: { n: ContractStampNotification }) {
  return (
    <li className="flex items-start justify-between gap-2 text-caption">
      <span className="text-on-surface-variant">{n.roleFa}</span>
      <span className={n.delivered ? "text-success-700" : "text-error-700"}>
        {n.delivered
          ? n.channel === "sms"
            ? "پیامک ارسال شد"
            : "فقط در کنسول توسعه ثبت شد"
          : n.failureReasonFa ?? "ارسال ناموفق"}
      </span>
    </li>
  );
}

export function ContractStampPanel({
  contractId,
  canManage,
}: {
  contractId: string | null;
  /** `admin:contracts:stamp:manage` — only Super Admin has it. */
  canManage: boolean;
}) {
  const stamp = useAdminContractStamp(contractId);
  const decide = useAdminContractStampDecision();

  const [activeAction, setActiveAction] = useState<StampAction | null>(null);
  const [reason, setReason] = useState("");
  const [notifications, setNotifications] = useState<ContractStampNotification[]>([]);

  const data = stamp.data;
  const pending = data?.requests.find((r) => r.status === "PENDING") ?? null;
  const applied = data?.appliedRequest ?? null;

  function begin(action: StampAction) {
    setActiveAction(action);
    setReason("");
  }

  async function submit(action: StampAction) {
    if (!contractId) return;
    if (reason.trim().length < 3) {
      snackbar.show({ message: "ثبت نظر/دلیل الزامی است.", variant: "warning" });
      return;
    }
    const input: ContractStampActionRequest = {
      action,
      reason: reason.trim(),
      ...(action !== "request" && pending ? { stampRequestId: pending.id } : {}),
    };
    try {
      const result = await decide.mutateAsync({ id: contractId, input });
      setNotifications(result.notifications);
      snackbar.show({ message: `${ACTION_FA[action]} انجام شد.`, variant: "success" });
      setActiveAction(null);
      setReason("");
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ثبت اقدام مهر ناموفق بود"), variant: "error" });
      setActiveAction(null);
    }
  }

  if (stamp.isLoading) return <LoadingBlock rows={4} />;
  if (stamp.isError || !data) return <ErrorBlock onRetry={() => stamp.refetch()} />;

  // --- Why the apply action is unavailable, in the operator's words ---
  const applyBlockedFa = !data.featureEnabled
    ? "سطح مهر رسمی لیگالیر در حال حاضر فعال نیست."
    : !data.currentVersion
      ? "نسخه‌ای برای مهر وجود ندارد."
      : !data.reviewed
        ? "نسخهٔ فعلی هنوز تأیید بررسی داخلی را ندارد؛ مهر فقط روی نسخهٔ تأییدشده درج می‌شود."
        : !pending
          ? "درخواست مهرِ باز برای تصمیم‌گیری وجود ندارد."
          : !canManage
            ? "صدور مهر رسمی فقط در اختیار مدیر ارشد است."
            : null;

  const canRequest = data.featureEnabled && data.reviewed && !data.applied && !pending;
  const canApply = data.featureEnabled && Boolean(pending) && canManage && !data.applied;
  const canDecidePending = Boolean(pending) && canManage;

  return (
    <div className="space-y-4">
      {!data.featureEnabled && (
        <InfoBanner tone="warning">
          سطح «مهر رسمی لیگالیر» در تنظیمات فعال نیست؛ اقدام مهر در دسترس نیست.
        </InfoBanner>
      )}

      {/* --- The current state of the mark --- */}
      <div className="rounded-large border border-divider p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={data.applied ? "success" : "neutral"} dot>
            {data.applied ? "مهر رسمی روی نسخهٔ فعلی درج شده است" : "مهر رسمی درج نشده"}
          </Badge>
          {data.applied && applied?.approvedByLabelFa && (
            <Badge tone="brand">
              <IconShieldCheck size={13} /> {applied.approvedByLabelFa}
            </Badge>
          )}
          {data.applied && applied?.appliedAt && (
            <span className="text-caption text-muted">{toPersianDate(applied.appliedAt)}</span>
          )}
          {!data.reviewed && <Badge tone="warning">بدون تأیید بررسی داخلی</Badge>}
        </div>

        <dl className="mt-3 space-y-2 text-caption">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">نسخهٔ فعلی</dt>
            <dd className="text-on-surface">
              {data.currentVersion
                ? `نسخه ${toPersianNumber(data.currentVersion.versionNumber)}`
                : "ثبت‌نشده"}
            </dd>
          </div>
          {data.currentVersion && (
            <div>
              <dt className="mb-1 text-muted">اثر انگشت نسخه (SHA-256)</dt>
              <dd className="break-all font-mono text-on-surface" dir="ltr">
                {data.currentVersion.documentHash}
              </dd>
            </div>
          )}
        </dl>

        <p className="mt-2 text-caption leading-6 text-muted">
          مهر فقط روی همین نسخه معتبر است؛ با هر تغییر محتوا یا تعویض فایل مهر، خودکار باطل می‌شود.
          امضای همهٔ طرفین نیز پیش‌شرط صدور مهر است و مهر جایگزین امضای طرفین نیست.
        </p>
      </div>

      {/* --- The two masters --- */}
      <div className="grid grid-cols-2 gap-2">
        <figure className="rounded-medium border border-divider p-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/v1/admin/contracts/stamp-asset?kind=seal"
            alt="مهر رسمی لیگالیر"
            className="mx-auto h-24 w-auto object-contain"
          />
          <figcaption className="mt-1 text-caption text-muted">
            مهر رسمی
            <span className="mt-0.5 block font-mono text-[10px]" dir="ltr">
              {data.stampAsset.sha256 ? data.stampAsset.sha256.slice(0, 16) : "—"}
            </span>
          </figcaption>
        </figure>
        <figure className="rounded-medium border border-divider p-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/v1/admin/contracts/stamp-asset?kind=hologram"
            alt="هولوگرام لیگالیر"
            className="mx-auto h-24 w-auto object-contain"
          />
          <figcaption className="mt-1 text-caption text-muted">
            هولوگرام (چاپ‌فقط)
            <span className="mt-0.5 block text-[10px]">
              متن امنیتی آن فقط در چاپ/PDF ظاهر می‌شود.
            </span>
          </figcaption>
        </figure>
      </div>

      {/* --- Actions --- */}
      <div className="rounded-large border border-divider p-3">
        <h4 className="mb-2 flex items-center gap-1.5 text-body-2 font-bold text-on-surface">
          <IconShieldCheck size={16} className="text-primary" />
          اقدام مهر
        </h4>

        {activeAction ? (
          <div className="space-y-3">
            <Field
              label={`نظر/دلیل «${ACTION_FA[activeAction]}»`}
              hint="این متن همراه هویت شما، زمان و نسخهٔ قرارداد در سابقهٔ حسابرسی ثبت می‌شود."
              required
            >
              <TextArea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  activeAction === "apply"
                    ? "نظر نهایی خود دربارهٔ این نسخه را بنویسید…"
                    : "دلیل این اقدام را بنویسید…"
                }
              />
            </Field>
            <div className="flex justify-start gap-2">
              <Button
                variant={activeAction === "apply" ? "primary" : "secondary"}
                size="sm"
                loading={decide.isPending}
                onClick={() => void submit(activeAction)}
              >
                ثبت «{ACTION_FA[activeAction]}»
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={decide.isPending}
                onClick={() => setActiveAction(null)}
              >
                انصراف
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {pending ? (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    startIcon={<IconCheckCircle size={15} />}
                    disabled={!canApply || decide.isPending}
                    title={applyBlockedFa ?? undefined}
                    onClick={() => begin("apply")}
                  >
                    صدور مهر رسمی
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    startIcon={<IconClose size={15} />}
                    disabled={!canDecidePending || decide.isPending}
                    onClick={() => begin("reject")}
                  >
                    رد درخواست
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canDecidePending || decide.isPending}
                    onClick={() => begin("cancel")}
                  >
                    لغو درخواست
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canRequest || decide.isPending}
                  onClick={() => begin("request")}
                >
                  ثبت درخواست مهر
                </Button>
              )}
            </div>
            {pending && applyBlockedFa && (
              <p className="flex items-start gap-1.5 text-caption text-muted">
                <IconWarning size={14} className="mt-0.5 shrink-0" />
                {applyBlockedFa}
              </p>
            )}
            {!pending && !data.applied && !data.reviewed && (
              <p className="text-caption text-muted">
                درخواست مهر پس از تأیید بررسی داخلی نسخهٔ فعلی در دسترس می‌شود.
              </p>
            )}
          </div>
        )}
      </div>

      {/* --- The REAL SMS outcome of the last apply --- */}
      {notifications.length > 0 && (
        <div className="rounded-large border border-divider p-3">
          <h4 className="mb-2 text-body-2 font-bold text-on-surface">اطلاع‌رسانی به طرفین</h4>
          <ul className="space-y-1.5">
            {notifications.map((n) => (
              <DeliveryRow key={n.participantId} n={n} />
            ))}
          </ul>
          {notifications.every((n) => !n.delivered) && (
            <p className="mt-2 text-caption text-error-700">
              هیچ پیامکی به دست طرفین نرسید؛ لینک نسخهٔ نهایی را به‌صورت دستی برای آنان ارسال کنید.
            </p>
          )}
        </div>
      )}

      {/* --- History --- */}
      {data.requests.length > 0 && (
        <div className="rounded-large border border-divider p-3">
          <h4 className="mb-2 text-body-2 font-bold text-on-surface">سابقهٔ مهر</h4>
          <ol className="space-y-3">
            {data.requests.map((r) => (
              <StampHistoryItem key={r.id} request={r} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function StampHistoryItem({ request }: { request: ContractStampRequestDetail }) {
  return (
    <li className="rounded-medium border border-divider p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONES[request.status]} dot>
          {CONTRACT_STAMP_STATUS_FA[request.status]}
        </Badge>
        <span className="text-caption text-muted">{toPersianDate(request.requestedAt)}</span>
        {request.approvedByLabelFa && (
          <span className="text-caption text-on-surface-variant">
            تصمیم: {request.approvedByLabelFa}
          </span>
        )}
      </div>
      <p className="mt-1 text-caption text-on-surface-variant">{request.reasonFa}</p>
      {request.events.length > 0 && (
        <ol className="mt-2 space-y-1 border-t border-divider pt-2">
          {request.events.map((e) => (
            <li key={e.id} className="text-caption text-muted">
              <span className="text-on-surface-variant">{EVENT_FA[e.action] ?? e.action}</span>
              {` — ${e.actorLabel} — ${toPersianDate(e.createdAt)}`}
              {e.reasonFa && <span className="block text-on-surface-variant">{e.reasonFa}</span>}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
