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

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  IconArrowBack,
  IconArrowForward,
  IconBriefcase,
  IconBusiness,
  IconCar,
  IconCloud,
  IconCoin,
  IconContract,
  IconDatabase,
  IconHome,
  IconShield,
  IconUsers,
} from "@/lib/icons";
import { implementedContractDefinitions } from "@/lib/contracts/registry";
import { useCreatePropertyContract } from "@/hooks/usePropertyContracts";
import { DEFAULT_PROPERTY_KIND } from "@/lib/api/property-contracts";
import {
  CLOUD_SERVICE_MODEL_DESCRIPTIONS_FA,
  CLOUD_SERVICE_MODEL_LABELS_FA,
  cloudContractTypeFor,
  type CloudServiceModel,
  type ContractTypeId,
  type PropertyContractType,
} from "@legalir/types";

const ICONS: Record<string, React.ReactNode> = {
  home: <IconHome className="w-6 h-6" />,
  key: <IconContract className="w-6 h-6" />,
  store: <IconBusiness className="w-6 h-6" />,
  server: <IconDatabase className="w-6 h-6" />,
  car: <IconCar className="w-6 h-6" />,
  coin: <IconCoin className="w-6 h-6" />,
  briefcase: <IconBriefcase className="w-6 h-6" />,
  shield: <IconShield className="w-6 h-6" />,
  cloud: <IconCloud className="w-6 h-6" />,
  users: <IconUsers className="w-6 h-6" />,
};

// Cloud service is ONE family with three service models. The picker shows a
// single «خدمات ابری» card and asks for IaaS / PaaS / BaaS BEFORE any draft is
// created, so the service model is chosen deliberately rather than inferred
// from whichever card the user tapped. The chosen model maps to its own
// registered contract type, so it is recorded in the type and in the document
// title/specs from the first save onward.
const CLOUD_TYPE_IDS: ContractTypeId[] = ["cloud_iaas", "cloud_paas", "cloud_baas"];
const CLOUD_MODELS: CloudServiceModel[] = ["iaas", "paas", "baas"];

export default function ContractCenterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const create = useCreatePropertyContract();
  const [error, setError] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<ContractTypeId | null>(null);
  const [cloudOpen, setCloudOpen] = useState(false);

  const definitions = implementedContractDefinitions();
  // One card per family: the three cloud types collapse into a single
  // «خدمات ابری» card that first asks which service model to draft.
  const listedDefinitions = definitions.filter((d) => !CLOUD_TYPE_IDS.includes(d.id));
  const cloudDefinition = definitions.find((d) => d.id === "cloud_iaas") ?? null;

  const start = useCallback(
    async (typeId: ContractTypeId) => {
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
    },
    [create, definitions, router]
  );

  const startCloud = useCallback(
    (model: CloudServiceModel) => {
      setCloudOpen(false);
      void start(cloudContractTypeFor(model));
    },
    [start]
  );

  // Deep-link support: `/contracts/new?type=nda` (used by the /services
  // catalog and the NDA campaign banner) starts that contract straight
  // away, so the link lands the user in the wizard rather than on a
  // picker they have to navigate again. A missing or unknown `type`
  // falls through to the normal picker. The ref guards against
  // StrictMode double-invoking the effect and creating two drafts.
  const autoStarted = useRef(false);
  const requestedType = searchParams.get("type");

  useEffect(() => {
    if (autoStarted.current) return;
    if (!requestedType) return;
    const match = definitions.find((d) => d.id === requestedType);
    if (!match) return;
    autoStarted.current = true;
    void start(match.id);
  }, [requestedType, definitions, start]);

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
        <div className="rounded-medium border border-error bg-error-container px-3 py-2.5 text-body-2 text-on-surface mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
        {listedDefinitions.map((def) => (
          <button
            key={def.id}
            type="button"
            onClick={() => void start(def.id)}
            disabled={create.isPending}
            className="text-right rounded-large border border-divider bg-surface p-5 shadow-elevation-1 hover:shadow-elevation-3 hover:border-primary transition-all disabled:opacity-60"
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

        {cloudDefinition && (
          <button
            type="button"
            onClick={() => setCloudOpen(true)}
            disabled={create.isPending}
            className="text-right rounded-large border border-divider bg-surface p-5 shadow-elevation-1 hover:shadow-elevation-3 hover:border-primary transition-all disabled:opacity-60"
          >
            <div
              className={`w-12 h-12 rounded-medium bg-gradient-to-br ${cloudDefinition.gradient} flex items-center justify-center text-white mb-3`}
            >
              {ICONS[cloudDefinition.icon] ?? <IconContract className="w-6 h-6" />}
            </div>
            <h2 className="text-titleMedium text-on-surface">قرارداد خدمات ابری</h2>
            <p className="text-caption text-muted mt-1 leading-6">
              پیش از شروع، نوع خدمت ابری — زیرساخت (IaaS)، بستر (PaaS) یا بک‌اند (BaaS) — را انتخاب
              می‌کنید و همان مدل در عنوان و مشخصات قرارداد ثبت می‌شود.
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-labelSmall rounded-small bg-surface-container px-2 py-0.5 text-muted">
                کسب‌وکار
              </span>
              <span className="text-labelLarge text-primary inline-flex items-center gap-1">
                انتخاب نوع خدمت
                <IconArrowBack className="w-4 h-4" />
              </span>
            </div>
          </button>
        )}
      </div>

      {cloudOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCloudOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-model-title"
            className="w-full max-w-lg rounded-large bg-surface p-5 shadow-elevation-5"
          >
            <h2 id="cloud-model-title" className="text-titleMedium text-on-surface">
              نوع خدمت ابری را انتخاب کنید
            </h2>
            <p className="text-caption text-muted mt-1 leading-6">
              انتخاب شما تعیین می‌کند کدام فیلدها، سطوح سرویس و تعهدات در قرارداد بیاید؛ مدل انتخابی
              در عنوان و مشخصات قرارداد ثبت می‌شود.
            </p>
            <div className="mt-4 space-y-2">
              {CLOUD_MODELS.map((model) => {
                const typeId = cloudContractTypeFor(model);
                const busy = pendingType === typeId && create.isPending;
                return (
                  <button
                    key={model}
                    type="button"
                    onClick={() => startCloud(model)}
                    disabled={create.isPending}
                    className="w-full text-right rounded-medium border border-divider bg-surface-container-low p-3 hover:border-primary hover:bg-surface-container transition-colors disabled:opacity-60"
                  >
                    <span className="block text-labelLarge text-on-surface">
                      {CLOUD_SERVICE_MODEL_LABELS_FA[model]}
                    </span>
                    <span className="block text-caption text-muted mt-0.5 leading-6">
                      {CLOUD_SERVICE_MODEL_DESCRIPTIONS_FA[model]}
                    </span>
                    <span className="block text-caption text-primary mt-1">
                      {busy ? "در حال ایجاد…" : "انتخاب و شروع"}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setCloudOpen(false)}
              className="mt-4 w-full rounded-medium border border-divider py-2 text-labelLarge text-muted hover:text-on-surface"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

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
