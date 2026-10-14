"use client";

// ============================================================
// LEGALIR — Report a review
// ============================================================
// A small inline control that lets any signed-in viewer flag an inappropriate
// review. It expands to a reason field, collects a mandatory reason, and
// POSTs it. Filing is idempotent server-side (one open report per user), so a
// double submit never piles up duplicates.
// ============================================================

import { useState } from "react";
import { Button, Textarea, snackbar } from "@legalir/ui";
import { useReportLawyerReview } from "@/hooks/useLawyers";
import { IconWarning } from "@/lib/icons";

export function ReviewReportControl({ lawyerId, reviewId }: { lawyerId: string; reviewId: string }) {
  const report = useReportLawyerReview(lawyerId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return <span className="text-caption text-muted">گزارش شما ثبت شد.</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-caption text-muted transition hover:text-error"
      >
        <IconWarning size={13} />
        گزارش تخلف
      </button>
    );
  }

  async function submit() {
    if (reason.trim().length < 3) return;
    try {
      await report.mutateAsync({ reviewId, reason: reason.trim() });
      setDone(true);
      snackbar.show({ message: "گزارش تخلف ثبت شد و بررسی می‌شود.", variant: "success" });
    } catch (e) {
      snackbar.show({
        message: e instanceof Error ? e.message : "ثبت گزارش ناموفق بود",
        variant: "error",
      });
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-medium border border-divider bg-surface-container p-3">
      <Textarea
        id={`report-${reviewId}`}
        label="دلیل گزارش"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="چرا این نظر نامناسب است؟"
        fullWidth
      />
      <div className="flex justify-end gap-2">
        <Button variant="text" size="small" onClick={() => setOpen(false)}>
          انصراف
        </Button>
        <Button
          variant="filled"
          size="small"
          loading={report.isPending}
          disabled={reason.trim().length < 3}
          onClick={submit}
        >
          ثبت گزارش
        </Button>
      </div>
    </div>
  );
}
