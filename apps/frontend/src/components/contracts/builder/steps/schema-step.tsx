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
} from "../primitives";
import { getContractDefinition } from "@/lib/contracts/registry";
import type {
  ContractFieldDescriptor,
  GenericContractData,
  GenericFieldValue,
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

function FieldControl({
  descriptor,
  value,
  onChange,
}: {
  descriptor: ContractFieldDescriptor;
  value: GenericFieldValue | undefined;
  onChange: (next: GenericFieldValue) => void;
}) {
  switch (descriptor.kind) {
    case "textarea":
      return (
        <Field
          label={descriptor.labelFa}
          value={asString(value)}
          onChange={onChange}
          placeholder={descriptor.placeholderFa}
          helperText={descriptor.helperFa}
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
        />
      );
    case "money":
      return (
        <MoneyField
          label={descriptor.labelFa}
          value={asMoney(value)}
          onChange={(m) => onChange(m as unknown as GenericFieldValue)}
          helperText={descriptor.helperFa}
        />
      );
    case "date":
      return (
        <DateField
          label={descriptor.labelFa}
          value={asString(value) || null}
          onChange={(iso) => onChange(iso)}
          helperText={descriptor.helperFa}
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
        />
      );
  }
}

export function SchemaStep() {
  const { contract, data, patchData, stepId } = useWizard();
  const def = getContractDefinition(contract.type);

  const fields = def.fields.filter((f) => f.stepId === stepId);
  const values = (data as unknown as GenericContractData).values ?? {};

  const setValue = (key: string, next: GenericFieldValue) => {
    patchData({ values: { ...values, [key]: next } } as Partial<GenericContractData>);
  };

  if (fields.length === 0) {
    return (
      <Notice tone="info" title="این مرحله فیلد ورودی ندارد">
        اطلاعات این مرحله از مراحل دیگر یا مدارک بارگذاری‌شده به دست می‌آید.
      </Notice>
    );
  }

  return (
    <SectionCard
      title={def.wizardSteps.find((s) => s.id === stepId)?.titleFa ?? "اطلاعات قرارداد"}
      description="فیلدهای الزامی برای تکمیل این بخش مشخص شده‌اند"
    >
      <div className="space-y-4">
        {fields.map((f) => (
          <FieldControl
            key={f.key}
            descriptor={f}
            value={values[f.key]}
            onChange={(next) => setValue(f.key, next)}
          />
        ))}
      </div>
    </SectionCard>
  );
}
