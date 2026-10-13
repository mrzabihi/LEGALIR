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
//
// The surface itself is a compact, single-column MD3 scan-list: one low
// header, one search toolbar, a chip row for the coarse axis, a results
// line, then flat rows of ~100px. Each row carries exactly ONE primary
// action plus a ⋮ overflow menu — never a dedicated button row.
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
  CompactPageHeader,
  SearchField,
  OverflowMenu,
  RawStatusBadge,
  FilterChips,
  ResultsBar,
  type ActiveFilter,
} from "@/components/shared";
import {
  IconHistory,
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
  { key: "conversation", label: "گفتگو" },
  { key: "document", label: "سند" },
  { key: "contract", label: "قرارداد" },
  { key: "subscription", label: "اشتراک" },
  { key: "case", label: "پرونده" },
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

// Type tints drawn from the brand family (navy · gold · green) plus one
// semantic hue — no raw rainbow. The tile background is a whisper of the
// hue; the type is also always labelled in text beside it, so colour is
// never the only cue.
const TYPE_VISUAL: Record<
  V1HistoryItem["type"],
  { icon: ReactNode; bg: string; fg: string; labelFa: string }
> = {
  conversation: { icon: <IconChat size={20} />, bg: "bg-primary-container", fg: "text-primary-on-container", labelFa: "گفتگو" },
  document: { icon: <IconDocument size={20} />, bg: "bg-success-50", fg: "text-success-700", labelFa: "سند" },
  contract: { icon: <IconContract size={20} />, bg: "bg-warning-50", fg: "text-warning-700", labelFa: "قرارداد" },
  case: { icon: <IconShield size={20} />, bg: "bg-info-50", fg: "text-info-700", labelFa: "پرونده" },
  subscription: { icon: <IconSubscription size={20} />, bg: "bg-secondary-container", fg: "text-secondary-on-container", labelFa: "اشتراک" },
};

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

/** Row skeletons that mirror the final compact-row geometry. */
function LoadingState() {
  return (
    <div className="mt-4 space-y-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-3 tablet:p-4"
        >
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-medium bg-surface-container" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-container" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-surface-container" />
          </div>
          <div className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-surface-container" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-4 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-8 text-center">
      <div className="mb-4 flex justify-center">
        <IconWarning size={44} className="text-error" />
      </div>
      <h3 className="mb-2 text-titleMedium text-on-surface">خطا در دریافت تاریخچه</h3>
      <p className="mb-6 text-body-2 text-on-surface-variant">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-body-2 font-medium text-primary-on transition-colors duration-short3 hover:bg-primary-700 hover:text-white focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        <IconRefresh size={18} />
        تلاش مجدد
      </button>
    </div>
  );
}

function EmptyState({
  hasFilters,
  archivedView,
  onClearFilters,
}: {
  hasFilters: boolean;
  archivedView: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="mt-4 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-8 text-center">
      <div className="mb-4 flex justify-center">
        {archivedView ? (
          <IconArchive size={44} className="text-on-surface-variant" />
        ) : (
          <IconHistory size={44} className="text-on-surface-variant" />
        )}
      </div>
      <h3 className="mb-2 text-titleMedium text-on-surface">
        {hasFilters
          ? "نتیجه‌ای یافت نشد"
          : archivedView
            ? "موردی بایگانی نشده است"
            : "تاریخچه شما هنوز خالی است"}
      </h3>
      <p className="mb-6 text-body-2 text-on-surface-variant">
        {hasFilters
          ? "با تغییر فیلترها دوباره جستجو کنید"
          : archivedView
            ? "مواردی که بایگانی می‌کنید در این بخش نگهداری می‌شوند و از پاک‌سازی خودکار مستثنا هستند"
            : "با شروع استفاده از LEGALIR، تاریخچه فعالیت‌های شما در اینجا نمایش داده می‌شود"}
      </p>
      {hasFilters ? (
        <button
          onClick={onClearFilters}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--color-outline-variant)] px-5 text-body-2 font-medium text-on-surface transition-colors duration-short3 hover:bg-surface-hover"
        >
          <IconClose size={18} />
          پاک کردن فیلترها
        </button>
      ) : (
        !archivedView && (
          <Link
            href="/chat"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-6 text-body-2 font-medium text-primary-on transition-colors duration-short3 hover:bg-primary-700 hover:text-white"
          >
            <IconChat size={18} />
            شروع گفتگو
          </Link>
        )
      )}
    </div>
  );
}

function RetentionNote() {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface-container px-3.5 py-2.5">
      <IconInfo size={18} className="mt-0.5 shrink-0 text-on-surface-variant" />
      <p className="text-caption leading-relaxed text-on-surface-variant">{RETENTION_NOTE_FA}</p>
    </div>
  );
}

function AuditBanner() {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-medium border border-warning-200 bg-warning-50 px-3.5 py-3">
      <IconShield size={20} className="mt-0.5 shrink-0 text-warning-700" />
      <div>
        <p className="text-body-2 font-semibold text-warning-700">حالت بازبینی مدیر — دسترسی کامل</p>
        <p className="mt-1 text-body-2 text-warning-700">
          شما در حال مشاهده تاریخچه کامل تمام کاربران هستید. این فعالیت‌ها ثبت و قابل حسابرسی است.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// History row — one compact, scan-friendly line
// ============================================================
// Layout: [soft icon tile] [title + status · one-line description ·
// low-emphasis meta] … [the ONE primary action] [⋮ menu]. No divider,
// no separate action row: the whole record fits ~96–120px on desktop.

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
  const actions = deriveActions(item);
  const primary = actions[0];
  const secondary = actions.slice(1);
  const nearPurge = isNearPurge(item);

  return (
    <article
      className={[
        "flex flex-col gap-3 rounded-medium border p-3 transition-colors duration-short3 tablet:flex-row tablet:items-center tablet:gap-4 tablet:p-4",
        item.archived
          ? "border-[color:var(--color-outline-variant)] bg-surface-container"
          : "border-[color:var(--color-outline-variant)] bg-surface hover:border-[color:var(--color-outline)]",
      ].join(" ")}
    >
      {/* Identity + metadata */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-medium ${visual.bg}`}
          aria-hidden="true"
        >
          <span className={visual.fg}>{visual.icon}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 truncate text-titleSmall font-semibold text-on-surface">
              {item.title}
            </h3>
            <RawStatusBadge status={item.status} label={item.statusFa} />
            {item.archived && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-outline-variant)] bg-surface px-2 py-0.5 text-caption text-on-surface-variant">
                <IconArchive size={12} aria-hidden="true" />
                بایگانی‌شده
              </span>
            )}
            {nearPurge && (
              <Tooltip content="این مورد به‌زودی از تاریخچه فعال حذف می‌شود؛ برای نگهداری، آن را بایگانی کنید.">
                <span className="inline-flex items-center gap-1 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-caption text-warning-700">
                  <IconClock size={12} aria-hidden="true" />
                  نزدیک به پاک‌سازی
                </span>
              </Tooltip>
            )}
          </div>

          {item.description && (
            <p className="mt-1 truncate text-body-2 text-on-surface-variant">{item.description}</p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-caption text-on-surface-variant">
            <span className="font-medium text-on-surface-variant">{visual.labelFa}</span>
            <span aria-hidden="true" className="text-divider">·</span>
            <span>{item.categoryFa ?? "سایر"}</span>
            <span aria-hidden="true" className="text-divider">·</span>
            <span>آخرین فعالیت: {toPersianDate(item.updatedAt)}</span>
            {item.archived && item.archivedAt && (
              <>
                <span aria-hidden="true" className="text-divider">·</span>
                <span>بایگانی: {toPersianDate(item.archivedAt)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* The ONE primary action + the ⋮ overflow menu. On mobile both sit
          on their own line (full-width primary); from `tablet` up they pin
          to the end edge of the same row. */}
      {(primary || secondary.length > 0) && (
        <div className="flex shrink-0 items-center gap-1.5 tablet:justify-end">
          {primary &&
            (primary.href ? (
              <Link
                href={primary.href}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-labelLarge font-medium text-primary-on transition-colors duration-short3 hover:bg-primary-700 hover:text-white focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 tablet:h-9 tablet:flex-none tablet:text-labelSmall"
              >
                {actionIcon(primary.key, 16)}
                {primary.labelFa}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onAction(primary, item)}
                disabled={busy}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-labelLarge font-medium text-primary-on transition-colors duration-short3 hover:bg-primary-700 hover:text-white focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 tablet:h-9 tablet:flex-none tablet:text-labelSmall"
              >
                {actionIcon(primary.key, 16)}
                {primary.labelFa}
              </button>
            ))}

          {secondary.length > 0 && (
            <OverflowMenu
              label="گزینه‌های این سابقه"
              size="small"
              className="shrink-0"
              items={secondary.map((action) => ({
                key: action.key,
                label: action.labelFa,
                icon: actionIcon(action.key, 16),
                destructive: action.destructive,
                disabled: busy,
                onSelect: () => onAction(action, item),
              }))}
            />
          )}
        </div>
      )}
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
      <div className="mb-3 flex items-start justify-between gap-4">
        <h2 className="text-headlineSmall text-on-surface">حذف دائمی این مورد؟</h2>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          aria-label="بستن"
          className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-short3 hover:bg-surface-hover disabled:opacity-50"
        >
          <IconClose size={18} />
        </button>
      </div>
      <p className="text-body-2 leading-relaxed text-on-surface-variant">
        آیا مطمئن هستید که می‌خواهید
        <span className="font-medium text-on-surface"> «{target?.title ?? ""}» </span>
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
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onCancel} />
      <div className="relative mx-4 w-full max-w-md rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-6 shadow-elevation-16 animate-fade-in">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconShield size={24} className="text-warning" />
            <h2 className="text-titleLarge text-on-surface">بازبینی مدیر ارشد</h2>
          </div>
          <button
            onClick={onCancel}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-short3 hover:bg-surface-hover"
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

        <div className="mb-6 flex items-start gap-2.5 rounded-medium border border-warning-200 bg-warning-50 p-4">
          <IconWarning size={18} className="mt-0.5 shrink-0 text-warning-700" />
          <p className="text-body-2 leading-relaxed text-warning-700">
            تمامی فعالیت‌های بازبینی شما ثبت و ذخیره می‌شود. این اطلاعات قابل حسابرسی است.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="h-10 rounded-full border border-[color:var(--color-outline-variant)] px-5 text-body-2 font-medium text-on-surface transition-colors duration-short3 hover:bg-surface-hover"
          >
            انصراف
          </button>
          <button
            onClick={onConfirm}
            disabled={!isValid}
            className={[
              "h-10 rounded-full px-5 text-body-2 font-medium transition-colors duration-short3",
              isValid
                ? "bg-primary text-primary-on hover:bg-primary-700 hover:text-white"
                : "cursor-not-allowed bg-muted text-white",
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

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedType("all");
  }, []);

  // Active filters shown (and individually removable) in the results bar.
  const activeFilters: ActiveFilter[] = [];
  if (searchQuery.trim()) {
    activeFilters.push({
      key: "search",
      label: `جست‌وجو: ${searchQuery.trim()}`,
      onRemove: () => setSearchQuery(""),
    });
  }
  if (selectedCategory !== "all") {
    activeFilters.push({
      key: "category",
      label: CATEGORY_TABS.find((c) => c.key === selectedCategory)?.label ?? selectedCategory,
      onRemove: () => setSelectedCategory("all"),
    });
  }
  if (selectedType !== "all") {
    activeFilters.push({
      key: "type",
      label: TYPE_OPTIONS.find((t) => t.key === selectedType)?.label ?? selectedType,
      onRemove: () => setSelectedType("all"),
    });
  }

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
          // Navigational secondary actions (e.g. «تلاش مجدد» on a failed
          // item) live in the ⋮ menu as buttons, so they must push their
          // href explicitly — unlike the primary action, a menu item is
          // never a <Link>.
          if (action.href) router.push(action.href);
          break;
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

  const countLabel = data?.pagination
    ? `${items.length} از ${data.pagination.total} نتیجه`
    : `${items.length} نتیجه`;

  return (
    <div className="mx-auto w-full max-w-[1120px] p-4 tablet:p-6">
      {/* Low, quiet page header — no decorative card. */}
      <CompactPageHeader
        title={archivedView ? "بایگانی" : "تاریخچه"}
        description={archivedView ? ARCHIVE_DESCRIPTION_FA : "سابقه گفتگوها، اسناد و قراردادها"}
        actions={
          <>
            {archivedView ? (
              <Link
                href="/history"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[color:var(--color-outline-variant)] px-4 text-body-2 font-medium text-on-surface transition-colors duration-short3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <IconArrowForward size={18} className="rotate-180" />
                بازگشت به تاریخچه
              </Link>
            ) : (
              <Link
                href="/history?archived=true"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[color:var(--color-outline-variant)] px-4 text-body-2 font-medium text-on-surface transition-colors duration-short3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                aria-label={`بایگانی (${archivedCount} مورد)`}
              >
                <IconArchive size={18} />
                بایگانی
                {archivedCount > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-caption text-primary-on">
                    {archivedCount}
                  </span>
                )}
              </Link>
            )}

            {isAdmin && !adminReviewActive && (
              <button
                onClick={handleOpenAdminModal}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-warning-700 px-4 text-body-2 font-medium text-white transition-colors duration-short3 hover:opacity-90"
              >
                <IconShield size={18} />
                بازبینی مدیر ارشد
              </button>
            )}

            {adminReviewActive && (
              <button
                onClick={handleExitAdminReview}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-error px-4 text-body-2 font-medium text-error transition-colors duration-short3 hover:bg-error-container"
              >
                <IconClose size={18} />
                خروج از حالت بازبینی
              </button>
            )}
          </>
        }
      />

      {adminReviewActive && <AuditBanner />}

      {/* Retention notice — active view only (archived items are exempt). */}
      {!archivedView && !adminReviewActive && <RetentionNote />}

      {/* Toolbar — search owns the main space; type/sort are compact and
          equal-height beside it. */}
      {!adminReviewActive && (
        <>
          <div className="mt-4 flex flex-col gap-3 tablet:flex-row tablet:items-end">
            <div className="flex-1">
              <SearchField
                label="جست‌وجو در تاریخچه"
                placeholder="مثلاً: قرارداد اجاره، اظهارنامه"
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 tablet:flex tablet:items-end">
              <Select
                label="نوع"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                selectSize="small"
                className="tablet:w-[150px]"
                options={TYPE_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label }))}
              />
              <Select
                label="مرتب‌سازی"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                selectSize="small"
                className="tablet:w-[150px]"
                options={SORT_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label }))}
              />
            </div>
          </div>

          <div className="mt-3">
            <FilterChips
              options={CATEGORY_TABS}
              value={selectedCategory}
              onChange={setSelectedCategory}
              ariaLabel="فیلتر دسته‌بندی"
            />
          </div>
        </>
      )}

      {adminReviewActive && (
        <p className="mt-4 text-body-2 text-on-surface-variant">
          نمایش تمام آیتم‌ها بدون فیلتر (حالت بازبینی)
        </p>
      )}

      {isLoading && <LoadingState />}

      {isError && !isLoading && (
        <ErrorState
          message={error instanceof Error ? error.message : "خطای ناشناخته"}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          hasFilters={hasFilters || adminReviewActive}
          archivedView={archivedView}
          onClearFilters={clearAllFilters}
        />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="mt-4 space-y-2.5">
          <ResultsBar
            countLabel={countLabel}
            filters={activeFilters}
            onClearAll={clearAllFilters}
            className="px-0.5"
          />

          <div className="space-y-2.5">
            {items.map((item) => (
              <HistoryCard key={item.id} item={item} onAction={handleAction} busy={busy} />
            ))}
          </div>
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
