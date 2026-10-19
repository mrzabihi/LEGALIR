// ============================================================
// LEGALIR — Admin · Contract review drawer (بررسی قرارداد)
// ============================================================
// §6/§7 of the contract spec: the operator's ONE surface for judging a
// generated contract before it may be issued. It renders the SAME document
// the owner sees (the server's `renderContract` output), the parties, the
// completeness, the current version hash and the review history — then offers
// exactly the four actions the backend permits:
//
//   approve       تأیید برای صدور نهایی
//   reject        رد و بازگرداندن همراه با دلیل
//   request_info  درخواست اطلاعات یا اصلاح مشخص
//   cancel        لغو بررسی با علت
//
// The decision is bound to the review's version hash server-side; this drawer
// never invents a transition, and only the ONE open (PENDING) review can be
// decided. Without `admin:contracts:review` the surface is read-only.
// ============================================================

"use client";

import { useState } from "react";
import { Drawer, ConfirmDialog, snackbar } from "@legalir/ui";
import type {
  AdminContractReviewActionRequest,
  ContractAdminReviewAction,
} from "@legalir/types";
import {
  CONTRACT_ADMIN_REVIEW_STATUS_FA,
  SIGNATURE_ASSURANCE_LABELS_FA,
  SIGNATURE_ATTESTATION_CHANNEL_FA,
  SIGNATURE_SIGN_METHOD_FA,
} from "@legalir/types";
import type { SignatureAttestationChannel } from "@legalir/types";
import {
  useAdminAdvanceSigning,
  useAdminContract,
  useAdminContractAttestation,
  useAdminContractContact,
  useAdminContractMessage,
  useAdminContractReview,
  useAdminMe,
  useAdminResendInvitations,
} from "@/hooks/useAdmin";
import type { AdminContractDetail } from "@/lib/api/admin";
import { ContractStampPanel } from "./contract-stamp-panel";
import { ContractStagesTable } from "./contract-stages-table";
import {
  Badge,
  Button,
  ErrorBlock,
  Field,
  InfoBanner,
  LoadingBlock,
  MobileNumber,
  Select,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { IconCheckCircle, IconClose, IconCopy, IconDocument, IconShield } from "@/lib/icons";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";

/** The Persian label for each decision. */
const ACTION_FA: Record<ContractAdminReviewAction, string> = {
  approve: "تأیید برای صدور نهایی",
  reject: "رد قرارداد",
  request_info: "درخواست اصلاح",
  cancel: "لغو بررسی",
};

const STATUS_TONES: Record<
  string,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CHANGES_REQUESTED: "warning",
  CANCELLED: "neutral",
};

/** The tone each signature-request status deserves in the record. */
const SIGNATURE_REQUEST_TONES: Record<
  string,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  DRAFT: "neutral",
  SENT: "info",
  PARTIALLY_SIGNED: "warning",
  COMPLETED: "success",
  DECLINED: "danger",
  EXPIRED: "warning",
  CANCELLED: "neutral",
};

/** The Persian label for each party-approval state. */
const APPROVAL_STATUS_FA: Record<string, string> = {
  pending: "در انتظار تأیید",
  approved: "تأیید شد",
  changes_requested: "اصلاح خواسته شد",
  rejected: "رد شد",
};

/** The Persian label for each invitation's lifecycle state. */
const INVITATION_STATUS_FA: Record<string, string> = {
  ACTIVE: "لینک فعال",
  USED: "استفاده‌شده",
  REVOKED: "باطل‌شده",
  EXPIRED: "منقضی‌شده",
};

/** The review state of a legal citation, in Persian. */
const CITATION_STATUS_FA: Record<string, string> = {
  reviewed: "بازبینی‌شده",
  pending: "در انتظار بازبینی",
  needs_revision: "نیازمند اصلاح",
};

/** Actions that require a written reason before they may be submitted. */
const REASON_REQUIRED: ContractAdminReviewAction[] = ["reject", "request_info", "cancel"];

/** Actions destructive enough to confirm even after the reason is typed. */
const CONFIRM_ACTIONS: ContractAdminReviewAction[] = ["reject", "cancel"];

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

export function ContractDetailDrawer({
  contractId,
  canReview,
  onClose,
}: {
  contractId: string | null;
  canReview: boolean;
  onClose: () => void;
}) {
  const detail = useAdminContract(contractId);
  const review = useAdminContractReview();
  // `useAdminMe` must run unconditionally (rules of hooks); it is the same
  // cached read the page uses, so there is no extra request.
  const { can } = useAdminMe();
  // The OFFICIAL stamp is a Super-Admin-only act; the server enforces the
  // permission, and the panel offers only the actions `eligibility` allows.
  // Reading the stamp context is its own permission; without it the panel is
  // never rendered, so a reviewer role never sees an empty or failing block.
  const canReadStamp = can("admin:contracts:stamp:read");

  const [activeAction, setActiveAction] = useState<ContractAdminReviewAction | null>(null);
  const [reason, setReason] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<ContractAdminReviewAction | null>(null);

  // The attestation form: an admin's VERIFICATION of a signature a party
  // already gave. It never alters the party's status or the contract state.
  const attestation = useAdminContractAttestation();
  const [attestationParticipantId, setAttestationParticipantId] = useState("");
  const [attestationChannel, setAttestationChannel] =
    useState<SignatureAttestationChannel>("party_link");
  const [attestationNote, setAttestationNote] = useState("");

  // The per-party resend (§5). One party at a time; the raw link is shown
  // exactly for the parties whose SMS did NOT go out.
  const resend = useAdminResendInvitations();
  const [resendingParticipantId, setResendingParticipantId] = useState<string | null>(null);
  const [handoverLinks, setHandoverLinks] = useState<
    Record<string, { token: string; expiresAt: string }>
  >({});

  // §6 — the printable message draft. The counter is the SAME code-point
  // count the server enforces, so the two can never disagree.
  const message = useAdminContractMessage();
  const [messageDraft, setMessageDraft] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  // §5 — one destination being corrected, and the send confirmation.
  const contact = useAdminContractContact();
  const [contactTargetId, setContactTargetId] = useState<string | null>(null);
  const [contactMobile, setContactMobile] = useState("");
  const [contactReason, setContactReason] = useState("");
  const [contactConfirmed, setContactConfirmed] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // §T4 — the manual advance, with its mandatory reason.
  const advance = useAdminAdvanceSigning();
  const [advanceReason, setAdvanceReason] = useState("");
  const [advanceOpen, setAdvanceOpen] = useState(false);

  const data = detail.data;
  const events = data?.adminReview?.events ?? [];
  // The decision panel only appears while a review is PENDING; a decision can
  // never be replayed onto a terminal review (the server rejects it too).
  const canDecide = canReview && data?.adminReview?.status === "PENDING";

  // §5 — the destinations an operator must SEE before sending. A signature
  // request carries the exact participants (and their current numbers); before
  // one exists the parties themselves are the destination rows the request
  // will be built from. The key tells the server which record to correct.
  const contactTargets =
    (data?.signingParticipants.length ?? 0) > 0
      ? data!.signingParticipants.map((p) => ({
          key: `participant:${p.id}`,
          participantId: p.id as string | null,
          partyId: p.partyId,
          roleFa: p.roleFa,
          nameFa: p.nameFa,
          mobile: p.mobile,
          locked: p.status === "SIGNED",
        }))
      : (data?.parties ?? []).map((p) => ({
          key: `party:${p.id}`,
          participantId: null as string | null,
          partyId: p.id as string | null,
          roleFa: p.roleFa,
          nameFa: p.nameFa,
          mobile: p.mobile,
          locked: false,
        }));

  // §6 — the message the counter measures. `null` means "not edited yet", so
  // the stored value is shown; the count is by CODE POINT (Array.from), the
  // same count the server enforces.
  const messageText = messageDraft ?? data?.adminMessage?.messageFa ?? "";
  const messageMax = data?.adminMessageMaxChars ?? 100;
  const messageRemaining = messageMax - Array.from(messageText).length;

  function beginAction(action: ContractAdminReviewAction) {
    if (REASON_REQUIRED.includes(action)) {
      setActiveAction(action);
      setReason("");
    } else {
      void submit(action, "");
    }
  }

  async function submit(action: ContractAdminReviewAction, reasonText: string) {
    if (!contractId) return;
    const input: AdminContractReviewActionRequest = { action };
    if (reasonText.trim()) input.reason = reasonText.trim();
    try {
      await review.mutateAsync({ id: contractId, input });
      snackbar.show({ message: `${ACTION_FA[action]} انجام شد.`, variant: "success" });
      setActiveAction(null);
      setPendingConfirm(null);
      setReason("");
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ثبت بررسی ناموفق بود"), variant: "error" });
      setActiveAction(null);
      setPendingConfirm(null);
    }
  }

  /**
   * Record that an admin checked a signature the PARTY gave. The origin
   * (channel) and the note are mandatory; the server refuses a party who
   * has not signed, and never changes any status from here.
   */
  async function submitAttestation() {
    if (!contractId || !attestationParticipantId) return;
    const noteFa = attestationNote.trim();
    if (noteFa.length < 5) {
      snackbar.show({
        message: "بنویسید دقیقاً چه چیزی را بررسی کردید (حداقل ۵ نویسه).",
        variant: "warning",
      });
      return;
    }
    try {
      await attestation.mutateAsync({
        id: contractId,
        input: { participantId: attestationParticipantId, channel: attestationChannel, noteFa },
      });
      snackbar.show({
        message: "تأییدیهٔ بررسی ثبت شد. وضعیت طرف و قرارداد تغییری نکرد.",
        variant: "success",
      });
      setAttestationNote("");
      setAttestationParticipantId("");
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ثبت تأییدیهٔ بررسی ناموفق بود"), variant: "error" });
    }
  }

  /**
   * Resend the signature link to ONE party. The server revokes that party's
   * previous ACTIVE link in the same call, so two working links can never
   * coexist. Delivery is REAL: a failed SMS yields a handover link here
   * instead of a claim that a message went out.
   */
  async function resendToParticipant(participantId: string, roleFa: string) {
    if (!contractId) return;
    setResendingParticipantId(participantId);
    try {
      const result = await resend.mutateAsync({
        id: contractId,
        input: { participantIds: [participantId] },
      });
      const invitation = result.invitations[0];
      if (invitation && !invitation.delivered) {
        setHandoverLinks((prev) => ({
          ...prev,
          [participantId]: { token: invitation.token, expiresAt: invitation.expiresAt },
        }));
        snackbar.show({
          message: `ارسال پیامک برای ${roleFa} انجام نشد. لینک را دستی تحویل دهید.`,
          variant: "warning",
        });
      } else if (invitation) {
        snackbar.show({
          message: `لینک تازه برای ${roleFa} ارسال شد${
            invitation.channel === "dev-console" ? " (خروجی توسعه — پیامک واقعی نبود)" : ""
          }.`,
          variant: "success",
        });
      }
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ارسال مجدد لینک ناموفق بود"), variant: "error" });
    } finally {
      setResendingParticipantId(null);
    }
  }

  /** Copy the one-time handover link so the operator can send it directly. */
  async function copyHandoverLink(token: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/contracts/sign/${token}`);
      snackbar.show({ message: "لینک کپی شد.", variant: "success" });
    } catch {
      snackbar.show({
        message: "کپی لینک در این مرورگر ممکن نبود؛ لینک را دستی انتخاب کنید.",
        variant: "warning",
      });
    }
  }

  function confirmReasonAction() {
    if (!activeAction) return;
    if (reason.trim().length < 3) {
      snackbar.show({ message: "ثبت دلیل الزامی است.", variant: "warning" });
      return;
    }
    if (CONFIRM_ACTIONS.includes(activeAction)) {
      setPendingConfirm(activeAction);
    } else {
      void submit(activeAction, reason);
    }
  }

  /**
   * §6 — store the printable message. Over the limit the server refuses, so
   * the save button is disabled while the counter is negative; an EMPTY text
   * is a real value here: it removes the card, so no empty red band prints.
   */
  async function saveMessage() {
    if (!contractId) return;
    const text = messageText.trim();
    if (Array.from(text).length > messageMax) {
      setMessageError(`متن نباید بیش از ${toPersianNumber(messageMax)} کاراکتر باشد.`);
      return;
    }
    setMessageError(null);
    try {
      await message.mutateAsync({ id: contractId, messageFa: text });
      setMessageDraft(null);
      snackbar.show({
        message: text
          ? "پیام چاپی ذخیره شد؛ نسخهٔ نهایی ذخیره‌شده دوباره تولید می‌شود."
          : "پیام چاپی پاک شد؛ دیگر هیچ کارت قرمزی چاپ نمی‌شود.",
        variant: "success",
      });
    } catch (err) {
      setMessageError(errMessage(err, "ذخیرهٔ پیام چاپی ناموفق بود"));
    }
  }

  /**
   * §5 — correct ONE destination, optionally sending the link afterwards.
   * `send` is only ever true from the button the operator pressed AFTER
   * checking the confirmation box; the server records the real delivery
   * outcome either way and never reports a failed send as success.
   */
  async function submitContactCorrection(send: boolean) {
    if (!contractId || !contactTargetId) return;
    const reasonFa = contactReason.trim();
    if (reasonFa.length < 3) {
      setContactError("دلیل اصلاح شمارهٔ تماس الزامی است (حداقل ۳ نویسه).");
      return;
    }
    if (send && !contactConfirmed) {
      setContactError("برای ارسال لینک به شمارهٔ جدید، ابتدا کادر تأیید را علامت بزنید.");
      return;
    }
    const target = contactTargets.find((t) => t.key === contactTargetId);
    if (!target) {
      setContactError("طرف انتخاب‌شده پیدا نشد؛ فهرست را دوباره باز کنید.");
      return;
    }
    setContactError(null);
    try {
      const result = await contact.mutateAsync({
        id: contractId,
        input: {
          ...(target.participantId ? { participantId: target.participantId } : {}),
          ...(target.partyId ? { partyId: target.partyId } : {}),
          newMobile: contactMobile.trim(),
          reasonFa,
          send,
          ...(send ? { confirmed: true } : {}),
        },
      });
      setContactTargetId(null);
      setContactMobile("");
      setContactReason("");
      setContactConfirmed(false);
      if (send && result.sent) {
        snackbar.show({
          message: "شماره اصلاح شد و لینک امضا به شمارهٔ جدید ارسال شد.",
          variant: "success",
        });
      } else if (send) {
        snackbar.show({
          message: result.errorFa ?? "شماره اصلاح شد اما ارسال لینک ناموفق بود.",
          variant: "warning",
        });
      } else {
        snackbar.show({
          message: "شمارهٔ مقصد اصلاح شد؛ لینکی ارسال نشد.",
          variant: "success",
        });
      }
    } catch (err) {
      setContactError(errMessage(err, "اصلاح شمارهٔ مقصد ناموفق بود"));
    }
  }

  /**
   * §T4 — advance to party signing WITHOUT the LEGALIR review queue. The
   * reason is mandatory and the server stores the path as
   * «بررسی‌نشده توسط لیگالیر»; this surface can never record a review.
   */
  async function submitAdvance() {
    if (!contractId) return;
    if (advanceReason.trim().length < 3) {
      snackbar.show({ message: "ثبت دلیل پیشبرد الزامی است.", variant: "warning" });
      return;
    }
    try {
      await advance.mutateAsync({ id: contractId, reasonFa: advanceReason.trim() });
      setAdvanceReason("");
      setAdvanceOpen(false);
      snackbar.show({
        message: "قرارداد بدون بررسی لیگالیر به مرحلهٔ امضای طرفین رفت.",
        variant: "success",
      });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "پیشبرد به مرحلهٔ امضا ناموفق بود"), variant: "error" });
    }
  }

  /**
   * §4 — the stage table never performs an operation itself. It scrolls the
   * operator to the ONE section that owns the real action, where the server's
   * preconditions (and their Persian reasons) are already shown. A target
   * that is not rendered for this contract (e.g. no stamp permission) is a
   * no-op rather than a fabricated button.
   */
  function scrollToStageTarget(targetId: string) {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.focus({ preventScroll: true });
  }

  return (
    <>
      <Drawer
        open={Boolean(contractId)}
        onClose={onClose}
        width={680}
        title={data ? `بررسی قرارداد — ${data.contract.referenceCode}` : "بررسی قرارداد"}
      >
        {detail.isLoading ? (
          <LoadingBlock rows={8} />
        ) : detail.isError || !data ? (
          <ErrorBlock onRetry={() => detail.refetch()} />
        ) : (
          <div className="space-y-5">
            {!canReview && (
              <InfoBanner tone="warning">
                شما مجوز «تأیید/رد و بررسی قراردادها» را ندارید؛ این نمایش فقط‌خواندنی است.
              </InfoBanner>
            )}

            {/* --- Identity + state --- */}
            <div className="rounded-large border border-divider p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONES[data.adminReview?.status ?? ""] ?? "neutral"} dot>
                  {data.adminReview
                    ? CONTRACT_ADMIN_REVIEW_STATUS_FA[data.adminReview.status]
                    : "بدون بررسی ثبت‌شده"}
                </Badge>
                <Badge tone="brand">{data.contract.stateFa}</Badge>
                {data.contract.isSample && (
                  <Badge tone="warning" title="این قرارداد فقط برای آزمایش ساخته شده و داده‌های آن ساختگی است">
                    نمونه آزمایشی
                  </Badge>
                )}
                {data.approved && (
                  <Badge tone="success">
                    <IconCheckCircle size={13} /> نسخهٔ فعلی تأییدشده است
                  </Badge>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-caption">
                <Info label="عنوان" value={data.contract.title || "بدون عنوان"} />
                <Info label="نوع" value={data.contract.typeFa} />
                <Info label="کاربر مالک" value={data.contract.ownerLabelFa} />
                <Info label="طرفین" value={data.contract.partySummaryFa} />
                <Info label="کد پیگیری" value={data.contract.referenceCode} mono />
                <Info label="پیشرفت" value={`${toPersianNumber(data.contract.progress)}٪`} />
                <Info label="ایجاد" value={toPersianDate(data.contract.createdAt)} />
                <Info label="آخرین تغییر" value={toPersianDate(data.contract.updatedAt)} />
              </dl>
            </div>

            {/* --- §4 the contract's REAL lifecycle walk --- */}
            <ContractStagesTable
              stages={data.stages}
              currentPdfUrl={data.currentPdfUrl}
              finalPdfUrl={data.finalDocument?.url ?? null}
              onRunAction={scrollToStageTarget}
            />

            {/* --- §3 WHICH path produced the signing authority. The review
                path and «ثبت نهایی بدون بررسی» are never blurred: a
                self-final record is never shown as reviewed or approved. --- */}
            <Section
              title="مسیر ثبت نهایی"
              icon={<IconShield size={16} className="text-primary" />}
            >
              {data.registration ? (
                <div className="space-y-2 text-caption">
                  {data.registration.reviewedByLegalir ? (
                    <InfoBanner tone="success">
                      این نسخه از مسیر «{data.registration.pathFa}» گذشته و توسط لیگالیر
                      بررسی شده است.
                    </InfoBanner>
                  ) : (
                    <InfoBanner tone="warning">
                      این قرارداد با مسیر «{data.registration.pathFa}» ثبت شده است.{" "}
                      <b>این نسخه توسط لیگالیر بررسی نشده است</b> و در هیچ نمایشی نباید
                      تأییدشده یا بررسی‌شده جلوه کند.
                    </InfoBanner>
                  )}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <Info label="مسیر ثبت" value={data.registration.pathFa} />
                    <Info
                      label="وضعیت بررسی"
                      value={
                        data.registration.reviewedByLegalir
                          ? "بررسی‌شده توسط لیگالیر"
                          : "بررسی‌نشده توسط لیگالیر"
                      }
                    />
                    <Info
                      label="ثبت‌کننده"
                      value={`${data.registration.actorLabelFa} (${
                        data.registration.actorKind === "admin" ? "ادمین" : "طرف قرارداد"
                      })`}
                    />
                    <Info label="زمان ثبت" value={toPersianDate(data.registration.createdAt)} />
                  </dl>
                  {data.registration.reasonFa && (
                    <p className="rounded-medium bg-surface-container-low p-2 leading-6 text-muted">
                      دلیل ثبت: {data.registration.reasonFa}
                    </p>
                  )}
                  <p
                    className="break-all font-mono text-labelSmall text-muted"
                    dir="ltr"
                    title={data.registration.documentHash}
                  >
                    SHA-256: {data.registration.documentHash}
                  </p>
                </div>
              ) : (
                <p className="text-caption leading-6 text-muted">
                  هنوز هیچ مسیری برای ثبت نهایی این قرارداد انتخاب نشده است. مسیر در لحظهٔ ثبت
                  نهایی انتخاب می‌شود و به اثر انگشت همان نسخه قفل می‌گردد.
                </p>
              )}
            </Section>

            {/* --- §T1/T2 what the PDF cannot print right now. Reported
                BEFORE finalization so nothing is dropped silently. --- */}
            {data.printIssues.length > 0 && (
              <InfoBanner tone="warning">
                <p className="font-medium">
                  فایل نهایی نمی‌تواند همهٔ محتوای این قرارداد را چاپ کند:
                </p>
                <ul className="mt-1 list-disc ps-4">
                  {data.printIssues.map((issue, i) => (
                    <li key={`${issue.code}-${issue.documentId ?? i}`}>
                      {issue.titleFa} — {issue.messageFa}
                    </li>
                  ))}
                </ul>
                <p className="mt-1">
                  تا رفع این موارد، ثبت نهایی و پیشبرد به مرحلهٔ امضا مسدود است.
                </p>
              </InfoBanner>
            )}

            {/* --- Version binding — what the decision is bound to --- */}
            <Section title="نسخه و اثر انگشت">
              {data.currentVersion ? (
                <div className="space-y-2 text-caption">
                  <Info
                    label="نسخهٔ فعلی"
                    value={`نسخه ${toPersianNumber(data.currentVersion.versionNumber)} — ${toPersianDate(
                      data.currentVersion.createdAt
                    )}`}
                  />
                  <div>
                    <dt className="mb-1 text-muted">اثر انگشت (SHA-256)</dt>
                    <dd className="break-all font-mono text-on-surface" dir="ltr">
                      {data.currentVersion.documentHash}
                    </dd>
                  </div>
                  <p className="text-caption text-muted">
                    تصمیم بررسی به همین اثر انگشت گره می‌خورد؛ اگر محتوای قرارداد پس از تأیید تغییر
                    کند، تأیید باطل می‌شود و قرارداد باید دوباره به صف بازگردد.
                  </p>
                </div>
              ) : (
                <p className="text-caption text-muted">
                  نسخه‌ای تثبیت نشده است؛ قرارداد هنوز برای بررسی آماده نیست.
                </p>
              )}

              {/* §2.4 — every frozen version, newest first. Nothing is
                  collapsed: a superseded draft stays visible, so the record
                  can never lose a version. */}
              {data.versions.length > 0 && (
                <div className="mt-3 border-t border-divider pt-2.5">
                  <p className="mb-1.5 text-labelSmall text-muted">
                    تاریخچهٔ نسخه‌ها ({toPersianNumber(data.versions.length)} نسخه)
                  </p>
                  <ul className="space-y-1.5 text-caption">
                    {data.versions.map((v) => (
                      <li
                        key={v.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-medium border border-divider px-2 py-1.5"
                      >
                        <span className="flex flex-wrap items-center gap-1.5 text-on-surface">
                          {`نسخه ${toPersianNumber(v.versionNumber)}`}
                          {v.isCurrent && <Badge tone="brand">جاری</Badge>}
                          {v.isFinal && <Badge tone="success">نهایی</Badge>}
                        </span>
                        <span
                          className="text-labelSmall text-muted"
                          title={v.documentHash}
                        >
                          {toPersianDate(v.createdAt)} ·{" "}
                          <span className="font-mono" dir="ltr">
                            {v.documentHash.slice(0, 10)}…
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>

            {/* --- The FINAL stamped artifact — the printable evidence --- */}
            <Section
              title="سند نهایی و مهر رسمی"
              icon={<IconShield size={16} className="text-primary" />}
            >
              {data.finalDocument ? (
                <FinalDocumentBlock doc={data.finalDocument} />
              ) : (
                <p className="text-caption text-muted">
                  سند نهایی هنوز تولید نشده است. پس از امضای هر دو طرف و تأیید نهایی، نسخهٔ
                  چاپی با مهر رسمی و هولوگرام در همین بخش در دسترس قرار می‌گیرد.
                </p>
              )}
            </Section>

            {/* --- §T2/§1 admin access to the evidence itself: the uploaded
                signature images and every stored document, each served by an
                authorized admin-only route (never a public URL). --- */}
            {(data.signingParticipants.some((p) => p.proofUrl) ||
              data.documents.length > 0) && (
              <Section
                title="امضاهای بارگذاری‌شده و مدارک"
                icon={<IconDocument size={16} className="text-primary" />}
              >
                {data.signingParticipants.length > 0 && (
                  <div className={data.documents.length > 0 ? "mb-3" : undefined}>
                    <p className="mb-1.5 text-labelSmall text-muted">وضعیت امضای هر طرف</p>
                    <ul className="space-y-1.5 text-caption">
                      {data.signingParticipants.map((p) => {
                        const proofDoc = data.documents.find(
                          (d) => d.id === p.proofDocumentId
                        );
                        const isImage =
                          proofDoc?.mime === "image/png" ||
                          proofDoc?.mime === "image/jpeg";
                        return (
                          <li
                            key={p.id}
                            className="rounded-medium border border-divider p-2.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-on-surface">
                                {p.roleFa}
                                {p.nameFa && <span className="ms-1 text-muted">— {p.nameFa}</span>}
                              </span>
                              <Badge
                                tone={p.status === "SIGNED" ? "success" : "warning"}
                                dot
                              >
                                {p.status === "SIGNED"
                                  ? `امضا شد${
                                      p.signedAt ? ` — ${toPersianDate(p.signedAt)}` : ""
                                    }`
                                  : "در انتظار امضا"}
                              </Badge>
                            </div>
                            {p.proofUrl ? (
                              <div className="mt-1.5 flex items-start gap-2">
                                {isImage && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={p.proofUrl}
                                    alt={`تصویر امضای ${p.nameFa || p.roleFa}`}
                                    className="h-16 w-32 rounded-small border border-divider bg-white object-contain"
                                  />
                                )}
                                <a
                                  href={p.proofUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  مشاهدهٔ اصل امضای ثبت‌شده
                                </a>
                              </div>
                            ) : (
                              <p className="mt-1 text-labelSmall text-muted">
                                هنوز تصویر امضایی برای این طرف ذخیره نشده است.
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {data.documents.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-labelSmall text-muted">
                      مدارک و پیوست‌های ذخیره‌شده ({toPersianNumber(data.documents.length)} فایل)
                    </p>
                    <ul className="space-y-1 text-caption">
                      {data.documents.map((d) => (
                        <li
                          key={d.id}
                          className="flex flex-wrap items-center justify-between gap-2 border-b border-divider pb-1 last:border-0"
                        >
                          <span className="min-w-0">
                            <span className="text-on-surface">{d.titleFa}</span>
                            <span className="ms-1 text-labelSmall text-muted">
                              ({d.fileName})
                            </span>
                          </span>
                          <span className="flex items-center gap-2 text-labelSmall text-muted">
                            <span>{`${toPersianNumber(Math.max(1, Math.round(d.sizeBytes / 1024)))} کیلوبایت`}</span>
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              مشاهده
                            </a>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>
            )}

            {/* --- Completeness — blocking issues --- */}
            {data.completeness.blockers.length > 0 && (
              <InfoBanner tone="warning">
                <p className="font-medium">این قرارداد موارد ناقص دارد:</p>
                <ul className="mt-1 list-disc ps-4">
                  {data.completeness.blockers.map((b) => (
                    <li key={b.sectionKey}>{b.labelFa}</li>
                  ))}
                </ul>
              </InfoBanner>
            )}

            {/* --- The document under review (the SAME render the owner sees) --- */}
            <Section
              title="سند مورد بررسی"
              icon={<IconDocument size={16} className="text-primary" />}
            >
              <article
                dir="rtl"
                className="rounded-medium border border-divider bg-surface-container p-3"
              >
                <h5 className="text-titleSmall text-on-surface">{data.rendered.titleFa}</h5>
                {data.rendered.preambleFa && (
                  <p className="mt-2 whitespace-pre-line text-caption leading-6 text-on-surface-variant">
                    {data.rendered.preambleFa}
                  </p>
                )}
                <div className="mt-3 space-y-3">
                  {data.rendered.clauses.map((clause) => (
                    <div key={clause.id}>
                      <p className="text-body-2 font-bold text-on-surface">{clause.headingFa}</p>
                      {/* Review the SAME block model the PDF and preview print:
                          a table stays a table here, never a run-on paragraph. */}
                      {(clause.blocks && clause.blocks.length > 0
                        ? clause.blocks
                        : clause.paragraphs.map((p) => ({ kind: "paragraph" as const, textFa: p }))
                      ).map((block, i) =>
                        block.kind === "table" ? (
                          <div key={i} className="mt-2 overflow-x-auto">
                            {block.table.captionFa && (
                              <p className="mb-1 text-caption text-muted">{block.table.captionFa}</p>
                            )}
                            <table className="w-full border-collapse text-caption">
                              <thead>
                                <tr>
                                  {block.table.columnsFa.map((col, ci) => (
                                    <th
                                      key={ci}
                                      className="border border-divider bg-surface-container-low px-2 py-1 text-start font-medium text-on-surface"
                                    >
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {block.table.rowsFa.map((row, ri) => (
                                  <tr key={ri}>
                                    {row.map((cell, ci) => (
                                      <td
                                        key={ci}
                                        className="border border-divider px-2 py-1 text-on-surface-variant"
                                      >
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p
                            key={i}
                            className="mt-1 whitespace-pre-line text-caption leading-6 text-on-surface-variant"
                          >
                            {block.textFa}
                          </p>
                        )
                      )}
                    </div>
                  ))}
                </div>
                {data.rendered.footerFa && (
                  <p className="mt-3 border-t border-divider pt-2 text-caption text-muted">
                    {data.rendered.footerFa}
                  </p>
                )}
              </article>
            </Section>

            {/* --- Legal basis (§2) — the cited provisions, non-binding --- */}
            {data.legalBasis.sections.length > 0 && (
              <Section title="مبنای حقوقی و گزارش بررسی">
                <p className="rounded-medium bg-surface-container-low p-2.5 text-caption leading-6 text-muted">
                  {data.legalBasis.disclaimerFa}
                </p>
                <ul className="mt-3 space-y-2.5">
                  {data.legalBasis.sections.map((section) => (
                    <li key={section.clauseId}>
                      <p className="text-labelMedium text-on-surface-variant">
                        {section.clauseHeadingFa}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {section.citations.map((c, i) => (
                          <li key={i} className="text-caption leading-6 text-on-surface-variant">
                            <span className="font-medium text-on-surface">{c.articleFa}</span>
                            {` (${c.lawTitleFa}) — ${c.noteFa}`}
                            {c.status === "pending" && (
                              <span className="ms-1 rounded-small bg-surface-container px-1.5 py-0.5 text-labelSmall text-muted">
                                در انتظار بازبینی
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                {data.legalBasis.uncitedClauseCount > 0 && (
                  <p className="mt-2 text-caption text-muted">
                    {toPersianNumber(data.legalBasis.uncitedClauseCount)} بند دیگر بر پایهٔ توافق
                    طرفین تنظیم شده و استناد قانونی جداگانه‌ای ندارد.
                  </p>
                )}
              </Section>
            )}

            {/* --- §7 per-type legal review: source, version, review state --- */}
            <Section title="وضعیت بازبینی حقوقی این نوع قرارداد">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="success" dot>
                  بازبینی‌شده: {toPersianNumber(data.legalReview.reviewedClauseCount)}
                </Badge>
                <Badge tone="warning" dot>
                  در انتظار: {toPersianNumber(data.legalReview.pendingClauseCount)}
                </Badge>
                <Badge tone="danger" dot>
                  نیازمند اصلاح: {toPersianNumber(data.legalReview.needsRevisionCount)}
                </Badge>
                <Badge tone="neutral" dot>
                  بدون منبع: {toPersianNumber(data.legalReview.unflaggedCount)}
                </Badge>
              </div>
              <ul className="space-y-1.5">
                {data.legalReview.clauses.map((clause) => {
                  const stored = clause.records.length > 0;
                  const rows = stored
                    ? clause.records.map((r) => ({
                        key: r.id,
                        articleFa: r.articleFa,
                        sourceNameFa: r.sourceNameFa,
                        status: r.status,
                        contentVersion: r.contentVersion as number | null,
                      }))
                    : clause.seeded.map((s, i) => ({
                        key: `${clause.clauseId}-${i}`,
                        articleFa: s.articleFa,
                        sourceNameFa: s.sourceNameFa,
                        status: s.status,
                        contentVersion: null as number | null,
                      }));
                  if (rows.length === 0) {
                    return (
                      <li
                        key={clause.clauseId}
                        className="rounded-medium bg-warning-soft px-2 py-1.5 text-caption leading-6 text-on-surface-variant"
                      >
                        <span className="font-medium">{clause.clauseHeadingFa}</span> — بدون منبع
                        بازبینی‌شده؛ به‌عنوان بند قطعی ارائه نمی‌شود.
                      </li>
                    );
                  }
                  return (
                    <li key={clause.clauseId} className="text-caption leading-6">
                      <span className="font-medium text-on-surface">{clause.clauseHeadingFa}</span>
                      <ul className="mt-0.5 space-y-0.5 ps-3">
                        {rows.map((r) => (
                          <li key={r.key} className="text-on-surface-variant">
                            {r.articleFa} ({r.sourceNameFa})
                            <span className="ms-1 rounded-small bg-surface-container px-1.5 py-0.5 text-labelSmall text-muted">
                              {CITATION_STATUS_FA[r.status]}
                              {r.contentVersion !== null
                                ? ` · نسخهٔ ${toPersianNumber(r.contentVersion)}`
                                : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
              {data.legalReview.tips.length > 0 && (
                <p className="mt-2 text-caption text-muted">
                  {toPersianNumber(data.legalReview.tips.length)} نکتهٔ «قبل از امضا» برای این نوع
                  فعال است؛ بخشی از متن تعهدآور قرارداد نیست.
                </p>
              )}
            </Section>

            {/* --- Parties --- */}
            {data.parties.length > 0 && (
              <Section title="طرفین">
                <ul className="space-y-1.5 text-caption">
                  {data.parties.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      {/* The role is a Persian label from the registry — the
                          raw `landlord`/`tenant` token is never shown. */}
                      <span className="text-on-surface-variant">{p.roleFa}</span>
                      <span className="text-on-surface">
                        {p.nameFa}
                        {p.isInitiator && <span className="ms-2 text-muted">(آغازگر)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* --- §5 the destination check BEFORE anything is sent --- */}
            <Section title="شمارهٔ تماس مقصد (پیش از ارسال لینک)">
              <p className="mb-2 text-caption leading-6 text-muted">
                پیش از ارسال لینک امضا ببینید لینک به چه شماره‌ای می‌رود. اصلاح شماره، شمارهٔ
                قبلی و جدید، دلیل، ادمین و زمان را ثبت می‌کند؛ لینک فقط پس از تأیید صریح شما
                ارسال می‌شود و نتیجهٔ واقعی ارسال (موفق/ناموفق) ثبت می‌گردد.
              </p>

              {contactTargets.length === 0 ? (
                <p className="text-caption text-muted">
                  هیچ طرفی با شمارهٔ تماس ثبت نشده است.
                </p>
              ) : (
                <ul className="space-y-1.5 text-caption">
                  {contactTargets.map((t) => (
                    <li
                      key={t.key}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-medium border border-divider p-2.5"
                    >
                      <span className="text-on-surface">
                        {t.roleFa}
                        {t.nameFa && <span className="ms-1 text-muted">— {t.nameFa}</span>}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        {t.mobile ? (
                          <MobileNumber className="text-labelSmall text-on-surface-variant">
                            {t.mobile}
                          </MobileNumber>
                        ) : (
                          <span className="text-labelSmall text-danger">بدون شماره</span>
                        )}
                        {canReview && !t.locked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setContactTargetId(t.key);
                              setContactMobile(t.mobile);
                              setContactReason("");
                              setContactConfirmed(false);
                              setContactError(null);
                            }}
                          >
                            اصلاح شماره
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {canReview && contactTargetId && (() => {
                const target = contactTargets.find((t) => t.key === contactTargetId);
                if (!target) return null;
                return (
                  <div className="mt-2 space-y-2.5 rounded-medium bg-surface-container p-2.5">
                    <p className="text-labelMedium text-on-surface">
                      اصلاح شمارهٔ {target.roleFa}
                      {target.nameFa ? ` — ${target.nameFa}` : ""}
                    </p>
                    <Field
                      label="شمارهٔ جدید"
                      required
                      hint="شمارهٔ موبایل ایران؛ با ۰۹ شروع شود."
                      error={contactError ?? undefined}
                    >
                      <TextInput
                        value={contactMobile}
                        onChange={(e) => {
                          setContactMobile(e.target.value);
                          setContactError(null);
                        }}
                        placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                        dir="ltr"
                        inputMode="tel"
                      />
                    </Field>
                    <Field label="دلیل اصلاح" required>
                      <TextArea
                        rows={2}
                        value={contactReason}
                        onChange={(e) => setContactReason(e.target.value)}
                        placeholder="مثلاً: شمارهٔ ثبت‌شده متعلق به شخص دیگری بود؛ شمارهٔ صحیح با تماس تأیید شد."
                      />
                    </Field>
                    <label className="flex items-start gap-2 text-caption text-on-surface-variant">
                      <input
                        type="checkbox"
                        checked={contactConfirmed}
                        onChange={(e) => setContactConfirmed(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        این شماره را بررسی کردم و می‌خواهم لینک امضا به شمارهٔ جدید ارسال شود؛
                        مسئولیت ارسال به همین شماره را می‌پذیرم.
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={contact.isPending}
                        disabled={contact.isPending}
                        onClick={() => void submitContactCorrection(false)}
                      >
                        فقط ذخیرهٔ اصلاح (بدون ارسال)
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        loading={contact.isPending}
                        disabled={contact.isPending || !contactConfirmed}
                        onClick={() => void submitContactCorrection(true)}
                      >
                        ذخیره و ارسال لینک به شمارهٔ جدید
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={contact.isPending}
                        onClick={() => {
                          setContactTargetId(null);
                          setContactMobile("");
                          setContactReason("");
                          setContactConfirmed(false);
                          setContactError(null);
                        }}
                      >
                        انصراف
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {data.contactChanges.length > 0 && (
                <div className="mt-3 border-t border-divider pt-2">
                  <p className="mb-1.5 text-labelSmall text-muted">
                    تاریخچهٔ تغییر شمارهٔ مقصد ({toPersianNumber(data.contactChanges.length)})
                  </p>
                  <ul className="space-y-1.5 text-labelSmall">
                    {data.contactChanges.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-medium border border-divider p-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-on-surface">
                            {c.roleFa}
                            {c.nameFa ? ` — ${c.nameFa}` : ""}
                          </span>
                          <span className="text-muted">{toPersianDate(c.changedAt)}</span>
                        </div>
                        <p className="mt-0.5 text-on-surface-variant" dir="ltr">
                          {c.previousMobile || "—"} → {c.newMobile}
                        </p>
                        <p className="mt-0.5 text-muted">
                          دلیل: {c.reasonFa} · ثبت توسط {c.adminLabelFa}
                        </p>
                        <p className="mt-0.5 text-muted">
                          {c.deliveryStatus === "SENT"
                            ? `ارسال موفق (${
                                c.deliveryChannel === "sms" ? "پیامک" : "خروجی توسعه"
                              })${c.deliveredAt ? ` — ${toPersianDate(c.deliveredAt)}` : ""}`
                            : c.deliveryStatus === "FAILED"
                              ? `ارسال ناموفق${c.deliveryDetail ? ` — ${c.deliveryDetail}` : ""}`
                              : "لینکی ارسال نشد"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>

            {/* --- §2.2 the supplementary note, exactly as it will print --- */}
            <Section title="یادداشت تکمیلی">
              {data.supplementary?.notes?.trim() ? (
                <div className="space-y-2">
                  <p className="whitespace-pre-line rounded-medium border border-divider bg-surface-container p-2.5 text-caption leading-6 text-on-surface-variant">
                    {data.supplementary.notes}
                  </p>
                  <p className="text-labelSmall text-muted">
                    {data.supplementary.noteConfirmedAt
                      ? `تأیید یادداشت: ${toPersianDate(data.supplementary.noteConfirmedAt)}`
                      : "این یادداشت هنوز توسط مالک تأیید نشده است."}
                    {" · در پایان سند و جدا از مواد قرارداد چاپ می‌شود."}
                  </p>
                </div>
              ) : (
                <p className="text-caption text-muted">
                  یادداشت تکمیلی ثبت نشده است؛ در این حالت هیچ بخشی در پایان سند چاپ نمی‌شود.
                </p>
              )}
            </Section>

            {/* --- §2.5 contract annexes — files the owner made part of the
                agreement. Listed separately from the note, with the exact
                SHA-256 that the printed annex carries. --- */}
            <Section title="پیوست‌های قرارداد">
              {data.supplementary.attachments.length === 0 ? (
                <p className="text-caption text-muted">پیوستی ثبت نشده است.</p>
              ) : (
                <div className="space-y-2">
                  <ul className="space-y-1.5 text-caption">
                    {data.supplementary.attachments.map((a) => (
                      <li
                        key={a.documentId}
                        className="rounded-medium border border-divider p-2.5"
                      >
                        <p className="text-labelMedium text-on-surface">{a.titleFa}</p>
                        <p className="mt-0.5 text-labelSmall text-muted">
                          {a.fileName} · {toPersianDate(a.addedAt)}
                        </p>
                        <p
                          className="mt-1 break-all font-mono text-labelSmall text-muted"
                          dir="ltr"
                        >
                          SHA-256: {a.hash}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="text-labelSmall text-muted">
                    {data.supplementary.attachmentsConfirmedAt
                      ? `تأیید پیوست‌ها: ${toPersianDate(
                          data.supplementary.attachmentsConfirmedAt
                        )} · پیوست‌ها به‌عنوان یک مادهٔ مستقل در سند چاپ می‌شوند.`
                      : "این پیوست‌ها هنوز توسط مالک تأیید نشده‌اند."}
                  </p>
                </div>
              )}
            </Section>

            {/* --- §2.1 the owner's own clauses and requested changes --- */}
            <Section title="تغییرات و بندهای افزوده">
              {data.customClauses.length === 0 ? (
                <p className="text-caption text-muted">بند افزوده یا درخواست تغییری ثبت نشده است.</p>
              ) : (
                <ul className="space-y-2">
                  {data.customClauses.map((c) => (
                    <li key={c.id} className="rounded-medium border border-divider p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-labelMedium text-on-surface">{c.title}</span>
                        <Badge tone={c.kind === "change_request" ? "warning" : "info"}>
                          {c.kind === "change_request" ? "درخواست تغییر" : "بند توافقی"}
                        </Badge>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-caption leading-6 text-on-surface-variant">
                        {c.body}
                      </p>
                      <p className="mt-1 text-labelSmall text-muted">
                        {c.sectionTitleFa ? `بخش مرتبط: ${c.sectionTitleFa} · ` : ""}
                        {toPersianDate(c.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* --- §2.4 party approvals, with their exact times --- */}
            <Section title="تأییدهای طرفین">
              {data.approvals.length === 0 ? (
                <p className="text-caption text-muted">هنوز تأییدی از سوی طرفین ثبت نشده است.</p>
              ) : (
                <ul className="space-y-1.5 text-caption">
                  {data.approvals.map((a) => {
                    const version = data.versions.find((v) => v.id === a.contractVersionId);
                    return (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-divider pb-1.5 last:border-0"
                      >
                        <span className="text-on-surface">
                          {a.partyRoleFa || "طرف"}
                          {a.partyNameFa && (
                            <span className="ms-1 text-muted">— {a.partyNameFa}</span>
                          )}
                        </span>
                        <span className="text-labelSmall text-muted">
                          {APPROVAL_STATUS_FA[a.status]}
                          {version ? ` · نسخه ${toPersianNumber(version.versionNumber)}` : ""}
                          {" · "}
                          {a.approvedAt ? toPersianDate(a.approvedAt) : toPersianDate(a.createdAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            {/* --- §2.3/§2.4 the signature request and each party's own status --- */}
            <div id="admin-signatures" tabIndex={-1}>
            <Section title="درخواست امضا و وضعیت هر طرف">
              {!data.signatureRequest ? (
                <p className="text-caption text-muted">
                  {data.signatureRequests.length > 0
                    ? "درخواست امضای فعلی‌ای وجود ندارد؛ درخواست‌های پیشین در پایان همین بخش آمده‌اند."
                    : "برای این قرارداد هنوز درخواست امضایی صادر نشده است."}
                </p>
              ) : (
                <div className="space-y-2.5 text-caption">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={SIGNATURE_REQUEST_TONES[data.signatureRequest.status] ?? "neutral"} dot>
                      {data.signatureRequest.statusFa}
                    </Badge>
                    {(() => {
                      const v = data.versions.find(
                        (x) => x.id === data.signatureRequest!.contractVersionId
                      );
                      return v ? (
                        <Badge tone="brand">نسخه {toPersianNumber(v.versionNumber)}</Badge>
                      ) : null;
                    })()}
                    <span className="text-labelSmall text-muted">
                      {SIGNATURE_ASSURANCE_LABELS_FA[data.signatureRequest.assuranceLevel]}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <Info label="ایجاد درخواست" value={toPersianDate(data.signatureRequest.createdAt)} />
                    <Info
                      label="تکمیل"
                      value={
                        data.signatureRequest.completedAt
                          ? toPersianDate(data.signatureRequest.completedAt)
                          : "تکمیل نشده"
                      }
                    />
                  </dl>
                  <ul className="space-y-1.5">
                    {data.signatureRequest.participants.map((p) => {
                      const inv = data.signatureRequest!.invitations.find(
                        (i) => i.participantId === p.id
                      );
                      return (
                        <li
                          key={p.id}
                          className="rounded-medium border border-divider p-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-on-surface">
                              {p.roleFa}
                              {p.nameFa && <span className="ms-1 text-muted">— {p.nameFa}</span>}
                            </span>
                            <Badge
                              tone={
                                p.status === "SIGNED"
                                  ? "success"
                                  : p.status === "DECLINED"
                                    ? "danger"
                                    : p.status === "VIEWED"
                                      ? "info"
                                      : "neutral"
                              }
                            >
                              {p.statusFa}
                            </Badge>
                          </div>
                          <p className="mt-1 text-labelSmall text-muted" dir="ltr">
                            {p.mobileMasked}
                          </p>
                          <p className="mt-0.5 text-labelSmall text-muted">
                            {p.viewedAt ? `مشاهده: ${toPersianDate(p.viewedAt)}` : "مشاهده نشده"}
                            {p.signedAt && ` · امضا: ${toPersianDate(p.signedAt)}`}
                            {p.signedMethod && ` · ${SIGNATURE_SIGN_METHOD_FA[p.signedMethod]}`}
                            {p.declinedAt && ` · رد: ${toPersianDate(p.declinedAt)}`}
                          </p>
                          {p.declineReason && (
                            <p className="mt-0.5 text-labelSmall text-danger">{p.declineReason}</p>
                          )}
                          {inv && (
                            <p className="mt-0.5 text-labelSmall text-muted">
                              {inv.deliveryStatus === "FAILED"
                                ? "ارسال دعوت ناموفق بود — نیازمند ارسال مجدد"
                                : inv.deliveryStatus === "SENT"
                                  ? `دعوت ارسال شد (${
                                      inv.deliveryChannel === "sms" ? "پیامک" : "خروجی توسعه"
                                    })`
                                  : "دعوت صادر شده اما ارسالی ثبت نشده است"}
                              {inv.lastSentAt ? ` — ${toPersianDate(inv.lastSentAt)}` : ""}
                              {" · "}
                              {INVITATION_STATUS_FA[inv.status]}
                            </p>
                          )}

                          {/* §5 — resend to THIS party alone. Never available
                              once the party has signed: there is nothing to
                              resend, and the link would be meaningless. */}
                          {canReview && p.status !== "SIGNED" && p.status !== "DECLINED" && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={resendingParticipantId === p.id}
                                disabled={
                                  resendingParticipantId !== null &&
                                  resendingParticipantId !== p.id
                                }
                                onClick={() => void resendToParticipant(p.id, p.roleFa)}
                              >
                                ارسال مجدد لینک به {p.roleFa}
                              </Button>
                              {handoverLinks[p.id] && (
                                <span className="text-labelSmall text-warning-700 dark:text-warning-300">
                                  ارسال نشد — لینک دستی تا {toPersianDate(handoverLinks[p.id]!.expiresAt)}
                                </span>
                              )}
                            </div>
                          )}
                          {handoverLinks[p.id] && (
                            <div className="mt-1 rounded-medium bg-surface-container p-2">
                              <p className="mb-1 text-labelSmall text-muted">
                                لینک اختصاصی {p.roleFa} — فقط همین یک‌بار نمایش داده می‌شود و پس از
                                بستن پنجره قابل بازیابی نیست:
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <code className="break-all font-mono text-labelSmall" dir="ltr">
                                  /contracts/sign/{handoverLinks[p.id]!.token}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  startIcon={<IconCopy size={13} />}
                                  onClick={() =>
                                    void copyHandoverLink(handoverLinks[p.id]!.token)
                                  }
                                >
                                  کپی لینک
                                </Button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {data.signatureRequests.length > 1 && (
                <div className="mt-3 border-t border-divider pt-2">
                  <p className="mb-1.5 text-labelSmall text-muted">
                    همهٔ درخواست‌های امضای این قرارداد:
                  </p>
                  <ul className="space-y-1 text-labelSmall text-muted">
                    {data.signatureRequests.map((r) => {
                      const v = data.versions.find((x) => x.id === r.contractVersionId);
                      return (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {v ? `نسخه ${toPersianNumber(v.versionNumber)}` : "نسخهٔ نامشخص"}
                            {" — "}
                            {r.statusFa}
                          </span>
                          <span>{toPersianDate(r.createdAt)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Section>
            </div>

            {/* --- §3/§5 admin attestations — evidence ABOUT a signature --- */}
            <Section title="تأییدیهٔ بررسی امضا (ادمین)">
              <p className="mb-2 text-caption leading-6 text-muted">
                این بخش فقط برای ثبت <b>بررسی</b> امضایی است که خودِ طرف داده است. منشأ تأیید و
                یادداشت الزامی‌اند. ثبت این تأییدیه وضعیت طرف یا وضعیت قرارداد را تغییر نمی‌دهد و
                هرگز جایگزین امضای طرفین نیست.
              </p>

              {data.attestations.length > 0 && (
                <ul className="mb-3 space-y-1.5 text-caption">
                  {data.attestations.map((a) => {
                    const participant = data.signatureRequest?.participants.find(
                      (p) => p.id === a.participantId
                    );
                    const version = data.versions.find((v) => v.id === a.contractVersionId);
                    return (
                      <li
                        key={a.id}
                        className="rounded-medium border border-divider p-2.5 text-labelSmall"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-on-surface">
                            {SIGNATURE_ATTESTATION_CHANNEL_FA[a.channel]}
                          </span>
                          <span className="text-muted">{toPersianDate(a.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-muted">
                          طرف: {participant?.roleFa ?? "—"}
                          {participant?.nameFa ? ` (${participant.nameFa})` : ""}
                          {version ? ` · نسخه ${toPersianNumber(version.versionNumber)}` : ""}
                          {" · "}ثبت توسط {a.adminLabelFa}
                        </p>
                        <p className="mt-1 text-on-surface-variant">{a.noteFa}</p>
                      </li>
                    );
                  })}
                </ul>
              )}

              {canReview && data.signatureRequest ? (
                (() => {
                  const signed = data.signatureRequest.participants.filter(
                    (p) => p.status === "SIGNED"
                  );
                  if (signed.length === 0) {
                    return (
                      <p className="text-caption text-muted">
                        تا زمانی که هیچ طرفی امضا نکند، چیزی برای تأییدِ بررسی وجود ندارد.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-2.5">
                      <Field label="طرف قرارداد" required>
                        <Select
                          value={attestationParticipantId}
                          onChange={(e) => setAttestationParticipantId(e.target.value)}
                        >
                          <option value="">— انتخاب طرف امضاشده —</option>
                          {signed.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.roleFa}
                              {p.nameFa ? ` — ${p.nameFa}` : ""}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="منشأ تأیید" required>
                        <Select
                          value={attestationChannel}
                          onChange={(e) =>
                            setAttestationChannel(e.target.value as SignatureAttestationChannel)
                          }
                        >
                          {(
                            Object.keys(
                              SIGNATURE_ATTESTATION_CHANNEL_FA
                            ) as SignatureAttestationChannel[]
                          ).map((c) => (
                            <option key={c} value={c}>
                              {SIGNATURE_ATTESTATION_CHANNEL_FA[c]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field
                        label="یادداشت بررسی"
                        required
                        hint="دقیقاً بنویسید چه چیزی را دیدید یا بررسی کردید."
                      >
                        <TextArea
                          rows={3}
                          value={attestationNote}
                          onChange={(e) => setAttestationNote(e.target.value)}
                          placeholder="مثلاً: کد پیامکی در تماس تلفنی برای این شماره خوانده شد…"
                        />
                      </Field>
                      <Button
                        variant="primary"
                        size="sm"
                        loading={attestation.isPending}
                        disabled={
                          !attestationParticipantId ||
                          attestationNote.trim().length < 5 ||
                          attestation.isPending
                        }
                        onClick={() => void submitAttestation()}
                      >
                        ثبت تأییدیهٔ بررسی
                      </Button>
                    </div>
                  );
                })()
              ) : null}
            </Section>

            {/* --- The owner's review thread, including internal notes --- */}
            {data.comments.length > 0 && (
              <Section title="نظرها و درخواست‌های اصلاح">
                <p className="text-caption text-muted">
                  هر نظر به نسخه‌ای که برای آن نوشته شده گره خورده است. نظرهای «داخلی» به طرفین
                  نمی‌رسند و فقط در این پنل دیده می‌شوند.
                </p>
                <ul className="mt-2 space-y-2">
                  {data.comments.map((comment) => {
                    const version = data.versions.find(
                      (v) => v.id === comment.contractVersionId
                    );
                    const isCurrent = comment.contractVersionId === data.currentVersion?.id;
                    const shared = (comment.visibility ?? "internal") === "parties";
                    return (
                      <li
                        key={comment.id}
                        className={`rounded-medium border border-divider p-2.5 ${
                          comment.parentId ? "ms-4 border-s-2" : ""
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-labelMedium text-on-surface">
                            {comment.authorLabelFa}
                          </span>
                          <span className="text-labelSmall text-muted">
                            {version
                              ? `نسخه ${toPersianNumber(version.versionNumber)}${
                                  isCurrent ? " (جاری)" : ""
                                }`
                              : isCurrent
                                ? "نسخهٔ جاری"
                                : "نسخهٔ پیشین"}
                            {" · "}
                            {toPersianDate(comment.createdAt)}
                          </span>
                        </div>
                        {comment.clauseRef && (
                          <p className="mt-1 text-labelSmall text-primary">
                            بند مرتبط:{" "}
                            {data.rendered.clauses.find((c) => c.id === comment.clauseRef)
                              ?.headingFa ?? comment.clauseRef}
                          </p>
                        )}
                        <p className="mt-1 whitespace-pre-line text-caption leading-6 text-on-surface-variant">
                          {comment.body}
                        </p>
                        <p className="mt-1 text-labelSmall text-muted">
                          {shared ? "مشترک با طرفین" : "داخلی"}
                          {comment.kind === "change_request" ? " · درخواست اصلاح" : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}

            {/* --- Decision --- */}
            <div id="admin-review-decision" tabIndex={-1}>
            <Section
              title="تصمیم بررسی"
              icon={<IconShield size={16} className="text-primary" />}
            >
              {!canDecide ? (
                <p className="text-caption text-muted">
                  {!canReview
                    ? "برای ثبت تصمیم، مجوز بررسی لازم است."
                    : data.adminReview
                      ? `آخرین تصمیم: «${CONTRACT_ADMIN_REVIEW_STATUS_FA[data.adminReview.status]}». برای بررسی دوباره، قرارداد باید از نو به صف ارسال شود.`
                      : "بررسی‌ای در انتظار تصمیم نیست."}
                </p>
              ) : activeAction ? (
                <div className="space-y-3">
                  <Field
                    label={`دلیل «${ACTION_FA[activeAction]}»`}
                    hint="این متن در تاریخچهٔ بررسی و لاگ حسابرسی ثبت می‌شود."
                    required
                  >
                    <TextArea
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="دلیل یا توضیح لازم را بنویسید…"
                    />
                  </Field>
                  <div className="flex justify-start gap-2">
                    <Button
                      variant={CONFIRM_ACTIONS.includes(activeAction) ? "danger" : "primary"}
                      size="sm"
                      loading={review.isPending}
                      onClick={confirmReasonAction}
                    >
                      ثبت «{ACTION_FA[activeAction]}»
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={review.isPending}
                      onClick={() => setActiveAction(null)}
                    >
                      انصراف
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    startIcon={<IconCheckCircle size={15} />}
                    disabled={review.isPending}
                    onClick={() => beginAction("approve")}
                  >
                    تأیید برای صدور نهایی
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={review.isPending}
                    onClick={() => beginAction("request_info")}
                  >
                    درخواست اصلاح
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    startIcon={<IconClose size={15} />}
                    disabled={review.isPending}
                    onClick={() => beginAction("reject")}
                  >
                    رد
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={review.isPending}
                    onClick={() => beginAction("cancel")}
                  >
                    لغو بررسی
                  </Button>
                </div>
              )}
            </Section>
            </div>

            {/* --- §6 the printable message — red text on the LAST page --- */}
            <Section
              title="پیام چاپی ادمین"
              icon={<IconDocument size={16} className="text-primary" />}
            >
              <p className="mb-2 text-caption leading-6 text-muted">
                این متن با رنگ قرمز در پایین آخرین صفحهٔ PDF چاپ می‌شود و حداکثر{" "}
                {toPersianNumber(messageMax)} کاراکتر است. اگر خالی بماند، هیچ کارت قرمزی و هیچ
                فضای خالی چاپ نمی‌شود. پس از هر تغییر، نسخهٔ نهایی ذخیره‌شده دوباره تولید می‌شود
                تا همهٔ نمایش‌ها و PDF یکسان بمانند.
              </p>

              {!canReview ? (
                data.adminMessage ? (
                  <div className="space-y-1 text-caption">
                    <p className="rounded-medium border border-danger/40 bg-danger-soft p-2 text-danger-800">
                      {data.adminMessage.messageFa}
                    </p>
                    <p className="text-labelSmall text-muted">
                      ثبت توسط {data.adminMessage.adminLabelFa} ·{" "}
                      {toPersianDate(data.adminMessage.updatedAt)}
                    </p>
                  </div>
                ) : (
                  <p className="text-caption text-muted">پیامی ثبت نشده است.</p>
                )
              ) : (
                <div className="space-y-2">
                  <Field
                    label="متن پیام"
                    hint="متن کوتاه و روشن؛ شمارش کاراکترها همان شمارشی است که سرور اعمال می‌کند."
                    error={messageError ?? undefined}
                  >
                    <TextArea
                      rows={3}
                      value={messageText}
                      onChange={(e) => {
                        setMessageDraft(e.target.value);
                        setMessageError(null);
                      }}
                      placeholder="مثلاً: این قرارداد بدون بررسی حقوقی لیگالیر ثبت شده است."
                    />
                  </Field>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`text-labelSmall ${
                        messageRemaining < 0 ? "font-medium text-danger" : "text-muted"
                      }`}
                      aria-live="polite"
                    >
                      {messageRemaining < 0
                        ? `${toPersianNumber(Math.abs(messageRemaining))} کاراکتر بیش از حد مجاز`
                        : `${toPersianNumber(messageRemaining)} کاراکتر باقی مانده`}
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={message.isPending}
                      disabled={
                        message.isPending ||
                        messageRemaining < 0 ||
                        messageText.trim() === (data.adminMessage?.messageFa ?? "")
                      }
                      onClick={() => void saveMessage()}
                    >
                      {messageText.trim() ? "ذخیرهٔ پیام چاپی" : "پاک‌کردن پیام چاپی"}
                    </Button>
                  </div>
                  {data.adminMessage && (
                    <p className="text-labelSmall text-muted">
                      آخرین ثبت: {data.adminMessage.adminLabelFa} ·{" "}
                      {toPersianDate(data.adminMessage.updatedAt)}
                    </p>
                  )}
                </div>
              )}
            </Section>

            {/* --- §T4 advance to party signing WITHOUT a LEGALIR review --- */}
            {data.canAdvanceToSigning && (
              <div id="admin-advance-signing" tabIndex={-1}>
              <Section
                title="پیشبرد به مرحلهٔ امضا (بدون بررسی لیگالیر)"
                icon={<IconShield size={16} className="text-primary" />}
              >
                {!canReview ? (
                  <p className="text-caption text-muted">
                    برای پیشبرد قرارداد به مرحلهٔ امضا، مجوز بررسی لازم است.
                  </p>
                ) : !advanceOpen ? (
                  <div className="space-y-2">
                    <p className="text-caption leading-6 text-muted">
                      این مسیر قرارداد را بیرون از صف بررسی و مستقیم به امضای طرفین می‌برد.
                      نتیجه همیشه با وضعیت «بررسی‌نشده توسط لیگالیر» ثبت می‌شود و هرگز
                      تأییدشده یا بررسی‌شده نمایش داده نمی‌شود. دلیل شما اجباری و در
                      تاریخچه و لاگ حسابرسی ثبت است.
                    </p>
                    <Button variant="secondary" size="sm" onClick={() => setAdvanceOpen(true)}>
                      ثبت نهایی بدون بررسی لیگالیر
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <InfoBanner tone="warning">
                      با ادامه، این قرارداد <b>توسط لیگالیر بررسی نشده</b> و به‌عنوان
                      «ثبت‌نهایی‌بدون‌بررسی» به مرحلهٔ امضای طرفین می‌رود. این عمل جای بررسی
                      حقوقی را نمی‌گیرد.
                    </InfoBanner>
                    <Field
                      label="دلیل پیشبرد"
                      required
                      hint="این دلیل در تاریخچه و لاگ حسابرسی ثبت می‌شود."
                      error={
                        advanceOpen && advance.isError
                          ? errMessage(advance.error, "پیشبرد ناموفق بود")
                          : undefined
                      }
                    >
                      <TextArea
                        rows={3}
                        value={advanceReason}
                        onChange={(e) => setAdvanceReason(e.target.value)}
                        placeholder="مثلاً: طرفین فوریت دارند و درخواست کرده‌اند بدون بررسی لیگالیر امضا شود."
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        loading={advance.isPending}
                        disabled={advance.isPending || advanceReason.trim().length < 3}
                        onClick={() => void submitAdvance()}
                      >
                        ثبت نهایی و رفتن به امضا
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={advance.isPending}
                        onClick={() => {
                          setAdvanceOpen(false);
                          setAdvanceReason("");
                        }}
                      >
                        انصراف
                      </Button>
                    </div>
                  </div>
                )}
              </Section>
              </div>
            )}

            {/* --- The OFFICIAL stamp (§5) — Super-Admin only --- */}
            {canReadStamp && (
              <div id="admin-stamp" tabIndex={-1}>
                <Section
                  title="مهر و هولوگرام رسمی"
                  icon={<IconShield size={16} className="text-primary" />}
                >
                  <p className="mb-3 text-caption leading-6 text-muted">
                    این مهر قوی‌تر از بررسی داخلی است و فقط پس از امضای همهٔ طرفین و با تصمیم
                    مدیر ارشد روی همین نسخه درج می‌شود. تأیید ادمین جایگزین امضای طرفین نیست.
                  </p>
                  <ContractStampPanel contractId={contractId} />
                </Section>
              </div>
            )}

            {/* --- Review history --- */}
            {events.length > 0 && (
              <Section title="تاریخچهٔ بررسی">
                <ol className="space-y-2.5">
                  {events.map((e) => (
                    <li key={e.id} className="flex gap-2.5 text-caption">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <p className="text-on-surface">
                          <span className="font-medium">{ACTION_FA[e.action]}</span>
                          {" — "}
                          <span className="text-muted">{e.actorLabel}</span>
                        </p>
                        <p className="text-muted">{toPersianDate(e.createdAt)}</p>
                        {e.reasonFa && (
                          <p className="mt-0.5 text-on-surface-variant">{e.reasonFa}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => pendingConfirm && submit(pendingConfirm, reason)}
        title={pendingConfirm ? ACTION_FA[pendingConfirm] : "تأیید بررسی"}
        description={
          pendingConfirm
            ? `آیا از «${ACTION_FA[pendingConfirm]}» مطمئن هستید؟ این عمل در لاگ حسابرسی ثبت می‌شود.`
            : undefined
        }
        confirmLabel="ثبت تصمیم"
        destructive={pendingConfirm !== null && CONFIRM_ACTIONS.includes(pendingConfirm)}
        loading={review.isPending}
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

/**
 * The stored FINAL artifact. Unlike the review text above it, this is the
 * actual printable file the owner downloads: the A4 PDF with the official
 * seal and the hologram printed at the bottom of EVERY page.
 *
 * It is embedded inline so the operator can page through the real artifact
 * without leaving the drawer; the download button is the same bytes.
 */
function FinalDocumentBlock({ doc }: { doc: NonNullable<AdminContractDetail["finalDocument"]> }) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {doc.sealed ? (
          <Badge tone="success" dot>
            مهر رسمی + هولوگرام روی همهٔ صفحات
          </Badge>
        ) : (
          <Badge tone="warning" dot>
            بدون مهر معتبر
          </Badge>
        )}
        <Badge tone="neutral">نسخهٔ نهایی</Badge>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-caption">
        <Info label="نام فایل" value={doc.fileName} mono />
        <Info
          label="حجم"
          value={`${toPersianNumber(Math.max(1, Math.round(doc.sizeBytes / 1024)))} کیلوبایت`}
        />
        <Info label="تولید" value={toPersianDate(doc.uploadedAt)} />
        <Info label="مهر اعمال‌شده" value={doc.sealedAt ? toPersianDate(doc.sealedAt) : "—"} />
        <Info label="نسخهٔ مهر" value={doc.sealAssetVersion ?? "—"} mono />
      </dl>

      <div>
        <dt className="mb-1 text-caption text-muted">اثر انگشت فایل نهایی (SHA-256)</dt>
        <dd className="break-all font-mono text-caption text-on-surface" dir="ltr">
          {doc.hash}
        </dd>
      </div>

      {!doc.sealed && (
        <p className="rounded-medium bg-surface-container-low p-2 text-caption leading-6 text-muted">
          نسخهٔ نهایی ذخیره شده است، اما مهر رسمی آن دیگر به محتوای فعلی گره نخورده و به‌عنوان
          مهر معتبر نمایش داده نمی‌شود. برای صدور دوباره، قرارداد باید مجدداً بررسی و مهر شود.
        </p>
      )}

      <iframe
        src={doc.url}
        title={`سند نهایی ${doc.fileName}`}
        className="h-[520px] w-full rounded-medium border border-divider bg-surface-container-low"
      />

      <div className="flex flex-wrap gap-2">
        <a href={doc.url} target="_blank" rel="noreferrer">
          <Button startIcon={<IconDocument size={16} />} variant="secondary">
            باز کردن سند نهایی
          </Button>
        </a>
        <a href={doc.downloadUrl}>
          <Button startIcon={<IconShield size={16} />} variant="primary">
            دانلود نسخهٔ مهرشده
          </Button>
        </a>
      </div>

      <p className="text-caption leading-6 text-muted">{doc.sealed
        ? "چه چیزی در فایل نهایی می‌بینید: مهر رسمی لیگالیر و هولوگرام در پایین هر صفحه، به‌همراه متن سلب‌مسئولیت بررسی؛ واترمارک «پیش‌نویس» روی نسخهٔ نهایی وجود ندارد."
        : "فایل قابل مشاهده، نسخهٔ نهایی ذخیره‌شده است."}</p>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className={`truncate text-on-surface-variant ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </dd>
    </div>
  );
}
