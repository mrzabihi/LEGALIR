// ============================================================
// LEGALIR — New consultation (PART 25)
// ============================================================
// Hosts the consultation wizard. The optional `lawyerId` search param is
// the Path A entry: the user clicked a specific lawyer on /lawyers or a
// profile, and that choice must survive every step (and a mid-flow sign-in).
// ============================================================

"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ConsultationWizard } from "@/components/consultations/consultation-wizard";

function NewConsultation() {
  const searchParams = useSearchParams();
  const lawyerId = searchParams.get("lawyerId");

  return (
    <div className="mx-auto max-w-3xl p-4 tablet:p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="mb-2 text-h2 text-on-surface">درخواست مشاوره با وکیل</h1>
        <p className="text-body-2 text-muted">
          موضوع را شرح دهید، در صورت نیاز سند پیوست کنید و وکیل مناسب را انتخاب کنید. پس از
          پذیرش وکیل، گفت‌وگو در پرونده‌ای خصوصی و مخصوص همین مشاوره انجام می‌شود.
        </p>
      </div>
      <ConsultationWizard initialLawyerId={lawyerId} />
    </div>
  );
}

export default function NewConsultationPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl p-4 tablet:p-6" dir="rtl">
          <div className="h-64 animate-pulse rounded-2xl bg-surface-container" />
        </div>
      }
    >
      <NewConsultation />
    </Suspense>
  );
}
