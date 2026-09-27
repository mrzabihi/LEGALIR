// ============================================================
// LEGALIR — New services section
// ============================================================
// The mid-page «خدمات جدید» area. Every entry comes from
// `NEW_SERVICES`, and each one carries an honest status: `available`
// renders a working CTA, `soon` renders a status badge instead of a
// link. Nothing here ever shows a CTA that cannot be fulfilled.
//
// Composition — this is the part that was wrong before. The section
// used to be a three-column grid with the NDA promotion squeezed into
// one column beside two short cards, which left a tall, mostly-empty
// tile and a cramped CTA. Now:
//
//   • the NDA promotion is the *feature*: a full-width, deliberately
//     short banner (copy on one side, artwork on the other) that uses
//     the whole section width;
//   • the remaining services sit in a balanced row of secondary cards
//     below it, so there is no unexplained empty area;
//   • the feature is rendered once — it is not repeated as a card.
//
// The layout is driven by the data, not by a hard-coded count: the
// feature is the NDA campaign, and any service pointing at the same
// destination is filtered out of the secondary row, so the promotion
// can never appear twice. Adding or removing a new service stays
// intentional.
// ============================================================

"use client";

import Link from "next/link";
import { IconChevronRight, IconSparkle } from "@/lib/icons";
import { CampaignBanner } from "./campaign-banner";
import { NDA_CAMPAIGN, type NewServiceDef } from "@/lib/services/catalog";

interface NewServicesProps {
  services: NewServiceDef[];
}

export function NewServices({ services }: NewServicesProps) {
  // The feature is the NDA campaign. Any service that points at the
  // same destination is dropped from the secondary row so the same
  // promotion is never shown as both a banner and a card.
  const secondary = services.filter((service) => service.href !== NDA_CAMPAIGN.href);

  return (
    <section aria-labelledby="new-services-title">
      <div className="mb-4 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-medium bg-secondary-100 text-secondary-800"
        >
          <IconSparkle size={18} />
        </span>
        <div>
          <h2 id="new-services-title" className="text-h3 font-bold text-on-surface">
            خدمات جدید
          </h2>
          <p className="text-caption text-on-surface-variant">
            تازه‌ترین قابلیت‌های اضافه‌شده به لیگالیر
          </p>
        </div>
      </div>

      {/* ---- Feature: the wide NDA banner ---- */}
      <CampaignBanner banner={NDA_CAMPAIGN} size="wide" />

      {/* ---- Secondary: the remaining new services ---- */}
      {secondary.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-3 tablet:grid-cols-2">
          {secondary.map((service) => {
            const Icon = service.icon;
            const available = service.status === "available";

            const body = (
              <>
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-surface-container text-on-surface-variant"
                >
                  <Icon size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-titleSmall font-semibold text-on-surface">
                    {service.title}
                  </span>
                  <span className="mt-1 block text-body-2 leading-relaxed text-on-surface-variant">
                    {service.description}
                  </span>
                </span>
              </>
            );

            const shell =
              "flex h-full items-start gap-3 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4";

            if (!available) {
              return (
                <li key={service.id}>
                  <div className={`${shell} opacity-80`}>
                    {body}
                    <span className="shrink-0 self-center rounded-full border border-outline-variant bg-surface-container px-2.5 py-0.5 text-caption text-on-surface-variant">
                      {service.statusLabel ?? "به‌زودی"}
                    </span>
                  </div>
                </li>
              );
            }

            return (
              <li key={service.id}>
                <Link
                  href={service.href}
                  className={`${shell} group transition-all duration-short4 ease-standard hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--color-primary)_30%,transparent)] hover:shadow-elevation-3 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)] touch-target`}
                >
                  {body}
                  <IconChevronRight
                    size={18}
                    className="shrink-0 self-center text-muted transition-transform duration-short4 ease-standard group-hover:-translate-x-0.5"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
