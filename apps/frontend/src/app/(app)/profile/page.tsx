// ============================================================
// LEGALIR — Account Hub (تنظیمات و پروفایل)
// One cohesive Profile Summary (identity at a glance: avatar,
// display name, completion, account type, verified mobile) + a
// Profile Details checklist that shows exactly what is complete
// and where to edit. Editing happens in a single, clear dialog;
// the avatar is chosen from presets or uploaded. The mobile and
// account type live in the summary; the mobile is read-only.
// ============================================================

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  useMe,
  useUpdateProfile,
  useDailyQuota,
  useUploadUserAvatar,
  useDeleteUserAvatar,
} from "@/hooks/useDashboard";
import { useProfileUsage, useSubscriptionHistory, useMemories } from "@/hooks/usePhase11";
import { SubscriptionStatusDetails } from "@/components/subscription/subscription-status";
import { useUpdateAccountType } from "@/hooks/useAccount";
import { useOrganizations } from "@/hooks/useOnboarding";
import { useDocuments } from "@/hooks/useDocuments";
import { useContracts } from "@/hooks/useContracts";
import { useConsultations } from "@/hooks/useConsultations";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import { JalaliDatePicker, formatJalaliLong } from "@/components/shared/JalaliDatePicker";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import {
  computeProfileCompletion,
  BASIC_PROFILE_FIELDS,
  EXTENDED_PROFILE_FIELDS,
  type BasicProfileField,
  type ExtendedProfileField,
} from "@/lib/profile-completion";
import {
  AVATAR_PRESETS,
  presetToken,
  parsePresetToken,
  isUploadedAvatar,
  renderPresetAvatarSrc,
} from "@/lib/avatars/presets";
import {
  IconChat,
  IconDocument,
  IconContract,
  IconHistory,
  IconMemory,
  IconSubscription,
  IconSettings,
  IconShield,
  IconPhone,
  IconPerson,
  IconCheck,
  IconCheckCircle,
  IconEdit,
  IconArrowBack,
  IconStar,
  IconLawBook,
  IconInfo,
  IconBalance,
  IconUpload,
  IconDelete,
  IconWarning,
} from "@/lib/icons";
import type { Profile, V1SubscriptionHistoryItem, PlatformAccountType } from "@legalir/types";
import {
  ACCOUNT_TYPE_FA,
  ACCOUNT_TYPE_DESCRIPTION_FA,
  ORG_MEMBER_ROLE_FA,
  ORGANIZATION_STATUS_FA,
  ORGANIZATION_LEGAL_TYPE_FA,
} from "@legalir/types";
import {
  Select,
  TextField,
  SelectableOption,
  SelectableCard,
  Dialog,
  ConfirmDialog,
  Button,
  snackbar,
} from "@legalir/ui";

// ============================================================
// Helpers
// ============================================================

function getInitial(name: string | null): string {
  if (!name || name.trim().length === 0) return "ک";
  return name.trim().charAt(0);
}

function formatMobile(mobile: string | undefined): string {
  if (!mobile) return "۰۹-- --- ----";
  return mobile.replace(/[0-9]/g, (d) =>
    ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"][parseInt(d)] ?? d,
  );
}

const GENDER_OPTIONS = [
  { value: "", label: "انتخاب نشده" },
  { value: "male", label: "مرد" },
  { value: "female", label: "زن" },
  { value: "other", label: "سایر" },
] as const;

const USER_TYPE_OPTIONS = [
  { value: "", label: "انتخاب نشده" },
  { value: "personal", label: "شخصی" },
  { value: "business", label: "کسب‌وکار / سازمان" },
] as const;

const LEGAL_INTEREST_OPTIONS = [
  "قراردادها",
  "املاک",
  "خانواده",
  "تجارت",
  "مطالبات",
  "کار",
  "سایر",
] as const;

const PRIMARY_USE_CASE_OPTIONS = [
  { value: "", label: "انتخاب نشده" },
  { value: "consultation", label: "مشاوره حقوقی" },
  { value: "contract_review", label: "بررسی قرارداد" },
  { value: "contract_drafting", label: "ساخت قرارداد" },
  { value: "document_analysis", label: "تحلیل سند" },
  { value: "legal_education", label: "آموزش حقوقی" },
  { value: "legal_management", label: "مدیریت امور حقوقی" },
] as const;

const IRAN_PROVINCES = [
  "تهران", "البرز", "اصفهان", "فارس", "خراسان رضوی", "خوزستان", "آذربایجان شرقی",
  "آذربایجان غربی", "گیلان", "مازندران", "کرمان", "یزد", "قم", "قزوین", "زنجان",
  "همدان", "کردستان", "کرمانشاه", "لرستان", "مرکزی", "سمنان", "گلستان", "اردبیل",
  "بوشهر", "هرمزگان", "چهارمحال و بختیاری", "کهگیلویه و بویراحمد", "ایلام",
  "خراسان شمالی", "خراسان جنوبی", "سیستان و بلوچستان",
] as const;

function persianCount(n: number | undefined): string {
  return toPersianNumber(n ?? 0);
}

/** Persian labels for the completion checklist, keyed by the single-source fields. */
const BASIC_FIELD_LABELS: Record<BasicProfileField, string> = {
  displayName: "نام نمایشی",
  city: "شهر",
  occupation: "شغل",
  email: "ایمیل",
  birthDate: "تاریخ تولد",
};

const EXTENDED_FIELD_LABELS: Record<ExtendedProfileField, string> = {
  userType: "نوع کاربر",
  province: "استان",
  legalInterests: "حوزه‌های حقوقی مورد نیاز",
  primaryUseCase: "هدف اصلی استفاده",
};

// ============================================================
// Avatar resolution — one image source for every surface
// ============================================================
// A profile avatarUrl is one of three things:
//   • null            → no avatar (fall back to the initial)
//   • "preset:<id>"   → one of the built-in vector presets
//   • "/api/...|http" → an uploaded portrait served by the API
// resolveAvatarSrc collapses all three into a single `<img src>`.

function resolveAvatarSrc(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("data:")) return avatarUrl;
  const presetId = parsePresetToken(avatarUrl);
  if (presetId) return renderPresetAvatarSrc(presetId);
  return avatarUrl;
}

/** Round avatar image, or the letter initial when no avatar is set. */
function AvatarBadge({
  src,
  initial,
  size = 72,
  className = "",
}: {
  src: string | null;
  initial: string;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover bg-white ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-white text-primary-700 font-bold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

// ============================================================
// Profile draft — the editable slice of the profile
// ============================================================
// One flat object holds every field the profile form can change.
// Seeding it from the server profile and comparing it back is
// what tells the form whether «ذخیره تغییرات» should be enabled.

interface ProfileDraft {
  displayName: string;
  email: string;
  gender: string;
  birthDate: string;
  city: string;
  occupation: string;
  userType: string;
  province: string;
  legalInterests: string[];
  primaryUseCase: string;
}

function draftFromProfile(profile: Profile | null): ProfileDraft {
  return {
    displayName: profile?.displayName ?? "",
    email: profile?.email ?? "",
    gender: profile?.gender ?? "",
    birthDate: profile?.birthDate ?? "",
    city: profile?.city ?? "",
    occupation: profile?.occupation ?? "",
    userType: profile?.userType ?? "",
    province: profile?.province ?? "",
    legalInterests: profile?.legalInterests ?? [],
    primaryUseCase: profile?.primaryUseCase ?? "",
  };
}

// ============================================================
// Circular Progress Ring
// ============================================================

function CircularRing({ pct, size = 64, strokeWidth = 5, color }: {
  pct: number; size?: number; strokeWidth?: number; color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" className="text-white/25" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700" />
      </svg>
    </div>
  );
}

// ============================================================
// Completion checklist — «what is done, what is missing»
// ============================================================
// Derived from the single-source completion model, so the list
// can never disagree with the percentage shown in the summary.

function CheckRow({ done, label, value }: { done: boolean; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-divider/60 last:border-b-0">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          done ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-300"
        }`}
        aria-hidden="true"
      >
        {done ? <IconCheck size={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />}
      </span>
      <span className="min-w-0 flex-1 text-body-2 text-onSurface">{label}</span>
      <span
        className={`shrink-0 max-w-[55%] truncate text-caption ${
          done ? "text-muted" : "text-amber-700 font-medium"
        }`}
        dir="auto"
      >
        {done ? (value || "تکمیل شده") : "تکمیل نشده"}
      </span>
    </div>
  );
}

function CompletionChecklist({ profile, onEdit }: { profile: Profile | null; onEdit: () => void }) {
  const completion = useMemo(
    () =>
      computeProfileCompletion({
        displayName: profile?.displayName ?? null,
        city: profile?.city ?? null,
        occupation: profile?.occupation ?? null,
        email: profile?.email ?? null,
        birthDate: profile?.birthDate ?? null,
        userType: profile?.userType ?? null,
        province: profile?.province ?? null,
        legalInterests: profile?.legalInterests ?? null,
        primaryUseCase: profile?.primaryUseCase ?? null,
      }),
    [profile],
  );

  const values: Record<string, string | undefined> = useMemo(() => {
    const birthParsed = profile?.birthDate
      ? /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(profile.birthDate.trim())
      : null;
    return {
      displayName: profile?.displayName ?? undefined,
      city: profile?.city ?? undefined,
      occupation: profile?.occupation ?? undefined,
      email: profile?.email ?? undefined,
      birthDate: birthParsed
        ? formatJalaliLong(parseInt(birthParsed[1]!, 10), parseInt(birthParsed[2]!, 10), parseInt(birthParsed[3]!, 10))
        : undefined,
      userType: USER_TYPE_OPTIONS.find((o) => o.value === profile?.userType)?.label,
      province: profile?.province ?? undefined,
      legalInterests: profile?.legalInterests?.length
        ? `${toPersianNumber(profile.legalInterests.length)} مورد`
        : undefined,
      primaryUseCase: PRIMARY_USE_CASE_OPTIONS.find((o) => o.value === profile?.primaryUseCase)?.label,
    };
  }, [profile]);

  const doneFields = (fields: readonly string[]) =>
    fields.filter((f) => !(completion.basicProfile.missingFields.includes(f) ||
      completion.extendedProfile.missingFields.includes(f)));

  const basicDone = doneFields(BASIC_PROFILE_FIELDS);
  const extendedDone = doneFields(EXTENDED_PROFILE_FIELDS);

  return (
    <div>
      {/* Always-visible progress bar — the user sees where they stand
          without expanding anything. */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-caption">
          <span className="text-muted">
            {completion.rounded >= 100 ? "پروفایل شما کامل است" : `${toPersianNumber(completion.rounded)}٪ تکمیل شده`}
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary-800 transition-colors touch-target"
          >
            <IconEdit size={14} />
            تکمیل و ویرایش
          </button>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full transition-all duration-700 ${completion.rounded >= 100 ? "bg-emerald-500" : "bg-primary"}`}
            style={{ width: `${completion.percentage}%` }}
          />
        </div>
      </div>

      <h3 className="mb-1 text-body-1 font-semibold text-onSurface">اطلاعات پایه</h3>
      <p className="mb-1 text-caption text-muted">
        {toPersianNumber(basicDone.length)} از {toPersianNumber(BASIC_PROFILE_FIELDS.length)} مورد تکمیل شده
      </p>
      <div>
        {BASIC_PROFILE_FIELDS.map((field) => (
          <CheckRow
            key={field}
            done={!completion.basicProfile.missingFields.includes(field)}
            label={BASIC_FIELD_LABELS[field]}
            value={values[field]}
          />
        ))}
      </div>

      <h3 className="mt-6 mb-1 text-body-1 font-semibold text-onSurface">پروفایل حقوقی من</h3>
      <p className="mb-1 text-caption text-muted">
        با تکمیل این بخش، پروفایل شما به ۱۰۰٪ می‌رسد و امتیاز ویژه دریافت می‌کنید.
      </p>
      <div>
        {EXTENDED_PROFILE_FIELDS.map((field) => (
          <CheckRow
            key={field}
            done={!completion.extendedProfile.missingFields.includes(field)}
            label={EXTENDED_FIELD_LABELS[field]}
            value={values[field]}
          />
        ))}
      </div>
      <p className="mt-1 text-caption text-muted">
        {toPersianNumber(extendedDone.length)} از {toPersianNumber(EXTENDED_PROFILE_FIELDS.length)} مورد تکمیل شده
      </p>
    </div>
  );
}

// ============================================================
// Profile edit dialog — one clear form, no nesting
// ============================================================
// A single dialog holds every editable field. Changes are saved as
// one request; closing with unsaved changes asks for confirmation.

function ProfileEditDialog({
  open,
  onClose,
  profile,
  saving,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  saving: boolean;
  onSave: (draft: ProfileDraft) => Promise<void>;
}) {
  const savedDraft = useMemo(() => draftFromProfile(profile), [profile]);
  const [draft, setDraft] = useState<ProfileDraft>(savedDraft);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Re-seed whenever the dialog opens so it always starts from saved values.
  useEffect(() => {
    if (open) {
      setDraft(savedDraft);
      setConfirmDiscard(false);
    }
  }, [open, savedDraft]);

  const patch = useCallback(
    <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
      setDraft((d) => ({ ...d, [key]: value })),
    [],
  );

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedDraft),
    [draft, savedDraft],
  );

  const emailError = useMemo(() => {
    const email = draft.email.trim();
    if (!email) return undefined;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? undefined
      : "ایمیل معتبر نیست";
  }, [draft.email]);

  const nameError = useMemo(() => {
    if (draft.displayName.trim().length > 60) return "نام نمایشی حداکثر ۶۰ نویسه است";
    return undefined;
  }, [draft.displayName]);

  const canSave = isDirty && !emailError && !nameError && !saving;

  const requestClose = useCallback(() => {
    if (saving) return;
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  }, [saving, isDirty, onClose]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    await onSave({
      ...draft,
      displayName: draft.displayName.trim(),
      email: draft.email.trim(),
      city: draft.city.trim(),
      occupation: draft.occupation.trim(),
    });
  }, [canSave, draft, onSave]);

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        title="ویرایش پروفایل"
        description="اطلاعات پروفایل خود را ویرایش کنید. شماره موبایل قابل تغییر نیست."
        maxWidth="2xl"
        actions={
          <>
            <Button variant="text" onClick={requestClose} disabled={saving}>
              انصراف
            </Button>
            <Button
              variant="filled"
              onClick={handleSave}
              loading={saving}
              disabled={!canSave}
              startIcon={<IconCheck size={18} />}
            >
              ذخیره تغییرات
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="mb-3 text-body-1 font-semibold text-onSurface">اطلاعات پایه</h3>
            <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
              <TextField
                label="نام نمایشی"
                value={draft.displayName}
                onChange={(e) => patch("displayName", e.target.value)}
                placeholder="نامی که می‌خواهید نمایش داده شود"
                errorMessage={nameError}
                supportingText="این نام در پروفایل و بخش‌های مختلف نمایش داده می‌شود."
                fullWidth
              />
              <TextField
                label="ایمیل"
                type="email"
                value={draft.email}
                onChange={(e) => patch("email", e.target.value)}
                placeholder="you@example.com"
                inputDir="ltr"
                errorMessage={emailError}
                fullWidth
              />
              <Select
                label="جنسیت"
                value={draft.gender}
                onChange={(e) => patch("gender", e.target.value)}
                fullWidth
                options={GENDER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-caption text-muted">تاریخ تولد</span>
                <JalaliDatePicker
                  value={draft.birthDate}
                  onChange={(v) => patch("birthDate", v)}
                  minYear={1300}
                  maxYear={1405}
                  defaultYear={1365}
                  showSelected
                />
              </div>
              <TextField
                label="شهر"
                value={draft.city}
                onChange={(e) => patch("city", e.target.value)}
                placeholder="شهر محل سکونت"
                fullWidth
              />
              <TextField
                label="شغل"
                value={draft.occupation}
                onChange={(e) => patch("occupation", e.target.value)}
                placeholder="شغل خود را وارد کنید"
                fullWidth
              />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-body-1 font-semibold text-onSurface">پروفایل حقوقی من</h3>
            <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
              <Select
                label="نوع کاربر"
                value={draft.userType}
                onChange={(e) => patch("userType", e.target.value)}
                fullWidth
                options={USER_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
              <Select
                label="استان"
                value={draft.province}
                onChange={(e) => patch("province", e.target.value)}
                fullWidth
                options={IRAN_PROVINCES.map((p) => ({ value: p, label: p }))}
              />
            </div>
            <div className="mt-4">
              <span className="mb-2 block text-caption text-muted">حوزه‌های حقوقی مورد نیاز</span>
              <div className="flex flex-wrap gap-2">
                {LEGAL_INTEREST_OPTIONS.map((opt) => {
                  const active = draft.legalInterests.includes(opt);
                  return (
                    <SelectableOption
                      key={opt}
                      label={opt}
                      selected={active}
                      onClick={() =>
                        patch(
                          "legalInterests",
                          active
                            ? draft.legalInterests.filter((v) => v !== opt)
                            : [...draft.legalInterests, opt],
                        )
                      }
                    />
                  );
                })}
              </div>
            </div>
            <div className="mt-4">
              <Select
                label="هدف اصلی استفاده"
                value={draft.primaryUseCase}
                onChange={(e) => patch("primaryUseCase", e.target.value)}
                fullWidth
                options={PRIMARY_USE_CASE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
            </div>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        title="تغییرات ذخیره نشده"
        description="تغییرات شما ذخیره نشده است. آیا می‌خواهید بدون ذخیره خارج شوید؟"
        confirmLabel="خروج بدون ذخیره"
        cancelLabel="ادامه ویرایش"
        destructive
      />
    </>
  );
}

// ============================================================
// Avatar dialog — pick a preset or upload a portrait
// ============================================================

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB — mirrors the server cap

function AvatarDialog({
  open,
  onClose,
  profile,
  onUpload,
  onDelete,
  onSelectPreset,
  uploading,
  deleting,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  onUpload: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
  onSelectPreset: (id: string) => Promise<void>;
  uploading: boolean;
  deleting: boolean;
}) {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = uploading || deleting;

  // Seed the selection from the saved avatar each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setPresetId(parsePresetToken(profile?.avatarUrl ?? null));
    setPendingFile(null);
    setPreviewUrl(null);
    setError(null);
  }, [open, profile?.avatarUrl]);

  // Release the object URL when it changes or the dialog closes.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const uploadedSrc = isUploadedAvatar(profile?.avatarUrl) ? profile?.avatarUrl ?? null : null;
  const previewSrc =
    previewUrl ?? (presetId ? renderPresetAvatarSrc(presetId) : null) ?? uploadedSrc;

  const handleFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
      setError("فرمت تصویر پشتیبانی نمی‌شود؛ فقط PNG، JPEG یا WebP مجاز است.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("حجم تصویر بیش از حد مجاز است (حداکثر ۲ مگابایت).");
      return;
    }
    setError(null);
    setPresetId(null);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    try {
      if (pendingFile) {
        await onUpload(pendingFile);
      } else if (presetId) {
        await onSelectPreset(presetId);
      }
      onClose();
    } catch {
      setError("ذخیرهٔ تصویر ناموفق بود. دوباره تلاش کنید.");
    }
  }, [pendingFile, presetId, onUpload, onSelectPreset, onClose]);

  const handleDelete = useCallback(async () => {
    setError(null);
    try {
      await onDelete();
      onClose();
    } catch {
      setError("حذف تصویر ناموفق بود. دوباره تلاش کنید.");
    }
  }, [onDelete, onClose]);

  const hasAvatar = Boolean(profile?.avatarUrl);

  return (
    <Dialog
      open={open}
      // `persistent` already blocks backdrop-click and Escape while a save is
      // in flight, so the plain handler is safe to pass.
      onClose={onClose}
      title="تصویر پروفایل"
      description="یک تصویر آماده انتخاب کنید یا تصویر خود را بارگذاری کنید."
      maxWidth="lg"
      persistent={busy}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button
            variant="filled"
            onClick={handleSave}
            loading={busy}
            disabled={busy || (!pendingFile && !presetId)}
          >
            ذخیره تصویر
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-6">
        {/* Live preview */}
        <div className="relative">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-surface shadow-elevation-2 ring-1 ring-divider/60">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc} alt="پیش‌نمایش تصویر پروفایل" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-neutral-100 text-neutral-300" aria-hidden="true">
                <IconPerson size={44} />
              </span>
            )}
          </div>
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-scrim/40">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            </span>
          )}
        </div>

        {/* Presets */}
        <div className="w-full">
          <p className="mb-2 text-body-2 font-medium text-onSurface">تصاویر آماده</p>
          <div className="flex flex-wrap justify-center gap-3">
            {AVATAR_PRESETS.map((preset) => {
              const selected = presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setPresetId(preset.id);
                    setPendingFile(null);
                    setPreviewUrl(null);
                    setError(null);
                  }}
                  aria-pressed={selected}
                  aria-label={`تصویر ${preset.label}`}
                  disabled={busy}
                  className={[
                    "flex flex-col items-center gap-1 rounded-xl p-1.5 transition-colors touch-target",
                    selected ? "bg-primary-50 ring-2 ring-primary" : "hover:bg-neutral-100",
                  ].join(" ")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={renderPresetAvatarSrc(preset.id)}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-full ring-1 ring-black/5"
                  />
                  <span className={`text-caption ${selected ? "text-primary-700 font-medium" : "text-muted"}`}>
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Upload */}
        <div className="w-full rounded-xl border border-divider/60 bg-neutral-50 p-4">
          <p className="mb-1 text-body-2 font-medium text-onSurface">بارگذاری تصویر</p>
          <p className="mb-3 text-caption text-muted">
            فرمت‌های مجاز: PNG، JPEG، WebP — حداکثر حجم ۲ مگابایت.
          </p>
          <label
            className={[
              "inline-flex cursor-pointer items-center justify-center gap-2 rounded-medium border border-outline px-4 py-2.5 text-body-2 font-medium text-primary transition-colors touch-target",
              busy ? "pointer-events-none opacity-50" : "hover:bg-primary-50",
            ].join(" ")}
          >
            <IconUpload size={18} />
            انتخاب فایل تصویر
            <input
              type="file"
              accept={ALLOWED_AVATAR_TYPES.join(",")}
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {pendingFile && (
            <p className="mt-2 truncate text-caption text-muted">فایل انتخاب‌شده: {pendingFile.name}</p>
          )}
        </div>

        {error && (
          <p className="flex items-center gap-2 self-start rounded-lg bg-error/10 px-3 py-2 text-caption text-error">
            <IconWarning size={16} />
            {error}
          </p>
        )}

        {hasAvatar && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-caption font-medium text-error transition-colors hover:opacity-80 disabled:opacity-50 touch-target"
          >
            <IconDelete size={16} />
            حذف تصویر و بازگشت به حالت پیش‌فرض
          </button>
        )}
      </div>
    </Dialog>
  );
}

// ============================================================
// Hub UI primitives
// ============================================================

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-h3 text-onSurface font-bold mb-4">
      <span className="text-primary-600">{icon}</span>
      {children}
    </h2>
  );
}

/** A navigational card linking to an existing feature route. */
function HubCard({
  href,
  icon,
  iconClass = "bg-primary-50 text-primary-700",
  title,
  description,
  status,
  statusTone = "neutral",
}: {
  href: string;
  icon: React.ReactNode;
  iconClass?: string;
  title: string;
  description?: string;
  status?: string;
  statusTone?: "primary" | "neutral" | "success" | "amber";
}) {
  const toneClass =
    statusTone === "primary"
      ? "bg-primary-50 text-primary-700 border-primary-200"
      : statusTone === "success"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : statusTone === "amber"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-neutral-100 text-neutral-600 border-neutral-200";

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-divider/60 bg-surface p-4 shadow-elevation-1 transition-all duration-200 hover:border-primary-300 hover:shadow-elevation-3"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass} transition-colors group-hover:bg-primary-100`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-1 text-onSurface font-medium truncate">{title}</span>
        {description && (
          <span className="mt-0.5 block text-caption text-muted truncate">{description}</span>
        )}
      </span>
      {status && (
        <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-caption font-medium ${toneClass}`}>
          {status}
        </span>
      )}
      <IconArrowBack size={18} rtlFlip className="shrink-0 text-neutral-300 transition-all group-hover:text-primary-500 group-hover:-translate-x-0.5" />
    </Link>
  );
}

// ============================================================
// Account Hub Page
// ============================================================

export default function AccountHubPage() {
  const me = useMe();
  const updateProfile = useUpdateProfile();
  const updateAccountType = useUpdateAccountType();
  const organizations = useOrganizations();
  const usage = useProfileUsage();
  const quota = useDailyQuota();
  const subHistory = useSubscriptionHistory();
  const documents = useDocuments({ pageSize: 1 });
  const contracts = useContracts({ pageSize: 1 });
  const consultations = useConsultations();
  const memories = useMemories();
  const uploadAvatarMutation = useUploadUserAvatar();
  const deleteAvatarMutation = useDeleteUserAvatar();

  const [editOpen, setEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const profile = me.data?.profile ?? null;
  const mobile = me.data?.user?.mobileDisplay;
  const accountType = me.data?.user?.accountType ?? "individual";
  // Platform account type (PERSONAL | LAWYER | BUSINESS). Falls back to the
  // legacy field for payloads that predate the platform model.
  const platformAccountType: PlatformAccountType =
    me.data?.user?.platformAccountType ?? (accountType === "legal" ? "BUSINESS" : "PERSONAL");
  const isLawyerAccount = platformAccountType === "LAWYER";
  // The user's active organization (membership-scoped). A user is NEVER a
  // company — an org member keeps their personal identity and represents
  // the entity. When present, the account-type selector is replaced by the
  // organization card + the user's role.
  const activeOrg = organizations.data?.items?.[0] ?? null;
  const usageData = usage.data;
  const subItems: V1SubscriptionHistoryItem[] = subHistory.data?.items ?? [];

  const docCount = documents.data?.pagination?.total ?? documents.data?.items?.length ?? 0;
  const contractCount = contracts.data?.pagination?.total ?? contracts.data?.items?.length ?? 0;
  const memoryCount = memories.data?.items?.length ?? 0;
  const consultationCount = consultations.data?.length ?? 0;

  const completionPct = profile?.completionPercent ?? 0;
  const avatarSrc = resolveAvatarSrc(profile?.avatarUrl);
  const initial = getInitial(profile?.displayName ?? null);

  // Save the whole draft in one request; the response refreshes the `me`
  // cache so the summary and checklist update immediately.
  const handleSaveProfile = useCallback(
    async (draft: ProfileDraft) => {
      setSavingProfile(true);
      try {
        await updateProfile.mutateAsync({
          displayName: draft.displayName || null,
          email: draft.email || null,
          gender: (draft.gender || null) as Profile["gender"],
          birthDate: draft.birthDate || null,
          city: draft.city || null,
          occupation: draft.occupation || null,
          userType: draft.userType || null,
          province: draft.province || null,
          legalInterests: draft.legalInterests.length > 0 ? draft.legalInterests : null,
          primaryUseCase: draft.primaryUseCase || null,
        });
        snackbar.show({ message: "تغییرات پروفایل ذخیره شد", variant: "success" });
        setEditOpen(false);
      } catch {
        snackbar.show({ message: "ذخیرهٔ تغییرات ناموفق بود", variant: "error" });
      } finally {
        setSavingProfile(false);
      }
    },
    [updateProfile],
  );

  const handleSelectPreset = useCallback(
    async (id: string) => {
      await updateProfile.mutateAsync({ avatarUrl: presetToken(id) });
      snackbar.show({ message: "تصویر پروفایل به‌روزرسانی شد", variant: "success" });
    },
    [updateProfile],
  );

  const handleUploadAvatar = useCallback(
    async (file: File) => {
      await uploadAvatarMutation.mutateAsync(file);
      snackbar.show({ message: "تصویر پروفایل به‌روزرسانی شد", variant: "success" });
    },
    [uploadAvatarMutation],
  );

  const handleDeleteAvatar = useCallback(async () => {
    if (isUploadedAvatar(profile?.avatarUrl)) {
      await deleteAvatarMutation.mutateAsync();
    } else {
      await updateProfile.mutateAsync({ avatarUrl: null });
    }
    snackbar.show({ message: "تصویر پروفایل حذف شد", variant: "success" });
  }, [profile?.avatarUrl, deleteAvatarMutation, updateProfile]);

  // Live daily quota (plan-derived) takes precedence over the stored usage row.
  const dailyUsed = quota.data?.used ?? usageData?.dailyRequestsUsed ?? 0;
  const dailyTotal = quota.data?.total ?? usageData?.dailyRequestsTotal ?? 0;
  const dailyRemaining = Math.max(0, dailyTotal - dailyUsed);
  const dailySweep = dailyTotal > 0 ? (dailyRemaining / dailyTotal) * 360 : 0;
  const dailyDash = `${dailySweep} ${360 - dailySweep}`;
  const dailyExhausted = dailyTotal > 0 && dailyRemaining === 0;
  const dailyLow = !dailyExhausted && dailyTotal > 0 && dailyRemaining / dailyTotal <= 0.25;

  const lastPayment = subItems[0] ?? null;

  return (
    <div className="p-4 tablet:p-6 max-w-3xl mx-auto" dir="rtl">
      <Breadcrumb items={[{ label: "داشبورد", href: "/dashboard" }, { label: "پروفایل" }]} />
      <h1 className="text-h2 text-onSurface font-bold mb-6">پروفایل</h1>

      {/* ================================================ */}
      {/* Profile Summary — one cohesive identity section   */}
      {/* (avatar · name · completion · account type · mobile) */}
      {/* ================================================ */}
      <section className="rounded-2xl overflow-hidden border border-divider/60 shadow-elevation-1 mb-6">
        {/* Hero band — identity at a glance */}
        <div className="relative bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 p-6 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative flex items-center gap-5">
            <button
              type="button"
              onClick={() => setAvatarOpen(true)}
              className="group relative shrink-0 rounded-full touch-target"
              aria-label="تغییر تصویر پروفایل"
            >
              <CircularRing pct={completionPct} size={92} strokeWidth={6} color="#10b981" />
              <span className="absolute inset-0 flex items-center justify-center">
                <AvatarBadge src={avatarSrc} initial={initial} size={74} />
              </span>
              <span className="absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary-700 shadow-elevation-2 transition-transform group-hover:scale-105">
                <IconEdit size={15} />
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-h3 text-white font-bold truncate">
                {profile?.displayName ?? "کاربر LEGALIR"}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-caption text-white">
                  <IconBalance size={14} />
                  {accountType === "legal" ? "شخص حقوقی" : "شخص حقیقی"}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption ${
                    completionPct >= 100
                      ? "bg-emerald-400/20 text-emerald-100"
                      : "bg-amber-400/20 text-amber-100"
                  }`}
                >
                  {completionPct >= 100 ? "پروفایل تکمیل است" : `تکمیل پروفایل ${toPersianNumber(completionPct)}٪`}
                </span>
              </div>
              <div className="mt-4">
                <Button
                  variant="tonal"
                  size="small"
                  startIcon={<IconEdit size={16} />}
                  onClick={() => setEditOpen(true)}
                >
                  ویرایش پروفایل
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Identity rows — verified mobile + account type */}
        <div className="bg-surface p-5">
          {/* Verified mobile — read-only, with a short reason */}
          <div className="flex flex-col gap-3 rounded-xl border border-divider/60 bg-neutral-50 p-4 tablet:flex-row tablet:items-center tablet:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                <IconPhone size={18} />
              </span>
              <div>
                <p className="text-caption text-muted">شماره موبایل</p>
                <p className="text-body-1 text-onSurface font-medium tabular-nums" dir="ltr">
                  {formatMobile(mobile)}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-1 tablet:items-end">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-caption font-medium text-emerald-700">
                <IconCheckCircle size={14} />
                تأییدشده
              </span>
              <span className="text-caption text-muted">
                این شماره هنگام ثبت‌نام حساب ثبت شده و قابل تغییر نیست.
              </span>
            </div>
          </div>

          {/* Account type */}
          <div className="mt-4">
            <p className="mb-2 text-body-2 font-semibold text-onSurface">نوع حساب</p>
            {isLawyerAccount ? (
              <div className="flex flex-col gap-1">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-caption text-primary-700">
                  <IconBalance size={14} />
                  {ACCOUNT_TYPE_FA.LAWYER}
                </span>
                <span className="text-caption text-muted">
                  حساب وکیل از طریق پروفایل حرفه‌ای مدیریت می‌شود.
                </span>
              </div>
            ) : activeOrg ? (
              /* Organization member — show the entity + the user's role.
                 A user is never converted into a company. */
              <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body-1 font-semibold text-onSurface truncate">
                      {activeOrg.org.name}
                    </p>
                    <p className="mt-0.5 text-caption text-muted">
                      {activeOrg.org.legalType
                        ? ORGANIZATION_LEGAL_TYPE_FA[activeOrg.org.legalType]
                        : "شخصیت حقوقی"}
                      {" · "}
                      {ORGANIZATION_STATUS_FA[activeOrg.org.status]}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-700 px-3 py-1 text-caption text-white">
                    <IconBalance size={14} />
                    {ORG_MEMBER_ROLE_FA[activeOrg.role as keyof typeof ORG_MEMBER_ROLE_FA] ??
                      activeOrg.role}
                  </span>
                </div>
                <Link
                  href="/onboarding/organization"
                  className="mt-3 inline-flex items-center gap-1.5 text-caption font-medium text-primary-700 hover:text-primary-800 transition-colors"
                >
                  اطلاعات شرکت
                  <IconArrowBack size={14} rtlFlip />
                </Link>
              </div>
            ) : (
              /* Personal user — offer to ADD an organization (never
                 "convert the account"). */
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2">
                  {(["PERSONAL", "BUSINESS"] as const).map((type) => {
                    const selected = platformAccountType === type;
                    return (
                      <SelectableCard
                        key={type}
                        selected={selected}
                        disabled={updateAccountType.isPending}
                        onClick={() => {
                          if (selected) return;
                          updateAccountType.mutate(type);
                        }}
                        title={ACCOUNT_TYPE_FA[type]}
                        description={ACCOUNT_TYPE_DESCRIPTION_FA[type]}
                      />
                    );
                  })}
                </div>
                <Link
                  href="/onboarding/organization"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary-700 px-4 py-3 text-body-2 font-medium text-primary-700 hover:bg-primary-50 transition-colors touch-target"
                >
                  <IconBalance size={18} />
                  ثبت یا افزودن شرکت
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================================================ */}
      {/* Profile Details — completion checklist            */}
      {/* ================================================ */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5 mb-6">
        <SectionTitle icon={<IconPerson size={22} />}>جزئیات پروفایل</SectionTitle>
        <CompletionChecklist profile={profile} onEdit={() => setEditOpen(true)} />
      </section>

      {/* ================================================ */}
      {/* وبلاگ حقوقی */}
      {/* ================================================ */}
      <section className="mb-6">
        <Link
          href="/blog"
          className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-primary-800 to-primary-900 p-6 shadow-elevation-2 transition-all duration-200 hover:shadow-elevation-4"
        >
          <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-6 -left-6 w-28 h-28 rounded-full border-2 border-white" />
            <div className="absolute bottom-2 right-10 w-20 h-20 rounded-full border border-white/60" />
          </div>
          <div className="relative flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
              <IconLawBook size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-h3 text-white font-bold">وبلاگ حقوقی لیگالیر</h3>
              <p className="text-body-2 text-primary-100/80 mt-1">
                راهنماها، آموزش‌ها، قوانین و مطالب کاربردی حقوقی
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-button text-primary-800 font-medium transition-all group-hover:gap-2.5">
              مشاهده وبلاگ
              <IconArrowBack size={16} rtlFlip />
            </span>
          </div>
        </Link>
      </section>

      {/* ================================================ */}
      {/* فضای حقوقی من */}
      {/* ================================================ */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5 mb-6">
        <SectionTitle icon={<IconBalance size={22} />}>فضای حقوقی من</SectionTitle>
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
          <HubCard
            href="/chat"
            icon={<IconChat size={22} />}
            title="گفت‌وگوهای من"
            description="پرسش و پاسخ حقوقی با هوش مصنوعی"
          />
          <HubCard
            href="/documents"
            icon={<IconDocument size={22} />}
            title="اسناد من"
            description="تحلیل و بررسی اسناد حقوقی"
            status={`${persianCount(docCount)} سند`}
            statusTone="primary"
          />
          <HubCard
            href="/contracts"
            icon={<IconContract size={22} />}
            title="قراردادهای من"
            description="ساخت و مدیریت قرارداد"
            status={`${persianCount(contractCount)} قرارداد`}
            statusTone="primary"
          />
          <HubCard
            href="/consultations"
            icon={<IconBalance size={22} />}
            title="مشاوره‌های من"
            description="درخواست مشاوره با وکیل انسانی و پیگیری پرونده"
            status={`${persianCount(consultationCount)} مشاوره`}
            statusTone="primary"
          />
          <HubCard
            href="/history"
            icon={<IconHistory size={22} />}
            title="تاریخچه"
            description="فعالیت‌ها و موارد اخیر"
          />
          <HubCard
            href="/settings"
            icon={<IconMemory size={22} />}
            title="حافظه و دانش"
            description="دانشی که هوش مصنوعی با آن به‌روزرسانی می‌شود"
            status={`${persianCount(memoryCount)} مورد ذخیره‌شده`}
            statusTone="primary"
          />
        </div>
      </section>

      {/* ================================================ */}
      {/* اشتراک */}
      {/* ================================================ */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5 mb-6">
        <SectionTitle icon={<IconSubscription size={22} />}>اشتراک</SectionTitle>

        {/* Canonical status — same source as the header chip and sidebar badge */}
        <SubscriptionStatusDetails className="mb-4" />

        {/* درخواست امروز — donut: consumed vs remaining (matches dashboard) */}
        <div className="rounded-xl bg-info-50 border border-info-100 p-4 dark:bg-info-container dark:border-divider">
          <div className="flex items-center gap-3">
            <div
              className="relative w-11 h-11 shrink-0"
              role="img"
              aria-label={`${toPersianNumber(dailyUsed)} درخواست مصرف‌شده از ${toPersianNumber(dailyTotal)}؛ ${toPersianNumber(dailyRemaining)} باقی‌مانده`}
            >
              <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                <defs>
                  <linearGradient id="profileQuotaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#60A5FA" />
                    <stop offset="100%" stopColor="#2563EB" />
                  </linearGradient>
                </defs>
                {/* track = consumed portion */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--color-info-100)" strokeWidth="4" />
                {/* remaining allowance sweeps from 12 o'clock */}
                <circle
                  cx="18" cy="18" r="15.915" fill="none"
                  stroke={dailyExhausted ? "var(--color-error)" : dailyLow ? "var(--color-warning)" : "url(#profileQuotaGrad)"}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={dailyDash}
                  className="transition-all duration-700 ease-emphasized"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-labelSmall font-bold text-info-700 tabular-nums dark:text-info">
                {toPersianNumber(dailyRemaining)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-h3 text-info-700 font-bold tabular-nums dark:text-info" dir="ltr">
                {toPersianNumber(dailyUsed)}/{toPersianNumber(dailyTotal)}
              </p>
              <p className="text-caption text-info-700 mt-0.5 dark:text-info">درخواست امروز</p>
            </div>
          </div>
          {/* legend: consumed vs remaining */}
          <div className="mt-3 flex items-center gap-3 text-caption text-info-700 dark:text-info">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-info-600 dark:bg-info" aria-hidden="true" />
              {toPersianNumber(dailyRemaining)} مانده
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-info-200" aria-hidden="true" />
              {toPersianNumber(dailyUsed)} مصرف
            </span>
          </div>
        </div>

        {lastPayment && (
          <p className="text-caption text-muted">
            آخرین پرداخت: {lastPayment.planNameFa} — {toPersianDate(lastPayment.purchasedAt)}
          </p>
        )}
      </section>

      {/* ================================================ */}
      {/* سرویس‌های متصل */}
      {/* ================================================ */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5 mb-6">
        <SectionTitle icon={<IconShield size={22} />}>سرویس‌های متصل</SectionTitle>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <IconCheck size={22} />
          </span>
          <p className="text-body-2 text-muted">در حال حاضر سرویس خارجی متصلی وجود ندارد.</p>
          <p className="text-caption text-muted">اتصال به درگاه‌ها و ابزارهای شخص ثالث به‌زودی.</p>
        </div>
      </section>

      {/* ================================================ */}
      {/* تنظیمات */}
      {/* ================================================ */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5 mb-6">
        <SectionTitle icon={<IconSettings size={22} />}>تنظیمات</SectionTitle>

        {/* Settings destinations */}
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3 mt-4">
          <HubCard
            href="/settings/notifications"
            icon={<IconSettings size={22} />}
            title="اعلان‌ها"
            description="مدیریت اعلان‌ها و اطلاع‌رسانی‌ها"
          />
          <HubCard
            href="/settings/privacy"
            icon={<IconShield size={22} />}
            title="حریم خصوصی"
            description="مدیریت دسترسی‌ها و داده‌ها"
          />
          <HubCard
            href="/settings/security"
            icon={<IconShield size={22} />}
            title="نشست‌ها و امنیت"
            description="نشست‌های فعال و امنیت حساب"
          />
        </div>
      </section>

      {/* ================================================ */}
      {/* راهنما و محصول */}
      {/* ================================================ */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5">
        <SectionTitle icon={<IconInfo size={22} />}>راهنما و محصول</SectionTitle>
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
          <HubCard href="/about" icon={<IconInfo size={22} />} title="درباره لیگالیر" description="آشنایی با پلتفرم و خدمات" />
          <HubCard href="/support" icon={<IconPhone size={22} />} title="پشتیبانی" description="تماس با تیم پشتیبانی" />
          <HubCard href="/blog" icon={<IconLawBook size={22} />} title="راهنما و آموزش" description="مقالات و راهنماهای حقوقی" />
          <HubCard href="/terms" icon={<IconStar size={22} />} title="قوانین استفاده" description="شرایط و ضوابط استفاده از خدمات" />
        </div>
      </section>

      {/* Dialogs */}
      <ProfileEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        saving={savingProfile}
        onSave={handleSaveProfile}
      />
      <AvatarDialog
        open={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        profile={profile}
        uploading={uploadAvatarMutation.isPending}
        deleting={deleteAvatarMutation.isPending}
        onUpload={handleUploadAvatar}
        onDelete={handleDeleteAvatar}
        onSelectPreset={handleSelectPreset}
      />
    </div>
  );
}
