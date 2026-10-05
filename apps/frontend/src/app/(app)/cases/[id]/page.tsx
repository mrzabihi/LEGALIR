"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TextField, Select, Checkbox } from "@legalir/ui";
import {
  CASE_CATEGORY_FA,
  CASE_PRIORITY_FA,
  CASE_LIFECYCLE_FA,
  CASE_PROCEEDING_PATH_FA,
  CASE_STAGE_FA,
  CASE_MEMBER_ROLE_FA,
  CASE_LEGAL_ROLE_FA,
  CASE_INFO_SOURCE_FA,
  CASE_EVENT_FA,
  CASE_TASK_STATUS_V2_FA,
  CASE_TASK_ACTION_FA,
  CASE_DEADLINE_KIND_FA,
  CASE_DEADLINE_REVIEW_FA,
  CASE_DEADLINE_OPERATIONAL_FA,
  LAWYER_ENGAGEMENT_FA,
  LAWYER_ENGAGEMENT_KIND_FA,
  CASE_CONTRACT_KIND_FA,
  legalRolesForPath,
} from "@legalir/types";
import { stagesForPath } from "@/lib/cases/domain";
import type {
  CaseDetailResponseV2,
  CaseLifecycleStatus,
  CasePriority,
  CaseTaskStatusV2,
  CaseTaskActionType,
  CaseDeadlineKind,
  CaseEventType,
  CaseLegalRole,
  CaseProceedingPath,
  CaseStageKey,
  CaseInfoSource,
} from "@legalir/types";
import { IconChevronRight, IconAdd, IconBalance, IconRefresh, IconArchive, IconUsers, IconGavel } from "@/lib/icons";

// ============================================================
// Badges
// ============================================================

const LIFECYCLE_COLORS: Record<CaseLifecycleStatus, string> = {
  ACTIVE: "bg-blue-50 text-blue-700 border-blue-200",
  ON_HOLD: "bg-amber-50 text-amber-700 border-amber-200",
  CLOSED: "bg-green-50 text-green-700 border-green-200",
  ARCHIVED: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

const PRIORITY_COLORS: Record<CasePriority, string> = {
  low: "bg-neutral-50 text-neutral-600 border-neutral-200",
  medium: "bg-blue-50 text-blue-600 border-blue-200",
  high: "bg-amber-50 text-amber-600 border-amber-200",
  urgent: "bg-red-50 text-red-600 border-red-200",
};

const TASK_STATUS_COLORS: Record<CaseTaskStatusV2, string> = {
  todo: "bg-neutral-100 text-neutral-600 border-neutral-200",
  in_progress: "bg-blue-50 text-blue-600 border-blue-200",
  blocked: "bg-amber-50 text-amber-700 border-amber-200",
  done: "bg-green-50 text-green-600 border-green-200",
  cancelled: "bg-neutral-100 text-neutral-400 border-neutral-200",
};

const DEADLINE_KIND_COLORS: Record<CaseDeadlineKind, string> = {
  legal: "bg-red-50 text-red-700 border-red-200",
  internal: "bg-blue-50 text-blue-700 border-blue-200",
  hearing: "bg-purple-50 text-purple-700 border-purple-200",
};

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-medium ${className}`}>
      {children}
    </span>
  );
}

function faDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fa-IR");
}

// ============================================================
// Next-action card
// ============================================================

function NextActionCard({
  action,
  onGo,
}: {
  action: CaseDetailResponseV2["nextAction"];
  onGo: (tab: string) => void;
}) {
  const tone =
    action.kind === "none"
      ? "border-divider/60 bg-surface-container"
      : action.kind === "hearing"
        ? "border-purple-200 bg-purple-50"
        : action.kind === "deadline"
          ? "border-red-200 bg-red-50"
          : "border-primary/20 bg-primary-50";
  return (
    <div className={`rounded-2xl border p-5 ${tone}`}>
      <p className="text-caption text-muted mb-1">اقدام بعدی</p>
      <p className="text-titleMedium text-on-surface font-semibold mb-1">{action.title}</p>
      <p className="text-body-2 text-muted mb-3">{action.reason}</p>
      <div className="flex items-center gap-3 flex-wrap">
        {action.dueAt && <span className="text-caption text-muted tabular-nums">موعد: {faDate(action.dueAt)}</span>}
        {action.kind !== "none" && (
          <button
            onClick={() => onGo(action.targetTab)}
            className="rounded-xl bg-primary text-white px-4 py-2 text-caption font-medium hover:bg-primary-700 transition-colors"
          >
            مشاهده
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Stage path
// ============================================================

function StagePath({
  path,
  stage,
  source,
  recordedAt,
}: {
  path: CaseProceedingPath;
  stage: CaseStageKey;
  source: CaseInfoSource;
  recordedAt: string | null;
}) {
  return (
    <div className="rounded-2xl bg-surface border border-divider/60 p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-titleMedium text-on-surface font-semibold">مسیر رسیدگی</h3>
        <Badge className="bg-neutral-50 text-neutral-600 border-neutral-200">{CASE_PROCEEDING_PATH_FA[path]}</Badge>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-caption text-muted">مرحله فعلی:</span>
        <span className="text-body-2 text-on-surface font-semibold">{CASE_STAGE_FA[stage]}</span>
      </div>
      <p className="mt-2 text-caption text-muted">
        منبع: {CASE_INFO_SOURCE_FA[source]} · ثبت: {faDate(recordedAt)}
      </p>
      <p className="mt-3 text-caption text-muted/70 leading-relaxed">
        مراحل پیشین این مسیر به‌صورت خودکار «طی‌شده» فرض نمی‌شوند؛ تنها رویدادهای ثبت‌شده در تایم‌لاین معتبرند.
      </p>
    </div>
  );
}

// ============================================================
// Main page
// ============================================================

export default function CaseDetailPage() {
  const params = useParams();
  const id = params["id"] as string;
  const [data, setData] = useState<CaseDetailResponseV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Documents tab
  const [availableDocs, setAvailableDocs] = useState<{ id: string; name: string }[]>([]);
  const [showAttach, setShowAttach] = useState(false);

  // Deadlines tab
  const [showDeadlineForm, setShowDeadlineForm] = useState(false);
  const [deadlineTitle, setDeadlineTitle] = useState("");
  const [deadlineDueAt, setDeadlineDueAt] = useState("");
  const [deadlineKind, setDeadlineKind] = useState<CaseDeadlineKind>("legal");

  // Tasks tab
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAction, setTaskAction] = useState<CaseTaskActionType>("general");

  // Timeline tab
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventType, setEventType] = useState<CaseEventType>("note_added");
  const [eventTitle, setEventTitle] = useState("");
  const [eventOccurredAt, setEventOccurredAt] = useState("");

  // Parties tab
  const [showPartyForm, setShowPartyForm] = useState(false);
  const [partyName, setPartyName] = useState("");
  const [partyRole, setPartyRole] = useState<CaseLegalRole>("plaintiff");

  // Stage / path editor
  const [showStageForm, setShowStageForm] = useState(false);
  const [stagePath, setStagePath] = useState<CaseProceedingPath>("other");
  const [stageKey, setStageKey] = useState<CaseStageKey>("unknown");
  const [stageReason, setStageReason] = useState("");

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

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  // --- Documents ---

  const loadAvailableDocs = useCallback(() => {
    fetch("/api/v1/documents?pageSize=100")
      .then((r) => r.json())
      .then((j) => setAvailableDocs(j.data?.items ?? []))
      .catch(() => setAvailableDocs([]));
  }, []);

  const attachDocument = useCallback(
    (documentId: string) => {
      setBusy(true);
      fetch(`/api/v1/cases/${id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j.data) {
            setShowAttach(false);
            fetchCase();
          }
        })
        .finally(() => setBusy(false));
    },
    [id, fetchCase]
  );

  const detachDocument = useCallback(
    (documentId: string) => {
      setBusy(true);
      fetch(`/api/v1/cases/${id}/documents?documentId=${encodeURIComponent(documentId)}`, { method: "DELETE" })
        .then(() => fetchCase())
        .finally(() => setBusy(false));
    },
    [id, fetchCase]
  );

  // --- Deadlines ---

  const addDeadline = useCallback(() => {
    if (!deadlineTitle.trim() || !deadlineDueAt) return;
    setBusy(true);
    fetch(`/api/v1/cases/${id}/deadlines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: deadlineTitle.trim(),
        dueAt: deadlineDueAt,
        kind: deadlineKind,
        dateOnly: true,
        source: "user",
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setDeadlineTitle("");
          setDeadlineDueAt("");
          setShowDeadlineForm(false);
          fetchCase();
        }
      })
      .finally(() => setBusy(false));
  }, [id, deadlineTitle, deadlineDueAt, deadlineKind, fetchCase]);

  const setDeadlineState = useCallback(
    (deadlineId: string, operationalState: string) => {
      setBusy(true);
      fetch(`/api/v1/cases/${id}/deadlines`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadlineId, operationalState }),
      })
        .then(() => fetchCase())
        .finally(() => setBusy(false));
    },
    [id, fetchCase]
  );

  // --- Tasks ---

  const addTask = useCallback(() => {
    if (!taskTitle.trim()) return;
    setBusy(true);
    fetch(`/api/v1/cases/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: taskTitle.trim(), actionType: taskAction }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setTaskTitle("");
          setShowTaskForm(false);
          fetchCase();
        }
      })
      .finally(() => setBusy(false));
  }, [id, taskTitle, taskAction, fetchCase]);

  const setTaskStatus = useCallback(
    (taskId: string, status: CaseTaskStatusV2) => {
      setBusy(true);
      fetch(`/api/v1/cases/${id}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
        .then(() => fetchCase())
        .finally(() => setBusy(false));
    },
    [id, fetchCase]
  );

  // --- Timeline ---

  const addEvent = useCallback(() => {
    if (!eventTitle.trim()) return;
    setBusy(true);
    fetch(`/api/v1/cases/${id}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        title: eventTitle.trim(),
        occurredAt: eventOccurredAt ? new Date(eventOccurredAt).toISOString() : undefined,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setEventTitle("");
          setEventOccurredAt("");
          setShowEventForm(false);
          fetchCase();
        }
      })
      .finally(() => setBusy(false));
  }, [id, eventType, eventTitle, eventOccurredAt, fetchCase]);

  // --- Parties ---

  const addParty = useCallback(() => {
    if (!partyName.trim()) return;
    setBusy(true);
    fetch(`/api/v1/cases/${id}/parties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: partyName.trim(),
        legalRole: partyRole,
        proceedingId: data?.proceeding?.id ?? null,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setPartyName("");
          setShowPartyForm(false);
          fetchCase();
        }
      })
      .finally(() => setBusy(false));
  }, [id, partyName, partyRole, data, fetchCase]);

  // --- Stage / path ---

  const changeStage = useCallback(() => {
    if (!data?.proceeding || !stageReason.trim()) return;
    setBusy(true);
    fetch(`/api/v1/cases/${id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proceedingId: data.proceeding.id,
        path: stagePath,
        stage: stageKey,
        reason: stageReason.trim(),
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setStageReason("");
          setShowStageForm(false);
          fetchCase();
        }
      })
      .finally(() => setBusy(false));
  }, [id, data, stagePath, stageKey, stageReason, fetchCase]);

  // --- Lifecycle ---

  const archiveCase = useCallback(() => {
    setBusy(true);
    fetch(`/api/v1/cases/${id}`, { method: "DELETE" })
      .then(() => fetchCase())
      .finally(() => setBusy(false));
  }, [id, fetchCase]);

  const tabs = [
    { key: "overview", label: "نمای کلی" },
    { key: "timeline", label: "تایم‌لاین" },
    { key: "tasks", label: "وظایف" },
    { key: "documents", label: "اسناد" },
    { key: "deadlines", label: "مهلت‌ها" },
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
          <button
            onClick={fetchCase}
            className="mt-3 rounded-xl border border-divider px-6 py-2.5 text-body-2 font-medium hover:bg-neutral-50 transition-colors"
          >
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const caseData = data.case;
  const lifecycle = caseData.lifecycle ?? "ACTIVE";
  const canWrite =
    caseData.viewerRole === "owner" || caseData.viewerRole === "lawyer" || caseData.viewerRole === "limited";

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
            <Badge className={LIFECYCLE_COLORS[lifecycle]}>{CASE_LIFECYCLE_FA[lifecycle]}</Badge>
            <Badge className={PRIORITY_COLORS[caseData.priority]}>{CASE_PRIORITY_FA[caseData.priority]}</Badge>
            <Badge className="bg-neutral-50 text-neutral-600 border-neutral-200">
              {CASE_MEMBER_ROLE_FA[caseData.viewerRole]}
            </Badge>
          </div>
          <p className="mt-2 text-caption text-muted">
            شناسه لیگالیر: <span className="font-medium text-on-surface tabular-nums">{caseData.internalRef}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchCase}
            className="inline-flex items-center gap-1.5 rounded-xl border border-divider px-3 py-2 text-body-2 font-medium text-muted hover:bg-neutral-50 transition-colors touch-target"
          >
            <IconRefresh size={16} />
            بروزرسانی
          </button>
          {caseData.viewerRole === "owner" && lifecycle !== "ARCHIVED" && (
            <button
              onClick={archiveCase}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-divider px-3 py-2 text-body-2 font-medium text-muted hover:text-error hover:border-error/40 transition-colors touch-target disabled:opacity-50"
            >
              <IconArchive size={16} />
              بایگانی
            </button>
          )}
        </div>
      </div>

      {caseData.description && (
        <div className="mt-4 p-4 rounded-xl bg-surface-container border border-divider/60 text-body-2 text-on-surface">
          {caseData.description}
        </div>
      )}

      <div className="mt-5">
        <NextActionCard action={data.nextAction} onGo={setActiveTab} />
      </div>

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

      {/* ================= OVERVIEW ================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-surface border border-divider/60 p-5">
              <h3 className="text-titleMedium text-on-surface font-semibold mb-3">اطلاعات پرونده</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-caption text-muted">وضعیت داخلی</p>
                  <Badge className={LIFECYCLE_COLORS[lifecycle]}>{CASE_LIFECYCLE_FA[lifecycle]}</Badge>
                </div>
                <div>
                  <p className="text-caption text-muted">اولویت</p>
                  <Badge className={PRIORITY_COLORS[caseData.priority]}>{CASE_PRIORITY_FA[caseData.priority]}</Badge>
                </div>
                <div>
                  <p className="text-caption text-muted">دسته‌بندی</p>
                  <p className="text-body-2 text-on-surface font-medium">{CASE_CATEGORY_FA[caseData.category]}</p>
                </div>
                <div>
                  <p className="text-caption text-muted">تاریخ ایجاد</p>
                  <p className="text-body-2 text-on-surface font-medium tabular-nums">{faDate(caseData.createdAt)}</p>
                </div>
                <div>
                  <p className="text-caption text-muted">آخرین بروزرسانی</p>
                  <p className="text-body-2 text-on-surface font-medium tabular-nums">{faDate(caseData.updatedAt)}</p>
                </div>
                <div>
                  <p className="text-caption text-muted">وظایف باز</p>
                  <p className="text-body-2 text-on-surface font-medium">
                    {data.tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length} عدد
                  </p>
                </div>
              </div>
            </div>

            {data.proceeding ? (
              <div className="space-y-3">
                <StagePath
                  path={data.proceeding.path}
                  stage={data.proceeding.stage}
                  source={data.proceeding.stageSource}
                  recordedAt={data.proceeding.stageRecordedAt}
                />
                {canWrite && (
                  <div className="rounded-2xl bg-surface border border-divider/60 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-titleMedium text-on-surface font-semibold">تغییر مسیر و مرحله</h3>
                      <button
                        onClick={() => {
                          setStagePath(data.proceeding!.path);
                          setStageKey(data.proceeding!.stage);
                          setShowStageForm((v) => !v);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-divider px-3 py-1.5 text-caption font-medium text-muted hover:text-on-surface transition-colors"
                      >
                        {showStageForm ? "بستن" : "ویرایش"}
                      </button>
                    </div>
                    {showStageForm && (
                      <div className="space-y-3">
                        <Select
                          label="مسیر رسیدگی"
                          value={stagePath}
                          onChange={(e) => {
                            const p = e.target.value as CaseProceedingPath;
                            setStagePath(p);
                            setStageKey("unknown");
                          }}
                          fullWidth
                          options={(["civil", "criminal", "family", "enforcement", "other"] as CaseProceedingPath[]).map(
                            (p) => ({ value: p, label: CASE_PROCEEDING_PATH_FA[p] })
                          )}
                        />
                        <Select
                          label="مرحله"
                          value={stageKey}
                          onChange={(e) => setStageKey(e.target.value as CaseStageKey)}
                          fullWidth
                          options={stagesForPath(stagePath).map((s) => ({ value: s, label: CASE_STAGE_FA[s] }))}
                        />
                        <TextField
                          label="دلیل تغییر"
                          value={stageReason}
                          onChange={(e) => setStageReason(e.target.value)}
                          placeholder="مثلاً: تعیین تاریخ جلسه رسیدگی"
                          helperText="دلیل تغییر مرحله الزامی است و در تایم‌لاین ثبت می‌شود."
                          fullWidth
                        />
                        <button
                          disabled={busy || !stageReason.trim()}
                          onClick={changeStage}
                          className="rounded-xl bg-primary text-white px-4 py-2 text-caption font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                        >
                          ثبت تغییر مرحله
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-surface border border-divider/60 p-5">
                <h3 className="text-titleMedium text-on-surface font-semibold mb-3">مسیر رسیدگی</h3>
                <p className="text-body-2 text-muted">
                  هنوز مسیر رسیدگی ثبت نشده است. مسیر و مرحله پرونده را در بخش اطلاعات تکمیل کنید.
                </p>
              </div>
            )}
          </div>

          {/* Parties */}
          <div className="rounded-2xl bg-surface border border-divider/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-titleMedium text-on-surface font-semibold">طرف‌های پرونده</h3>
              {canWrite && (
                <button
                  onClick={() => setShowPartyForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-white px-3 py-1.5 text-caption font-medium hover:bg-primary-700 transition-colors"
                >
                  <IconAdd size={14} />
                  افزودن طرف
                </button>
              )}
            </div>

            {showPartyForm && (
              <div className="mb-4 rounded-xl border border-divider/60 p-3 space-y-3">
                <TextField
                  label="نام طرف"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="نام شخص یا نهاد"
                  fullWidth
                />
                <Select
                  label="نقش حقوقی"
                  value={partyRole}
                  onChange={(e) => setPartyRole(e.target.value as CaseLegalRole)}
                  fullWidth
                  options={legalRolesForPath(data.proceeding?.path ?? "other").map((r) => ({
                    value: r,
                    label: CASE_LEGAL_ROLE_FA[r],
                  }))}
                />
                <div className="flex items-center gap-2">
                  <button
                    disabled={busy || !partyName.trim()}
                    onClick={addParty}
                    className="rounded-xl bg-primary text-white px-4 py-2 text-caption font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    ثبت
                  </button>
                  <button
                    onClick={() => setShowPartyForm(false)}
                    className="rounded-xl border border-divider px-4 py-2 text-caption text-muted hover:text-on-surface transition-colors"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            )}

            {data.parties.length > 0 ? (
              <div className="space-y-2">
                {data.parties.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-divider/60 px-3 py-2.5">
                    <span className="text-body-2 text-on-surface">{p.name}</span>
                    <Badge className="bg-neutral-50 text-neutral-600 border-neutral-200">{CASE_LEGAL_ROLE_FA[p.legalRole]}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-body-2 text-muted">طرفی ثبت نشده است. افزودن طرف هیچ حساب کاربری ایجاد نمی‌کند.</p>
            )}
          </div>

          {/* Members */}
          <div className="rounded-2xl bg-surface border border-divider/60 p-5">
            <h3 className="text-titleMedium text-on-surface font-semibold mb-3 flex items-center gap-2">
              <IconUsers size={18} className="text-muted" />
              دسترسی‌ها
            </h3>
            {data.members.length > 0 ? (
              <div className="space-y-2">
                {data.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-divider/60 px-3 py-2.5">
                    <span className="text-body-2 text-on-surface tabular-nums">{m.accountId}</span>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-neutral-50 text-neutral-600 border-neutral-200">{CASE_MEMBER_ROLE_FA[m.role]}</Badge>
                      {m.status === "revoked" && (
                        <Badge className="bg-neutral-100 text-neutral-400 border-neutral-200">لغو‌شده</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-body-2 text-muted">دسترسی دیگری ثبت نشده است.</p>
            )}
          </div>

          {/* Engagements + representations */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-surface border border-divider/60 p-5">
              <h3 className="text-titleMedium text-on-surface font-semibold mb-3">همکاری وکیل</h3>
              {data.engagements.length > 0 ? (
                <div className="space-y-2">
                  {data.engagements.map((e) => (
                    <div key={e.id} className="rounded-xl border border-divider/60 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body-2 text-on-surface">{LAWYER_ENGAGEMENT_KIND_FA[e.kind]}</span>
                        <Badge className="bg-neutral-50 text-neutral-600 border-neutral-200">{LAWYER_ENGAGEMENT_FA[e.state]}</Badge>
                      </div>
                      <p className="mt-1 text-caption text-muted">دامنه: {e.sharedScopes.join("، ") || "—"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-body-2 text-muted">درخواست همکاری با وکیلی ثبت نشده است.</p>
              )}
            </div>

            <div className="rounded-2xl bg-surface border border-divider/60 p-5">
              <h3 className="text-titleMedium text-on-surface font-semibold mb-3 flex items-center gap-2">
                <IconGavel size={18} className="text-muted" />
                وکالت‌نامه‌ها
              </h3>
              {data.representations.length > 0 ? (
                <div className="space-y-2">
                  {data.representations.map((r) => (
                    <div key={r.id} className="rounded-xl border border-divider/60 px-3 py-2.5">
                      <p className="text-body-2 text-on-surface">{r.documentType}</p>
                      {r.referenceNumber && <p className="mt-1 text-caption text-muted tabular-nums">{r.referenceNumber}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-body-2 text-muted">وکالت‌نامه‌ای ثبت نشده است.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= TIMELINE ================= */}
      {activeTab === "timeline" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-titleMedium text-on-surface font-semibold">
              تایم‌لاین {data.timeline.length > 0 ? `(${data.timeline.length})` : ""}
            </h3>
            {canWrite && (
              <button
                onClick={() => setShowEventForm((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-white px-4 py-2 text-caption font-medium hover:bg-primary-700 transition-colors"
              >
                <IconAdd size={16} />
                ثبت رویداد
              </button>
            )}
          </div>

          {showEventForm && (
            <div className="rounded-2xl border border-divider/60 bg-surface p-4 space-y-3">
              <Select
                label="نوع رویداد"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as CaseEventType)}
                fullWidth
                options={(
                  [
                    "hearing",
                    "service_notice",
                    "filing_recorded",
                    "judgment",
                    "appeal_noted",
                    "enforcement_action",
                    "note_added",
                  ] as CaseEventType[]
                ).map((t) => ({ value: t, label: CASE_EVENT_FA[t] }))}
              />
              <TextField
                label="عنوان رویداد"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="مثلاً: جلسه رسیدگی شعبه ۱۲"
                fullWidth
              />
              <TextField
                type="date"
                label="تاریخ وقوع (اختیاری)"
                value={eventOccurredAt}
                onChange={(e) => setEventOccurredAt(e.target.value)}
                helperText="اگر رویداد در گذشته رخ داده، تاریخ واقعی آن را وارد کنید."
                fullWidth
              />
              <div className="flex items-center gap-2">
                <button
                  disabled={busy || !eventTitle.trim()}
                  onClick={addEvent}
                  className="rounded-xl bg-primary text-white px-4 py-2 text-caption font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  ثبت رویداد
                </button>
                <button
                  onClick={() => setShowEventForm(false)}
                  className="rounded-xl border border-divider px-4 py-2 text-caption text-muted hover:text-on-surface transition-colors"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}

          {data.timeline.length > 0 ? (
            <div className="space-y-1">
              {data.timeline.map((evt) => {
                const late = evt.occurredAt.slice(0, 10) !== evt.recordedAt.slice(0, 10);
                return (
                  <div key={evt.id} className="flex gap-3">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-body-2 text-on-surface font-medium">{evt.title}</p>
                        <Badge className="bg-neutral-50 text-neutral-600 border-neutral-200">{CASE_EVENT_FA[evt.eventType]}</Badge>
                        {late && <Badge className="bg-amber-50 text-amber-700 border-amber-200">بعداً ثبت شده</Badge>}
                        {evt.visibility === "private" && (
                          <Badge className="bg-neutral-100 text-neutral-500 border-neutral-200">خصوصی</Badge>
                        )}
                      </div>
                      {evt.description && <p className="text-caption text-muted mt-1">{evt.description}</p>}
                      <p className="text-caption text-muted/70 tabular-nums mt-1">
                        وقوع: {faDate(evt.occurredAt)} · ثبت: {faDate(evt.recordedAt)} · منبع: {CASE_INFO_SOURCE_FA[evt.source]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
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

      {/* ================= TASKS ================= */}
      {activeTab === "tasks" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-titleMedium text-on-surface font-semibold">
              وظایف {data.tasks.length > 0 ? `(${data.tasks.length})` : ""}
            </h3>
            {canWrite && (
              <button
                onClick={() => setShowTaskForm((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-white px-4 py-2 text-caption font-medium hover:bg-primary-700 transition-colors"
              >
                <IconAdd size={16} />
                وظیفه جدید
              </button>
            )}
          </div>

          {showTaskForm && (
            <div className="rounded-2xl border border-divider/60 bg-surface p-4 space-y-3">
              <TextField
                label="عنوان وظیفه"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="مثلاً: آماده‌سازی مدارک جلسه"
                fullWidth
              />
              <Select
                label="نوع اقدام"
                value={taskAction}
                onChange={(e) => setTaskAction(e.target.value as CaseTaskActionType)}
                fullWidth
                options={(
                  [
                    "general",
                    "document",
                    "filing",
                    "hearing_prep",
                    "deadline_action",
                    "followup",
                    "payment",
                  ] as CaseTaskActionType[]
                ).map((a) => ({ value: a, label: CASE_TASK_ACTION_FA[a] }))}
              />
              <div className="flex items-center gap-2">
                <button
                  disabled={busy || !taskTitle.trim()}
                  onClick={addTask}
                  className="rounded-xl bg-primary text-white px-4 py-2 text-caption font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  ثبت وظیفه
                </button>
                <button
                  onClick={() => setShowTaskForm(false)}
                  className="rounded-xl border border-divider px-4 py-2 text-caption text-muted hover:text-on-surface transition-colors"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}

          {data.tasks.length > 0 ? (
            <div className="space-y-3">
              {data.tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 p-3 py-4 rounded-xl border border-divider/60 ${task.status === "done" ? "opacity-60" : ""}`}
                >
                  <Checkbox
                    checked={task.status === "done"}
                    disabled={busy || !canWrite}
                    onChange={(e) => setTaskStatus(task.id, e.target.checked ? "done" : "todo")}
                    aria-label={task.title}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-body-1 text-on-surface ${task.status === "done" ? "line-through text-muted" : ""}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge className={TASK_STATUS_COLORS[task.status]}>{CASE_TASK_STATUS_V2_FA[task.status]}</Badge>
                      <Badge className={PRIORITY_COLORS[task.priority]}>{CASE_PRIORITY_FA[task.priority]}</Badge>
                      <Badge className="bg-neutral-50 text-neutral-600 border-neutral-200">{CASE_TASK_ACTION_FA[task.actionType]}</Badge>
                      {task.dueDate && <span className="text-caption text-muted tabular-nums">{faDate(task.dueDate)}</span>}
                      {task.resultIsClaim && <Badge className="bg-amber-50 text-amber-700 border-amber-200">اعلامی</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <p className="text-body-1 text-muted font-medium">هیچ وظیفه‌ای ثبت نشده است</p>
              <p className="text-body-2 text-muted/60">وظایف مدیریت پرونده را اینجا اضافه کنید</p>
            </div>
          )}
        </div>
      )}

      {/* ================= DOCUMENTS ================= */}
      {activeTab === "documents" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-titleMedium text-on-surface font-semibold">
              اسناد {data.documents.length > 0 ? `(${data.documents.length})` : ""}
            </h3>
            {canWrite && (
              <button
                onClick={() => {
                  setShowAttach((v) => !v);
                  if (!showAttach) loadAvailableDocs();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-white px-4 py-2 text-caption font-medium hover:bg-primary-700 transition-colors"
              >
                <IconAdd size={16} />
                افزودن سند
              </button>
            )}
          </div>

          {showAttach && (
            <div className="rounded-2xl border border-divider/60 bg-surface p-4">
              <p className="text-body-2 text-on-surface font-medium mb-3">انتخاب سند از اسناد شما</p>
              {availableDocs.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-body-2 text-muted">سندی برای افزودن موجود نیست.</p>
                  <Link href="/documents/upload" className="mt-2 inline-block text-caption text-primary font-medium">
                    بارگذاری سند جدید
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {availableDocs
                    .filter((d) => !data.documents.some((cd) => cd.id === d.id))
                    .map((d) => (
                      <button
                        key={d.id}
                        disabled={busy}
                        onClick={() => attachDocument(d.id)}
                        className="w-full flex items-center justify-between gap-3 rounded-xl border border-divider/60 px-3 py-2.5 text-right hover:border-primary/40 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                      >
                        <span className="truncate text-body-2 text-on-surface">{d.name}</span>
                        <span className="shrink-0 text-caption text-primary font-medium">افزودن</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {data.documents.length > 0 ? (
            <div className="space-y-3">
              {data.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-4 rounded-2xl border border-divider/60 bg-surface p-4">
                  <Link href={`/documents/${doc.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-body-1 font-semibold text-on-surface">{doc.name}</p>
                    <p className="mt-1 text-caption text-muted tabular-nums">{faDate(doc.linkedAt)}</p>
                  </Link>
                  {canWrite && (
                    <button
                      disabled={busy}
                      onClick={() => detachDocument(doc.id)}
                      className="shrink-0 rounded-lg border border-divider px-3 py-1.5 text-caption text-muted hover:text-error hover:border-error/40 transition-colors disabled:opacity-50"
                    >
                      حذف
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-surface-container border border-divider/40 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/40">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <p className="text-body-1 text-muted font-medium">هیچ سندی به این پرونده پیوست نشده است</p>
              <p className="text-body-2 text-muted/60">اسناد مرتبط با پرونده را اینجا اضافه کنید</p>
            </div>
          )}
        </div>
      )}

      {/* ================= DEADLINES ================= */}
      {activeTab === "deadlines" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-titleMedium text-on-surface font-semibold">
              مهلت‌ها {data.deadlines.length > 0 ? `(${data.deadlines.length})` : ""}
            </h3>
            {canWrite && (
              <button
                onClick={() => setShowDeadlineForm((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-white px-4 py-2 text-caption font-medium hover:bg-primary-700 transition-colors"
              >
                <IconAdd size={16} />
                مهلت جدید
              </button>
            )}
          </div>

          {showDeadlineForm && (
            <div className="rounded-2xl border border-divider/60 bg-surface p-4 space-y-3">
              <TextField
                label="عنوان مهلت"
                value={deadlineTitle}
                onChange={(e) => setDeadlineTitle(e.target.value)}
                placeholder="مثلاً: مهلت اعتراض به رأی"
                fullWidth
              />
              <Select
                label="نوع مهلت"
                value={deadlineKind}
                onChange={(e) => setDeadlineKind(e.target.value as CaseDeadlineKind)}
                fullWidth
                options={(["legal", "internal", "hearing"] as CaseDeadlineKind[]).map((k) => ({
                  value: k,
                  label: CASE_DEADLINE_KIND_FA[k],
                }))}
              />
              <TextField
                type="date"
                label="تاریخ مهلت"
                value={deadlineDueAt}
                onChange={(e) => setDeadlineDueAt(e.target.value)}
                helperText="مهلت‌های تاریخ‌محور تا پایان همان روز «روز موعد» محسوب می‌شوند."
                fullWidth
              />
              <div className="flex items-center gap-2">
                <button
                  disabled={busy || !deadlineTitle.trim() || !deadlineDueAt}
                  onClick={addDeadline}
                  className="rounded-xl bg-primary text-white px-4 py-2 text-caption font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  ثبت مهلت
                </button>
                <button
                  onClick={() => setShowDeadlineForm(false)}
                  className="rounded-xl border border-divider px-4 py-2 text-caption text-muted hover:text-on-surface transition-colors"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}

          {data.deadlines.length > 0 ? (
            <div className="space-y-3">
              {data.deadlines.map((dl) => {
                const done = dl.operationalState === "action_done";
                return (
                  <div
                    key={dl.id}
                    className={`flex items-center gap-3 rounded-2xl border border-divider/60 bg-surface p-4 ${done ? "opacity-60" : ""}`}
                  >
                    <Checkbox
                      checked={done}
                      disabled={busy || !canWrite}
                      onChange={(e) => setDeadlineState(dl.id, e.target.checked ? "action_done" : "open")}
                      aria-label={dl.title}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-body-1 text-on-surface ${done ? "line-through text-muted" : ""}`}>{dl.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge className={DEADLINE_KIND_COLORS[dl.kind]}>{CASE_DEADLINE_KIND_FA[dl.kind]}</Badge>
                        <span className="text-caption text-muted tabular-nums">{faDate(dl.dueAt)}</span>
                        <Badge className="bg-neutral-50 text-neutral-600 border-neutral-200">
                          {CASE_DEADLINE_REVIEW_FA[dl.reviewState]}
                        </Badge>
                        {dl.operationalState === "needs_review_after_due" && (
                          <Badge className="bg-red-50 text-red-700 border-red-200">
                            {CASE_DEADLINE_OPERATIONAL_FA.needs_review_after_due}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <p className="text-body-1 text-muted font-medium">هیچ مهلتی ثبت نشده است</p>
              <p className="text-body-2 text-muted/60">مهلت‌های قانونی پرونده را اینجا ثبت و پیگیری کنید</p>
            </div>
          )}
        </div>
      )}

      {/* ================= CONTRACTS ================= */}
      {activeTab === "contracts" && (
        <div>
          {data.contracts.length > 0 ? (
            <div className="space-y-3">
              {data.contracts.map((ct) => (
                <Link
                  key={ct.id}
                  href={`/contracts/${ct.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-divider/60 bg-surface p-4 transition-all hover:border-primary/40 hover:shadow-elevation-1"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-1 font-semibold text-on-surface">{ct.title}</p>
                    <p className="mt-1 text-caption text-muted">
                      {ct.typeFa} · {ct.referenceCode} · {CASE_CONTRACT_KIND_FA[ct.kind]}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-caption text-primary-700">
                    {ct.progress}٪
                  </span>
                  <IconChevronRight size={18} className="shrink-0 text-muted" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-surface-container border border-divider/40 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/40">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
              </div>
              <p className="text-body-1 text-muted font-medium">قراردادی به این پرونده پیوست نشده است</p>
              <p className="text-body-2 text-muted/60">قراردادهای مرتبط با پرونده در این بخش نمایش داده می‌شوند</p>
              <Link href="/contracts" className="mt-3 rounded-xl border border-divider px-5 py-2.5 text-body-2 font-medium hover:bg-neutral-50 transition-colors">
                رفتن به قراردادها
              </Link>
            </div>
          )}
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
