// ============================================================
// LEGALIR — Contract Center (/contracts/new)
// ============================================================
// The entry point of the Contract Operating System. It lists every
// IMPLEMENTED contract definition from the registry — not a
// hard-coded pair of cards — so a new domain appears here the moment
// its definition is registered.
//
// Picking a type creates the contract server-side and hands off to
// the wizard at the first step. Nothing is created until the user
// commits, so browsing the centre leaves no empty drafts behind.
// ============================================================

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconArrowBack, IconArrowForward, IconContract, IconHome } from "@/lib/icons";
import { implementedContractDefinitions } from "@/lib/contracts/registry";
import { useCreatePropertyContract } from "@/hooks/usePropertyContracts";
import { DEFAULT_PROPERTY_KIND } from "@/lib/api/property-contracts";
import type { ContractTypeId, PropertyContractType } from "@legalir/types";

const ICONS: Record<string, React.ReactNode> = {
  home: <IconHome className="w-6 h-6" />,
  key: <IconContract className="w-6 h-6" />,
};

export default function ContractCenterPage() {
  const router = useRouter();
  const create = useCreatePropertyContract();
  const [error, setError] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<ContractTypeId | null>(null);

  const definitions = implementedContractDefinitions();

  async function start(typeId: ContractTypeId) {
    setError(null);
    setPendingType(typeId);
    try {
      const created = await create.mutateAsync({
        type: typeId as PropertyContractType,
        propertyKind: DEFAULT_PROPERTY_KIND,
        initiatorRole: definitions.find((d) => d.id === typeId)!.defaultInitiatorRole,
      });
      router.push(`/contracts/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ایجاد قرارداد ناموفق بود");
      setPendingType(null);
    }
  }

  return (
    <div className="p-4 tablet:p-6 max-w-4xl mx-auto" dir="rtl">
      <Link
        href="/contracts"
        className="text-caption text-muted hover:text-on-surface inline-flex items-center gap-1 mb-4"
      >
        <IconArrowForward className="w-3.5 h-3.5" />
        بازگشت به فهرست قراردادها
      </Link>

      <header className="mb-6">
        <h1 className="text-h2 text-on-surface">مرکز قراردادها</h1>
        <p className="text-body-2 text-muted mt-1">
          نوع قرارداد را انتخاب کنید. مراحل بعدی به‌صورت گام‌به‌گام و با ذخیره خودکار پیش می‌رود.
        </p>
      </header>

      {error && (
        <div className="rounded-medium border border-error/30 bg-error-50 px-3 py-2.5 text-body-2 text-on-surface mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
        {definitions.map((def) => (
          <button
            key={def.id}
            type="button"
            onClick={() => void start(def.id)}
            disabled={create.isPending}
            className="text-right rounded-large border border-divider bg-surface p-5 shadow-elevation-1 hover:shadow-elevation-3 hover:border-primary/40 transition-all disabled:opacity-60"
          >
            <div
              className={`w-12 h-12 rounded-medium bg-gradient-to-br ${def.gradient} flex items-center justify-center text-white mb-3`}
            >
              {ICONS[def.icon] ?? <IconContract className="w-6 h-6" />}
            </div>
            <h2 className="text-titleMedium text-on-surface">{def.typeFa}</h2>
            <p className="text-caption text-muted mt-1 leading-6">{def.descriptionFa}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-labelSmall rounded-small bg-surface-container px-2 py-0.5 text-muted">
                {def.categoryFa}
              </span>
              <span className="text-labelLarge text-primary inline-flex items-center gap-1">
                {pendingType === def.id && create.isPending ? "در حال ایجاد…" : "شروع"}
                <IconArrowBack className="w-4 h-4" />
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-large border border-divider bg-surface-container-low p-4">
        <h3 className="text-titleSmall text-on-surface mb-1">قراردادهای در جریان</h3>
        <p className="text-caption text-muted leading-6">
          پیش‌نویس‌های نیمه‌تمام شما در فهرست قراردادها ذخیره شده‌اند و از همان مرحله‌ای که رها کرده‌اید ادامه
          می‌یابند.
        </p>
        <Link
          href="/contracts"
          className="inline-flex items-center gap-1 text-labelLarge text-primary hover:underline mt-2"
        >
          مشاهده فهرست قراردادها
          <IconArrowBack className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
