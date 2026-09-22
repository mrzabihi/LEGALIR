"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TextField, Textarea, Select } from "@legalir/ui";
import { CASE_STATUS_FA, CASE_CATEGORY_FA, CASE_PRIORITY_FA } from "@legalir/types";
import type { CaseStatus, CaseCategory, CasePriority, CaseListItem } from "@legalir/types";
import { IconAdd, IconSearch, IconBalance } from "@/lib/icons";

// ============================================================
// Status Badge Component
// ============================================================

const STATUS_COLORS: Record<CaseStatus, string> = {
  DRAFT: "bg-neutral-100 text-neutral-700 border-neutral-200",
  ACTIVE: "bg-blue-50 text-blue-700 border-blue-200",
  UNDER_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
  WAITING_DOCUMENTS: "bg-purple-50 text-purple-700 border-purple-200",
  LAWYER_ASSIGNED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CLOSED: "bg-green-50 text-green-700 border-green-200",
  ARCHIVED: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

const PRIORITY_COLORS: Record<CasePriority, string> = {
  low: "bg-neutral-50 text-neutral-600 border-neutral-200",
  medium: "bg-blue-50 text-blue-600 border-blue-200",
  high: "bg-amber-50 text-amber-600 border-amber-200",
  urgent: "bg-red-50 text-red-600 border-red-200",
};

const CATEGORY_GRADIENTS: Record<CaseCategory, string> = {
  family: "from-pink-500 to-rose-500",
  contract: "from-blue-500 to-indigo-500",
  property: "from-amber-500 to-orange-500",
  employment: "from-emerald-500 to-teal-500",
  business: "from-violet-500 to-purple-500",
  criminal: "from-red-500 to-rose-500",
  financial: "from-cyan-500 to-blue-500",
  tax: "from-stone-500 to-neutral-500",
  other: "from-slate-500 to-gray-500",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        className="bg-surface rounded-2xl shadow-elevation-4 w-full max-w-lg mx-4 p-6 animate-in"
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
              className="flex-1 h-11 rounded-xl bg-primary text-white text-body-2 font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-h2 text-on-surface mb-1">پرونده‌های من</h1>
          <p className="text-body-2 text-muted">مدیریت و پیگیری پرونده‌های حقوقی</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-button font-medium hover:bg-primary-700 transition-colors active:scale-[0.98] shadow-sm touch-target"
        >
          <IconAdd size={20} />
          پرونده جدید
        </button>
      </div>

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
                "shrink-0 rounded-xl px-3 py-1.5 text-caption font-medium transition-all touch-target",
                statusFilter === f.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface text-on-surface hover:bg-surface-hover border border-divider/60",
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
            <div key={i} className="h-40 rounded-2xl bg-surface border border-divider/60 skeleton-shimmer" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && cases.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="h-20 w-20 rounded-2xl bg-surface-container border border-divider/40 flex items-center justify-center">
            <IconBalance size={36} className="text-muted/40" />
          </div>
          <p className="text-body-1 text-muted font-medium">هنوز پرونده‌ای ثبت نشده است</p>
          <p className="text-body-2 text-muted/60">
            اولین پرونده حقوقی خود را ثبت کنید تا LEGALIR در مدیریت آن به شما کمک کند
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 rounded-xl bg-gradient-to-r from-primary-700 to-primary-800 text-white px-6 py-2.5 text-button font-medium hover:from-primary-800 hover:to-primary-900 transition-all shadow-md shadow-primary/20 active:scale-[0.98] touch-target"
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
              className="group rounded-2xl bg-surface border border-divider/60 p-5 shadow-elevation-1 hover:shadow-elevation-3 hover:border-primary-200 transition-all duration-200 flex flex-col"
            >
              {/* Category gradient accent + icon */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${CATEGORY_GRADIENTS[c.category]} flex items-center justify-center shrink-0 shadow-sm`}>
                  <IconBalance size={16} className="text-white" />
                </div>
                <span className="text-caption text-muted">{CASE_CATEGORY_FA[c.category]}</span>
              </div>

              <h3 className="text-body-1 text-on-surface font-semibold mb-2 group-hover:text-primary-700 transition-colors line-clamp-2">
                {c.title}
              </h3>

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