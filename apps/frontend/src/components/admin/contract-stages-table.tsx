// ============================================================
// LEGALIR — Admin · «مراحل و گردش کار قرارداد» (§4)
// ============================================================
// The lifecycle table. Every row is a stage this contract has ACTUALLY
// walked — derived server-side by `buildAdminStages` from the type's own
// completeness sections, the review, the signing authorisation, the party
// signatures, the frozen version and the seal. This component renders that
// verdict and NOTHING else: it never re-derives a status, never guesses a
// condition and never enables an action the server marked unavailable.
//
// The table is desktop-oriented: it keeps its seven columns at a readable
// width and scrolls horizontally inside the drawer instead of compressing
// (a cramped RTL table is unreadable). A row opens a detail dialog with the
// full explanation, the missing items, the completion percentage and the
// row's actions — each carrying its server-authored disabled reason.
// ============================================================

"use client";

import { useState } from "react";
import { Dialog } from "@legalir/ui";
import type {
  ContractStageActionId,
  ContractStageRow,
  ContractStageStatus,
  ContractStagesView,
} from "@legalir/types";
import { Badge, Button, Section } from "@/components/admin/ui";
import { IconChevronLeft, IconDocument } from "@/lib/icons";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";

/** Status → the badge tone that carries the SAME meaning elsewhere. */
const STAGE_TONES: Record<
  ContractStageStatus,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  done: "success",
  active: "brand",
  pending: "neutral",
  blocked: "warning",
  needs_fix: "warning",
  rejected: "danger",
  skipped: "neutral",
};

/**
 * Navigate the operator to the ONE surface that owns the real operation. The
 * stage table never performs an action itself; it takes the operator to the
 * existing panel where the server's own preconditions are shown.
 */
const ACTION_TARGET: Record<ContractStageActionId, string | null> = {
  review_decision: "admin-review-decision",
  register_self_final: "admin-advance-signing",
  resend_invitations: "admin-signatures",
  stamp_action: "admin-stamp",
  view_final_pdf: null,
};

export function ContractStagesTable({
  stages,
  currentPdfUrl,
  finalPdfUrl,
  onRunAction,
}: {
  stages: ContractStagesView;
  /** §7 — preview/print URL for the version currently under review. */
  currentPdfUrl: string | null;
  /** The stored final artifact's URL, when one exists. */
  finalPdfUrl: string | null;
  /** Scroll to the surface that owns a stage action. */
  onRunAction: (targetId: string) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openRow = stages.rows.find((r) => r.key === openKey) ?? null;

  return (
    <>
      <Section
        title="مراحل و گردش کار قرارداد"
        infoFa="هر ردیف یک مرحلهٔ واقعی از مسیرِ همین قرارداد است؛ مرحله‌های مربوط به نوع دیگر قرارداد اینجا ساخته نمی‌شوند. وضعیت هر مرحله از رکوردهای واقعی سیستم استخراج می‌شود."
        subtitle={`${toPersianNumber(stages.doneCount)} از ${toPersianNumber(
          stages.totalCount
        )} مرحله تمام شده است.`}
        actions={
          currentPdfUrl ? (
            <a href={currentPdfUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary" startIcon={<IconDocument size={15} />}>
                مشاهده و چاپ نسخهٔ فعلی (PDF)
              </Button>
            </a>
          ) : undefined
        }
      >
        {stages.rows.length === 0 ? (
          <p className="rounded-medium border border-divider p-3 text-caption text-muted">
            برای این قرارداد هنوز مرحله‌ای قابل نمایش ثبت نشده است.
          </p>
        ) : (
          // The drawer body is ~648px; the seven required columns are tuned to
          // that width so the table reads in one glance instead of forcing a
          // horizontal hunt for the operations column. `overflow-x-auto` stays
          // as the safety valve for a narrower viewport.
          <div className="overflow-x-auto rounded-medium border border-divider">
            <table className="w-full min-w-[612px] table-fixed border-collapse text-caption">
              <caption className="sr-only">
                مراحل و گردش کار این قرارداد، به ترتیب انجام
              </caption>
              <thead>
                <tr className="bg-surface-container text-start text-labelSmall text-muted">
                  <th scope="col" className="w-[44px] px-1.5 py-2 text-start font-medium">
                    مرحله
                  </th>
                  <th scope="col" className="w-[22%] px-1.5 py-2 text-start font-medium">
                    عنوان مرحله
                  </th>
                  <th scope="col" className="w-[13%] px-1.5 py-2 text-start font-medium">
                    وضعیت
                  </th>
                  <th scope="col" className="w-[14%] px-1.5 py-2 text-start font-medium">
                    مسئول مرحله
                  </th>
                  <th scope="col" className="w-[13%] px-1.5 py-2 text-start font-medium">
                    آخرین تغییر
                  </th>
                  <th scope="col" className="w-[19%] px-1.5 py-2 text-start font-medium">
                    آخرین توضیح
                  </th>
                  <th scope="col" className="w-[76px] px-1.5 py-2 text-start font-medium">
                    عملیات
                  </th>
                </tr>
              </thead>
              <tbody>
                {stages.rows.map((r) => {
                  const isCurrent = r.key === stages.currentKey;
                  return (
                    <tr
                      key={r.key}
                      aria-current={isCurrent ? "step" : undefined}
                      className={[
                        "border-t border-divider align-top",
                        isCurrent ? "bg-primary-soft" : "hover:bg-surface-container-low",
                      ].join(" ")}
                    >
                      <td className="px-1.5 py-2.5 whitespace-nowrap">
                        <span
                          aria-hidden="true"
                          className={[
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-labelSmall",
                            isCurrent
                              ? "bg-primary text-on-primary"
                              : "bg-surface-container text-on-surface-variant",
                          ].join(" ")}
                        >
                          {toPersianNumber(r.index)}
                        </span>
                      </td>
                      <td className="px-1.5 py-2.5">
                        <button
                          type="button"
                          onClick={() => setOpenKey(r.key)}
                          className="text-start font-medium text-on-surface transition-colors hover:text-primary"
                        >
                          {r.titleFa}
                        </button>
                        {isCurrent && (
                          <p className="mt-1">
                            <Badge tone="brand" dot>
                              مرحلهٔ جاری
                            </Badge>
                          </p>
                        )}
                      </td>
                      <td className="px-1.5 py-2.5 whitespace-nowrap">
                        <Badge tone={STAGE_TONES[r.status]} dot>
                          {r.statusFa}
                        </Badge>
                      </td>
                      <td className="px-1.5 py-2.5 text-on-surface-variant">{r.responsibleFa}</td>
                      <td className="px-1.5 py-2.5 whitespace-nowrap text-muted">
                        {r.updatedAt ? toPersianDate(r.updatedAt) : "—"}
                      </td>
                      <td className="px-1.5 py-2.5 text-muted">
                        <span className="line-clamp-2" title={r.noteFa ?? undefined}>
                          {r.noteFa ?? "—"}
                        </span>
                      </td>
                      <td className="px-1.5 py-2.5 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          endIcon={<IconChevronLeft size={14} />}
                          onClick={() => setOpenKey(r.key)}
                        >
                          جزئیات
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {openRow && (
        <StageDetailDialog
          row={openRow}
          isCurrent={openRow.key === stages.currentKey}
          totalCount={stages.totalCount}
          finalPdfUrl={finalPdfUrl}
          onClose={() => setOpenKey(null)}
          onRunAction={(actionId) => {
            setOpenKey(null);
            const target = ACTION_TARGET[actionId];
            if (target) onRunAction(target);
          }}
        />
      )}
    </>
  );
}

/**
 * The detail of ONE stage: status, responsible, last change, the recorded
 * explanation, the missing items, and the actions the server allows. A
 * disabled action always shows WHY — that reason comes from the server, not
 * from this component.
 */
function StageDetailDialog({
  row,
  isCurrent,
  totalCount,
  finalPdfUrl,
  onClose,
  onRunAction,
}: {
  row: ContractStageRow;
  isCurrent: boolean;
  totalCount: number;
  finalPdfUrl: string | null;
  onClose: () => void;
  onRunAction: (actionId: ContractStageActionId) => void;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="2xl"
      title={`مرحلهٔ ${toPersianNumber(row.index)} از ${toPersianNumber(totalCount)} — ${row.titleFa}`}
      description={row.detailFa ?? undefined}
      actions={
        <Button variant="secondary" onClick={onClose}>
          بستن
        </Button>
      }
    >
      <div className="space-y-4 text-caption">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={STAGE_TONES[row.status]} dot>
            {row.statusFa}
          </Badge>
          {isCurrent && <Badge tone="brand">مرحلهٔ جاری قرارداد</Badge>}
          {row.percent !== null && (
            <Badge tone="neutral">تکمیل اطلاعات: {toPersianNumber(row.percent)}٪</Badge>
          )}
        </div>

        {row.percent !== null && (
          <div
            role="progressbar"
            aria-valuenow={row.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="میزان تکمیل اطلاعات این مرحله"
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, Math.max(0, row.percent))}%` }}
            />
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="min-w-0">
            <dt className="text-muted">مسئول مرحله</dt>
            <dd className="text-on-surface-variant">{row.responsibleFa}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted">آخرین تغییر</dt>
            <dd className="text-on-surface-variant">
              {row.updatedAt ? toPersianDate(row.updatedAt) : "تغییری ثبت نشده است"}
            </dd>
          </div>
        </dl>

        <div className="rounded-medium bg-surface-container-low p-3">
          <p className="text-labelSmall text-muted">آخرین توضیح ثبت‌شده</p>
          <p className="mt-1 leading-6 text-on-surface-variant">
            {row.noteFa ?? "برای این مرحله توضیحی ثبت نشده است."}
          </p>
        </div>

        {row.missingFa.length > 0 && (
          <div className="rounded-medium border border-warning-200 bg-warning-soft p-3">
            <p className="text-labelSmall text-warning-700">
              موارد باقی‌ماندهٔ این مرحله ({toPersianNumber(row.missingFa.length)} مورد)
            </p>
            <ul className="mt-1 list-disc space-y-0.5 ps-5 leading-6 text-warning-700">
              {row.missingFa.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {row.actions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-labelSmall text-muted">اقدام‌های مجاز این مرحله</p>
            <ul className="space-y-2">
              {row.actions.map((a) => {
                const isPdf = a.id === "view_final_pdf";
                const label = isPdf ? "باز کردن سند نهایی" : "رفتن به این اقدام";
                return (
                  <li key={a.id} className="rounded-medium border border-divider p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-on-surface">{a.labelFa}</span>
                      {isPdf ? (
                        finalPdfUrl ? (
                          <a href={finalPdfUrl} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="secondary">
                              {label}
                            </Button>
                          </a>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled
                            title={a.reasonFa ?? undefined}
                          >
                            {label}
                          </Button>
                        )
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!a.enabled}
                          title={a.enabled ? undefined : (a.reasonFa ?? undefined)}
                          onClick={() => onRunAction(a.id)}
                        >
                          {label}
                        </Button>
                      )}
                    </div>
                    {!a.enabled && a.reasonFa && (
                      <p className="mt-1 text-labelSmall leading-5 text-muted">{a.reasonFa}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-muted">این مرحله اقدام مستقیمی برای ادمین ندارد.</p>
        )}
      </div>
    </Dialog>
  );
}
