// ============================================================
// LEGALIR — Shared status badge (tone-based)
// ============================================================
// One small, semantic badge for every list surface. Instead of each
// page keeping its own hand-written colour map (history, cases and
// documents each had one), every status resolves to a shared TONE, and
// the tone picks a semantic MD3 token pair (a whisper of the hue, a
// readable text tone, a hairline border).
//
// The label is ALWAYS text — the dot is decoration, so a status is
// never carried by colour alone (WCAG). Sizes stay small so a list of
// them scans as one calm system.
// ============================================================

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "brand";

/** Tone → semantic token classes (fill · text · border · dot). */
export const STATUS_TONE_CLASSES: Record<
  StatusTone,
  { chip: string; dot: string }
> = {
  neutral: { chip: "bg-surface-container text-on-surface-variant border-[color:var(--color-outline-variant)]", dot: "bg-on-surface-variant" },
  info: { chip: "bg-info-50 text-info-700 border-info-200", dot: "bg-info" },
  success: { chip: "bg-success-container text-success border-success", dot: "bg-success" },
  warning: { chip: "bg-warning-50 text-warning-700 border-warning-200", dot: "bg-warning" },
  error: { chip: "bg-error-container text-error border-error", dot: "bg-error" },
  brand: { chip: "bg-control-selected-surface text-control-selected border-control-selected-border", dot: "bg-control-selected" },
};

export interface StatusBadgeProps {
  /** The visible status label (always rendered as text). */
  label: string;
  tone?: StatusTone;
  /** Show the leading status dot. Default true. */
  dot?: boolean;
  className?: string;
}

export function StatusBadge({
  label,
  tone = "neutral",
  dot = true,
  className = "",
}: StatusBadgeProps) {
  const t = STATUS_TONE_CLASSES[tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption font-medium ${t.chip} ${className}`}
    >
      {dot && (
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

// ---- Status-string → tone -------------------------------------------------
// The shared lifecycle vocabulary used by /history and /documents. Pages
// with their own enum (cases) pass an explicit `tone` instead.

const SUCCESS = new Set([
  "completed", "ready", "generated", "approved", "exported", "active",
  "signed", "finalized", "done", "closed", "تکمیل‌شده", "آماده",
]);
const PROCESSING = new Set([
  "processing", "analyzing", "extracting", "under_review", "collecting",
  "uploaded", "generating", "pending", "in_progress", "در حال پردازش", "در حال تحلیل", "استخراج متن",
]);
const DRAFT = new Set(["draft", "پیش‌نویس"]);
const FAILED = new Set(["failed", "blocked", "error", "cancelled", "canceled", "خطا", "مسدود", "لغو شده"]);

/** Map a raw status string to a shared tone. Falls back to `neutral`. */
export function statusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (DRAFT.has(s)) return "warning";
  if (PROCESSING.has(s)) return "info";
  if (FAILED.has(s)) return "error";
  if (SUCCESS.has(s)) return "success";
  return "neutral";
}

/** Convenience wrapper that resolves the tone from the raw status. */
export function RawStatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className?: string;
}) {
  return <StatusBadge label={label} tone={statusTone(status)} className={className} />;
}
