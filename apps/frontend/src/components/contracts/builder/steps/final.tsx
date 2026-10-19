// ============================================================
// LEGALIR — Wizard step: final copy (نسخه نهایی)
// ============================================================
// The fourth and last stage of the closing flow:
//
//   ۱ تکمیل اطلاعات تکمیلی → ۲ بازبینی و پیش‌نمایش
//   → ۳ امضای طرفین → ۴ نسخه نهایی
//
// This stage owns NO editable data. It is the archive: it finalises the
// signed version, then exposes the immutable PDF/Word and the public
// verification page. Every fact comes from the server's lifecycle view —
// the button can only claim «نهایی شد» after the finalize route accepted
// the request, and the artefacts appear only for a stored final version.
// ============================================================

"use client";

import React, { useState } from "react";
import { Button } from "@legalir/ui";
import {
  IconArrowBack,
  IconCheckCircle,
  IconDownload,
  IconFileText,
  IconShield,
} from "@/lib/icons";
import { useWizard } from "../wizard-context";
import { ActionButton, Notice, SectionCard } from "../primitives";
import { useContractLifecycle } from "@/hooks/useContractLifecycle";
import { useFinalizeContract } from "@/hooks/usePropertyContracts";
import { contractDocxUrl, contractPdfUrl } from "@/lib/api/property-contracts";
import { formatIsoJalali, formatIsoJalaliDateTime } from "@/lib/contracts/dates";
import { toPersianNumber } from "@/lib/persian-utils";
import { SIGNATURE_PARTICIPANT_STATUS_FA } from "@legalir/types";

export function FinalStep() {
  const { contract, goToStep } = useWizard();
  const lifecycle = useContractLifecycle(contract.id);
  const view = lifecycle.data;
  const finalize = useFinalizeContract();
  const [actionError, setActionError] = useState<string | null>(null);

  const request = view?.signatureRequest ?? null;
  const finalVersion =
    contract.versions.find((v) => v.id === contract.finalVersionId) ??
    contract.versions.find((v) => v.id === contract.currentVersionId) ??
    null;

  const finalized = contract.state === "FINALIZED" || contract.state === "ARCHIVED";
  const signed = request?.participants.filter((p) => p.status === "SIGNED") ?? [];
  const total = request?.participants.length ?? 0;
  const allSigned = total > 0 && signed.length === total;

  async function finalizeNow(): Promise<boolean> {
    setActionError(null);
    try {
      await finalize.mutateAsync(contract.id);
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "نهایی‌سازی ناموفق بود.");
      return false;
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {actionError && <Notice tone="error">{actionError}</Notice>}

      <SectionCard
        title="وضعیت نسخهٔ نهایی"
        description="این نسخه پس از امضای همهٔ طرفین قفل و بایگانی می‌شود"
      >
        <ul className="space-y-2 text-body-2 text-on-surface">
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>نسخهٔ نهایی</span>
            <span className="font-medium">
              {finalVersion
                ? `نسخه ${toPersianNumber(finalVersion.versionNumber)} — ${formatIsoJalali(
                    finalVersion.createdAt.slice(0, 10)
                  )}`
                : "هنوز نسخه‌ای تثبیت نشده است"}
            </span>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>امضای طرفین</span>
            <span className="font-medium">
              {total > 0
                ? `${toPersianNumber(signed.length)} از ${toPersianNumber(total)} طرف`
                : "درخواست امضا هنوز ایجاد نشده است"}
            </span>
          </li>
          {contract.finalizedAt && (
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span>زمان نهایی‌سازی</span>
              <span className="font-medium">{formatIsoJalaliDateTime(contract.finalizedAt)}</span>
            </li>
          )}
          {request?.participants.map((participant) => (
            <li
              key={participant.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-2"
            >
              <span>
                {participant.roleFa}
                {participant.nameFa ? ` — ${participant.nameFa}` : ""}
              </span>
              <span
                className={participant.status === "SIGNED" ? "text-success" : "text-muted"}
              >
                {SIGNATURE_PARTICIPANT_STATUS_FA[participant.status]}
                {participant.signedAt
                  ? ` — ${formatIsoJalaliDateTime(participant.signedAt)}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="نهایی‌سازی"
        description="پس از امضای همهٔ طرفین و تأیید نسخه، نسخهٔ غیرقابل‌تغییر بایگانی می‌شود"
      >
        {finalized ? (
          <div className="space-y-3">
            <p className="inline-flex items-center gap-1.5 text-body-2 text-success">
              <IconCheckCircle className="h-4 w-4" aria-hidden="true" />
              این قرارداد نهایی و بایگانی شده است.
            </p>
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
                <IconShield className="w-4 h-4" />
                صفحهٔ تأیید عمومی
              </a>
            </div>
          </div>
        ) : view?.canFinalize ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-caption text-muted">
              همهٔ طرفین امضا کرده‌اند و نسخهٔ امضاشده تأیید شده است.
            </p>
            <ActionButton
              idleLabel="نهایی‌سازی قرارداد"
              busyLabel="در حال نهایی‌سازی…"
              successLabel="قرارداد نهایی شد"
              errorLabel="نهایی‌سازی ناموفق — تلاش مجدد"
              onAction={finalizeNow}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Notice tone="info" title="هنوز آمادهٔ نهایی‌سازی نیست">
              نهایی‌سازی پس از امضای همهٔ طرفین و تأیید نسخهٔ امضاشده، فعال می‌شود.
              {total > 0 && !allSigned
                ? ` در حال حاضر ${toPersianNumber(signed.length)} از ${toPersianNumber(
                    total
                  )} طرف امضا کرده‌اند.`
                : ""}
            </Notice>
            <Button
              type="button"
              variant="outlined"
              size="small"
              startIcon={<IconArrowBack className="w-4 h-4" />}
              onClick={() => goToStep("signature")}
            >
              بازگشت به امضای طرفین
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
