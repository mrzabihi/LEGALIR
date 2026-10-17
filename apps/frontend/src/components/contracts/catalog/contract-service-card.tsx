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

import Image from "next/image";
import Link from "next/link";
import {
  contractServiceHref,
  getContractCategory,
  type ContractService,
} from "@/lib/contract-services";
import { contractServiceArtwork } from "@/lib/contracts/artwork";
import { IconChevronLeft } from "@/lib/icons";
import { ContractServiceStatusBadge } from "./status-badge";

interface ContractServiceCardProps {
  service: ContractService;
}

export function ContractServiceCard({ service }: ContractServiceCardProps) {
  const category = getContractCategory(service.category);
  const Icon = service.icon;
  // Not every catalog service ships an illustration; the ones that do
  // lead with it so the card reads at a glance, the rest keep the
  // gradient icon block. The image lives in `lib/contracts/artwork`, the
  // one place a service id is mapped to its asset.
  const artwork = contractServiceArtwork(service.id);

  return (
    <Link
      href={contractServiceHref(service)}
      aria-label={`${service.title} — مشاهده خدمت`}
      className="group flex h-full flex-col overflow-hidden rounded-large border border-[color:var(--color-outline-variant)] bg-surface-container-low shadow-elevation-1 transition-all duration-short4 ease-standard hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--color-primary)_30%,transparent)] hover:shadow-elevation-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.99]"
    >
      {/* One fixed-height media band on EVERY card, so titles and CTAs
          share a baseline across a row whether or not art exists. */}
      <div className="relative h-36 w-full shrink-0 overflow-hidden bg-surface-container">
        {artwork ? (
          <Image
            src={artwork}
            alt=""
            fill
            sizes="(max-width: 600px) 92vw, (max-width: 900px) 45vw, 30vw"
            className="object-cover transition-transform duration-medium2 ease-standard group-hover:scale-[1.03] motion-reduce:transform-none"
          />
        ) : (
          // No illustration yet — the category tile carries the band: the
          // brand gradient, a soft glow behind the icon, and a faint
          // blueprint grid, matching the hand-drawn scenes' language.
          <span
            aria-hidden="true"
            className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${category.gradient}`}
          >
            <span className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:28px_28px]" />
            <span className="absolute h-24 w-24 rounded-full bg-white/10 blur-xl" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-large border border-white/25 bg-white/10 text-white shadow-elevation-1 backdrop-blur-sm transition-transform duration-short4 ease-standard group-hover:scale-105">
              <Icon size={30} />
            </span>
          </span>
        )}
        <span className="absolute top-2.5 end-2.5">
          <ContractServiceStatusBadge status={service.status} />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
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
          <p className="text-[10px] text-on-surface-variant opacity-80">{service.note}</p>
        )}

        <span className="flex items-center gap-1 border-t border-[color-mix(in_srgb,var(--color-divider)_60%,transparent)] pt-3 text-caption font-medium text-primary">
          مشاهده خدمت
          <IconChevronLeft
            size={16}
            aria-hidden="true"
            className="transition-transform duration-short4 ease-standard group-hover:-translate-x-0.5"
          />
        </span>
      </div>
    </Link>
  );
}
