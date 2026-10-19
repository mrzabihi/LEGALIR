// ============================================================
// LEGALIR — Wizard step: the contract lifecycle workspace
// ============================================================
// This is the whole lifecycle AFTER the content exists:
//
//   اطلاعات ✓ → پیش‌نمایش ✓ → بررسی ● → امضا ○ → تکمیل ○
//
// This stage is ONLY preview + review. The signing act lives in the
// signature step and the archive lives in the final step, so the user
// never sees two copies of the same button on two different stages.
//
// The step is DOMAIN-AGNOSTIC. It never mentions موجر/مستأجر or any
// contract-specific role: every label comes from the registry and
// every permission comes from the server's lifecycle view. Two OPTIONAL
// support paths are offered — پرسش از دستیار هوشمند | بررسی توسط وکیل —
// and exactly ONE primary action moves the contract forward.
//
// The component only decides what to *offer*; the server decides what
// is *allowed*. A signature is bound to an immutable version, and the
// wording is always «تأیید و امضای الکترونیکی» — never «امضای
// الکترونیکی مطمئن» or «امضای دیجیتال رسمی».
// ============================================================

"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, ProgressLinear } from "@legalir/ui";
import { IconChat, IconLawBook, IconSend } from "@/lib/icons";
import { useWizard } from "../wizard-context";
import { ActionButton, SectionCard, Notice } from "../primitives";
import { LivePreview } from "../live-preview";
import { ContractCommentComposer } from "../contract-comments";
import type { A4ReviewStamp, A4SignatureMark } from "../../document/a4-document";
import { LifecycleStepper } from "../lifecycle-stepper";
import { getContractDefinition } from "@/lib/contracts/registry";
import { renderContract } from "@/lib/contracts/template";
import { stateLabelFa } from "@/lib/contracts/state-machine";
import { formatIsoJalali, formatIsoJalaliDateTime } from "@/lib/contracts/dates";
import {
  useSelfFinalRegister,
  useSubmitForAdminReview,
  useSubmitForReview,
} from "@/hooks/usePropertyContracts";
import {
  useAcceptLawyerReview,
  useCancelLawyerReview,
  useCompleteLawyerReview,
  useContractLifecycle,
  useCreateAiReview,
  useCreateLawyerReview,
  useDecideLawyerFinding,
} from "@/hooks/useContractLifecycle";
import { contractPdfUrl } from "@/lib/api/property-contracts";
import { CONTRACT_ADMIN_REVIEW_STATUS_FA, type LawyerReviewFindingSeverity } from "@legalir/types";
import { SIGNATURE_CELL_STATUS_FA } from "@/lib/contracts/signature/labels";

const SEVERITY_LABELS_FA: Record<LawyerReviewFindingSeverity, string> = {
  info: "اطلاع",
  low: "کم",
  medium: "متوسط",
  high: "زیاد",
  critical: "بحرانی",
};

export function ReviewStep() {
  const router = useRouter();
  const { contract, data, parties, payments, completeness, goToStep } = useWizard();
  const def = getContractDefinition(contract.type);

  const lifecycle = useContractLifecycle(contract.id);
  const view = lifecycle.data;

  const createLawyer = useCreateLawyerReview();
  const acceptLawyer = useAcceptLawyerReview();
  const completeLawyer = useCompleteLawyerReview();
  const decideFinding = useDecideLawyerFinding();
  const cancelLawyer = useCancelLawyerReview();
  const createAi = useCreateAiReview();
  const submit = useSubmitForReview();
  const submitAdmin = useSubmitForAdminReview();
  const selfFinal = useSelfFinalRegister();

  const [actionError, setActionError] = useState<string | null>(null);
  /** The user must actively tick the unreviewed warning before «ثبت نهایی». */
  const [unreviewedAcknowledged, setUnreviewedAcknowledged] = useState(false);

  const currentVersion = contract.versions.find((v) => v.id === contract.currentVersionId);
  const request = view?.signatureRequest ?? null;
  const lawyerReview = view?.lawyerReview ?? null;
  const aiReview = view?.aiReview ?? null;
  const comments = view?.comments ?? [];

  // The comment being replied to. A reply inherits the parent's version —
  // the server refuses a cross-version reply — so only a note on the
  // CURRENT version offers the action.
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const replyTarget = replyTo ? comments.find((c) => c.id === replyTo) ?? null : null;

  /** The clause list the document prints, so an anchor always exists. */
  const commentClauses = useMemo(
    () => renderContract({ ...contract, data }, parties, payments).clauses,
    [contract, data, parties, payments]
  );

  /**
   * Threads, oldest first. A reply always shares its parent's version, so
   * walking to the root can never leave one revision. An orphaned reply is
   * promoted to the top instead of silently disappearing.
   */
  const commentThreads = useMemo(() => {
    const byId = new Map(comments.map((c) => [c.id, c]));
    const rootIdOf = (comment: (typeof comments)[number]): string => {
      let current = comment;
      const seen = new Set<string>([current.id]);
      while (current.parentId && byId.has(current.parentId) && !seen.has(current.parentId)) {
        current = byId.get(current.parentId)!;
        seen.add(current.id);
      }
      return current.id;
    };
    const roots: typeof comments = [];
    const replies = new Map<string, typeof comments>();
    for (const comment of comments) {
      const rootId = rootIdOf(comment);
      if (rootId === comment.id) {
        roots.push(comment);
      } else {
        const list = replies.get(rootId) ?? [];
        list.push(comment);
        replies.set(rootId, list);
      }
    }
    return roots.map((root) => ({ root, replies: replies.get(root.id) ?? [] }));
  }, [comments]);

  /** The version a note was written against, in the reader's terms. */
  function commentVersionLabelFa(comment: (typeof comments)[number]): string {
    const isCurrent = comment.contractVersionId === contract.currentVersionId;
    const version = contract.versions.find((v) => v.id === comment.contractVersionId);
    if (!version) return isCurrent ? "نسخهٔ جاری" : "نسخهٔ پیشین";
    return isCurrent ? `نسخه ${version.versionNumber} (جاری)` : `نسخه ${version.versionNumber}`;
  }

  const commentClauseLabel = (ref: string | null | undefined): string | null =>
    ref ? commentClauses.find((c) => c.id === ref)?.headingFa ?? ref : null;

  /**
   * Real signature state per role, for the document's signature section.
   * The A4 sheet shows «امضا شده» + the signing date instead of a blank
   * line, so the preview and the printed copy agree with the DB.
   */
  const signatureMarks = useMemo(() => {
    const marks: Record<string, A4SignatureMark> = {};
    for (const participant of request?.participants ?? []) {
      marks[participant.roleFa] = {
        signedAt: participant.signedAt,
        statusFa: SIGNATURE_CELL_STATUS_FA[participant.status],
      };
    }
    return marks;
  }, [request]);

  /**
   * Understandable, contract-level status history for the drafting page.
   * Raw audit rows (actor/service/action, e.g. `contract.created`) stay in
   * the backend for security and support and are displayed only in the
   * authorised admin area — this timeline is derived from the lifecycle
   * data the page already shows.
   */
  const statusTimeline = useMemo(() => {
    const items: { id: string; labelFa: string; at: string | null }[] = [];
    if (currentVersion) {
      items.push({
        id: "version",
        labelFa: `نسخه ${currentVersion.versionNumber} تثبیت شد`,
        at: currentVersion.createdAt,
      });
    }
    if (request) {
      items.push({
        id: "request",
        labelFa: "درخواست تأیید و امضای الکترونیکی ایجاد شد",
        at: request.createdAt,
      });
      for (const participant of request.participants) {
        if (participant.status === "SIGNED") {
          items.push({
            id: `sign-${participant.id}`,
            labelFa: `امضای ${participant.roleFa} ثبت شد`,
            at: participant.signedAt,
          });
        } else if (participant.status === "DECLINED") {
          items.push({
            id: `decline-${participant.id}`,
            labelFa: `${participant.roleFa} از امضا خودداری کرد`,
            at: participant.declinedAt,
          });
        } else if (participant.status === "VIEWED") {
          items.push({
            id: `view-${participant.id}`,
            labelFa: `${participant.roleFa} سند را مشاهده کرد`,
            at: participant.viewedAt,
          });
        }
      }
    }
    const admin = view?.adminReview;
    if (admin) {
      items.push({
        id: "admin-review",
        labelFa: `بررسی ادمین: ${CONTRACT_ADMIN_REVIEW_STATUS_FA[admin.status]}`,
        at: admin.decidedAt ?? admin.submittedAt,
      });
    }
    if (contract.finalizedAt) {
      items.push({
        id: "finalized",
        labelFa: "قرارداد نهایی و بایگانی شد",
        at: contract.finalizedAt,
      });
    }
    return items;
  }, [contract.finalizedAt, currentVersion, request, view?.adminReview]);

  /**
   * Runs a write and reports whether it actually persisted. `ActionButton`
   * needs the boolean: a label may only say «انجام شد» after the server
   * accepted the write.
   */
  async function runResult(fn: () => Promise<unknown>): Promise<boolean> {
    setActionError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "عملیات ناموفق بود");
      return false;
    }
  }

  async function run(fn: () => Promise<unknown>): Promise<void> {
    await runResult(fn);
  }

  // ----------------------------------------------------------
  // AI review — through the EXISTING chat
  // ----------------------------------------------------------

  async function askAssistant() {
    await run(async () => {
      const res = await createAi.mutateAsync({ id: contract.id });
      router.push(`/chat/${res.conversationId}`);
    });
  }

  // ----------------------------------------------------------
  // The stamp object handed to the live A4 sheet. It MUST keep its
  // identity between renders: A4Document re-paginates whenever the
  // stamp changes, so an inline literal here re-measured the whole
  // document on every keystroke (comment box, OTP fields, checkboxes).
  // ----------------------------------------------------------
  const previewStamp = useMemo<A4ReviewStamp>(
    () =>
      // §3 — the self-final path draws its OWN amber notice in the review
      // mark's slot. It must never borrow the blue «بررسی شد» mark, which
      // the contract did not earn.
      view?.registration?.path === "self_final"
        ? {
            applied: true,
            path: "self_final" as const,
            reviewedAt: null,
            official: view.stamped === true,
            sealHref:
              view.stamped === true
                ? `/api/v1/property-contracts/${contract.id}/stamp-asset/seal`
                : undefined,
            hologramHref:
              view.stamped === true
                ? `/api/v1/property-contracts/${contract.id}/stamp-asset/hologram`
                : undefined,
            approvedByLabelFa: view.officialStamp?.approvedByLabelFa ?? null,
            approvedAt: view.officialStamp?.approvedAt ?? null,
          }
        : view?.adminApproved
        ? {
            applied: true,
            reviewedAt: view.adminReview?.decidedAt ?? null,
            reviewingOfficeFa: view.adminReview?.reviewingOfficeFa,
            reviewerInitials: view.adminReview?.reviewerInitials,
            reviewId: view.adminReview?.id,
            // The OFFICIAL seal is drawn only for a version a Super Admin
            // stamped; the assets are permission-gated routes, never public
            // files.
            official: view.stamped === true,
            sealHref:
              view.stamped === true
                ? `/api/v1/property-contracts/${contract.id}/stamp-asset/seal`
                : undefined,
            hologramHref:
              view.stamped === true
                ? `/api/v1/property-contracts/${contract.id}/stamp-asset/hologram`
                : undefined,
            approvedByLabelFa: view.officialStamp?.approvedByLabelFa ?? null,
            approvedAt: view.officialStamp?.approvedAt ?? null,
          }
        : { applied: false },
    [
      contract.id,
      view?.adminApproved,
      view?.registration?.path,
      view?.adminReview?.decidedAt,
      view?.adminReview?.id,
      view?.adminReview?.reviewerInitials,
      view?.adminReview?.reviewingOfficeFa,
      view?.officialStamp?.approvedAt,
      view?.officialStamp?.approvedByLabelFa,
      view?.stamped,
    ]
  );

  // ----------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Lifecycle stepper — the real progress rail */}
      {view && <LifecycleStepper steps={view.steps} />}

      {/* Status banner */}
      <div className="rounded-large border border-divider bg-surface p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-caption text-muted">وضعیت قرارداد</p>
            <p className="text-titleMedium text-on-surface">{stateLabelFa(contract.state)}</p>
          </div>
          {currentVersion && (
            <div className="text-left">
              <p className="text-caption text-muted">نسخه جاری</p>
              <p className="text-body-2 text-on-surface">
                نسخه {currentVersion.versionNumber} —{" "}
                {formatIsoJalali(currentVersion.createdAt.slice(0, 10))}
              </p>
            </div>
          )}
        </div>
        <div className="mt-3">
          <ProgressLinear
            value={completeness.overall}
            label={`تکمیل اطلاعات: ${completeness.overall}٪`}
            showValue
            color={completeness.overall === 100 ? "success" : "primary"}
          />
        </div>

        {/* Freezing the content is the gate to every review path: nothing
            above can run before a current version exists. */}
        {!contract.currentVersionId && (
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-caption text-muted">
              برای شروع بررسی، ابتدا محتوای قرارداد را تثبیت کنید.
            </p>
            <ActionButton
              idleLabel="تثبیت نسخه و ارسال برای بررسی"
              busyLabel="در حال ارسال…"
              successLabel="نسخه تثبیت و ارسال شد"
              errorLabel="ارسال نشد — تلاش مجدد"
              disabled={completeness.blockers.length > 0}
              onAction={() => runResult(() => submit.mutateAsync(contract.id))}
            />
          </div>
        )}
      </div>

      {actionError && <Notice tone="error">{actionError}</Notice>}

      {completeness.blockers.length > 0 && (
        <Notice tone="warning" title="پیش از ارسال به بررسی">
          این بخش‌ها هنوز کامل نشده‌اند: {completeness.blockers.map((b) => b.labelFa).join("، ")}
        </Notice>
      )}

      {/* ------------------------------------------------------
          Optional support paths — secondary, never competing with the
          single primary action at the bottom of the card.
          ------------------------------------------------------ */}
      <SectionCard
        title="بازبینی محتوا"
        description="در صورت نیاز از این دو مسیر کمکی استفاده کنید؛ اجباری نیستند"
      >
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void askAssistant()}
            disabled={createAi.isPending || !contract.currentVersionId}
            className="rounded-medium border border-divider p-3 text-right hover:state-hover disabled:opacity-50 transition-colors"
          >
            <span className="inline-flex items-center gap-2 text-labelLarge text-on-surface">
              <IconChat className="w-4 h-4 text-primary" />
              پرسش از دستیار هوشمند
            </span>
            <span className="block mt-1 text-caption text-muted">
              تحلیل هوش مصنوعی از دید یکی از طرفین — جایگزین نظر وکیل نیست.
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              void run(() =>
                createLawyer.mutateAsync({ id: contract.id, mode: "NON_BLOCKING" })
              )
            }
            disabled={createLawyer.isPending || !!lawyerReview || !contract.currentVersionId}
            className="rounded-medium border border-divider p-3 text-right hover:state-hover disabled:opacity-50 transition-colors"
          >
            <span className="inline-flex items-center gap-2 text-labelLarge text-on-surface">
              <IconLawBook className="w-4 h-4 text-primary" />
              بررسی توسط وکیل
            </span>
            <span className="block mt-1 text-caption text-muted">
              ارجاع به وکیل متخصص؛ پیشنهادها را می‌پذیرید یا رد می‌کنید.
            </span>
          </button>

        </div>

        {/* ONE primary action per state. A missing admin approval is the
            real blocker for signature, so it takes the slot; otherwise the
            stage hands over to the signing step. Two competing primary
            buttons were the source of the "which one do I press?" doubt. */}
        <div className="mt-3 border-t border-divider pt-3">
          {view?.printIssues && view.printIssues.length > 0 && (
            <Notice tone="error" title="پیش از ادامه، این موارد باید اصلاح شوند">
              <ul className="list-disc ps-5 space-y-1">
                {view.printIssues.map((issue) => (
                  <li key={`${issue.code}-${issue.documentId ?? issue.titleFa}`}>
                    {issue.messageFa}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-labelSmall">
                تا زمانی که این فایل‌ها قابل چاپ نباشند، امکان ثبت نهایی و تولید PDF کامل وجود
                ندارد؛ هیچ پیوستی بی‌صدا حذف نمی‌شود.
              </p>
            </Notice>
          )}

          {view?.registration?.path === "self_final" && (
            <Notice tone="warning" title="این نسخه بدون بررسی لیگالیر ثبت نهایی شد">
              ثبت‌کننده: {view.registration.actorLabelFa} —{" "}
              {formatIsoJalaliDateTime(view.registration.createdAt)}. این سند «بررسی‌شده» یا
              «تأییدشده» توسط لیگالیر نیست.
            </Notice>
          )}

          {view?.canSubmitForAdminReview && view?.canSelfFinalize ? (
            /* ------------------------------------------------------
               TWO registration paths. Exactly one is chosen, and both
               are offered side by side so neither is a hidden default.
               ------------------------------------------------------ */
            <div className="space-y-3">
              <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
                <div className="rounded-medium border border-divider p-3">
                  <p className="text-labelLarge text-on-surface">ارسال برای بررسی در لیگالیر</p>
                  <p className="mt-1 text-caption leading-6 text-muted">
                    نسخهٔ فعلی به صف بررسی واحد حقوقی لیگالیر می‌رود. پس از تأیید ادمین، امکان
                    امضای طرفین فراهم می‌شود. وضعیت بررسی برای شما و ادمین قابل مشاهده است.
                  </p>
                  <div className="mt-2">
                    <ActionButton
                      idleLabel="ارسال به بررسی لیگالیر"
                      busyLabel="در حال ارسال…"
                      successLabel="برای بررسی ارسال شد"
                      errorLabel="ارسال نشد — تلاش مجدد"
                      onAction={() => runResult(() => submitAdmin.mutateAsync(contract.id))}
                    />
                  </div>
                </div>

                <div className="rounded-medium border border-warning bg-warning-container p-3">
                  <p className="text-labelLarge text-on-surface">ثبت نهایی</p>
                  <p className="mt-1 text-caption leading-6 text-muted">
                    قرارداد مستقیماً به مرحلهٔ امضای طرفین می‌رود و وارد صف بررسی لیگالیر
                    نمی‌شود. این سند توسط لیگالیر بررسی نشده و هرگز «بررسی‌شده» نمایش داده
                    نمی‌شود.
                  </p>
                  <label className="mt-2 flex items-start gap-2 text-caption leading-6 text-on-surface">
                    <input
                      type="checkbox"
                      checked={unreviewedAcknowledged}
                      onChange={(e) => setUnreviewedAcknowledged(e.target.checked)}
                      className="mt-1 accent-[var(--color-warning)]"
                    />
                    <span>
                      می‌دانم این قرارداد بدون بررسی لیگالیر ثبت نهایی می‌شود و مسئولیت بررسی
                      حقوقی محتوا بر عهدهٔ طرفین است.
                    </span>
                  </label>
                  <div className="mt-2">
                    <ActionButton
                      idleLabel="ثبت نهایی بدون بررسی"
                      busyLabel="در حال ثبت…"
                      successLabel="ثبت نهایی شد"
                      errorLabel="ثبت نشد — تلاش مجدد"
                      disabled={!unreviewedAcknowledged}
                      onAction={() =>
                        runResult(() => selfFinal.mutateAsync({ id: contract.id }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : view?.canSubmitForAdminReview ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-caption text-muted">
                نسخهٔ فعلی برای بررسی واحد حقوقی لیگالیر ارسال می‌شود؛ پس از تأیید ادمین،
                امکان امضا فراهم می‌شود.
              </p>
              <ActionButton
                idleLabel="ارسال به بررسی لیگالیر"
                busyLabel="در حال ارسال…"
                successLabel="برای بررسی ارسال شد"
                errorLabel="ارسال نشد — تلاش مجدد"
                onAction={() => runResult(() => submitAdmin.mutateAsync(contract.id))}
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-caption text-muted">
                اطلاعات تکمیلی تأیید شده است؛ در مرحلهٔ بعد لینک امضا برای هر طرف ارسال
                می‌شود.
              </p>
              <Button
                startIcon={<IconSend className="w-4 h-4" />}
                onClick={() => goToStep("signature")}
              >
                ادامه به امضای طرفین
              </Button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ------------------------------------------------------
          §7 — «قبل از امضا بدانید»
          A section of its OWN, outside the contract text. It is
          informational: no acknowledgement, no gate, and it never
          changes what the contract says.
          ------------------------------------------------------ */}
      {(view?.preSignTips?.length ?? 0) > 0 && (
        <SectionCard
          title="نکات پیش از امضا"
          description="اطلاعات راهنما برای این نوع قرارداد — الزام‌آور نیست و نیازی به تأیید ندارد"
        >
          <ul className="space-y-3">
            {view!.preSignTips.map((tip) => (
              <li key={tip.id}>
                <p className="text-labelLarge text-on-surface">{tip.titleFa}</p>
                <p className="mt-1 text-caption leading-6 text-muted">{tip.bodyFa}</p>
                <p className="mt-1 text-labelSmall text-muted">
                  منبع: {tip.sourceNameFa} — نسخهٔ محتوا {tip.contentVersion}
                  {tip.status === "pending" && " — در انتظار بازبینی حقوقی"}
                  {tip.status === "needs_revision" && " — نیازمند اصلاح حقوقی"}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-divider pt-2 text-labelSmall leading-5 text-muted">
            این نکات بخشی از قرارداد نیستند، جایگزین مشاورهٔ حقوقی نمی‌شوند و امضای شما به معنای
            پذیرش آن‌ها به‌عنوان شرط قرارداد نیست.
          </p>
        </SectionCard>
      )}

      {/* ------------------------------------------------------
          Lawyer review panel
          ------------------------------------------------------ */}
      {lawyerReview && (
        <SectionCard
          title="بررسی حقوقی"
          description={lawyerReview.lawyerNameFa ?? "در حال یافتن وکیل"}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Chip label={lawyerReview.mode === "BLOCKING" ? "بازدارنده" : "غیربازدارنده"} />
            <Chip label={lawyerReview.category} />
            {lawyerReview.slaDueAt && (
              <span className="text-caption text-muted">
                مهلت: {formatIsoJalali(lawyerReview.slaDueAt.slice(0, 10))}
              </span>
            )}
          </div>

          {lawyerReview.summaryFa && (
            <p className="mt-3 text-body-2 text-on-surface whitespace-pre-line">
              {lawyerReview.summaryFa}
            </p>
          )}

          {lawyerReview.findings.length > 0 && (
            <div className="mt-3 space-y-2">
              {lawyerReview.findings.map((finding) => (
                <div key={finding.id} className="rounded-medium border border-divider p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-labelLarge text-on-surface">{finding.titleFa}</span>
                    <Chip label={SEVERITY_LABELS_FA[finding.severity]} />
                  </div>
                  <p className="mt-1 text-body-2 text-on-surface whitespace-pre-line">
                    {finding.bodyFa}
                  </p>
                  {finding.proposedText && (
                    <p className="mt-2 text-caption text-muted whitespace-pre-line">
                      متن پیشنهادی: {finding.proposedText}
                    </p>
                  )}
                  {finding.decision === "pending" ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="small"
                        onClick={() =>
                          void run(() =>
                            decideFinding.mutateAsync({
                              id: contract.id,
                              findingId: finding.id,
                              decision: "accepted",
                            })
                          )
                        }
                      >
                        پذیرش پیشنهاد
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          void run(() =>
                            decideFinding.mutateAsync({
                              id: contract.id,
                              findingId: finding.id,
                              decision: "rejected",
                            })
                          )
                        }
                      >
                        رد پیشنهاد
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-caption text-muted">
                      {finding.decision === "accepted" ? "پذیرفته شد" : "رد شد"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {(lawyerReview.state === "AWAITING_ACCEPTANCE" ||
              lawyerReview.state === "MATCHING") && (
              <Button
                size="small"
                variant="tonal"
                onClick={() => void run(() => acceptLawyer.mutateAsync({ id: contract.id }))}
                loading={acceptLawyer.isPending}
              >
                پذیرش وکیل
              </Button>
            )}
            {(lawyerReview.state === "ACCEPTED" || lawyerReview.state === "IN_PROGRESS") && (
              <Button
                size="small"
                onClick={() =>
                  void run(() =>
                    completeLawyer.mutateAsync({
                      id: contract.id,
                      summaryFa: "بررسی حقوقی انجام شد.",
                    })
                  )
                }
                loading={completeLawyer.isPending}
              >
                تکمیل بررسی
              </Button>
            )}
            <Button
              size="small"
              variant="text"
              onClick={() => void run(() => cancelLawyer.mutateAsync({ id: contract.id }))}
              loading={cancelLawyer.isPending}
            >
              لغو درخواست
            </Button>
          </div>
        </SectionCard>
      )}

      {/* ------------------------------------------------------
          AI review panel
          ------------------------------------------------------ */}
      {aiReview && (
        <SectionCard title="تحلیل هوش مصنوعی" description={`از دید ${aiReview.perspectiveRoleFa}`}>
          <Notice tone="info" title="این تحلیل هوش مصنوعی است">
            این متن جایگزین نظر وکیل نیست.
          </Notice>
          <p className="mt-3 text-body-2 text-on-surface whitespace-pre-line">
            {aiReview.summaryFa}
          </p>
          <Button
            size="small"
            variant="text"
            startIcon={<IconChat className="w-4 h-4" />}
            onClick={() => router.push(`/chat/${aiReview.conversationId}`)}
          >
            مشاهده گفتگوی کامل
          </Button>
        </SectionCard>
      )}

      {/* ------------------------------------------------------
          Review comments
          ------------------------------------------------------ */}
      <SectionCard
        title="نظرها و درخواست‌های اصلاح"
        description="جدا از متن رسمی قرارداد — هر نظر به نسخه‌ای که برای آن نوشته شده گره خورده است"
      >
        <Notice tone="info">
          نظرها بخشی از متن قرارداد نیستند و در سند چاپی نمی‌آیند. برای اعمال یک درخواست تغییر
          باید بند اصلی در مرحلهٔ مربوط ویرایش و نسخهٔ جدید تثبیت شود.
        </Notice>

        {commentThreads.length === 0 ? (
          <p className="mt-3 text-body-2 text-muted">هنوز نظری ثبت نشده است.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {commentThreads.map(({ root, replies }) => (
              <li key={root.id} className="space-y-2">
                {[root, ...replies].map((comment, index) => {
                  const shared = (comment.visibility ?? "internal") === "parties";
                  const isCurrent = comment.contractVersionId === contract.currentVersionId;
                  return (
                    <div
                      key={comment.id}
                      className={`rounded-medium border p-3 ${
                        index === 0 ? "border-divider" : "border-divider ms-6 border-s-2"
                      } ${replyTo === comment.id ? "border-primary" : ""}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-labelLarge text-on-surface">
                          {comment.authorLabelFa}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-caption text-muted">
                            {commentVersionLabelFa(comment)}
                          </span>
                          <span className="text-caption text-muted">
                            {formatIsoJalaliDateTime(comment.createdAt)}
                          </span>
                        </div>
                      </div>
                      {commentClauseLabel(comment.clauseRef) && (
                        <p className="mt-1 text-caption text-primary">
                          بند مرتبط: {commentClauseLabel(comment.clauseRef)}
                        </p>
                      )}
                      <p className="mt-1 text-body-2 text-on-surface whitespace-pre-line">
                        {comment.body}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-caption text-muted">
                          {shared ? "مشترک با طرفین" : "داخلی — برای طرفین ارسال نمی‌شود"}
                          {comment.kind === "change_request" ? " · درخواست اصلاح" : ""}
                        </span>
                        {isCurrent && contract.currentVersionId && (
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<IconChat className="w-3.5 h-3.5" />}
                            onClick={() => setReplyTo(comment.id)}
                          >
                            پاسخ
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <ContractCommentComposer
            contractId={contract.id}
            currentVersionId={contract.currentVersionId}
            clauses={commentClauses}
            replyTo={replyTo}
            replyToLabelFa={replyTarget?.authorLabelFa}
            onCancelReply={() => setReplyTo(null)}
            initialVisibility={replyTarget?.visibility ?? "internal"}
          />
        </div>
      </SectionCard>

      {/* ------------------------------------------------------
          Readable status history — contract-level only. The raw audit
          trail (actor/service/action ids) is kept in the backend and is
          shown only in the authorised admin area, never on this page.
          ------------------------------------------------------ */}
      <SectionCard
        title="روند قرارداد"
        description="وضعیت‌های این قرارداد، به ترتیب زمان"
      >
        {statusTimeline.length > 0 ? (
          <ol className="space-y-2">
            {statusTimeline.map((item) => (
              <li
                key={item.id}
                className="rounded-medium border border-divider px-3 py-2 flex items-start justify-between gap-3 flex-wrap"
              >
                <span className="text-body-2 text-on-surface">{item.labelFa}</span>
                <span className="text-caption text-muted shrink-0">
                  {item.at ? formatIsoJalali(item.at.slice(0, 10)) : ""}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body-2 text-muted">هنوز رویداد قابل‌نمایشی ثبت نشده است.</p>
        )}
      </SectionCard>

      {/* Registration policy — never hard-coded */}
      <Notice tone="info" title="ثبت رسمی">
        {def.registrationPolicy.explanationFa}
        {view?.registrationStatusFa && (
          <span className="block mt-1 text-caption text-muted">
            وضعیت ثبت: {view.registrationStatusFa}
          </span>
        )}
      </Notice>

      {/* Live preview — same engine as the snapshot and the PDF */}
      <div>
        <h3 className="text-titleMedium text-on-surface mb-2">پیش‌نمایش قرارداد</h3>
        <LivePreview
          contract={{ ...contract, data }}
          parties={parties}
          payments={payments}
          versionNumber={currentVersion?.versionNumber ?? null}
          documentHash={currentVersion?.documentHash ?? null}
          signatureMarks={signatureMarks}
          pdfHref={
            contract.currentVersionId
              ? contractPdfUrl(contract.id, contract.currentVersionId)
              : undefined
          }
          stamp={previewStamp}
          printMirror={view?.printMirror ?? null}
        />
      </div>

    </div>
  );
}
