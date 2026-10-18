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

import React, { useMemo, useRef, useState } from "react";
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
import { IconArrowForward, IconFile, IconUpload } from "@/lib/icons";
import {
  useDeleteContractDocument,
  useUploadContractDocument,
} from "@/hooks/usePropertyContracts";
import { contractDocumentUrl } from "@/lib/api/property-contracts";
import type {
  ContractDomainData,
  ContractSupplementary,
  ContractSupplementaryAttachment,
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

/** Per-action feedback for the confirmation buttons (§1). */
type ActionState = "idle" | "saving" | "saved" | "error";

export function SupplementaryStep() {
  const {
    contract,
    data,
    patchData,
    patchDataNow,
    saveStatus,
    lastSavedAt,
    saveNow,
    goToStep,
    editable,
  } = useWizard();
  const def = getContractDefinition(contract.type);
  const uploadAnnex = useUploadContractDocument();
  const deleteAnnex = useDeleteContractDocument();

  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [noteAction, setNoteAction] = useState<ActionState>("idle");
  const [annexAction, setAnnexAction] = useState<ActionState>("idle");
  const [stepAction, setStepAction] = useState<ActionState>("idle");
  const [annexTitle, setAnnexTitle] = useState("");
  const [annexError, setAnnexError] = useState<string | null>(null);
  const annexInputRef = useRef<HTMLInputElement>(null);

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
  const attachments = useMemo(
    () => supplementary.attachments ?? [],
    [supplementary.attachments]
  );
  const attachmentsConfirmedAt = supplementary.attachmentsConfirmedAt ?? null;
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
  // An ERROR always wins over a locally-present timestamp: the local data
  // is optimistic, and only a persisted timestamp may render as confirmed.
  const noteFeedback: ActionState =
    noteAction === "error"
      ? "error"
      : noteConfirmedAt
        ? "saved"
        : noteAction === "saved"
          ? "idle"
          : noteAction;

  const confirmNote = async () => {
    setBlockedMessage(null);
    setNoteAction("saving");
    // Persist FIRST, show «تأیید شد» only when the store accepted the
    // exact data. A confirmation badge over an unsaved timestamp would
    // disappear on reload and the user would have confirmed twice.
    const persisted = await patchDataNow({
      supplementary: {
        ...supplementary,
        notes,
        noteConfirmedAt: new Date().toISOString(),
        // A newly confirmed note supersedes the earlier step confirmation.
        confirmedAt: null,
      },
    } as Partial<ContractDomainData>);
    setNoteAction(persisted ? "saved" : "error");
  };

  const editNote = () => {
    setNoteAction("idle");
    patchData({
      supplementary: { ...supplementary, notes, noteConfirmedAt: null, confirmedAt: null },
    } as Partial<ContractDomainData>);
  };

  // --- Contract annexes (پیوست قرارداد) --------------------------------

  const annexDirty =
    attachments.length > 0 && attachmentsConfirmedAt === null;
  const annexFeedback: ActionState =
    annexAction === "error"
      ? "error"
      : attachmentsConfirmedAt
        ? "saved"
        : annexAction === "saved"
          ? "idle"
          : annexAction;

  async function onAnnexPicked(file: File) {
    setAnnexError(null);
    setAnnexAction("saving");
    try {
      // The API stores the bytes AND writes the printable annex entry, so
      // the file and the line that prints are created together.
      await uploadAnnex.mutateAsync({
        id: contract.id,
        file,
        category: "contract_annex",
        titleFa: annexTitle.trim(),
      });
      setAnnexTitle("");
      setAnnexAction("idle");
    } catch (e) {
      setAnnexAction("error");
      setAnnexError(e instanceof Error ? e.message : "بارگذاری پیوست ناموفق بود");
    }
  }

  function removeAnnex(attachment: ContractSupplementaryAttachment) {
    // Declared locally so this button reports its own failure instead of
    // silently leaving a printed annex behind.
    setAnnexError(null);
    setAnnexAction("saving");
    deleteAnnex.mutate(
      { id: contract.id, documentId: attachment.documentId },
      {
        onSuccess: () => setAnnexAction("idle"),
        onError: (e) => {
          setAnnexAction("error");
          setAnnexError(e instanceof Error ? e.message : "حذف پیوست ناموفق بود");
        },
      }
    );
  }

  const confirmAnnexes = async () => {
    setBlockedMessage(null);
    setAnnexAction("saving");
    const persisted = await patchDataNow({
      supplementary: {
        ...supplementary,
        attachments,
        attachmentsConfirmedAt: new Date().toISOString(),
        confirmedAt: null,
      },
    } as Partial<ContractDomainData>);
    setAnnexAction(persisted ? "saved" : "error");
  };

  // --- Step confirmation ------------------------------------------------

  const confirmToSignature = async () => {
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
    if (annexDirty) {
      setBlockedMessage(
        "پیوست‌های قرارداد ثبت شده‌اند اما هنوز تأیید نشده‌اند. ابتدا دکمهٔ «تأیید پیوست‌ها» را بزنید."
      );
      return;
    }
    setBlockedMessage(null);
    setStepAction("saving");
    // The step-level confirmation is also a persisted fact: the signature
    // stage reads it, so it must exist in the store before we navigate.
    const persisted = await patchDataNow({
      supplementary: {
        ...supplementary,
        notes,
        confirmedAt: new Date().toISOString(),
      },
    } as Partial<ContractDomainData>);
    if (!persisted) {
      setStepAction("error");
      setBlockedMessage("تأیید ذخیره نشد. اتصال را بررسی کنید و دوباره تلاش کنید.");
      return;
    }
    setStepAction("saved");
    // The confirmed supplementary step leads straight to the signature
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
            <p className="text-labelMedium text-on-surface-variant">
              پیوست‌های قرارداد (مادهٔ تعهدآور)
            </p>
            {attachments.length === 0 ? (
              <p className="mt-1 text-body-2 text-muted">پیوستی ثبت نشده است.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-body-2 text-on-surface">
                {attachments.map((a) => (
                  <li key={a.documentId} className="flex flex-wrap items-baseline gap-1">
                    <span className="font-medium">{a.titleFa}:</span>
                    <span className="text-muted">{a.fileName}</span>
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
        {noteConfirmedAt && noteAction !== "error" ? (
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              {noteFeedback === "error" && (
                <span role="alert" className="text-caption text-error">
                  تأیید ذخیره نشد. دوباره تلاش کنید.
                </span>
              )}
              <Button
                type="button"
                size="small"
                onClick={() => void confirmNote()}
                disabled={!noteWritten || noteAction === "saving" || noteFeedback === "saved"}
                loading={noteAction === "saving"}
                aria-live="polite"
              >
                {noteAction === "saving"
                  ? "در حال ذخیره…"
                  : noteFeedback === "saved"
                    ? "تأیید شد"
                    : noteAction === "error"
                      ? "تلاش مجدد برای تأیید"
                      : "تأیید یادداشت و ادامه"}
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* پیوست قرارداد — a file the user makes part of the agreement, kept
          strictly apart from the note above. */}
      <SectionCard
        title="پیوست قرارداد"
        description="فایلی که بخشی از قرارداد می‌شود (مثلاً فهرست تجهیزات یا توافق جداگانه). پیوست‌ها به‌صورت یک مادهٔ مستقل با نام و اثرانگشت فایل در سند چاپ می‌شوند."
      >
        <div className="space-y-3">
          <Notice tone="info" title="پیوست با یادداشت تکمیلی فرق دارد">
            آنچه باید بخشی از تعهدات قرارداد شود را به‌عنوان پیوست ثبت کنید؛ یادداشت تکمیلی فقط
            توضیحی دربارهٔ کل قرارداد است و مادهٔ قرارداد نمی‌شود.
          </Notice>

          <div className="grid gap-2 tablet:grid-cols-[1fr_auto]">
            <Field
              label="عنوان پیوست"
              value={annexTitle}
              onChange={setAnnexTitle}
              placeholder="مثلاً فهرست تجهیزات تحویلی"
              helperText="اگر خالی بماند، نام فایل به‌عنوان عنوان چاپ می‌شود."
              disabled={!editable}
            />
            <div className="flex items-end">
              <Button
                variant="outlined"
                size="small"
                type="button"
                startIcon={<IconUpload className="h-4 w-4" />}
                loading={annexAction === "saving" && uploadAnnex.isPending}
                disabled={!editable}
                onClick={() => annexInputRef.current?.click()}
              >
                افزودن پیوست
              </Button>
            </div>
          </div>

          <input
            ref={annexInputRef}
            type="file"
            className="hidden"
            accept="application/pdf,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onAnnexPicked(file);
            }}
          />

          {annexError && (
            <p role="alert" className="text-caption text-error">
              {annexError}
            </p>
          )}

          {attachments.length === 0 ? (
            <p className="text-body-2 text-muted">پیوستی ثبت نشده است.</p>
          ) : (
            <ul className="space-y-1.5">
              {attachments.map((a) => (
                <li
                  key={a.documentId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-medium border border-divider bg-surface-container-low px-2.5 py-2"
                >
                  <a
                    href={contractDocumentUrl(contract.id, a.documentId)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-2 hover:underline"
                  >
                    <IconFile className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block truncate text-body-2 text-on-surface">{a.titleFa}</span>
                      <span className="block truncate text-caption text-muted">
                        {a.fileName} — {formatIsoJalaliDateTime(a.addedAt)}
                      </span>
                    </span>
                  </a>
                  {editable && (
                    <Button
                      variant="text"
                      size="small"
                      type="button"
                      onClick={() => removeAnnex(a)}
                      disabled={annexAction === "saving"}
                    >
                      حذف
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {attachmentsConfirmedAt && annexAction !== "error" ? (
            <div className="rounded-medium border border-success bg-success-container px-3 py-2.5">
              <p className="text-body-2 font-medium">پیوست‌ها تأیید و ذخیره شد.</p>
              <p className="text-caption">
                زمان تأیید: {formatIsoJalaliDateTime(attachmentsConfirmedAt)}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {annexFeedback === "error" && (
                <span role="alert" className="text-caption text-error">
                  تأیید پیوست‌ها ذخیره نشد. دوباره تلاش کنید.
                </span>
              )}
              <Button
                type="button"
                size="small"
                onClick={() => void confirmAnnexes()}
                disabled={
                  attachments.length === 0 ||
                  annexAction === "saving" ||
                  uploadAnnex.isPending ||
                  deleteAnnex.isPending
                }
                loading={annexAction === "saving"}
                aria-live="polite"
              >
                {annexAction === "saving" ? "در حال ذخیره…" : "تأیید پیوست‌ها"}
              </Button>
            </div>
          )}
        </div>
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
          {/* Confirmed state — the whole card goes green and names the exact
              time, because that timestamp is what the signature stage and
              every later reader rely on. */}
          {confirmedAt && (
            <div className="rounded-medium border border-success bg-success-container px-3 py-2.5">
              <p className="text-body-2 font-medium">این مرحله تأیید شد.</p>
              <p className="text-caption">
                زمان تأیید: {formatIsoJalaliDateTime(confirmedAt)} — با ویرایش هر مورد، تأیید
                باطل می‌شود.
              </p>
            </div>
          )}

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
              پیوست قرارداد:{" "}
              <span className="font-medium">
                {attachments.length === 0
                  ? "ثبت نشده"
                  : attachmentsConfirmedAt
                    ? `${toPersianNumber(attachments.length)} مورد — تأیید شده`
                    : `${toPersianNumber(attachments.length)} مورد — در انتظار تأیید`}
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
            <div className="flex flex-wrap items-center gap-2">
              {confirmedAt && (
                <span className="rounded-small bg-success-container px-2 py-0.5 text-caption font-medium text-on-surface">
                  تأیید شد
                </span>
              )}
              <Button
                type="button"
                onClick={() => void confirmToSignature()}
                disabled={!editable || stepAction === "saving"}
                loading={stepAction === "saving"}
                endIcon={
                  stepAction === "saving" ? undefined : (
                    <IconArrowForward className="h-4 w-4" />
                  )
                }
              >
                {stepAction === "saving"
                  ? "در حال تأیید…"
                  : confirmedAt
                    ? "ادامه به مرحله امضا"
                    : stepAction === "error"
                      ? "تلاش مجدد برای تأیید"
                      : "تأیید و ادامه به امضا"}
              </Button>
            </div>
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
