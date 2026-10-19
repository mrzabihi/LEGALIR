// ============================================================
// LEGALIR — Lawyer workbench · Settlement account (حساب تسویه)
// ============================================================
// §7's secure section: the holder name, bank and IBAN used to settle fees.
//
//   · The full IBAN comes back ONLY to the owning lawyer — the route resolves
//     the lawyer from the session, and every other surface (admin list, audit,
//     events) reads a masked form.
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
  PageHeader,
  TextInput,
} from "@/components/admin/ui";
import { snackbar } from "@legalir/ui";
import { ApiClientError } from "@/lib/api/errors";
import { toPersianDate } from "@/lib/persian-utils";
import { LAWYER_BANK_STATUS_FA, type LawyerBankStatus } from "@legalir/types";
import { IconCalculator, IconShieldCheck, IconWarning } from "@/lib/icons";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const STATUS_TONE: Record<LawyerBankStatus, Tone> = {
  NOT_SET: "neutral",
  PENDING_REVIEW: "warning",
  VERIFIED: "success",
  NEEDS_CORRECTION: "danger",
};

const EVENT_FA = {
  SUBMITTED: "ثبت اطلاعات",
  VERIFIED: "تأیید توسط پشتیبانی",
  CORRECTION_REQUESTED: "درخواست اصلاح",
} as const;

interface FormState {
  holderName: string;
  bankName: string;
  iban: string;
  accountNumber: string;
  cardLast4: string;
}

/** Group in fours so a 26-char IBAN stays readable. */
function groupIban(iban: string): string {
  return iban
    .replace(/\s+/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export default function LawyerBankPage() {
  const query = useLawyerBank();
  const submit = useSubmitLawyerBank();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (query.isLoading) return <LoadingBlock rows={5} />;
  if (query.isError || !query.data)
    return <ErrorBlock message="خطا در بارگذاری اطلاعات بانکی" onRetry={() => query.refetch()} />;

  const data = query.data;
  const draft: FormState = form ?? {
    holderName: data.account?.holderName ?? "",
    bankName: data.account?.bankName ?? "",
    iban: data.account?.iban ?? "",
    accountNumber: data.account?.accountNumber ?? "",
    cardLast4: data.account?.cardLast4 ?? "",
  };

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
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
    const cardLast4 = draft.cardLast4.replace(/\D/g, "");
    if (cardLast4 && cardLast4.length !== 4) {
      setError("چهار رقم آخر کارت باید دقیقاً ۴ رقم باشد.");
      return;
    }

    try {
      await submit.mutateAsync({
        holderName: draft.holderName.trim(),
        bankName: draft.bankName.trim(),
        iban,
        accountNumber,
        cardLast4: cardLast4 || null,
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
    <div>
      <PageHeader
        title="حساب تسویه"
        description="شماره شبای شما برای واریز دستمزد. این اطلاعات فقط برای شما و تیم مالی مجاز نمایش داده می‌شود."
        icon={<IconCalculator size={22} />}
        actions={<Badge tone={STATUS_TONE[data.status]}>{LAWYER_BANK_STATUS_FA[data.status]}</Badge>}
      />

      {data.status === "NEEDS_CORRECTION" && data.reviewNote && (
        <InlineNotice tone="warning" className="mb-4">
          <span className="font-medium">نیازمند اصلاح: </span>
          {data.reviewNote}
        </InlineNotice>
      )}

      {data.status === "PENDING_REVIEW" && (
        <InlineNotice tone="info" className="mb-4">
          اطلاعات شما ثبت شده و در انتظار بررسی تیم مالی است. تا تأیید، تسویه انجام نمی‌شود.
        </InlineNotice>
      )}

      <div className="grid gap-5 laptop:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <Card>
          <CardHeader
            title={data.status === "NOT_SET" ? "ثبت اطلاعات بانکی" : "ویرایش اطلاعات بانکی"}
            subtitle="نام صاحب حساب باید با نام وکیل مطابقت داشته باشد."
          />
          <CardBody className="space-y-3">
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
            <div className="grid gap-3 tablet:grid-cols-2">
              <Field label="شمارهٔ حساب (اختیاری)">
                <TextInput
                  value={draft.accountNumber}
                  onChange={(e) => set("accountNumber", e.target.value)}
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </Field>
              <Field label="چهار رقم آخر کارت (اختیاری)" hint="برای تأیید هویت در تماس تلفنی">
                <TextInput
                  value={draft.cardLast4}
                  onChange={(e) => set("cardLast4", e.target.value)}
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
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

        <div className="space-y-5">
          {/* Current record — the exact IBAN is shown only to its owner. */}
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
                    <dd
                      className="mt-0.5 break-all font-mono text-body-2 text-on-surface"
                      dir="ltr"
                    >
                      {groupIban(data.account.iban)}
                    </dd>
                  </div>
                  {data.account.cardLast4 && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-caption text-muted">کارت</dt>
                      <dd className="text-body-2 tabular-nums text-on-surface" dir="ltr">
                        •••• {data.account.cardLast4}
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

          {/* Events */}
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
                            <IconWarning
                              size={13}
                              className="text-warning-600"
                              aria-hidden="true"
                            />
                          ) : e.action === "VERIFIED" ? (
                            <IconShieldCheck
                              size={13}
                              className="text-success"
                              aria-hidden="true"
                            />
                          ) : null}
                          {EVENT_FA[e.action]}
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
        </div>
      </div>
    </div>
  );
}
