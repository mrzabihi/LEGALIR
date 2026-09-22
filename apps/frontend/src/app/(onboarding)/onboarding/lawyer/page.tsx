"use client";

// ============================================================
// LEGALIR — Lawyer Onboarding
// ============================================================
// Collects the lawyer profile and submits it for review. Completing this
// form NEVER verifies the lawyer: the profile becomes PROFILE_SUBMITTED
// (pending) and the user is told the lawyer section is not yet active.
// No lawyer permissions are granted here.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLawyerOnboarding, useSubmitLawyerOnboarding } from "@/hooks/useOnboarding";
import { LAWYER_ACTIVITY_TYPE_FA, type LawyerActivityType } from "@legalir/types";
import { Select, Textarea, TextField, SelectableOption } from "@legalir/ui";

const ACTIVITY_TYPES = Object.keys(LAWYER_ACTIVITY_TYPE_FA) as LawyerActivityType[];

const SPECIALIZATIONS = [
  "قراردادها", "املاک", "خانواده", "تجارت", "مطالبات", "کار",
  "کیفری", "مالیات", "مالکیت فکری", "سایر",
] as const;

const IRAN_PROVINCES = [
  "تهران", "البرز", "اصفهان", "فارس", "خراسان رضوی", "خوزستان", "آذربایجان شرقی",
  "آذربایجان غربی", "گیلان", "مازندران", "کرمان", "یزد", "قم", "قزوین", "زنجان",
  "همدان", "کردستان", "کرمانشاه", "لرستان", "مرکزی", "سمنان", "گلستان", "اردبیل",
  "بوشهر", "هرمزگان", "چهارمحال و بختیاری", "کهگیلویه و بویراحمد", "ایلام",
  "خراسان شمالی", "خراسان جنوبی", "سیستان و بلوچستان",
] as const;

const labelClass = "block text-body-2 text-neutral-700 font-medium mb-2";

export default function LawyerOnboardingPage() {
  const router = useRouter();
  const existing = useLawyerOnboarding();
  const submit = useSubmitLawyerOnboarding();

  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    professionalTitle: "",
    activityType: "" as LawyerActivityType | "",
    licenseNumber: "",
    licenseAuthority: "",
    licenseYear: "",
    province: "",
    city: "",
    yearsExperience: "",
    bio: "",
  });
  const [specializations, setSpecializations] = useState<string[]>([]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const toggleSpec = (s: string) =>
    setSpecializations((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.fullName.trim()) {
      setError("نام و نام خانوادگی الزامی است");
      return;
    }
    try {
      await submit.mutateAsync({
        fullName: form.fullName.trim(),
        professionalTitle: form.professionalTitle.trim() || null,
        activityType: form.activityType || null,
        licenseNumber: form.licenseNumber.trim() || null,
        licenseAuthority: form.licenseAuthority.trim() || null,
        licenseYear: form.licenseYear ? Number(form.licenseYear) : null,
        province: form.province || null,
        city: form.city.trim() || null,
        yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : null,
        bio: form.bio.trim() || null,
        specializations,
        avatarUrl: null,
      });
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message ?? "خطا در ثبت پروفایل. لطفاً دوباره تلاش کنید");
    }
  };

  // Submitted — pending review. The lawyer section is not yet active.
  if (submit.isSuccess || existing.data?.pendingVerification) {
    return (
      <div className="rounded-large bg-neutral-0/95 backdrop-blur-sm p-8 shadow-elevation-8 border border-neutral-200/50 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <h1 className="text-h2 text-neutral-900 mb-2">پروفایل وکیل ثبت شد</h1>
        <p className="text-body-2 text-neutral-500 mb-4">
          اطلاعات شما برای بررسی ارسال شد. پس از تأیید، پروفایل شما در فهرست وکلا نمایش داده می‌شود.
        </p>
        <div className="rounded-medium bg-amber-50 border border-amber-200 px-4 py-3 text-body-2 text-amber-800 mb-6">
          بخش وکلا به‌زودی فعال می‌شود.
        </div>
        <button
          type="button"
          onClick={() => router.replace("/dashboard")}
          className="w-full rounded-medium bg-primary-700 text-white py-3.5 text-button font-semibold hover:bg-primary-800 transition-all duration-200 touch-target shadow-elevation-3"
        >
          ورود به داشبورد
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-large bg-neutral-0/95 backdrop-blur-sm p-8 shadow-elevation-8 border border-neutral-200/50">
      <div className="text-center mb-8">
        <h1 className="text-h2 text-neutral-900 mb-2">تکمیل پروفایل وکیل</h1>
        <p className="text-body-2 text-neutral-500">
          اطلاعات حرفه‌ای خود را وارد کنید. پس از بررسی، پروفایل شما فعال می‌شود.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="fullName"
          label="نام و نام خانوادگی"
          value={form.fullName}
          onChange={set("fullName")}
          disabled={submit.isPending}
          required
          autoFocus
          fullWidth
        />

        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          <TextField
            id="professionalTitle"
            label="عنوان حرفه‌ای"
            value={form.professionalTitle}
            onChange={set("professionalTitle")}
            placeholder="مثال: وکیل پایه یک دادگستری"
            disabled={submit.isPending}
            fullWidth
          />
          <Select
            id="activityType"
            label="نوع فعالیت"
            value={form.activityType}
            onChange={set("activityType")}
            disabled={submit.isPending}
            placeholder="انتخاب کنید"
            fullWidth
            options={ACTIVITY_TYPES.map((t) => ({ value: t, label: LAWYER_ACTIVITY_TYPE_FA[t] }))}
          />
        </div>

        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          <TextField
            id="licenseNumber"
            label="شماره پروانه وکالت"
            value={form.licenseNumber}
            onChange={set("licenseNumber")}
            inputDir="ltr"
            disabled={submit.isPending}
            fullWidth
          />
          <TextField
            id="licenseAuthority"
            label="مرجع صدور پروانه"
            value={form.licenseAuthority}
            onChange={set("licenseAuthority")}
            placeholder="مثال: کانون وکلای مرکز"
            disabled={submit.isPending}
            fullWidth
          />
        </div>

        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          <TextField
            id="licenseYear"
            label="سال صدور پروانه"
            type="text"
            inputMode="numeric"
            value={form.licenseYear}
            onChange={set("licenseYear")}
            inputDir="ltr"
            disabled={submit.isPending}
            fullWidth
          />
          <TextField
            id="yearsExperience"
            label="سابقه کار (سال)"
            type="text"
            inputMode="numeric"
            value={form.yearsExperience}
            onChange={set("yearsExperience")}
            inputDir="ltr"
            disabled={submit.isPending}
            fullWidth
          />
        </div>

        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          <Select
            id="province"
            label="استان"
            value={form.province}
            onChange={set("province")}
            disabled={submit.isPending}
            placeholder="انتخاب کنید"
            fullWidth
            options={IRAN_PROVINCES.map((p) => ({ value: p, label: p }))}
          />
          <TextField
            id="city"
            label="شهر"
            value={form.city}
            onChange={set("city")}
            disabled={submit.isPending}
            fullWidth
          />
        </div>

        <div>
          <span className={labelClass}>حوزه‌های تخصصی</span>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATIONS.map((s) => {
              const active = specializations.includes(s);
              return (
                <SelectableOption
                  key={s}
                  label={s}
                  selected={active}
                  disabled={submit.isPending}
                  onClick={() => toggleSpec(s)}
                />
              );
            })}
          </div>
        </div>

        <Textarea
          id="bio"
          label="معرفی و سابقه"
          rows={4}
          value={form.bio}
          onChange={set("bio")}
          placeholder="خلاصه‌ای از تخصص و تجربه خود بنویسید"
          disabled={submit.isPending}
          fullWidth
        />

        {error && (
          <div className="rounded-medium bg-error-container/30 border border-error/20 px-4 py-3 text-body-2 text-error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submit.isPending}
          className="w-full rounded-medium bg-primary-700 text-white py-3.5 text-button font-semibold hover:bg-primary-800 active:bg-primary-900 transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed shadow-elevation-3"
        >
          {submit.isPending ? "در حال ارسال..." : "ارسال برای بررسی"}
        </button>
      </form>
    </div>
  );
}
