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
import type { LegalRequestState } from "@legalir/types";
import { LEGAL_REQUEST_STATE_FA } from "@legalir/types";
import { useAdminRequest, useAssignRequestLawyer, useChangeRequestState } from "@/hooks/useAdmin";
import {
  Badge,
  Button,
  ErrorBlock,
  Field,
  LoadingBlock,
  Select,
  InfoBanner,
} from "@/components/admin/ui";
import { ConsultationTimeline } from "@/components/consultations/consultation-timeline";
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

  const [lawyerDraft, setLawyerDraft] = useState<string>("");
  const [pendingState, setPendingState] = useState<LegalRequestState | null>(null);

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
