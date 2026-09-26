// ============================================================
// LEGALIR — New services strip
// ============================================================
// The mid-page «خدمات جدید» area. Every entry comes from
// `NEW_SERVICES`, and each one carries an honest status: `available`
// renders a working CTA, `soon` renders a status badge instead of a
// link. Nothing here ever shows a CTA that cannot be fulfilled.
// ============================================================

"use client";

import Link from "next/link";
import { IconChevronRight, IconSparkle } from "@/lib/icons";
import type { NewServiceDef } from "@/lib/services/catalog";

interface NewServicesProps {
  services: NewServiceDef[];
}

export function NewServices({ services }: NewServicesProps) {
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

      <ul className="grid grid-cols-1 gap-3 tablet:grid-cols-3">
        {services.map((service) => {
          const Icon = service.icon;
          const available = service.status === "available";

          const body = (
            <>
              <span
                aria-hidden="true"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${service.gradient} text-white shadow-elevation-1`}
              >
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body-2 font-semibold text-on-surface">
                  {service.title}
                </span>
                <span className="mt-1 block text-caption leading-relaxed text-on-surface-variant">
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
    </section>
  );
}
