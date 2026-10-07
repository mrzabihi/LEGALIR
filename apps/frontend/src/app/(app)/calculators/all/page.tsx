// ============================================================
// LEGALIR — All calculators (/calculators/all) — server shell
// ============================================================
// The destination of every «مشاهدهٔ همه» affordance. It owns the route's
// SEO surface (per-section <title>, description, canonical) and renders
// the interactive client grid. The grid reads the `category` / `status`
// / `q` query params so a category link from the home page lands here
// already filtered.
//
// `useSearchParams` requires a Suspense boundary, so the client child is
// wrapped here and the shell itself stays a server component.
// ============================================================

import { Suspense } from "react";
import type { Metadata } from "next";
import { AllCalculators } from "./all-calculators";

export const metadata: Metadata = {
  title: "همهٔ محاسبه‌گرهای حقوقی",
  description:
    "فهرست کامل محاسبه‌گرهای حقوقی و مالی لیگالیر با جستجو و فیلتر بر پایه دسته‌بندی و مبنای قانونی — هزینه دادرسی، حق‌الوکاله، دیه، مالیات، مهریه، ارث و بیشتر.",
  alternates: { canonical: "/calculators/all" },
  openGraph: {
    type: "website",
    title: "همهٔ محاسبه‌گرهای حقوقی | لیگالیر",
    description: "فهرست کامل محاسبه‌گرهای حقوقی و مالی مستند بر پایه قوانین و تعرفه‌های رسمی ایران.",
    url: "/calculators/all",
    locale: "fa_IR",
    siteName: "لیگالیر",
  },
};

export default function AllCalculatorsPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <AllCalculators />
    </Suspense>
  );
}

/** Lightweight placeholder shown while the client grid hydrates. */
function CatalogSkeleton() {
  return (
    <div className="mx-auto max-w-6xl p-4 tablet:p-6" dir="rtl" aria-hidden="true">
      <div className="mb-5 h-8 w-56 rounded-medium bg-surface-container" />
      <div className="mb-6 h-14 w-full rounded-medium bg-surface-container" />
      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-44 rounded-large bg-surface-container" />
        ))}
      </div>
    </div>
  );
}
