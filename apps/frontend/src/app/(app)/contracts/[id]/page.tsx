// ============================================================
// LEGALIR — Contract detail (/contracts/[id])
// ============================================================
// ONE route for BOTH contract lifecycles, because the hub lists both and
// every card links here:
//
//   • Contract-OS contract → the builder/wizard shell. The owner-scoped
//     detail endpoint returns the contract WITH its server-computed
//     completeness, so the shell never has to guess progress.
//   • Legacy V1 contract   → the V1 detail view (preview, risk, versions,
//     attachments). A V1 id has no OS record, so the OS fetch 404s; that
//     404 is the switch, not an error.
//
// A 404 from the OS API is deliberate: it never distinguishes "does not
// exist" from "belongs to someone else", so a leaked id is useless.
// ============================================================

"use client";

import React, { use } from "react";
import Link from "next/link";
import { Button, buttonClasses } from "@legalir/ui";
import { usePropertyContract } from "@/hooks/usePropertyContracts";
import { useContractDetail } from "@/hooks/useContracts";
import { ContractBuilder } from "@/components/contracts/builder/wizard-shell";
import { ContractDetailView } from "@/components/contracts/contract-detail";

function BuilderContent({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = usePropertyContract(id);

  // The contracts hub lists BOTH lifecycles and every card links to this
  // one route. A legacy V1 contract has no Contract-OS record, so the OS
  // fetch answers 404 — that is the signal to render the V1 detail view
  // instead of a dead end. The V1 query stays disabled for OS contracts,
  // so the common path issues no extra request.
  const notFoundInOs = isError && /یافت نشد|404/.test((error as Error)?.message ?? "");
  const v1 = useContractDetail(notFoundInOs ? id : undefined);

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
    // Legacy V1 contract: render the real detail view it owns (preview,
    // risk, versions, attachments) rather than the OS "not found" card.
    if (notFoundInOs && v1.data) {
      return (
        <div className="mx-auto w-full max-w-[1120px] p-4 tablet:p-6">
          <ContractDetailView contract={v1.data} />
        </div>
      );
    }
    // Still resolving the V1 fallback — never flash "not found" first.
    if (notFoundInOs && v1.isLoading) {
      return (
        <div className="mx-auto w-full max-w-[1120px] p-4 tablet:p-6" dir="rtl" aria-label="در حال بارگذاری">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-surface-container rounded-small" />
            <div className="h-4 w-40 bg-surface-container rounded-small" />
            <div className="h-64 bg-surface-container rounded-large" />
          </div>
        </div>
      );
    }
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
              <Button type="button" onClick={() => void refetch()}>
                تلاش مجدد
              </Button>
            )}
            <Link href="/contracts" className={buttonClasses({ variant: "outlined" })}>
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
