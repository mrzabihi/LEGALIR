// ============================================================
// LEGALIR — Lawyer availability & CTA derivation
// ============================================================
// Availability STATUS and consultation CAPACITY are two independent
// signals and are kept separate here on purpose:
//
//   status   → "can this lawyer take a new request at all?"
//   capacity → "how many consultation slots are left?"
//
// A lawyer can be ACTIVE with 2 slots left, or ACTIVE with LIMITED
// intake. The booking system needs both, so the card renders both.
//
// All copy is derived from data — nothing is hard-coded per lawyer.
// ============================================================

import type { LawyerAvailabilityStatus } from "@legalir/types";
import { toPersianNumber } from "@/lib/persian-utils";

/**
 * Visual tone for a status dot. Calm by design — the only red is
 * `rejected`, reserved for a lawyer removed by LEGALIR review.
 */
export type AvailabilityTone = "positive" | "caution" | "neutral" | "muted" | "rejected";

export interface AvailabilityView {
  status: LawyerAvailabilityStatus;
  /** Short label for the status dot row, e.g. «فعال». */
  label: string;
  /** Optional capacity line, e.g. «۱۰ ظرفیت مشاوره باز». */
  capacityLabel: string | null;
  tone: AvailabilityTone;
  /** Whether a new consultation request can be sent. */
  canRequest: boolean;
  /** Primary CTA label, already matched to the status. */
  ctaLabel: string;
}

const STATUS_LABEL: Record<LawyerAvailabilityStatus, string> = {
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  FULL: "ظرفیت تکمیل",
  LIMITED: "ظرفیت محدود",
  AVAILABLE_SLOTS: "فعال",
  REJECTED: "Rejected",
};

const STATUS_TONE: Record<LawyerAvailabilityStatus, AvailabilityTone> = {
  ACTIVE: "positive",
  AVAILABLE_SLOTS: "positive",
  LIMITED: "caution",
  FULL: "neutral",
  INACTIVE: "muted",
  REJECTED: "rejected",
};

/**
 * The reason line shown under a REJECTED status. Kept here (not in the
 * card) so every surface that renders the status shows the same wording.
 */
export const REJECTED_REASON_FA = "رد شده توسط کانون وکلای لیگالیر";

/**
 * Capacity copy. `null` capacity means unlimited/unknown — the card then
 * shows only the status. `0` is treated as full regardless of status.
 */
function capacityLabel(
  status: LawyerAvailabilityStatus,
  capacity: number | null
): string | null {
  // A rejected lawyer has no intake at all, and the reason is rendered once
  // in the card's CTA block — so the badge shows no capacity line.
  if (status === "REJECTED") return null;
  if (capacity === null) return null;
  if (capacity <= 0) return "ظرفیت تکمیل";
  if (status === "LIMITED") return `${toPersianNumber(capacity)} ظرفیت باقی‌مانده`;
  return `${toPersianNumber(capacity)} ظرفیت مشاوره باز`;
}

/** Primary CTA label per status. Disabled states read as explanations. */
function ctaLabel(status: LawyerAvailabilityStatus): string {
  switch (status) {
    case "ACTIVE":
    case "AVAILABLE_SLOTS":
      return "درخواست مشاوره";
    case "LIMITED":
      return "ارسال درخواست";
    case "FULL":
      return "ظرفیت تکمیل";
    case "INACTIVE":
      return "در حال حاضر در دسترس نیست";
    case "REJECTED":
      return "حذف شده از فهرست";
  }
}

/** Statuses that would otherwise invite a request. */
const REQUESTABLE: ReadonlySet<LawyerAvailabilityStatus> = new Set([
  "ACTIVE",
  "AVAILABLE_SLOTS",
  "LIMITED",
]);

/**
 * Derive the full availability view for a lawyer card.
 *
 * `acceptingRequests` is the legacy boolean. When it is false we downgrade
 * a *requestable* status to INACTIVE so the CTA can never invite a request
 * the backend would reject — but an explicit FULL/INACTIVE status is kept
 * as-is, so «ظرفیت تکمیل» is never mislabelled «غیرفعال».
 */
export function availabilityView(
  status: LawyerAvailabilityStatus,
  capacity: number | null,
  acceptingRequests: boolean
): AvailabilityView {
  const effective: LawyerAvailabilityStatus =
    !acceptingRequests && REQUESTABLE.has(status) ? "INACTIVE" : status;
  const canRequest = REQUESTABLE.has(effective);

  return {
    status: effective,
    label: STATUS_LABEL[effective],
    capacityLabel: capacityLabel(effective, capacity),
    tone: STATUS_TONE[effective],
    canRequest,
    ctaLabel: ctaLabel(effective),
  };
}

/** Tailwind classes for the status dot, keyed by tone. */
export const TONE_DOT_CLASS: Record<AvailabilityTone, string> = {
  positive: "bg-success",
  caution: "bg-warning",
  neutral: "bg-on-surface-variant/50",
  muted: "bg-on-surface-variant/30",
  rejected: "bg-error",
};

/** Tailwind classes for the status text, keyed by tone. */
export const TONE_TEXT_CLASS: Record<AvailabilityTone, string> = {
  positive: "text-success",
  caution: "text-warning-700",
  neutral: "text-on-surface-variant",
  muted: "text-muted",
  rejected: "text-error",
};
