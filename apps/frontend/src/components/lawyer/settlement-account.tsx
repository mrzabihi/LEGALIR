// ============================================================
// LEGALIR — Settlement account (حساب تسویه) · shared surface
// ============================================================
// §7's secure section: holder name, bank, IBAN, account number and the card
// used to settle fees. It lives in ONE component so the same fields are
// editable from wherever the lawyer happens to be — the dedicated
// /lawyer/bank page, the professional profile, and /lawyer/settings — with no
// second copy of the validation, the copy or the mutation.
//
//   · The full IBAN comes back ONLY to the owning lawyer — the route resolves
//     the lawyer from the session, and every other surface (admin list, audit,
//     events) reads a masked form.
//   · The card is entered in full, Luhn-checked and then discarded: the record
//     keeps the BIN + last four only, so this table never becomes a PAN store.
//   · Saving a change returns the record to PENDING_REVIEW and appends an
//     immutable event; an authorised operator then verifies it or returns it
//     for correction with a recorded reason.
//   · A NEEDS_CORRECTION status shows the reviewer's reason before the form so
//     the lawyer knows exactly what to fix.
// ============================================================

"use client";

import { useState } from "react";
import { useLawyerBank, useSubmitLawyerBank } from "@/hooks/useLawyerPortal";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorBlock,
  Field,
  InlineNotice,
  LoadingBlock,
  TextInput,
} from "@/components/admin/ui";
import { snackbar } from "@legalir/ui";
import { ApiClientError } from "@/lib/api/errors";
import { toPersianDate } from "@/lib/persian-utils";
import { LAWYER_BANK_STATUS_FA, type LawyerBankStatus } from "@legalir/types";
import { digitsOnly, luhnValid } from "@/lib/payments/card";
import { IconShieldCheck, IconWarning } from "@/lib/icons";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const STATUS_TONE: Record<LawyerBankStatus, Tone> = {
  NOT_SET: "neutral",
  PENDING_REVIEW: "warning",
  VERIFIED: "success",
  NEEDS_CORRECTION: "danger",
};

/**
 * Every action the bank event log can carry, including the operator-supplied
 * `ADMIN_UPDATED` — an edit made on the lawyer's behalf still has to read as an
 * entry the lawyer can recognise, and it is NOT the same as their own submit.
 */
export const BANK_EVENT_FA: Record<
  "SUBMITTED" | "VERIFIED" | "CORRECTION_REQUESTED" | "ADMIN_UPDATED",
  string
> = {
  SUBMITTED: "ثبت اطلاعات توسط شما",
  VERIFIED: "تأیید توسط پشتیبانی",
  CORRECTION_REQUESTED: "درخواست اصلاح",
  ADMIN_UPDATED: "اصلاح توسط پشتیبانی",
};

export interface SettlementFormState {
  holderName: string;
  bankName: string;
  iban: string;
  accountNumber: string;
  cardLast4: string;
  cardNumber: string;
}

/** Group in fours so a 26-char IBAN stays readable. */
export function groupIban(iban: string): string {
  return iban
    .replace(/\s+/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();
}


export function bankStatusBadge(status: LawyerBankStatus) {
  return <Badge tone={STATUS_TONE[status]}>{LAWYER_BANK_STATUS_FA[status]}</Badge>;
}

/**
 * The editable card. Rendered on every surface that lets the lawyer supply
 * their settlement details; `title` lets the host page name the section in its
 * own words without forking the component.
 */
export function SettlementAccountForm({ title }: { title?: string }) {
  const query = useLawyerBank();
  const submit = useSubmitLawyerBank();
  const [form, setForm] = useState<SettlementFormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (query.isLoading) return <LoadingBlock rows={5} />;
  if (query.isError || !query.data)
    return <ErrorBlock message="خطا در بارگذاری اطلاعات بانکی" onRetry={() => query.refetch()} />;

  const data = query.data;
  const draft: SettlementFormState = form ?? {
    holderName: data.account?.holderName ?? "",
    bankName: data.account?.bankName ?? "",
    iban: data.account?.iban ?? "",
    accountNumber: data.account?.accountNumber ?? "",
    // The full PAN is never stored, so the field starts empty; the stored
    // last four ride along separately and are kept unless a new card is typed.
    cardLast4: data.account?.cardLast4 ?? "",
    cardNumber: "",
  };

  function set<K extends keyof SettlementFormState>(key: K, value: SettlementFormState[K]) {
    setForm({ ...draft, [key]: value });
  }

  async function save() {
    setError(null);
    const iban = draft.iban.replace(/\s+/g, "").toUpperCase();
    if (!/^IR\d{24}$/.test(iban)) {
      setError("شماره شبا باید با IR شروع شود و ۲۴ رقم داشته باشد.");
      return;
    }
    if (draft.holderName.trim().length < 3) {
      setError("نام صاحب حساب را کامل بنویسید.");
      return;
    }
    if (draft.bankName.trim().length < 2) {
      setError("نام بانک را بنویسید.");
      return;
    }
    const accountNumber = draft.accountNumber.trim() || null;
    if (accountNumber && !/^\d{6,30}$/.test(accountNumber)) {
      setError("شمارهٔ حساب باید فقط رقم و بین ۶ تا ۳۰ رقم باشد.");
      return;
    }

    const cardNumber = digitsOnly(draft.cardNumber);
    if (cardNumber) {
      if (cardNumber.length !== 16) {
        setError("شمارهٔ کارت باید ۱۶ رقم باشد.");
        return;
      }
      if (!luhnValid(cardNumber)) {
        setError("شمارهٔ کارت معتبر نیست؛ ارقام را بررسی کنید.");
        return;
      }
    }

    const cardLast4 = digitsOnly(draft.cardLast4);
    if (!cardNumber && cardLast4 && cardLast4.length !== 4) {
      setError("چهار رقم آخر کارت باید دقیقاً ۴ رقم باشد.");
      return;
    }

    try {
      await submit.mutateAsync({
        holderName: draft.holderName.trim(),
        bankName: draft.bankName.trim(),
        iban,
        accountNumber,
        // A typed full card wins; otherwise the stored last four are re-sent so
        // editing an unrelated field does not silently delete the card.
        cardNumber: cardNumber || null,
        cardLast4: cardNumber ? null : cardLast4 || null,
      });
      snackbar.show({
        message: "اطلاعات بانکی ثبت شد و برای بررسی ارسال شد.",
        variant: "success",
      });
      setForm(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : "ثبت اطلاعات ناموفق بود.");
    }
  }

  return (
    <Card>
      <CardHeader
        title={title ?? (data.status === "NOT_SET" ? "ثبت اطلاعات بانکی" : "ویرایش اطلاعات بانکی")}
        subtitle="نام صاحب حساب باید با نام وکیل مطابقت داشته باشد."
      />
      <CardBody className="space-y-3">
        {data.status === "NEEDS_CORRECTION" && data.reviewNote && (
          <InlineNotice tone="warning">
            <span className="font-medium">نیازمند اصلاح: </span>
            {data.reviewNote}
          </InlineNotice>
        )}
        {data.status === "PENDING_REVIEW" && (
          <InlineNotice tone="info">
            اطلاعات شما ثبت شده و در انتظار بررسی تیم مالی است. تا تأیید، تسویه انجام نمی‌شود.
          </InlineNotice>
        )}

        <div className="grid gap-3 tablet:grid-cols-2">
          <Field label="نام صاحب حساب" required>
            <TextInput
              value={draft.holderName}
              onChange={(e) => set("holderName", e.target.value)}
              placeholder="نام و نام خانوادگی کامل"
            />
          </Field>
          <Field label="نام بانک" required>
            <TextInput
              value={draft.bankName}
              onChange={(e) => set("bankName", e.target.value)}
              placeholder="مثلاً بانک ملی ایران"
            />
          </Field>
        </div>

        <Field
          label="شماره شبا"
          required
          hint="با IR شروع می‌شود و ۲۴ رقم دارد؛ فاصله‌ها حذف می‌شوند."
          error={error ?? undefined}
        >
          <TextInput
            value={draft.iban}
            onChange={(e) => set("iban", e.target.value)}
            dir="ltr"
            placeholder="IR000000000000000000000000"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <Field label="شمارهٔ حساب (اختیاری)" hint="فقط رقم؛ بین ۶ تا ۳۰ رقم">
          <TextInput
            value={draft.accountNumber}
            onChange={(e) => set("accountNumber", e.target.value)}
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
          />
        </Field>

        <div className="grid gap-3 tablet:grid-cols-2">
          <Field
            label="شمارهٔ کارت (اختیاری)"
            hint="۱۶ رقم؛ فقط شش رقم اول و چهار رقم آخر ذخیره می‌شود."
          >
            <TextInput
              value={draft.cardNumber}
              onChange={(e) => set("cardNumber", e.target.value)}
              dir="ltr"
              inputMode="numeric"
              maxLength={19}
              placeholder={
                draft.cardLast4 ? `•••• •••• •••• ${draft.cardLast4}` : "6037 0000 0000 0000"
              }
              autoComplete="off"
            />
          </Field>
          <Field
            label="چهار رقم آخر کارت"
            hint={
              draft.cardNumber
                ? "از شمارهٔ کارت بالا خوانده می‌شود."
                : "برای تأیید هویت در تماس تلفنی"
            }
          >
            <TextInput
              value={
                draft.cardNumber ? draft.cardNumber.replace(/\D/g, "").slice(-4) : draft.cardLast4
              }
              onChange={(e) => set("cardLast4", e.target.value)}
              dir="ltr"
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              disabled={Boolean(draft.cardNumber)}
            />
          </Field>
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={() => void save()} loading={submit.isPending}>
            ثبت و ارسال برای بررسی
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/** The stored record, exactly as the lawyer will be paid, plus the event log. */
export function SettlementAccountSummary({ events = true }: { events?: boolean }) {
  const query = useLawyerBank();

  if (query.isLoading) return <LoadingBlock rows={4} />;
  if (query.isError || !query.data)
    return <ErrorBlock message="خطا در بارگذاری اطلاعات بانکی" onRetry={() => query.refetch()} />;

  const data = query.data;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="اطلاعات ثبت‌شده" />
        <CardBody>
          {data.account ? (
            <dl className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-caption text-muted">صاحب حساب</dt>
                <dd className="text-body-2 text-on-surface">{data.account.holderName}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-caption text-muted">بانک</dt>
                <dd className="text-body-2 text-on-surface">{data.account.bankName}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted">شبا</dt>
                <dd className="mt-0.5 break-all font-mono text-body-2 text-on-surface" dir="ltr">
                  {groupIban(data.account.iban)}
                </dd>
              </div>
              {data.account.accountNumber && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-caption text-muted">شمارهٔ حساب</dt>
                  <dd className="font-mono text-body-2 text-on-surface" dir="ltr">
                    {data.account.accountNumber}
                  </dd>
                </div>
              )}
              {(data.account.cardMasked || data.account.cardLast4) && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-caption text-muted">کارت</dt>
                  <dd className="font-mono text-body-2 text-on-surface" dir="ltr">
                    {data.account.cardMasked ?? `•••• •••• •••• ${data.account.cardLast4}`}
                  </dd>
                </div>
              )}
              {data.submittedAt && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-caption text-muted">آخرین ثبت</dt>
                  <dd className="text-caption tabular-nums text-muted">
                    {toPersianDate(data.submittedAt)}
                  </dd>
                </div>
              )}
              {data.reviewedAt && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-caption text-muted">آخرین بررسی</dt>
                  <dd className="text-caption tabular-nums text-muted">
                    {toPersianDate(data.reviewedAt)}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-body-2 text-muted">
              هنوز اطلاعات بانکی ثبت نکرده‌اید. تا ثبت و تأیید، تسویهٔ دستمزد ممکن نیست.
            </p>
          )}
        </CardBody>
      </Card>

      {events && (
        <Card>
          <CardHeader title="سابقهٔ تغییرات" subtitle="هر تغییر با زمان و عامل ثبت می‌شود." />
          <CardBody>
            {data.events.length === 0 ? (
              <p className="text-body-2 text-muted">رویدادی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {data.events.map((e) => (
                  <li key={e.id} className="rounded-medium bg-surface-container px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-caption font-medium text-on-surface">
                        {e.action === "CORRECTION_REQUESTED" ? (
                          <IconWarning size={13} className="text-warning-600" aria-hidden="true" />
                        ) : e.action === "VERIFIED" ? (
                          <IconShieldCheck size={13} className="text-success" aria-hidden="true" />
                        ) : null}
                        {BANK_EVENT_FA[e.action]}
                      </span>
                      <span className="text-caption tabular-nums text-muted">
                        {toPersianDate(e.createdAt)}
                      </span>
                    </div>
                    {e.destinationMasked && (
                      <p className="mt-0.5 font-mono text-caption text-muted" dir="ltr">
                        {e.destinationMasked}
                      </p>
                    )}
                    {e.reason && (
                      <p className="mt-1 text-caption text-on-surface-variant">{e.reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
