// ============================================================
// LEGALIR — Contract Action Buttons (Phase 10)
// ============================================================

"use client";

import type { V1ContractState } from "@legalir/types";
import { V1_CONTRACT_STATE_TRANSITIONS } from "@legalir/types";
import { useUpdateContract, useArchiveContract, useGenerateContract } from "@/hooks/useContracts";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@legalir/ui";

interface ContractActionsProps {
  contractId: string;
  state: V1ContractState;
  onGenerateNewVersion?: () => void;
}

export function ContractActions({
  contractId,
  state,
  onGenerateNewVersion,
}: ContractActionsProps) {
  const router = useRouter();
  const updateContract = useUpdateContract();
  const archiveContract = useArchiveContract();
  const generateContract = useGenerateContract();

  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const transitions = V1_CONTRACT_STATE_TRANSITIONS[state] ?? [];

  async function handleStateChange(newState: V1ContractState) {
    setActionError(null);
    try {
      await updateContract.mutateAsync({ id: contractId, state: newState });
    } catch (err) {
      setActionError((err as Error)?.message ?? "خطا در تغییر وضعیت");
    }
  }

  async function handleArchive() {
    setActionError(null);
    try {
      await archiveContract.mutateAsync(contractId);
      setConfirmingArchive(false);
      router.refresh();
    } catch (err) {
      setActionError((err as Error)?.message ?? "خطا در بایگانی قرارداد");
    }
  }

  async function handleRegenerate() {
    setActionError(null);
    try {
      await generateContract.mutateAsync(contractId);
      router.refresh();
    } catch (err) {
      setActionError((err as Error)?.message ?? "خطا در بازتولید قرارداد");
    }
  }

  return (
    <div className="space-y-3" dir="rtl">
      {actionError && (
        <div className="rounded-medium bg-error-container text-error p-3 text-caption" role="alert">
          {actionError}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmingArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="تأیید بایگانی">
          <div className="bg-surface rounded-large p-6 max-w-sm w-full shadow-elevation-3">
            <h4 className="text-h4 text-on-surface mb-2">بایگانی قرارداد</h4>
            <p className="text-body-2 text-muted mb-4">
              آیا از بایگانی این قرارداد اطمینان دارید؟ این عمل قابل بازگشت نیست.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setConfirmingArchive(false)}
                disabled={archiveContract.isPending}
              >
                انصراف
              </Button>
              <Button
                variant="danger"
                onClick={handleArchive}
                loading={archiveContract.isPending}
              >
                بایگانی
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* State Transitions */}
        {transitions.includes("under_review") && (
          <Button
            onClick={() => handleStateChange("under_review")}
            loading={updateContract.isPending}
          >
            ارسال برای بررسی
          </Button>
        )}

        {transitions.includes("approved") && (
          <Button
            onClick={() => handleStateChange("approved")}
            loading={updateContract.isPending}
          >
            تأیید نهایی
          </Button>
        )}

        {transitions.includes("exported") && (
          <Button
            onClick={() => handleStateChange("exported")}
            loading={updateContract.isPending}
          >
            خروجی Word/PDF
          </Button>
        )}

        {transitions.includes("generated") && (
          <Button
            onClick={handleRegenerate}
            loading={generateContract.isPending}
          >
            بازتولید پیش‌نویس
          </Button>
        )}

        {transitions.includes("collecting") && (
          <Button onClick={() => onGenerateNewVersion?.()}>
            ویرایش و نسخه جدید
          </Button>
        )}

        {transitions.includes("draft") && (
          <Button variant="outlined" onClick={() => onGenerateNewVersion?.()}>
            ویرایش پیش‌نویس
          </Button>
        )}

        {transitions.includes("archived") && (
          <Button
            variant="danger-outlined"
            onClick={() => setConfirmingArchive(true)}
            disabled={archiveContract.isPending}
          >
            بایگانی
          </Button>
        )}
      </div>
    </div>
  );
}
