// ============================================================
// LEGALIR — Contract service card
// ============================================================
// One catalog entry. The whole card is a real `<Link>` (never a
// div-onClick), so it is keyboard-reachable, middle-clickable and readable
// by assistive tech. It stays visually active — a hover lift and a visible
// focus ring — even though the service is «به‌زودی»: the status is a label,
// not a disabled state.
//
// Card anatomy (exactly as the brief specifies):
//   icon · category · title · short description · «به‌زودی» chip ·
//   «مشاهده خدمت» affordance.

import Link from "next/link";
import {
  contractServiceHref,
  getContractCategory,
  type ContractService,
} from "@/lib/contract-services";
import { IconChevronLeft } from "@/lib/icons";
import { ContractServiceStatusBadge } from "./status-badge";

interface ContractServiceCardProps {
  service: ContractService;
}

export function ContractServiceCard({ service }: ContractServiceCardProps) {
  const category = getContractCategory(service.category);
  const Icon = service.icon;

  return (
    <Link
      href={contractServiceHref(service)}
      aria-label={`${service.title} — مشاهده خدمت`}
      className="group flex h-full flex-col gap-3 rounded-large border border-[color:var(--color-outline-variant)] bg-surface-container-low p-5 shadow-elevation-1 transition-all duration-short4 ease-standard hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--color-primary)_30%,transparent)] hover:shadow-elevation-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${category.gradient} text-white shadow-elevation-1 transition-transform duration-short4 ease-standard group-hover:scale-105`}
        >
          <Icon size={22} />
        </span>
        <ContractServiceStatusBadge status={service.status} />
      </div>

      <div className="flex-1">
        <p className="text-caption font-medium text-primary">{category.title}</p>
        <h3 className="mt-1 text-body-1 font-semibold text-on-surface transition-colors group-hover:text-primary">
          {service.title}
        </h3>
        <p className="mt-1 text-caption leading-relaxed text-on-surface-variant">
          {service.shortDescription}
        </p>
      </div>

      {service.note && (
        <p className="text-[10px] text-on-surface-variant/80">{service.note}</p>
      )}

      <span className="flex items-center gap-1 border-t border-[color-mix(in_srgb,var(--color-divider)_60%,transparent)] pt-3 text-caption font-medium text-primary">
        مشاهده خدمت
        <IconChevronLeft
          size={16}
          aria-hidden="true"
          className="transition-transform duration-short4 ease-standard group-hover:-translate-x-0.5"
        />
      </span>
    </Link>
  );
}
