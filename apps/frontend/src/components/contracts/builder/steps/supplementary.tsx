// ============================================================
// LEGALIR — Wizard step: supplementary terms, change requests, notes
// ============================================================
// The step before «بازبینی و پیش‌نمایش». It captures three DIFFERENT
// things, and keeps them apart on purpose:
//
//   • یادداشت تکمیلی — one free-text note about the whole contract. It
//     prints at the very END of the document, under its own heading and
//     separate from the numbered clauses, and it only becomes part of
//     the document once the user explicitly confirms it.
//   • توافقات خاص — extra terms the parties genuinely agree to. They
//     print as their own operative clause.
//   • درخواست تغییر — proposals about the draft. They never overwrite an
//     operative clause or identity data; the document prints them only in
//     a clearly labelled non-operative annex.
//
// «مادهٔ بازبینی» shows, before anything is confirmed, exactly what this
// step will print — so the user is approving a visible text, not a
// promise. The step ends with one explicit «تأیید و ادامه به امضا» that
// saves and advances, and it refuses to advance while a row is
// half-filled or a written note has not been confirmed yet.
//
// Every row lives in `data.customClauses`, the note in
// `data.supplementary`; nothing here writes directly into another
// step's fields.
// ============================================================

"use client";

import React, { useMemo, useState } from "react";
import { Button, Textarea } from "@legalir/ui";
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
import { formatIsoJalaliDateTime } from "@/lib/contracts/dates";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconArrowForward } from "@/lib/icons";
import type {
  ContractDomainData,
  ContractSupplementary,
  CustomClause,
  CustomClauseKind,
} from "@legalir/types";

/**
 * The exact guidance the product promises for the note. Kept as one
 * constant so the UI and the tests can never drift from the copy the
 * user specified.
 */
export const SUPPLEMENTARY_NOTE_GUIDANCE =
  "توضیح یا نکته‌ای دربارهٔ کل قرارداد — این یادداشت در پایان سند و جدا از مواد قرارداد چاپ می‌شود.";

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

/** A row that is partly filled — it cannot print and must not advance. */
function isIncompleteClause(clause: CustomClause): boolean {
  return !isBlankClause(clause) && clause.body.trim() === "";
}

export function SupplementaryStep() {
  const { contract, data, patchData, saveStatus, lastSavedAt, saveNow, goToStep, editable } =
    useWizard();
  const def = getContractDefinition(contract.type);

  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const clauses = useMemo(
    () => ((data as { customClauses?: CustomClause[] }).customClauses ?? []) as CustomClause[],
    [data]
  );

  const supplementary = useMemo(
    () =>
      ((data as { supplementary?: ContractSupplementary }).supplementary ?? {
        notes: "",
      }) as ContractSupplementary,
    [data]
  );
  const notes = supplementary.notes ?? "";
  const noteConfirmedAt = supplementary.noteConfirmedAt ?? null;
  const confirmedAt = supplementary.confirmedAt ?? null;

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

  const sectionTitle = (key: string) =>
    key
      ? (def.wizardSteps.find((s) => s.id === key)?.titleFa ??
        def.sections.find((s) => s.key === key)?.labelFa ??
        key)
      : "کل قرارداد";

  /**
   * Any edit invalidates the earlier step-level confirmation — the
   * approved text must be the text that prints.
   */
  const commit = (next: CustomClause[]) => {
    setBlockedMessage(null);
    patchData({
      customClauses: next,
      ...(confirmedAt ? { supplementary: { ...supplementary, confirmedAt: null } } : {}),
    } as Partial<ContractDomainData>);
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
  const printableAgreements = agreements.filter((c) => !isBlankClause(c));
  const printableRequests = changeRequests.filter((c) => !isBlankClause(c));
  const incomplete = clauses.filter(isIncompleteClause);
  const noteWritten = notes.trim().length > 0;

  // --- Note confirmation ------------------------------------------------

  const noteDirty = noteWritten && noteConfirmedAt === null;
  const confirmNote = () => {
    setBlockedMessage(null);
    patchData({
      supplementary: {
        ...supplementary,
        notes,
        noteConfirmedAt: new Date().toISOString(),
        // A newly confirmed note supersedes the earlier step confirmation.
        confirmedAt: null,
      },
    } as Partial<ContractDomainData>);
  };

  const editNote = () => {
    patchData({
      supplementary: { ...supplementary, notes, noteConfirmedAt: null, confirmedAt: null },
    } as Partial<ContractDomainData>);
  };

  // --- Step confirmation ------------------------------------------------

  const confirmToSignature = () => {
    // Blocking guidance — the user sees exactly which field is short and
    // nothing is saved as "approved" while the text is incomplete.
    if (incomplete.length > 0) {
      setBlockedMessage(
        `پیش از ادامه، متن ${toPersianNumber(incomplete.length)} مورد نیمه‌کاره را کامل کنید.`
      );
      return;
    }
    if (noteDirty) {
      setBlockedMessage(
        "یادداشت تکمیلی نوشته شده اما هنوز تأیید نشده است. ابتدا دکمهٔ «تأیید یادداشت و ادامه» را بزنید."
      );
      return;
    }
    setBlockedMessage(null);
    patchData({
      supplementary: {
        ...supplementary,
        notes,
        confirmedAt: new Date().toISOString(),
      },
    } as Partial<ContractDomainData>);
    // Advancing schedules the autosave with the new step id, so the
    // confirmed state and the navigation are persisted together. The
    // confirmed supplementary step leads straight to the signature
    // stage — review stays reachable from there for the final preview.
    goToStep("signature");
  };

  const saveLine =
    saveStatus === "saving"
      ? "در حال ذخیره…"
      : saveStatus === "saved"
        ? lastSavedAt
          ? `ذخیره شد — ${formatIsoJalaliDateTime(lastSavedAt)}`
          : "ذخیره شد."
        : saveStatus === "error"
          ? "ذخیره نشد. اتصال را بررسی کنید و دوباره تلاش کنید."
          : "تغییری در انتظار ذخیره نیست.";

  return (
    <div className="space-y-4">
      <Notice tone="info" title="این مرحله اختیاری است">
        اگر توافق یا شرط اضافه‌ای دارید، آن را اینجا ثبت کنید. آنچه اینجا می‌نویسید جای بندهای
        اصلی یا اطلاعات هویتی را نمی‌گیرد؛ فقط به‌صورت مادهٔ مستقل یا یادداشت جداگانه در پایان
        سند نمایش داده می‌شود.
      </Notice>

      {/* مادهٔ بازبینی — the exact text this step contributes to the
          document, shown before the user confirms anything. */}
      <SectionCard
        title="مادهٔ بازبینی"
        description="این همان متن و توضیحاتی است که از این مرحله در سند چاپ می‌شود."
      >
        <div className="space-y-3">
          <div>
            <p className="text-labelMedium text-on-surface-variant">توافقات خاص (مادهٔ تعهدآور)</p>
            {printableAgreements.length === 0 ? (
              <p className="mt-1 text-body-2 text-muted">توافق خاصی برای چاپ وجود ندارد.</p>
            ) : (
              <ol className="mt-1 list-decimal space-y-1 ps-5 text-body-2 text-on-surface">
                {printableAgreements.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{c.title.trim() || "بدون عنوان"}:</span>{" "}
                    <span>{c.body.trim() || "—"}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div>
            <p className="text-labelMedium text-on-surface-variant">
              درخواست تغییر و یادداشت (غیرالزام‌آور)
            </p>
            {printableRequests.length === 0 ? (
              <p className="mt-1 text-body-2 text-muted">درخواستی برای بازبینی ثبت نشده است.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-body-2 text-on-surface">
                {printableRequests.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline gap-1">
                    <span className="rounded-small bg-surface-container px-1.5 text-caption text-muted">
                      {sectionTitle(c.sectionRef ?? "")}
                    </span>
                    <span className="font-medium">{c.title.trim() || "بدون عنوان"}:</span>
                    <span>{c.body.trim() || "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-labelMedium text-on-surface-variant">یادداشت تکمیلی</p>
            {noteWritten ? (
              <p className="mt-1 whitespace-pre-wrap text-body-2 text-on-surface">{notes}</p>
            ) : (
              <p className="mt-1 text-body-2 text-muted">یادداشتی نوشته نشده است.</p>
            )}
          </div>
        </div>
      </SectionCard>

      {/* یادداشت تکمیلی — its own confirm button, saved on confirm. */}
      <SectionCard title="یادداشت تکمیلی" description={SUPPLEMENTARY_NOTE_GUIDANCE}>
        {noteConfirmedAt ? (
          <div className="space-y-2">
            <div className="rounded-medium border border-success bg-success-container px-3 py-2.5">
              <p className="text-body-2 font-medium">یادداشت تأیید و ذخیره شد.</p>
              <p className="text-caption">زمان تأیید: {formatIsoJalaliDateTime(noteConfirmedAt)}</p>
            </div>
            <p className="whitespace-pre-wrap text-body-2 text-on-surface">{notes}</p>
            <Button variant="text" size="small" type="button" onClick={editNote}>
              ویرایش یادداشت
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              fullWidth
              label="یادداشت"
              rows={3}
              value={notes}
              onChange={(e) =>
                patchData({
                  supplementary: {
                    ...supplementary,
                    notes: e.target.value,
                    noteConfirmedAt: null,
                    confirmedAt: null,
                  },
                } as Partial<ContractDomainData>)
              }
              placeholder="هر توضیح یا نکته‌ای که باید کنار قرارداد ثبت شود…"
              supportingText="این متن در متن تعهدآور قرارداد ادغام نمی‌شود."
            />
            <div className="flex justify-end">
              <Button type="button" size="small" onClick={confirmNote} disabled={!noteWritten}>
                تأیید یادداشت و ادامه
              </Button>
            </div>
          </div>
        )}
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

      {/* جمع‌بندی و تأیید — what will be printed, the live save state, and
          the one action that advances to the signature flow. */}
      <SectionCard
        title="جمع‌بندی و تأیید"
        description="پیش از ادامه، خلاصهٔ آنچه در سند چاپ می‌شود را بررسی کنید."
      >
        <div className="space-y-3">
          <ul className="space-y-1 text-body-2 text-on-surface">
            <li>
              توافقات خاص:{" "}
              <span className="font-medium">
                {printableAgreements.length > 0
                  ? `${toPersianNumber(printableAgreements.length)} مورد`
                  : "ثبت نشده"}
              </span>
            </li>
            <li>
              درخواست تغییر:{" "}
              <span className="font-medium">
                {printableRequests.length > 0
                  ? `${toPersianNumber(printableRequests.length)} مورد`
                  : "ثبت نشده"}
              </span>
            </li>
            <li>
              یادداشت تکمیلی:{" "}
              <span className="font-medium">
                {!noteWritten ? "نوشته نشده" : noteConfirmedAt ? "تأیید شده" : "در انتظار تأیید"}
              </span>
            </li>
          </ul>

          <div
            className={`flex flex-wrap items-center gap-x-2 text-caption ${
              saveStatus === "error" ? "text-error" : "text-muted"
            }`}
            role={saveStatus === "error" ? "alert" : undefined}
          >
            <span>{saveLine}</span>
            {saveStatus === "error" && (
              <Button
                type="button"
                variant="text"
                size="small"
                onClick={() => void saveNow()}
                className="!h-auto !px-1 text-caption max-desktop:!min-h-0"
              >
                تلاش مجدد
              </Button>
            )}
          </div>

          {blockedMessage && (
            <div
              role="alert"
              className="rounded-medium border border-error bg-error-container px-3 py-2.5 text-body-2"
            >
              {blockedMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-caption text-muted">
              {confirmedAt
                ? `این مرحله در ${formatIsoJalaliDateTime(confirmedAt)} تأیید شده است.`
                : "با تأیید، خلاصهٔ بالا ذخیره و مرحلهٔ امضا باز می‌شود."}
            </p>
            <Button
              type="button"
              onClick={confirmToSignature}
              disabled={!editable}
              endIcon={<IconArrowForward className="h-4 w-4" />}
            >
              تأیید و ادامه به امضا
            </Button>
          </div>
        </div>
      </SectionCard>

      <p className="text-caption text-muted">
        {clauses.filter((c) => !isBlankClause(c)).length > 0
          ? `${clauses.filter((c) => !isBlankClause(c)).length} مورد ثبت شده است و در پیش‌نمایش قرارداد دیده می‌شود.`
          : "ردیف‌های خالی در قرارداد چاپ نمی‌شوند."}
      </p>
    </div>
  );
}
