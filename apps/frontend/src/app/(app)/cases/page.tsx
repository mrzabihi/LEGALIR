"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TextField, Textarea, Select } from "@legalir/ui";
import { CASE_STATUS_FA, CASE_CATEGORY_FA, CASE_PRIORITY_FA } from "@legalir/types";
import type { CaseStatus, CaseCategory, CasePriority, CaseListItem } from "@legalir/types";
import { IconAdd, IconSearch, IconBalance } from "@/lib/icons";
import { PageIntroBanner, PromoArt } from "@/components/shared";

// ============================================================
// Status Badge Component
// ============================================================

// Semantic status tones — one token pair per state (a whisper of the hue as
// the fill, a readable text tone, a hairline border). Drawn from the theme's
// semantic roles so light and dark both work; the label is always rendered
// in text, so status is never colour-only.
const STATUS_COLORS: Record<CaseStatus, string> = {
  DRAFT: "bg-surface-container text-on-surface-variant border-divider",
  ACTIVE: "bg-info-50 text-info-700 border-info-200",
  UNDER_REVIEW: "bg-warning-50 text-warning-700 border-warning-200",
  WAITING_DOCUMENTS: "bg-secondary-container text-secondary-on-container border-secondary-200",
  LAWYER_ASSIGNED: "bg-success-50 text-success-700 border-success-200",
  CLOSED: "bg-success/10 text-success border-success/30",
  ARCHIVED: "bg-surface-container text-muted border-divider",
};

const PRIORITY_COLORS: Record<CasePriority, string> = {
  low: "bg-surface-container text-on-surface-variant border-divider",
  medium: "bg-info-50 text-info-700 border-info-200",
  high: "bg-warning-50 text-warning-700 border-warning-200",
  urgent: "bg-error-50 text-error-700 border-error-200",
};

// Category chip tints. Each is a single-hue tonal gradient drawn from the
// LEGALIR brand family (gold → green → teal) plus two muted semantic hues
// (caution red, finance blue) — no neon second hues. Two stops inside one
// hue read as a soft top-light, never as a saturated rainbow, and every chip
// stays close enough to its neighbour that nine of them in a list still scan
// as one family rather than nine competing palettes.
const CATEGORY_GRADIENTS: Record<CaseCategory, string> = {
  family: "from-[var(--brand-gold)] to-[var(--brand-gold-deep)]",
  contract: "from-[var(--brand-green)] to-[#174E3E]",
  property: "from-[var(--brand-gold-deep)] to-[#6E5526]",
  employment: "from-[#2F6F63] to-[var(--brand-green)]",
  business: "from-[#3B5A52] to-[var(--brand-teal)]",
  criminal: "from-[#B42318] to-[#7A1A12]",
  financial: "from-[#2563EB] to-[#1D4ED8]",
  tax: "from-[#6B7280] to-[#4B5563]",
  other: "from-[#9CA3AF] to-[#6B7280]",
};

function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-medium ${STATUS_COLORS[status]}`}>
      {CASE_STATUS_FA[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: CasePriority }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-caption font-medium ${PRIORITY_COLORS[priority]}`}>
      {CASE_PRIORITY_FA[priority]}
    </span>
  );
}

// ============================================================
// Create Case Modal
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface rounded-xlarge shadow-elevation-4 w-full max-w-lg mx-4 p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-h3 text-on-surface font-bold">ثبت پرونده جدید</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors" aria-label="بستن">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-muted">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
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
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-divider text-on-surface text-body-2 font-medium hover:bg-neutral-50 transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={creating || !form.title.trim()}
              className="flex-1 h-11 rounded-xl bg-primary text-primary-on text-body-2 font-medium hover:bg-primary-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "در حال ثبت..." : "ثبت پرونده"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  // Auto-open create modal when navigated from workflow ACTION phase
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setShowCreate(true);
    }
  }, [searchParams]);

  const fetchCases = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/v1/cases?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        setCases(j.data?.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleCreated = (id: string) => {
    setShowCreate(false);
    router.push(`/cases/${id}`);
  };

  const statusFilters = [
    { key: "all", label: "همه" },
    ...Object.entries(CASE_STATUS_FA).map(([key, label]) => ({ key, label })),
  ];

  return (
    <div className="p-4 tablet:p-6 max-w-6xl mx-auto" dir="rtl">
      {/* Page Header */}
      <PageIntroBanner
        className="mb-6"
        icon={IconBalance}
        title="پرونده‌های من"
        description="مدیریت و پیگیری پرونده‌های حقوقی"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-button font-medium text-primary-on hover:bg-primary-700 hover:text-white transition-colors active:scale-[0.98] shadow-sm touch-target tablet:w-auto"
          >
            <IconAdd size={20} />
            پرونده جدید
          </button>
        }
      />

      {/* Search & Filter Bar */}
      <div className="flex flex-col tablet:flex-row gap-3 mb-6">
        <div className="flex-1 max-w-xl">
          <TextField
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در پرونده‌ها..."
            aria-label="جستجو در پرونده‌ها"
            fullWidth
            leadingIcon={<IconSearch size={20} />}
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={[
                "shrink-0 rounded-xl border px-3 py-1.5 text-caption font-medium transition-all touch-target",
                statusFilter === f.key
                  ? "border-control-selected-border bg-control-selected-surface text-control-selected"
                  : "border-divider/60 bg-surface text-on-surface hover:border-control-selected/50",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-40 rounded-large bg-surface border border-divider skeleton-shimmer" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {/* The case-related artwork lives *only* here. A populated list is
          the user's own data and must never be displaced by a generic
          advertisement, so the visual is scoped to the empty state where
          it adds context instead of competing with real cases. */}
      {!loading && cases.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-full max-w-[220px]">
            <PromoArt art="two" alt="" sizes="(min-width: 600px) 220px, 200px" />
          </div>
          <p className="text-body-1 text-muted font-medium">هنوز پرونده‌ای ثبت نشده است</p>
          <p className="text-body-2 text-muted/60">
            اولین پرونده حقوقی خود را ثبت کنید تا LEGALIR در مدیریت آن به شما کمک کند
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 rounded-xl bg-primary text-primary-on px-6 py-2.5 text-button font-medium hover:bg-primary-700 hover:text-white transition-colors shadow-md shadow-primary/20 active:scale-[0.98] touch-target"
          >
            ثبت اولین پرونده
          </button>
        </div>
      )}

      {/* Cases Grid */}
      {!loading && cases.length > 0 && (
        <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/cases/${c.id}`}
              className="group flex flex-col rounded-large border border-divider bg-surface p-5 shadow-elevation-1 transition-shadow duration-short3 hover:border-primary hover:shadow-elevation-3"
            >
              {/* Category gradient accent + icon */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${CATEGORY_GRADIENTS[c.category]} flex items-center justify-center shrink-0 shadow-sm`}>
                  <IconBalance size={16} className="text-white" />
                </div>
                <span className="text-caption text-muted">{CASE_CATEGORY_FA[c.category]}</span>
              </div>

              <h3 className="text-body-1 text-on-surface font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                {c.title}
              </h3>

              {/* The LEGALIR internal reference — never an official court number. */}
              {c.internalRef && (
                <p className="text-caption text-muted/70 mb-2" dir="ltr">
                  شناسه لیگالیر: {c.internalRef}
                </p>
              )}

              {/* Badges */}
              <div className="flex items-center gap-2 mt-auto pt-3 border-t border-divider/40">
                <StatusBadge status={c.status} />
                <PriorityBadge priority={c.priority} />
                <div className="mr-auto flex items-center gap-3 text-caption text-muted">
                  {c.documentCount > 0 && (
                    <span>{c.documentCount} سند</span>
                  )}
                  {c.taskCount > 0 && (
                    <span>{c.taskCount} وظیفه</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateCaseModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}