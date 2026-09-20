// ============================================================
// LEGALIR — Property Contract Builder (/contracts/[id])
// ============================================================
// Loads one contract through the owner-scoped detail endpoint and
// hands it to the wizard shell. The server returns the contract
// together with its server-computed completeness, so the shell never
// has to guess how far along the user is.
//
// A 404 here is deliberate: the API never distinguishes "does not
// exist" from "belongs to someone else", so a leaked id is useless.
// ============================================================

"use client";

import React, { use } from "react";
import Link from "next/link";
import { usePropertyContract } from "@/hooks/usePropertyContracts";
import { ContractBuilder } from "@/components/contracts/builder/wizard-shell";
import { IconArrowForward } from "@/lib/icons";

function BuilderContent({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = usePropertyContract(id);

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-background p-4 tablet:p-6"
        dir="rtl"
        aria-label="در حال بارگذاری"
      >
        <div className="max-w-6xl mx-auto animate-pulse space-y-4">
          <div className="h-8 w-64 bg-surface-container rounded-small" />
          <div className="h-4 w-40 bg-surface-container rounded-small" />
          <div className="h-2 w-full bg-surface-container rounded-full" />
          <div className="h-64 bg-surface-container rounded-large" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    const notFound = error instanceof Error && /یافت نشد|404/.test(error.message);
    return (
      <div className="min-h-screen bg-background p-4 tablet:p-6" dir="rtl">
        <div className="max-w-lg mx-auto mt-16 rounded-large border border-divider bg-surface p-8 text-center shadow-elevation-1">
          <h2 className="text-h3 text-on-surface mb-2">
            {notFound ? "قرارداد یافت نشد" : "خطا در دریافت قرارداد"}
          </h2>
          <p className="text-body-2 text-muted mb-5">
            {notFound
              ? "این قرارداد وجود ندارد یا به حساب شما تعلق ندارد."
              : ((error as Error)?.message ?? "خطای نامشخص")}
          </p>
          <div className="flex gap-3 justify-center">
            {!notFound && (
              <button
                type="button"
                onClick={() => void refetch()}
                className="rounded-medium bg-primary text-primary-on px-5 h-10 text-labelLarge"
              >
                تلاش مجدد
              </button>
            )}
            <Link
              href="/contracts"
              className="rounded-medium border border-outline text-primary px-5 h-10 text-labelLarge inline-flex items-center"
            >
              بازگشت به فهرست
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <ContractBuilder contract={data} completeness={data.completeness} />;
}

export default function ContractBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BuilderContent id={id} />;
}
