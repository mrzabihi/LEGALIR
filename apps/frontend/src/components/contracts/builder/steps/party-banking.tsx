// ============================================================
// LEGALIR — Party bank details (payment section only)
// ============================================================
// Collected in the same step the payment terms live in, on the party
// record — never in the contract's domain values. That keeps the
// account data out of the public preview, the counterparty's signing
// link and the signed document body.
//
// The user types Persian digits freely; the server normalizes them to
// ASCII digits and validates the IBAN/card shape.
// ============================================================

"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@legalir/ui";
import { SectionCard, Field, FieldGrid, Notice } from "../primitives";
import { useWizard } from "../wizard-context";
import { useSaveParty } from "@/hooks/usePropertyContracts";
import { partyRoleLabelFa } from "@/lib/contracts/registry";
import { ApiClientError } from "@/lib/api/errors";
import { validateBanking } from "@legalir/validation";
import type { PartyBankingInfo, PartyRole } from "@legalir/types";

const EMPTY_BANKING: PartyBankingInfo = {
  bankName: "",
  accountNumber: "",
  iban: "",
  cardNumber: "",
};

export function PartyBankingEditor({ role }: { role: PartyRole }) {
  const { contract, parties } = useWizard();
  const saveParty = useSaveParty();
  const party = parties.find((p) => p.role === role);

  const [banking, setBanking] = useState<PartyBankingInfo>({
    ...EMPTY_BANKING,
    ...party?.banking,
  });
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof PartyBankingInfo>(key: K, value: PartyBankingInfo[K]) => {
    setBanking((prev) => ({ ...prev, [key]: value }));
    setServerErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([field]) => field !== key))
    );
    setSaved(false);
  };

  const issues = useMemo(() => validateBanking(banking), [banking]);
  const errorFor = (field: string): string | undefined => {
    if (serverErrors[field]) return serverErrors[field];
    if (!touched) return undefined;
    return issues.find((i) => i.field === field)?.messageFa;
  };

  async function handleSave() {
    setTouched(true);
    setServerErrors({});
    try {
      await saveParty.mutateAsync({
        id: contract.id,
        party: { id: party?.id, role, banking },
      });
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiClientError && error.fieldErrors) {
        setServerErrors(
          Object.fromEntries(error.fieldErrors.map((e) => [e.path, e.reason]))
        );
      } else {
        setServerErrors({ _form: "ذخیره اطلاعات بانکی ناموفق بود." });
      }
    }
  }

  const roleFa = partyRoleLabelFa(role);

  return (
    <SectionCard
      title={`حساب بانکی ${roleFa}`}
      description="فقط در بخش پرداخت نمایش داده می‌شود و در پیش‌نمایش عمومی یا پیوند امضای طرف مقابل درج نمی‌شود."
      aside={
        saved ? (
          <span className="text-caption text-success">ذخیره شد</span>
        ) : party?.banking ? (
          <span className="text-caption text-muted">ثبت‌شده</span>
        ) : (
          <span className="text-caption text-warning">تکمیل نشده</span>
        )
      }
    >
      {!party && (
        <Notice tone="warning" title="ابتدا اطلاعات طرفین را کامل کنید">
          اطلاعات هویتی {roleFa} در مرحلهٔ «طرفین قرارداد» ثبت می‌شود. پس از ثبت، حساب بانکی او را اینجا
          وارد کنید.
        </Notice>
      )}

      <FieldGrid>
        <Field
          label="نام بانک"
          value={banking.bankName}
          onChange={(v) => set("bankName", v)}
          errorText={errorFor("bankName")}
        />
        <Field
          label="شماره حساب"
          value={banking.accountNumber}
          onChange={(v) => set("accountNumber", v.replace(/[^\d۰-۹٠-٩]/g, "").slice(0, 24))}
          inputMode="numeric"
          errorText={errorFor("accountNumber")}
        />
        <Field
          label="شماره شبا"
          value={banking.iban}
          onChange={(v) =>
            set("iban", v.replace(/[^\d۰-۹٠-٩\sIRir]/g, "").slice(0, 30).toUpperCase())
          }
          inputMode="text"
          errorText={errorFor("iban")}
          helperText="با IR شروع می‌شود و ۲۴ رقم پس از آن دارد."
        />
        <Field
          label="شماره کارت (اختیاری)"
          value={banking.cardNumber}
          onChange={(v) => set("cardNumber", v.replace(/[^\d۰-۹٠-٩]/g, "").slice(0, 16))}
          inputMode="numeric"
          errorText={errorFor("cardNumber")}
        />
      </FieldGrid>

      {serverErrors["_form"] && <Notice tone="error">{serverErrors["_form"]}</Notice>}

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} loading={saveParty.isPending} disabled={!party}>
          ذخیره اطلاعات بانکی
        </Button>
      </div>
    </SectionCard>
  );
}
