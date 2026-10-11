"use client";

// ============================================================
// LEGALIR — Client review form
// ============================================================
// The client's review surface on a lawyer's profile. Eligibility is decided
// SERVER-SIDE (a completed engagement must exist) and fetched here — the form
// only renders when the server says the viewer may review:
//
//   · eligible, no review yet  → a fresh rating + comment form
//   · eligible, has a review   → the same form prefilled, framed as an edit,
//                                with the current moderation status shown
//   · not eligible             → the server's reason, no form
//
// The server re-checks eligibility AND the edit window on submit, so this
// component is a convenience, never the gate.
// ============================================================

import { useEffect, useState } from "react";
import { Button, Textarea, snackbar } from "@legalir/ui";
import { useLawyerReviewEligibility, useSubmitLawyerReview } from "@/hooks/useLawyers";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconCheckCircle, IconStar } from "@/lib/icons";
import { LAWYER_REVIEW_STATUS_FA, type LawyerReviewStatus } from "@legalir/types";

function Stars({
  value,
  onChange,
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1" role={readOnly ? undefined : "radiogroup"} aria-label="امتیاز">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= value;
        const cls = active ? "text-amber-500" : "text-divider";
        return readOnly ? (
          <IconStar key={n} size={18} className={cls} />
        ) : (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ستاره`}
            onClick={() => onChange?.(n)}
            className="rounded p-0.5 transition hover:scale-110"
          >
            <IconStar size={22} className={cls} />
          </button>
        );
      })}
    </div>
  );
}

export function LawyerReviewForm({ lawyerId }: { lawyerId: string }) {
  const eligibility = useLawyerReviewEligibility(lawyerId);
  const submit = useSubmitLawyerReview(lawyerId);

  const existing = eligibility.data?.existing ?? null;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  // Prefill from the viewer's own review once eligibility loads / changes.
  useEffect(() => {
    if (existing) {
      setRating(existing.rating);
      setComment(existing.comment);
    }
  }, [existing?.id, existing?.rating, existing?.comment]);

  if (eligibility.isLoading) {
    return <div className="h-24 animate-pulse rounded-xl bg-surface-container" />;
  }
  if (eligibility.isError || !eligibility.data) return null;

  // Not allowed to review and no review of their own → explain, do not offer.
  if (!eligibility.data.canReview && !existing) {
    return (
      <p className="rounded-xl bg-surface-container/60 px-4 py-3 text-body-2 text-muted">
        {eligibility.data.reason ?? "امکان ثبت نظر در حال حاضر وجود ندارد."}
      </p>
    );
  }

  const isEdit = Boolean(existing);
  const valid = rating >= 1 && rating <= 5 && comment.trim().length >= 3;

  async function handleSubmit() {
    const res = await submit.mutateAsync({ rating, comment: comment.trim() });
    snackbar.show({
      message: res.created
        ? "نظر شما ثبت شد و پس از بررسی منتشر می‌شود."
        : "نظر شما ویرایش شد.",
      variant: "success",
    });
  }

  // A review exists but is outside the edit window / rejected.
  if (!eligibility.data.canReview && existing) {
    return (
      <div className="space-y-2 rounded-xl border border-divider/60 bg-surface p-4">
        <div className="flex items-center justify-between">
          <Stars value={existing.rating} readOnly />
          <span className="text-caption text-muted">
            {LAWYER_REVIEW_STATUS_FA[existing.status as LawyerReviewStatus] ?? existing.status}
          </span>
        </div>
        <p className="text-body-2 text-muted">{existing.comment}</p>
        <p className="text-caption text-muted">{eligibility.data.reason}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-divider/60 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-2 font-medium text-on-surface">
          {isEdit ? "ویرایش نظر شما" : "ثبت نظر شما"}
        </p>
        {isEdit && existing && (
          <span className="text-caption text-muted">
            وضعیت فعلی:{" "}
            {LAWYER_REVIEW_STATUS_FA[existing.status as LawyerReviewStatus] ?? existing.status}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Stars value={rating} onChange={setRating} />
        <span className="text-caption text-muted">
          {rating > 0 ? `${toPersianNumber(rating)} از ۵` : "امتیاز را انتخاب کنید"}
        </span>
      </div>

      <Textarea
        id="lawyer-review-comment"
        label="توضیحات"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="تجربهٔ خود از این مشاوره را بنویسید…"
        fullWidth
      />

      {isEdit && existing?.editableUntil && (
        <p className="text-caption text-muted">
          ویرایش تا ۳۰ روز پس از ثبت امکان‌پذیر است.
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-muted">
          {isEdit
            ? "پس از ویرایش، نظر شما دوباره بررسی می‌شود."
            : "نظر شما پس از بررسی توسط تیم پشتیبانی منتشر می‌شود."}
        </p>
        <Button
          onClick={handleSubmit}
          loading={submit.isPending}
          disabled={!valid}
          startIcon={isEdit ? undefined : <IconCheckCircle size={18} />}
        >
          {isEdit ? "ثبت ویرایش" : "ثبت نظر"}
        </Button>
      </div>
    </div>
  );
}
