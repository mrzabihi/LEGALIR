// ============================================================
// LEGALIR — Wizard step: parties
// ============================================================
// Collects the identity of every role the contract type declares
// (موجر/مستأجر or فروشنده/خریدار). Each role is saved independently
// through `PUT /parties`, so a partially-filled counterparty never
// blocks the initiator's own data.
// ============================================================

"use client";

import React, { useState } from "react";
import { Button } from "@legalir/ui";
import { useWizard } from "../wizard-context";
import { Field, FieldGrid, SectionCard, Notice, DateField } from "../primitives";
import { useSaveParty } from "@/hooks/usePropertyContracts";
import { getContractDefinition, partyRoleLabelFa } from "@/lib/contracts/registry";
import type { PartyCapacity, PartyIdentity, PartyRole } from "@legalir/types";

const EMPTY_IDENTITY: PartyIdentity = {
  firstName: "",
  lastName: "",
  fatherName: "",
  nationalId: "",
  birthCertificateNumber: "",
  birthCertificatePlace: "",
  birthDate: null,
  mobile: "",
  address: "",
  postalCode: "",
};

const CAPACITY_OPTIONS: { value: PartyCapacity; label: string }[] = [
  { value: "owner", label: "مالک" },
  { value: "attorney", label: "وکیل مالک" },
  { value: "legal_representative", label: "نماینده قانونی" },
];

function PartyForm({ role }: { role: PartyRole }) {
  const { contract, parties } = useWizard();
  const saveParty = useSaveParty();
  const existing = parties.find((p) => p.role === role);

  const [identity, setIdentity] = useState<PartyIdentity>(existing?.identity ?? EMPTY_IDENTITY);
  const [capacity, setCapacity] = useState<PartyCapacity>(existing?.capacity ?? "owner");
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof PartyIdentity>(key: K, value: PartyIdentity[K]) => {
    setIdentity((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const nationalIdError =
    identity.nationalId.length > 0 && !/^\d{10}$/.test(identity.nationalId)
      ? "کد ملی باید ۱۰ رقم باشد"
      : undefined;
  const mobileError =
    identity.mobile.length > 0 && !/^09\d{9}$/.test(identity.mobile)
      ? "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد"
      : undefined;

  const canSave =
    identity.firstName.trim().length > 0 &&
    identity.lastName.trim().length > 0 &&
    /^\d{10}$/.test(identity.nationalId) &&
    /^09\d{9}$/.test(identity.mobile);

  async function handleSave() {
    await saveParty.mutateAsync({
      id: contract.id,
      party: { role, capacity, identity },
    });
    setSaved(true);
  }

  return (
    <SectionCard
      title={partyRoleLabelFa(role)}
      description="مشخصات هویتی این طرف قرارداد"
      aside={
        saved ? (
          <span className="text-caption text-success">ذخیره شد</span>
        ) : existing ? (
          <span className="text-caption text-muted">ثبت‌شده</span>
        ) : (
          <span className="text-caption text-warning">تکمیل نشده</span>
        )
      }
    >
      <FieldGrid>
        <Field label="نام" value={identity.firstName} onChange={(v) => set("firstName", v)} />
        <Field label="نام خانوادگی" value={identity.lastName} onChange={(v) => set("lastName", v)} />
        <Field label="نام پدر" value={identity.fatherName} onChange={(v) => set("fatherName", v)} />
        <Field
          label="کد ملی"
          value={identity.nationalId}
          onChange={(v) => set("nationalId", v.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
          errorText={nationalIdError}
        />
        <Field
          label="شماره شناسنامه"
          value={identity.birthCertificateNumber}
          onChange={(v) => set("birthCertificateNumber", v)}
        />
        <Field
          label="محل صدور شناسنامه"
          value={identity.birthCertificatePlace}
          onChange={(v) => set("birthCertificatePlace", v)}
        />
        <Field
          label="شماره موبایل"
          value={identity.mobile}
          onChange={(v) => set("mobile", v.replace(/\D/g, "").slice(0, 11))}
          inputMode="tel"
          errorText={mobileError}
        />
        <Field
          label="کد پستی"
          value={identity.postalCode}
          onChange={(v) => set("postalCode", v.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
        />
      </FieldGrid>

      {/* Birth date is historical: the year list must reach back, and the
          picker rests on a plausible birth year rather than 1405. */}
      <DateField
        label="تاریخ تولد"
        value={identity.birthDate}
        onChange={(iso) => set("birthDate", iso)}
        minYear={1300}
        maxYear={1405}
        defaultYear={1365}
      />

      <Field
        label="نشانی محل سکونت"
        value={identity.address}
        onChange={(v) => set("address", v)}
      />

      <div className="space-y-1.5">
        <span className="block text-labelMedium text-on-surface-variant">سمت</span>
        <div className="flex flex-wrap gap-2">
          {CAPACITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setCapacity(opt.value);
                setSaved(false);
              }}
              className={`rounded-full px-3.5 py-1.5 text-labelLarge border transition-colors ${
                capacity === opt.value
                  ? "bg-primary text-primary-on border-primary"
                  : "bg-surface text-on-surface border-outline hover:bg-surface-container"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={!canSave} loading={saveParty.isPending}>
          ذخیره {partyRoleLabelFa(role)}
        </Button>
      </div>
    </SectionCard>
  );
}

export function PartiesStep() {
  const { contract } = useWizard();
  const def = getContractDefinition(contract.type);

  return (
    <div className="space-y-4">
      <Notice tone="info" title="چرا این اطلاعات لازم است؟">
        نام و کد ملی طرفین در متن قرارداد و در امضای پایانی درج می‌شود. اطلاعات هویتی هر طرف فقط برای همان طرف
        ذخیره می‌شود و تا تکمیل نشدن، مانع ادامه کار شما نیست.
      </Notice>

      {def.roles.map((role) => (
        <PartyForm key={role} role={role} />
      ))}
    </div>
  );
}
