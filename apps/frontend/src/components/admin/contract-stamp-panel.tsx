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
// The panel never decides either rule itself. The server returns an
// `eligibility` verdict computed from the same facts the write path
// re-checks, and every button and every disabled-explanation here is
// rendered from THAT verdict. A disabled button therefore always carries
// a real, server-authored reason, and a hand-crafted request cannot
// reach a state this panel would not have offered.
//
// The three stamp steps are visually and semantically distinct:
//
//   ثبت درخواست مهر     records intent; no legal effect
//   در انتظار تصمیم     the open request's real state
//   اعمال مهر رسمی      approving AND sealing in one recorded act
//
// `apply` requires a written opinion (the mandatory reason) and opens a
// confirmation dialog naming the contract, the exact version and its
// fingerprint, with the real irreversibility of the act stated plainly
// and the printable preview one click away. Once the server applies the
// stamp the panel shows the REAL per-party SMS outcome: a failure is
// reported, never dressed up as success.
//
// The seal and hologram previews load from the private asset route, so
// what the operator approves is exactly the bytes the hash binds to. The
// hologram's inner ink is print-only and never shown here — a screen
// preview is not a printed hologram.
// ============================================================

"use client";

import { useState } from "react";
import { Dialog, snackbar } from "@legalir/ui";
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
import {
  IconCheckCircle,
  IconClose,
  IconDocument,
  IconShieldCheck,
  IconWarning,
} from "@/lib/icons";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";

type StampAction = ContractStampActionRequest["action"];

const ACTION_FA: Record<StampAction, string> = {
  request: "ثبت درخواست مهر",
  apply: "اعمال مهر رسمی",
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

export function ContractStampPanel({ contractId }: { contractId: string | null }) {
  const stamp = useAdminContractStamp(contractId);
  const decide = useAdminContractStampDecision();

  const [activeAction, setActiveAction] = useState<StampAction | null>(null);
  const [reason, setReason] = useState("");
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const [notifications, setNotifications] = useState<ContractStampNotification[]>([]);

  const data = stamp.data;
  const pending = data?.requests.find((r) => r.status === "PENDING") ?? null;
  const applied = data?.appliedRequest ?? null;
  const eligibility = data?.eligibility ?? null;

  function begin(action: StampAction) {
    setReason("");
    if (action === "apply") {
      setConfirmApplyOpen(true);
      return;
    }
    setActiveAction(action);
  }

  function closeDialog() {
    if (decide.isPending) return;
    setConfirmApplyOpen(false);
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
      // `apply` freezes the final version in the same act. Report what the
      // server actually did — a failed finalization is never dressed up as
      // a successful approval.
      if (result.finalization && !result.finalization.ok) {
        snackbar.show({
          message: `مهر ثبت شد اما نهایی‌سازی قرارداد ناموفق بود: ${result.finalization.messageFa}`,
          variant: "warning",
        });
      } else if (result.finalization?.ok) {
        snackbar.show({
          message: "مهر رسمی درج و نسخهٔ نهایی قرارداد قفل شد.",
          variant: "success",
        });
      } else {
        snackbar.show({ message: `${ACTION_FA[action]} انجام شد.`, variant: "success" });
      }
      setActiveAction(null);
      setConfirmApplyOpen(false);
      setReason("");
    } catch (err) {
      // The server re-checks every precondition, so a refusal here usually
      // means the facts moved since the panel was rendered (another
      // operator, a content change, a withdrawn review). Show the real
      // message and re-read the context so the verdict stops lying.
      snackbar.show({ message: errMessage(err, "ثبت اقدام مهر ناموفق بود"), variant: "error" });
      setActiveAction(null);
      void stamp.refetch();
    }
  }

  if (stamp.isLoading) return <LoadingBlock rows={4} />;
  if (stamp.isError || !data || !eligibility) return <ErrorBlock onRetry={() => stamp.refetch()} />;

  const blockers = eligibility.blockers;
  const primaryBlocker = blockers[0]?.messageFa;
  const previewHref = contractId
    ? `/api/v1/admin/contracts/${contractId}/pdf${
        data.currentVersion ? `?version=${data.currentVersion.id}` : ""
      }`
    : null;

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
          {pending && <Badge tone="warning">درخواست باز — در انتظار تصمیم</Badge>}
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

        {previewHref && (
          <div className="mt-2">
            <a href={previewHref} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm" startIcon={<IconDocument size={15} />}>
                مشاهده و چاپ نسخهٔ فعلی (PDF)
              </Button>
            </a>
          </div>
        )}
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
                placeholder="دلیل این اقدام را بنویسید…"
              />
            </Field>
            <div className="flex justify-start gap-2">
              <Button
                variant={
                  activeAction === "reject" || activeAction === "cancel" ? "danger" : "primary"
                }
                size="sm"
                loading={decide.isPending}
                disabled={decide.isPending}
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
                    disabled={!eligibility.canApply || decide.isPending}
                    title={eligibility.canApply ? undefined : primaryBlocker}
                    onClick={() => begin("apply")}
                  >
                    تأیید و اعمال مهر رسمی
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    startIcon={<IconClose size={15} />}
                    disabled={!eligibility.canReject || decide.isPending}
                    title={eligibility.canReject ? undefined : primaryBlocker}
                    onClick={() => begin("reject")}
                  >
                    رد درخواست
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!eligibility.canCancel || decide.isPending}
                    title={eligibility.canCancel ? undefined : primaryBlocker}
                    onClick={() => begin("cancel")}
                  >
                    لغو درخواست
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!eligibility.canRequest || decide.isPending}
                  title={eligibility.canRequest ? undefined : primaryBlocker}
                  onClick={() => begin("request")}
                >
                  ثبت درخواست مهر
                </Button>
              )}
            </div>

            {/* §9 — a disabled button ALWAYS states the real condition. The
                list is the server's own verdict, in resolution order; it is
                never re-derived here and never invented. */}
            {blockers.length > 0 && (
              <div
                className="rounded-medium bg-surface-container-low p-2.5"
                role="status"
                aria-live="polite"
              >
                <p className="flex items-center gap-1.5 text-caption font-medium text-on-surface">
                  <IconWarning size={14} className="shrink-0 text-warning-700" />
                  {pending ? "برای تصمیم روی این درخواست:" : "برای ثبت درخواست مهر:"}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 ps-5 text-caption leading-6 text-muted">
                  {blockers.map((b, i) => (
                    <li key={`${b.code}-${i}`}>{b.messageFa}</li>
                  ))}
                </ul>
              </div>
            )}

            {!pending && blockers.length === 0 && eligibility.canRequest && (
              <p className="text-caption text-muted">
                ثبت درخواست، فقط قصد مهر را ثبت می‌کند و هیچ اثر حقوقی ندارد؛ صدور مهر پس از امضای
                همهٔ طرفین و با تصمیم مدیر ارشد انجام می‌شود.
              </p>
            )}
          </div>
        )}
      </div>

      {/* --- §9.3 the mandatory confirmation for the official act --- */}
      <Dialog
        open={confirmApplyOpen}
        onClose={closeDialog}
        title="تأیید اعمال مهر و هولوگرام LEGALIR"
        maxWidth="3xl"
        persistent={decide.isPending}
        actions={
          <>
            <Button variant="ghost" size="sm" disabled={decide.isPending} onClick={closeDialog}>
              انصراف
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={decide.isPending}
              disabled={decide.isPending || reason.trim().length < 3}
              startIcon={<IconShieldCheck size={15} />}
              onClick={() => void submit("apply")}
            >
              تأیید و اعمال مهر
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-caption">
            <div className="min-w-0">
              <dt className="text-muted">شمارهٔ قرارداد</dt>
              <dd className="font-mono text-on-surface" dir="ltr">
                {data.contract.referenceCode}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted">نوع قرارداد</dt>
              <dd className="truncate text-on-surface" title={data.contract.typeFa}>
                {data.contract.typeFa}
              </dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="text-muted">عنوان</dt>
              <dd className="text-on-surface">{data.contract.title}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted">نسخهٔ مهرشده</dt>
              <dd className="text-on-surface">
                {data.currentVersion
                  ? `نسخه ${toPersianNumber(data.currentVersion.versionNumber)}`
                  : "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted">فایل مهر (SHA-256)</dt>
              <dd className="truncate font-mono text-on-surface" dir="ltr">
                {data.stampAsset.sha256 ?? "—"}
              </dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="text-muted">اثر انگشت نسخه</dt>
              <dd className="break-all font-mono text-on-surface" dir="ltr">
                {data.currentVersion?.documentHash ?? "—"}
              </dd>
            </div>
          </dl>

          <p className="rounded-medium bg-surface-container-low p-2.5 text-caption leading-6 text-on-surface-variant">
            آیا از اعمال مهر و هولوگرام LEGALIR روی این نسخه از قرارداد مطمئن هستید؟ مهر روی همین
            نسخهٔ تثبیت‌شده درج می‌شود و از آن برداشته نمی‌شود؛ هر تغییر محتوا نسخهٔ جدیدی می‌سازد و
            مهر این نسخه را باطل می‌کند. نتیجهٔ این عملیات همراه هویت شما در سابقهٔ حسابرسی ثبت و
            قابل‌ردیابی می‌شود. هولوگرام نشان بصری اصالت است و جای امضای طرفین یا امضای دیجیتال را
            نمی‌گیرد.
          </p>

          {previewHref && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption text-muted">پیش‌نمایش نسخه‌ای که مهر می‌شود</p>
                <a href={previewHref} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm" startIcon={<IconDocument size={14} />}>
                    باز کردن در تب جدید
                  </Button>
                </a>
              </div>
              <iframe
                src={previewHref}
                title="پیش‌نمایش نسخهٔ قرارداد"
                className="h-64 w-full rounded-medium border border-divider bg-surface-container-low"
              />
            </div>
          )}

          <Field
            label="دلیل/نظر تأیید"
            hint="الزامی — این متن همراه هویت شما، زمان و اثر انگشت نسخه در سابقهٔ حسابرسی ثبت می‌شود."
            required
          >
            <TextArea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="نظر نهایی خود دربارهٔ این نسخه را بنویسید…"
            />
          </Field>
        </div>
      </Dialog>

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
