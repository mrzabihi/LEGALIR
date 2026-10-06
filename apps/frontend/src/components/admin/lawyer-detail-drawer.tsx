// ============================================================
// LEGALIR — Admin · Lawyer detail drawer
// ============================================================
// The full registration dossier for one lawyer, plus the two staff actions
// that live on it: recording a verification decision and sending a direct
// message. Nothing here is fabricated — every field comes from the
// `GET /admin/lawyers/[id]` dossier (the same profile the public site reads).
//
// A verification decision can never be recorded anonymously or without a
// reason: the confirmation dialog forces a reason and the server rejects the
// request if it is missing. The written decision is shown in the timeline
// below ("توسط … در تاریخ … از «…» به «…»").
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { Drawer, snackbar } from "@legalir/ui";
import { useAdminLawyer, useDecideLawyerVerification, useSendLawyerMessage } from "@/hooks/useAdmin";
import {
  Badge,
  Button,
  Field,
  IdChip,
  LoadingBlock,
  ErrorBlock,
  InfoBanner,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import {
  LAWYER_VERIFICATION_FA,
  LAWYER_DECISION_BUCKET_FA,
  LEGAL_CATEGORY_FA,
  type LawyerDecisionBucket,
  type LawyerVerificationStatus,
} from "@legalir/types";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import type { AdminLawyerDetail } from "@/lib/api/admin";

// ---------------------------------------------------------------------------
// Shared presentation maps
// ---------------------------------------------------------------------------

export const BUCKET_TONES: Record<
  LawyerDecisionBucket,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
};

/** The three decisions an admin can record from the panel. */
const DECISIONS: {
  status: LawyerVerificationStatus;
  label: string;
  destructive: boolean;
  help: string;
}[] = [
  {
    status: "VERIFIED",
    label: "تأیید",
    destructive: false,
    help: "وکیل در سایت عمومی نمایش داده می‌شود و می‌تواند درخواست مشاوره بپذیرد.",
  },
  {
    status: "REJECTED",
    label: "رد",
    destructive: true,
    help: "وکیل در سایت عمومی نمایش داده نمی‌شود.",
  },
  {
    status: "SUSPENDED",
    label: "تعلیق",
    destructive: true,
    help: "پروفایل با کارت هشدار نمایش داده می‌شود و امکان رزرو/تماس غیرفعال است.",
  },
];

function DecisionDialog({
  detail,
  decision,
  busy,
  onClose,
  onConfirm,
}: {
  detail: AdminLawyerDetail;
  decision: (typeof DECISIONS)[number];
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 3;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
        onClick={busy ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lawyer-decision-title"
        className="relative w-full max-w-md rounded-large bg-surface p-6 shadow-elevation-24"
      >
        <h2 id="lawyer-decision-title" className="text-headlineSmall text-on-surface">
          {decision.label} وکیل
        </h2>
        <p className="mt-1 text-body-2 text-on-surface-variant">
          این تغییر وضعیت به‌صورت حساب‌شده در تاریخچه و گزارش‌های پلتفرم ثبت می‌شود.
        </p>

        <div className="mt-4 space-y-2 rounded-medium border border-divider bg-surface-container-low p-3 text-body-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted">وکیل</span>
            <span className="font-medium text-on-surface">{detail.profile.fullName}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted">وضعیت جدید</span>
            <Badge tone={decision.destructive ? "danger" : "success"}>
              {LAWYER_VERIFICATION_FA[decision.status]}
            </Badge>
          </div>
          <p className="text-caption text-muted">{decision.help}</p>
        </div>

        {decision.destructive && (
          <div className="mt-3">
            <InfoBanner tone="warning">
              این عملیات از دسترسی وکیل به مشاوره جلوگیری می‌کند. دلیل را دقیق ثبت کنید.
            </InfoBanner>
          </div>
        )}

        <div className="mt-4">
          <Field label="دلیل تصمیم (الزامی)" hint="این متن برای وکیل و در تاریخچه نمایش داده می‌شود.">
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="مثلاً: مدارک پروانه وکالت تأیید شد."
            />
          </Field>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button
            variant={decision.destructive ? "danger" : "primary"}
            disabled={!valid || busy}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? "در حال ثبت…" : `ثبت ${decision.label}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-body-2">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-end font-medium text-on-surface">{value || "—"}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-large border border-divider bg-surface p-3">
      <h3 className="mb-2 text-titleSmall font-medium text-on-surface">{title}</h3>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------

export function LawyerDetailDrawer({
  lawyerId,
  open,
  onClose,
  canReview,
}: {
  lawyerId: string | null;
  open: boolean;
  onClose: () => void;
  canReview: boolean;
}) {
  const query = useAdminLawyer(open ? lawyerId : null);
  const decide = useDecideLawyerVerification();
  const sendMessage = useSendLawyerMessage();

  const [pending, setPending] = useState<(typeof DECISIONS)[number] | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Reset the message composer whenever a different lawyer is opened.
  useEffect(() => {
    setSubject("");
    setBody("");
    setPending(null);
  }, [lawyerId]);

  const detail = query.data;
  const messageValid = subject.trim().length >= 2 && body.trim().length >= 2;

  async function confirmDecision(reason: string) {
    if (!detail || !pending) return;
    try {
      await decide.mutateAsync({ id: detail.profile.id, status: pending.status, reason });
      snackbar.show({
        message: `وضعیت وکیل به «${LAWYER_VERIFICATION_FA[pending.status]}» تغییر کرد.`,
        variant: "success",
      });
      setPending(null);
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "ثبت تصمیم ناموفق بود";
      snackbar.show({ message, variant: "error" });
    }
  }

  async function submitMessage() {
    if (!detail || !messageValid) return;
    try {
      await sendMessage.mutateAsync({
        id: detail.profile.id,
        input: { subject: subject.trim(), body: body.trim() },
      });
      snackbar.show({ message: "پیام برای وکیل ارسال شد.", variant: "success" });
      setSubject("");
      setBody("");
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "ارسال پیام ناموفق بود";
      snackbar.show({ message, variant: "error" });
    }
  }

  return (
    <Drawer open={open} onClose={onClose} position="end" width={520} title="پرونده وکیل">
      {query.isLoading && <LoadingBlock rows={6} />}
      {query.isError && <ErrorBlock onRetry={() => query.refetch()} />}

      {detail && (
        <div className="space-y-4">
          {/* Identity */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-titleLarge text-on-surface">{detail.profile.fullName}</h2>
              {detail.profile.isDemo && (
                <Badge tone="neutral" title="پروفایل نمونه / داده توسعه">
                  نمونه
                </Badge>
              )}
              <Badge tone={BUCKET_TONES[detail.bucket]}>
                {LAWYER_DECISION_BUCKET_FA[detail.bucket]}
              </Badge>
            </div>
            {detail.profile.professionalTitle && (
              <p className="mt-0.5 text-body-2 text-on-surface-variant">
                {detail.profile.professionalTitle}
              </p>
            )}
            <div className="mt-1">
              <IdChip id={detail.profile.id} />
            </div>
          </div>

          {/* Contact */}
          <Block title="اطلاعات تماس">
            <Row
              label="شماره موبایل"
              value={
                <span dir="ltr" className="tabular-nums">
                  {detail.contact.mobileMasked}
                </span>
              }
            />
            <Row label="ایمیل" value={detail.contact.email} />
            <Row label="نقش حساب" value={detail.user.role} />
            <Row label="نوع حساب" value={detail.user.accountType} />
          </Block>

          {/* Licence / registration evidence */}
          <Block title="پروانه و مدارک ثبت‌شده">
            <Row
              label="شماره پروانه"
              value={
                detail.profile.licenseNumber ? (
                  <span dir="ltr" className="tabular-nums">
                    {detail.profile.licenseNumber}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Row label="مرجع صدور پروانه" value={detail.profile.licenseAuthority} />
            <Row
              label="سال صدور"
              value={detail.profile.licenseYear ? toPersianNumber(detail.profile.licenseYear) : "—"}
            />
            <Row label="نوع فعالیت" value={detail.profile.activityType} />
            {detail.profile.bio && (
              <div className="mt-2 border-t border-divider pt-2 text-body-2 text-on-surface-variant">
                {detail.profile.bio}
              </div>
            )}
          </Block>

          {/* Specialities */}
          <Block title="تخصص‌ها">
            {detail.profile.specializations.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {detail.profile.specializations.map((s) => (
                  <Badge key={s.category} tone="info">
                    {LEGAL_CATEGORY_FA[s.category] ?? s.category}
                    {s.yearsExperience ? ` · ${toPersianNumber(s.yearsExperience)} سال` : ""}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-body-2 text-muted">تخصصی ثبت نشده است.</p>
            )}
          </Block>

          {/* Locations */}
          <Block title="محل فعالیت">
            {detail.profile.locations.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {detail.profile.locations.map((loc, i) => (
                  <Badge key={`${loc.province}-${loc.city}-${i}`} tone="neutral">
                    {loc.province} — {loc.city}
                    {loc.remote ? " (آنلاین)" : ""}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-body-2 text-muted">محلی ثبت نشده است.</p>
            )}
          </Block>

          {/* Registration / status meta */}
          <Block title="وضعیت و زمان‌ها">
            <Row
              label="وضعیت فعلی"
              value={LAWYER_VERIFICATION_FA[detail.profile.verificationStatus]}
            />
            <Row label="تاریخ ثبت‌نام" value={toPersianDate(detail.profile.createdAt)} />
            <Row
              label="آخرین تغییر وضعیت"
              value={detail.lastDecision ? toPersianDate(detail.lastDecision.createdAt) : "—"}
            />
            <Row
              label="تصمیم‌گیرنده"
              value={detail.lastDecision ? detail.lastDecision.actorName : "—"}
            />
          </Block>

          {/* Decision history */}
          <Block title={`تاریخچه تصمیم‌ها (${toPersianNumber(detail.history.length)})`}>
            {detail.history.length === 0 ? (
              <p className="text-body-2 text-muted">تاکنون تصمیمی ثبت نشده است.</p>
            ) : (
              <ol className="space-y-2">
                {detail.history.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-medium border border-divider bg-surface-container-low p-2.5 text-body-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-on-surface">
                        {LAWYER_VERIFICATION_FA[h.previousStatus]} →{" "}
                        {LAWYER_VERIFICATION_FA[h.newStatus]}
                      </span>
                      <span className="text-caption text-muted">{toPersianDate(h.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-caption text-muted">
                      توسط {h.actorName} ({h.actorRole})
                    </div>
                    <div className="mt-1 text-on-surface-variant">دلیل: {h.reason}</div>
                  </li>
                ))}
              </ol>
            )}
          </Block>

          {/* Direct message */}
          <Block title="ارسال پیام مستقیم به وکیل">
            <p className="mb-2 text-caption text-muted">
              پیام در مرکز اعلان‌های وکیل در سایت LegalIR نمایش داده می‌شود.
            </p>
            <div className="space-y-2">
              <Field label="عنوان پیام">
                <TextInput
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="مثلاً: تکمیل مدارک پروانه"
                />
              </Field>
              <Field label="متن پیام">
                <TextArea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="متن پیام…"
                />
              </Field>
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  disabled={!messageValid || sendMessage.isPending}
                  onClick={submitMessage}
                >
                  {sendMessage.isPending ? "در حال ارسال…" : "ارسال"}
                </Button>
              </div>
            </div>
            {detail.messages.length > 0 && (
              <div className="mt-3 border-t border-divider pt-2">
                <p className="mb-1 text-caption text-muted">
                  {toPersianNumber(detail.messages.length)} پیام ارسال‌شده
                </p>
                <ul className="space-y-1">
                  {detail.messages.slice(0, 5).map((m) => (
                    <li key={m.id} className="text-caption text-on-surface-variant">
                      <span className="font-medium text-on-surface">{m.subject}</span>
                      <span className="text-muted"> · {toPersianDate(m.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Block>

          {/* Decision actions */}
          {canReview && (
            <Block title="ثبت تصمیم">
              <div className="flex flex-wrap gap-2">
                {DECISIONS.map((d) => (
                  <Button
                    key={d.status}
                    variant={d.destructive ? "danger" : "primary"}
                    size="sm"
                    disabled={detail.profile.verificationStatus === d.status || decide.isPending}
                    onClick={() => setPending(d)}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </Block>
          )}
        </div>
      )}

      {pending && detail && (
        <DecisionDialog
          detail={detail}
          decision={pending}
          busy={decide.isPending}
          onClose={() => setPending(null)}
          onConfirm={confirmDecision}
        />
      )}
    </Drawer>
  );
}
