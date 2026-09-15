// ============================================================
// LEGALIR — Account Hub (تنظیمات و پروفایل)
// Polished hub with visual section cards for Profile, Legal
// Space, Subscription, Connected Services, Settings, Help and
// the Legal Blog. Replaces the single-purpose profile editor.
// ============================================================

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useMe, useUpdateProfile, useDailyQuota } from "@/hooks/useDashboard";
import { useProfileUsage, useSubscriptionHistory, useMemories } from "@/hooks/usePhase11";
import { useCurrentSubscription } from "@/hooks/useSubscription";
import { useDocuments } from "@/hooks/useDocuments";
import { useContracts } from "@/hooks/useContracts";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import { JalaliDatePicker, formatJalaliLong } from "@/components/shared/JalaliDatePicker";
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
  IconClose,
  IconArrowBack,
  IconStar,
  IconLawBook,
  IconInfo,
  IconBalance,
} from "@/lib/icons";
import type { Profile, V1SubscriptionHistoryItem } from "@legalir/types";

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
// Inline Editable Field
// ============================================================

function EditableField({ label, value, placeholder, onSave }: {
  label: string; value: string; placeholder: string; onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleEdit = useCallback(() => { setDraft(value); setEditing(true); }, [value]);
  const handleCancel = useCallback(() => { setEditing(false); setDraft(value); }, [value]);

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === value || saving) return;
    setSaving(true);
    try { await onSave(trimmed); setEditing(false); }
    finally { setSaving(false); }
  }, [draft, value, saving, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  }, [handleSave, handleCancel]);

  return (
    <div className="flex items-center justify-between py-3 border-b border-divider/60 group last:border-b-0">
      <dt className="text-body-2 text-muted shrink-0 w-28">{label}</dt>
      {editing ? (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={handleKeyDown} disabled={saving} placeholder={placeholder} className="text-body-2 text-onSurface rounded-lg px-3 py-1.5 w-full max-w-[200px] border border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white transition-all" autoFocus dir="rtl" />
          <button onClick={handleSave} disabled={saving || draft.trim() === value} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-30" aria-label="ذخیره"><IconCheck size={16} /></button>
          <button onClick={handleCancel} disabled={saving} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 transition-colors" aria-label="لغو"><IconClose size={16} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <dd className="text-body-2 text-onSurface">{value || <span className="text-neutral-300">{placeholder}</span>}</dd>
          <button onClick={handleEdit} className="p-1.5 rounded-lg text-neutral-300 opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary-50 transition-all" aria-label={`ویرایش ${label}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function GenderEditableField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const displayLabel = GENDER_OPTIONS.find((o) => o.value === value)?.label ?? "انتخاب نشده";

  const handleEdit = useCallback(() => { setDraft(value); setEditing(true); }, [value]);
  const handleCancel = useCallback(() => { setEditing(false); setDraft(value); }, [value]);
  const handleSave = useCallback(async () => { if (draft === value || saving) return; setSaving(true); try { await onSave(draft); setEditing(false); } finally { setSaving(false); } }, [draft, value, saving, onSave]);

  return (
    <div className="flex items-center justify-between py-3 border-b border-divider/60 group last:border-b-0">
      <dt className="text-body-2 text-muted shrink-0 w-28">{label}</dt>
      {editing ? (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <select value={draft} onChange={(e) => setDraft(e.target.value)} disabled={saving} className="text-body-2 text-onSurface rounded-lg px-3 py-1.5 w-full max-w-[200px] border border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white transition-all" autoFocus dir="rtl">
            {GENDER_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <button onClick={handleSave} disabled={saving || draft === value} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-30" aria-label="ذخیره"><IconCheck size={16} /></button>
          <button onClick={handleCancel} disabled={saving} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 transition-colors" aria-label="لغو"><IconClose size={16} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <dd className="text-body-2 text-onSurface">{value ? displayLabel : <span className="text-neutral-300">انتخاب نشده</span>}</dd>
          <button onClick={handleEdit} className="p-1.5 rounded-lg text-neutral-300 opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary-50 transition-all" aria-label={`ویرایش ${label}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function DateEditableField({ label, value, placeholder, onSave }: {
  label: string; value: string; placeholder: string; onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleEdit = useCallback(() => { setDraft(value); setEditing(true); }, [value]);
  const handleCancel = useCallback(() => { setEditing(false); setDraft(value); }, [value]);
  const handleSave = useCallback(async () => { if (draft === value || saving) return; setSaving(true); try { await onSave(draft); setEditing(false); } finally { setSaving(false); } }, [draft, value, saving, onSave]);

  const parsed = value ? /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim()) : null;
  const displayValue = parsed
    ? formatJalaliLong(parseInt(parsed[1]!, 10), parseInt(parsed[2]!, 10), parseInt(parsed[3]!, 10))
    : "";

  return (
    <div className="flex items-center justify-between py-3 border-b border-divider/60 group last:border-b-0">
      <dt className="text-body-2 text-muted shrink-0 w-28">{label}</dt>
      {editing ? (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <JalaliDatePicker value={draft} onChange={setDraft} disabled={saving} />
          <button onClick={handleSave} disabled={saving || draft === value} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-30" aria-label="ذخیره"><IconCheck size={16} /></button>
          <button onClick={handleCancel} disabled={saving} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 transition-colors" aria-label="لغو"><IconClose size={16} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <dd className="text-body-2 text-onSurface">{displayValue || <span className="text-neutral-300">{placeholder}</span>}</dd>
          <button onClick={handleEdit} className="p-1.5 rounded-lg text-neutral-300 opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary-50 transition-all" aria-label={`ویرایش ${label}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Select-based editable field (extended profile)
// ============================================================

function SelectEditableField({ label, value, placeholder, options, onSave }: {
  label: string;
  value: string;
  placeholder: string;
  options: readonly { value: string; label: string }[];
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const displayLabel = options.find((o) => o.value === value)?.label ?? "";

  const handleEdit = useCallback(() => { setDraft(value); setEditing(true); }, [value]);
  const handleCancel = useCallback(() => { setEditing(false); setDraft(value); }, [value]);
  const handleSave = useCallback(async () => { if (draft === value || saving) return; setSaving(true); try { await onSave(draft); setEditing(false); } finally { setSaving(false); } }, [draft, value, saving, onSave]);

  return (
    <div className="flex items-center justify-between py-3 border-b border-divider/60 group last:border-b-0">
      <dt className="text-body-2 text-muted shrink-0 w-28">{label}</dt>
      {editing ? (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <select value={draft} onChange={(e) => setDraft(e.target.value)} disabled={saving} className="text-body-2 text-onSurface rounded-lg px-3 py-1.5 w-full max-w-[220px] border border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white transition-all" autoFocus dir="rtl">
            {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <button onClick={handleSave} disabled={saving || draft === value} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-30" aria-label="ذخیره"><IconCheck size={16} /></button>
          <button onClick={handleCancel} disabled={saving} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 transition-colors" aria-label="لغو"><IconClose size={16} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <dd className="text-body-2 text-onSurface">{value ? displayLabel : <span className="text-neutral-300">{placeholder}</span>}</dd>
          <button onClick={handleEdit} className="p-1.5 rounded-lg text-neutral-300 opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary-50 transition-all" aria-label={`ویرایش ${label}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Multi-select chips (legalInterests)
// ============================================================

function MultiSelectField({ label, value, options, onSave }: {
  label: string;
  value: string[];
  options: readonly string[];
  onSave: (v: string[]) => void;
}) {
  const [saving, setSaving] = useState(false);

  const toggle = useCallback(async (opt: string) => {
    if (saving) return;
    const next = value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt];
    setSaving(true);
    try { await onSave(next); } finally { setSaving(false); }
  }, [value, saving, onSave]);

  return (
    <div className="py-3 border-b border-divider/60 last:border-b-0">
      <dt className="text-body-2 text-muted mb-2">{label}</dt>
      <dd className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              disabled={saving}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-caption font-medium transition-colors touch-target ${
                active
                  ? "bg-primary-50 text-primary-700 border-primary-300 dark:bg-primary-500/10 dark:text-primary-400 dark:border-primary-500/20"
                  : "bg-surface text-muted border-divider hover:border-primary/40 hover:text-primary"
              }`}
            >
              {active && <IconCheck size={14} />}
              {opt}
            </button>
          );
        })}
      </dd>
    </div>
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
  const usage = useProfileUsage();
  const quota = useDailyQuota();
  const subHistory = useSubscriptionHistory();
  const currentSub = useCurrentSubscription();
  const documents = useDocuments({ pageSize: 1 });
  const contracts = useContracts({ pageSize: 1 });
  const memories = useMemories();

  const profile = me.data?.profile ?? null;
  const mobile = me.data?.user?.mobileDisplay;
  const usageData = usage.data;
  const subItems: V1SubscriptionHistoryItem[] = subHistory.data?.items ?? [];
  const activeSub = currentSub.data ?? null;

  const docCount = documents.data?.pagination?.total ?? documents.data?.items?.length ?? 0;
  const contractCount = contracts.data?.pagination?.total ?? contracts.data?.items?.length ?? 0;
  const memoryCount = memories.data?.items?.length ?? 0;

  const { firstName, familyName } = splitDisplayName(profile?.displayName ?? null);
  const completionPct = profile?.completionPercent ?? 0;

  const hSaveFirstName = useCallback(
    (v: string) => updateProfile.mutateAsync({ displayName: [v, familyName].filter(Boolean).join(" ") || null }),
    [updateProfile, familyName],
  );
  const hSaveFamilyName = useCallback(
    (v: string) => updateProfile.mutateAsync({ displayName: [firstName, v].filter(Boolean).join(" ") || null }),
    [updateProfile, firstName],
  );
  const hSaveCity = useCallback((v: string) => updateProfile.mutateAsync({ city: v || null }), [updateProfile]);
  const hSaveOccupation = useCallback((v: string) => updateProfile.mutateAsync({ occupation: v || null }), [updateProfile]);
  const hSaveEmail = useCallback((v: string) => updateProfile.mutateAsync({ email: v || null }), [updateProfile]);
  const hSaveBirthDate = useCallback((v: string) => updateProfile.mutateAsync({ birthDate: v || null }), [updateProfile]);
  const hSaveGender = useCallback((v: string) => updateProfile.mutateAsync({ gender: (v || null) as Profile["gender"] }), [updateProfile]);
  const hSaveUserType = useCallback((v: string) => updateProfile.mutateAsync({ userType: v || null }), [updateProfile]);
  const hSaveProvince = useCallback((v: string) => updateProfile.mutateAsync({ province: v || null }), [updateProfile]);
  const hSavePrimaryUseCase = useCallback((v: string) => updateProfile.mutateAsync({ primaryUseCase: v || null }), [updateProfile]);
  const hSaveLegalInterests = useCallback(
    (v: string[]) => updateProfile.mutateAsync({ legalInterests: v.length > 0 ? v : null }),
    [updateProfile],
  );

  // Live daily quota (plan-derived) takes precedence over the stored usage row.
  const dailyUsed = quota.data?.used ?? usageData?.dailyRequestsUsed ?? 0;
  const dailyTotal = quota.data?.total ?? usageData?.dailyRequestsTotal ?? 0;
  const dailyRemaining = Math.max(0, dailyTotal - dailyUsed);
  const dailySweep = dailyTotal > 0 ? (dailyRemaining / dailyTotal) * 360 : 0;
  const dailyDash = `${dailySweep} ${360 - dailySweep}`;
  const dailyExhausted = dailyTotal > 0 && dailyRemaining === 0;
  const dailyLow = !dailyExhausted && dailyTotal > 0 && dailyRemaining / dailyTotal <= 0.25;

  const subLabel = activeSub?.planNameFa ?? "بدون اشتراک";

  return (
    <div className="p-4 tablet:p-6 max-w-3xl mx-auto" dir="rtl">
      <h1 className="text-h2 text-onSurface font-bold mb-6">تنظیمات و پروفایل</h1>

      {/* ================================================ */}
      {/* Hero — identity summary */}
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
            {(profile?.city || profile?.occupation) && (
              <p className="text-body-2 text-primary-200 mt-1 truncate">
                {[profile.city, profile.occupation].filter(Boolean).join(" — ")}
              </p>
            )}
            <p className="text-caption text-primary-300 mt-1.5">
              تکمیل پروفایل {toPersianNumber(completionPct)}٪
            </p>
          </div>
        </div>
      </section>

      {/* ================================================ */}
      {/* پروفایل من */}
      {/* ================================================ */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5 mb-6">
        <SectionTitle icon={<IconPerson size={22} />}>پروفایل من</SectionTitle>
        <dl>
          <EditableField label="نام" value={firstName} placeholder="نام خود را وارد کنید" onSave={hSaveFirstName} />
          <EditableField label="نام خانوادگی" value={familyName} placeholder="نام خانوادگی" onSave={hSaveFamilyName} />
          <EditableField label="ایمیل" value={profile?.email ?? ""} placeholder="ایمیل خود را وارد کنید" onSave={hSaveEmail} />
          <GenderEditableField label="جنسیت" value={profile?.gender ?? ""} onSave={hSaveGender} />
          <DateEditableField label="تاریخ تولد" value={profile?.birthDate ?? ""} placeholder="انتخاب تاریخ" onSave={hSaveBirthDate} />
          <EditableField label="شهر" value={profile?.city ?? ""} placeholder="شهر محل سکونت" onSave={hSaveCity} />
          <EditableField label="شغل" value={profile?.occupation ?? ""} placeholder="شغل خود را وارد کنید" onSave={hSaveOccupation} />
          <div className="flex items-center justify-between py-3">
            <dt className="text-body-2 text-muted shrink-0 w-28">موبایل</dt>
            <dd className="flex items-center gap-2 text-body-2 text-onSurface" dir="ltr">
              <IconPhone size={16} className="text-muted" />
              {formatMobile(mobile)}
            </dd>
          </div>
        </dl>
      </section>

      {/* ================================================ */}
      {/* پروفایل حقوقی من — Extended Profile (50%) */}
      {/* ================================================ */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-1">
          <SectionTitle icon={<IconBalance size={22} />}>پروفایل حقوقی من</SectionTitle>
        </div>
        <p className="text-caption text-muted -mt-3 mb-4">
          با تکمیل این بخش، پروفایل شما به ۱۰۰٪ می‌رسد و ۱۰۰۰ امتیاز دریافت می‌کنید.
        </p>
        <dl>
          <SelectEditableField
            label="نوع کاربر"
            value={profile?.userType ?? ""}
            placeholder="انتخاب کنید"
            options={USER_TYPE_OPTIONS}
            onSave={hSaveUserType}
          />
          <SelectEditableField
            label="استان"
            value={profile?.province ?? ""}
            placeholder="انتخاب کنید"
            options={IRAN_PROVINCES.map((p) => ({ value: p, label: p }))}
            onSave={hSaveProvince}
          />
          <MultiSelectField
            label="حوزه‌های حقوقی مورد نیاز"
            value={profile?.legalInterests ?? []}
            options={LEGAL_INTEREST_OPTIONS}
            onSave={hSaveLegalInterests}
          />
          <SelectEditableField
            label="هدف اصلی استفاده"
            value={profile?.primaryUseCase ?? ""}
            placeholder="انتخاب کنید"
            options={PRIMARY_USE_CASE_OPTIONS}
            onSave={hSavePrimaryUseCase}
          />
        </dl>
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

        <div className="flex flex-col tablet:flex-row tablet:items-center gap-4 rounded-xl bg-amber-50/60 border border-amber-100 p-4 mb-4">
          <div className="min-w-0 flex-1">
            <p className="text-body-1 text-onSurface font-semibold">پلن فعلی: {subLabel}</p>
            <p className="text-caption text-muted mt-0.5">
              {activeSub?.endAt ? `اعتبار تا ${toPersianDate(activeSub.endAt)}` : "برای فعال‌سازی اشتراک اقدام کنید"}
            </p>
          </div>
          <Link
            href="/subscription"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-medium bg-primary-700 text-white px-5 py-2.5 text-button hover:bg-primary-800 transition-colors touch-target"
          >
            مدیریت و ارتقا
            <IconArrowBack size={16} rtlFlip />
          </Link>
        </div>

        {/* درخواست امروز — donut: consumed vs remaining (matches dashboard) */}
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 text-blue-100 border border-white/10 backdrop-blur p-4 transition-colors duration-300 hover:border-blue-300/30">
          <span
            className="pointer-events-none absolute -top-8 -end-8 w-24 h-24 rounded-full bg-blue-400/20 blur-2xl transition-opacity duration-500 opacity-60 group-hover:opacity-100"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-3">
            <div
              className="relative w-11 h-11 shrink-0"
              role="img"
              aria-label={`${toPersianNumber(dailyUsed)} درخواست مصرف‌شده از ${toPersianNumber(dailyTotal)}؛ ${toPersianNumber(dailyRemaining)} باقی‌مانده`}
            >
              <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                <defs>
                  <linearGradient id="profileQuotaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#93c5fd" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                {/* track = consumed portion */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                {/* remaining allowance sweeps from 12 o'clock */}
                <circle
                  cx="18" cy="18" r="15.915" fill="none"
                  stroke={dailyExhausted ? "#f87171" : dailyLow ? "#fbbf24" : "url(#profileQuotaGrad)"}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={dailyDash}
                  className="transition-all duration-700 ease-emphasized"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white tabular-nums">
                {toPersianNumber(dailyRemaining)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-h3 text-white font-bold tabular-nums" dir="ltr">
                {toPersianNumber(dailyUsed)}/{toPersianNumber(dailyTotal)}
              </p>
              <p className="text-caption text-primary-200 mt-0.5">درخواست امروز</p>
            </div>
          </div>
          {/* legend: consumed vs remaining */}
          <div className="relative mt-2 flex items-center gap-3 text-[10px] text-primary-200/90">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-300" aria-hidden="true" />
              {toPersianNumber(dailyRemaining)} مانده
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-white/25" aria-hidden="true" />
              {toPersianNumber(dailyUsed)} مصرف
            </span>
          </div>
        </div>

        {subItems.length > 0 && subItems[0] && (
          <p className="text-caption text-muted">
            آخرین پرداخت: {subItems[0].planNameFa} — {toPersianDate(subItems[0].purchasedAt)}
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
            href="/settings"
            icon={<IconSettings size={22} />}
            title="اعلان‌ها و حریم خصوصی"
            description="مدیریت اعلان‌ها و دسترسی‌ها"
          />
          <HubCard
            href="/settings"
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
          <HubCard href="/support" icon={<IconStar size={22} />} title="قوانین استفاده" description="شرایط و ضوابط استفاده از خدمات" />
        </div>
      </section>
    </div>
  );
}
