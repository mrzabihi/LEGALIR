// ============================================================
// LEGALIR — Admin · Contract review drawer (بررسی قرارداد)
// ============================================================
// §6/§7 of the contract spec: the operator's ONE surface for judging a
// generated contract before it may be issued. It renders the SAME document
// the owner sees (the server's `renderContract` output), the parties, the
// completeness, the current version hash and the review history — then offers
// exactly the four actions the backend permits:
//
//   approve       تأیید برای صدور نهایی
//   reject        رد و بازگرداندن همراه با دلیل
//   request_info  درخواست اطلاعات یا اصلاح مشخص
//   cancel        لغو بررسی با علت
//
// The decision is bound to the review's version hash server-side; this drawer
// never invents a transition, and only the ONE open (PENDING) review can be
// decided. Without `admin:contracts:review` the surface is read-only.
// ============================================================

"use client";

import { useState } from "react";
import { Drawer, ConfirmDialog, snackbar } from "@legalir/ui";
import type {
  AdminContractReviewActionRequest,
  ContractAdminReviewAction,
} from "@legalir/types";
import { CONTRACT_ADMIN_REVIEW_STATUS_FA } from "@legalir/types";
import { useAdminContract, useAdminContractReview, useAdminMe } from "@/hooks/useAdmin";
import { ContractStampPanel } from "./contract-stamp-panel";
import {
  Badge,
  Button,
  ErrorBlock,
  Field,
  InfoBanner,
  LoadingBlock,
  TextArea,
} from "@/components/admin/ui";
import { IconCheckCircle, IconClose, IconDocument, IconShield } from "@/lib/icons";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";

/** The Persian label for each decision. */
const ACTION_FA: Record<ContractAdminReviewAction, string> = {
  approve: "تأیید برای صدور نهایی",
  reject: "رد قرارداد",
  request_info: "درخواست اصلاح",
  cancel: "لغو بررسی",
};

const STATUS_TONES: Record<
  string,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CHANGES_REQUESTED: "warning",
  CANCELLED: "neutral",
};

/** Actions that require a written reason before they may be submitted. */
const REASON_REQUIRED: ContractAdminReviewAction[] = ["reject", "request_info", "cancel"];

/** Actions destructive enough to confirm even after the reason is typed. */
const CONFIRM_ACTIONS: ContractAdminReviewAction[] = ["reject", "cancel"];

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

export function ContractDetailDrawer({
  contractId,
  canReview,
  onClose,
}: {
  contractId: string | null;
  canReview: boolean;
  onClose: () => void;
}) {
  const detail = useAdminContract(contractId);
  const review = useAdminContractReview();
  // `useAdminMe` must run unconditionally (rules of hooks); it is the same
  // cached read the page uses, so there is no extra request.
  const { can } = useAdminMe();
  // The OFFICIAL stamp is a Super-Admin-only act; the server enforces the
  // permission, and the panel only offers what the permission allows.
  const canStamp = can("admin:contracts:stamp:manage");
  // Reading the stamp context is its own permission; without it the panel is
  // never rendered, so a reviewer role never sees an empty or failing block.
  const canReadStamp = can("admin:contracts:stamp:read");

  const [activeAction, setActiveAction] = useState<ContractAdminReviewAction | null>(null);
  const [reason, setReason] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<ContractAdminReviewAction | null>(null);

  const data = detail.data;
  const events = data?.adminReview?.events ?? [];
  // The decision panel only appears while a review is PENDING; a decision can
  // never be replayed onto a terminal review (the server rejects it too).
  const canDecide = canReview && data?.adminReview?.status === "PENDING";

  function beginAction(action: ContractAdminReviewAction) {
    if (REASON_REQUIRED.includes(action)) {
      setActiveAction(action);
      setReason("");
    } else {
      void submit(action, "");
    }
  }

  async function submit(action: ContractAdminReviewAction, reasonText: string) {
    if (!contractId) return;
    const input: AdminContractReviewActionRequest = { action };
    if (reasonText.trim()) input.reason = reasonText.trim();
    try {
      await review.mutateAsync({ id: contractId, input });
      snackbar.show({ message: `${ACTION_FA[action]} انجام شد.`, variant: "success" });
      setActiveAction(null);
      setPendingConfirm(null);
      setReason("");
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ثبت بررسی ناموفق بود"), variant: "error" });
      setActiveAction(null);
      setPendingConfirm(null);
    }
  }

  function confirmReasonAction() {
    if (!activeAction) return;
    if (reason.trim().length < 3) {
      snackbar.show({ message: "ثبت دلیل الزامی است.", variant: "warning" });
      return;
    }
    if (CONFIRM_ACTIONS.includes(activeAction)) {
      setPendingConfirm(activeAction);
    } else {
      void submit(activeAction, reason);
    }
  }

  return (
    <>
      <Drawer
        open={Boolean(contractId)}
        onClose={onClose}
        width={680}
        title={data ? `بررسی قرارداد — ${data.contract.referenceCode}` : "بررسی قرارداد"}
      >
        {detail.isLoading ? (
          <LoadingBlock rows={8} />
        ) : detail.isError || !data ? (
          <ErrorBlock onRetry={() => detail.refetch()} />
        ) : (
          <div className="space-y-5">
            {!canReview && (
              <InfoBanner tone="warning">
                شما مجوز «تأیید/رد و بررسی قراردادها» را ندارید؛ این نمایش فقط‌خواندنی است.
              </InfoBanner>
            )}

            {/* --- Identity + state --- */}
            <div className="rounded-large border border-divider p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONES[data.adminReview?.status ?? ""] ?? "neutral"} dot>
                  {data.adminReview
                    ? CONTRACT_ADMIN_REVIEW_STATUS_FA[data.adminReview.status]
                    : "بدون بررسی ثبت‌شده"}
                </Badge>
                <Badge tone="brand">{data.contract.stateFa}</Badge>
                {data.approved && (
                  <Badge tone="success">
                    <IconCheckCircle size={13} /> نسخهٔ فعلی تأییدشده است
                  </Badge>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-caption">
                <Info label="عنوان" value={data.contract.title || "بدون عنوان"} />
                <Info label="نوع" value={data.contract.typeFa} />
                <Info label="کاربر مالک" value={data.contract.ownerLabelFa} />
                <Info label="طرفین" value={data.contract.partySummaryFa} />
                <Info label="کد پیگیری" value={data.contract.referenceCode} mono />
                <Info label="پیشرفت" value={`${toPersianNumber(data.contract.progress)}٪`} />
                <Info label="ایجاد" value={toPersianDate(data.contract.createdAt)} />
                <Info label="آخرین تغییر" value={toPersianDate(data.contract.updatedAt)} />
              </dl>
            </div>

            {/* --- Version binding — what the decision is bound to --- */}
            <Section title="نسخه و اثر انگشت">
              {data.currentVersion ? (
                <div className="space-y-2 text-caption">
                  <Info
                    label="نسخهٔ فعلی"
                    value={`نسخه ${toPersianNumber(data.currentVersion.versionNumber)} — ${toPersianDate(
                      data.currentVersion.createdAt
                    )}`}
                  />
                  <div>
                    <dt className="mb-1 text-muted">اثر انگشت (SHA-256)</dt>
                    <dd className="break-all font-mono text-on-surface" dir="ltr">
                      {data.currentVersion.documentHash}
                    </dd>
                  </div>
                  <p className="text-caption text-muted">
                    تصمیم بررسی به همین اثر انگشت گره می‌خورد؛ اگر محتوای قرارداد پس از تأیید تغییر
                    کند، تأیید باطل می‌شود و قرارداد باید دوباره به صف بازگردد.
                  </p>
                </div>
              ) : (
                <p className="text-caption text-muted">
                  نسخه‌ای تثبیت نشده است؛ قرارداد هنوز برای بررسی آماده نیست.
                </p>
              )}
            </Section>

            {/* --- Completeness — blocking issues --- */}
            {data.completeness.blockers.length > 0 && (
              <InfoBanner tone="warning">
                <p className="font-medium">این قرارداد موارد ناقص دارد:</p>
                <ul className="mt-1 list-disc ps-4">
                  {data.completeness.blockers.map((b) => (
                    <li key={b.sectionKey}>{b.labelFa}</li>
                  ))}
                </ul>
              </InfoBanner>
            )}

            {/* --- The document under review (the SAME render the owner sees) --- */}
            <Section
              title="سند مورد بررسی"
              icon={<IconDocument size={16} className="text-primary" />}
            >
              <article
                dir="rtl"
                className="rounded-medium border border-divider bg-surface-container p-3"
              >
                <h5 className="text-titleSmall text-on-surface">{data.rendered.titleFa}</h5>
                {data.rendered.preambleFa && (
                  <p className="mt-2 whitespace-pre-line text-caption leading-6 text-on-surface-variant">
                    {data.rendered.preambleFa}
                  </p>
                )}
                <div className="mt-3 space-y-3">
                  {data.rendered.clauses.map((clause) => (
                    <div key={clause.id}>
                      <p className="text-body-2 font-bold text-on-surface">{clause.headingFa}</p>
                      {/* Review the SAME block model the PDF and preview print:
                          a table stays a table here, never a run-on paragraph. */}
                      {(clause.blocks && clause.blocks.length > 0
                        ? clause.blocks
                        : clause.paragraphs.map((p) => ({ kind: "paragraph" as const, textFa: p }))
                      ).map((block, i) =>
                        block.kind === "table" ? (
                          <div key={i} className="mt-2 overflow-x-auto">
                            {block.table.captionFa && (
                              <p className="mb-1 text-caption text-muted">{block.table.captionFa}</p>
                            )}
                            <table className="w-full border-collapse text-caption">
                              <thead>
                                <tr>
                                  {block.table.columnsFa.map((col, ci) => (
                                    <th
                                      key={ci}
                                      className="border border-divider bg-surface-container-low px-2 py-1 text-start font-medium text-on-surface"
                                    >
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {block.table.rowsFa.map((row, ri) => (
                                  <tr key={ri}>
                                    {row.map((cell, ci) => (
                                      <td
                                        key={ci}
                                        className="border border-divider px-2 py-1 text-on-surface-variant"
                                      >
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p
                            key={i}
                            className="mt-1 whitespace-pre-line text-caption leading-6 text-on-surface-variant"
                          >
                            {block.textFa}
                          </p>
                        )
                      )}
                    </div>
                  ))}
                </div>
                {data.rendered.footerFa && (
                  <p className="mt-3 border-t border-divider pt-2 text-caption text-muted">
                    {data.rendered.footerFa}
                  </p>
                )}
              </article>
            </Section>

            {/* --- Legal basis (§2) — the cited provisions, non-binding --- */}
            {data.legalBasis.sections.length > 0 && (
              <Section title="مبنای حقوقی و گزارش بررسی">
                <p className="rounded-medium bg-surface-container-low p-2.5 text-caption leading-6 text-muted">
                  {data.legalBasis.disclaimerFa}
                </p>
                <ul className="mt-3 space-y-2.5">
                  {data.legalBasis.sections.map((section) => (
                    <li key={section.clauseId}>
                      <p className="text-labelMedium text-on-surface-variant">
                        {section.clauseHeadingFa}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {section.citations.map((c, i) => (
                          <li key={i} className="text-caption leading-6 text-on-surface-variant">
                            <span className="font-medium text-on-surface">{c.articleFa}</span>
                            {` (${c.lawTitleFa}) — ${c.noteFa}`}
                            {c.status === "pending" && (
                              <span className="ms-1 rounded-small bg-surface-container px-1.5 py-0.5 text-labelSmall text-muted">
                                در انتظار بازبینی
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                {data.legalBasis.uncitedClauseCount > 0 && (
                  <p className="mt-2 text-caption text-muted">
                    {toPersianNumber(data.legalBasis.uncitedClauseCount)} بند دیگر بر پایهٔ توافق
                    طرفین تنظیم شده و استناد قانونی جداگانه‌ای ندارد.
                  </p>
                )}
              </Section>
            )}

            {/* --- Parties --- */}
            {data.parties.length > 0 && (
              <Section title="طرفین">
                <ul className="space-y-1.5 text-caption">
                  {data.parties.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span className="text-on-surface-variant">{p.role}</span>
                      <span className="text-on-surface">
                        {p.nameFa}
                        {p.isInitiator && <span className="ms-2 text-muted">(آغازگر)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* --- The owner's review thread, including internal notes --- */}
            {data.comments.length > 0 && (
              <Section title="نظرها و درخواست‌های اصلاح">
                <p className="text-caption text-muted">
                  هر نظر به نسخه‌ای که برای آن نوشته شده گره خورده است. نظرهای «داخلی» به طرفین
                  نمی‌رسند و فقط در این پنل دیده می‌شوند.
                </p>
                <ul className="mt-2 space-y-2">
                  {data.comments.map((comment) => {
                    const version = data.versions.find(
                      (v) => v.id === comment.contractVersionId
                    );
                    const isCurrent = comment.contractVersionId === data.currentVersion?.id;
                    const shared = (comment.visibility ?? "internal") === "parties";
                    return (
                      <li
                        key={comment.id}
                        className={`rounded-medium border border-divider p-2.5 ${
                          comment.parentId ? "ms-4 border-s-2" : ""
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-labelMedium text-on-surface">
                            {comment.authorLabelFa}
                          </span>
                          <span className="text-labelSmall text-muted">
                            {version
                              ? `نسخه ${toPersianNumber(version.versionNumber)}${
                                  isCurrent ? " (جاری)" : ""
                                }`
                              : isCurrent
                                ? "نسخهٔ جاری"
                                : "نسخهٔ پیشین"}
                            {" · "}
                            {toPersianDate(comment.createdAt)}
                          </span>
                        </div>
                        {comment.clauseRef && (
                          <p className="mt-1 text-labelSmall text-primary">
                            بند مرتبط:{" "}
                            {data.rendered.clauses.find((c) => c.id === comment.clauseRef)
                              ?.headingFa ?? comment.clauseRef}
                          </p>
                        )}
                        <p className="mt-1 whitespace-pre-line text-caption leading-6 text-on-surface-variant">
                          {comment.body}
                        </p>
                        <p className="mt-1 text-labelSmall text-muted">
                          {shared ? "مشترک با طرفین" : "داخلی"}
                          {comment.kind === "change_request" ? " · درخواست اصلاح" : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}

            {/* --- Decision --- */}
            <Section
              title="تصمیم بررسی"
              icon={<IconShield size={16} className="text-primary" />}
            >
              {!canDecide ? (
                <p className="text-caption text-muted">
                  {!canReview
                    ? "برای ثبت تصمیم، مجوز بررسی لازم است."
                    : data.adminReview
                      ? `آخرین تصمیم: «${CONTRACT_ADMIN_REVIEW_STATUS_FA[data.adminReview.status]}». برای بررسی دوباره، قرارداد باید از نو به صف ارسال شود.`
                      : "بررسی‌ای در انتظار تصمیم نیست."}
                </p>
              ) : activeAction ? (
                <div className="space-y-3">
                  <Field
                    label={`دلیل «${ACTION_FA[activeAction]}»`}
                    hint="این متن در تاریخچهٔ بررسی و لاگ حسابرسی ثبت می‌شود."
                    required
                  >
                    <TextArea
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="دلیل یا توضیح لازم را بنویسید…"
                    />
                  </Field>
                  <div className="flex justify-start gap-2">
                    <Button
                      variant={CONFIRM_ACTIONS.includes(activeAction) ? "danger" : "primary"}
                      size="sm"
                      loading={review.isPending}
                      onClick={confirmReasonAction}
                    >
                      ثبت «{ACTION_FA[activeAction]}»
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={review.isPending}
                      onClick={() => setActiveAction(null)}
                    >
                      انصراف
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    startIcon={<IconCheckCircle size={15} />}
                    disabled={review.isPending}
                    onClick={() => beginAction("approve")}
                  >
                    تأیید برای صدور نهایی
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={review.isPending}
                    onClick={() => beginAction("request_info")}
                  >
                    درخواست اصلاح
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    startIcon={<IconClose size={15} />}
                    disabled={review.isPending}
                    onClick={() => beginAction("reject")}
                  >
                    رد
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={review.isPending}
                    onClick={() => beginAction("cancel")}
                  >
                    لغو بررسی
                  </Button>
                </div>
              )}
            </Section>

            {/* --- The OFFICIAL stamp (§5) — Super-Admin only --- */}
            {canReadStamp && (
              <Section
                title="مهر و هولوگرام رسمی"
                icon={<IconShield size={16} className="text-primary" />}
              >
                <p className="mb-3 text-caption leading-6 text-muted">
                  این مهر قوی‌تر از بررسی داخلی است و فقط پس از امضای همهٔ طرفین و با تصمیم
                  مدیر ارشد روی همین نسخه درج می‌شود. تأیید ادمین جایگزین امضای طرفین نیست.
                </p>
                <ContractStampPanel contractId={contractId} canManage={canStamp} />
              </Section>
            )}

            {/* --- Review history --- */}
            {events.length > 0 && (
              <Section title="تاریخچهٔ بررسی">
                <ol className="space-y-2.5">
                  {events.map((e) => (
                    <li key={e.id} className="flex gap-2.5 text-caption">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <p className="text-on-surface">
                          <span className="font-medium">{ACTION_FA[e.action]}</span>
                          {" — "}
                          <span className="text-muted">{e.actorLabel}</span>
                        </p>
                        <p className="text-muted">{toPersianDate(e.createdAt)}</p>
                        {e.reasonFa && (
                          <p className="mt-0.5 text-on-surface-variant">{e.reasonFa}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => pendingConfirm && submit(pendingConfirm, reason)}
        title={pendingConfirm ? ACTION_FA[pendingConfirm] : "تأیید بررسی"}
        description={
          pendingConfirm
            ? `آیا از «${ACTION_FA[pendingConfirm]}» مطمئن هستید؟ این عمل در لاگ حسابرسی ثبت می‌شود.`
            : undefined
        }
        confirmLabel="ثبت تصمیم"
        destructive={pendingConfirm !== null && CONFIRM_ACTIONS.includes(pendingConfirm)}
        loading={review.isPending}
      />
    </>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-large border border-divider p-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-body-2 font-bold text-on-surface">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className={`truncate text-on-surface-variant ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </dd>
    </div>
  );
}
