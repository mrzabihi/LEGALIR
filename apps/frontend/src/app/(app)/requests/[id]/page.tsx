// ============================================================
// LEGALIR — Legal Request Detail (PART 7)
// ============================================================
// Shows the request's current state, the legal next moves, and the full
// transition history. The UI only *requests* a transition — the server
// validates it against the state machine and may reject it with 409.
// ============================================================

"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useLegalRequest, useTransitionLegalRequest } from "@/hooks/useLegalRequests";
import {
  IconArrowBack,
  IconRefresh,
  IconInfo,
  IconHistory,
  IconCheck,
  IconWarning,
} from "@/lib/icons";
import {
  LEGAL_CATEGORY_FA,
  LEGAL_REQUEST_STATE_FA,
  LEGAL_REQUEST_TRANSITIONS,
  type LegalRequestState,
} from "@legalir/types";
import { Textarea } from "@legalir/ui";

const STATE_TONE: Partial<Record<LegalRequestState, string>> = {
  DRAFT: "bg-neutral-100 text-neutral-600",
  AI_INTAKE: "bg-blue-50 text-blue-700",
  AI_ANALYSIS_READY: "bg-cyan-50 text-cyan-700",
  LAWYER_REQUESTED: "bg-indigo-50 text-indigo-700",
  MATCHING: "bg-violet-50 text-violet-700",
  LAWYER_PROPOSED: "bg-purple-50 text-purple-700",
  LAWYER_SELECTED: "bg-fuchsia-50 text-fuchsia-700",
  WAITING_FOR_ACCEPTANCE: "bg-amber-50 text-amber-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  SCHEDULED: "bg-teal-50 text-teal-700",
  IN_PROGRESS: "bg-sky-50 text-sky-700",
  WAITING_FOR_CLIENT: "bg-orange-50 text-orange-700",
  WAITING_FOR_LAWYER: "bg-orange-50 text-orange-700",
  COMPLETED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
  CLOSED: "bg-neutral-100 text-neutral-500",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${date} · ${time}`;
}

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, isError, refetch } = useLegalRequest(id);
  const transition = useTransitionLegalRequest(id);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
        <div className="h-64 animate-pulse rounded-2xl bg-surface-container" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
        <div className="flex flex-col items-center gap-3 rounded-large bg-error/10 p-8 text-center">
          <p className="text-body-1 text-error">درخواست یافت نشد یا به آن دسترسی ندارید</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-body-2 text-primary transition hover:bg-primary/10"
          >
            <IconRefresh size={16} />
            تلاش مجدد
          </button>
          <Link href="/requests" className="text-body-2 text-primary hover:underline">
            بازگشت به فهرست درخواست‌ها
          </Link>
        </div>
      </div>
    );
  }

  const { request, events } = data;
  const nextStates = LEGAL_REQUEST_TRANSITIONS[request.state] ?? [];
  const isTerminal = nextStates.length === 0;

  async function handleTransition(to: LegalRequestState) {
    setError(null);
    try {
      await transition.mutateAsync({ to, note: note.trim() || undefined });
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تغییر وضعیت ناموفق بود");
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
      <Link
        href="/requests"
        className="mb-4 inline-flex items-center gap-1.5 text-body-2 text-muted transition hover:text-primary"
      >
        <IconArrowBack size={18} />
        فهرست درخواست‌ها
      </Link>

      {/* Header */}
      <div className="mb-6 rounded-2xl border border-divider/60 bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-h2 text-on-surface">{request.title}</h1>
            <p className="mt-1 text-body-2 text-muted">
              {LEGAL_CATEGORY_FA[request.category] ?? request.category}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-caption ${STATE_TONE[request.state] ?? "bg-neutral-100 text-neutral-600"}`}
          >
            {LEGAL_REQUEST_STATE_FA[request.state]}
          </span>
        </div>
        <p className="mt-3 text-caption text-muted">
          آخرین به‌روزرسانی: {formatDateTime(request.updatedAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 tablet:grid-cols-3">
        {/* Timeline */}
        <div className="tablet:col-span-2">
          <section className="rounded-2xl border border-divider/60 bg-surface p-5">
            <h2 className="mb-4 flex items-center gap-2 text-h3 text-on-surface">
              <IconHistory size={18} />
              تاریخچه وضعیت
            </h2>
            <ol className="relative space-y-4 border-r border-divider/70 pr-5">
              {events.map((ev) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -right-[26px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary ring-4 ring-surface" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body-2 font-medium text-on-surface">
                      {LEGAL_REQUEST_STATE_FA[ev.toState]}
                    </span>
                    {ev.fromState && (
                      <span className="text-caption text-muted">
                        از {LEGAL_REQUEST_STATE_FA[ev.fromState]}
                      </span>
                    )}
                  </div>
                  {ev.note && <p className="mt-1 text-body-2 text-muted">{ev.note}</p>}
                  <p className="mt-1 text-caption text-muted">{formatDateTime(ev.createdAt)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Actions */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-divider/60 bg-surface p-5">
            <h2 className="mb-3 text-h3 text-on-surface">اقدام بعدی</h2>

            {isTerminal ? (
              <div className="flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2.5 text-body-2 text-neutral-600">
                <IconInfo size={16} />
                این درخواست بسته شده است.
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <Textarea
                    id="transition-note"
                    label="یادداشت (اختیاری)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="توضیح کوتاه برای این تغییر وضعیت…"
                    fullWidth
                  />
                </div>

                {error && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl bg-error/10 px-3 py-2 text-caption text-error">
                    <IconWarning size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  {nextStates.map((to) => (
                    <button
                      key={to}
                      onClick={() => handleTransition(to)}
                      disabled={transition.isPending}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-body-2 text-primary-700 transition hover:bg-primary/10 disabled:opacity-50"
                    >
                      <span>{LEGAL_REQUEST_STATE_FA[to]}</span>
                      <IconCheck size={16} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Intake answers */}
          {Object.keys(request.intakeAnswers).length > 0 && (
            <section className="rounded-2xl border border-divider/60 bg-surface p-5">
              <h2 className="mb-3 text-h3 text-on-surface">اطلاعات ثبت‌شده</h2>
              <dl className="space-y-2 text-body-2">
                {Object.entries(request.intakeAnswers).map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-0.5">
                    <dt className="text-caption text-muted">{k}</dt>
                    <dd className="text-on-surface">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {request.selectedLawyerId && (
            <Link
              href={`/lawyers/${request.selectedLawyerId}`}
              className="block rounded-xl border border-divider/60 bg-surface px-4 py-3 text-center text-body-2 text-primary transition hover:bg-primary/5"
            >
              مشاهده وکیل انتخاب‌شده
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
