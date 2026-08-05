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
    <div className="rounded-large bg-surface p-8 shadow-elevation-4">
      <h1 className="text-h3 text-on-surface mb-2 text-center">تکمیل اطلاعات</h1>
      <p className="text-body-2 text-muted mb-6 text-center">
        برای تجربه بهتر، اطلاعات خود را تکمیل کنید. می‌توانید بعداً هم این کار را انجام دهید.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block text-body-2 text-on-surface mb-1">
            نام نمایشی
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            value={formData.displayName}
            onChange={handleChange}
            placeholder="مثال: علی محمدی"
            maxLength={100}
            className="w-full rounded-medium border border-border bg-background px-4 py-3 text-body-1 text-on-surface placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            dir="rtl"
            disabled={updateProfile.isPending}
          />
        </div>

        {/* City */}
        <div>
          <label htmlFor="city" className="block text-body-2 text-on-surface mb-1">
            شهر
          </label>
          <input
            id="city"
            name="city"
            type="text"
            value={formData.city}
            onChange={handleChange}
            placeholder="مثال: تهران"
            maxLength={50}
            className="w-full rounded-medium border border-border bg-background px-4 py-3 text-body-1 text-on-surface placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            dir="rtl"
            disabled={updateProfile.isPending}
          />
        </div>

        {/* Occupation */}
        <div>
          <label htmlFor="occupation" className="block text-body-2 text-on-surface mb-1">
            شغل
          </label>
          <input
            id="occupation"
            name="occupation"
            type="text"
            value={formData.occupation}
            onChange={handleChange}
            placeholder="مثال: وکیل دادگستری"
            maxLength={100}
            className="w-full rounded-medium border border-border bg-background px-4 py-3 text-body-1 text-on-surface placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            dir="rtl"
            disabled={updateProfile.isPending}
          />
        </div>

        {error && (
          <p className="text-body-2 text-error text-center" role="alert">
            {error}
          </p>
        )}

        {saved && (
          <p className="text-body-2 text-success text-center" role="status">
            اطلاعات با موفقیت ذخیره شد. در حال انتقال...
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="w-full rounded-medium bg-primary text-white py-3 text-button hover:bg-primary-variant transition-colors touch-target disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateProfile.isPending ? "در حال ذخیره..." : "ذخیره اطلاعات"}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            disabled={updateProfile.isPending}
            className="w-full rounded-medium border border-border text-on-surface py-3 text-button hover:bg-background transition-colors touch-target disabled:opacity-50 disabled:cursor-not-allowed"
          >
            بعداً تکمیل می‌کنم
          </button>
        </div>
      </form>
    </div>
  );
}
