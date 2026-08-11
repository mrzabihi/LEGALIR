// ============================================================
// LEGALIR — Profile Page
// Modern UI with gradient avatar, circular completion ring,
// inline-editable fields, usage stat cards, timeline, payments.
// ============================================================

"use client";

import { useState, useCallback } from "react";
import { useMe, useUpdateProfile } from "@/hooks/useDashboard";
import { useProfileUsage, useSubscriptionHistory } from "@/hooks/usePhase11";
import { useThemeStore } from "@/stores/theme-store";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import { IconCheck, IconClose, IconPhone } from "@/lib/icons";
import type { V1SubscriptionHistoryItem, V1ProfileUsage, Profile } from "@legalir/types";

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

const STATUS_BADGE_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  expired: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  unknown: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" className="text-neutral-100" strokeWidth={strokeWidth} />
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
    <div className="flex items-center justify-between py-3.5 border-b border-divider/60 group">
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

// ============================================================
// Gender Select Field
// ============================================================

function GenderEditableField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const displayLabel = GENDER_OPTIONS.find((o) => o.value === value)?.label ?? "انتخاب نشده";

  const handleEdit = useCallback(() => { setDraft(value); setEditing(true); }, [value]);
  const handleCancel = useCallback(() => { setEditing(false); setDraft(value); }, [value]);
  const handleSave = useCallback(async () => { if (draft === value || saving) return; setSaving(true); try { await onSave(draft); setEditing(false); } finally { setSaving(false); } }, [draft, value, saving, onSave]);

  return (
    <div className="flex items-center justify-between py-3.5 border-b border-divider/60 group">
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

// ============================================================
// Date Editable Field
// ============================================================

function DateEditableField({ label, value, placeholder, onSave }: {
  label: string; value: string; placeholder: string; onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleEdit = useCallback(() => { setDraft(value); setEditing(true); }, [value]);
  const handleCancel = useCallback(() => { setEditing(false); setDraft(value); }, [value]);
  const handleSave = useCallback(async () => { if (draft === value || saving) return; setSaving(true); try { await onSave(draft); setEditing(false); } finally { setSaving(false); } }, [draft, value, saving, onSave]);

  const displayValue = value ? toPersianDate(value) : "";

  return (
    <div className="flex items-center justify-between py-3.5 border-b border-divider/60 group">
      <dt className="text-body-2 text-muted shrink-0 w-28">{label}</dt>
      {editing ? (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={saving} className="text-body-2 text-onSurface rounded-lg px-3 py-1.5 w-full max-w-[200px] border border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white transition-all" autoFocus />
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
// Usage Stat Card — usage stat with mini progress ring
// ============================================================

function MyStatCard({ label, used, total, color }: {
  label: string; used: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-divider/40">
      <CircularRing pct={pct} size={48} strokeWidth={5} color={color} />
      <div className="flex-1 min-w-0">
        <p className="text-body-2 text-onSurface font-medium">{label}</p>
        <p className="text-caption text-muted mt-0.5" dir="ltr">
          {toPersianNumber(used)} / {toPersianNumber(total)}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Profile Page
// ============================================================

export default function ProfilePage() {
  const me = useMe();
  const updateProfile = useUpdateProfile();
  const usage = useProfileUsage();
  const subHistory = useSubscriptionHistory();
  const { theme, toggleTheme } = useThemeStore();

  const profile = me.data?.profile ?? null;
  const mobile = me.data?.user?.mobileDisplay;
  const usageData = usage.data;
  const subItems: V1SubscriptionHistoryItem[] = subHistory.data?.items ?? [];

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

  return (
    <div className="p-4 tablet:p-6 max-w-2xl mx-auto">
      <h1 className="text-h2 text-onSurface font-bold mb-6">پروفایل</h1>

      {/* ---- Avatar Card (Gradient) ---- */}
      <section className="relative rounded-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 p-6 mb-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/5 blur-2xl" />
        </div>

        <div className="relative flex flex-col items-center">
          {/* Avatar + completion ring */}
          <div className="relative mb-4">
            <CircularRing pct={completionPct} size={88} strokeWidth={6} color="#10b981" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-[68px] w-[68px] rounded-full bg-white flex items-center justify-center text-h2 text-primary-700 font-bold shadow-elevation-2">
                {getInitial(profile?.displayName ?? null)}
              </div>
            </div>
          </div>

          <h2 className="text-h3 text-white font-bold">{profile?.displayName ?? "کاربر LEGALIR"}</h2>
          {(profile?.city || profile?.occupation) && (
            <p className="text-body-2 text-primary-200 mt-1">
              {[profile.city, profile.occupation].filter(Boolean).join(" — ")}
            </p>
          )}
          <p className="text-caption text-primary-300 mt-2">
            تکمیل پروفایل {toPersianNumber(completionPct)}٪
          </p>
        </div>
      </section>

      {/* ---- Editable Profile Fields ---- */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5 mb-6">
        <h2 className="text-h3 text-onSurface font-bold mb-2">اطلاعات شخصی</h2>
        <dl>
          <EditableField label="نام" value={firstName} placeholder="نام خود را وارد کنید" onSave={hSaveFirstName} />
          <EditableField label="نام خانوادگی" value={familyName} placeholder="نام خانوادگی" onSave={hSaveFamilyName} />
          <EditableField label="ایمیل" value={profile?.email ?? ""} placeholder="ایمیل خود را وارد کنید" onSave={hSaveEmail} />
          <GenderEditableField label="جنسیت" value={profile?.gender ?? ""} onSave={hSaveGender} />
          <DateEditableField label="تاریخ تولد" value={profile?.birthDate ?? ""} placeholder="انتخاب تاریخ" onSave={hSaveBirthDate} />
          <EditableField label="شهر" value={profile?.city ?? ""} placeholder="شهر محل سکونت" onSave={hSaveCity} />
          <EditableField label="شغل" value={profile?.occupation ?? ""} placeholder="شغل خود را وارد کنید" onSave={hSaveOccupation} />
          <div className="flex items-center justify-between py-3.5">
            <dt className="text-body-2 text-muted shrink-0 w-28">موبایل</dt>
            <dd className="flex items-center gap-2 text-body-2 text-onSurface" dir="ltr">
              <IconPhone size={16} className="text-muted" />
              {formatMobile(mobile)}
            </dd>
          </div>
        </dl>
      </section>

      {/* ---- Settings: Theme Toggle ---- */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5 mb-6">
        <h2 className="text-h3 text-onSurface font-bold mb-3">تنظیمات</h2>
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
              {theme === "dark" ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500">
                  <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-body-1 text-onSurface font-medium">تم</p>
              <p className="text-caption text-muted">{theme === "dark" ? "حالت تاریک" : "حالت روشن"}</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${theme === "dark" ? "bg-primary-600" : "bg-neutral-300"}`}
            aria-label="تغییر تم"
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${theme === "dark" ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </section>

      {/* ---- Resource Usage ---- */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5 mb-6">
        <h2 className="text-h3 text-onSurface font-bold mb-4">مصرف منابع</h2>

        {usage.isLoading ? (
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (<div key={i} className="h-16 rounded-xl bg-neutral-100 animate-pulse" />))}
          </div>
        ) : usage.isError ? (
          <div className="text-center py-4">
            <p className="text-body-2 text-error mb-2">خطا در دریافت اطلاعات مصرف</p>
            <button onClick={() => usage.refetch()} className="text-button text-primary hover:underline">تلاش مجدد</button>
          </div>
        ) : usageData ? (
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
            <MyStatCard label="درخواست روزانه" used={usageData.dailyRequestsUsed} total={usageData.dailyRequestsTotal} color="#3b82f6" />
            <MyStatCard label="توکن‌ها" used={usageData.tokensUsed} total={usageData.tokensTotal} color="#8b5cf6" />
            <MyStatCard label="تحلیل اسناد" used={usageData.documentAnalysesUsed} total={usageData.documentAnalysesTotal} color="#22c55e" />
            <MyStatCard label="قراردادها" used={usageData.contractsGenerated} total={usageData.contractsTotal} color="#f59e0b" />
          </div>
        ) : (
          <p className="text-body-2 text-muted text-center py-4">اطلاعات مصرف در دسترس نیست</p>
        )}
      </section>

      {/* ---- Subscription Timeline ---- */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5 mb-6">
        <h2 className="text-h3 text-onSurface font-bold mb-4">تاریخچه اشتراک</h2>

        {subHistory.isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-2 bg-neutral-100 rounded-full" />
                <div className="flex-1 space-y-2"><div className="h-4 bg-neutral-100 rounded w-1/3" /><div className="h-3 bg-neutral-100 rounded w-2/3" /></div>
              </div>
            ))}
          </div>
        ) : subHistory.isError ? (
          <div className="text-center py-4">
            <p className="text-body-2 text-error mb-2">خطا در دریافت تاریخچه</p>
            <button onClick={() => subHistory.refetch()} className="text-button text-primary hover:underline">تلاش مجدد</button>
          </div>
        ) : subItems.length === 0 ? (
          <p className="text-body-2 text-muted text-center py-4">هنوز اشتراکی تهیه نشده است.</p>
        ) : (
          <div className="relative">
            <div className="absolute right-[11px] top-2 bottom-2 w-0.5 bg-divider" aria-hidden="true" />
            <div className="space-y-5">
              {subItems.map((item, idx) => {
                const isActive = item.status === "active";
                const dotColor = isActive ? "bg-emerald-500 ring-emerald-100" : item.status === "expired" ? "bg-amber-500 ring-amber-100" : "bg-neutral-400 ring-neutral-100";
                return (
                  <div key={item.id} className="flex gap-4 items-start">
                    <div className="relative z-10 shrink-0">
                      <div className={`h-6 w-6 rounded-full ${dotColor} ring-4 flex items-center justify-center`}>
                        <div className="h-2.5 w-2.5 rounded-full bg-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline gap-2 mb-1">
                        <span className="text-body-2 text-onSurface font-semibold">{item.planNameFa}</span>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium border ${STATUS_BADGE_STYLES[item.status] ?? STATUS_BADGE_STYLES["unknown"]}`}>
                          {item.statusFa}
                        </span>
                        {idx === 0 && isActive && (<span className="text-caption text-emerald-600 font-medium">(فعلی)</span>)}
                      </div>
                      <p className="text-caption text-muted mb-1">{toPersianDate(item.startAt)} تا {toPersianDate(item.endAt)}</p>
                      <p className="text-caption text-onSurface font-bold">{toPersianNumber(item.amount)} تومان</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ---- Payment History ---- */}
      <section className="rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5">
        <h2 className="text-h3 text-onSurface font-bold mb-4">پرداخت‌ها</h2>

        {subHistory.isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (<div key={i} className="h-16 rounded-xl bg-neutral-100 animate-pulse" />))}
          </div>
        ) : subHistory.isError ? (
          <div className="text-center py-4">
            <p className="text-body-2 text-error mb-2">خطا در دریافت تاریخچه پرداخت</p>
            <button onClick={() => subHistory.refetch()} className="text-button text-primary hover:underline">تلاش مجدد</button>
          </div>
        ) : subItems.length === 0 ? (
          <p className="text-body-2 text-muted text-center py-4">هنوز پرداختی انجام نشده است.</p>
        ) : (
          <div className="space-y-2">
            {subItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-divider/40 hover:bg-neutral-50 transition-colors gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-body-2 text-onSurface font-semibold">{item.planNameFa}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium border ${STATUS_BADGE_STYLES[item.status] ?? STATUS_BADGE_STYLES["unknown"]}`}>{item.statusFa}</span>
                  </div>
                  <p className="text-caption text-muted">{toPersianDate(item.purchasedAt)}</p>
                </div>
                <span className="text-body-1 text-onSurface font-bold" dir="ltr">{toPersianNumber(item.amount)} تومان</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
