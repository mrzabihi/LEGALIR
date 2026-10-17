// ============================================================
// LEGALIR — Wizard step: the contract lifecycle workspace
// ============================================================
// This is the whole lifecycle AFTER the content exists:
//
//   اطلاعات ✓ → پیش‌نمایش ✓ → بررسی ● → امضا ○ → تکمیل ○
//
// The step is DOMAIN-AGNOSTIC. It never mentions موجر/مستأجر or any
// contract-specific role: every label comes from the registry and
// every permission comes from the server's lifecycle view. The three
// primary choices under Preview are always the same three:
//
//   پرسش از دستیار هوشمند | بررسی توسط وکیل | آماده‌سازی برای امضا
//
// The component only decides what to *offer*; the server decides what
// is *allowed*. A signature is bound to an immutable version, and the
// wording is always «تأیید و امضای الکترونیکی» — never «امضای
// الکترونیکی مطمئن» or «امضای دیجیتال رسمی».
// ============================================================

"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Chip, Dialog, OTPInput, ProgressLinear } from "@legalir/ui";
import {
  IconCheck,
  IconChat,
  IconCopy,
  IconDownload,
  IconFileText,
  IconLawBook,
  IconRefresh,
  IconSend,
  IconShield,
  IconWarning,
} from "@/lib/icons";
import { useWizard } from "../wizard-context";
import { SectionCard, Notice } from "../primitives";
import { LivePreview } from "../live-preview";
import { ContractCommentComposer } from "../contract-comments";
import type { A4SignatureMark } from "../../document/a4-document";
import { LifecycleStepper } from "../lifecycle-stepper";
import { getContractDefinition } from "@/lib/contracts/registry";
import { renderContract } from "@/lib/contracts/template";
import { stateLabelFa } from "@/lib/contracts/state-machine";
import { formatIsoJalali, formatIsoJalaliDateTime } from "@/lib/contracts/dates";
import { useFinalizeContract, useSubmitForReview } from "@/hooks/usePropertyContracts";
import {
  useAcceptLawyerReview,
  useCancelLawyerReview,
  useCompleteLawyerReview,
  useContractLifecycle,
  useCreateAiReview,
  useCreateLawyerReview,
  useCreateSignatureRequest,
  useDecideLawyerFinding,
  useDeclineSignature,
  useIssueInvitations,
  useRecordPhysicalSignature,
  useRequestSignatureOtp,
  useRevokeInvitation,
  useVerifySignatureOtp,
} from "@/hooks/useContractLifecycle";
import { contractPdfUrl, contractDocxUrl } from "@/lib/api/property-contracts";
import {
  CONTRACT_ADMIN_REVIEW_STATUS_FA,
  SIGNATURE_PARTICIPANT_STATUS_FA,
  type LawyerReviewFindingSeverity,
  type SignatureInvitation,
  type SignatureParticipant,
} from "@legalir/types";

/** The version of the consent text the signer agrees to. */
const CONSENT_VERSION = "v1";

const SEVERITY_LABELS_FA: Record<LawyerReviewFindingSeverity, string> = {
  info: "اطلاع",
  low: "کم",
  medium: "متوسط",
  high: "زیاد",
  critical: "بحرانی",
};

type InvitationTone = "ready" | "pending" | "ok" | "warn" | "error";

/**
 * The per-recipient invitation state. Every fact is read from the server
 * (`deliveryStatus` / `deliveryChannel` / `status` on the invitation, plus
 * the participant's own signing state) — the UI never infers that a link
 * was delivered.
 */
function invitationStatus(
  participant: SignatureParticipant,
  invitation: SignatureInvitation | undefined
): { labelFa: string; tone: InvitationTone } {
  if (!invitation) return { labelFa: "آمادهٔ ارسال", tone: "ready" };
  if (participant.status === "SIGNED") return { labelFa: "امضا شد", tone: "ok" };
  if (participant.status === "DECLINED") return { labelFa: "از امضا خودداری کرد", tone: "error" };
  if (invitation.status === "REVOKED") {
    return { labelFa: "لغو شد — نیازمند ارسال مجدد", tone: "warn" };
  }
  if (invitation.status === "EXPIRED") {
    return { labelFa: "مهلت تمام شد — نیازمند ارسال مجدد", tone: "warn" };
  }
  if (invitation.deliveryStatus === "FAILED") {
    return { labelFa: "ارسال ناموفق — نیازمند ارسال مجدد", tone: "error" };
  }
  if (participant.status === "VIEWED") return { labelFa: "مشاهده شد", tone: "ok" };
  if (invitation.deliveryChannel === "dev-console") {
    return {
      labelFa: "در کنسول توسعه ثبت شد (پیامک واقعی ارسال نشده است)",
      tone: "warn",
    };
  }
  return { labelFa: "ارسال شد — در انتظار مشاهده", tone: "pending" };
}

const INVITATION_TONE_CLASS: Record<InvitationTone, string> = {
  ready: "text-muted",
  pending: "text-primary",
  ok: "text-success",
  warn: "text-warning",
  error: "text-error",
};

/** True while the request can still receive links (not terminal). */
function requestAcceptsInvitations(status: string): boolean {
  return status !== "COMPLETED" && status !== "DECLINED" && status !== "EXPIRED" && status !== "CANCELLED";
}


export function ReviewStep() {
  const router = useRouter();
  const { contract, data, parties, payments, completeness } = useWizard();
  const def = getContractDefinition(contract.type);

  const lifecycle = useContractLifecycle(contract.id);
  const view = lifecycle.data;

  const prepare = useCreateSignatureRequest();
  const issueInvitations = useIssueInvitations();
  const revokeInvitation = useRevokeInvitation();
  const requestOtp = useRequestSignatureOtp();
  const verifyOtp = useVerifySignatureOtp();
  const decline = useDeclineSignature();
  const recordPhysical = useRecordPhysicalSignature();
  const createLawyer = useCreateLawyerReview();
  const acceptLawyer = useAcceptLawyerReview();
  const completeLawyer = useCompleteLawyerReview();
  const decideFinding = useDecideLawyerFinding();
  const cancelLawyer = useCancelLawyerReview();
  const createAi = useCreateAiReview();
  const finalize = useFinalizeContract();
  const submit = useSubmitForReview();

  const [actionError, setActionError] = useState<string | null>(null);
  const [signTarget, setSignTarget] = useState<SignatureParticipant | null>(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [mobileMasked, setMobileMasked] = useState<string | null>(null);
  const [otpChannel, setOtpChannel] = useState<"sms" | "dev-console">("dev-console");
  const [consent, setConsent] = useState(false);
  // The participant awaiting a wet-ink scan upload.
  const [physicalTarget, setPhysicalTarget] = useState<SignatureParticipant | null>(null);
  const physicalInputRef = useRef<HTMLInputElement>(null);

  // Invitations. The RAW token is returned by the server exactly once, so
  // it is kept in this state only for as long as the page lives: it is the
  // manual fallback when SMS delivery failed. Nothing about the token is
  // persisted client-side.
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [issuedTokens, setIssuedTokens] = useState<Record<string, string>>({});
  const [copiedParticipantId, setCopiedParticipantId] = useState<string | null>(null);

  const currentVersion = contract.versions.find((v) => v.id === contract.currentVersionId);
  const request = view?.signatureRequest ?? null;
  const lawyerReview = view?.lawyerReview ?? null;
  const aiReview = view?.aiReview ?? null;
  const comments = view?.comments ?? [];

  // The comment being replied to. A reply inherits the parent's version —
  // the server refuses a cross-version reply — so only a note on the
  // CURRENT version offers the action.
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const replyTarget = replyTo ? comments.find((c) => c.id === replyTo) ?? null : null;

  /** The clause list the document prints, so an anchor always exists. */
  const commentClauses = useMemo(
    () => renderContract({ ...contract, data }, parties, payments).clauses,
    [contract, data, parties, payments]
  );

  /**
   * Threads, oldest first. A reply always shares its parent's version, so
   * walking to the root can never leave one revision. An orphaned reply is
   * promoted to the top instead of silently disappearing.
   */
  const commentThreads = useMemo(() => {
    const byId = new Map(comments.map((c) => [c.id, c]));
    const rootIdOf = (comment: (typeof comments)[number]): string => {
      let current = comment;
      const seen = new Set<string>([current.id]);
      while (current.parentId && byId.has(current.parentId) && !seen.has(current.parentId)) {
        current = byId.get(current.parentId)!;
        seen.add(current.id);
      }
      return current.id;
    };
    const roots: typeof comments = [];
    const replies = new Map<string, typeof comments>();
    for (const comment of comments) {
      const rootId = rootIdOf(comment);
      if (rootId === comment.id) {
        roots.push(comment);
      } else {
        const list = replies.get(rootId) ?? [];
        list.push(comment);
        replies.set(rootId, list);
      }
    }
    return roots.map((root) => ({ root, replies: replies.get(root.id) ?? [] }));
  }, [comments]);

  /** The version a note was written against, in the reader's terms. */
  function commentVersionLabelFa(comment: (typeof comments)[number]): string {
    const isCurrent = comment.contractVersionId === contract.currentVersionId;
    const version = contract.versions.find((v) => v.id === comment.contractVersionId);
    if (!version) return isCurrent ? "نسخهٔ جاری" : "نسخهٔ پیشین";
    return isCurrent ? `نسخه ${version.versionNumber} (جاری)` : `نسخه ${version.versionNumber}`;
  }

  const commentClauseLabel = (ref: string | null | undefined): string | null =>
    ref ? commentClauses.find((c) => c.id === ref)?.headingFa ?? ref : null;

  const signedParticipantIds = useMemo(
    () =>
      new Set(
        (request?.participants ?? []).filter((p) => p.status === "SIGNED").map((p) => p.id)
      ),
    [request]
  );

  /**
   * Real signature state per role, for the document's signature section.
   * The A4 sheet shows «امضا شده» + the signing date instead of a blank
   * line, so the preview and the printed copy agree with the DB.
   */
  const signatureMarks = useMemo(() => {
    const marks: Record<string, A4SignatureMark> = {};
    for (const participant of request?.participants ?? []) {
      marks[participant.roleFa] = {
        signedAt: participant.signedAt,
        statusFa: SIGNATURE_PARTICIPANT_STATUS_FA[participant.status],
      };
    }
    return marks;
  }, [request]);

  /** Each participant's latest invitation, keyed by participant id. */
  const invitationsByParticipant = useMemo(() => {
    const map = new Map<string, SignatureInvitation>();
    for (const invitation of view?.invitations ?? []) {
      map.set(invitation.participantId, invitation);
    }
    return map;
  }, [view?.invitations]);

  /**
   * Understandable, contract-level status history for the drafting page.
   * Raw audit rows (actor/service/action, e.g. `contract.created`) stay in
   * the backend for security and support and are displayed only in the
   * authorised admin area — this timeline is derived from the lifecycle
   * data the page already shows.
   */
  const statusTimeline = useMemo(() => {
    const items: { id: string; labelFa: string; at: string | null }[] = [];
    if (currentVersion) {
      items.push({
        id: "version",
        labelFa: `نسخه ${currentVersion.versionNumber} تثبیت شد`,
        at: currentVersion.createdAt,
      });
    }
    if (request) {
      items.push({
        id: "request",
        labelFa: "درخواست تأیید و امضای الکترونیکی ایجاد شد",
        at: request.createdAt,
      });
      for (const participant of request.participants) {
        if (participant.status === "SIGNED") {
          items.push({
            id: `sign-${participant.id}`,
            labelFa: `امضای ${participant.roleFa} ثبت شد`,
            at: participant.signedAt,
          });
        } else if (participant.status === "DECLINED") {
          items.push({
            id: `decline-${participant.id}`,
            labelFa: `${participant.roleFa} از امضا خودداری کرد`,
            at: participant.declinedAt,
          });
        } else if (participant.status === "VIEWED") {
          items.push({
            id: `view-${participant.id}`,
            labelFa: `${participant.roleFa} سند را مشاهده کرد`,
            at: participant.viewedAt,
          });
        }
      }
    }
    const admin = view?.adminReview;
    if (admin) {
      items.push({
        id: "admin-review",
        labelFa: `بررسی ادمین: ${CONTRACT_ADMIN_REVIEW_STATUS_FA[admin.status]}`,
        at: admin.decidedAt ?? admin.submittedAt,
      });
    }
    if (contract.finalizedAt) {
      items.push({
        id: "finalized",
        labelFa: "قرارداد نهایی و بایگانی شد",
        at: contract.finalizedAt,
      });
    }
    return items;
  }, [contract.finalizedAt, currentVersion, request, view?.adminReview]);

  async function run(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "عملیات ناموفق بود");
    }
  }

  // ----------------------------------------------------------
  // Invitations — send the draft to the parties
  // ----------------------------------------------------------

  async function sendInvitations(participantIds?: string[]) {
    await run(async () => {
      const res = await issueInvitations.mutateAsync({ id: contract.id, participantIds });
      const tokens: Record<string, string> = {};
      for (const invitation of res.invitations) {
        tokens[invitation.participantId] = invitation.token;
      }
      setIssuedTokens((prev) => ({ ...prev, ...tokens }));
      setInviteDialogOpen(false);
    });
  }

  /** Replace an unusable invitation with a fresh link for one party. */
  async function resendInvitation(
    participant: SignatureParticipant,
    invitation: SignatureInvitation | undefined
  ) {
    await run(async () => {
      if (invitation && invitation.status === "ACTIVE") {
        await revokeInvitation.mutateAsync({ id: contract.id, invitationId: invitation.id });
      }
      await sendInvitations([participant.id]);
    });
  }

  async function copyInviteLink(participantId: string, token: string) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/contracts/sign/${token}`
      );
      setCopiedParticipantId(participantId);
      window.setTimeout(() => setCopiedParticipantId(null), 2000);
    } catch {
      setActionError("کپی لینک در این مرورگر ممکن نبود؛ لینک را دستی انتخاب کنید.");
    }
  }

  // ----------------------------------------------------------
  // Signature
  // ----------------------------------------------------------

  async function openSign(participant: SignatureParticipant) {
    setOtp("");
    setOtpError(null);
    setConsent(false);
    setMobileMasked(null);
    await run(async () => {
      const res = await requestOtp.mutateAsync({
        id: contract.id,
        participantId: participant.id,
      });
      // The server reports the REAL delivery outcome — never claim a code
      // was sent when it was not. A failed send is refused by the route
      // (thrown here) or flagged by `sent: false`.
      if (!res.sent) {
        setActionError(
          `ارسال کد تأیید به ${res.mobileMasked} ناموفق بود. دوباره تلاش کنید یا روش «امضای دستی» را انتخاب کنید.`
        );
        return;
      }
      setMobileMasked(res.mobileMasked);
      // The «ارسال شد» wording is only used for a real SMS; the dev
      // console transport is named explicitly so nobody believes a
      // phone received a code that never left the server.
      setOtpChannel(res.channel ?? "dev-console");
      setSignTarget(participant);
    });
  }

  /** Trigger the hidden file picker for a participant's wet-ink scan. */
  function beginPhysical(participant: SignatureParticipant) {
    setPhysicalTarget(participant);
    setActionError(null);
    // Reset so re-selecting the same file still fires onChange.
    if (physicalInputRef.current) physicalInputRef.current.value = "";
    physicalInputRef.current?.click();
  }

  async function uploadPhysical(file: File) {
    if (!physicalTarget) return;
    const target = physicalTarget;
    setPhysicalTarget(null);
    await run(async () => {
      await recordPhysical.mutateAsync({
        id: contract.id,
        participantId: target.id,
        file,
      });
    });
  }

  async function confirmSign() {
    if (!signTarget) return;
    setOtpError(null);
    try {
      await verifyOtp.mutateAsync({
        id: contract.id,
        participantId: signTarget.id,
        code: otp,
        consentGiven: consent,
        consentVersion: CONSENT_VERSION,
      });
      setSignTarget(null);
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : "کد وارد‌شده صحیح نیست");
    }
  }

  // ----------------------------------------------------------
  // AI review — through the EXISTING chat
  // ----------------------------------------------------------

  async function askAssistant() {
    await run(async () => {
      const res = await createAi.mutateAsync({ id: contract.id });
      router.push(`/chat/${res.conversationId}`);
    });
  }

  // ----------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Lifecycle stepper — the real progress rail */}
      {view && <LifecycleStepper steps={view.steps} />}

      {/* Status banner */}
      <div className="rounded-large border border-divider bg-surface p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-caption text-muted">وضعیت قرارداد</p>
            <p className="text-titleMedium text-on-surface">{stateLabelFa(contract.state)}</p>
          </div>
          {currentVersion && (
            <div className="text-left">
              <p className="text-caption text-muted">نسخه جاری</p>
              <p className="text-body-2 text-on-surface">
                نسخه {currentVersion.versionNumber} —{" "}
                {formatIsoJalali(currentVersion.createdAt.slice(0, 10))}
              </p>
            </div>
          )}
        </div>
        <div className="mt-3">
          <ProgressLinear
            value={completeness.overall}
            label={`تکمیل اطلاعات: ${completeness.overall}٪`}
            showValue
            color={completeness.overall === 100 ? "success" : "primary"}
          />
        </div>

        {/* Freezing the content is the gate to every review path: the
            three primary choices all need a current version. */}
        {!contract.currentVersionId && (
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-caption text-muted">
              برای شروع بررسی، ابتدا محتوای قرارداد را تثبیت کنید.
            </p>
            <Button
              onClick={() => void run(() => submit.mutateAsync(contract.id))}
              disabled={completeness.blockers.length > 0}
              loading={submit.isPending}
            >
              تثبیت نسخه و ارسال برای بررسی
            </Button>
          </div>
        )}
      </div>

      {actionError && <Notice tone="error">{actionError}</Notice>}

      {completeness.blockers.length > 0 && (
        <Notice tone="warning" title="پیش از ارسال به بررسی">
          این بخش‌ها هنوز کامل نشده‌اند: {completeness.blockers.map((b) => b.labelFa).join("، ")}
        </Notice>
      )}

      {/* ------------------------------------------------------
          The three primary choices under Preview
          ------------------------------------------------------ */}
      <SectionCard
        title="پیش‌نمایش قرارداد"
        description="پس از تکمیل اطلاعات، یکی از این سه مسیر را انتخاب کنید"
      >
        <div className="grid grid-cols-1 tablet:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => void askAssistant()}
            disabled={createAi.isPending || !contract.currentVersionId}
            className="rounded-medium border border-divider p-3 text-right hover:state-hover disabled:opacity-50 transition-colors"
          >
            <span className="inline-flex items-center gap-2 text-labelLarge text-on-surface">
              <IconChat className="w-4 h-4 text-primary" />
              پرسش از دستیار هوشمند
            </span>
            <span className="block mt-1 text-caption text-muted">
              تحلیل هوش مصنوعی از دید یکی از طرفین — جایگزین نظر وکیل نیست.
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              void run(() =>
                createLawyer.mutateAsync({ id: contract.id, mode: "NON_BLOCKING" })
              )
            }
            disabled={createLawyer.isPending || !!lawyerReview || !contract.currentVersionId}
            className="rounded-medium border border-divider p-3 text-right hover:state-hover disabled:opacity-50 transition-colors"
          >
            <span className="inline-flex items-center gap-2 text-labelLarge text-on-surface">
              <IconLawBook className="w-4 h-4 text-primary" />
              بررسی توسط وکیل
            </span>
            <span className="block mt-1 text-caption text-muted">
              ارجاع به وکیل متخصص؛ پیشنهادها را می‌پذیرید یا رد می‌کنید.
            </span>
          </button>

          <button
            type="button"
            onClick={() => void run(() => prepare.mutateAsync({ id: contract.id }))}
            disabled={prepare.isPending || !view?.canPrepareForSignature}
            className="rounded-medium border border-divider p-3 text-right hover:state-hover disabled:opacity-50 transition-colors"
          >
            <span className="inline-flex items-center gap-2 text-labelLarge text-on-surface">
              <IconShield className="w-4 h-4 text-primary" />
              آماده‌سازی برای امضا
            </span>
            <span className="block mt-1 text-caption text-muted">
              تثبیت نسخه و ارسال برای تأیید و امضای الکترونیکی.
            </span>
          </button>
        </div>
      </SectionCard>

      {/* ------------------------------------------------------
          Invitations — send the DRAFT to the parties
          ------------------------------------------------------ */}
      {request && (
        <SectionCard
          title="ارسال پیش‌نویس به طرفین"
          description={`نسخه ${currentVersion?.versionNumber ?? "—"} — لینک اختصاصی هر طرف که فقط به همان قرارداد و همان نسخه گره خورده است`}
        >
          <div className="space-y-2">
            {request.participants.map((participant) => {
              const invitation = invitationsByParticipant.get(participant.id);
              const status = invitationStatus(participant, invitation);
              const token = issuedTokens[participant.id];
              const needsResend = status.tone === "warn" || status.tone === "error";
              return (
                <div
                  key={participant.id}
                  className="rounded-medium border border-divider px-3 py-2.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-body-2 text-on-surface">
                        {participant.roleFa}
                        {participant.nameFa ? ` — ${participant.nameFa}` : ""}
                      </p>
                      <p className="text-caption text-muted" dir="ltr">
                        {participant.mobile}
                      </p>
                    </div>
                    <span className={`text-caption ${INVITATION_TONE_CLASS[status.tone]}`}>
                      {status.labelFa}
                    </span>
                  </div>

                  {/* The raw token is surfaced ONLY when delivery did not
                      reach a phone, so the drafter can hand the link over
                      themselves instead of believing a message arrived. */}
                  {token && needsResend && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-caption text-muted break-all" dir="ltr">
                        /contracts/sign/{token}
                      </code>
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<IconCopy className="w-3.5 h-3.5" />}
                        onClick={() => void copyInviteLink(participant.id, token)}
                      >
                        {copiedParticipantId === participant.id ? "کپی شد" : "کپی لینک"}
                      </Button>
                    </div>
                  )}

                  {(invitation || token) && (
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<IconRefresh className="w-3.5 h-3.5" />}
                        onClick={() => void resendInvitation(participant, invitation)}
                        disabled={
                          issueInvitations.isPending ||
                          revokeInvitation.isPending ||
                          participant.status === "SIGNED"
                        }
                      >
                        ارسال مجدد لینک
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-caption text-muted">
              شمارهٔ موبایل هر طرف از اطلاعات ثبت‌شدهٔ همان طرف خوانده می‌شود؛ نیازی به
              وارد کردن دوبارهٔ شماره نیست.
            </p>
            <Button
              startIcon={<IconSend className="w-4 h-4" />}
              onClick={() => setInviteDialogOpen(true)}
              loading={issueInvitations.isPending}
              disabled={!requestAcceptsInvitations(request.status)}
            >
              ارسال پیش‌نویس به طرفین
            </Button>
          </div>
        </SectionCard>
      )}

      {/* Confirmation — the drafter sees each name and destination
          number BEFORE anything is sent. */}
      <Dialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        title="ارسال پیش‌نویس به طرفین"
        description="لینک اختصاصی امضا برای هر طرف از طریق پیامک ارسال می‌شود."
        actions={
          <>
            <Button variant="text" onClick={() => setInviteDialogOpen(false)}>
              انصراف
            </Button>
            <Button
              onClick={() => void sendInvitations()}
              loading={issueInvitations.isPending}
            >
              ارسال به همهٔ طرفین
            </Button>
          </>
        }
      >
        <ul className="space-y-2">
          {(request?.participants ?? []).map((participant) => (
            <li
              key={participant.id}
              className="rounded-medium border border-divider px-3 py-2 flex items-center justify-between gap-3 flex-wrap"
            >
              <span className="text-body-2 text-on-surface">
                {participant.roleFa}
                {participant.nameFa ? ` — ${participant.nameFa}` : ""}
              </span>
              <span className="text-body-2 text-on-surface font-mono" dir="ltr">
                {participant.mobile}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-caption text-muted">
          اگر ارسال پیامک ناموفق باشد، وضعیت همان طرف «ارسال ناموفق» نمایش داده می‌شود و لینک
          را می‌توانید به‌صورت دستی برای او بفرستید.
        </p>
      </Dialog>

      {/* ------------------------------------------------------
          Signature panel
          ------------------------------------------------------ */}
      {request && (
        <SectionCard
          title="تأیید و امضای الکترونیکی"
          description={`نسخه ${currentVersion?.versionNumber ?? "—"} — روش: کد یک‌بارمصرف پیامکی`}
        >
          <div className="space-y-2">
            {request.participants.map((participant) => {
              const signed = signedParticipantIds.has(participant.id);
              return (
                <div
                  key={participant.id}
                  className="rounded-medium border border-divider px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap"
                >
                  <div>
                    <p className="text-body-2 text-on-surface">{participant.roleFa}</p>
                    <p className="text-caption text-muted">{participant.mobileMasked}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {signed ? (
                      <span className="text-caption text-success inline-flex items-center gap-1">
                        <IconCheck className="w-3.5 h-3.5" />
                        {participant.signedMethod === "PHYSICAL_WET_INK"
                          ? "امضای دستی ثبت شد"
                          : "امضا شده"}
                      </span>
                    ) : participant.status === "DECLINED" ? (
                      <span className="text-caption text-error">خودداری کرده</span>
                    ) : (
                      <>
                        <Button
                          size="small"
                          variant="tonal"
                          onClick={() => void openSign(participant)}
                          disabled={!view?.canSign || requestOtp.isPending}
                        >
                          ارسال کد و امضا
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<IconFileText className="w-3.5 h-3.5" />}
                          onClick={() => beginPhysical(participant)}
                          disabled={!view?.canSign || recordPhysical.isPending}
                        >
                          امضای دستی (بارگذاری اسکن)
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() =>
                            void run(() =>
                              decline.mutateAsync({
                                id: contract.id,
                                participantId: participant.id,
                              })
                            )
                          }
                          disabled={!view?.canSign}
                        >
                          خودداری
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {lawyerReview?.blocksSigning && (
            <Notice tone="warning" title="بررسی وکیل در جریان است">
              تا تکمیل بررسی حقوقی، امضا امکان‌پذیر نیست.
            </Notice>
          )}

          <p className="mt-3 text-caption text-muted">
            این امضا «تأیید و امضای الکترونیکی» است و با «امضای الکترونیکی مطمئن» یا «امضای
            دیجیتال رسمی» یکسان نیست. طرفی که روی نسخه چاپی امضا می‌کند، اسکن امضاشده را با
            گزینهٔ «امضای دستی» بارگذاری می‌کند.
          </p>
        </SectionCard>
      )}

      {/* Hidden picker for the wet-ink scan — one file, opened per participant */}
      <input
        ref={physicalInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadPhysical(file);
          setPhysicalTarget(null);
        }}
      />

      {/* ------------------------------------------------------
          Lawyer review panel
          ------------------------------------------------------ */}
      {lawyerReview && (
        <SectionCard
          title="بررسی حقوقی"
          description={lawyerReview.lawyerNameFa ?? "در حال یافتن وکیل"}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Chip label={lawyerReview.mode === "BLOCKING" ? "بازدارنده" : "غیربازدارنده"} />
            <Chip label={lawyerReview.category} />
            {lawyerReview.slaDueAt && (
              <span className="text-caption text-muted">
                مهلت: {formatIsoJalali(lawyerReview.slaDueAt.slice(0, 10))}
              </span>
            )}
          </div>

          {lawyerReview.summaryFa && (
            <p className="mt-3 text-body-2 text-on-surface whitespace-pre-line">
              {lawyerReview.summaryFa}
            </p>
          )}

          {lawyerReview.findings.length > 0 && (
            <div className="mt-3 space-y-2">
              {lawyerReview.findings.map((finding) => (
                <div key={finding.id} className="rounded-medium border border-divider p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-labelLarge text-on-surface">{finding.titleFa}</span>
                    <Chip label={SEVERITY_LABELS_FA[finding.severity]} />
                  </div>
                  <p className="mt-1 text-body-2 text-on-surface whitespace-pre-line">
                    {finding.bodyFa}
                  </p>
                  {finding.proposedText && (
                    <p className="mt-2 text-caption text-muted whitespace-pre-line">
                      متن پیشنهادی: {finding.proposedText}
                    </p>
                  )}
                  {finding.decision === "pending" ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="small"
                        onClick={() =>
                          void run(() =>
                            decideFinding.mutateAsync({
                              id: contract.id,
                              findingId: finding.id,
                              decision: "accepted",
                            })
                          )
                        }
                      >
                        پذیرش پیشنهاد
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          void run(() =>
                            decideFinding.mutateAsync({
                              id: contract.id,
                              findingId: finding.id,
                              decision: "rejected",
                            })
                          )
                        }
                      >
                        رد پیشنهاد
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-caption text-muted">
                      {finding.decision === "accepted" ? "پذیرفته شد" : "رد شد"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {(lawyerReview.state === "AWAITING_ACCEPTANCE" ||
              lawyerReview.state === "MATCHING") && (
              <Button
                size="small"
                variant="tonal"
                onClick={() => void run(() => acceptLawyer.mutateAsync({ id: contract.id }))}
                loading={acceptLawyer.isPending}
              >
                پذیرش وکیل
              </Button>
            )}
            {(lawyerReview.state === "ACCEPTED" || lawyerReview.state === "IN_PROGRESS") && (
              <Button
                size="small"
                onClick={() =>
                  void run(() =>
                    completeLawyer.mutateAsync({
                      id: contract.id,
                      summaryFa: "بررسی حقوقی انجام شد.",
                    })
                  )
                }
                loading={completeLawyer.isPending}
              >
                تکمیل بررسی
              </Button>
            )}
            <Button
              size="small"
              variant="text"
              onClick={() => void run(() => cancelLawyer.mutateAsync({ id: contract.id }))}
              loading={cancelLawyer.isPending}
            >
              لغو درخواست
            </Button>
          </div>
        </SectionCard>
      )}

      {/* ------------------------------------------------------
          AI review panel
          ------------------------------------------------------ */}
      {aiReview && (
        <SectionCard title="تحلیل هوش مصنوعی" description={`از دید ${aiReview.perspectiveRoleFa}`}>
          <Notice tone="info" title="این تحلیل هوش مصنوعی است">
            این متن جایگزین نظر وکیل نیست.
          </Notice>
          <p className="mt-3 text-body-2 text-on-surface whitespace-pre-line">
            {aiReview.summaryFa}
          </p>
          <Button
            size="small"
            variant="text"
            startIcon={<IconChat className="w-4 h-4" />}
            onClick={() => router.push(`/chat/${aiReview.conversationId}`)}
          >
            مشاهده گفتگوی کامل
          </Button>
        </SectionCard>
      )}

      {/* ------------------------------------------------------
          Review comments
          ------------------------------------------------------ */}
      <SectionCard
        title="نظرها و درخواست‌های اصلاح"
        description="جدا از متن رسمی قرارداد — هر نظر به نسخه‌ای که برای آن نوشته شده گره خورده است"
      >
        <Notice tone="info">
          نظرها بخشی از متن قرارداد نیستند و در سند چاپی نمی‌آیند. برای اعمال یک درخواست تغییر
          باید بند اصلی در مرحلهٔ مربوط ویرایش و نسخهٔ جدید تثبیت شود.
        </Notice>

        {commentThreads.length === 0 ? (
          <p className="mt-3 text-body-2 text-muted">هنوز نظری ثبت نشده است.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {commentThreads.map(({ root, replies }) => (
              <li key={root.id} className="space-y-2">
                {[root, ...replies].map((comment, index) => {
                  const shared = (comment.visibility ?? "internal") === "parties";
                  const isCurrent = comment.contractVersionId === contract.currentVersionId;
                  return (
                    <div
                      key={comment.id}
                      className={`rounded-medium border p-3 ${
                        index === 0 ? "border-divider" : "border-divider ms-6 border-s-2"
                      } ${replyTo === comment.id ? "border-primary" : ""}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-labelLarge text-on-surface">
                          {comment.authorLabelFa}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-caption text-muted">
                            {commentVersionLabelFa(comment)}
                          </span>
                          <span className="text-caption text-muted">
                            {formatIsoJalaliDateTime(comment.createdAt)}
                          </span>
                        </div>
                      </div>
                      {commentClauseLabel(comment.clauseRef) && (
                        <p className="mt-1 text-caption text-primary">
                          بند مرتبط: {commentClauseLabel(comment.clauseRef)}
                        </p>
                      )}
                      <p className="mt-1 text-body-2 text-on-surface whitespace-pre-line">
                        {comment.body}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-caption text-muted">
                          {shared ? "مشترک با طرفین" : "داخلی — برای طرفین ارسال نمی‌شود"}
                          {comment.kind === "change_request" ? " · درخواست اصلاح" : ""}
                        </span>
                        {isCurrent && contract.currentVersionId && (
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<IconChat className="w-3.5 h-3.5" />}
                            onClick={() => setReplyTo(comment.id)}
                          >
                            پاسخ
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <ContractCommentComposer
            contractId={contract.id}
            currentVersionId={contract.currentVersionId}
            clauses={commentClauses}
            replyTo={replyTo}
            replyToLabelFa={replyTarget?.authorLabelFa}
            onCancelReply={() => setReplyTo(null)}
            initialVisibility={replyTarget?.visibility ?? "internal"}
          />
        </div>
      </SectionCard>

      {/* ------------------------------------------------------
          Readable status history — contract-level only. The raw audit
          trail (actor/service/action ids) is kept in the backend and is
          shown only in the authorised admin area, never on this page.
          ------------------------------------------------------ */}
      <SectionCard
        title="روند قرارداد"
        description="وضعیت‌های این قرارداد، به ترتیب زمان"
      >
        {statusTimeline.length > 0 ? (
          <ol className="space-y-2">
            {statusTimeline.map((item) => (
              <li
                key={item.id}
                className="rounded-medium border border-divider px-3 py-2 flex items-start justify-between gap-3 flex-wrap"
              >
                <span className="text-body-2 text-on-surface">{item.labelFa}</span>
                <span className="text-caption text-muted shrink-0">
                  {item.at ? formatIsoJalali(item.at.slice(0, 10)) : ""}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body-2 text-muted">هنوز رویداد قابل‌نمایشی ثبت نشده است.</p>
        )}
      </SectionCard>

      {/* ------------------------------------------------------
          Finalize + artifacts
          ------------------------------------------------------ */}
      <SectionCard title="تکمیل و بایگانی" description="نسخه غیرقابل‌تغییر قرارداد">
        {view?.canFinalize ? (
          <Button
            onClick={() => void run(() => finalize.mutateAsync(contract.id))}
            loading={finalize.isPending}
          >
            نهایی‌سازی قرارداد
          </Button>
        ) : (
          <p className="text-body-2 text-muted">نهایی‌سازی پس از امضای همه طرفین فعال می‌شود.</p>
        )}

        {(contract.state === "FINALIZED" || contract.state === "ARCHIVED") && (
          <div className="mt-3 space-y-2">
            <p className="text-body-2 text-on-surface">
              شناسه عمومی تأیید: <span className="font-mono">{contract.publicVerificationId}</span>
            </p>
            {contract.finalizedAt && (
              <p className="text-caption text-muted">
                تاریخ نهایی‌سازی: {formatIsoJalali(contract.finalizedAt.slice(0, 10))}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <a
                href={contractPdfUrl(contract.id, contract.finalVersionId ?? undefined)}
                className="inline-flex items-center gap-1.5 rounded-medium border border-outline px-4 h-10 text-labelLarge text-primary hover:state-hover"
              >
                <IconDownload className="w-4 h-4" />
                دانلود PDF نهایی
              </a>
              <a
                href={contractDocxUrl(contract.id, contract.finalVersionId ?? undefined)}
                className="inline-flex items-center gap-1.5 rounded-medium border border-outline px-4 h-10 text-labelLarge text-primary hover:state-hover"
              >
                <IconFileText className="w-4 h-4" />
                دانلود Word
              </a>
              <a
                href={`/contracts/verify/${contract.publicVerificationId}`}
                className="inline-flex items-center gap-1.5 rounded-medium border border-outline px-4 h-10 text-labelLarge text-primary hover:state-hover"
              >
                صفحه تأیید عمومی
              </a>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Registration policy — never hard-coded */}
      <Notice tone="info" title="ثبت رسمی">
        {def.registrationPolicy.explanationFa}
        {view?.registrationStatusFa && (
          <span className="block mt-1 text-caption text-muted">
            وضعیت ثبت: {view.registrationStatusFa}
          </span>
        )}
      </Notice>

      {/* Live preview — same engine as the snapshot and the PDF */}
      <div>
        <h3 className="text-titleMedium text-on-surface mb-2">پیش‌نمایش قرارداد</h3>
        <LivePreview
          contract={{ ...contract, data }}
          parties={parties}
          payments={payments}
          versionNumber={currentVersion?.versionNumber ?? null}
          documentHash={currentVersion?.documentHash ?? null}
          signatureMarks={signatureMarks}
          pdfHref={
            contract.currentVersionId
              ? contractPdfUrl(contract.id, contract.currentVersionId)
              : undefined
          }
          stamp={
            view?.adminApproved
              ? {
                  applied: true,
                  reviewedAt: view.adminReview?.decidedAt ?? null,
                  reviewingOfficeFa: view.adminReview?.reviewingOfficeFa,
                  reviewerInitials: view.adminReview?.reviewerInitials,
                  reviewId: view.adminReview?.id,
                  // The OFFICIAL seal is drawn only for a version a Super
                  // Admin stamped; the assets are permission-gated routes,
                  // never public files.
                  official: view.stamped === true,
                  sealHref: view.stamped
                    ? `/api/v1/property-contracts/${contract.id}/stamp-asset/seal`
                    : undefined,
                  hologramHref: view.stamped
                    ? `/api/v1/property-contracts/${contract.id}/stamp-asset/hologram`
                    : undefined,
                  approvedByLabelFa: view.officialStamp?.approvedByLabelFa ?? null,
                  approvedAt: view.officialStamp?.approvedAt ?? null,
                }
              : { applied: false }
          }
        />
      </div>

      {/* OTP dialog — consent is explicit, never prechecked */}
      <Dialog
        open={signTarget !== null}
        onClose={() => setSignTarget(null)}
        title="تأیید و امضای الکترونیکی"
        description={
          otpChannel === "sms"
            ? `کد تأیید به شماره ${mobileMasked ?? ""} پیامک شد.`
            : "کد تأیید در محیط توسعه در کنسول سرور ثبت شد (پیامک واقعی ارسال نشده است)."
        }
        actions={
          <>
            <Button variant="text" onClick={() => setSignTarget(null)}>
              انصراف
            </Button>
            <Button
              onClick={() => void confirmSign()}
              disabled={otp.length !== 6 || !consent}
              loading={verifyOtp.isPending}
            >
              تأیید و امضا
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <OTPInput value={otp} onChange={setOtp} numeric autoFocus hasError={!!otpError} />
          {otpError && <p className="text-caption text-error">{otpError}</p>}
          <Checkbox
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            label="متن قرارداد را خوانده‌ام و با تأیید و امضای الکترونیکی آن موافقم."
          />
          <p className="text-caption text-muted inline-flex items-start gap-1">
            <IconWarning className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            کد یک‌بارمصرف پس از پنج دقیقه منقضی می‌شود و امضا به نسخه جاری و هش آن گره می‌خورد.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
