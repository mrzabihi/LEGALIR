// ============================================================
// LEGALIR — History workspace (client)
// ============================================================
// The interactive history surface: the active list, the archive view,
// per-status actions (continue / edit / archive / restore / delete), and
// the permanent-delete confirmation.
//
// Two rules shape this component:
//   • Continue resumes the SAME process (same id, saved data intact);
//     edit forks a NEW process from a completed item's input.
//   • Every state that must survive a refresh or the Back button lives in
//     the URL (`?archived=true`), never in component state.
//
// Actions are derived from the item's real status by `deriveActions`, so
// the buttons a card shows always match what the API will actually allow.
// ============================================================

"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useHistory,
  useArchiveHistoryItem,
  useDeleteHistoryItem,
  useEditHistoryItem,
} from "@/hooks/usePhase11";
import { toPersianDate } from "@/lib/persian-utils";
import { deriveActions, type HistoryAction, type HistoryActionKey } from "@/lib/history/actions";
import { Button, Dialog, Select, TextField, Tooltip, snackbar } from "@legalir/ui";
import {
  IconHistory,
  IconSearch,
  IconChat,
  IconDocument,
  IconContract,
  IconArchive,
  IconRefresh,
  IconClose,
  IconWarning,
  IconShield,
  IconDelete,
  IconSubscription,
  IconEdit,
  IconRetry,
  IconArrowForward,
  IconOpenInNew,
  IconClock,
  IconInfo,
} from "@/lib/icons";
import type { V1HistoryItem } from "@legalir/types";

// ============================================================
// Constants
// ============================================================

const CATEGORY_TABS: { key: string; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "cases", label: "پرونده‌ها" },
  { key: "contracts", label: "قراردادها" },
  { key: "real_estate", label: "املاک" },
  { key: "family", label: "خانواده" },
  { key: "commerce", label: "تجارت" },
  { key: "other", label: "سایر" },
];

const TYPE_OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "conversation", label: "Conversation" },
  { key: "document", label: "Document" },
  { key: "contract", label: "Contract" },
  { key: "subscription", label: "Subscription" },
  { key: "case", label: "Case" },
];

const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: "newest", label: "جدیدترین" },
  { key: "oldest", label: "قدیمی‌ترین" },
  { key: "title", label: "عنوان" },
];

const RETENTION_NOTE_FA =
  "تا ۱۰۰ مورد و حداکثر ۳۱ روز در تاریخچه نگهداری می‌شود. برای نگهداری طولانی‌تر، موارد مهم را بایگانی کنید.";

const ARCHIVE_DESCRIPTION_FA =
  "موارد بایگانی‌شده از پاک‌سازی خودکار تاریخچه مستثنا هستند.";

/** Items older than this (but not yet purged) get a subtle "near purge" hint. */
const NEAR_PURGE_DAYS = 28;
const RETENTION_MAX_AGE_DAYS = 31;

// ============================================================
// Small helpers
// ============================================================

const TYPE_VISUAL: Record<
  V1HistoryItem["type"],
  { icon: ReactNode; bg: string; fg: string; labelFa: string }
> = {
  conversation: { icon: <IconChat size={20} />, bg: "bg-blue-100", fg: "text-blue-600", labelFa: "گفتگو" },
  document: { icon: <IconDocument size={20} />, bg: "bg-green-100", fg: "text-green-600", labelFa: "سند" },
  contract: { icon: <IconContract size={20} />, bg: "bg-amber-100", fg: "text-amber-600", labelFa: "قرارداد" },
  case: { icon: <IconShield size={20} />, bg: "bg-sky-100", fg: "text-sky-600", labelFa: "پرونده" },
  subscription: { icon: <IconSubscription size={20} />, bg: "bg-violet-100", fg: "text-violet-600", labelFa: "اشتراک" },
};

/** Status badge colour + symbol, keyed off the raw status string. */
function getStatusConfig(status: string): { color: string; symbol: string } {
  const s = status.toLowerCase();
  if (["completed", "ready", "generated", "approved", "exported", "active", "signed", "finalized"].includes(s)) {
    return { color: "bg-success/10 text-success border-success/30", symbol: "✓" };
  }
  if (["processing", "analyzing", "extracting", "under_review", "collecting", "uploaded", "generating"].includes(s)) {
    return { color: "bg-blue-100 text-blue-700 border-blue-300", symbol: "⟳" };
  }
  if (["draft", "پیش‌نویس"].includes(s)) {
    return { color: "bg-amber-100 text-amber-700 border-amber-300", symbol: "📝" };
  }
  if (["failed", "blocked", "error", "cancelled", "canceled"].includes(s)) {
    return { color: "bg-error/10 text-error border-error/30", symbol: "✗" };
  }
  if (["archived"].includes(s)) {
    return { color: "bg-surfaceVariant text-muted border-divider", symbol: "📦" };
  }
  return { color: "bg-surfaceVariant text-muted border-divider", symbol: "" };
}

function actionIcon(key: HistoryActionKey, size = 16): ReactNode {
  switch (key) {
    case "continue":
      return <IconArrowForward size={size} />;
    case "edit":
      return <IconEdit size={size} />;
    case "archive":
      return <IconArchive size={size} />;
    case "restore":
      return <IconRetry size={size} />;
    case "delete":
      return <IconDelete size={size} />;
    default:
      return <IconOpenInNew size={size} />;
  }
}

/** Days elapsed since an ISO timestamp. */
function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

/** True when an active item is close to (but not past) the 31-day purge. */
function isNearPurge(item: V1HistoryItem): boolean {
  if (item.archived) return false;
  const start = item.retentionStartedAt ?? item.createdAt;
  const age = daysSince(start);
  return age >= NEAR_PURGE_DAYS && age < RETENTION_MAX_AGE_DAYS;
}

// ============================================================
// States
// ============================================================

function LoadingState() {
  return (
    <div className="space-y-4 mt-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-large bg-surface p-5 shadow-elevation-1 border border-divider animate-pulse"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-muted/30 shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-5 bg-muted/30 rounded w-2/3" />
              <div className="h-4 bg-muted/20 rounded w-1/3" />
              <div className="h-4 bg-muted/20 rounded w-full" />
            </div>
            <div className="w-20 h-4 bg-muted/20 rounded shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-large bg-surface p-8 shadow-elevation-1 border border-divider text-center mt-6">
      <div className="flex justify-center mb-4">
        <IconWarning size={48} className="text-error" />
      </div>
      <h3 className="text-h3 text-on-surface mb-2">خطا در دریافت تاریخچه</h3>
      <p className="text-body-2 text-muted mb-6">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-primary text-white text-body-2 font-medium hover:bg-primary-dark transition-colors touch-target"
      >
        <IconRefresh size={18} />
        تلاش مجدد
      </button>
    </div>
  );
}

function EmptyState({ hasFilters, archivedView }: { hasFilters: boolean; archivedView: boolean }) {
  return (
    <div className="rounded-large bg-surface p-8 shadow-elevation-1 border border-divider text-center mt-6">
      <div className="flex justify-center mb-4">
        {archivedView ? (
          <IconArchive size={48} className="text-muted" />
        ) : (
          <IconHistory size={48} className="text-muted" />
        )}
      </div>
      <h3 className="text-h3 text-on-surface mb-2">
        {hasFilters
          ? "نتیجه‌ای یافت نشد"
          : archivedView
            ? "موردی بایگانی نشده است"
            : "تاریخچه شما هنوز خالی است"}
      </h3>
      <p className="text-body-2 text-muted mb-6">
        {hasFilters
          ? "با تغییر فیلترها دوباره جستجو کنید"
          : archivedView
            ? "مواردی که بایگانی می‌کنید در این بخش نگهداری می‌شوند و از پاک‌سازی خودکار مستثنا هستند"
            : "با شروع استفاده از LEGALIR، تاریخچه فعالیت‌های شما در اینجا نمایش داده می‌شود"}
      </p>
      {!hasFilters && !archivedView && (
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-white text-body-2 font-medium hover:bg-primary-dark transition-colors touch-target"
        >
          <IconChat size={18} />
          شروع گفتگو
        </Link>
      )}
    </div>
  );
}

function RetentionNote() {
  return (
    <div className="flex items-start gap-2.5 rounded-large bg-surfaceVariant/60 border border-divider px-4 py-3 mb-5">
      <IconInfo size={18} className="text-muted mt-0.5 shrink-0" />
      <p className="text-labelSmall text-muted leading-relaxed">{RETENTION_NOTE_FA}</p>
    </div>
  );
}

function AuditBanner() {
  return (
    <div className="rounded-large bg-amber-50 border border-amber-300 p-4 mb-6 flex items-start gap-3">
      <IconShield size={22} className="text-amber-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-body-2 font-semibold text-amber-800">حالت بازبینی مدیر — دسترسی کامل</p>
        <p className="text-body-2 text-amber-700 mt-1">
          شما در حال مشاهده تاریخچه کامل تمام کاربران هستید. این فعالیت‌ها ثبت و قابل حسابرسی است.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// History card
// ============================================================

function HistoryCard({
  item,
  onAction,
  busy,
}: {
  item: V1HistoryItem;
  onAction: (action: HistoryAction, item: V1HistoryItem) => void;
  busy: boolean;
}) {
  const visual = TYPE_VISUAL[item.type];
  const statusCfg = getStatusConfig(item.status);
  const actions = deriveActions(item);
  const primary = actions[0];
  const secondary = actions.slice(1);
  const nearPurge = isNearPurge(item);

  return (
    <article
      className={[
        "rounded-large border p-4 transition-all hover:shadow-elevation-4",
        item.archived ? "bg-surfaceVariant/30 border-divider" : "bg-surface border-divider",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${visual.bg}`}>
          <span className={visual.fg}>{visual.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="text-body-1 font-semibold text-onSurface">{item.title}</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-labelSmall border ${statusCfg.color}`}
            >
              <span>{statusCfg.symbol}</span>
              {item.statusFa}
            </span>
            {item.archived && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-labelSmall border border-divider bg-surfaceVariant text-muted">
                <IconArchive size={12} />
                بایگانی‌شده
              </span>
            )}
            {nearPurge && (
              <Tooltip content="این مورد به‌زودی از تاریخچه فعال حذف می‌شود؛ برای نگهداری، آن را بایگانی کنید.">
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-labelSmall border border-amber-300 bg-amber-50 text-amber-700">
                  <IconClock size={12} />
                  نزدیک به پاک‌سازی
                </span>
              </Tooltip>
            )}
          </div>

          {item.description && (
            <p className="text-body-2 text-muted line-clamp-2 mb-2">{item.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-labelSmall text-muted">
            <span className="inline-flex items-center gap-1 font-medium text-on-surface-variant">
              {visual.labelFa}
            </span>
            {item.categoryFa && (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60" />
                {item.categoryFa}
              </span>
            )}
            <span>ایجاد: {toPersianDate(item.createdAt)}</span>
            <span>آخرین فعالیت: {toPersianDate(item.updatedAt)}</span>
            {item.archived && item.archivedAt && (
              <span>بایگانی: {toPersianDate(item.archivedAt)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions — the primary action leads its own row (at the START edge,
          i.e. the right in RTL), then a divider, then the secondary
          archive / delete actions on the row below. The card itself is not
          a link, so an action click can never open it, and the two rows can
          never overlap or fall off the card. */}
      <div className="mt-3 border-t border-divider pt-3">
        {primary && (
          <div className="flex flex-wrap items-center justify-start">
            {primary.href ? (
              <Link
                href={primary.href}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-white text-labelSmall font-medium hover:bg-primary-dark transition-colors touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {actionIcon(primary.key, 15)}
                {primary.labelFa}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onAction(primary, item)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-white text-labelSmall font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {actionIcon(primary.key, 15)}
                {primary.labelFa}
              </button>
            )}
          </div>
        )}

        {secondary.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-divider/60 pt-2.5">
            {secondary.map((action) => (
              <Tooltip key={action.key} content={action.hintFa ?? action.labelFa}>
                <button
                  type="button"
                  onClick={() => onAction(action, item)}
                  disabled={busy}
                  aria-label={action.labelFa}
                  className={[
                    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-labelSmall font-medium transition-colors touch-target disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    action.destructive
                      ? "border-error/30 text-error hover:bg-error/10"
                      : "border-border text-muted hover:bg-onSurface/[0.06] hover:text-on-surface",
                  ].join(" ")}
                >
                  {actionIcon(action.key, 16)}
                  {action.labelFa}
                </button>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

// ============================================================
// Permanent-delete confirmation
// ============================================================

function DeleteHistoryDialog({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: V1HistoryItem | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={target !== null}
      onClose={onCancel}
      maxWidth="sm"
      actions={
        <>
          <Button variant="text" onClick={onCancel} disabled={pending}>
            انصراف
          </Button>
          <Button
            variant="filled"
            onClick={onConfirm}
            loading={pending}
            className="!bg-error text-onError"
          >
            مطمئنم، حذف کن
          </Button>
        </>
      }
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <h2 className="text-headlineSmall text-on-surface">حذف دائمی این مورد؟</h2>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          aria-label="بستن"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-onSurface/[0.08] transition-colors touch-target disabled:opacity-50"
        >
          <IconClose size={18} />
        </button>
      </div>
      <p className="text-body-2 text-muted leading-relaxed">
        آیا مطمئن هستید که می‌خواهید
        <span className="text-on-surface font-medium"> «{target?.title ?? ""}» </span>
        را حذف کنید؟ پس از حذف، امکان دسترسی دوباره یا بازیابی این مورد وجود ندارد.
      </p>
    </Dialog>
  );
}

// ============================================================
// Admin review modal (unchanged behaviour)
// ============================================================

function AdminReviewModal({
  open,
  purpose,
  onPurposeChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  purpose: string;
  onPurposeChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  const isValid = purpose.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-scrim/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md mx-4 rounded-large bg-surface shadow-elevation-16 border border-divider p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <IconShield size={24} className="text-amber-600" />
            <h2 className="text-h3 text-on-surface">بازبینی مدیر ارشد</h2>
          </div>
          <button
            onClick={onCancel}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-onSurface/[0.08] transition-colors touch-target"
            aria-label="بستن"
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="mb-5">
          <TextField
            id="admin-review-purpose"
            label="هدف بازبینی"
            type="text"
            value={purpose}
            onChange={(e) => onPurposeChange(e.target.value)}
            placeholder="مثال: حسابرسی دوره‌ای سه‌ماهه"
            required
            autoFocus
            fullWidth
          />
        </div>

        <div className="rounded-large bg-amber-50 border border-amber-200 p-4 mb-6 flex items-start gap-2.5">
          <IconWarning size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-body-2 text-amber-800 leading-relaxed">
            تمامی فعالیت‌های بازبینی شما ثبت و ذخیره می‌شود. این اطلاعات قابل حسابرسی است.
          </p>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            className="rounded-full px-5 py-2.5 text-body-2 font-medium text-on-surface border border-border hover:bg-onSurface/[0.06] transition-colors touch-target"
          >
            انصراف
          </button>
          <button
            onClick={onConfirm}
            disabled={!isValid}
            className={[
              "rounded-full px-5 py-2.5 text-body-2 font-medium text-white transition-colors touch-target",
              isValid ? "bg-primary hover:bg-primary-dark" : "bg-muted cursor-not-allowed",
            ].join(" ")}
          >
            تأیید و ورود
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main workspace
// ============================================================

export function HistoryWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const archivedView = searchParams.get("archived") === "true";

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("newest");
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [adminReviewPurpose, setAdminReviewPurpose] = useState<string>("");
  const [adminReviewActive, setAdminReviewActive] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<V1HistoryItem | null>(null);

  const archiveItem = useArchiveHistoryItem();
  const deleteItem = useDeleteHistoryItem();
  const editItem = useEditHistoryItem();

  // isAdmin — default false; set to true for super admin access in staging/prod
  const [isAdmin] = useState<boolean>(false);

  const hasFilters =
    selectedCategory !== "all" || searchQuery.trim() !== "" || selectedType !== "all";

  const historyParams = adminReviewActive
    ? { archived: archivedView }
    : {
        category: selectedCategory,
        search: searchQuery.trim() || undefined,
        type: selectedType,
        sort: sortOrder,
        archived: archivedView,
      };

  const { data, isLoading, isError, error, refetch } = useHistory(historyParams);

  const items: V1HistoryItem[] = data?.items ?? [];
  const archivedCount = data?.archivedCount ?? 0;

  const busy = archiveItem.isPending || deleteItem.isPending || editItem.isPending;

  // --- Handlers ---

  const handleAction = useCallback(
    (action: HistoryAction, item: V1HistoryItem) => {
      switch (action.key) {
        case "archive":
          archiveItem.mutate(
            { id: item.id, archived: true },
            {
              onSuccess: () => snackbar.show({ message: "به بایگانی منتقل شد", variant: "success" }),
              onError: () => snackbar.show({ message: "بایگانی ناموفق بود", variant: "error" }),
            }
          );
          break;
        case "restore":
          archiveItem.mutate(
            { id: item.id, archived: false },
            {
              onSuccess: () =>
                snackbar.show({ message: "به تاریخچه بازگردانده شد", variant: "success" }),
              onError: () => snackbar.show({ message: "بازگردانی ناموفق بود", variant: "error" }),
            }
          );
          break;
        case "delete":
          setDeleteTarget(item);
          break;
        case "edit":
          editItem.mutate(item.id, {
            onSuccess: (result) => {
              snackbar.show({ message: "فرایند جدید ایجاد شد", variant: "success" });
              router.push(result.href);
            },
            onError: () =>
              snackbar.show({ message: "ایجاد فرایند جدید ناموفق بود", variant: "error" }),
          });
          break;
        default:
          break; // view / continue are links
      }
    },
    [archiveItem, editItem, router]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteItem.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        snackbar.show({ message: "مورد برای همیشه حذف شد", variant: "success" });
      },
      onError: () => snackbar.show({ message: "حذف ناموفق بود؛ دوباره تلاش کنید", variant: "error" }),
    });
  }, [deleteTarget, deleteItem]);

  const handleOpenAdminModal = useCallback(() => {
    setAdminReviewPurpose("");
    setShowAdminModal(true);
  }, []);

  const handleCancelAdmin = useCallback(() => {
    setShowAdminModal(false);
    setAdminReviewPurpose("");
  }, []);

  const handleConfirmAdmin = useCallback(() => {
    if (adminReviewPurpose.trim().length === 0) return;
    setShowAdminModal(false);
    setAdminReviewActive(true);
  }, [adminReviewPurpose]);

  const handleExitAdminReview = useCallback(() => {
    setAdminReviewActive(false);
    setAdminReviewPurpose("");
  }, []);

  return (
    <div className="p-4 tablet:p-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-h2 text-on-surface">{archivedView ? "بایگانی" : "تاریخچه"}</h1>
          <p className="text-body-2 text-muted mt-1">
            {archivedView ? ARCHIVE_DESCRIPTION_FA : "سابقه گفتگوها، اسناد و قراردادها"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {archivedView ? (
            <Link
              href="/history"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-body-2 font-medium text-on-surface hover:bg-onSurface/[0.06] transition-colors touch-target"
            >
              <IconArrowForward size={18} className="rotate-180" />
              بازگشت به تاریخچه
            </Link>
          ) : (
            <Link
              href="/history?archived=true"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-body-2 font-medium text-on-surface hover:bg-onSurface/[0.06] transition-colors touch-target"
              aria-label={`بایگانی (${archivedCount} مورد)`}
            >
              <IconArchive size={18} />
              بایگانی
              {archivedCount > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-labelSmall text-white">
                  {archivedCount}
                </span>
              )}
            </Link>
          )}

          {isAdmin && !adminReviewActive && (
            <button
              onClick={handleOpenAdminModal}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 bg-amber-600 text-white text-body-2 font-medium hover:bg-amber-700 transition-colors touch-target"
            >
              <IconShield size={18} />
              بازبینی مدیر ارشد
            </button>
          )}

          {adminReviewActive && (
            <button
              onClick={handleExitAdminReview}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 border border-error text-error text-body-2 font-medium hover:bg-error/10 transition-colors touch-target"
            >
              <IconClose size={18} />
              خروج از حالت بازبینی
            </button>
          )}
        </div>
      </div>

      {adminReviewActive && <AuditBanner />}

      {/* Retention note — active view only (archived items are exempt). */}
      {!archivedView && !adminReviewActive && <RetentionNote />}

      {/* Category Tabs */}
      {!adminReviewActive && (
        <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="دسته‌بندی تاریخچه">
          {CATEGORY_TABS.map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedCategory(cat.key)}
                className={[
                  "rounded-full border px-4 py-2 text-body-2 transition-colors touch-target",
                  isActive
                    ? "border-control-selected-border bg-control-selected-surface text-control-selected"
                    : "border-border bg-surface text-muted hover:border-control-selected/50 hover:text-on-surface",
                ].join(" ")}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Search, Filter, Sort Bar */}
      {!adminReviewActive && (
        <div className="flex flex-col tablet:flex-row gap-3 mb-6">
          <div className="flex-1">
            <TextField
              type="search"
              label="جستجو در تاریخچه"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در تاریخچه..."
              leadingIcon={<IconSearch size={18} />}
              endAdornment={
                searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-on-surface/[0.08]"
                    aria-label="پاک کردن جستجو"
                  >
                    <IconClose size={16} />
                  </button>
                ) : undefined
              }
              fullWidth
            />
          </div>

          <Select
            label="فیلتر نوع"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            selectSize="small"
            className="min-w-[140px]"
            options={TYPE_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label }))}
          />

          <Select
            label="مرتب‌سازی"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            selectSize="small"
            className="min-w-[140px]"
            options={SORT_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label }))}
          />
        </div>
      )}

      {adminReviewActive && (
        <p className="text-body-2 text-muted mb-6">نمایش تمام آیتم‌ها بدون فیلتر (حالت بازبینی)</p>
      )}

      {isLoading && <LoadingState />}

      {isError && !isLoading && (
        <ErrorState
          message={error instanceof Error ? error.message : "خطای ناشناخته"}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState hasFilters={hasFilters || adminReviewActive} archivedView={archivedView} />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="space-y-3 mt-2">
          <p className="text-labelSmall text-muted px-1">
            {data?.pagination
              ? `${items.length} از ${data.pagination.total} نتیجه`
              : `${items.length} نتیجه`}
          </p>

          {items.map((item) => (
            <HistoryCard key={item.id} item={item} onAction={handleAction} busy={busy} />
          ))}
        </div>
      )}

      <DeleteHistoryDialog
        target={deleteTarget}
        pending={deleteItem.isPending}
        onCancel={() => {
          if (!deleteItem.isPending) setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
      />

      <AdminReviewModal
        open={showAdminModal}
        purpose={adminReviewPurpose}
        onPurposeChange={setAdminReviewPurpose}
        onCancel={handleCancelAdmin}
        onConfirm={handleConfirmAdmin}
      />
    </div>
  );
}
