// ============================================================
// LEGALIR — Risk Summary
// Overall risk level widget with severity breakdown (Phase 9)
// ============================================================

"use client";

import type { RiskReport, RiskLevel } from "@legalir/types";
import { Card } from "@legalir/ui";
import { IconShield, IconWarning } from "@/lib/icons";

// ============================================================
// Config maps
// ============================================================

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; className: string; iconClassName: string }
> = {
  critical: {
    label: "بحرانی",
    className: "bg-error-container border-error",
    iconClassName: "text-error",
  },
  high: {
    label: "زیاد",
    className: "bg-warning-container border-warning",
    iconClassName: "text-warning",
  },
  medium: {
    label: "متوسط",
    className: "bg-warning-container border-warning",
    iconClassName: "text-warning",
  },
  low: {
    label: "کم",
    className: "bg-success-container border-success",
    iconClassName: "text-success",
  },
};

const SEVERITY_BAR_COLORS: Record<string, string> = {
  critical: "bg-error",
  high: "bg-warning-400",
  medium: "bg-warning-700",
  low: "bg-success",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "بحرانی",
  high: "زیاد",
  medium: "متوسط",
  low: "کم",
};

const SEVERITY_ORDER: RiskLevel[] = ["critical", "high", "medium", "low"];

function computeOverallRisk(findings: RiskReport["findings"]): RiskLevel {
  if (findings.some((f) => f.severity === "critical")) return "critical";
  if (findings.some((f) => f.severity === "high")) return "high";
  if (findings.some((f) => f.severity === "medium")) return "medium";
  return "low";
}

function countBySeverity(
  findings: RiskReport["findings"]
): Record<string, number> {
  const counts: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  }
  return counts;
}

// ============================================================
// Circular confidence indicator
// ============================================================

function ConfidenceCircle({ value }: { value: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const strokeColor =
    value >= 80
      ? "stroke-success"
      : value >= 50
        ? "stroke-warning"
        : "stroke-error";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-divider"
          strokeWidth="6"
        />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          className={strokeColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 44 44)"
        />
      </svg>
      <span
        className="absolute text-labelLarge font-bold text-on-surface"
        aria-label={`${Math.round(value)} درصد اطمینان`}
      >
        {Math.round(value)}٪
      </span>
    </div>
  );
}

// ============================================================
// RiskSummary component
// ============================================================

interface RiskSummaryProps {
  report: RiskReport;
}

export function RiskSummary({ report }: RiskSummaryProps) {
  const { summary, findings, confidence } = report;

  const overallRisk = computeOverallRisk(findings);
  const riskConfig = RISK_CONFIG[overallRisk];
  const severityCounts = countBySeverity(findings);
  const totalFindings = findings.length;

  return (
    <Card
      variant="outlined"
      padding="large"
      className={`flex flex-col gap-4 border-2 ${riskConfig.className}`}
    >
      {/* Header: risk level + confidence */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center bg-white shadow-elevation-1`}
          >
            <IconShield size={26} className={riskConfig.iconClassName} />
          </div>
          <div>
            <h3 className="text-h3 text-on-surface">
              سطح ریسک: {riskConfig.label}
            </h3>
            <p className="text-caption text-muted mt-0.5">
              مجموعا {totalFindings} یافته تحلیل
            </p>
          </div>
        </div>

        <ConfidenceCircle value={confidence} />
      </div>

      {/* Summary text */}
      {summary && (
        <p className="text-body-2 text-on-surface leading-relaxed">{summary}</p>
      )}

      {/* Severity breakdown bars */}
      <div className="flex flex-col gap-2">
        <h4 className="text-labelSmall text-on-surface font-medium">
          تفکیک بر اساس شدت:
        </h4>
        <div className="flex items-center gap-1 h-6 rounded-full overflow-hidden bg-surface-container">
          {SEVERITY_ORDER.map((sev) => {
            const count = severityCounts[sev] ?? 0;
            if (count === 0) return null;
            const widthPct = (count / totalFindings) * 100;
            return (
              <div
                key={sev}
                className={`h-full ${SEVERITY_BAR_COLORS[sev] ?? "bg-muted"}`}
                style={{ width: `${widthPct}%` }}
                aria-label={`${SEVERITY_LABELS[sev]}: ${count} مورد`}
                title={`${SEVERITY_LABELS[sev]}: ${count} مورد`}
              />
            );
          })}
        </div>

        {/* Severity chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {SEVERITY_ORDER.map((sev) => {
            const count = severityCounts[sev] ?? 0;
            if (count === 0) return null;
            return (
              <div
                key={sev}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-divider text-caption"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${SEVERITY_BAR_COLORS[sev] ?? "bg-muted"}`}
                  aria-hidden="true"
                />
                <span className="text-on-surface">{SEVERITY_LABELS[sev]}</span>
                <span className="text-muted font-medium">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Warning for high/critical */}
      {overallRisk === "critical" || overallRisk === "high" ? (
        <div className="flex items-start gap-2 rounded-medium bg-error-container border border-error p-3 text-error">
          <IconWarning size={20} className="shrink-0 mt-0.5" />
          <p className="text-caption">
            این سند دارای ریسک {riskConfig.label} است. توصیه می‌شود پیش از اقدام، با یک
            متخصص حقوقی مشورت کنید.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
