// ============================================================
// LEGALIR — Wizard step: parties
// ============================================================
// Collects each party's identity ONCE, against the branch the user
// actually chose:
//
//   natural + iranian → name + national id + mobile
//   natural + foreign → name + nationality + passport + birth data
//   legal             → registered name + registration id + address
//
// The kind/nationality choice comes first, and switching it starts a
// clean identity so data from the abandoned branch can never leak.
// A legal entity's authorized representative is a SEPARATE person row
// linked with `representativeOfPartyId`, never mixed into the entity.
//
// Every party gets a stable id from the server and is reused by the
// preview, signature links and PDF — this form never re-asks another
// step's data.
// ============================================================

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@legalir/ui";
import { useWizard } from "../wizard-context";
import { ChoiceField, Field, FieldGrid, SectionCard, Notice, DateField } from "../primitives";
import { useSaveParty } from "@/hooks/usePropertyContracts";
import { getContractDefinition, partyRoleLabelFa } from "@/lib/contracts/registry";
import {
  normalizeIranMobile,
  validatePartyIdentity,
  type PartyValidationIssue,
} from "@legalir/validation";
import { ApiClientError } from "@/lib/api/errors";
import type {
  ContractParty,
  PartyCapacity,
  PartyIdentity,
  PartyNationality,
  PartyPersonKind,
  PartyRole,
} from "@legalir/types";

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
  companyName: "",
  companyRegistrationNumber: "",
  companyNationalId: "",
  economicCode: "",
  nationalityCountryFa: "",
  passportNumber: "",
  passportExpiry: null,
  birthPlace: "",
  birthDateGregorian: null,
};

const CAPACITY_OPTIONS: { value: PartyCapacity; label: string }[] = [
  { value: "owner", label: "مالک" },
  { value: "attorney", label: "وکیل مالک" },
  { value: "legal_representative", label: "نماینده قانونی" },
];

const PERSON_KIND_OPTIONS: { value: PartyPersonKind; label: string }[] = [
  { value: "natural", label: "شخص حقیقی" },
  { value: "legal", label: "شخص حقوقی (شرکت / مؤسسه)" },
];

const NATIONALITY_OPTIONS: { value: PartyNationality; label: string }[] = [
  { value: "iranian", label: "ایرانی" },
  { value: "foreign", label: "غیرایرانی" },
];

/** Identity keys that belong to the natural-person branch. */
const NATURAL_KEYS: (keyof PartyIdentity)[] = [
  "firstName",
  "lastName",
  "fatherName",
  "birthCertificateNumber",
  "birthCertificatePlace",
  "birthDate",
];
/** Identity keys that belong to the Iranian branch. */
const IRANIAN_KEYS: (keyof PartyIdentity)[] = ["nationalId"];
/** Identity keys that belong to the foreign branch. */
const FOREIGN_KEYS: (keyof PartyIdentity)[] = [
  "nationalityCountryFa",
  "passportNumber",
  "passportExpiry",
  "birthPlace",
  "birthDateGregorian",
  "workPermitNumber",
  "workPermitExpiry",
];
/** Identity keys that belong to the legal-entity branch. */
const LEGAL_KEYS: (keyof PartyIdentity)[] = [
  "companyName",
  "companyRegistrationNumber",
  "companyNationalId",
  "economicCode",
];

/**
 * Drop the identity keys that do not belong to the chosen branch. The
 * contact mobile, address and postal code are shared by every branch
 * and are kept.
 */
function pruneIdentity(
  identity: PartyIdentity,
  personKind: PartyPersonKind,
  nationality: PartyNationality
): PartyIdentity {
  const next: PartyIdentity = { ...identity };
  const drop = (keys: (keyof PartyIdentity)[]) => {
    for (const key of keys) {
      (next as unknown as Record<string, unknown>)[key] =
        typeof EMPTY_IDENTITY[key] === "string" ? "" : null;
    }
  };
  if (personKind === "legal") {
    drop(NATURAL_KEYS);
    drop(IRANIAN_KEYS);
    drop(FOREIGN_KEYS);
  } else {
    drop(LEGAL_KEYS);
    drop(nationality === "iranian" ? FOREIGN_KEYS : IRANIAN_KEYS);
  }
  return next;
}

/** Codes that mean "not filled yet" rather than "filled incorrectly". */
function isRequiredIssue(issue: PartyValidationIssue): boolean {
  return issue.code === "REQUIRED" || issue.code.endsWith("_REQUIRED");
}

interface PartyFormProps {
  role: PartyRole;
  /** Set on a legal entity's representative form. */
  entity?: ContractParty;
}

function PartyForm({ role, entity }: PartyFormProps) {
  const { contract, parties } = useWizard();
  const saveParty = useSaveParty();

  const isRepresentative = role === "legal_representative";
  const existing = isRepresentative
    ? parties.find(
        (p) => p.role === "legal_representative" && p.representativeOfPartyId === entity?.id
      )
    : parties.find((p) => p.role === role);

  const [identity, setIdentity] = useState<PartyIdentity>({
    ...EMPTY_IDENTITY,
    ...existing?.identity,
  });
  const [personKind, setPersonKind] = useState<PartyPersonKind>(
    isRepresentative ? "natural" : existing?.personKind ?? "natural"
  );
  const [nationality, setNationality] = useState<PartyNationality>(
    existing?.nationality ?? "iranian"
  );
  const [capacity, setCapacity] = useState<PartyCapacity>(existing?.capacity ?? "owner");
  const [positionFa, setPositionFa] = useState(existing?.representativePositionFa ?? "");
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  // "There are edits the server has not seen yet." Flipped by every field
  // setter, cleared by a successful save. It is a ref (not state) because
  // only the autosave/unmount effects read it — re-rendering on it would
  // restart the debounce on every keystroke.
  const dirtyRef = useRef(false);

  const set = <K extends keyof PartyIdentity>(key: K, value: PartyIdentity[K]) => {
    setIdentity((prev) => ({ ...prev, [key]: value }));
    setServerErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([field]) => field !== key))
    );
    setSaved(false);
    dirtyRef.current = true;
  };

  function changePersonKind(next: PartyPersonKind) {
    if (next === personKind) return;
    // Branch data is not interchangeable — start the new branch clean
    // instead of carrying a national id onto a legal entity.
    setIdentity((prev) => pruneIdentity(prev, next, nationality));
    setPersonKind(next);
    setServerErrors({});
    setSaved(false);
    dirtyRef.current = true;
  }

  function changeNationality(next: PartyNationality) {
    if (next === nationality) return;
    setIdentity((prev) => pruneIdentity(prev, personKind, next));
    setNationality(next);
    setServerErrors({});
    setSaved(false);
    dirtyRef.current = true;
  }

  const issues = useMemo(
    () =>
      validatePartyIdentity({
        // The entity's representative is always a natural person.
        personKind: isRepresentative ? "natural" : personKind,
        nationality,
        identity,
      }),
    [isRepresentative, personKind, nationality, identity]
  );

  /** Show required-missing only after a save attempt; always show bad formats. */
  const errorFor = (field: string): string | undefined => {
    if (serverErrors[field]) return serverErrors[field];
    const issue = issues.find((i) => i.field === field);
    if (!issue) return undefined;
    if (isRequiredIssue(issue) && !touched) return undefined;
    return issue.messageFa;
  };

  const positionError =
    isRepresentative && touched && !positionFa.trim()
      ? "سمت نمایندهٔ قانونی الزامی است."
      : serverErrors["representativePositionFa"];

  // A save is always allowed: partial data is a legitimate draft state,
  // and nothing the user typed may be lost. The completeness scorer and
  // the step-advance guard decide when the party is truly complete.
  async function persist(markTouched: boolean) {
    if (markTouched) setTouched(true);
    setServerErrors({});
    try {
      await saveParty.mutateAsync({
        id: contract.id,
        party: {
          id: existing?.id,
          role,
          capacity: isRepresentative ? "legal_representative" : capacity,
          personKind: isRepresentative ? "natural" : personKind,
          nationality,
          identity,
          representativeOfPartyId: isRepresentative ? entity?.id ?? null : null,
          representativePositionFa: isRepresentative ? positionFa : "",
        },
      });
      dirtyRef.current = false;
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiClientError && error.fieldErrors) {
        setServerErrors(
          Object.fromEntries(error.fieldErrors.map((e) => [e.path, e.reason]))
        );
      } else {
        setServerErrors({ _form: "ذخیره اطلاعات ناموفق بود. دوباره تلاش کنید." });
      }
    }
  }

  async function handleSave() {
    await persist(true);
  }

  const persistRef = useRef(persist);
  persistRef.current = persist;

  // Draft autosave. Party rows live in their own table, so the wizard's
  // domain-data autosave never sees them: before this, typing a party and
  // pressing «مرحله بعد» dropped everything — the step-advance guard reads
  // the SERVER party (still empty) and blocks, then the form unmounts and
  // its local state is gone.
  //
  // The debounce waits out an INVALID_MOBILE: the route rejects a
  // half-typed number outright, so saving mid-entry would flash a server
  // error under a field the user is still filling in. A missing mobile is
  // not blocked — a draft may legitimately stop before it.
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (issues.some((i) => i.code === "INVALID_MOBILE")) return;
    const timer = setTimeout(() => {
      if (dirtyRef.current) void persistRef.current(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [identity, personKind, nationality, capacity, positionFa, issues]);

  // Leaving the step or the page must not drop typed data.
  useEffect(() => {
    return () => {
      if (dirtyRef.current) void persistRef.current(false);
    };
  }, []);

  const title = isRepresentative
    ? `نمایندهٔ قانونی ${identity.companyName || entity?.identity.companyName || "شخص حقوقی"}`
    : partyRoleLabelFa(role);

  const form = (
    <SectionCard
      title={title}
      description={
        isRepresentative
          ? "شخصی که از طرف شرکت/مؤسسه این قرارداد را امضا می‌کند"
          : "مشخصات هویتی این طرف قرارداد — فقط یک‌بار ثبت می‌شود"
      }
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
      {!isRepresentative && (
        <FieldGrid>
          <ChoiceField
            label="نوع شخص"
            value={personKind}
            onChange={changePersonKind}
            options={PERSON_KIND_OPTIONS}
          />
          {personKind === "natural" && (
            <ChoiceField
              label="تابعیت"
              value={nationality}
              onChange={changeNationality}
              options={NATIONALITY_OPTIONS}
            />
          )}
        </FieldGrid>
      )}

      {personKind === "legal" ? (
        <FieldGrid>
          <Field
            label="نام رسمی شرکت / مؤسسه"
            value={identity.companyName ?? ""}
            onChange={(v) => set("companyName", v)}
            errorText={errorFor("companyName")}
          />
          <Field
            label="شمارهٔ ثبت"
            value={identity.companyRegistrationNumber ?? ""}
            onChange={(v) => set("companyRegistrationNumber", v)}
            errorText={errorFor("companyRegistrationNumber")}
          />
          <Field
            label="شناسهٔ ملی شرکت"
            value={identity.companyNationalId ?? ""}
            onChange={(v) => set("companyNationalId", v.replace(/\D/g, "").slice(0, 11))}
            inputMode="numeric"
          />
          <Field
            label="کد اقتصادی"
            value={identity.economicCode ?? ""}
            onChange={(v) => set("economicCode", v.replace(/\D/g, "").slice(0, 14))}
            inputMode="numeric"
          />
        </FieldGrid>
      ) : (
        <>
          <FieldGrid>
            <Field
              label="نام"
              value={identity.firstName}
              onChange={(v) => set("firstName", v)}
              errorText={errorFor("firstName")}
            />
            <Field
              label="نام خانوادگی"
              value={identity.lastName}
              onChange={(v) => set("lastName", v)}
              errorText={errorFor("lastName")}
            />
            <Field
              label="نام پدر"
              value={identity.fatherName}
              onChange={(v) => set("fatherName", v)}
            />
            {nationality === "iranian" ? (
              <Field
                label="کد ملی"
                value={identity.nationalId}
                onChange={(v) => set("nationalId", v.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                errorText={errorFor("nationalId")}
              />
            ) : (
              <Field
                label="کشور تابعیت"
                value={identity.nationalityCountryFa ?? ""}
                onChange={(v) => set("nationalityCountryFa", v)}
                errorText={errorFor("nationalityCountryFa")}
              />
            )}
          </FieldGrid>

          {nationality === "iranian" ? (
            <FieldGrid>
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
            </FieldGrid>
          ) : (
            <FieldGrid>
              <Field
                label="شمارهٔ گذرنامه"
                value={identity.passportNumber ?? ""}
                onChange={(v) => set("passportNumber", v)}
                errorText={errorFor("passportNumber")}
              />
              {/* Foreign dates are entered and stored in the Gregorian
                  calendar, as required for passport/legal records. */}
              <Field
                label="تاریخ اعتبار گذرنامه (میلادی)"
                type="date"
                value={identity.passportExpiry ?? ""}
                onChange={(v) => set("passportExpiry", v || null)}
                errorText={errorFor("passportExpiry")}
              />
              <Field
                label="محل تولد"
                value={identity.birthPlace ?? ""}
                onChange={(v) => set("birthPlace", v)}
                errorText={errorFor("birthPlace")}
              />
              <Field
                label="تاریخ تولد (میلادی)"
                type="date"
                value={identity.birthDateGregorian ?? ""}
                onChange={(v) => set("birthDateGregorian", v || null)}
                errorText={errorFor("birthDateGregorian")}
              />
            </FieldGrid>
          )}

          {nationality === "iranian" && (
            <DateField
              label="تاریخ تولد"
              value={identity.birthDate}
              onChange={(iso) => set("birthDate", iso)}
              minYear={1300}
              maxYear={1405}
              defaultYear={1365}
            />
          )}
        </>
      )}

      <Field
        label={personKind === "legal" ? "نشانی شرکت" : "نشانی محل سکونت"}
        value={identity.address}
        onChange={(v) => set("address", v)}
        errorText={errorFor("address")}
      />

      <FieldGrid>
        <Field
          label={personKind === "legal" ? "موبایل تماس شرکت" : "شماره موبایل"}
          value={identity.mobile}
          onChange={(v) => set("mobile", v.replace(/[^\d۰-۹٠-٩\s+()-]/g, "").slice(0, 20))}
          inputMode="tel"
          errorText={errorFor("mobile")}
          helperText={
            normalizeIranMobile(identity.mobile)
              ? undefined
              : "پیوند امضا به همین شماره ارسال می‌شود."
          }
        />
        <Field
          label="کد پستی"
          value={identity.postalCode}
          onChange={(v) => set("postalCode", v.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
        />
      </FieldGrid>

      {isRepresentative && (
        <Field
          label="سمت در شرکت"
          value={positionFa}
          onChange={(v) => {
            setPositionFa(v);
            setSaved(false);
            dirtyRef.current = true;
          }}
          errorText={positionError}
          helperText="مانند: مدیرعامل، عضو هیئت‌مدیره با حق امضا"
        />
      )}

      {!isRepresentative && personKind === "natural" && (
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
                  dirtyRef.current = true;
                }}
                aria-pressed={capacity === opt.value}
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
      )}

      {serverErrors["_form"] && <Notice tone="error">{serverErrors["_form"]}</Notice>}

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} loading={saveParty.isPending}>
          ذخیره {isRepresentative ? "نمایندهٔ قانونی" : partyRoleLabelFa(role)}
        </Button>
      </div>
    </SectionCard>
  );

  // A legal entity's representative is a separate person card, rendered
  // right after the entity so the rep↔entity relationship is visible.
  return (
    <>
      {form}
      {!isRepresentative && existing?.personKind === "legal" && (
        <PartyForm role="legal_representative" entity={existing} />
      )}
    </>
  );
}

export function PartiesStep() {
  const { contract } = useWizard();
  const def = getContractDefinition(contract.type);

  return (
    <div className="space-y-4">
      <Notice tone="info" title="اطلاعات هویتی فقط یک‌بار پرسیده می‌شود">
        نوع شخص و تابعیت را انتخاب کنید تا فقط فیلدهای همان مسیر نمایش داده شود. همین اطلاعات در پیش‌نمایش،
        متن قرارداد، پیوند امضا و PDF به همان شخص متصل می‌شود و در مراحل بعد دوباره پرسیده نمی‌شود.
      </Notice>

      {def.roles.map((role) => (
        <PartyForm key={role} role={role} />
      ))}
    </div>
  );
}
