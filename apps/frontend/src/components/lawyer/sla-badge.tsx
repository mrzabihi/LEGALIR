// ============================================================
// LEGALIR — Lawyer workbench · SLA + state badges
// ============================================================
// One place that decides how a request's state and its SLA health are
// rendered, so the dashboard, the referral list and the detail page can never
// drift apart. Pure presentation: every value is supplied by the server
// projection (`LawyerReferralListItem.sla`, `SlaSnapshot`).
// ============================================================

"use client";

import {
  LEGAL_REQUEST_STATE_FA,
  SLA_HEALTH_FA,
  type LegalRequestState,
  type SlaHealth,
  type SlaSnapshot,
} from "@legalir/types";
import { formatRemaining } from "@/lib/lawyer-portal/sla";
import { Badge } from "@/components/admin/ui";
import { IconClock, IconWarning, IconCheckCircle, IconStop } from "@/lib/icons";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const STATE_TONES: Record<LegalRequestState, Tone> = {
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

const SLA_TONES: Record<SlaHealth, Tone> = {
  ON_TRACK: "success",
  AT_RISK: "warning",
  BREACHED: "danger",
  PAUSED: "info",
  MET: "success",
  MISSED: "warning",
  NONE: "neutral",
};

export function StateBadge({ state }: { state: LegalRequestState }) {
  return (
    <Badge tone={STATE_TONES[state] ?? "neutral"} dot>
      {LEGAL_REQUEST_STATE_FA[state] ?? state}
    </Badge>
  );
}

export function SlaBadge({ sla }: { sla: SlaSnapshot }) {
  const tone = SLA_TONES[sla.health] ?? "neutral";
  const icon =
    sla.health === "BREACHED" || sla.health === "MISSED" ? (
      <IconWarning size={12} aria-hidden="true" />
    ) : sla.health === "PAUSED" ? (
      <IconStop size={12} aria-hidden="true" />
    ) : sla.health === "MET" ? (
      <IconCheckCircle size={12} aria-hidden="true" />
    ) : (
      <IconClock size={12} aria-hidden="true" />
    );

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={tone}>{SLA_HEALTH_FA[sla.health]}</Badge>
      {sla.health !== "NONE" && !sla.done && (
        <span
          className={`inline-flex items-center gap-1 text-caption tabular-nums ${
            sla.breached
              ? "text-error-600 dark:text-error-400"
              : sla.atRisk
                ? "text-warning-700 dark:text-warning-400"
                : "text-muted"
          }`}
          title={sla.dueAt ? `مهلت: ${sla.dueAt}` : undefined}
        >
          {icon}
          {formatRemaining(sla.remainingMs)}
        </span>
      )}
    </span>
  );
}
