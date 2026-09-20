// ============================================================
// LEGALIR — Wizard step: review, approval, signature, finalize
// ============================================================
// The last step is the whole lifecycle after the data is complete:
//
//   submit  → freeze the content as an immutable version
//   approve → bind each party's approval to THAT version
//   sign    → OTP-verified signature, also bound to the version
//   finalize→ immutable PDF + hash + public verification id
//
// Every action is gated on the server's own state machine; this
// component only decides what to *offer*, never what is allowed.
// The registration outcome is read from the policy engine, so the
// "finalized ≠ ownership transferred" rule is never re-stated here.
// ============================================================

"use client";

import React, { useState } from "react";
import { Button, Dialog, OTPInput, ProgressLinear } from "@legalir/ui";
import { IconCheck, IconDownload, IconShield } from "@/lib/icons";
import { useWizard } from "../wizard-context";
import { SectionCard, Notice } from "../primitives";
import { LivePreview } from "../live-preview";
import { getContractDefinition, partyRoleLabelFa } from "@/lib/contracts/registry";
import { formatIsoJalali } from "@/lib/contracts/dates";
import {
  useApproveContract,
  useFinalizeContract,
  useRequestChanges,
  useRequestSignOtp,
  useSubmitForReview,
  useVerifySignOtp,
} from "@/hooks/usePropertyContracts";
import { contractPdfUrl } from "@/lib/api/property-contracts";
import type { PropertyContractState } from "@legalir/types";

const STATE_LABELS: Record<PropertyContractState, string> = {
  DRAFT: "پیش‌نویس",
  PARTIES_PENDING: "در انتظار اطلاعات طرفین",
  PROPERTY_PENDING: "در انتظار مشخصات ملک",
  DOCUMENTS_PENDING: "در انتظار مدارک",
  TERMS_PENDING: "در انتظار شرایط مالی",
  READY_FOR_REVIEW: "آماده بررسی",
  COUNTERPARTY_REVIEW: "نزد طرف مقابل",
  CHANGES_REQUESTED: "درخواست اصلاح",
  READY_TO_SIGN: "آماده امضا",
  PARTIALLY_SIGNED: "امضای ناقص",
  SIGNED: "امضا شده",
  READY_FOR_OFFICIAL_REGISTRATION: "نیازمند ثبت رسمی",
  FINALIZED: "نهایی‌شده",
  CANCELLED: "لغو‌شده",
  ARCHIVED: "بایگانی‌شده",
};

export function ReviewStep() {
  const { contract, data, parties, payments, completeness, state, editable } = useWizard();
  const def = getContractDefinition(contract.type);

  const submit = useSubmitForReview();
  const approve = useApproveContract();
  const requestChanges = useRequestChanges();
  const requestOtp = useRequestSignOtp();
  const verifyOtp = useVerifySignOtp();
  const finalize = useFinalizeContract();

  const [signOpen, setSignOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [mobileMasked, setMobileMasked] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentVersion = contract.versions.find((v) => v.id === contract.currentVersionId);
  const approvalsForCurrent = contract.approvals.filter(
    (a) => a.contractVersionId === contract.currentVersionId && a.status === "approved"
  );
  const signedPartyIds = new Set(approvalsForCurrent.map((a) => a.partyId));

  const canSubmit = completeness.blockers.length === 0 && editable;
  const canApprove = state === "READY_FOR_REVIEW" || state === "COUNTERPARTY_REVIEW";
  const canSign = state === "READY_TO_SIGN" || state === "PARTIALLY_SIGNED";
  const canFinalize = state === "SIGNED" || state === "READY_FOR_OFFICIAL_REGISTRATION";
  const isFinalized = state === "FINALIZED" || state === "ARCHIVED";

  async function run(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "عملیات ناموفق بود");
    }
  }

  async function openSign() {
    setOtp("");
    setOtpError(null);
    await run(async () => {
      const res = await requestOtp.mutateAsync({ id: contract.id });
      setMobileMasked(res.mobileMasked);
      setSignOpen(true);
    });
  }

  async function confirmSign() {
    setOtpError(null);
    try {
      await verifyOtp.mutateAsync({ id: contract.id, code: otp });
      setSignOpen(false);
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : "کد وارد‌شده صحیح نیست");
    }
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="rounded-large border border-divider bg-surface p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-caption text-muted">وضعیت قرارداد</p>
            <p className="text-titleMedium text-on-surface">{STATE_LABELS[state]}</p>
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
      </div>

      {actionError && <Notice tone="error">{actionError}</Notice>}

      {/* Completeness blockers */}
      {completeness.blockers.length > 0 && (
        <Notice tone="warning" title="پیش از ارسال به بررسی">
          این بخش‌ها هنوز کامل نشده‌اند: {completeness.blockers.map((b) => b.labelFa).join("، ")}
        </Notice>
      )}

      {/* Lifecycle actions */}
      <SectionCard title="گردش کار قرارداد" description="ارسال، تأیید، امضا و نهایی‌سازی">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void run(() => submit.mutateAsync(contract.id))}
            disabled={!canSubmit}
            loading={submit.isPending}
          >
            ارسال برای بررسی
          </Button>
          <Button
            variant="tonal"
            onClick={() => void run(() => approve.mutateAsync({ id: contract.id }))}
            disabled={!canApprove}
            loading={approve.isPending}
          >
            تأیید نسخه جاری
          </Button>
          <Button
            variant="outlined"
            onClick={() =>
              void run(() =>
                requestChanges.mutateAsync({ id: contract.id, comment: "نیازمند اصلاح" })
              )
            }
            disabled={!canApprove}
            loading={requestChanges.isPending}
          >
            درخواست اصلاح
          </Button>
          <Button
            variant="tonal"
            startIcon={<IconShield className="w-4 h-4" />}
            onClick={() => void openSign()}
            disabled={!canSign}
            loading={requestOtp.isPending}
          >
            امضا با کد یک‌بارمصرف
          </Button>
          <Button
            onClick={() => void run(() => finalize.mutateAsync(contract.id))}
            disabled={!canFinalize}
            loading={finalize.isPending}
          >
            نهایی‌سازی قرارداد
          </Button>
        </div>

        {/* Party approval / signature status */}
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2 mt-2">
          {def.roles.map((role) => {
            const party = parties.find((p) => p.role === role);
            const signed = party ? signedPartyIds.has(party.id) : false;
            return (
              <div
                key={role}
                className="rounded-medium border border-divider px-3 py-2.5 flex items-center justify-between gap-2"
              >
                <span className="text-body-2 text-on-surface">{partyRoleLabelFa(role)}</span>
                {signed ? (
                  <span className="text-caption text-success inline-flex items-center gap-1">
                    <IconCheck className="w-3.5 h-3.5" />
                    تأیید/امضا شده
                  </span>
                ) : (
                  <span className="text-caption text-muted">در انتظار</span>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Finalized artifact */}
      {isFinalized && (
        <SectionCard title="سند نهایی" description="نسخه غیرقابل‌تغییر قرارداد">
          <div className="space-y-2">
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
                href={`/contracts/verify/${contract.publicVerificationId}`}
                className="inline-flex items-center gap-1.5 rounded-medium border border-outline px-4 h-10 text-labelLarge text-primary hover:state-hover"
              >
                صفحه تأیید عمومی
              </a>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Registration policy — never hard-coded */}
      <Notice tone="info" title="ثبت رسمی">
        {def.registrationPolicy.explanationFa}
      </Notice>

      {/* Live preview — same engine as the snapshot and the PDF */}
      <div>
        <h3 className="text-titleMedium text-on-surface mb-2">پیش‌نمایش قرارداد</h3>
        <LivePreview contract={{ ...contract, data }} parties={parties} payments={payments} />
      </div>

      {/* OTP dialog */}
      <Dialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        title="امضای قرارداد"
        description={
          mobileMasked ? `کد تأیید به شماره ${mobileMasked} ارسال شد.` : "کد تأیید ارسال شد."
        }
        actions={
          <>
            <Button variant="text" onClick={() => setSignOpen(false)}>
              انصراف
            </Button>
            <Button
              onClick={() => void confirmSign()}
              disabled={otp.length !== 6}
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
          <p className="text-caption text-muted">
            کد یک‌بارمصرف به شماره موبایل ثبت‌شده ارسال می‌شود و پس از پنج دقیقه منقضی می‌گردد.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
