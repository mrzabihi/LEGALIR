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

import React, { useMemo, useState } from "react";
import { Button, Dialog } from "@legalir/ui";
import {
  IconArrowBack,
  IconCheck,
  IconCopy,
  IconFileText,
  IconRefresh,
  IconSend,
  IconShield,
} from "@/lib/icons";
import { useWizard } from "../wizard-context";
import { SectionCard, Notice } from "../primitives";
import { getContractDefinition, partyRoleLabelFa } from "@/lib/contracts/registry";
import { formatIsoJalali, formatIsoJalaliDateTime } from "@/lib/contracts/dates";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  useContractLifecycle,
  useCreateSignatureRequest,
  useIssueInvitations,
  useRevokeInvitation,
} from "@/hooks/useContractLifecycle";
import type { SignatureInvitation, SignatureParticipant } from "@legalir/types";

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

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [issuedTokens, setIssuedTokens] = useState<Record<string, string>>({});
  const [copiedParticipantId, setCopiedParticipantId] = useState<string | null>(null);

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

  async function run(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "عملیات ناموفق بود");
    }
  }

  /**
   * The one committing action of this stage. It creates the request (if
   * this is the first send) and then issues the invitations for every
   * participant. Both steps are server-authorised; a refusal is shown.
   */
  async function sendForSignature() {
    await run(async () => {
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

  async function resend(
    participant: SignatureParticipant,
    invitation: SignatureInvitation | undefined
  ) {
    await run(async () => {
      if (invitation && invitation.status === "ACTIVE") {
        await revokeInvitation.mutateAsync({ id: contract.id, invitationId: invitation.id });
      }
      const res = await issueInvitations.mutateAsync({
        id: contract.id,
        participantIds: [participant.id],
      });
      const tokens: Record<string, string> = {};
      for (const item of res.invitations) tokens[item.participantId] = item.token;
      setIssuedTokens((prev) => ({ ...prev, ...tokens }));
    });
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

                  {(invitation || token) && participant.status !== "SIGNED" && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<IconRefresh className="w-3.5 h-3.5" />}
                      onClick={() => void resend(participant, invitation)}
                      disabled={issueInvitations.isPending || revokeInvitation.isPending}
                    >
                      ارسال مجدد لینک
                    </Button>
                  )}
                </div>
              );
            })}
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
            loading={prepare.isPending || issueInvitations.isPending}
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
            <Button
              onClick={() => void sendForSignature()}
              loading={prepare.isPending || issueInvitations.isPending}
            >
              ارسال به همهٔ طرفین
            </Button>
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
    </div>
  );
}
