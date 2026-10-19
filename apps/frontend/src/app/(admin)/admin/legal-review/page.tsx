// ============================================================
// LEGALIR — Admin · Per-type legal review (بازبینی حقوقی قالب‌ها)
// ============================================================
// §7 of the contract brief: the authorised revision path for the legal
// content every contract of a type is built on.
//
//   • each clause's cited provision, its SOURCE name, the content VERSION
//     it was reviewed at, and the review STATE (reviewed / pending /
//     needs_revision);
//   • clauses with no source at all are listed, never hidden — a reviewer
//     can attach a real provision instead of leaving it unreviewed;
//   • the «قبل از امضا» tips are edited here too. They are informational,
//     separate from the contract text and require no acknowledgement.
//
// Saves are versioned server-side (contentVersion + reviewedAt) and every
// write lands in the platform audit trail. This page never invents an
// article: the reviewer types the source they consulted.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog, snackbar } from "@legalir/ui";
import type { ContractLegalCitationStatus, ContractTypeId } from "@legalir/types";
import {
  useAdminLegalReview,
  useAdminMe,
  useDeleteAdminLegalReviewItem,
  useSaveAdminLegalClause,
  useSaveAdminPreSignTip,
} from "@/hooks/useAdmin";
import {
  Badge,
  Button,
  EmptyBlock,
  Field,
  PageHeader,
  Section,
  Select,
  StateView,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import { IconCheckCircle, IconDelete, IconEdit, IconLawBook, IconWarning } from "@/lib/icons";

const STATUS_FA: Record<ContractLegalCitationStatus, string> = {
  reviewed: "بازبینی‌شده",
  pending: "در انتظار بررسی حقوقی",
  needs_revision: "نیازمند اصلاح حقوقی",
};

const STATUS_TONES: Record<ContractLegalCitationStatus, "success" | "warning" | "danger"> = {
  reviewed: "success",
  pending: "warning",
  needs_revision: "danger",
};

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

interface ClauseForm {
  clauseId: string;
  clauseHeadingFa: string;
  sourceNameFa: string;
  lawSourceId: string;
  articleFa: string;
  noteFa: string;
  status: ContractLegalCitationStatus;
}

interface TipForm {
  id: string | null;
  titleFa: string;
  bodyFa: string;
  sourceNameFa: string;
  order: number;
  status: ContractLegalCitationStatus;
}

export default function AdminLegalReviewPage() {
  const { can } = useAdminMe();
  const canEdit = can("admin:contracts:review");

  const query = useAdminLegalReview();
  const types = query.data?.types ?? [];

  const [typeId, setTypeId] = useState<ContractTypeId | "">("");
  useEffect(() => {
    if (!typeId && types.length > 0) setTypeId(types[0]!.typeId);
  }, [typeId, types]);

  const current = useMemo(
    () => types.find((t) => t.typeId === typeId) ?? types[0],
    [types, typeId]
  );

  const saveClause = useSaveAdminLegalClause();
  const saveTip = useSaveAdminPreSignTip();
  const removeItem = useDeleteAdminLegalReviewItem();

  const [clauseForm, setClauseForm] = useState<ClauseForm | null>(null);
  const [tipForm, setTipForm] = useState<TipForm | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "clause" | "tip";
    id: string;
    label: string;
  } | null>(null);

  function openClauseEditor(row: NonNullable<typeof current>["report"]["clauses"][number]) {
    const stored = row.records[0];
    const seeded = row.seeded[0];
    setClauseForm({
      clauseId: row.clauseId,
      clauseHeadingFa: row.clauseHeadingFa,
      sourceNameFa: stored?.sourceNameFa ?? seeded?.sourceNameFa ?? "",
      lawSourceId: stored?.lawSourceId ?? "",
      articleFa: stored?.articleFa ?? seeded?.articleFa ?? "",
      noteFa: stored?.noteFa ?? "",
      status: stored?.status ?? seeded?.status ?? "pending",
    });
  }

  function submitClause() {
    if (!clauseForm || !current) return;
    saveClause.mutate(
      {
        contractType: current.typeId,
        clauseId: clauseForm.clauseId,
        sourceNameFa: clauseForm.sourceNameFa.trim(),
        lawSourceId: clauseForm.lawSourceId.trim() || null,
        articleFa: clauseForm.articleFa.trim(),
        noteFa: clauseForm.noteFa.trim(),
        status: clauseForm.status,
      },
      {
        onSuccess: (res) => {
          snackbar.show({
            message: `ذخیره شد — نسخهٔ محتوای ${toPersianNumber(res.record.contentVersion)}`,
            variant: "success",
          });
          setClauseForm(null);
        },
        onError: (err) =>
          snackbar.show({
            message: errMessage(err, "ذخیرهٔ مبنای حقوقی ناموفق بود"),
            variant: "error",
          }),
      }
    );
  }

  function submitTip() {
    if (!tipForm || !current) return;
    saveTip.mutate(
      {
        id: tipForm.id,
        contractType: current.typeId,
        titleFa: tipForm.titleFa.trim(),
        bodyFa: tipForm.bodyFa.trim(),
        sourceNameFa: tipForm.sourceNameFa.trim(),
        order: tipForm.order,
        status: tipForm.status,
      },
      {
        onSuccess: (res) => {
          snackbar.show({
            message: `ذخیره شد — نسخهٔ محتوای ${toPersianNumber(res.tip.contentVersion)}`,
            variant: "success",
          });
          setTipForm(null);
        },
        onError: (err) =>
          snackbar.show({ message: errMessage(err, "ذخیرهٔ نکته ناموفق بود"), variant: "error" }),
      }
    );
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    removeItem.mutate(
      { kind: pendingDelete.kind, id: pendingDelete.id },
      {
        onSuccess: () => {
          snackbar.show({
            message: "حذف شد؛ منبع اولیه دوباره اعمال می‌شود.",
            variant: "success",
          });
          setPendingDelete(null);
        },
        onError: (err) => {
          snackbar.show({ message: errMessage(err, "حذف ناموفق بود"), variant: "error" });
          setPendingDelete(null);
        },
      }
    );
  }

  return (
    <div>
      <PageHeader
        title="بازبینی حقوقی قالب‌ها"
        description="مبنای حقوقی هر نوع قرارداد و نکات «قبل از امضا»، همراه با منبع، شمارهٔ ماده، نسخهٔ محتوا و وضعیت بررسی. هر ذخیره نسخهٔ تازه می‌سازد و در تاریخچهٔ حسابرسی ثبت می‌شود؛ بند بدون منبع حذف نمی‌شود، برای بازبینی علامت می‌خورد."
        icon={<IconLawBook size={22} />}
      />

      <StateView
        query={query}
        loadingRows={4}
        isEmpty={(d) => d.types.length === 0}
        emptyMessage="نوع قراردادی برای بازبینی یافت نشد."
      >
        {() => (
          <>
            <Section
              title="نوع قرارداد"
              subtitle="هر قالب، مبنای حقوقی و نکات پیش از امضای خودش را دارد."
            >
              <div className="max-w-sm">
                <Field label="نوع قرارداد">
                  <Select
                    value={current?.typeId ?? ""}
                    onChange={(e) => {
                      setTypeId(e.target.value as ContractTypeId);
                      setClauseForm(null);
                      setTipForm(null);
                    }}
                  >
                    {types.map((t) => (
                      <option key={t.typeId} value={t.typeId}>
                        {t.typeFa}
                        {t.implemented ? "" : " (به‌زودی)"}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {current && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-caption">
                  <Badge tone="success" dot>
                    بازبینی‌شده: {toPersianNumber(current.report.reviewedClauseCount)}
                  </Badge>
                  <Badge tone="warning" dot>
                    در انتظار: {toPersianNumber(current.report.pendingClauseCount)}
                  </Badge>
                  <Badge tone="danger" dot>
                    نیازمند اصلاح: {toPersianNumber(current.report.needsRevisionCount)}
                  </Badge>
                  <Badge tone="neutral" dot>
                    بدون منبع: {toPersianNumber(current.report.unflaggedCount)}
                  </Badge>
                </div>
              )}
            </Section>

            {current && (
              <Section
                title="مبنای حقوقی بندها"
                subtitle="منبع فقط از سوی بازبین وارد می‌شود؛ شمارهٔ ماده هرگز حدس زده نمی‌شود."
                actions={
                  <span className="text-caption text-muted">
                    {toPersianNumber(current.report.clauses.length)} بند
                  </span>
                }
              >
                {clauseForm && (
                  <div className="mb-4 rounded-large border border-primary/30 bg-primary-soft/40 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-body-2 font-bold text-on-surface">
                        {clauseForm.clauseHeadingFa}
                      </h3>
                      <span className="font-mono text-caption text-muted" dir="ltr">
                        {clauseForm.clauseId}
                      </span>
                    </div>
                    <div className="grid gap-3 tablet:grid-cols-2">
                      <Field
                        label="نام منبع حقوقی"
                        required
                        hint="مثلاً «قانون مدنی» یا نام دقیق سند"
                      >
                        <TextInput
                          value={clauseForm.sourceNameFa}
                          onChange={(e) =>
                            setClauseForm({ ...clauseForm, sourceNameFa: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="شمارهٔ ماده"
                        required
                        hint="در صورت اطمینان؛ مبنای نامطمئن ثبت نشود"
                      >
                        <TextInput
                          value={clauseForm.articleFa}
                          onChange={(e) =>
                            setClauseForm({ ...clauseForm, articleFa: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="شناسهٔ منبع در کاتالوگ قانون"
                        hint="اختیاری — فقط اگر در کاتالوگ رسمی موجود است"
                      >
                        <TextInput
                          value={clauseForm.lawSourceId}
                          onChange={(e) =>
                            setClauseForm({ ...clauseForm, lawSourceId: e.target.value })
                          }
                          dir="ltr"
                        />
                      </Field>
                      <Field label="وضعیت بازبینی" required>
                        <Select
                          value={clauseForm.status}
                          onChange={(e) =>
                            setClauseForm({
                              ...clauseForm,
                              status: e.target.value as ContractLegalCitationStatus,
                            })
                          }
                        >
                          {(Object.keys(STATUS_FA) as ContractLegalCitationStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {STATUS_FA[s]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field
                        label="توضیح استناد"
                        required
                        hint="حداقل ۱۰ نویسه — این متن در پیوست چاپ می‌شود"
                      >
                        <TextArea
                          rows={3}
                          value={clauseForm.noteFa}
                          onChange={(e) =>
                            setClauseForm({ ...clauseForm, noteFa: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="primary"
                        onClick={submitClause}
                        loading={saveClause.isPending}
                        disabled={saveClause.isPending}
                      >
                        ذخیرهٔ نسخهٔ جدید
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setClauseForm(null)}
                        disabled={saveClause.isPending}
                      >
                        انصراف
                      </Button>
                    </div>
                  </div>
                )}

                {current.report.clauses.length === 0 ? (
                  <EmptyBlock message="این نوع هنوز بندی برای بازبینی ندارد." />
                ) : (
                  <div className="space-y-2">
                    {current.report.clauses.map((row) => {
                      const stored = row.records.length > 0;
                      const statuses = stored
                        ? row.records.map((r) => r.status)
                        : row.seeded.map((s) => s.status);
                      const worst: ContractLegalCitationStatus | null = statuses.includes(
                        "needs_revision"
                      )
                        ? "needs_revision"
                        : statuses.includes("pending")
                          ? "pending"
                          : statuses.includes("reviewed")
                            ? "reviewed"
                            : null;
                      return (
                        <div key={row.clauseId} className="rounded-large border border-divider p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-labelMedium font-medium text-on-surface">
                                {row.clauseHeadingFa}
                              </p>
                              <p className="mt-0.5 font-mono text-caption text-muted" dir="ltr">
                                {row.clauseId}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {worst ? (
                                <Badge tone={STATUS_TONES[worst]} dot>
                                  {STATUS_FA[worst]}
                                </Badge>
                              ) : (
                                <Badge tone="danger">
                                  <IconWarning size={13} />
                                  بدون منبع — نیازمند بازبینی
                                </Badge>
                              )}
                              {stored && <Badge tone="brand">رکورد ذخیره‌شده</Badge>}
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  startIcon={<IconEdit size={15} />}
                                  onClick={() => openClauseEditor(row)}
                                >
                                  {stored ? "اصلاح" : "افزودن منبع"}
                                </Button>
                              )}
                            </div>
                          </div>

                          <ul className="mt-2 space-y-1.5">
                            {(stored
                              ? row.records.map((r) => ({
                                  articleFa: r.articleFa,
                                  sourceNameFa: r.sourceNameFa,
                                  noteFa: r.noteFa,
                                  status: r.status,
                                  contentVersion: r.contentVersion as number | null,
                                  reviewedAt: r.reviewedAt as string | null,
                                  reviewedByLabelFa: r.reviewedByLabelFa as string | null,
                                  id: r.id as string | null,
                                }))
                              : row.seeded.map((s) => ({
                                  articleFa: s.articleFa,
                                  sourceNameFa: s.sourceNameFa,
                                  noteFa: "",
                                  status: s.status,
                                  contentVersion: null as number | null,
                                  reviewedAt: null as string | null,
                                  reviewedByLabelFa: null as string | null,
                                  id: null as string | null,
                                }))
                            ).map((r, i) => (
                              <li
                                key={r.id ?? `${row.clauseId}-${i}`}
                                className="rounded-medium bg-surface-container-low p-2.5 text-caption leading-6"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-on-surface">{r.articleFa}</span>
                                  <span className="text-on-surface-variant">{r.sourceNameFa}</span>
                                  <Badge tone={STATUS_TONES[r.status]}>{STATUS_FA[r.status]}</Badge>
                                  {r.contentVersion !== null && (
                                    <span className="text-muted">
                                      نسخهٔ محتوا {toPersianNumber(r.contentVersion)}
                                    </span>
                                  )}
                                  {r.reviewedAt && (
                                    <span className="text-muted">{toPersianDate(r.reviewedAt)}</span>
                                  )}
                                  {r.reviewedByLabelFa && (
                                    <span className="text-muted">— {r.reviewedByLabelFa}</span>
                                  )}
                                  {r.id && canEdit && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      ariaLabel="حذف این استناد"
                                      startIcon={<IconDelete size={14} />}
                                      onClick={() =>
                                        setPendingDelete({
                                          kind: "clause",
                                          id: r.id!,
                                          label: `${row.clauseHeadingFa} — ${r.articleFa}`,
                                        })
                                      }
                                    >
                                      حذف
                                    </Button>
                                  )}
                                </div>
                                {r.noteFa && (
                                  <p className="mt-1 text-on-surface-variant">{r.noteFa}</p>
                                )}
                                {!stored && (
                                  <p className="mt-1 text-muted">
                                    منبع اولیه (ثبت‌شده در کد) — با اصلاح از سوی بازبین، رکورد
                                    نسخه‌دار جایگزین می‌شود.
                                  </p>
                                )}
                              </li>
                            ))}
                            {row.records.length === 0 && row.seeded.length === 0 && (
                              <li className="rounded-medium bg-warning-soft p-2.5 text-caption leading-6 text-on-surface-variant">
                                برای این بند هیچ استناد حقوقی بازبینی‌شده‌ای ثبت نشده است؛ در پیوست
                                به‌عنوان «نیازمند بررسی حقوقی» علامت می‌خورد و متن قطعی ارائه
                                نمی‌شود.
                              </li>
                            )}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            )}

            {current && (
              <Section
                title="نکات پیش از امضا"
                subtitle="اطلاع‌رسانی است، بخشی از متن تعهدآور قرارداد نیست و تأیید جداگانه‌ای لازم ندارد."
                actions={
                  canEdit ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setTipForm({
                          id: null,
                          titleFa: "",
                          bodyFa: "",
                          sourceNameFa: "",
                          order: (current.report.tips.at(-1)?.order ?? 0) + 1,
                          status: "pending",
                        })
                      }
                    >
                      افزودن نکته
                    </Button>
                  ) : undefined
                }
              >
                {tipForm && (
                  <div className="mb-4 rounded-large border border-primary/30 bg-primary-soft/40 p-4">
                    <div className="grid gap-3 tablet:grid-cols-2">
                      <Field label="عنوان نکته" required>
                        <TextInput
                          value={tipForm.titleFa}
                          onChange={(e) => setTipForm({ ...tipForm, titleFa: e.target.value })}
                        />
                      </Field>
                      <Field label="نام منبع" required>
                        <TextInput
                          value={tipForm.sourceNameFa}
                          onChange={(e) =>
                            setTipForm({ ...tipForm, sourceNameFa: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="ترتیب نمایش" required>
                        <TextInput
                          type="number"
                          min={1}
                          value={tipForm.order}
                          onChange={(e) =>
                            setTipForm({ ...tipForm, order: Number(e.target.value) || 1 })
                          }
                        />
                      </Field>
                      <Field label="وضعیت بازبینی" required>
                        <Select
                          value={tipForm.status}
                          onChange={(e) =>
                            setTipForm({
                              ...tipForm,
                              status: e.target.value as ContractLegalCitationStatus,
                            })
                          }
                        >
                          {(Object.keys(STATUS_FA) as ContractLegalCitationStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {STATUS_FA[s]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label="متن نکته" required hint="حداقل ۱۰ نویسه">
                        <TextArea
                          rows={3}
                          value={tipForm.bodyFa}
                          onChange={(e) => setTipForm({ ...tipForm, bodyFa: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="primary"
                        onClick={submitTip}
                        loading={saveTip.isPending}
                        disabled={saveTip.isPending}
                      >
                        ذخیرهٔ نسخهٔ جدید
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setTipForm(null)}
                        disabled={saveTip.isPending}
                      >
                        انصراف
                      </Button>
                    </div>
                  </div>
                )}

                {current.report.tips.length === 0 ? (
                  <EmptyBlock message="برای این نوع هنوز نکته‌ای ثبت نشده است." />
                ) : (
                  <ol className="space-y-2">
                    {current.report.tips.map((tip) => (
                      <li key={tip.id} className="rounded-large border border-divider p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-labelMedium font-medium text-on-surface">
                              {toPersianNumber(tip.order)}. {tip.titleFa}
                            </p>
                            <p className="mt-1 text-caption leading-6 text-on-surface-variant">
                              {tip.bodyFa}
                            </p>
                            <p className="mt-1 text-caption text-muted">
                              منبع: {tip.sourceNameFa} — نسخهٔ محتوا{" "}
                              {toPersianNumber(tip.contentVersion)}
                              {tip.reviewedAt ? ` — ${toPersianDate(tip.reviewedAt)}` : ""}
                              {tip.reviewedByLabelFa ? ` — ${tip.reviewedByLabelFa}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={STATUS_TONES[tip.status]} dot>
                              {STATUS_FA[tip.status]}
                            </Badge>
                            {canEdit && (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  startIcon={<IconEdit size={15} />}
                                  onClick={() =>
                                    setTipForm({
                                      id: tip.id,
                                      titleFa: tip.titleFa,
                                      bodyFa: tip.bodyFa,
                                      sourceNameFa: tip.sourceNameFa,
                                      order: tip.order,
                                      status: tip.status,
                                    })
                                  }
                                >
                                  اصلاح
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  startIcon={<IconDelete size={14} />}
                                  ariaLabel="حذف این نکته"
                                  onClick={() =>
                                    setPendingDelete({
                                      kind: "tip",
                                      id: tip.id,
                                      label: tip.titleFa,
                                    })
                                  }
                                >
                                  حذف
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            )}

            {!canEdit && (
              <p className="rounded-large bg-surface-container-low p-3 text-caption text-muted">
                <IconCheckCircle size={14} className="me-1 inline align-[-2px]" />
                دسترسی شما فقط خواندنی است؛ اصلاح مبنای حقوقی نیازمند مجوز «بررسی قراردادها» است.
              </p>
            )}
          </>
        )}
      </StateView>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="حذف رکورد حقوقی"
        description={
          pendingDelete
            ? `«${pendingDelete.label}» حذف می‌شود. اگر منبع اولیه‌ای وجود داشته باشد دوباره اعمال می‌شود؛ در غیر این صورت بند «نیازمند بازبینی» علامت می‌خورد. این عمل در تاریخچهٔ حسابرسی ثبت می‌شود.`
            : undefined
        }
        confirmLabel="حذف"
        destructive
        loading={removeItem.isPending}
      />
    </div>
  );
}
