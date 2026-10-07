// ============================================================
// LEGALIR — Admin · Lawyer detail drawer (full management surface)
// ============================================================
// The complete operator console for ONE lawyer. Every tab reads and writes
// the SAME profile row the public /lawyers marketplace reads, so a change
// here (edit, avatar, rating, review, status, featured) is reflected on the
// public site immediately — there is no second copy.
//
// Tabs:
//   dossier — the read-only registration file (identity, licence, contact,
//             expertise, services, jurisdictions, locations, timeline, the
//             verification decision form and the direct-message composer).
//   edit    — the full profile PATCH (identity, licence, rank, organisation,
//             visibility, expertise, services, jurisdictions, pricing).
//   avatar  — replace the portrait: regenerate a demo SVG or paste a URL.
//   rating  — the admin-controlled display values (rating / review count /
//             fee / trust badge), kept SEPARATE from the review-derived
//             average so a hand-set display never masquerades as real data.
//   reviews — per-review moderation: hide (reversible) / restore / delete.
//   status  — the operator lifecycle (فعال/غیرفعال/معلق/حذفشده) with soft
//             delete + restore, plus the verification decision.
//
// Sensitive operations are permission-gated server-side; the client checks
// are only a UX affordance (a hidden button is never the security boundary).
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer, snackbar } from "@legalir/ui";
import {
  useAdminLawyer,
  useAdminMe,
  useDecideLawyerVerification,
  useSendLawyerMessage,
  useUpdateAdminLawyer,
  useSetAdminLawyerStatus,
  useSetAdminLawyerAvatar,
  useSetAdminLawyerRating,
  useModerateAdminLawyerReview,
} from "@/hooks/useAdmin";
import {
  Badge,
  Button,
  Field,
  IdChip,
  LoadingBlock,
  ErrorBlock,
  InfoBanner,
  Tabs,
  TextArea,
  TextInput,
  Select,
} from "@/components/admin/ui";
import { LawyerAvatar } from "@/components/lawyers";
import {
  LAWYER_VERIFICATION_FA,
  LAWYER_DECISION_BUCKET_FA,
  LAWYER_PROFESSIONAL_RANK_FA,
  LAWYER_PROFESSIONAL_RANKS,
  LAWYER_ORGANIZATION_TYPE_FA,
  LAWYER_ORGANIZATION_TYPES,
  LAWYER_LICENSE_STATUS_FA,
  LAWYER_GENDER_FA,
  LAWYER_VISIBILITY_FA,
  LAWYER_SERVICES,
  LAWYER_JURISDICTIONS,
  ADMIN_LAWYER_STATUS_FA,
  taxonomyByType,
  taxonomyPathLabels,
  lawyerServiceLabel,
  jurisdictionLabel,
  type LawyerDecisionBucket,
  type LawyerVerificationStatus,
  type LawyerProfessionalRank,
  type LawyerOrganizationType,
  type LawyerLicenseStatus,
  type LawyerGender,
  type LawyerMarketplaceVisibility,
  type LawyerExpertise,
  type LawyerLocation,
  type AdminLawyerStatus,
} from "@legalir/types";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import { specialtyLabel } from "@/lib/lawyers/specialty";
import type { AdminLawyerDetail, AdminLawyerPatchInput } from "@/lib/api/admin";

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

export const LIFECYCLE_TONES: Record<
  AdminLawyerStatus,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "danger",
  DELETED: "danger",
};

/** The licence-status and gender vocabularies (no exported array in types). */
const LICENSE_STATUSES: LawyerLicenseStatus[] = ["ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"];
const GENDERS: LawyerGender[] = ["MALE", "FEMALE", "UNSPECIFIED"];
const VISIBILITIES: LawyerMarketplaceVisibility[] = ["PUBLIC", "UNLISTED", "HIDDEN"];

/** The three verification decisions an admin can record from the panel. */
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

/** The lifecycle transitions offered in the status tab. */
const LIFECYCLE_ACTIONS: {
  status: AdminLawyerStatus;
  label: string;
  destructive: boolean;
  needsReason: boolean;
  help: string;
}[] = [
  {
    status: "ACTIVE",
    label: "فعال‌سازی",
    destructive: false,
    needsReason: false,
    help: "پروفایل در جستجو و فهرست عمومی نمایش داده می‌شود.",
  },
  {
    status: "INACTIVE",
    label: "غیرفعال‌سازی",
    destructive: false,
    needsReason: false,
    help: "پروفایل پنهان می‌شود اما داده‌ها و سابقه حفظ می‌گردد.",
  },
  {
    status: "SUSPENDED",
    label: "تعلیق",
    destructive: true,
    needsReason: true,
    help: "کارت هشدار روی پروفایل عمومی نمایش داده می‌شود و رزرو غیرفعال است.",
  },
  {
    status: "DELETED",
    label: "حذف نرم",
    destructive: true,
    needsReason: true,
    help: "پروفایل از سایت عمومی حذف می‌شود اما در پنل ادمین باقی می‌ماند و قابل بازگردانی است.",
  },
];

// ---------------------------------------------------------------------------
// Dialogs & small presentational helpers
// ---------------------------------------------------------------------------

/** A generic confirm dialog that forces a reason above a minimum length. */
function ReasonDialog({
  title,
  description,
  confirmLabel,
  destructive,
  minLength = 3,
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive: boolean;
  minLength?: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= minLength;

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
        aria-labelledby="lawyer-reason-title"
        className="relative w-full max-w-md rounded-large bg-surface p-6 shadow-elevation-24"
      >
        <h2 id="lawyer-reason-title" className="text-headlineSmall text-on-surface">
          {title}
        </h2>
        <div className="mt-1 text-body-2 text-on-surface-variant">{description}</div>

        {destructive && (
          <div className="mt-3">
            <InfoBanner tone="warning">
              این عملیات بلافاصله در سایت عمومی اثر می‌گذارد. دلیل را دقیق ثبت کنید.
            </InfoBanner>
          </div>
        )}

        <div className="mt-4">
          <Field label="دلیل (الزامی)" hint="این متن در گزارش عملیات (Audit Log) ثبت می‌شود.">
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="دلیل این تغییر…"
            />
          </Field>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            disabled={!valid || busy}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? "در حال ثبت…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

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

/** A toggle rendered as a small chip button (multi-select rows). */
function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-caption transition-colors ${
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-divider bg-surface text-on-surface-variant hover:border-outline"
      }`}
    >
      {children}
    </button>
  );
}

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// ---------------------------------------------------------------------------
// Avatar tab
// ---------------------------------------------------------------------------

function AvatarPanel({ detail, canManage }: { detail: AdminLawyerDetail; canManage: boolean }) {
  const setAvatar = useSetAdminLawyerAvatar();
  const [url, setUrl] = useState("");

  const current = detail.profile.avatarUrl;

  async function regenerate() {
    try {
      await setAvatar.mutateAsync({ id: detail.profile.id, input: { regenerate: true } });
      snackbar.show({ message: "آواتار نمونه بازتولید شد.", variant: "success" });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "تغییر آواتار ناموفق بود"), variant: "error" });
    }
  }

  async function applyUrl() {
    const value = url.trim();
    if (!value) return;
    try {
      await setAvatar.mutateAsync({
        id: detail.profile.id,
        input: { avatarUrl: value, avatarType: "real" },
      });
      snackbar.show({ message: "آواتار به‌روزرسانی شد.", variant: "success" });
      setUrl("");
    } catch (err) {
      snackbar.show({ message: errMessage(err, "تغییر آواتار ناموفق بود"), variant: "error" });
    }
  }

  return (
    <div className="space-y-4">
      <Block title="آواتار فعلی">
        <div className="flex items-center gap-4">
          <LawyerAvatar
            name={detail.profile.fullName}
            avatarUrl={current}
            avatarType={detail.profile.avatarType}
            size={72}
          />
          <div className="text-body-2 text-on-surface-variant">
            <div className="font-medium text-on-surface">{detail.profile.fullName}</div>
            <div className="text-caption text-muted">
              نوع: {detail.profile.avatarType === "demo" ? "نمونه (تولیدشده)" : "واقعی"}
            </div>
            <div className="text-caption text-muted">
              جنسیت مبنا: {LAWYER_GENDER_FA[detail.profile.gender ?? "UNSPECIFIED"]}
            </div>
          </div>
        </div>
      </Block>

      {canManage ? (
        <>
          <Block title="بازتولید آواتار نمونه">
            <p className="mb-2 text-caption text-muted">
              یک پرترهٔ SVG جدید و سازگار با جنسیت و نام وکیل ساخته می‌شود. این تغییر بلافاصله در سایت
              عمومی دیده می‌شود.
            </p>
            <Button variant="secondary" disabled={setAvatar.isPending} onClick={regenerate}>
              {setAvatar.isPending ? "در حال ساخت…" : "ساخت آواتار جدید"}
            </Button>
          </Block>

          <Block title="تنظیم آدرس تصویر">
            <Field label="نشانی تصویر (URL)" hint="برای تصاویر واقعی استفاده کنید.">
              <TextInput
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                dir="ltr"
                placeholder="https://…"
              />
            </Field>
            <div className="mt-2 flex justify-end">
              <Button variant="primary" disabled={!url.trim() || setAvatar.isPending} onClick={applyUrl}>
                اعمال آدرس
              </Button>
            </div>
          </Block>
        </>
      ) : (
        <InfoBanner tone="warning">شما مجوز مدیریت آواتار را ندارید.</InfoBanner>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rating tab (admin display overrides — never the review-derived average)
// ---------------------------------------------------------------------------

function RatingPanel({ detail, canManage }: { detail: AdminLawyerDetail; canManage: boolean }) {
  const saveRating = useSetAdminLawyerRating();
  const display = detail.profile.display;

  const [rating, setRating] = useState(display?.ratingOverride?.toString() ?? "");
  const [count, setCount] = useState(display?.reviewCountOverride?.toString() ?? "");
  const [fee, setFee] = useState(display?.consultationFeeOverrideToman?.toString() ?? "");
  const [badgeFa, setBadgeFa] = useState(display?.badgeFa ?? "");

  useEffect(() => {
    setRating(display?.ratingOverride?.toString() ?? "");
    setCount(display?.reviewCountOverride?.toString() ?? "");
    setFee(display?.consultationFeeOverrideToman?.toString() ?? "");
    setBadgeFa(display?.badgeFa ?? "");
  }, [
    detail.profile.id,
    display?.ratingOverride,
    display?.reviewCountOverride,
    display?.consultationFeeOverrideToman,
    display?.badgeFa,
  ]);

  const ratingNum = rating.trim() === "" ? null : Number(rating);
  const countNum = count.trim() === "" ? null : Number(count);
  const feeNum = fee.trim() === "" ? null : Number(fee);

  const ratingValid = ratingNum === null || (ratingNum >= 1 && ratingNum <= 5);
  const countValid = countNum === null || (Number.isInteger(countNum) && countNum >= 0);
  const feeValid = feeNum === null || (Number.isInteger(feeNum) && feeNum >= 0);
  const valid = ratingValid && countValid && feeValid;

  async function save() {
    if (!valid) return;
    try {
      await saveRating.mutateAsync({
        id: detail.profile.id,
        input: {
          ratingOverride: ratingNum,
          reviewCountOverride: countNum,
          consultationFeeOverrideToman: feeNum,
          badgeFa: badgeFa.trim() || null,
        },
      });
      snackbar.show({ message: "مقادیر نمایشی ذخیره شد.", variant: "success" });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ذخیره ناموفق بود"), variant: "error" });
    }
  }

  return (
    <div className="space-y-4">
      <InfoBanner tone="info">
        امتیاز واقعی از نظرات کاربران محاسبه می‌شود
        {detail.profile.performance.averageRating != null
          ? ` (میانگین فعلی: ${toPersianNumber(Number(detail.profile.performance.averageRating.toFixed(1)))} از ${toPersianNumber(detail.profile.performance.reviewCount)} نظر)`
          : " (هنوز نظری ثبت نشده)"}
        . مقادیر زیر فقط «نمایش» را جایگزین می‌کنند و داده‌های واقعی را تغییر نمی‌دهند.
      </InfoBanner>

      {canManage ? (
        <Block title="مقادیر نمایشی">
          <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
            <Field
              label="امتیاز نمایشی (۱ تا ۵)"
              hint={ratingValid ? "خالی = استفاده از میانگین واقعی" : "باید بین ۱ و ۵ باشد"}
            >
              <TextInput
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                dir="ltr"
                inputMode="decimal"
                placeholder="مثلاً 4.8"
              />
            </Field>
            <Field
              label="تعداد نظرات نمایشی"
              hint={countValid ? "خالی = استفاده از تعداد واقعی" : "باید عدد صحیح ≥ ۰ باشد"}
            >
              <TextInput
                value={count}
                onChange={(e) => setCount(e.target.value)}
                dir="ltr"
                inputMode="numeric"
                placeholder="مثلاً 120"
              />
            </Field>
            <Field
              label="هزینهٔ مشاوره (تومان)"
              hint={feeValid ? "خالی = استفاده از قیمت ثبت‌شدهٔ وکیل" : "باید عدد صحیح ≥ ۰ باشد"}
            >
              <TextInput
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                dir="ltr"
                inputMode="numeric"
                placeholder="مثلاً 500000"
              />
            </Field>
            <Field label="نشان اعتماد" hint="مثلاً «وکیل برگزیده» — خالی = بدون نشان">
              <TextInput value={badgeFa} onChange={(e) => setBadgeFa(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="primary" disabled={!valid || saveRating.isPending} onClick={save}>
              {saveRating.isPending ? "در حال ذخیره…" : "ذخیره"}
            </Button>
          </div>
        </Block>
      ) : (
        <InfoBanner tone="warning">شما مجوز مدیریت امتیاز را ندارید.</InfoBanner>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reviews tab
// ---------------------------------------------------------------------------

function ReviewsPanel({ detail, canManage }: { detail: AdminLawyerDetail; canManage: boolean }) {
  const moderate = useModerateAdminLawyerReview();
  const [pending, setPending] = useState<{
    reviewId: string;
    action: "hide" | "restore" | "delete";
  } | null>(null);

  const reviews = detail.reviews;

  async function run(reviewId: string, action: "hide" | "restore" | "delete", reason?: string) {
    try {
      await moderate.mutateAsync({ id: detail.profile.id, reviewId, action, reason });
      snackbar.show({ message: "نظر به‌روزرسانی شد.", variant: "success" });
      setPending(null);
    } catch (err) {
      snackbar.show({ message: errMessage(err, "عملیات ناموفق بود"), variant: "error" });
    }
  }

  return (
    <div className="space-y-4">
      <InfoBanner tone="info">
        پنهان‌سازی «بازگردانی‌پذیر» است: نظر از فهرست عمومی و از میانگین امتیاز خارج می‌شود اما حذف
        نمی‌گردد. حذف، ردیف را برای همیشه برمی‌دارد.
      </InfoBanner>

      {reviews.length === 0 ? (
        <p className="text-body-2 text-muted">نظری برای این وکیل ثبت نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-medium border border-divider bg-surface-container-low p-3 text-body-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-on-surface">{r.authorName}</span>
                <span className="flex items-center gap-2">
                  <Badge tone="neutral">{toPersianNumber(r.rating)} ستاره</Badge>
                  {r.hidden && <Badge tone="warning">پنهان</Badge>}
                  {r.verifiedEngagement && <Badge tone="info">خرید تأییدشده</Badge>}
                </span>
              </div>
              <p className="mt-1.5 text-on-surface-variant">{r.comment}</p>
              <div className="mt-1 text-caption text-muted">{toPersianDate(r.createdAt)}</div>

              {canManage && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.hidden ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={moderate.isPending}
                      onClick={() => run(r.id, "restore")}
                    >
                      بازگردانی
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={moderate.isPending}
                      onClick={() => setPending({ reviewId: r.id, action: "hide" })}
                    >
                      پنهان‌سازی
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={moderate.isPending}
                    onClick={() => setPending({ reviewId: r.id, action: "delete" })}
                  >
                    حذف
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <ReasonDialog
          title={pending.action === "delete" ? "حذف نظر" : "پنهان‌سازی نظر"}
          description={
            <p>
              {pending.action === "delete"
                ? "این نظر برای همیشه حذف می‌شود و قابل بازگردانی نیست."
                : "این نظر از فهرست عمومی و از میانگین امتیاز خارج می‌شود."}
            </p>
          }
          confirmLabel={pending.action === "delete" ? "حذف نظر" : "پنهان‌سازی"}
          destructive
          busy={moderate.isPending}
          onClose={() => setPending(null)}
          onConfirm={(reason) => run(pending.reviewId, pending.action, reason)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status tab (operator lifecycle + verification decision)
// ---------------------------------------------------------------------------

function StatusPanel({
  detail,
  canReview,
  canStatus,
}: {
  detail: AdminLawyerDetail;
  canReview: boolean;
  canStatus: boolean;
}) {
  const setStatus = useSetAdminLawyerStatus();
  const decide = useDecideLawyerVerification();
  const [lifecyclePending, setLifecyclePending] = useState<AdminLawyerStatus | null>(null);
  const [verifyPending, setVerifyPending] = useState<(typeof DECISIONS)[number] | null>(null);

  const current = detail.lifecycle;
  const wasDeleted = current === "DELETED";

  async function applyLifecycle(status: AdminLawyerStatus, reason?: string) {
    try {
      await setStatus.mutateAsync({ id: detail.profile.id, status, reason });
      snackbar.show({
        message: `وضعیت وکیل به «${ADMIN_LAWYER_STATUS_FA[status]}» تغییر کرد.`,
        variant: "success",
      });
      setLifecyclePending(null);
    } catch (err) {
      snackbar.show({ message: errMessage(err, "تغییر وضعیت ناموفق بود"), variant: "error" });
    }
  }

  async function confirmVerify(reason: string) {
    if (!verifyPending) return;
    try {
      await decide.mutateAsync({ id: detail.profile.id, status: verifyPending.status, reason });
      snackbar.show({
        message: `وضعیت تأیید به «${LAWYER_VERIFICATION_FA[verifyPending.status]}» تغییر کرد.`,
        variant: "success",
      });
      setVerifyPending(null);
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ثبت تصمیم ناموفق بود"), variant: "error" });
    }
  }

  const activeAction = lifecyclePending
    ? LIFECYCLE_ACTIONS.find((a) => a.status === lifecyclePending)
    : null;

  return (
    <div className="space-y-4">
      <Block title="وضعیت چرخهٔ عمر (پنل ادمین)">
        <div className="flex items-center gap-2">
          <span className="text-body-2 text-muted">وضعیت فعلی:</span>
          <Badge tone={LIFECYCLE_TONES[current]} dot>
            {ADMIN_LAWYER_STATUS_FA[current]}
          </Badge>
          {wasDeleted && detail.profile.deletedAt && (
            <span className="text-caption text-muted">
              حذف‌شده در {toPersianDate(detail.profile.deletedAt)}
            </span>
          )}
        </div>

        {canStatus ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {LIFECYCLE_ACTIONS.map((a) => {
              const isRestore = wasDeleted && a.status === "ACTIVE";
              const disabled = a.status === current || setStatus.isPending;
              return (
                <Button
                  key={a.status}
                  size="sm"
                  variant={a.destructive ? "danger" : a.status === "ACTIVE" ? "primary" : "secondary"}
                  disabled={disabled}
                  title={a.help}
                  onClick={() =>
                    a.needsReason ? setLifecyclePending(a.status) : applyLifecycle(a.status)
                  }
                >
                  {isRestore ? "بازگردانی" : a.label}
                </Button>
              );
            })}
          </div>
        ) : (
          <InfoBanner tone="warning">شما مجوز تغییر وضعیت وکلا را ندارید.</InfoBanner>
        )}
      </Block>

      <Block title="تصمیم تأیید (نمایش در سایت عمومی)">
        <Row label="وضعیت تأیید" value={LAWYER_VERIFICATION_FA[detail.profile.verificationStatus]} />
        {detail.profile.verificationNote && (
          <div className="mt-1 rounded-medium border border-divider bg-surface-container-low p-2 text-caption text-on-surface-variant">
            یادداشت: {detail.profile.verificationNote}
          </div>
        )}
        {canReview && (
          <div className="mt-3 flex flex-wrap gap-2">
            {DECISIONS.map((d) => (
              <Button
                key={d.status}
                size="sm"
                variant={d.destructive ? "danger" : "primary"}
                disabled={detail.profile.verificationStatus === d.status || decide.isPending}
                onClick={() => setVerifyPending(d)}
              >
                {d.label}
              </Button>
            ))}
          </div>
        )}
      </Block>

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
                    {LAWYER_VERIFICATION_FA[h.previousStatus]} → {LAWYER_VERIFICATION_FA[h.newStatus]}
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

      {activeAction && (
        <ReasonDialog
          title={`${activeAction.label} وکیل`}
          description={
            <p>
              وضعیت «{detail.profile.fullName}» به «{ADMIN_LAWYER_STATUS_FA[activeAction.status]}»
              تغییر می‌کند. {activeAction.help}
            </p>
          }
          confirmLabel={`ثبت ${activeAction.label}`}
          destructive={activeAction.destructive}
          busy={setStatus.isPending}
          onClose={() => setLifecyclePending(null)}
          onConfirm={(reason) => applyLifecycle(activeAction.status, reason)}
        />
      )}

      {verifyPending && (
        <ReasonDialog
          title={`${verifyPending.label} وکیل`}
          description={
            <p>
              وضعیت تأیید «{detail.profile.fullName}» به «
              {LAWYER_VERIFICATION_FA[verifyPending.status]}» تغییر می‌کند. {verifyPending.help}
            </p>
          }
          confirmLabel={`ثبت ${verifyPending.label}`}
          destructive={verifyPending.destructive}
          busy={decide.isPending}
          onClose={() => setVerifyPending(null)}
          onConfirm={confirmVerify}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit tab (full profile PATCH)
// ---------------------------------------------------------------------------

function ProfileEditForm({ detail, canEdit }: { detail: AdminLawyerDetail; canEdit: boolean }) {
  const update = useUpdateAdminLawyer();
  const p = detail.profile;

  const [fullName, setFullName] = useState(p.fullName);
  const [professionalTitle, setProfessionalTitle] = useState(p.professionalTitle ?? "");
  const [bio, setBio] = useState(p.bio);
  const [professionalRank, setProfessionalRank] = useState<LawyerProfessionalRank | "">(
    p.professionalRank ?? ""
  );
  const [organizationType, setOrganizationType] = useState<LawyerOrganizationType | "">(
    p.organizationType ?? ""
  );
  const [licenseNumber, setLicenseNumber] = useState(p.licenseNumber ?? "");
  const [licenseYear, setLicenseYear] = useState(p.licenseYear?.toString() ?? "");
  const [licenseAuthority, setLicenseAuthority] = useState(p.licenseAuthority ?? "");
  const [licenseStatus, setLicenseStatus] = useState<LawyerLicenseStatus | "">(
    p.licenseStatus ?? ""
  );
  const [gender, setGender] = useState<LawyerGender | "">(p.gender ?? "");
  const [yearsExperience, setYearsExperience] = useState(p.yearsExperience?.toString() ?? "");
  const [visibility, setVisibility] = useState<LawyerMarketplaceVisibility>(
    p.visibility ?? "PUBLIC"
  );
  const [acceptingClients, setAcceptingClients] = useState(p.acceptingClients ?? true);
  const [serviceIds, setServiceIds] = useState<string[]>(
    (p.services ?? []).filter((s) => s.enabled).map((s) => s.serviceId)
  );
  const [jurisdictionIds, setJurisdictionIds] = useState<string[]>(p.jurisdictions ?? []);
  const [expertise, setExpertise] = useState<LawyerExpertise[]>(p.expertise ?? []);
  const [addNodeId, setAddNodeId] = useState("");

  // Re-seed the form whenever the drawer loads a different lawyer.
  useEffect(() => {
    setFullName(p.fullName);
    setProfessionalTitle(p.professionalTitle ?? "");
    setBio(p.bio);
    setProfessionalRank(p.professionalRank ?? "");
    setOrganizationType(p.organizationType ?? "");
    setLicenseNumber(p.licenseNumber ?? "");
    setLicenseYear(p.licenseYear?.toString() ?? "");
    setLicenseAuthority(p.licenseAuthority ?? "");
    setLicenseStatus(p.licenseStatus ?? "");
    setGender(p.gender ?? "");
    setYearsExperience(p.yearsExperience?.toString() ?? "");
    setVisibility(p.visibility ?? "PUBLIC");
    setAcceptingClients(p.acceptingClients ?? true);
    setServiceIds((p.services ?? []).filter((s) => s.enabled).map((s) => s.serviceId));
    setJurisdictionIds(p.jurisdictions ?? []);
    setExpertise(p.expertise ?? []);
    setAddNodeId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  const specialtyNodes = useMemo(() => taxonomyByType("SPECIALTY"), []);

  function toggle(list: string[], id: string, setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function addExpertise() {
    if (!addNodeId) return;
    if (expertise.some((e) => e.taxonomyNodeId === addNodeId)) return;
    setExpertise([
      ...expertise,
      {
        id: `local-${addNodeId}`,
        lawyerId: p.id,
        taxonomyNodeId: addNodeId,
        isPrimary: expertise.length === 0,
        yearsExperience: Number(yearsExperience) || 0,
        caseCount: 0,
        displayOrder: expertise.length,
        note: null,
      },
    ]);
    setAddNodeId("");
  }

  function removeExpertise(nodeId: string) {
    const next = expertise.filter((e) => e.taxonomyNodeId !== nodeId);
    // Guarantee exactly one primary survives.
    const marked = next.map((e, i) => ({
      ...e,
      isPrimary: i === 0 ? true : e.isPrimary,
      displayOrder: i,
    }));
    setExpertise(marked);
  }

  function setPrimary(nodeId: string) {
    setExpertise(expertise.map((e) => ({ ...e, isPrimary: e.taxonomyNodeId === nodeId })));
  }

  async function save() {
    const yearNum = licenseYear.trim() === "" ? null : Number(licenseYear);
    const yearsNum = yearsExperience.trim() === "" ? null : Number(yearsExperience);
    if (yearNum !== null && !Number.isInteger(yearNum)) {
      snackbar.show({ message: "سال صدور پروانه نامعتبر است", variant: "error" });
      return;
    }
    if (yearsNum !== null && (!Number.isInteger(yearsNum) || yearsNum < 0)) {
      snackbar.show({ message: "سابقهٔ کار نامعتبر است", variant: "error" });
      return;
    }

    const patch: AdminLawyerPatchInput = {
      fullName: fullName.trim(),
      professionalTitle: professionalTitle.trim() || null,
      bio: bio.trim(),
      professionalRank: professionalRank || null,
      organizationType: organizationType || null,
      licenseNumber: licenseNumber.trim() || null,
      licenseYear: yearNum,
      licenseAuthority: licenseAuthority.trim() || null,
      licenseStatus: licenseStatus || null,
      gender: gender || null,
      yearsExperience: yearsNum,
      visibility,
      acceptingClients,
      expertise,
      serviceIds,
      jurisdictionIds,
    };

    try {
      await update.mutateAsync({ id: p.id, patch });
      snackbar.show({ message: "پروفایل به‌روزرسانی شد.", variant: "success" });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ذخیرهٔ پروفایل ناموفق بود"), variant: "error" });
    }
  }

  if (!canEdit) {
    return <InfoBanner tone="warning">شما مجوز ویرایش پروفایل وکلا را ندارید.</InfoBanner>;
  }

  return (
    <div className="space-y-4">
      <Block title="هویت">
        <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
          <Field label="نام کامل">
            <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="عنوان حرفه‌ای">
            <TextInput
              value={professionalTitle}
              onChange={(e) => setProfessionalTitle(e.target.value)}
              placeholder="مثلاً وکیل پایه یک دادگستری"
            />
          </Field>
          <Field label="پایهٔ وکالت">
            <Select
              value={professionalRank}
              onChange={(e) => setProfessionalRank(e.target.value as LawyerProfessionalRank | "")}
            >
              <option value="">—</option>
              {LAWYER_PROFESSIONAL_RANKS.map((r) => (
                <option key={r} value={r}>
                  {LAWYER_PROFESSIONAL_RANK_FA[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="سازمان صادرکننده">
            <Select
              value={organizationType}
              onChange={(e) => setOrganizationType(e.target.value as LawyerOrganizationType | "")}
            >
              <option value="">—</option>
              {LAWYER_ORGANIZATION_TYPES.map((o) => (
                <option key={o} value={o}>
                  {LAWYER_ORGANIZATION_TYPE_FA[o]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="جنسیت (نمایشی)">
            <Select value={gender} onChange={(e) => setGender(e.target.value as LawyerGender | "")}>
              <option value="">—</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {LAWYER_GENDER_FA[g]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="سابقهٔ کار (سال)">
            <TextInput
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              dir="ltr"
              inputMode="numeric"
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="دربارهٔ وکیل (Bio)">
            <TextArea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
          </Field>
        </div>
      </Block>

      <Block title="پروانه و بازار">
        <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
          <Field label="شمارهٔ پروانه">
            <TextInput
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              dir="ltr"
            />
          </Field>
          <Field label="سال صدور">
            <TextInput
              value={licenseYear}
              onChange={(e) => setLicenseYear(e.target.value)}
              dir="ltr"
              inputMode="numeric"
            />
          </Field>
          <Field label="مرجع صدور پروانه">
            <TextInput value={licenseAuthority} onChange={(e) => setLicenseAuthority(e.target.value)} />
          </Field>
          <Field label="وضعیت پروانه">
            <Select
              value={licenseStatus}
              onChange={(e) => setLicenseStatus(e.target.value as LawyerLicenseStatus | "")}
            >
              <option value="">—</option>
              {LICENSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LAWYER_LICENSE_STATUS_FA[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="نمایش در بازار">
            <Select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as LawyerMarketplaceVisibility)}
            >
              {VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {LAWYER_VISIBILITY_FA[v]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="پذیرش موکل جدید">
            <label className="flex items-center gap-2 py-2 text-body-2 text-on-surface">
              <input
                type="checkbox"
                checked={acceptingClients}
                onChange={(e) => setAcceptingClients(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              وکیل در حال پذیرش موکل جدید است
            </label>
          </Field>
        </div>
      </Block>

      <Block title={`تخصص‌ها (${toPersianNumber(expertise.length)})`}>
        {expertise.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {expertise.map((e) => (
              <li
                key={e.taxonomyNodeId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-medium border border-divider bg-surface-container-low px-2.5 py-1.5 text-body-2"
              >
                <span className="text-on-surface">{taxonomyPathLabels(e.taxonomyNodeId)}</span>
                <span className="flex items-center gap-1.5">
                  {e.isPrimary ? (
                    <Badge tone="brand">اصلی</Badge>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setPrimary(e.taxonomyNodeId)}>
                      اصلی کن
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => removeExpertise(e.taxonomyNodeId)}>
                    حذف
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="افزودن تخصص (از درخت تخصص‌ها)">
              <Select value={addNodeId} onChange={(e) => setAddNodeId(e.target.value)}>
                <option value="">انتخاب تخصص…</option>
                {specialtyNodes
                  .filter((n) => !expertise.some((e) => e.taxonomyNodeId === n.id))
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {taxonomyPathLabels(n.id)}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <Button variant="secondary" disabled={!addNodeId} onClick={addExpertise}>
            افزودن
          </Button>
        </div>
      </Block>

      <Block title={`خدمات (${toPersianNumber(serviceIds.length)})`}>
        <div className="flex flex-wrap gap-1.5">
          {LAWYER_SERVICES.map((s) => (
            <ToggleChip
              key={s.id}
              active={serviceIds.includes(s.id)}
              onClick={() => toggle(serviceIds, s.id, setServiceIds)}
            >
              {s.nameFa}
            </ToggleChip>
          ))}
        </div>
      </Block>

      <Block title={`مراجع قضایی (${toPersianNumber(jurisdictionIds.length)})`}>
        <div className="flex flex-wrap gap-1.5">
          {LAWYER_JURISDICTIONS.map((j) => (
            <ToggleChip
              key={j.id}
              active={jurisdictionIds.includes(j.id)}
              onClick={() => toggle(jurisdictionIds, j.id, setJurisdictionIds)}
            >
              {j.nameFa}
            </ToggleChip>
          ))}
        </div>
      </Block>

      <div className="flex justify-end">
        <Button variant="primary" disabled={update.isPending} onClick={save}>
          {update.isPending ? "در حال ذخیره…" : "ذخیرهٔ تغییرات پروفایل"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dossier tab (read-only file + decision + message)
// ---------------------------------------------------------------------------

function DossierPanel({ detail }: { detail: AdminLawyerDetail }) {
  const sendMessage = useSendLawyerMessage();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    setSubject("");
    setBody("");
  }, [detail.profile.id]);

  const messageValid = subject.trim().length >= 2 && body.trim().length >= 2;

  async function submitMessage() {
    if (!messageValid) return;
    try {
      await sendMessage.mutateAsync({
        id: detail.profile.id,
        input: { subject: subject.trim(), body: body.trim() },
      });
      snackbar.show({ message: "پیام برای وکیل ارسال شد.", variant: "success" });
      setSubject("");
      setBody("");
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ارسال پیام ناموفق بود"), variant: "error" });
    }
  }

  const p = detail.profile;
  const enabledServices = (p.services ?? []).filter((s) => s.enabled);
  const locations: LawyerLocation[] = p.locations ?? [];

  return (
    <div className="space-y-4">
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

      <Block title="پروانه و مدارک ثبت‌شده">
        <Row
          label="شماره پروانه"
          value={
            p.licenseNumber ? (
              <span dir="ltr" className="tabular-nums">
                {p.licenseNumber}
              </span>
            ) : (
              "—"
            )
          }
        />
        <Row label="مرجع صدور پروانه" value={p.licenseAuthority} />
        <Row label="سال صدور" value={p.licenseYear ? toPersianNumber(p.licenseYear) : "—"} />
        <Row
          label="پایهٔ وکالت"
          value={p.professionalRank ? LAWYER_PROFESSIONAL_RANK_FA[p.professionalRank] : "—"}
        />
        <Row
          label="سازمان"
          value={p.organizationType ? LAWYER_ORGANIZATION_TYPE_FA[p.organizationType] : "—"}
        />
        <Row
          label="وضعیت پروانه"
          value={p.licenseStatus ? LAWYER_LICENSE_STATUS_FA[p.licenseStatus] : "—"}
        />
        <Row
          label="نمایش در بازار"
          value={p.visibility ? LAWYER_VISIBILITY_FA[p.visibility] : "نمایش عمومی"}
        />
        <Row
          label="سابقهٔ کار"
          value={p.yearsExperience != null ? `${toPersianNumber(p.yearsExperience)} سال` : "—"}
        />
        {p.bio && (
          <div className="mt-2 border-t border-divider pt-2 text-body-2 text-on-surface-variant">
            {p.bio}
          </div>
        )}
      </Block>

      <Block title={`تخصص‌ها (${toPersianNumber((p.expertise ?? []).length || p.specializations.length)})`}>
        {(p.expertise ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {p.expertise!.map((e) => (
              <Badge key={e.taxonomyNodeId} tone={e.isPrimary ? "brand" : "info"}>
                {taxonomyPathLabels(e.taxonomyNodeId)}
                {e.isPrimary ? " · اصلی" : ""}
              </Badge>
            ))}
          </div>
        ) : p.specializations.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {p.specializations.map((s) => (
              <Badge key={s.category} tone="info">
                {specialtyLabel(s.category)}
                {s.yearsExperience ? ` · ${toPersianNumber(s.yearsExperience)} سال` : ""}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-body-2 text-muted">تخصصی ثبت نشده است.</p>
        )}
      </Block>

      {enabledServices.length > 0 && (
        <Block title={`خدمات (${toPersianNumber(enabledServices.length)})`}>
          <div className="flex flex-wrap gap-1.5">
            {enabledServices.map((s) => (
              <Badge key={s.serviceId} tone="neutral">
                {lawyerServiceLabel(s.serviceId)}
              </Badge>
            ))}
          </div>
        </Block>
      )}

      {(p.jurisdictions ?? []).length > 0 && (
        <Block title={`مراجع قضایی (${toPersianNumber(p.jurisdictions!.length)})`}>
          <div className="flex flex-wrap gap-1.5">
            {p.jurisdictions!.map((j) => (
              <Badge key={j} tone="neutral">
                {jurisdictionLabel(j)}
              </Badge>
            ))}
          </div>
        </Block>
      )}

      <Block title="محل فعالیت">
        {locations.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {locations.map((loc, i) => (
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

      <Block title="وضعیت و زمان‌ها">
        <Row label="تاریخ ثبت‌نام" value={toPersianDate(p.createdAt)} />
        <Row label="آخرین بروزرسانی" value={toPersianDate(p.updatedAt)} />
        <Row
          label="آخرین تغییر وضعیت"
          value={detail.lastDecision ? toPersianDate(detail.lastDecision.createdAt) : "—"}
        />
        <Row label="تصمیم‌گیرنده" value={detail.lastDecision ? detail.lastDecision.actorName : "—"} />
      </Block>

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
    </div>
  );
}

// ---------------------------------------------------------------------------
// The drawer
// ---------------------------------------------------------------------------

type DrawerTab = "dossier" | "edit" | "avatar" | "rating" | "reviews" | "status";

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
  const { can } = useAdminMe();
  const [tab, setTab] = useState<DrawerTab>("dossier");

  // Reset to the dossier tab whenever a different lawyer is opened.
  useEffect(() => {
    if (open) setTab("dossier");
  }, [lawyerId, open]);

  const detail = query.data;

  const canEdit = can("admin:lawyer:update");
  const canAvatar = can("admin:lawyer:avatar:manage");
  const canRating = can("admin:lawyer:rating:manage");
  const canReviewManage = can("admin:lawyer:review:manage");
  const canStatus = can("admin:lawyer:status") || can("admin:lawyer:suspend") || can("admin:lawyer:delete");

  return (
    <Drawer open={open} onClose={onClose} position="end" width={720} title="پرونده وکیل">
      {query.isLoading && <LoadingBlock rows={6} />}
      {query.isError && <ErrorBlock onRetry={() => query.refetch()} />}

      {detail && (
        <div className="space-y-4">
          {/* Identity header (always visible above the tabs) */}
          <div>
            <div className="flex items-center gap-3">
              <LawyerAvatar
                name={detail.profile.fullName}
                avatarUrl={detail.profile.avatarUrl}
                avatarType={detail.profile.avatarType}
                size={56}
              />
              <div className="min-w-0 flex-1">
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
                  <Badge tone={LIFECYCLE_TONES[detail.lifecycle]} dot>
                    {ADMIN_LAWYER_STATUS_FA[detail.lifecycle]}
                  </Badge>
                  {detail.profile.featured && <Badge tone="brand">برجسته</Badge>}
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
            </div>
          </div>

          <Tabs<DrawerTab>
            ariaLabel="بخش‌های پرونده وکیل"
            value={tab}
            onChange={setTab}
            items={[
              { value: "dossier", label: "پرونده" },
              { value: "edit", label: "ویرایش" },
              { value: "avatar", label: "آواتار" },
              { value: "rating", label: "امتیاز" },
              { value: "reviews", label: "نظرات", badge: detail.stats.reviews },
              { value: "status", label: "وضعیت" },
            ]}
          />

          {tab === "dossier" && <DossierPanel detail={detail} />}
          {tab === "edit" && <ProfileEditForm detail={detail} canEdit={canEdit} />}
          {tab === "avatar" && <AvatarPanel detail={detail} canManage={canAvatar} />}
          {tab === "rating" && <RatingPanel detail={detail} canManage={canRating} />}
          {tab === "reviews" && <ReviewsPanel detail={detail} canManage={canReviewManage} />}
          {tab === "status" && (
            <StatusPanel detail={detail} canReview={canReview} canStatus={canStatus} />
          )}
        </div>
      )}
    </Drawer>
  );
}
