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

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Chip, Dialog, OTPInput, ProgressLinear, Textarea } from "@legalir/ui";
import {
  IconCheck,
  IconChat,
  IconDownload,
  IconFileText,
  IconLawBook,
  IconShield,
  IconWarning,
} from "@/lib/icons";
import { useWizard } from "../wizard-context";
import { SectionCard, Notice } from "../primitives";
import { LivePreview } from "../live-preview";
import { LifecycleStepper } from "../lifecycle-stepper";
import { getContractDefinition } from "@/lib/contracts/registry";
import { stateLabelFa } from "@/lib/contracts/state-machine";
import { formatIsoJalali } from "@/lib/contracts/dates";
import { useFinalizeContract, useSubmitForReview } from "@/hooks/usePropertyContracts";
import {
  useAcceptLawyerReview,
  useAddReviewComment,
  useCancelLawyerReview,
  useCompleteLawyerReview,
  useContractLifecycle,
  useCreateAiReview,
  useCreateLawyerReview,
  useCreateSignatureRequest,
  useDecideLawyerFinding,
  useDeclineSignature,
  useRequestSignatureOtp,
  useVerifySignatureOtp,
} from "@/hooks/useContractLifecycle";
import { contractPdfUrl, contractDocxUrl } from "@/lib/api/property-contracts";
import type {
  LawyerReviewFindingSeverity,
  SignatureParticipant,
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

export function ReviewStep() {
  const router = useRouter();
  const { contract, data, parties, payments, completeness } = useWizard();
  const def = getContractDefinition(contract.type);

  const lifecycle = useContractLifecycle(contract.id);
  const view = lifecycle.data;

  const prepare = useCreateSignatureRequest();
  const requestOtp = useRequestSignatureOtp();
  const verifyOtp = useVerifySignatureOtp();
  const decline = useDeclineSignature();
  const createLawyer = useCreateLawyerReview();
  const acceptLawyer = useAcceptLawyerReview();
  const completeLawyer = useCompleteLawyerReview();
  const decideFinding = useDecideLawyerFinding();
  const cancelLawyer = useCancelLawyerReview();
  const createAi = useCreateAiReview();
  const addComment = useAddReviewComment();
  const finalize = useFinalizeContract();
  const submit = useSubmitForReview();

  const [actionError, setActionError] = useState<string | null>(null);
  const [signTarget, setSignTarget] = useState<SignatureParticipant | null>(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [mobileMasked, setMobileMasked] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [commentBody, setCommentBody] = useState("");

  const currentVersion = contract.versions.find((v) => v.id === contract.currentVersionId);
  const request = view?.signatureRequest ?? null;
  const lawyerReview = view?.lawyerReview ?? null;
  const aiReview = view?.aiReview ?? null;
  const comments = view?.comments ?? [];

  const signedParticipantIds = useMemo(
    () =>
      new Set(
        (request?.participants ?? []).filter((p) => p.status === "SIGNED").map((p) => p.id)
      ),
    [request]
  );

  async function run(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "عملیات ناموفق بود");
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
      setMobileMasked(res.mobileMasked);
      setSignTarget(participant);
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
                        امضا شده
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
            دیجیتال رسمی» یکسان نیست.
          </p>
        </SectionCard>
      )}

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
      <SectionCard title="نظرها و درخواست‌های اصلاح" description="روی نسخه جاری">
        {comments.length > 0 ? (
          <div className="space-y-2">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-medium border border-divider p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-labelLarge text-on-surface">{comment.authorLabelFa}</span>
                  <span className="text-caption text-muted">
                    {formatIsoJalali(comment.createdAt.slice(0, 10))}
                  </span>
                </div>
                <p className="mt-1 text-body-2 text-on-surface whitespace-pre-line">
                  {comment.body}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-body-2 text-muted">هنوز نظری ثبت نشده است.</p>
        )}

        <div className="mt-3 space-y-2">
          <Textarea
            label="نظر یا درخواست اصلاح"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            rows={3}
            placeholder="نظر یا درخواست اصلاح خود را بنویسید…"
            fullWidth
          />
          <Button
            size="small"
            disabled={!commentBody.trim() || !contract.currentVersionId}
            loading={addComment.isPending}
            onClick={() =>
              void run(async () => {
                await addComment.mutateAsync({ id: contract.id, body: commentBody.trim() });
                setCommentBody("");
              })
            }
          >
            ثبت نظر
          </Button>
        </div>
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
        <LivePreview contract={{ ...contract, data }} parties={parties} payments={payments} />
      </div>

      {/* OTP dialog — consent is explicit, never prechecked */}
      <Dialog
        open={signTarget !== null}
        onClose={() => setSignTarget(null)}
        title="تأیید و امضای الکترونیکی"
        description={
          mobileMasked ? `کد تأیید به شماره ${mobileMasked} ارسال شد.` : "کد تأیید ارسال شد."
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
