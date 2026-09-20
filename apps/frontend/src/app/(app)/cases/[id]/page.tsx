"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CASE_STATUS_FA, CASE_CATEGORY_FA, CASE_PRIORITY_FA, CASE_TASK_STATUS_FA } from "@legalir/types";
import type { CaseStatus, CasePriority, CaseTaskStatus, CaseDetailResponse, CaseTask, CaseTimelineEvent } from "@legalir/types";
import { IconChevronRight, IconAdd, IconBalance, IconRefresh } from "@/lib/icons";

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

const TASK_STATUS_COLORS: Record<CaseTaskStatus, string> = {
  todo: "bg-neutral-100 text-neutral-600 border-neutral-200",
  in_progress: "bg-blue-50 text-blue-600 border-blue-200",
  done: "bg-green-50 text-green-600 border-green-200",
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

function TaskStatusBadge({ status }: { status: CaseTaskStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-caption font-medium ${TASK_STATUS_COLORS[status]}`}>
      {CASE_TASK_STATUS_FA[status]}
    </span>
  );
}

function TimelineEventItem({ event }: { event: CaseTimelineEvent }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 bg-surface shadow-sm flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 6v3l2 2" />
          </svg>
        </div>
        <div className="w-px flex-1 bg-divider/40" />
      </div>
      <div className="pb-5 flex-1 min-w-0">
        <p className="text-body-2 text-on-surface font-medium mb-0.5">{event.title}</p>
        <p className="text-caption text-muted mb-1">{event.description}</p>
        <span className="text-caption text-muted/70 tabular-nums">
          {new Date(event.createdAt).toLocaleDateString("fa-IR")}
        </span>
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: CaseTask }) {
  return (
    <div className={`flex items-center gap-3 p-3 py-4 rounded-xl border border-divider/60 ${task.status === "done" ? "opacity-60" : ""}`}>
      {task.status !== "done" ? (
        <input type="checkbox" defaultChecked={false} className="h-5 w-5 rounded border-divider accent-primary cursor-pointer" />
      ) : (
        <span className="h-5 w-5 flex items-center justify-center text-green-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-body-1 text-on-surface ${task.status === "done" ? "line-through text-muted" : ""}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <TaskStatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          {task.dueDate && (
            <span className="text-caption text-muted tabular-nums">
              {new Date(task.dueDate).toLocaleDateString("fa-IR")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CaseDetailPage() {
  const params = useParams();
  const id = params["id"] as string;
  const [data, setData] = useState<CaseDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState("");

  const fetchCase = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(`/api/v1/cases/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setData(j.data);
        else setError(j.message ?? "خطا در بارگذاری پرونده");
      })
      .catch(() => setError("خطا در اتصال به سرور"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchCase(); }, [fetchCase]);

  const tabs = [
    { key: "overview", label: "نمای کلی" },
    { key: "timeline", label: "تایم‌لاین" },
    { key: "tasks", label: "وظایف" },
    { key: "documents", label: "اسناد" },
    { key: "contracts", label: "قراردادها" },
  ];

  if (loading) {
    return (
      <div className="p-4 tablet:p-6 max-w-6xl mx-auto" dir="rtl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-neutral-200 rounded-lg" />
          <div className="h-4 w-32 bg-neutral-100 rounded-lg" />
          <div className="h-40 bg-neutral-50 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 tablet:p-6 max-w-6xl mx-auto" dir="rtl">
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="h-20 w-20 rounded-2xl bg-surface-container border border-divider/40 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" className="text-error/40">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
          </div>
          <p className="text-body-1 text-error font-medium">{error}</p>
          <button onClick={fetchCase} className="mt-3 rounded-xl border border-divider px-6 py-2.5 text-body-2 font-medium hover:bg-neutral-50 transition-colors">
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const caseData = data.case;

  return (
    <div className="p-4 tablet:p-6 max-w-6xl mx-auto" dir="rtl">
      <Link href="/cases" className="inline-flex items-center gap-1 text-body-2 text-muted hover:text-primary transition-colors mb-4">
        <IconChevronRight size={16} className="text-muted" />
        بازگشت به پرونده‌ها
      </Link>

      <div className="flex items-start tablet:items-center justify-between mb-5 flex-col tablet:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-h2 text-on-surface mb-2">{caseData.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-caption text-muted">{CASE_CATEGORY_FA[caseData.category]}</span>
            <StatusBadge status={caseData.status} />
            <PriorityBadge priority={caseData.priority} />
          </div>
        </div>
        <button onClick={fetchCase} className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-divider px-3 py-2 text-body-2 font-medium text-muted hover:bg-neutral-50 transition-colors touch-target">
          <IconRefresh size={16} />
          بروزرسانی
        </button>
      </div>

      {caseData.description && (
        <div className="mt-4 p-4 rounded-xl bg-surface-container border border-divider/60 text-body-2 text-on-surface">
          {caseData.description}
        </div>
      )}

      <div className="flex items-center gap-1 mt-6 mb-4 overflow-x-auto scrollbar-hide border-b border-divider/40">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              "shrink-0 px-4 py-2 text-body-2 font-medium transition-all touch-target",
              activeTab === tab.key ? "text-primary border-b-2 border-primary font-bold" : "text-muted hover:text-on-surface",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-surface border border-divider/60 p-5">
              <h3 className="text-titleMedium text-on-surface font-semibold mb-3">اطلاعات پرونده</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-caption text-muted">وضعیت</p><StatusBadge status={caseData.status} /></div>
                <div><p className="text-caption text-muted">اولویت</p><PriorityBadge priority={caseData.priority} /></div>
                <div><p className="text-caption text-muted">دسته‌بندی</p><p className="text-body-2 text-on-surface font-medium">{CASE_CATEGORY_FA[caseData.category]}</p></div>
                <div><p className="text-caption text-muted">تاریخ ایجاد</p><p className="text-body-2 text-on-surface font-medium tabular-nums">{new Date(caseData.createdAt).toLocaleDateString("fa-IR")}</p></div>
                <div><p className="text-caption text-muted">آخرین بروزرسانی</p><p className="text-body-2 text-on-surface font-medium tabular-nums">{new Date(caseData.updatedAt).toLocaleDateString("fa-IR")}</p></div>
                <div><p className="text-caption text-muted">وظایف</p><p className="text-body-2 text-on-surface font-medium">{data.tasks.length} عدد</p></div>
              </div>
            </div>
            <div className="rounded-2xl bg-surface border border-divider/60 p-5">
              <h3 className="text-titleMedium text-on-surface font-semibold mb-3">رویدادهای اخیر</h3>
              {data.timeline.length > 0 ? (
                <div className="space-y-1">
                  {data.timeline.slice(0, 5).map((evt) => (<TimelineEventItem key={evt.id} event={evt} />))}
                </div>
              ) : (<p className="text-body-2 text-muted">هیچ رویدادی ثبت نشده است.</p>)}
            </div>
          </div>
          <div className="rounded-2xl bg-surface border border-divider/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-titleMedium text-on-surface font-semibold">آخرین وظایف</h3>
              <button className="text-caption text-primary font-medium hover:text-primary-700" onClick={() => setActiveTab("tasks")}>مشاهده همه</button>
            </div>
            {data.tasks.length > 0 ? (
              <div className="space-y-3">{data.tasks.slice(0, 3).map((task) => (<TaskCard key={task.id} task={task} />))}</div>
            ) : (<p className="text-body-2 text-muted">هیچ وظیفه‌ای ثبت نشده است.</p>)}
          </div>
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="space-y-5">
          {data.timeline.length > 0 ? (
            data.timeline.map((evt) => <TimelineEventItem key={evt.id} event={evt} />)
          ) : (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-surface-container border border-divider/40 flex items-center justify-center">
                <IconBalance size={28} className="text-muted/40" />
              </div>
              <p className="text-body-1 text-muted font-medium">هیچ رویدادی ثبت نشده است</p>
              <p className="text-body-2 text-muted/60">با ثبت رویدادها، روند پرونده را مدیریت کنید</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-titleMedium text-on-surface font-semibold">
              وظایف {data.tasks.length > 0 ? `(${data.tasks.length})` : ""}
            </h3>
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-white px-4 py-2 text-caption font-medium hover:bg-primary-700 transition-colors active:scale-[0.98] touch-target">
              <IconAdd size={16} />
              وظیفه جدید
            </button>
          </div>
          <div className="space-y-3">
            {data.tasks.length > 0 ? (
              data.tasks.map((task) => (<TaskCard key={task.id} task={task} />))
            ) : (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <p className="text-body-1 text-muted font-medium">هیچ وظیفه‌ای ثبت نشده است</p>
                <p className="text-body-2 text-muted/60">وظایف مدیریت پرونده را اینجا اضافه کنید</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-surface-container border border-divider/40 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/40">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <p className="text-body-1 text-muted font-medium">در حال حاضر نمایش داده نمی‌شود</p>
          <p className="text-body-2 text-muted/60">اسناد مرتبط با پرونده را می‌توانید بارگذاری کنید</p>
          <Link href="/documents" className="mt-3 rounded-xl border border-divider px-5 py-2.5 text-body-2 font-medium hover:bg-neutral-50 transition-colors">
            رفتن به بارگذاری سند
          </Link>
        </div>
      )}

      {activeTab === "contracts" && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-surface-container border border-divider/40 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/40">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
          </div>
          <p className="text-body-1 text-muted font-medium">در حال حاضر قابل مشاهده نیست</p>
          <p className="text-body-2 text-muted/60">قراردادهای مرتبط با پرونده در این بخش نمایش داده می‌شوند</p>
          <Link href="/contracts" className="mt-3 rounded-xl border border-divider px-5 py-2.5 text-body-2 font-medium hover:bg-neutral-50 transition-colors">
            رفتن به قراردادها
          </Link>
        </div>
      )}

      <div className="mt-8 mb-4 p-6 rounded-2xl bg-gradient-to-r from-primary-50 to-blue-50 border border-primary/10 text-center">
        <p className="text-body-1 text-on-surface font-medium mb-1">نیاز به مشاوره در این پرونده دارید؟</p>
        <p className="text-body-2 text-muted mb-4">درباره این پرونده با مشاور هوش مصنوعی LEGALIR گفتگو کنید</p>
        <Link href="/chat" className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-6 py-2.5 text-button font-medium hover:bg-primary-700 transition-colors active:scale-[0.98] shadow-sm">
          شروع گفتگو
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rtl-flip">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}