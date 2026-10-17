// ============================================================
// LEGALIR — Wizard step: supplementary terms, change requests, notes
// ============================================================
// The step before «بازبینی و پیش‌نمایش». It captures two DIFFERENT
// things, and keeps them apart on purpose:
//
//   • توافقات خاص — extra terms the parties genuinely agree to. They
//     print as their own clause at the end of the document.
//   • درخواست تغییر / یادداشت — proposals and comments about the draft.
//     They never overwrite an operative clause or identity data; the
//     document prints them only in a clearly labelled non-operative
//     annex, and the review step lists them before anything is frozen.
//
// Every row can name the section it relates to, so a reader knows which
// part of the contract a note is about. Rows live in
// `data.customClauses` and are saved by the wizard's normal autosave —
// nothing here writes directly into another step's fields.
// ============================================================

"use client";

import React, { useMemo } from "react";
import { Textarea } from "@legalir/ui";
import { useWizard } from "../wizard-context";
import {
  SectionCard,
  Field,
  ChoiceField,
  RepeatableRow,
  AddRowButton,
  Notice,
} from "../primitives";
import { getContractDefinition } from "@/lib/contracts/registry";
import type { ContractDomainData, CustomClause, CustomClauseKind } from "@legalir/types";

/** A stable, unique id for a new row. */
function newClauseId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** True when the entry carries nothing worth printing. */
function isBlankClause(clause: CustomClause): boolean {
  return clause.title.trim() === "" && clause.body.trim() === "";
}

export function SupplementaryStep() {
  const { contract, data, patchData } = useWizard();
  const def = getContractDefinition(contract.type);

  const clauses = useMemo(
    () => ((data as { customClauses?: CustomClause[] }).customClauses ?? []) as CustomClause[],
    [data]
  );

  const notes = useMemo(
    () => ((data as { supplementary?: { notes?: string } }).supplementary?.notes ?? "") as string,
    [data]
  );

  // «کل قرارداد» is the empty value; every other option names the step
  // the entry is about. The review and supplementary steps are excluded —
  // a note about the note has no place in the document.
  const sectionOptions = useMemo(
    () => [
      { value: "", label: "کل قرارداد" },
      ...def.wizardSteps
        .filter((s) => s.id !== "review" && s.id !== "supplementary")
        .map((s) => ({ value: s.id, label: s.titleFa })),
    ],
    [def.wizardSteps]
  );

  const commit = (next: CustomClause[]) => {
    patchData({ customClauses: next } as Partial<ContractDomainData>);
  };

  const patchRow = (id: string, patch: Partial<CustomClause>) => {
    commit(clauses.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeRow = (id: string) => {
    commit(clauses.filter((c) => c.id !== id));
  };

  const addRow = (kind: CustomClauseKind) => {
    commit([
      ...clauses,
      {
        id: newClauseId(),
        kind,
        title: "",
        body: "",
        sectionRef: "",
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const rowsOf = (kind: CustomClauseKind) =>
    clauses.filter((c) => (c.kind ?? "agreement") === kind);

  const renderRow = (clause: CustomClause, index: number) => {
    const titleMissing = clause.title.trim() === "";
    const bodyMissing = clause.body.trim() === "";
    // Inline validation only where it means something: a titled row with
    // no text would otherwise disappear from the document silently.
    const bodyError =
      !titleMissing && bodyMissing
        ? "متن این مورد را بنویسید تا در قرارداد لحاظ شود."
        : undefined;

    return (
      <RepeatableRow key={clause.id} index={index} onRemove={() => removeRow(clause.id)}>
        <Field
          label="عنوان"
          value={clause.title}
          onChange={(v) => patchRow(clause.id, { title: v })}
          placeholder={
            clause.kind === "change_request"
              ? "مثلاً اصلاح مبلغ پیش‌پرداخت"
              : "مثلاً تحویل کلید در تاریخ توافقی"
          }
        />
        <ChoiceField
          label="بخش مرتبط"
          value={clause.sectionRef ?? ""}
          onChange={(v) => patchRow(clause.id, { sectionRef: v })}
          options={sectionOptions}
        />
        <Textarea
          fullWidth
          label="متن"
          rows={3}
          value={clause.body}
          onChange={(e) => patchRow(clause.id, { body: e.target.value })}
          placeholder="متن دقیق موردی که می‌خواهید اضافه یا پیشنهاد کنید…"
          errorMessage={bodyError}
        />
        {titleMissing && !bodyMissing && (
          <p className="text-caption text-warning">
            برای چاپ در قرارداد، عنوان این مورد را هم بنویسید.
          </p>
        )}
      </RepeatableRow>
    );
  };

  const agreements = rowsOf("agreement");
  const changeRequests = rowsOf("change_request");

  return (
    <div className="space-y-4">
      <Notice tone="info" title="این مرحله اختیاری است">
        اگر توافق یا شرط اضافه‌ای دارید، آن را اینجا ثبت کنید. آنچه اینجا می‌نویسید جای بندهای
        اصلی یا اطلاعات هویتی را نمی‌گیرد؛ فقط به‌صورت مادهٔ مستقل یا یادداشت جداگانه در پایان
        سند نمایش داده می‌شود.
      </Notice>

      <SectionCard
        title="یادداشت تکمیلی"
        description="توضیح یا نکته‌ای دربارهٔ کل قرارداد — در پایان سند و جدا از مواد چاپ می‌شود"
      >
        <Textarea
          fullWidth
          label="یادداشت"
          rows={3}
          value={notes}
          onChange={(e) =>
            patchData({
              supplementary: { notes: e.target.value },
            } as Partial<ContractDomainData>)
          }
          placeholder="هر توضیح یا نکته‌ای که باید کنار قرارداد ثبت شود…"
          supportingText="این متن در متن تعهدآور قرارداد ادغام نمی‌شود."
        />
      </SectionCard>

      <SectionCard
        title="توافقات خاص طرفین"
        description="شرط‌های اضافی مورد توافق؛ در پایان قرارداد به‌صورت یک مادهٔ مستقل چاپ می‌شوند"
        aside={<AddRowButton label="افزودن توافق" onClick={() => addRow("agreement")} />}
      >
        {agreements.length === 0 ? (
          <p className="text-body-2 text-muted">
            توافق خاصی ثبت نشده است. قرارداد با بندهای استاندارد همین نوع قرارداد تنظیم می‌شود.
          </p>
        ) : (
          <div className="space-y-3">{agreements.map(renderRow)}</div>
        )}
      </SectionCard>

      <SectionCard
        title="درخواست تغییر و یادداشت"
        description="پیشنهاد اصلاح یا نکته‌ای دربارهٔ بندهای قرارداد؛ غیرالزام‌آور و جدا از متن رسمی"
        aside={<AddRowButton label="افزودن یادداشت" onClick={() => addRow("change_request")} />}
      >
        <Notice tone="warning" title="این موارد متن قرارداد را تغییر نمی‌دهند">
          درخواست تغییر فقط برای بازبینی ثبت می‌شود. برای اعمال آن، باید بند اصلی در مرحلهٔ مربوط
          به همان بخش ویرایش شود یا طرفین کتباً آن را بپذیرند. در نسخهٔ چاپی، این موارد با عنوان
          «غیرالزام‌آور» و جدا از مواد قرارداد نمایش داده می‌شوند.
        </Notice>

        {changeRequests.length === 0 ? (
          <p className="text-body-2 text-muted">درخواست تغییر یا یادداشتی ثبت نشده است.</p>
        ) : (
          <div className="space-y-3">{changeRequests.map(renderRow)}</div>
        )}
      </SectionCard>

      <p className="text-caption text-muted">
        {clauses.filter((c) => !isBlankClause(c)).length > 0
          ? `${clauses.filter((c) => !isBlankClause(c)).length} مورد ثبت شده است و در پیش‌نمایش قرارداد دیده می‌شود.`
          : "ردیف‌های خالی در قرارداد چاپ نمی‌شوند."}
      </p>
    </div>
  );
}
