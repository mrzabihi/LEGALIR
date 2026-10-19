// ============================================================
// LEGALIR — Wizard step: signature stage
// ============================================================
// The stage between the confirmed supplementary material and the final
// review workspace. It does three things, and shows every fact it uses:
//
//   1. Replays the FINAL version and the «یادداشت تکمیلی» the parties are
//      about to sign, so nobody signs a document they have not seen.
//   2. Sends the signature invitation to every party through the numbers
//      already registered on their party record — the drafter never types
//      a number here, and the server never claims a message arrived when
//      it did not.
//   3. Tracks each party separately: ready → sent → viewed → signed, plus
//      declined / failed / expired, with the real timestamps.
//
// Sending is idempotent on the server: a request is created once, then
// invitations are issued per participant. A failed delivery never reads
// as success; the raw link is surfaced only as a manual fallback.
// ============================================================

"use client";

import React, { useMemo, useRef, useState } from "react";
import { Button, Checkbox, Dialog, OTPInput } from "@legalir/ui";
import {
  IconArrowBack,
  IconArrowForward,
  IconCheck,
  IconCopy,
  IconFileText,
  IconRefresh,
  IconSend,
  IconShield,
  IconWarning,
} from "@/lib/icons";
import { useWizard } from "../wizard-context";
import { ActionButton, SectionCard, Notice } from "../primitives";
import { getContractDefinition, partyRoleLabelFa } from "@/lib/contracts/registry";
import { formatIsoJalali, formatIsoJalaliDateTime } from "@/lib/contracts/dates";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  useContractLifecycle,
  useCreateSignatureRequest,
  useDeclineSignature,
  useIssueInvitations,
  useRecordPhysicalSignature,
  useRequestSignatureOtp,
  useRevokeInvitation,
  useVerifySignatureOtp,
} from "@/hooks/useContractLifecycle";
import type { SignatureInvitation, SignatureParticipant } from "@legalir/types";

/** The version of the consent text the signer agrees to. */
const CONSENT_VERSION = "v1";

type PartyTone = "ready" | "pending" | "ok" | "warn" | "error";

const TONE_CLASS: Record<PartyTone, string> = {
  ready: "text-muted",
  pending: "text-primary",
  ok: "text-success",
  warn: "text-warning",
  error: "text-error",
};

/**
 * One party's real state, read from the participant row and its latest
 * invitation. The status is never inferred from client-side "sent" flags.
 */
function partyStatus(
  participant: SignatureParticipant,
  invitation: SignatureInvitation | undefined
): { labelFa: string; tone: PartyTone } {
  if (!invitation) return { labelFa: "آمادهٔ ارسال", tone: "ready" };
  if (participant.status === "SIGNED") return { labelFa: "امضا شد", tone: "ok" };
  if (participant.status === "DECLINED") return { labelFa: "از امضا خودداری کرد", tone: "error" };
  if (invitation.status === "REVOKED") return { labelFa: "لغو شد — نیازمند ارسال مجدد", tone: "warn" };
  if (invitation.status === "EXPIRED") return { labelFa: "مهلت تمام شد — نیازمند ارسال مجدد", tone: "warn" };
  if (invitation.deliveryStatus === "FAILED") {
    return { labelFa: "ارسال ناموفق — نیازمند ارسال مجدد", tone: "error" };
  }
  if (participant.status === "VIEWED") return { labelFa: "مشاهده شد — در انتظار امضا", tone: "ok" };
  if (invitation.deliveryChannel === "dev-console") {
    return { labelFa: "در کنسول توسعه ثبت شد (پیامکی واقعی ارسال نشده)", tone: "warn" };
  }
  return { labelFa: "ارسال شد — در انتظار مشاهده", tone: "pending" };
}

function requestAcceptsInvitations(status: string): boolean {
  return status !== "COMPLETED" && status !== "DECLINED" && status !== "EXPIRED" && status !== "CANCELLED";
}

export function SignatureStep() {
  const { contract, data, goToStep } = useWizard();
  const def = getContractDefinition(contract.type);

  const lifecycle = useContractLifecycle(contract.id);
  const view = lifecycle.data;

  const prepare = useCreateSignatureRequest();
  const issueInvitations = useIssueInvitations();
  const revokeInvitation = useRevokeInvitation();
  const requestOtp = useRequestSignatureOtp();
  const verifyOtp = useVerifySignatureOtp();
  const recordPhysical = useRecordPhysicalSignature();
  const decline = useDeclineSignature();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [issuedTokens, setIssuedTokens] = useState<Record<string, string>>({});
  const [copiedParticipantId, setCopiedParticipantId] = useState<string | null>(null);

  // OTP signing — the same real flow the review workspace offers, kept on
  // the signature stage so the parties' signing is not split across two
  // pages with two different buttons.
  const [signTarget, setSignTarget] = useState<SignatureParticipant | null>(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [mobileMasked, setMobileMasked] = useState<string | null>(null);
  const [otpChannel, setOtpChannel] = useState<"sms" | "dev-console">("dev-console");
  const [consent, setConsent] = useState(false);
  const [physicalTarget, setPhysicalTarget] = useState<SignatureParticipant | null>(null);
  const physicalInputRef = useRef<HTMLInputElement>(null);

  const request = view?.signatureRequest ?? null;
  const currentVersion = contract.versions.find((v) => v.id === contract.currentVersionId);

  const supplementary = (data as { supplementary?: { notes?: string } }).supplementary;
  const note = (supplementary?.notes ?? "").trim();
  const changeRequestCount = (
    (data as { customClauses?: { kind?: string; title?: string; body?: string }[] })
      .customClauses ?? []
  ).filter(
    (c) =>
      (c.kind ?? "agreement") === "change_request" &&
      ((c.title ?? "").trim() || (c.body ?? "").trim())
  ).length;

  const invitationsByParticipant = useMemo(() => {
    const map = new Map<string, SignatureInvitation>();
    for (const invitation of view?.invitations ?? []) {
      map.set(invitation.participantId, invitation);
    }
    return map;
  }, [view?.invitations]);

  /** Pre-send list: each role and the party recorded for it. */
  const partyPreview = useMemo(
    () =>
      def.roles.map((role) => {
        const party = contract.parties?.find((p) => p.role === role);
        const name =
          party?.personKind === "legal"
            ? party.identity.companyName ?? ""
            : `${party?.identity.firstName ?? ""} ${party?.identity.lastName ?? ""}`.trim();
        return {
          role,
          roleFa: partyRoleLabelFa(role),
          nameFa: name,
          mobile: party?.identity.mobile ?? "",
        };
      }),
    [contract.parties, def.roles]
  );

  /**
   * Runs a write and reports whether it actually persisted, so the button
   * that triggered it can only claim success for a real write.
   */
  async function runResult(fn: () => Promise<unknown>): Promise<boolean> {
    setActionError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "عملیات ناموفق بود");
      return false;
    }
  }

  /**
   * The one committing action of this stage. It creates the request (if
   * this is the first send) and then issues the invitations for every
   * participant. Both steps are server-authorised; a refusal is shown.
   */
  async function sendForSignature(): Promise<boolean> {
    return runResult(async () => {
      if (!request) {
        await prepare.mutateAsync({ id: contract.id });
      }
      const res = await issueInvitations.mutateAsync({ id: contract.id });
      const tokens: Record<string, string> = {};
      for (const invitation of res.invitations) {
        tokens[invitation.participantId] = invitation.token;
      }
      setIssuedTokens((prev) => ({ ...prev, ...tokens }));
      setConfirmOpen(false);
    });
  }

  /** Resolves `true` only after the replacement link was issued. */
  async function resend(
    participant: SignatureParticipant,
    invitation: SignatureInvitation | undefined
  ): Promise<boolean> {
    if (invitation && invitation.status === "ACTIVE") {
      const revoked = await runResult(() =>
        revokeInvitation.mutateAsync({ id: contract.id, invitationId: invitation.id })
      );
      if (!revoked) return false;
    }
    return runResult(async () => {
      const res = await issueInvitations.mutateAsync({
        id: contract.id,
        participantIds: [participant.id],
      });
      const tokens: Record<string, string> = {};
      for (const item of res.invitations) tokens[item.participantId] = item.token;
      setIssuedTokens((prev) => ({ ...prev, ...tokens }));
    });
  }

  /**
   * Request a real OTP for this participant. The server reports the actual
   * delivery outcome, so the dialog is opened only after a code really left
   * the server; a failure is named instead of pretending a message arrived.
   */
  async function openSign(participant: SignatureParticipant) {
    setOtp("");
    setOtpError(null);
    setConsent(false);
    setMobileMasked(null);
    await runResult(async () => {
      const res = await requestOtp.mutateAsync({
        id: contract.id,
        participantId: participant.id,
      });
      if (!res.sent) {
        throw new Error(
          `ارسال کد تأیید به ${res.mobileMasked} ناموفق بود. دوباره تلاش کنید یا روش «امضای دستی» را انتخاب کنید.`
        );
      }
      setMobileMasked(res.mobileMasked);
      setOtpChannel(res.channel ?? "dev-console");
      setSignTarget(participant);
    });
  }

  /** Trigger the hidden file picker for a participant's wet-ink scan. */
  function beginPhysical(participant: SignatureParticipant) {
    setPhysicalTarget(participant);
    setActionError(null);
    if (physicalInputRef.current) physicalInputRef.current.value = "";
    physicalInputRef.current?.click();
  }

  async function uploadPhysical(file: File) {
    if (!physicalTarget) return;
    const target = physicalTarget;
    setPhysicalTarget(null);
    await runResult(async () => {
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

  async function copyLink(participantId: string, token: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/contracts/sign/${token}`);
      setCopiedParticipantId(participantId);
      window.setTimeout(() => setCopiedParticipantId(null), 2000);
    } catch {
      setActionError("کپی لینک در این مرورگر ممکن نبود؛ لینک را دستی انتخاب کنید.");
    }
  }

  const signedCount = request?.participants.filter((p) => p.status === "SIGNED").length ?? 0;
  const totalParties = request?.participants.length ?? partyPreview.length;
  const canPrepare = view?.canPrepareForSignature ?? false;
  const sendDisabled =
    !request &&
    (!canPrepare ||
      !currentVersion ||
      prepare.isPending ||
      issueInvitations.isPending ||
      !view);
  const canSendAgain = request ? requestAcceptsInvitations(request.status) : true;

  return (
    <div className="space-y-4" dir="rtl">
      <Notice tone="info" title="پیش از امضا">
        نسخهٔ نهایی و یادداشت تکمیلی همین‌جا نمایش داده می‌شوند. لینک امضا برای هر طرف به شمارهٔ
        ثبت‌شده در اطلاعات همان طرف ارسال می‌شود؛ نیازی به وارد کردن دوبارهٔ شماره نیست.
      </Notice>

      {actionError && <Notice tone="error">{actionError}</Notice>}

      {/* 1 — The exact version and note the parties will sign */}
      <SectionCard
        title="نسخهٔ نهایی برای امضا"
        description="همان نسخه‌ای که پیش‌نمایش و نسخهٔ چاپی نشان می‌دهند"
      >
        {currentVersion ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 tablet:grid-cols-2">
              <div className="rounded-medium border border-divider px-3 py-2">
                <p className="text-caption text-muted">نسخه</p>
                <p className="text-body-2 text-on-surface">
                  نسخه {toPersianNumber(currentVersion.versionNumber)}
                </p>
              </div>
              <div className="rounded-medium border border-divider px-3 py-2">
                <p className="text-caption text-muted">تاریخ تثبیت نسخه</p>
                <p className="text-body-2 text-on-surface">
                  {formatIsoJalali(currentVersion.createdAt.slice(0, 10))}
                </p>
              </div>
            </div>

            <div className="rounded-medium border border-divider px-3 py-2">
              <p className="text-caption text-muted">یادداشت تکمیلی (در پایان سند چاپ می‌شود)</p>
              {note ? (
                <p className="mt-0.5 whitespace-pre-wrap text-body-2 text-on-surface">{note}</p>
              ) : (
                <p className="mt-0.5 text-body-2 text-muted">یادداشت تکمیلی ثبت نشده است.</p>
              )}
            </div>

            {changeRequestCount > 0 && (
              <p className="text-caption text-muted">
                {toPersianNumber(changeRequestCount)} درخواست تغییر در پیوست غیرالزام‌آور سند
                نمایش داده می‌شود.
              </p>
            )}

            <Button
              type="button"
              variant="outlined"
              size="small"
              startIcon={<IconFileText className="w-4 h-4" />}
              onClick={() => goToStep("review")}
            >
              مشاهدهٔ پیش‌نمایش کامل (A4)
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-body-2 text-muted">
              هنوز نسخهٔ نهایی تثبیت نشده است. ابتدا در مرحلهٔ بازبینی، نسخه را تثبیت کنید تا امضا
              به همان نسخه گره بخورد.
            </p>
            <Button
              type="button"
              variant="outlined"
              size="small"
              startIcon={<IconArrowBack className="w-4 h-4" />}
              onClick={() => goToStep("review")}
            >
              رفتن به بازبینی
            </Button>
          </div>
        )}
      </SectionCard>

      {/* 2 — Per-party signature tracking */}
      <SectionCard
        title="طرفین و وضعیت امضا"
        description={
          request
            ? `${toPersianNumber(signedCount)} از ${toPersianNumber(totalParties)} طرف امضا کرده‌اند`
            : "پس از ارسال، وضعیت هر طرف به‌صورت جداگانه نمایش داده می‌شود"
        }
      >
        {request ? (
          <div className="space-y-2">
            {request.participants.map((participant) => {
              const invitation = invitationsByParticipant.get(participant.id);
              const status = partyStatus(participant, invitation);
              const token = issuedTokens[participant.id];
              const needsResend = status.tone === "warn" || status.tone === "error";

              return (
                <div
                  key={participant.id}
                  className="space-y-2 rounded-medium border border-divider px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-body-2 text-on-surface">
                        {participant.roleFa}
                        {participant.nameFa ? ` — ${participant.nameFa}` : ""}
                      </p>
                      <p className="text-caption text-muted" dir="ltr">
                        {participant.mobileMasked}
                      </p>
                    </div>
                    <span className={`text-caption ${TONE_CLASS[status.tone]}`}>
                      {status.labelFa}
                    </span>
                  </div>

                  <p className="text-caption text-muted">
                    {participant.signedAt
                      ? `زمان امضا: ${formatIsoJalaliDateTime(participant.signedAt)}`
                      : invitation?.lastSentAt
                        ? `آخرین ارسال: ${formatIsoJalaliDateTime(invitation.lastSentAt)}`
                        : "هنوز ارسال نشده است."}
                  </p>

                  {token && needsResend && (
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="break-all text-caption text-muted" dir="ltr">
                        /contracts/sign/{token}
                      </code>
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<IconCopy className="w-3.5 h-3.5" />}
                        onClick={() => void copyLink(participant.id, token)}
                      >
                        {copiedParticipantId === participant.id ? "کپی شد" : "کپی لینک"}
                      </Button>
                    </div>
                  )}

                  {participant.status !== "SIGNED" && (
                    <div className="flex flex-wrap items-center gap-2">
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
                          void runResult(() =>
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
                      {(invitation || token) && (
                        <ActionButton
                          size="small"
                          variant="outlined"
                          idleLabel="ارسال مجدد لینک"
                          busyLabel="در حال ارسال…"
                          successLabel="لینک تازه صادر شد"
                          errorLabel="ارسال نشد — تلاش مجدد"
                          startIcon={<IconRefresh className="w-3.5 h-3.5" />}
                          disabled={issueInvitations.isPending || revokeInvitation.isPending}
                          onAction={() => resend(participant, invitation)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-caption text-muted">
              اسکن امضای دستی باید تصویر PNG یا JPEG باشد؛ همان تصویر، با حفظ نسبت، در جایگاه
              همین طرف روی نسخهٔ چاپی و PDF درج می‌شود. اگر کسی امضا نکرده باشد، جایگاه او
              «در انتظار امضا» چاپ می‌شود.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {partyPreview.map((party) => (
              <li
                key={party.role}
                className="flex flex-wrap items-center justify-between gap-2 rounded-medium border border-divider px-3 py-2"
              >
                <span className="text-body-2 text-on-surface">
                  {party.roleFa}
                  {party.nameFa ? ` — ${party.nameFa}` : ""}
                </span>
                <span className="text-caption text-muted">آمادهٔ ارسال به شمارهٔ ثبت‌شده</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* 3 — The stage's one committing action */}
      <SectionCard
        title="ارسال برای طرفین جهت امضا"
        description="لینک اختصاصی امضا برای هر طرف از طریق پیامک ارسال می‌شود"
      >
        {!request && !canPrepare && (
          <Notice tone="warning" title="هنوز امکان ارسال نیست">
            ارسال برای امضا پس از تثبیت نسخه و تأیید آن توسط لیگالیر فعال می‌شود. وضعیت تأیید را
            در مرحلهٔ بازبینی ببینید.
          </Notice>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-caption text-muted">
            {request
              ? `درخواست امضا در ${formatIsoJalaliDateTime(
                  request.createdAt
                )} ایجاد شد و به نسخهٔ ${toPersianNumber(
                  currentVersion?.versionNumber ?? 0
                )} گره خورده است.`
              : "این ارسال، نسخهٔ تثبیت‌شده را به هر طرف می‌فرستد و وضعیت هر طرف را جداگانه ثبت می‌کند."}
          </p>
          <Button
            type="button"
            startIcon={<IconSend className="w-4 h-4" />}
            onClick={() => setConfirmOpen(true)}
            disabled={sendDisabled || !canSendAgain}
          >
            ارسال برای طرفین جهت امضا
          </Button>
        </div>
      </SectionCard>

      {/* Confirmation — names and destinations before anything is sent */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="ارسال برای طرفین جهت امضا"
        description="پیش از ارسال، نام و شمارهٔ هر طرف را بررسی کنید."
        actions={
          <>
            <Button variant="text" onClick={() => setConfirmOpen(false)}>
              انصراف
            </Button>
            <ActionButton
              idleLabel="ارسال به همهٔ طرفین"
              busyLabel="در حال ارسال…"
              successLabel="لینک‌ها صادر شدند"
              errorLabel="ارسال نشد — تلاش مجدد"
              onAction={sendForSignature}
            />
          </>
        }
      >
        <ul className="space-y-2">
          {(request?.participants ?? []).length > 0
            ? request!.participants.map((participant) => (
                <li
                  key={participant.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-medium border border-divider px-3 py-2"
                >
                  <span className="text-body-2 text-on-surface">
                    {participant.roleFa}
                    {participant.nameFa ? ` — ${participant.nameFa}` : ""}
                  </span>
                  <span className="text-body-2 text-on-surface" dir="ltr">
                    {participant.mobile}
                  </span>
                </li>
              ))
            : partyPreview.map((party) => (
                <li
                  key={party.role}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-medium border border-divider px-3 py-2"
                >
                  <span className="text-body-2 text-on-surface">
                    {party.roleFa}
                    {party.nameFa ? ` — ${party.nameFa}` : ""}
                  </span>
                  <span className="text-body-2 text-on-surface" dir="ltr">
                    {party.mobile || "شماره ثبت نشده"}
                  </span>
                </li>
              ))}
        </ul>
        <p className="mt-3 text-caption text-muted">
          اگر ارسال پیامک ناموفق باشد، وضعیت همان طرف «ارسال ناموفق» نمایش داده می‌شود و لینک را
          می‌توانید به‌صورت دستی برای او بفرستید.
        </p>
      </Dialog>

      {/* Hidden picker for the wet-ink scan — one file, opened per participant.
          PNG/JPEG only: the scan is embedded into that party's own cell on the
          printed contract, and a PDF cannot be drawn there. */}
      <input
        ref={physicalInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadPhysical(file);
          setPhysicalTarget(null);
        }}
      />

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

      {/* The final version + note are what the parties sign — repeat the
          checkpoint after the send action so it is never out of sight. */}
      <p className="flex flex-wrap items-center gap-1.5 text-caption text-muted">
        <IconShield className="h-3.5 w-3.5" aria-hidden="true" />
        امضا به نسخهٔ تثبیت‌شده گره می‌خورد؛ هر تغییری پس از ارسال، نیازمند تثبیت نسخهٔ تازه و
        ارسال دوباره است.
        {request && totalParties > 0 && signedCount === totalParties && (
          <span className="inline-flex items-center gap-1 text-success">
            <IconCheck className="h-3.5 w-3.5" aria-hidden="true" />
            همهٔ طرفین امضا کرده‌اند.
          </span>
        )}
      </p>

      {/* What happens next — the only forward action on this stage. It is
          shown as a state, not a second set of signing buttons: the parties
          have already signed, so the remaining work belongs to the archive. */}
      <SectionCard
        title="مرحلهٔ بعد — نسخهٔ نهایی"
        description="پس از امضای همهٔ طرفین، نسخهٔ امضاشده در مرحلهٔ بعد قفل و بایگانی می‌شود"
      >
        {request && totalParties > 0 && signedCount === totalParties ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-body-2 text-success">
              همهٔ طرفین امضا کرده‌اند؛ نسخهٔ نهایی آمادهٔ بایگانی است.
            </p>
            <Button
              type="button"
              endIcon={<IconArrowForward className="w-4 h-4" />}
              onClick={() => goToStep("final")}
            >
              رفتن به نسخهٔ نهایی
            </Button>
          </div>
        ) : (
          <p className="text-body-2 text-muted">
            {request
              ? `${toPersianNumber(signedCount)} از ${toPersianNumber(
                  totalParties
                )} طرف امضا کرده‌اند؛ پس از تکمیل امضاها این مرحله باز می‌شود.`
              : "پس از ارسال درخواست امضا و امضای همهٔ طرفین، این مرحله فعال می‌شود."}
          </p>
        )}
      </SectionCard>
    </div>
  );
}
