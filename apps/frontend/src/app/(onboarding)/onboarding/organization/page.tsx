"use client";

// ============================================================
// LEGALIR — Organization Onboarding
// ============================================================
// Creates the legal entity and makes the caller its OWNER. The company is
// NEVER a user: this adds an organization + a membership to the existing
// personal account. After creation the user may record authorized
// signatories (official records, not platform users).

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCreateOrganization,
  useSignatories,
  useAddSignatory,
  useRemoveSignatory,
} from "@/hooks/useOnboarding";
import {
  ORGANIZATION_LEGAL_TYPE_FA,
  type OrganizationLegalType,
} from "@legalir/types";
import { Select, TextField } from "@legalir/ui";

const LEGAL_TYPES = Object.keys(ORGANIZATION_LEGAL_TYPE_FA) as OrganizationLegalType[];

const IRAN_PROVINCES = [
  "تهران", "البرز", "اصفهان", "فارس", "خراسان رضوی", "خوزستان", "آذربایجان شرقی",
  "آذربایجان غربی", "گیلان", "مازندران", "کرمان", "یزد", "قم", "قزوین", "زنجان",
  "همدان", "کردستان", "کرمانشاه", "لرستان", "مرکزی", "سمنان", "گلستان", "اردبیل",
  "بوشهر", "هرمزگان", "چهارمحال و بختیاری", "کهگیلویه و بویراحمد", "ایلام",
  "خراسان شمالی", "خراسان جنوبی", "سیستان و بلوچستان",
] as const;

export default function OrganizationOnboardingPage() {
  const router = useRouter();
  const createOrg = useCreateOrganization();

  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    tradeName: "",
    legalType: "" as OrganizationLegalType | "",
    nationalId: "",
    registrationNumber: "",
    economicCode: "",
    industry: "",
    province: "",
    city: "",
    address: "",
    postalCode: "",
    phone: "",
    email: "",
    website: "",
    representativeTitle: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("نام شرکت / شخصیت حقوقی الزامی است");
      return;
    }
    try {
      const res = await createOrg.mutateAsync({
        name: form.name.trim(),
        tradeName: form.tradeName.trim() || null,
        legalType: form.legalType || null,
        nationalId: form.nationalId.trim() || null,
        registrationNumber: form.registrationNumber.trim() || null,
        economicCode: form.economicCode.trim() || null,
        industry: form.industry.trim() || null,
        province: form.province || null,
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        postalCode: form.postalCode.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        representativeTitle: form.representativeTitle.trim() || null,
      });
      setCreatedOrgId(res.organization.id);
    } catch (err: unknown) {
      const apiErr = err as { code?: string; message?: string };
      setError(apiErr?.message ?? "خطا در ثبت اطلاعات شرکت. لطفاً دوباره تلاش کنید");
    }
  };

  if (createdOrgId) {
    return <SignatoriesStep orgId={createdOrgId} onDone={() => router.replace("/dashboard")} />;
  }

  return (
    <div className="rounded-large bg-neutral-0/95 backdrop-blur-sm p-8 shadow-elevation-8 border border-neutral-200/50">
      <div className="text-center mb-8">
        <h1 className="text-h2 text-neutral-900 mb-2">اطلاعات شخصیت حقوقی</h1>
        <p className="text-body-2 text-neutral-500">
          اطلاعات شرکت را وارد کنید. شما به‌عنوان نماینده و مالک سازمان ثبت می‌شوید.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="name"
          label="نام شرکت / شخصیت حقوقی"
          value={form.name}
          onChange={set("name")}
          placeholder="مثال: شرکت نمونه"
          disabled={createOrg.isPending}
          required
          autoFocus
          fullWidth
        />

        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          <TextField
            id="tradeName"
            label="نام تجاری"
            value={form.tradeName}
            onChange={set("tradeName")}
            placeholder="اختیاری"
            disabled={createOrg.isPending}
            fullWidth
          />
          <Select
            id="legalType"
            label="نوع شخصیت حقوقی"
            value={form.legalType}
            onChange={set("legalType")}
            disabled={createOrg.isPending}
            placeholder="انتخاب کنید"
            fullWidth
            options={LEGAL_TYPES.map((t) => ({ value: t, label: ORGANIZATION_LEGAL_TYPE_FA[t] }))}
          />
        </div>

        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          <TextField
            id="nationalId"
            label="شناسه ملی"
            value={form.nationalId}
            onChange={set("nationalId")}
            placeholder="۱۰ رقم"
            inputDir="ltr"
            disabled={createOrg.isPending}
            fullWidth
          />
          <TextField
            id="registrationNumber"
            label="شماره ثبت"
            value={form.registrationNumber}
            onChange={set("registrationNumber")}
            inputDir="ltr"
            disabled={createOrg.isPending}
            fullWidth
          />
        </div>

        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          <TextField
            id="economicCode"
            label="کد اقتصادی"
            value={form.economicCode}
            onChange={set("economicCode")}
            inputDir="ltr"
            disabled={createOrg.isPending}
            fullWidth
          />
          <TextField
            id="industry"
            label="صنعت / حوزه فعالیت"
            value={form.industry}
            onChange={set("industry")}
            disabled={createOrg.isPending}
            fullWidth
          />
        </div>

        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          <Select
            id="province"
            label="استان"
            value={form.province}
            onChange={set("province")}
            disabled={createOrg.isPending}
            placeholder="انتخاب کنید"
            fullWidth
            options={IRAN_PROVINCES.map((p) => ({ value: p, label: p }))}
          />
          <TextField
            id="city"
            label="شهر"
            value={form.city}
            onChange={set("city")}
            disabled={createOrg.isPending}
            fullWidth
          />
        </div>

        <TextField
          id="address"
          label="آدرس کامل"
          value={form.address}
          onChange={set("address")}
          disabled={createOrg.isPending}
          fullWidth
        />

        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          <TextField
            id="postalCode"
            label="کد پستی"
            value={form.postalCode}
            onChange={set("postalCode")}
            inputDir="ltr"
            disabled={createOrg.isPending}
            fullWidth
          />
          <TextField
            id="phone"
            label="تلفن"
            value={form.phone}
            onChange={set("phone")}
            inputDir="ltr"
            disabled={createOrg.isPending}
            fullWidth
          />
        </div>

        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          <TextField
            id="email"
            label="ایمیل"
            type="email"
            value={form.email}
            onChange={set("email")}
            inputDir="ltr"
            disabled={createOrg.isPending}
            fullWidth
          />
          <TextField
            id="website"
            label="وب‌سایت"
            value={form.website}
            onChange={set("website")}
            inputDir="ltr"
            disabled={createOrg.isPending}
            fullWidth
          />
        </div>

        <TextField
          id="representativeTitle"
          label="سمت شما در سازمان"
          value={form.representativeTitle}
          onChange={set("representativeTitle")}
          placeholder="مثال: مدیرعامل"
          disabled={createOrg.isPending}
          fullWidth
        />

        {error && (
          <div className="flex items-center gap-2 rounded-medium bg-error-container/30 border border-error/20 px-4 py-3 text-body-2 text-error" role="alert">
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={createOrg.isPending}
          className="w-full rounded-medium bg-primary-700 text-white py-3.5 text-button font-semibold hover:bg-primary-800 active:bg-primary-900 transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed shadow-elevation-3"
        >
          {createOrg.isPending ? "در حال ثبت..." : "ثبت سازمان"}
        </button>
      </form>
    </div>
  );
}

// ============================================================
// Signatories step — official records, not platform users
// ============================================================

function SignatoriesStep({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const signatories = useSignatories(orgId);
  const addSignatory = useAddSignatory(orgId);
  const removeSignatory = useRemoveSignatory(orgId);

  const [draft, setDraft] = useState({ fullName: "", nationalCode: "", position: "", authorityType: "", phone: "" });
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((p) => ({ ...p, [key]: e.target.value }));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!draft.fullName.trim()) {
      setError("نام صاحب امضا الزامی است");
      return;
    }
    try {
      await addSignatory.mutateAsync({
        fullName: draft.fullName.trim(),
        nationalCode: draft.nationalCode.trim() || null,
        position: draft.position.trim() || null,
        authorityType: draft.authorityType.trim() || null,
        phone: draft.phone.trim() || null,
      });
      setDraft({ fullName: "", nationalCode: "", position: "", authorityType: "", phone: "" });
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message ?? "خطا در افزودن صاحب امضا");
    }
  };

  const items = signatories.data?.items ?? [];

  return (
    <div className="rounded-large bg-neutral-0/95 backdrop-blur-sm p-8 shadow-elevation-8 border border-neutral-200/50">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-h2 text-neutral-900 mb-2">سازمان ثبت شد</h1>
        <p className="text-body-2 text-neutral-500">
          می‌توانید صاحبان امضای مجاز سازمان را ثبت کنید. این مرحله اختیاری است.
        </p>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2 mb-6">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-medium border border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-body-2 text-neutral-900 font-medium truncate">{s.fullName}</p>
                <p className="text-caption text-neutral-500 truncate">
                  {[s.position, s.authorityType].filter(Boolean).join(" — ") || "بدون سمت"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeSignatory.mutate(s.id)}
                disabled={removeSignatory.isPending}
                className="shrink-0 text-caption text-error hover:underline disabled:opacity-50"
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} noValidate className="space-y-4">
        <TextField
          id="sigName"
          label="نام و نام خانوادگی"
          value={draft.fullName}
          onChange={set("fullName")}
          disabled={addSignatory.isPending}
          required
          fullWidth
        />
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          <TextField
            id="sigCode"
            label="کد ملی"
            value={draft.nationalCode}
            onChange={set("nationalCode")}
            inputDir="ltr"
            disabled={addSignatory.isPending}
            fullWidth
          />
          <TextField
            id="sigPosition"
            label="سمت"
            value={draft.position}
            onChange={set("position")}
            disabled={addSignatory.isPending}
            fullWidth
          />
        </div>
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          <TextField
            id="sigAuthority"
            label="نوع اختیار"
            value={draft.authorityType}
            onChange={set("authorityType")}
            placeholder="مثال: امضای قرارداد"
            disabled={addSignatory.isPending}
            fullWidth
          />
          <TextField
            id="sigPhone"
            label="تلفن"
            value={draft.phone}
            onChange={set("phone")}
            inputDir="ltr"
            disabled={addSignatory.isPending}
            fullWidth
          />
        </div>

        {error && (
          <div className="rounded-medium bg-error-container/30 border border-error/20 px-4 py-3 text-body-2 text-error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={addSignatory.isPending}
          className="w-full rounded-medium border-2 border-primary-700 text-primary-700 py-3 text-button font-medium hover:bg-primary-50 transition-all duration-200 touch-target disabled:opacity-50"
        >
          {addSignatory.isPending ? "در حال افزودن..." : "افزودن صاحب امضا"}
        </button>
      </form>

      <button
        type="button"
        onClick={onDone}
        className="w-full mt-3 rounded-medium bg-primary-700 text-white py-3.5 text-button font-semibold hover:bg-primary-800 transition-all duration-200 touch-target shadow-elevation-3"
      >
        ورود به داشبورد
      </button>
    </div>
  );
}
