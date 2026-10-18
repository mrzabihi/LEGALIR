"use client";

// ============================================================
// LEGALIR — /cases (client list)
// ============================================================
// A compact, single-column MD3 scan-list of the user's cases: one low
// header, one search toolbar, a status chip row, a results line, then
// flat rows. Each row shows the identity (category-tinted tile, title,
// status + priority), one low-emphasis meta line, and exactly ONE
// primary action («مشاهده پرونده») plus a ⋮ menu carrying the real,
// owner-only supplementary operations (copy reference · archive).
//
// All data logic is unchanged: the same `/api/v1/cases` query, the same
// `?create=true` deep link, the same create modal and idempotency key.
// ============================================================

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TextField, Textarea, Select, Dialog, Button, snackbar } from "@legalir/ui";
import { CASE_STATUS_FA, CASE_CATEGORY_FA, CASE_PRIORITY_FA } from "@legalir/types";
import type { CaseStatus, CaseCategory, CasePriority, CaseListItem } from "@legalir/types";
import { toPersianDate } from "@/lib/persian-utils";
import {
  IconAdd,
  IconBalance,
  IconArchive,
  IconCopy,
  IconWarning,
  IconClose,
  IconRefresh,
} from "@/lib/icons";
import {
  CompactPageHeader,
  SearchField,
  FilterChips,
  ResultsBar,
  OverflowMenu,
  StatusBadge,
  PageContainer,
  PromoArt,
  type ActiveFilter,
} from "@/components/shared";
import type { StatusTone } from "@/components/shared";

// ============================================================
// Status → shared tone + priority → shared tone
// ============================================================

const CASE_STATUS_TONE: Record<CaseStatus, StatusTone> = {
  DRAFT: "neutral",
  ACTIVE: "info",
  UNDER_REVIEW: "warning",
  WAITING_DOCUMENTS: "warning",
  LAWYER_ASSIGNED: "brand",
  CLOSED: "success",
  ARCHIVED: "neutral",
};

const PRIORITY_TONE: Record<CasePriority, StatusTone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "error",
};

// ============================================================
// Create Case Modal (logic unchanged)
// ============================================================

const CATEGORIES: CaseCategory[] = ["family", "contract", "property", "employment", "business", "criminal", "financial", "tax", "other"];
const PRIORITIES: CasePriority[] = ["low", "medium", "high", "urgent"];

function CreateCaseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({ title: "", description: "", category: "contract" as CaseCategory, priority: "medium" as CasePriority });
  const [creating, setCreating] = useState(false);
  // One idempotency key per modal session: a double-click or retry reuses it,
  // so the server returns the SAME case instead of creating a duplicate.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, idempotencyKey }),
      });
      const json = await res.json();
      if (json.data?.id) onCreated(json.data.id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-lg rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-6 shadow-elevation-16 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-titleLarge font-bold text-on-surface">ثبت پرونده جدید</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-short3 hover:bg-surface-hover"
            aria-label="بستن"
          >
            <IconClose size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            type="text"
            label="عنوان پرونده"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="مثلاً: اختلاف ملکی با همسایه"
            fullWidth
            required
          />

          <Textarea
            label="توضیحات"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="شرح مختصری از موضوع پرونده..."
            rows={3}
            fullWidth
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="دسته‌بندی"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as CaseCategory })}
              fullWidth
              options={CATEGORIES.map((c) => ({ value: c, label: CASE_CATEGORY_FA[c] }))}
            />

            <Select
              label="اولویت"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as CasePriority })}
              fullWidth
              options={PRIORITIES.map((p) => ({ value: p, label: CASE_PRIORITY_FA[p] }))}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            {/* Cancel is quieter than the committing action, and the commit
                keeps one truthful label while the spinner carries progress. */}
            <Button type="button" variant="outlined" onClick={onClose} fullWidth className="flex-1">
              انصراف
            </Button>
            <Button
              type="submit"
              disabled={creating || !form.title.trim()}
              loading={creating}
              fullWidth
              className="flex-1"
            >
              ثبت پرونده
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Archive confirmation (DELETE = owner-only internal archive)
// ============================================================

function ArchiveCaseDialog({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: CaseListItem | null;
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
          <Button variant="filled" onClick={onConfirm} loading={pending}>
            بایگانی کن
          </Button>
        </>
      }
    >
      <h2 className="mb-3 text-headlineSmall text-on-surface">بایگانی این پرونده؟</h2>
      <p className="text-body-2 leading-relaxed text-on-surface-variant">
        پرونده
        <span className="font-medium text-on-surface"> «{target?.title ?? ""}» </span>
        در لیگالیر بایگانی می‌شود. این یک اقدام داخلی است و تغییری در روند مرجع قضایی ایجاد نمی‌کند؛
        مهلت‌های باز و یادآورهای آن باقی می‌مانند.
      </p>
    </Dialog>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function CasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<CaseListItem | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Auto-open create modal when navigated from workflow ACTION phase
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setShowCreate(true);
    }
  }, [searchParams]);

  // Debounce the query so continuous Persian typing reaches the API calmly.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCases = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/v1/cases?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then((j) => {
        setCases(j.data?.items ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleCreated = (id: string) => {
    setShowCreate(false);
    router.push(`/cases/${id}`);
  };

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("all");
  }, []);

  const handleCopyRef = useCallback((ref: string) => {
    navigator.clipboard
      .writeText(ref)
      .then(() => snackbar.show({ message: "شناسه کپی شد", variant: "success" }))
      .catch(() => snackbar.show({ message: "کپی ناموفق بود", variant: "error" }));
  }, []);

  const handleConfirmArchive = useCallback(async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/v1/cases/${archiveTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      snackbar.show({ message: "پرونده بایگانی شد", variant: "success" });
      setArchiveTarget(null);
      fetchCases();
    } catch {
      snackbar.show({ message: "بایگانی ناموفق بود؛ دوباره تلاش کنید", variant: "error" });
    } finally {
      setArchiving(false);
    }
  }, [archiveTarget, fetchCases]);

  const statusFilters = useMemo(
    () => [
      { key: "all", label: "همه" },
      ...Object.entries(CASE_STATUS_FA).map(([key, label]) => ({ key, label })),
    ],
    []
  );

  const hasFilters = search.trim() !== "" || statusFilter !== "all";

  const activeFilters: ActiveFilter[] = [];
  if (search.trim()) {
    activeFilters.push({ key: "search", label: `جست‌وجو: ${search.trim()}`, onRemove: () => setSearch("") });
  }
  if (statusFilter !== "all") {
    activeFilters.push({
      key: "status",
      label: CASE_STATUS_FA[statusFilter as CaseStatus] ?? statusFilter,
      onRemove: () => setStatusFilter("all"),
    });
  }

  return (
    <PageContainer dir="rtl">
      <CompactPageHeader
        title="پرونده‌های من"
        description="مدیریت و پیگیری پرونده‌های حقوقی"
        actions={
          // The page's one primary action renders through the shared
          // primitive, so its hover/focus/press/touch states match every
          // other primary CTA instead of a hand-rolled copy.
          <Button
            onClick={() => setShowCreate(true)}
            startIcon={<IconAdd size={20} />}
            className="w-full tablet:w-auto"
          >
            پرونده جدید
          </Button>
        }
      />

      {/* Toolbar — search owns the space; status chips scroll in their own row. */}
      <div className="mt-4 flex flex-col gap-3">
        <SearchField
          label="جست‌وجو در پرونده‌ها"
          placeholder="مثلاً: اجاره، اظهارنامه، ملکی"
          value={search}
          onChange={setSearch}
        />
        <FilterChips
          options={statusFilters}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="فیلتر وضعیت پرونده"
        />
      </div>

      {/* Loading */}
      {loading && (
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
      )}

      {/* Error */}
      {!loading && error && (
        <div className="mt-4 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-8 text-center">
          <div className="mb-4 flex justify-center">
            <IconWarning size={44} className="text-error" />
          </div>
          <h3 className="mb-2 text-titleMedium text-on-surface">خطا در دریافت پرونده‌ها</h3>
          <p className="mb-6 text-body-2 text-on-surface-variant">اتصال برقرار نشد؛ دوباره تلاش کنید.</p>
          <Button onClick={fetchCases} startIcon={<IconRefresh size={16} />}>
            تلاش مجدد
          </Button>
        </div>
      )}

      {/* Empty — the case artwork lives only here, never over real data. */}
      {!loading && !error && cases.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface py-14 text-center">
          <div className="w-full max-w-[200px]">
            <PromoArt art="two" alt="" sizes="(min-width: 600px) 200px, 180px" />
          </div>
          <p className="text-body-1 font-medium text-on-surface">
            {hasFilters ? "نتیجه‌ای یافت نشد" : "هنوز پرونده‌ای ثبت نشده است"}
          </p>
          <p className="max-w-md text-body-2 text-on-surface-variant">
            {hasFilters
              ? "با تغییر فیلترها یا جست‌وجو دوباره امتحان کنید"
              : "اولین پرونده حقوقی خود را ثبت کنید تا LEGALIR در مدیریت آن به شما کمک کند"}
          </p>
          {hasFilters ? (
            <Button
              variant="outlined"
              onClick={clearAllFilters}
              startIcon={<IconClose size={18} />}
              className="mt-2"
            >
              پاک کردن فیلترها
            </Button>
          ) : (
            <Button
              onClick={() => setShowCreate(true)}
              startIcon={<IconAdd size={18} />}
              className="mt-2"
            >
              ثبت اولین پرونده
            </Button>
          )}
        </div>
      )}

      {/* Compact list */}
      {!loading && !error && cases.length > 0 && (
        <div className="mt-4 space-y-2.5">
          <ResultsBar
            countLabel={`${cases.length} نتیجه`}
            filters={activeFilters}
            onClearAll={clearAllFilters}
            className="px-0.5"
          />

          <div className="space-y-2.5">
            {cases.map((c) => (
              <article
                key={c.id}
                className="flex flex-col gap-3 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-3 transition-colors duration-short3 hover:border-[color:var(--color-outline)] tablet:flex-row tablet:items-center tablet:gap-4 tablet:p-4"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-primary-container text-primary-on-container"
                    aria-hidden="true"
                  >
                    <IconBalance size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="min-w-0 truncate text-titleSmall font-semibold text-on-surface">
                        {c.title}
                      </h3>
                      <StatusBadge label={CASE_STATUS_FA[c.status]} tone={CASE_STATUS_TONE[c.status]} />
                      <StatusBadge
                        label={CASE_PRIORITY_FA[c.priority]}
                        tone={PRIORITY_TONE[c.priority]}
                        dot={false}
                      />
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-caption text-on-surface-variant">
                      <span className="font-medium text-on-surface-variant">{CASE_CATEGORY_FA[c.category]}</span>
                      {c.internalRef && (
                        <>
                          <span aria-hidden="true" className="text-divider">·</span>
                          <span dir="ltr">{c.internalRef}</span>
                        </>
                      )}
                      {c.documentCount > 0 && (
                        <>
                          <span aria-hidden="true" className="text-divider">·</span>
                          <span>{c.documentCount} سند</span>
                        </>
                      )}
                      {c.taskCount > 0 && (
                        <>
                          <span aria-hidden="true" className="text-divider">·</span>
                          <span>{c.taskCount} وظیفه</span>
                        </>
                      )}
                      <span aria-hidden="true" className="text-divider">·</span>
                      <span>آخرین به‌روزرسانی: {toPersianDate(c.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 tablet:justify-end">
                  <Link
                    href={`/cases/${c.id}`}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-labelLarge font-medium text-primary-on transition-colors duration-short3 hover:bg-primary-700 hover:text-white focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 tablet:h-9 tablet:flex-none tablet:text-labelSmall"
                  >
                    مشاهده پرونده
                  </Link>

                  <OverflowMenu
                    label="گزینه‌های این پرونده"
                    size="small"
                    className="shrink-0"
                    items={[
                      ...(c.internalRef
                        ? [
                            {
                              key: "copy",
                              label: "کپی شناسه",
                              icon: <IconCopy size={16} />,
                              onSelect: () => handleCopyRef(c.internalRef!),
                            },
                          ]
                        : []),
                      {
                        key: "archive",
                        label: "بایگانی",
                        icon: <IconArchive size={16} />,
                        destructive: true,
                        onSelect: () => setArchiveTarget(c),
                      },
                    ]}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateCaseModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      <ArchiveCaseDialog
        target={archiveTarget}
        pending={archiving}
        onCancel={() => {
          if (!archiving) setArchiveTarget(null);
        }}
        onConfirm={handleConfirmArchive}
      />
    </PageContainer>
  );
}
