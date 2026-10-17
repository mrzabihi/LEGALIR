// ============================================================
// LEGALIR — Wizard step: schema-driven fields
// ============================================================
// ONE component renders every non-property contract type. It reads
// the field descriptors declared by the contract's registry
// definition and renders the matching control for each — so adding a
// contract type never means writing a new step component.
//
// Values live in `GenericContractData.values` (a flat key → value
// map) and are written through the wizard's autosaving `patchData`,
// exactly like the bespoke property steps.
// ============================================================

"use client";

import React from "react";
import { useWizard } from "../wizard-context";
import {
  SectionCard,
  Field,
  NumberField,
  MoneyField,
  DateField,
  ChoiceField,
  ToggleRow,
  Notice,
  RepeatableRow,
  AddRowButton,
} from "../primitives";
import { fieldConditionHolds, getContractDefinition } from "@/lib/contracts/registry";
import { PartyBankingEditor } from "./party-banking";
import type {
  ContractFieldDescriptor,
  ContractRepeatColumn,
  GenericContractData,
  GenericFieldValue,
  GenericRepeatRow,
  Money,
} from "@legalir/types";

/** Read a generic value as a string. */
function asString(v: GenericFieldValue | undefined): string {
  return typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
}

/** Read a generic value as a number (or null). */
function asNumber(v: GenericFieldValue | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Read a generic value as a boolean. */
function asBool(v: GenericFieldValue | undefined): boolean {
  return v === true;
}

/** Read a generic value as a Money object (stored as `{amount,currency}`). */
function asMoney(v: GenericFieldValue | undefined): Money | null {
  if (v && typeof v === "object" && "amount" in v && "currency" in v) {
    return v as unknown as Money;
  }
  return null;
}

/**
 * Is this descriptor required under the branch the user actually chose?
 * The rule is the SAME one the completeness engine and the renderer use:
 * `(required || requiredWhen) && fieldConditionHolds(...)`.
 */
function isRequiredNow(
  descriptor: ContractFieldDescriptor,
  values: Record<string, unknown>
): boolean {
  if (!descriptor.required && !descriptor.requiredWhen) return false;
  return fieldConditionHolds(values, descriptor.requiredWhen);
}

/** Read a generic value as repeating rows. */
function asRows(v: GenericFieldValue | undefined): GenericRepeatRow[] {
  return Array.isArray(v) ? (v as GenericRepeatRow[]) : [];
}

/** True when every column of this row holds nothing. */
function isBlankRow(row: GenericRepeatRow, columns: ContractRepeatColumn[]): boolean {
  return columns.every((c) => {
    const cell = row[c.key];
    if (c.kind === "money") return !cell || typeof cell !== "object" || !("amount" in cell);
    return cell === null || cell === undefined || String(cell).trim() === "";
  });
}

/** True when the control would store nothing — mirrors `isFilled` upstream. */
function isBlank(descriptor: ContractFieldDescriptor, value: GenericFieldValue | undefined): boolean {
  switch (descriptor.kind) {
    case "toggle":
      // A toggle always holds a meaningful boolean; `false` is an answer.
      return false;
    case "number":
      return asNumber(value) === null;
    case "money":
      return asMoney(value) === null;
    case "date":
      return asString(value).trim() === "";
    case "repeatable": {
      // A draft saved before this field became a row editor still holds a
      // non-empty string; it is an answer and must not block progress.
      if (typeof value === "string") return value.trim() === "";
      // Blank scaffold rows are not an answer: a required schedule must
      // contain at least one row with real content.
      const columns = descriptor.columns ?? [];
      return !asRows(value).some((row) => !isBlankRow(row, columns));
    }
    default:
      return asString(value).trim() === "";
  }
}

/**
 * Add/edit/delete rows of repeating data (instalments, items, per-party
 * obligations). A blank scaffold row is filtered out at render time, so
 * the sheet never shows an empty row; the editor keeps it so the user
 * still has somewhere to type.
 */
function RepeatableControl({
  descriptor,
  value,
  onChange,
  required,
  errorText,
}: {
  descriptor: ContractFieldDescriptor;
  value: GenericFieldValue | undefined;
  onChange: (next: GenericFieldValue) => void;
  required: boolean;
  errorText?: string;
}) {
  const columns = descriptor.columns ?? [];
  const rows = asRows(value);
  // A draft saved before this field became a row editor still holds a
  // plain string. It keeps printing verbatim until the user adds a row,
  // so nothing they already wrote is lost — but they are told so.
  const legacyText = typeof value === "string" ? value.trim() : "";

  const commit = (next: GenericRepeatRow[]) => onChange(next as unknown as GenericFieldValue);

  const setCell = (index: number, key: string, cell: GenericRepeatRow[string]) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [key]: cell } : row));
    commit(next);
  };

  const addRow = () => {
    const blank: GenericRepeatRow = {};
    for (const c of columns) blank[c.key] = null;
    commit([...rows, blank]);
  };

  const removeRow = (index: number) => commit(rows.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-labelMedium text-on-surface">
          {descriptor.labelFa}
          {required && <span className="ms-1 text-error">*</span>}
        </span>
        <AddRowButton label={descriptor.addLabelFa ?? "افزودن ردیف"} onClick={addRow} />
      </div>
      {descriptor.helperFa && (
        <p className="text-caption text-muted">{descriptor.helperFa}</p>
      )}
      {legacyText && (
        <Notice tone="info" title="متن قبلی حفظ شده است">
          <p className="whitespace-pre-line">{legacyText}</p>
          <p className="mt-1 text-caption text-muted">
            این متن در نسخهٔ چاپی باقی می‌ماند؛ به‌محض افزودن اولین ردیف، جدول جای آن را
            می‌گیرد.
          </p>
        </Notice>
      )}
      {rows.length === 0 && (
        <p className="text-caption text-on-surface-variant">
          هنوز ردیفی ثبت نشده است. با «{descriptor.addLabelFa ?? "افزودن ردیف"}» شروع کنید.
        </p>
      )}
      {rows.map((row, index) => (
        <RepeatableRow key={index} index={index} onRemove={() => removeRow(index)}>
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2">
            {columns.map((c) => {
              const cell = row[c.key];
              if (c.kind === "money") {
                return (
                  <MoneyField
                    key={c.key}
                    label={c.labelFa}
                    value={asMoney(cell as GenericFieldValue)}
                    onChange={(m) => setCell(index, c.key, m)}
                  />
                );
              }
              if (c.kind === "date") {
                return (
                  <DateField
                    key={c.key}
                    label={c.labelFa}
                    value={typeof cell === "string" && cell ? cell : null}
                    onChange={(iso) => setCell(index, c.key, iso)}
                  />
                );
              }
              if (c.kind === "number") {
                return (
                  <NumberField
                    key={c.key}
                    label={c.labelFa}
                    value={typeof cell === "number" ? cell : null}
                    onChange={(n) => setCell(index, c.key, n)}
                    placeholder={c.placeholderFa}
                  />
                );
              }
              return (
                <Field
                  key={c.key}
                  label={c.labelFa}
                  value={typeof cell === "string" ? cell : ""}
                  onChange={(s) => setCell(index, c.key, s)}
                  placeholder={c.placeholderFa}
                />
              );
            })}
          </div>
        </RepeatableRow>
      ))}
      {errorText && <p className="text-caption text-error">{errorText}</p>}
    </div>
  );
}

function FieldControl({
  descriptor,
  value,
  onChange,
  required,
  errorText,
}: {
  descriptor: ContractFieldDescriptor;
  value: GenericFieldValue | undefined;
  onChange: (next: GenericFieldValue) => void;
  required: boolean;
  /** Non-null only while this field is blocking the step. */
  errorText?: string;
}) {
  switch (descriptor.kind) {
    case "repeatable":
      return (
        <RepeatableControl
          descriptor={descriptor}
          value={value}
          onChange={onChange}
          required={required}
          errorText={errorText}
        />
      );
    case "textarea":
      return (
        <Field
          label={descriptor.labelFa}
          value={asString(value)}
          onChange={onChange}
          placeholder={descriptor.placeholderFa}
          helperText={descriptor.helperFa}
          errorText={errorText}
          required={required}
        />
      );
    case "number":
      return (
        <NumberField
          label={descriptor.labelFa}
          value={asNumber(value)}
          onChange={onChange}
          placeholder={descriptor.placeholderFa}
          helperText={descriptor.helperFa}
          errorText={errorText}
          required={required}
        />
      );
    case "money":
      return (
        <MoneyField
          label={descriptor.labelFa}
          value={asMoney(value)}
          onChange={(m) => onChange(m as unknown as GenericFieldValue)}
          helperText={descriptor.helperFa}
          errorText={errorText}
          required={required}
        />
      );
    case "date":
      return (
        <DateField
          label={descriptor.labelFa}
          value={asString(value) || null}
          onChange={(iso) => onChange(iso)}
          helperText={descriptor.helperFa}
          errorMessage={errorText}
          required={required}
        />
      );
    case "select":
      return (
        <ChoiceField
          label={descriptor.labelFa}
          value={asString(value)}
          onChange={onChange}
          options={(descriptor.options ?? []).map((o) => ({ value: o.value, label: o.labelFa }))}
          placeholder="انتخاب کنید"
          helperText={descriptor.helperFa}
          errorText={errorText}
          required={required}
        />
      );
    case "toggle":
      return (
        <ToggleRow
          label={descriptor.labelFa}
          description={descriptor.helperFa}
          checked={asBool(value)}
          onChange={onChange}
        />
      );
    case "text":
    default:
      return (
        <Field
          label={descriptor.labelFa}
          value={asString(value)}
          onChange={onChange}
          placeholder={descriptor.placeholderFa}
          helperText={descriptor.helperFa}
          errorText={errorText}
          required={required}
        />
      );
  }
}

export function SchemaStep() {
  const { contract, data, patchData, stepId, editable, advanceBlockedReason } = useWizard();
  const def = getContractDefinition(contract.type);

  const fields = def.fields.filter((f) => f.stepId === stepId);
  const values = (data as unknown as GenericContractData).values ?? {};
  const bankFor = def.wizardSteps.find((s) => s.id === stepId)?.bankingFor;

  // Inline errors appear only after the user tried to leave this step
  // incomplete — not on a freshly opened draft, where every empty field
  // is still just "not answered yet". They clear the moment the value
  // is filled, without waiting for the server round-trip, so the error
  // always sits beside the exact control that is blocking progress.
  const showErrors = editable && advanceBlockedReason !== null;

  const setValue = (key: string, next: GenericFieldValue) => {
    patchData({ values: { ...values, [key]: next } } as Partial<GenericContractData>);
  };

  if (fields.length === 0 && !bankFor) {
    return (
      <Notice tone="info" title="این مرحله فیلد ورودی ندارد">
        اطلاعات این مرحله از مراحل دیگر یا مدارک بارگذاری‌شده به دست می‌آید.
      </Notice>
    );
  }

  return (
    <div className="space-y-4">
      {fields.length > 0 && (
        <SectionCard
          title={def.wizardSteps.find((s) => s.id === stepId)?.titleFa ?? "اطلاعات قرارداد"}
          description="فیلدهای الزامی برای تکمیل این بخش مشخص شده‌اند"
        >
          <div className="space-y-4">
            {fields.map((f) => {
              const required = isRequiredNow(f, values);
              const blocking = showErrors && required && isBlank(f, values[f.key]);
              return (
                <FieldControl
                  key={f.key}
                  descriptor={f}
                  value={values[f.key]}
                  onChange={(next) => setValue(f.key, next)}
                  required={required}
                  errorText={blocking ? "تکمیل این فیلد الزامی است." : undefined}
                />
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Payment-recipient bank details live on the party record, never in
          the contract values, so they stay out of the public document. */}
      {bankFor && <PartyBankingEditor role={bankFor} />}
    </div>
  );
}
