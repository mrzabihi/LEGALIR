// ============================================================
// LEGALIR — Admin · Request edit drawer (ویرایش درخواست)
// ============================================================
// §4 of the admin spec: per-request edit, assign/change the lawyer, and
// change the status — all from the BACKEND'S source of truth and all recorded
// in the audit history.
//
// The drawer never invents a legal transition: the allowed next states come
// from the server (which reads the authoritative `LEGAL_REQUEST_TRANSITIONS`
// state machine), and every mutation re-checks `admin:requests:manage` and
// appends an event so the change appears in the same timeline the client and
// lawyer read.
// ============================================================

"use client";

import { useState } from "react";
import { Drawer, ConfirmDialog, snackbar } from "@legalir/ui";
import type { LegalRequestState, SlaHealth } from "@legalir/types";
import { LEGAL_REQUEST_STATE_FA, REQUEST_ACTION_FA } from "@legalir/types";
import {
  useAdminRequest,
  useAssignRequestLawyer,
  useChangeRequestState,
  useOverrideRequestDeadline,
  useReassignRequest,
} from "@/hooks/useAdmin";
import {
  Badge,
  Button,
  ErrorBlock,
  Field,
  LoadingBlock,
  Select,
  InfoBanner,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { ConsultationTimeline } from "@/components/consultations/consultation-timeline";
import { DiscoveryAnalysis } from "@/components/admin/discovery-analysis";
import { formatRemaining } from "@/lib/lawyer-portal/sla";
import { toPersianDate } from "@/lib/persian-utils";

const STATE_TONES: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "brand"> = {
  DRAFT: "neutral",
  AI_INTAKE: "info",
  AI_ANALYSIS_READY: "info",
  LAWYER_REQUESTED: "info",
  MATCHING: "info",
  LAWYER_PROPOSED: "info",
  LAWYER_SELECTED: "brand",
  WAITING_FOR_ACCEPTANCE: "warning",
  DECLINED: "danger",
  ACCEPTED: "brand",
  SCHEDULED: "brand",
  IN_PROGRESS: "brand",
  WAITING_FOR_CLIENT: "warning",
  WAITING_FOR_LAWYER: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
  CLOSED: "neutral",
};

/** States we treat as destructive enough to warrant a confirmation. */
const CONFIRM_STATES: LegalRequestState[] = ["CANCELLED", "CLOSED", "COMPLETED"];

const SLA_TONE: Record<SlaHealth, "neutral" | "success" | "warning" | "danger" | "info" | "brand"> = {
  ON_TRACK: "success",
  AT_RISK: "warning",
  BREACHED: "danger",
  PAUSED: "info",
  MET: "success",
  MISSED: "warning",
  NONE: "neutral",
};

/** `datetime-local` value ↔ ISO. The picker is local-time; the store is UTC. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

export function RequestDetailDrawer({
  requestId,
  canManage,
  onClose,
}: {
  requestId: string | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const detail = useAdminRequest(requestId);
  const assignLawyer = useAssignRequestLawyer();
  const changeState = useChangeRequestState();
  const overrideDeadline = useOverrideRequestDeadline();
  const reassign = useReassignRequest();

  const [lawyerDraft, setLawyerDraft] = useState<string>("");
  const [pendingState, setPendingState] = useState<LegalRequestState | null>(null);

  // §5 — deadline override form. One phase at a time, reason mandatory.
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overridePhase, setOverridePhase] = useState<"RESPONSE" | "COMPLETION">("RESPONSE");
  const [overrideDue, setOverrideDue] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // §8 — re-referral form. Destination + reason, both required.
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [reassignError, setReassignError] = useState<string | null>(null);

  const data = detail.data;
  // Keep the select in sync with the loaded request the first time it arrives.
  const [syncedId, setSyncedId] = useState<string | null>(null);
  if (data && syncedId !== data.request.id) {
    setSyncedId(data.request.id);
    setLawyerDraft(data.request.selectedLawyerId ?? "");
  }

  async function applyLawyer() {
    if (!requestId || !data) return;
    const next = lawyerDraft || null;
    if (next === (data.request.selectedLawyerId ?? null)) return;
    try {
      await assignLawyer.mutateAsync({ id: requestId, lawyerId: next });
      snackbar.show({ message: "وکیل درخواست به‌روزرسانی شد.", variant: "success" });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "تخصیص وکیل ناموفق بود"), variant: "error" });
    }
  }

  async function applyState(to: LegalRequestState) {
    if (!requestId) return;
    try {
      await changeState.mutateAsync({ id: requestId, state: to });
      snackbar.show({
        message: `وضعیت به «${LEGAL_REQUEST_STATE_FA[to]}» تغییر کرد.`,
        variant: "success",
      });
      setPendingState(null);
    } catch (err) {
      snackbar.show({ message: errMessage(err, "تغییر وضعیت ناموفق بود"), variant: "error" });
      setPendingState(null);
    }
  }

  function requestState(to: LegalRequestState) {
    if (CONFIRM_STATES.includes(to)) {
      setPendingState(to);
    } else {
      void applyState(to);
    }
  }

  async function applyOverride() {
    if (!requestId) return;
    setOverrideError(null);
    if (overrideReason.trim().length < 5) {
      setOverrideError("دلیل تغییر مهلت اجباری است (حداقل ۵ نویسه).");
      return;
    }
    const nextDueAt = localInputToIso(overrideDue);
    if (overrideDue && !nextDueAt) {
      setOverrideError("تاریخ‌وساعت انتخاب‌شده معتبر نیست.");
      return;
    }
    try {
      await overrideDeadline.mutateAsync({
        id: requestId,
        phase: overridePhase,
        nextDueAt,
        reason: overrideReason.trim(),
      });
      snackbar.show({ message: "مهلت تغییر کرد و در تاریخچه ثبت شد.", variant: "success" });
      setOverrideOpen(false);
      setOverridePhase("RESPONSE");
      setOverrideDue("");
      setOverrideReason("");
    } catch (err) {
      setOverrideError(errMessage(err, "تغییر مهلت ناموفق بود."));
    }
  }

  async function applyReassign() {
    if (!requestId) return;
    setReassignError(null);
    if (!reassignTo) {
      setReassignError("وکیل مقصد را انتخاب کنید.");
      return;
    }
    if (reassignReason.trim().length < 5) {
      setReassignError("دلیل ارجاع مجدد اجباری است (حداقل ۵ نویسه).");
      return;
    }
    try {
      await reassign.mutateAsync({
        id: requestId,
        lawyerId: reassignTo,
        reason: reassignReason.trim(),
      });
      snackbar.show({ message: "درخواست به وکیل دیگری ارجاع شد.", variant: "success" });
      setReassignOpen(false);
      setReassignTo("");
      setReassignReason("");
    } catch (err) {
      setReassignError(errMessage(err, "ارجاع مجدد ناموفق بود."));
    }
  }

  return (
    <>
      <Drawer
        open={Boolean(requestId)}
        onClose={onClose}
        width={560}
        title={data ? `درخواست — ${data.request.title || "بدون عنوان"}` : "درخواست"}
      >
        {detail.isLoading ? (
          <LoadingBlock rows={6} />
        ) : detail.isError || !data ? (
          <ErrorBlock onRetry={() => detail.refetch()} />
        ) : (
          <div className="space-y-5">
            {!canManage && (
              <InfoBanner tone="warning">
                شما مجوز «مدیریت درخواست‌ها» را ندارید؛ این نمایش فقط‌خواندنی است.
              </InfoBanner>
            )}

            {/* --- Identity --- */}
            <div className="rounded-large border border-divider p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATE_TONES[data.request.state] ?? "neutral"} dot>
                  {LEGAL_REQUEST_STATE_FA[data.request.state]}
                </Badge>
                <span className="font-mono text-caption text-muted" dir="ltr">
                  {data.request.id}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-caption">
                <Info label="کاربر" value={data.request.userDisplayName ?? "—"} />
                <Info
                  label="وکیل فعلی"
                  value={data.request.selectedLawyerName ?? "تخصیص نیافته"}
                />
                <Info label="ایجاد" value={toPersianDate(data.request.createdAt)} />
                <Info label="آخرین تغییر" value={toPersianDate(data.request.updatedAt)} />
              </dl>
            </div>

            {/* --- Assign / change the lawyer --- */}
            <Section title="وکیل درخواست">
              <Field
                label="انتخاب وکیل"
                hint="فقط وکلای تأییدشده در این فهرست نمایش داده می‌شوند."
              >
                <Select
                  value={lawyerDraft}
                  disabled={!canManage || assignLawyer.isPending}
                  onChange={(e) => setLawyerDraft(e.target.value)}
                >
                  <option value="">— بدون وکیل —</option>
                  {data.assignableLawyers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.fullName}
                      {l.professionalTitle ? ` — ${l.professionalTitle}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              {canManage && (
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={assignLawyer.isPending}
                    disabled={lawyerDraft === (data.request.selectedLawyerId ?? "")}
                    onClick={applyLawyer}
                  >
                    ثبت وکیل
                  </Button>
                </div>
              )}
            </Section>

            {/* --- Change the status (from the authoritative state machine) --- */}
            <Section title="تغییر وضعیت">
              {data.allowedTransitions.length === 0 ? (
                <p className="text-caption text-muted">
                  این درخواست در وضعیت پایانی است و تغییر دیگری ندارد.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.allowedTransitions.map((to) => {
                    const destructive = CONFIRM_STATES.includes(to);
                    return (
                      <Button
                        key={to}
                        size="sm"
                        variant={destructive ? "danger" : "secondary"}
                        disabled={!canManage || changeState.isPending}
                        onClick={() => requestState(to)}
                      >
                        {LEGAL_REQUEST_STATE_FA[to]}
                      </Button>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* --- §5 — the SLA clock, its policy and every override --- */}
            <Section title="مهلت پاسخ‌گویی و تکمیل">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={SLA_TONE[data.sla.snapshot.health]} dot>
                  {data.sla.snapshot.healthFa}
                </Badge>
                <span className="text-caption text-muted">
                  فاز:{" "}
                  {data.sla.snapshot.phase === "RESPONSE"
                    ? "پاسخ‌گویی"
                    : data.sla.snapshot.phase === "COMPLETION"
                      ? "تکمیل"
                      : "پایان‌یافته"}
                </span>
                {data.sla.snapshot.dueAt && (
                  <span className="text-caption text-muted">
                    مهلت: {toPersianDate(data.sla.snapshot.dueAt)}
                  </span>
                )}
                <span className="text-caption tabular-nums text-muted">
                  {data.sla.snapshot.done
                    ? ""
                    : formatRemaining(data.sla.snapshot.remainingMs)}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
                <Info label="سیاست" value={data.sla.policy.labelFa} />
                <Info
                  label="نوع ساعت"
                  value={data.sla.policy.clock === "CALENDAR" ? "تقویمی" : "ساعت کاری"}
                />
                <Info
                  label="رفتار انتظار کاربر"
                  value={data.sla.policy.pauseBehavior === "PAUSE" ? "توقف" : "ادامه"}
                />
                <Info
                  label="مهلت پاسخ / تکمیل"
                  value={`${data.sla.policy.responseHours} / ${data.sla.policy.completionHours} ساعت`}
                />
              </dl>

              {data.sla.state && (
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-divider pt-2 text-caption">
                  <Info label="ارجاع" value={toPersianDate(data.sla.state.assignedAt)} />
                  <Info
                    label="مشاهده"
                    value={data.sla.state.viewedAt ? toPersianDate(data.sla.state.viewedAt) : "—"}
                  />
                  <Info
                    label="پاسخ وکیل"
                    value={
                      data.sla.state.respondedAt
                        ? toPersianDate(data.sla.state.respondedAt)
                        : "—"
                    }
                  />
                  <Info
                    label="شروع کار"
                    value={data.sla.state.startedAt ? toPersianDate(data.sla.state.startedAt) : "—"}
                  />
                  <Info
                    label="تکمیل"
                    value={
                      data.sla.state.completedAt ? toPersianDate(data.sla.state.completedAt) : "—"
                    }
                  />
                  <Info
                    label="زمان توقف‌شده"
                    value={
                      data.sla.state.pausedMs > 0
                        ? formatRemaining(data.sla.state.pausedMs)
                        : "—"
                    }
                  />
                </dl>
              )}

              {data.sla.overrides.length > 0 && (
                <div className="mt-2 border-t border-divider pt-2">
                  <p className="mb-1 text-caption font-medium text-on-surface-variant">
                    تغییرهای دستی مهلت
                  </p>
                  <ul className="space-y-1">
                    {data.sla.overrides.map((o, i) => (
                      <li key={`${o.at}-${i}`} className="text-caption text-muted">
                        <span className="text-on-surface-variant">
                          {o.phase === "RESPONSE" ? "پاسخ" : "تکمیل"}
                        </span>{" "}
                        از {o.previousDueAt ? toPersianDate(o.previousDueAt) : "—"} به{" "}
                        {o.nextDueAt ? toPersianDate(o.nextDueAt) : "حذف"} — {o.reason} ·{" "}
                        {toPersianDate(o.at)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {canManage && !data.sla.snapshot.done && (
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setOverrideOpen((v) => !v)}
                  >
                    {overrideOpen ? "بستن فرم مهلت" : "تغییر دستی مهلت"}
                  </Button>
                </div>
              )}

              {overrideOpen && canManage && (
                <div className="mt-2 space-y-2 rounded-medium bg-surface-container p-3">
                  <div className="grid gap-2 tablet:grid-cols-2">
                    <Field label="فاز مهلت">
                      <Select
                        value={overridePhase}
                        onChange={(e) => {
                          setOverridePhase(e.target.value as "RESPONSE" | "COMPLETION");
                          setOverrideDue("");
                        }}
                      >
                        <option value="RESPONSE">مهلت پاسخ‌گویی</option>
                        <option value="COMPLETION">مهلت تکمیل</option>
                      </Select>
                    </Field>
                    <Field
                      label="مهلت جدید"
                      hint="خالی بگذارید تا مهلت این فاز حذف شود."
                      error={overrideError ?? undefined}
                    >
                      <TextInput
                        type="datetime-local"
                        value={overrideDue}
                        onChange={(e) => setOverrideDue(e.target.value)}
                        dir="ltr"
                      />
                    </Field>
                  </div>
                  <Field label="دلیل تغییر" required>
                    <TextArea
                      rows={2}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      maxLength={400}
                      placeholder="مثلاً: تأخیر در دریافت مدارک از کاربر — با هماهنگی پشتیبانی."
                    />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setOverrideOpen(false);
                        setOverrideError(null);
                      }}
                    >
                      انصراف
                    </Button>
                    <Button
                      size="sm"
                      loading={overrideDeadline.isPending}
                      onClick={() => void applyOverride()}
                    >
                      ثبت تغییر مهلت
                    </Button>
                  </div>
                  {data.sla.snapshot.dueAt && (
                    <p className="text-caption text-muted">
                      مقدار فعلی: {toPersianDate(data.sla.snapshot.dueAt)} ({" "}
                      {isoToLocalInput(data.sla.snapshot.dueAt)} )
                    </p>
                  )}
                </div>
              )}
            </Section>

            {/* --- §8 — re-referral --- */}
            {canManage && data.assignableLawyers.length > 0 && (
              <Section title="ارجاع مجدد">
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setReassignOpen((v) => !v)}
                  >
                    {reassignOpen ? "بستن فرم ارجاع" : "ارجاع به وکیل دیگر"}
                  </Button>
                </div>
                {reassignOpen && (
                  <div className="mt-2 space-y-2 rounded-medium bg-surface-container p-3">
                    <Field label="وکیل مقصد" required>
                      <Select
                        value={reassignTo}
                        onChange={(e) => setReassignTo(e.target.value)}
                      >
                        <option value="">— انتخاب وکیل —</option>
                        {data.assignableLawyers
                          .filter((l) => l.id !== data.request.selectedLawyerId)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.fullName}
                              {l.professionalTitle ? ` — ${l.professionalTitle}` : ""}
                            </option>
                          ))}
                      </Select>
                    </Field>
                    <Field
                      label="دلیل ارجاع مجدد"
                      required
                      error={reassignError ?? undefined}
                    >
                      <TextArea
                        rows={2}
                        value={reassignReason}
                        onChange={(e) => setReassignReason(e.target.value)}
                        maxLength={400}
                      />
                    </Field>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReassignOpen(false);
                          setReassignError(null);
                        }}
                      >
                        انصراف
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={reassign.isPending}
                        onClick={() => void applyReassign()}
                      >
                        ارجاع مجدد
                      </Button>
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* --- Path discovery (only for requests that came through the
                    «از کجا شروع کنم؟» intake) --- */}
            {data.request.discovery && (
              <Section title="مسیر پیشنهادی حقوقی">
                <DiscoveryAnalysis discovery={data.request.discovery} />
              </Section>
            )}

            {/* --- §4 — the lawyer's own workflow log, separate from state
                    events so an internal note is unmistakably internal --- */}
            <Section title="اقدامات وکیل">
              {data.actions.length === 0 ? (
                <p className="text-caption text-muted">هنوز اقدامی از سوی وکیل ثبت نشده است.</p>
              ) : (
                <ul className="divide-y divide-divider">
                  {data.actions.map((a) => (
                    <li key={a.id} className="py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-body-2 text-on-surface">
                          {REQUEST_ACTION_FA[a.kind] ?? a.kind}
                          {a.visibility === "internal" && (
                            <Badge tone="warning">یادداشت داخلی</Badge>
                          )}
                        </span>
                        <span className="text-caption tabular-nums text-muted">
                          {toPersianDate(a.createdAt)}
                        </span>
                      </div>
                      {a.note && (
                        <p className="mt-0.5 text-caption text-on-surface-variant">{a.note}</p>
                      )}
                      <p className="mt-0.5 font-mono text-caption text-muted" dir="ltr">
                        {a.actorId} · {a.actorRole}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* --- The auditable history --- */}
            <Section title="تاریخچهٔ وضعیت">
              <ConsultationTimeline events={data.events} />
            </Section>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={pendingState !== null}
        onClose={() => setPendingState(null)}
        onConfirm={() => pendingState && applyState(pendingState)}
        title="تغییر وضعیت درخواست"
        description={
          pendingState
            ? `وضعیت به «${LEGAL_REQUEST_STATE_FA[pendingState]}» تغییر کند؟ این عمل در تاریخچه ثبت می‌شود.`
            : undefined
        }
        confirmLabel="تغییر وضعیت"
        destructive={pendingState !== null && CONFIRM_STATES.includes(pendingState)}
        loading={changeState.isPending}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-large border border-divider p-3">
      <h4 className="mb-2 text-body-2 font-bold text-on-surface">{title}</h4>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-on-surface-variant" title={value}>
        {value}
      </dd>
    </div>
  );
}
