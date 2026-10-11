"use client";

// ============================================================
// LEGALIR — Legacy checkout route → redirect
// ============================================================
// This page used to render a SIMULATED payment gateway and then show a
// fabricated «پرداخت موفق» screen — a purchase that "succeeded" with no real
// payment. That flow is gone: checkout is now the order-review modal on the
// subscription page, which commits against the server and only activates a
// subscription for a genuinely zero total.
//
// The route is kept so an old link does not 404; it simply redirects into the
// real flow.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyCheckoutRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/subscription");
  }, [router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center" dir="rtl">
      <p className="text-body-2 text-muted">در حال انتقال به صفحهٔ اشتراک…</p>
    </div>
  );
}
