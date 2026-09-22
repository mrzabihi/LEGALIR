// ============================================================
// LEGALIR — Settings · Account Closure (حذف حساب کاربری)
// ============================================================
// Real, irreversible account deletion. The user must pick a reason and
// type DELETE to confirm; the request hits DELETE /api/v1/account,
// which purges every user-scoped row and clears the session cookie.
// ============================================================

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TextField, Select } from "@legalir/ui";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SettingsCard } from "@/components/settings/settings-ui";
import { useDeleteAccount } from "@/hooks/useAccount";
import { IconWarning, IconDelete } from "@/lib/icons";

const CLOSURE_REASONS = [
  { value: "no-need", label: "دیگر نیاز ندارم" },
  { value: "privacy", label: "نگرانی حریم خصوصی" },
  { value: "quality", label: "کیفیت پایین خدمات" },
  { value: "financial", label: "دلایل مالی" },
  { value: "other", label: "سایر" },
] as const;

export default function AccountClosurePage() {
  const router = useRouter();
  const deleteAccount = useDeleteAccount();

  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");

  const canDelete = step === "confirm" && confirmText === "DELETE" && reason !== "";

  const handleDelete = useCallback(() => {
    if (!canDelete) return;
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        // Session cookie is cleared server-side; send the user home.
        router.push("/");
      },
    });
  }, [canDelete, deleteAccount, router]);

  const handleCancel = useCallback(() => {
    setStep("idle");
    setConfirmText("");
    setReason("");
  }, []);

  return (
    <SettingsShell
      title="حذف حساب کاربری"
      description="بستن دائمی حساب و حذف تمام داده‌های مرتبط."
    >
      <SettingsCard
        title="حذف حساب کاربری"
        icon={<IconWarning size={22} />}
        className="border-2 border-error/40"
      >
        <div className="rounded-lg bg-error/5 border border-error/20 p-4 mb-5">
          <p className="text-body-2 text-on-surface mb-1 font-medium">
            هشدار: این عملیات قابل بازگشت نیست
          </p>
          <p className="text-body-2 text-muted">
            با حذف حساب، تمام داده‌های شما از جمله قراردادها، تحلیل اسناد،
            تاریخچه گفتگوها و اطلاعات پروفایل به طور دائمی حذف خواهند شد. همچنین
            تمام اشتراک‌های فعال شما لغو شده و دسترسی به حساب برای همیشه مسدود
            می‌شود.
          </p>
        </div>

        <div className="space-y-4">
          <Select
            id="closure-reason"
            label="دلیل حذف حساب"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={deleteAccount.isPending}
            fullWidth
            placeholder="انتخاب دلیل..."
            options={CLOSURE_REASONS.map((r) => ({ value: r.value, label: r.label }))}
          />

          {step === "idle" && (
            <button
              type="button"
              onClick={() => setStep("confirm")}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-error/60 bg-error/5 px-5 py-2.5 text-body-2 text-error font-medium transition hover:bg-error/10"
            >
              <IconDelete size={16} />
              درخواست حذف حساب
            </button>
          )}

          {step === "confirm" && (
            <div className="rounded-lg border border-error/30 bg-error/5 p-4 space-y-3">
              <p className="text-body-2 text-error font-medium">
                برای تأیید، عبارت DELETE را تایپ کنید:
              </p>
              <TextField
                id="closure-confirm"
                type="text"
                label="عبارت تأیید"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                fullWidth
                inputDir="ltr"
                autoFocus
              />
              {deleteAccount.isError && (
                <p className="text-body-2 text-error">
                  {(deleteAccount.error as Error).message}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!canDelete || deleteAccount.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full bg-error px-5 py-2.5 text-body-2 text-on-error font-medium transition hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteAccount.isPending ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-on-error border-t-transparent" />
                  ) : (
                    <IconDelete size={16} />
                  )}
                  {deleteAccount.isPending ? "در حال حذف..." : "تأیید نهایی حذف حساب"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={deleteAccount.isPending}
                  className="rounded-full border border-divider px-4 py-2.5 text-body-2 text-on-surface transition hover:bg-surface-hover disabled:opacity-50"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingsCard>
    </SettingsShell>
  );
}
