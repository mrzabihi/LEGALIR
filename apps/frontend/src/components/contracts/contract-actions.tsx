// ============================================================
// LEGALIR — Contract Action Buttons (Phase 10)
// ============================================================

"use client";

import type { V1ContractState } from "@legalir/types";
import { V1_CONTRACT_STATE_TRANSITIONS } from "@legalir/types";
import { useUpdateContract, useArchiveContract, useGenerateContract } from "@/hooks/useContracts";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
              <button
                onClick={() => setConfirmingArchive(false)}
                className="rounded-medium bg-surface-container text-on-surface px-4 py-2 text-button touch-target border border-divider"
              >
                انصراف
              </button>
              <button
                onClick={handleArchive}
                className="rounded-medium bg-error text-white px-4 py-2 text-button touch-target"
              >
                بایگانی
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* State Transitions */}
        {transitions.includes("under_review") && (
          <button
            onClick={() => handleStateChange("under_review")}
            disabled={updateContract.isPending}
            className="rounded-medium bg-purple-600 text-white px-4 py-2 text-button touch-target disabled:opacity-50"
          >
            ارسال برای بررسی
          </button>
        )}

        {transitions.includes("approved") && (
          <button
            onClick={() => handleStateChange("approved")}
            disabled={updateContract.isPending}
            className="rounded-medium bg-green-600 text-white px-4 py-2 text-button touch-target disabled:opacity-50"
          >
            تأیید نهایی
          </button>
        )}

        {transitions.includes("exported") && (
          <button
            onClick={() => handleStateChange("exported")}
            disabled={updateContract.isPending}
            className="rounded-medium bg-teal-600 text-white px-4 py-2 text-button touch-target disabled:opacity-50"
          >
            خروجی Word/PDF
          </button>
        )}

        {transitions.includes("generated") && (
          <button
            onClick={handleRegenerate}
            disabled={generateContract.isPending}
            className="rounded-medium bg-blue-600 text-white px-4 py-2 text-button touch-target disabled:opacity-50"
          >
            بازتولید پیش‌نویس
          </button>
        )}

        {transitions.includes("collecting") && (
          <button
            onClick={() => onGenerateNewVersion?.()}
            className="rounded-medium bg-amber-600 text-white px-4 py-2 text-button touch-target"
          >
            ویرایش و نسخه جدید
          </button>
        )}

        {transitions.includes("draft") && (
          <button
            onClick={() => onGenerateNewVersion?.()}
            className="rounded-medium bg-surface-container text-on-surface px-4 py-2 text-button touch-target border border-divider"
          >
            ویرایش پیش‌نویس
          </button>
        )}

        {transitions.includes("archived") && (
          <button
            onClick={() => setConfirmingArchive(true)}
            disabled={archiveContract.isPending}
            className="rounded-medium bg-surface-container text-muted px-4 py-2 text-button touch-target border border-divider disabled:opacity-50"
          >
            بایگانی
          </button>
        )}
      </div>
    </div>
  );
}
