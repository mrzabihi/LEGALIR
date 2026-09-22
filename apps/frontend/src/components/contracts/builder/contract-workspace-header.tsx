// ============================================================
// LEGALIR — Contract workspace header
// ============================================================
// The sticky header of the contract draft workspace. It is a
// WORKSPACE, not a discovery surface, so it is deliberately quiet:
// no glassmorphism, no glow — a solid surface and two levels of
// hierarchy.
//
//   LEVEL 1 — identity: back link, title, reference code, status.
//   LEVEL 2 — progress: «تکمیل قرارداد», the percentage, a 6px bar,
//             «۲ از ۵ بخش تکمیل شده» and the remaining section chips.
//
// The save status is REAL — it is the wizard's autosave state, not a
// decorative label — and it is announced politely so a screen-reader
// user hears "ذخیره شد" without the header stealing focus.
// ============================================================

"use client";

import React from "react";
import Link from "next/link";
import type { ContractCompletenessSection } from "@legalir/types";
import type { SaveStatus } from "./wizard-context";
import {
  IconArrowForward,
  IconCheck,
  IconCopy,
  IconRefresh,
  IconWarning,
} from "@/lib/icons";

interface ContractWorkspaceHeaderProps {
  title: string;
  referenceCode: string;
  typeFa: string;
  /** The raw lifecycle state label, e.g. «پیش‌نویس». */
  stateFa: string;
  /** 0–100 server-computed completeness. */
  progress: number;
  sections: ContractCompletenessSection[];
  /** Sections that still block signing. */
  blockers: { sectionKey: string; labelFa: string; stepId: string }[];
  stepIndex: number;
  stepCount: number;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  onRetrySave: () => void;
  onCopyId: () => void;
}

export function ContractWorkspaceHeader({
  title,
  referenceCode,
  typeFa,
  stateFa,
  progress,
  sections,
  blockers,
  stepIndex,
  stepCount,
  saveStatus,
  lastSavedAt,
  onRetrySave,
  onCopyId,
}: ContractWorkspaceHeaderProps) {
  const completed = sections.filter((s) => s.percent === 100).length;
  const total = sections.length;
  const remaining = sections.filter((s) => s.percent < 100);

  return (
    <header className="sticky top-0 z-20 border-b border-divider bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-3">
        {/* LEVEL 1 — contract identity */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/contracts"
              className="inline-flex items-center gap-1 text-caption text-muted transition-colors hover:text-on-surface"
            >
              <IconArrowForward className="h-3.5 w-3.5" />
              بازگشت به مرکز قراردادها
            </Link>

            <div className="mt-0.5 flex items-center gap-2">
              <h1 className="truncate text-h4 text-on-surface max-mobile-l:line-clamp-2 max-mobile-l:whitespace-normal">
                {title}
              </h1>
              <span className="shrink-0 rounded-full bg-surface-container px-2.5 py-0.5 text-labelSmall text-on-surface">
                {stateFa}
              </span>
            </div>

            <div className="mt-0.5 flex items-center gap-2 text-caption text-muted">
              <span className="truncate">
                {referenceCode} — {typeFa}
              </span>
              <button
                type="button"
                onClick={onCopyId}
                aria-label="کپی شناسه قرارداد"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-on-surface/[0.08]"
              >
                <IconCopy size={14} />
              </button>
            </div>
          </div>

          {/* Save status — real autosave state, announced politely. */}
          <div className="shrink-0 pt-4" aria-live="polite">
            <SaveStatusLabel
              status={saveStatus}
              lastSavedAt={lastSavedAt}
              onRetry={onRetrySave}
            />
          </div>
        </div>

        {/* LEVEL 2 — progress */}
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-labelLarge text-on-surface">تکمیل قرارداد</span>
            <span className="text-labelMedium text-muted">
              {completed} از {total} بخش تکمیل شده
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="پیشرفت تکمیل قرارداد"
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high"
          >
            <div
              className={`h-full rounded-full transition-all duration-medium2 ease-standard ${
                progress === 100 ? "bg-success" : "bg-primary"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="text-caption text-muted">
              مرحله {stepIndex + 1} از {stepCount}
            </span>
            <span className="text-labelMedium text-on-surface">{progress}٪</span>
          </div>

          {/* Remaining section chips — what is left, at a glance. */}
          {remaining.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {remaining.slice(0, 6).map((section) => (
                <span
                  key={section.key}
                  className="rounded-full bg-surface-container px-2.5 py-0.5 text-labelSmall text-muted"
                >
                  {section.labelFa}
                </span>
              ))}
              {remaining.length > 6 && (
                <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-labelSmall text-muted">
                  +{remaining.length - 6}
                </span>
              )}
            </div>
          )}

          {blockers.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-caption text-warning-700">
              <IconWarning size={14} />
              {blockers.length} مورد مانع امضا: {blockers.map((b) => b.labelFa).join("، ")}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}

function SaveStatusLabel({
  status,
  lastSavedAt,
  onRetry,
}: {
  status: SaveStatus;
  lastSavedAt: string | null;
  onRetry: () => void;
}) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-muted">
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
        در حال ذخیره...
      </span>
    );
  }

  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 text-caption text-error hover:underline"
      >
        <IconRefresh size={14} />
        ذخیره انجام نشد — تلاش مجدد
      </button>
    );
  }

  if (status === "saved" && lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-success">
        <IconCheck size={14} />
        همه تغییرات ذخیره شده‌اند
      </span>
    );
  }

  return <span className="text-caption text-muted">ذخیره خودکار فعال است</span>;
}
