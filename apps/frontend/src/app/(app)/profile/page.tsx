// ============================================================
// LEGALIR — Account Hub (تنظیمات و پروفایل)
// Profile Summary (identity at a glance) + Profile Details (all
// editable fields), plus the legal-space, subscription, settings
// and help hubs. Mobile and account type are read-only identity.
// ============================================================

"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useMe, useUpdateProfile, useDailyQuota } from "@/hooks/useDashboard";
import { useProfileUsage, useSubscriptionHistory, useMemories } from "@/hooks/usePhase11";
import { SubscriptionStatusDetails } from "@/components/subscription/subscription-status";
import { useUpdateAccountType } from "@/hooks/useAccount";
import { useOrganizations } from "@/hooks/useOnboarding";
import { useDocuments } from "@/hooks/useDocuments";
import { useContracts } from "@/hooks/useContracts";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import { JalaliDatePicker, formatJalaliLong } from "@/components/shared/JalaliDatePicker";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
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
  IconEdit,
  IconArrowBack,
  IconStar,
  IconLawBook,
  IconInfo,
  IconBalance,
  IconChevronDown,
} from "@/lib/icons";
import type { Profile, V1SubscriptionHistoryItem, PlatformAccountType } from "@legalir/types";
import {
  ACCOUNT_TYPE_FA,
  ACCOUNT_TYPE_DESCRIPTION_FA,
  ORG_MEMBER_ROLE_FA,
  ORGANIZATION_STATUS_FA,
  ORGANIZATION_LEGAL_TYPE_FA,
} from "@legalir/types";
import { Select, TextField, SelectableOption, SelectableCard } from "@legalir/ui";

// ============================================================
// Helpers
// ============================================================

function splitDisplayName(name: string | null): { firstName: string; familyName: string } {
  if (!name) return { firstName: "", familyName: "" };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", familyName: "" };
  if (parts.length === 1) return { firstName: parts[0] ?? "", familyName: "" };
  return { firstName: parts[0] ?? "", familyName: parts.slice(1).join(" ") };
}

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

// ============================================================
// Profile draft — the editable slice of the profile
// ============================================================
// One flat object holds every field the «جزئیات پروفایل» section can
// change. Seeding it from the server profile and comparing it back is
// what tells the section whether the ویرایش button should read ذخیره.

interface ProfileDraft {
  firstName: string;
  familyName: string;
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

const EMPTY_DRAFT: ProfileDraft = {
  firstName: "", familyName: "", email: "", gender: "", birthDate: "",
  city: "", occupation: "", userType: "", province: "",
  legalInterests: [], primaryUseCase: "",
};

function draftFromProfile(profile: Profile | null): ProfileDraft {
  const { firstName, familyName } = splitDisplayName(profile?.displayName ?? null);
  return {
    firstName,
    familyName,
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" className="text-white/20" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700" />
      </svg>
    </div>
  );
}

// ============================================================
// Profile detail rows — read / edit
// ============================================================
// The whole «جزئیات پروفایل» section shares ONE edit mode: a single
// ویرایش/ذخیره button in the section header flips every row between a
// read-only value and its control. There are no per-field pencils —
// the section is the unit of editing, so the user reviews all changes
// together and saves them in one request.

/** One label/value row. Stacks on mobile, two columns from tablet up. */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 py-3 border-b border-divider/60 last:border-b-0 tablet:grid-cols-[7rem_1fr] tablet:items-center tablet:gap-3">
      <dt className="text-body-2 text-muted">{label}</dt>
      <dd className="min-w-0 tablet:flex tablet:justify-end">{children}</dd>
    </div>
  );
}

/** Read-mode value with a muted placeholder fallback. */
function ReadValue({ value, placeholder }: { value: string; placeholder: string }) {
  return (
    <span className="text-body-2 text-onSurface break-words">
      {value || <span className="text-neutral-300">{placeholder}</span>}
    </span>
  );
}

/** A text row — a value in read mode, a TextField in edit mode. */
function TextRow({ label, value, placeholder, editing, onChange, inputDir }: {
  label: string; value: string; placeholder: string; editing: boolean;
  onChange: (v: string) => void; inputDir?: "ltr" | "rtl";
}) {
  return (
    <FieldRow label={label}>
      {editing ? (
        <div className="w-full tablet:max-w-[240px]">
          <TextField
            label={label}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            inputSize="small"
            inputDir={inputDir}
            fullWidth
          />
        </div>
      ) : (
        <ReadValue value={value} placeholder={placeholder} />
      )}
    </FieldRow>
  );
}

/** A select row (gender / user type / province / primary use case). */
function SelectRow({ label, value, placeholder, options, editing, onChange }: {
  label: string; value: string; placeholder: string;
  options: readonly { value: string; label: string }[];
  editing: boolean; onChange: (v: string) => void;
}) {
  const displayLabel = options.find((o) => o.value === value)?.label ?? "";
  return (
    <FieldRow label={label}>
      {editing ? (
        <div className="w-full tablet:max-w-[240px]">
          <Select
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            selectSize="small"
            fullWidth
            options={options.map((opt) => ({ value: opt.value, label: opt.label }))}
          />
        </div>
      ) : (
        <ReadValue value={displayLabel} placeholder={placeholder} />
      )}
    </FieldRow>
  );
}

/** Birth date row — Jalali picker in edit mode, long date in read mode. */
function DateRow({ label, value, placeholder, editing, onChange }: {
  label: string; value: string; placeholder: string;
  editing: boolean; onChange: (v: string) => void;
}) {
  const parsed = value ? /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim()) : null;
  const displayValue = parsed
    ? formatJalaliLong(parseInt(parsed[1]!, 10), parseInt(parsed[2]!, 10), parseInt(parsed[3]!, 10))
    : "";
  return (
    <FieldRow label={label}>
      {editing ? (
        <div className="w-full tablet:max-w-[360px]">
          {/* Birth date is historical — the year list reaches back and
              rests on a plausible birth year, not the contract default. */}
          <JalaliDatePicker
            value={value}
            onChange={onChange}
            minYear={1300}
            maxYear={1405}
            defaultYear={1365}
            showSelected={false}
          />
        </div>
      ) : (
        <ReadValue value={displayValue} placeholder={placeholder} />
      )}
    </FieldRow>
  );
}

/** Multi-select chips (legalInterests) — interactive only in edit mode. */
function ChipsRow({ label, value, options, editing, onChange }: {
  label: string; value: string[]; options: readonly string[];
  editing: boolean; onChange: (v: string[]) => void;
}) {
  return (
    <FieldRow label={label}>
      <div className="flex flex-wrap gap-2 tablet:justify-end">
        {options.map((opt) => {
          const active = value.includes(opt);
          if (!editing) {
            if (!active) return null;
            return (
              <span key={opt} className="rounded-full bg-neutral-100 px-2.5 py-1 text-caption text-onSurfaceVariant">
                {opt}
              </span>
            );
          }
          return (
            <SelectableOption
              key={opt}
              label={opt}
              selected={active}
              onClick={() => onChange(active ? value.filter((v) => v !== opt) : [...value, opt])}
            />
          );
        })}
        {!editing && value.length === 0 && (
          <span className="text-body-2 text-neutral-300">انتخاب نشده</span>
        )}
      </div>
    </FieldRow>
  );
}

// ============================================================
// Account-type conversion confirmation
// ============================================================
// Converting to a legal account is effectively irreversible, so it
// requires an explicit confirmation before the request is sent.

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
  const memories = useMemories();

  const [detailsOpen, setDetailsOpen] = useState(false);
  // Section-level edit mode: one draft holds every editable field, so the
  // whole «جزئیات پروفایل» block is reviewed and saved as a unit.
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);

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

  const completionPct = profile?.completionPercent ?? 0;

  // The saved profile as a draft — the read-mode source of truth and the
  // baseline the draft is compared against.
  const savedDraft = useMemo(() => draftFromProfile(profile), [profile]);

  // The draft is seeded from the server profile whenever edit mode opens,
  // so cancelling and re-entering always starts from the saved values.
  const startEditing = useCallback(() => {
    setDraft(savedDraft);
    setEditing(true);
  }, [savedDraft]);

  const patchDraft = useCallback(
    <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
      setDraft((d) => ({ ...d, [key]: value })),
    [],
  );

  // True once any field differs from the saved profile — drives the
  // ویرایش → ذخیره button swap.
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedDraft),
    [draft, savedDraft],
  );

  // Read mode shows the saved values; edit mode shows the live draft.
  const shown = editing ? draft : savedDraft;

  const handleSave = useCallback(async () => {
    if (saving || !isDirty) return;
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        displayName: [draft.firstName, draft.familyName].filter(Boolean).join(" ") || null,
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
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [saving, isDirty, draft, updateProfile]);

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
      {/* Profile Summary — identity at a glance */}
      {/* ================================================ */}
      <section className="relative rounded-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 p-6 mb-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/5 blur-2xl" />
        </div>
        <div className="relative flex items-center gap-5">
          <div className="relative shrink-0">
            <CircularRing pct={completionPct} size={84} strokeWidth={6} color="#10b981" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-[66px] w-[66px] rounded-full bg-white flex items-center justify-center text-h2 text-primary-700 font-bold shadow-elevation-2">
                {getInitial(profile?.displayName ?? null)}
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-h3 text-white font-bold truncate">{profile?.displayName ?? "کاربر LEGALIR"}</h2>
            <p className="text-body-2 text-primary-200 mt-1 flex items-center gap-1.5" dir="ltr">
              <IconPhone size={15} className="text-primary-300" />
              {formatMobile(mobile)}
            </p>
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
          </div>
        </div>
      </section>

      {/* ================================================ */}
      {/* Account identity — mobile & account type (read-only) */}
      {/* ================================================ */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5 mb-6">
        <SectionTitle icon={<IconShield size={22} />}>هویت حساب</SectionTitle>
        <dl>
          <div className="flex items-center justify-between py-3 border-b border-divider/60">
            <dt className="text-body-2 text-muted shrink-0 w-28">شماره موبایل</dt>
            <dd className="flex flex-col items-end gap-0.5 text-body-2 text-onSurface" dir="ltr">
              <span className="flex items-center gap-2">
                <IconPhone size={16} className="text-muted" />
                {formatMobile(mobile)}
              </span>
              <span className="text-caption text-muted" dir="rtl">
                این شماره هنگام ثبت‌نام حساب ثبت شده و قابل تغییر نیست.
              </span>
            </dd>
          </div>
          <div className="py-3">
            <dt className="text-body-2 text-muted mb-2">نوع حساب</dt>
            <dd className="text-body-2 text-onSurface">
              {isLawyerAccount ? (
                <div className="flex flex-col items-end gap-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-caption text-primary-700">
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
            </dd>
          </div>
        </dl>
      </section>

      {/* ================================================ */}
      {/* Profile Details — all editable fields */}
      {/* ================================================ */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-5">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            aria-controls="profile-details"
            className="flex min-w-0 flex-1 items-center gap-2 text-start text-h3 text-onSurface font-bold"
          >
            <span className="text-primary-600"><IconPerson size={22} /></span>
            جزئیات پروفایل
            <span className="flex items-center gap-2 text-caption text-muted font-normal">
              {completionPct >= 100 ? "تکمیل شده" : `${toPersianNumber(completionPct)}٪`}
              <IconChevronDown size={18} className={`transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
            </span>
          </button>

          {/* One button for the whole section: ویرایش opens every row for
              editing; once a field changes it becomes ذخیره. */}
          {detailsOpen && (
            <button
              type="button"
              onClick={editing ? handleSave : startEditing}
              disabled={saving || (editing && !isDirty)}
              className={[
                "inline-flex shrink-0 items-center gap-1.5 rounded-medium px-3 py-2 text-caption font-medium transition-colors touch-target",
                editing
                  ? "bg-primary text-white hover:bg-primary-700 disabled:opacity-50"
                  : "border border-primary/40 text-primary hover:bg-primary-50",
              ].join(" ")}
            >
              {editing ? <IconCheck size={16} /> : <IconEdit size={16} />}
              {editing ? "ذخیره" : "ویرایش"}
            </button>
          )}
        </div>

        {detailsOpen && (
          <div id="profile-details" className="border-t border-divider/60 p-5 pt-0">
            <h3 className="text-body-1 text-onSurface font-semibold mt-4 mb-1">اطلاعات پایه</h3>
            <dl>
              <TextRow label="نام" value={shown.firstName} placeholder="نام خود را وارد کنید" editing={editing} onChange={(v) => patchDraft("firstName", v)} />
              <TextRow label="نام خانوادگی" value={shown.familyName} placeholder="نام خانوادگی" editing={editing} onChange={(v) => patchDraft("familyName", v)} />
              <TextRow label="ایمیل" value={shown.email} placeholder="ایمیل خود را وارد کنید" editing={editing} onChange={(v) => patchDraft("email", v)} inputDir="ltr" />
              <SelectRow label="جنسیت" value={shown.gender} placeholder="انتخاب نشده" options={GENDER_OPTIONS} editing={editing} onChange={(v) => patchDraft("gender", v)} />
              <DateRow label="تاریخ تولد" value={shown.birthDate} placeholder="انتخاب تاریخ" editing={editing} onChange={(v) => patchDraft("birthDate", v)} />
              <TextRow label="شهر" value={shown.city} placeholder="شهر محل سکونت" editing={editing} onChange={(v) => patchDraft("city", v)} />
              <TextRow label="شغل" value={shown.occupation} placeholder="شغل خود را وارد کنید" editing={editing} onChange={(v) => patchDraft("occupation", v)} />
            </dl>

            <h3 className="text-body-1 text-onSurface font-semibold mt-6 mb-1">پروفایل حقوقی من</h3>
            <p className="text-caption text-muted mb-2">
              با تکمیل این بخش، پروفایل شما به ۱۰۰٪ می‌رسد و ۱۰۰۰ امتیاز دریافت می‌کنید.
            </p>
            <dl>
              <SelectRow
                label="نوع کاربر"
                value={shown.userType}
                placeholder="انتخاب کنید"
                options={USER_TYPE_OPTIONS}
                editing={editing}
                onChange={(v) => patchDraft("userType", v)}
              />
              <SelectRow
                label="استان"
                value={shown.province}
                placeholder="انتخاب کنید"
                options={IRAN_PROVINCES.map((p) => ({ value: p, label: p }))}
                editing={editing}
                onChange={(v) => patchDraft("province", v)}
              />
              <ChipsRow
                label="حوزه‌های حقوقی مورد نیاز"
                value={shown.legalInterests}
                options={LEGAL_INTEREST_OPTIONS}
                editing={editing}
                onChange={(v) => patchDraft("legalInterests", v)}
              />
              <SelectRow
                label="هدف اصلی استفاده"
                value={shown.primaryUseCase}
                placeholder="انتخاب کنید"
                options={PRIMARY_USE_CASE_OPTIONS}
                editing={editing}
                onChange={(v) => patchDraft("primaryUseCase", v)}
              />
            </dl>
          </div>
        )}
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
    </div>
  );
}
