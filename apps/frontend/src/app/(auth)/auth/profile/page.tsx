"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useUpdateProfile } from "@/hooks/useDashboard";

interface ProfileFormData {
  displayName: string;
  city: string;
  occupation: string;
}

export default function ProfileCompletionPage() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const updateProfile = useUpdateProfile();

  const [formData, setFormData] = useState<ProfileFormData>({
    displayName: "",
    city: "",
    occupation: "",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/auth/mobile");
    }
  }, [isAuthenticated, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.displayName.trim() && !formData.city.trim() && !formData.occupation.trim()) {
      router.push("/dashboard");
      return;
    }

    try {
      await updateProfile.mutateAsync({
        displayName: formData.displayName.trim() || null,
        city: formData.city.trim() || null,
        occupation: formData.occupation.trim() || null,
      });

      setSaved(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 800);
    } catch {
      setError("خطا در ذخیره اطلاعات. لطفاً دوباره تلاش کنید");
    }
  };

  const handleSkip = () => {
    router.push("/dashboard");
  };

  if (!session && !isAuthenticated()) {
    return null;
  }

  return (
    <div className="rounded-large bg-neutral-0/95 backdrop-blur-sm p-8 shadow-elevation-8 border border-neutral-200/50">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-700/10 mb-4">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary-700"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="text-h2 text-neutral-900 mb-2">تکمیل پروفایل</h1>
        <p className="text-body-2 text-neutral-500">
          برای استفاده بهتر از امکانات LEGALIR، لطفا اطلاعات خود را تکمیل کنید. این مرحله اختیاری است.
        </p>
      </div>

      {/* Accent Bar */}
      <div className="h-1 w-16 bg-primary-700 rounded-full mx-auto mb-8" />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block text-body-2 text-neutral-700 font-medium mb-2">
            نام نمایشی
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-neutral-400"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <input
              id="displayName"
              name="displayName"
              type="text"
              value={formData.displayName}
              onChange={handleChange}
              placeholder="مثال: علی محمدی"
              maxLength={100}
              className="w-full rounded-medium border border-neutral-300 bg-neutral-50 pr-11 pl-4 py-3.5 text-body-1 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent transition-colors"
              dir="rtl"
              disabled={updateProfile.isPending}
            />
          </div>
        </div>

        {/* City */}
        <div>
          <label htmlFor="city" className="block text-body-2 text-neutral-700 font-medium mb-2">
            شهر
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-neutral-400"
                aria-hidden="true"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <input
              id="city"
              name="city"
              type="text"
              value={formData.city}
              onChange={handleChange}
              placeholder="مثال: تهران"
              maxLength={50}
              className="w-full rounded-medium border border-neutral-300 bg-neutral-50 pr-11 pl-4 py-3.5 text-body-1 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent transition-colors"
              dir="rtl"
              disabled={updateProfile.isPending}
            />
          </div>
        </div>

        {/* Occupation */}
        <div>
          <label htmlFor="occupation" className="block text-body-2 text-neutral-700 font-medium mb-2">
            شغل
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-neutral-400"
                aria-hidden="true"
              >
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <input
              id="occupation"
              name="occupation"
              type="text"
              value={formData.occupation}
              onChange={handleChange}
              placeholder="مثال: وکیل دادگستری"
              maxLength={100}
              className="w-full rounded-medium border border-neutral-300 bg-neutral-50 pr-11 pl-4 py-3.5 text-body-1 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent transition-colors"
              dir="rtl"
              disabled={updateProfile.isPending}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="flex items-center gap-2 rounded-medium bg-error-container/30 border border-error/20 px-4 py-3 text-body-2 text-error justify-center"
            role="alert"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Success Message */}
        {saved && (
          <div
            className="flex items-center gap-2 rounded-medium bg-success-container/30 border border-success/20 px-4 py-3 text-body-2 text-success justify-center"
            role="status"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>اطلاعات با موفقیت ذخیره شد. در حال انتقال...</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-3">
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="w-full rounded-medium bg-primary-700 text-white py-3.5 text-button font-semibold hover:bg-primary-800 active:bg-primary-900 transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-700 shadow-elevation-3 hover:shadow-elevation-4"
          >
            {updateProfile.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                در حال ذخیره...
              </span>
            ) : (
              "ذخیره اطلاعات"
            )}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            disabled={updateProfile.isPending}
            className="w-full rounded-medium border-2 border-neutral-200 text-neutral-600 py-3.5 text-button font-medium hover:bg-neutral-50 hover:border-neutral-300 active:bg-neutral-100 transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed"
          >
            بعداً تکمیل می‌کنم
          </button>
        </div>
      </form>
    </div>
  );
}
