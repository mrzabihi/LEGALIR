// ============================================================
// LEGALIR — History action model (pure, client + server safe)
// ============================================================
// A history item's available actions are derived from its *real*
// status and its archive flag — never hard-coded per card. This module
// has no Node imports so the same rules drive the UI (which buttons to
// render) and the API (which operations are actually permitted).
//
// Two operations are deliberately distinct:
//   • continue — resume the SAME process, same id, saved data intact.
//   • edit     — create a NEW process from a completed item's data,
//                preserving the original result.
// ============================================================

import type { V1HistoryItem } from "@legalir/types";

export type HistoryActionKey =
  | "continue"
  | "view_result"
  | "view_progress"
  | "view_error"
  | "view"
  | "edit"
  | "archive"
  | "restore"
  | "delete";

export interface HistoryAction {
  key: HistoryActionKey;
  labelFa: string;
  /** Navigation target for view/continue actions. */
  href?: string;
  /** The single emphasised action on the card (shown with text on desktop). */
  primary?: boolean;
  /** Rendered in the danger style (delete). */
  destructive?: boolean;
  /** Short helper text (tooltip) — required for the edit action. */
  hintFa?: string;
}

/** The lifecycle bucket a raw status maps to. */
export type HistoryStatusKind =
  | "draft"
  | "processing"
  | "completed"
  | "failed"
  | "unknown";

const DRAFT_STATUSES = new Set(["draft", "پیش‌نویس"]);
const PROCESSING_STATUSES = new Set([
  "processing",
  "analyzing",
  "extracting",
  "under_review",
  "collecting",
  "uploaded",
  "generating",
  "pending",
  "in_progress",
]);
const FAILED_STATUSES = new Set(["failed", "blocked", "error", "cancelled", "canceled"]);
const COMPLETED_STATUSES = new Set([
  "completed",
  "ready",
  "generated",
  "approved",
  "exported",
  "finalized",
  "signed",
  "done",
  "closed",
  "active",
]);

/**
 * Classify a raw status into a lifecycle bucket. Type-aware because
 * "active" means "ongoing" for a conversation/case (→ continue) but
 * "in force" for a subscription (→ view result).
 */
export function classifyStatus(item: Pick<V1HistoryItem, "type" | "status">): HistoryStatusKind {
  const s = item.status.toLowerCase();
  if (DRAFT_STATUSES.has(s)) return "draft";
  if (PROCESSING_STATUSES.has(s)) return "processing";
  if (FAILED_STATUSES.has(s)) return "failed";
  if (s === "active") {
    return item.type === "subscription" ? "completed" : "draft";
  }
  if (COMPLETED_STATUSES.has(s)) return "completed";
  return "unknown";
}

/** The detail route for an item — where "view" and "continue" land. */
export function historyItemHref(item: Pick<V1HistoryItem, "id" | "type">): string {
  switch (item.type) {
    case "conversation":
      return `/chat/${item.id}`;
    case "document":
      return `/documents/${item.id}`;
    case "contract":
      return `/contracts/${item.id}`;
    case "case":
      return `/cases/${item.id}`;
    case "subscription":
      return "/subscription";
    default:
      return "/history";
  }
}

/** Types whose completed result can seed a new process via "edit". */
const EDITABLE_TYPES = new Set<V1HistoryItem["type"]>(["conversation", "contract", "case"]);

export function canEdit(item: Pick<V1HistoryItem, "type" | "status">): boolean {
  return EDITABLE_TYPES.has(item.type) && classifyStatus(item) === "completed";
}

/**
 * Whether a failed item can be resumed/retried. Only true where the
 * underlying process genuinely supports it — a subscription cannot be
 * resumed, so it is excluded.
 */
export function canResumeFailed(item: Pick<V1HistoryItem, "type">): boolean {
  return item.type !== "subscription";
}

const EDIT_HINT_FA =
  "با اطلاعات این مورد، یک فرایند جدید ایجاد می‌شود؛ نتیجه قبلی حفظ خواهد شد.";

/**
 * Derive the ordered action list for an item. The first entry is the
 * primary action; the rest are secondary (icon group / overflow menu).
 */
export function deriveActions(item: V1HistoryItem): HistoryAction[] {
  const href = historyItemHref(item);
  const kind = classifyStatus(item);

  if (item.archived) {
    // Archived view: view is primary; resume/edit depend on the ORIGINAL
    // status; restore and delete are always available.
    const actions: HistoryAction[] = [
      { key: "view", labelFa: "مشاهده", href, primary: true },
    ];
    if (kind === "draft") {
      actions.push({ key: "continue", labelFa: "ادامه", href });
    }
    if (canEdit(item)) {
      actions.push({ key: "edit", labelFa: "ویرایش", hintFa: EDIT_HINT_FA });
    }
    actions.push({ key: "restore", labelFa: "بازگردانی به تاریخچه" });
    actions.push({ key: "delete", labelFa: "حذف", destructive: true });
    return actions;
  }

  switch (kind) {
    case "draft":
      return [
        { key: "continue", labelFa: "ادامه", href, primary: true },
        { key: "archive", labelFa: "بایگانی" },
        { key: "delete", labelFa: "حذف", destructive: true },
      ];
    case "processing":
      return [
        { key: "view_progress", labelFa: "مشاهده پیشرفت", href, primary: true },
        { key: "archive", labelFa: "بایگانی" },
        { key: "delete", labelFa: "حذف", destructive: true },
      ];
    case "completed": {
      const actions: HistoryAction[] = [
        { key: "view_result", labelFa: "مشاهده نتیجه", href, primary: true },
      ];
      if (canEdit(item)) {
        actions.push({ key: "edit", labelFa: "ویرایش", hintFa: EDIT_HINT_FA });
      }
      actions.push({ key: "archive", labelFa: "بایگانی" });
      actions.push({ key: "delete", labelFa: "حذف", destructive: true });
      return actions;
    }
    case "failed": {
      const actions: HistoryAction[] = [
        { key: "view_error", labelFa: "مشاهده جزئیات خطا", href, primary: true },
      ];
      if (canResumeFailed(item)) {
        actions.push({ key: "continue", labelFa: "تلاش مجدد", href });
      }
      actions.push({ key: "archive", labelFa: "بایگانی" });
      actions.push({ key: "delete", labelFa: "حذف", destructive: true });
      return actions;
    }
    default:
      return [
        { key: "view_result", labelFa: "مشاهده", href, primary: true },
        { key: "archive", labelFa: "بایگانی" },
        { key: "delete", labelFa: "حذف", destructive: true },
      ];
  }
}

/** The primary action (first entry), or null when the list is empty. */
export function primaryAction(item: V1HistoryItem): HistoryAction | null {
  return deriveActions(item)[0] ?? null;
}

/** Secondary actions (everything after the primary). */
export function secondaryActions(item: V1HistoryItem): HistoryAction[] {
  return deriveActions(item).slice(1);
}
