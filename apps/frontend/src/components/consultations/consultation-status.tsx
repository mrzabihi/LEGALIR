"use client";

// ============================================================
// LEGALIR — Consultation status presentation
// ============================================================
// One place for the state→tone map and the Persian date/price formatting
// shared by the list, the wizard and the case room, so a state never
// renders two different colours on two screens.
// ============================================================

import { LEGAL_REQUEST_STATE_FA, type LegalRequestState } from "@legalir/types";
import { toPersianNumber } from "@/lib/persian-utils";

/** Tonal treatment per state. Unknown states fall back to neutral. */
export const STATE_TONE: Record<LegalRequestState, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600",
  AI_INTAKE: "bg-blue-50 text-blue-700",
  AI_ANALYSIS_READY: "bg-cyan-50 text-cyan-700",
  LAWYER_REQUESTED: "bg-indigo-50 text-indigo-700",
  MATCHING: "bg-violet-50 text-violet-700",
  LAWYER_PROPOSED: "bg-purple-50 text-purple-700",
  LAWYER_SELECTED: "bg-fuchsia-50 text-fuchsia-700",
  WAITING_FOR_ACCEPTANCE: "bg-amber-50 text-amber-700",
  DECLINED: "bg-red-50 text-red-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  SCHEDULED: "bg-teal-50 text-teal-700",
  IN_PROGRESS: "bg-sky-50 text-sky-700",
  WAITING_FOR_CLIENT: "bg-orange-50 text-orange-700",
  WAITING_FOR_LAWYER: "bg-orange-50 text-orange-700",
  COMPLETED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
  CLOSED: "bg-neutral-100 text-neutral-500",
};

/** A pill showing the request's current state in Persian. */
export function ConsultationStatusBadge({
  state,
  className = "",
}: {
  state: LegalRequestState;
  className?: string;
}) {
  return (
    <span
      className={[
        "shrink-0 rounded-full px-3 py-1 text-caption",
        STATE_TONE[state] ?? "bg-neutral-100 text-neutral-600",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {LEGAL_REQUEST_STATE_FA[state]}
    </span>
  );
}

/** Persian date + time, e.g. «۱۴۰۳ مهر ۵ · ۱۴:۳۰». */
export function formatDateTime(iso: string): string {
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

/** Persian date only. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/** A Toman amount in Persian digits. */
export function formatToman(value: number): string {
  return `${toPersianNumber(value)} تومان`;
}
