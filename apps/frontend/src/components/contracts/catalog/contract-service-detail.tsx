// ============================================================
// LEGALIR — Contract service detail view
// ============================================================
// The body of /contracts/service/[slug]. It is purely presentational: the
// route looks the service up and hands it in, so this file renders only
// what the catalog data declares.
//
// Honesty rules baked in here:
//   • a `coming-soon` service says so plainly and offers an honest
//     activation CTA (a real request, see `ActivateServiceCta`) plus a
//     path to a real lawyer;
//   • an `active` service links into the existing contract wizard — wired
//     now, unreachable until a service's status flips to `active`;
//   • there is NO form, NO clause engine and NO generated contract text.

import Link from "next/link";
import {
  getContractCategory,
  type ContractService,
} from "@/lib/contract-services";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { IconArrowBack, IconCheck, IconInfo } from "@/lib/icons";
import { ContractServiceStatusBadge } from "./status-badge";
import { ActivateServiceCta } from "./activate-service-cta";
import { ContractLawyerSuggestion } from "./contract-lawyer-suggestion";

interface ContractServiceDetailViewProps {
  service: ContractService;
}

export function ContractServiceDetailView({ service }: ContractServiceDetailViewProps) {
  const category = getContractCategory(service.category);
  const Icon = service.icon;
  const isComingSoon = service.status === "coming-soon";

  return (
    <div className="mx-auto max-w-5xl p-4 tablet:p-6" dir="rtl">
      <Breadcrumb
        items={[
          { label: "خانه", href: "/" },
          { label: "قراردادها", href: "/contracts" },
          { label: service.title },
        ]}
      />

      {/* --- Hero --- */}
      <div className="rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface-container-low p-5 shadow-elevation-1 tablet:p-6">
        <div className="flex flex-col gap-4 tablet:flex-row tablet:items-start">
          <span
            aria-hidden="true"
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-large bg-gradient-to-br ${category.gradient} text-white shadow-elevation-1`}
          >
            <Icon size={28} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/contracts?category=${category.id}`}
                className="rounded-small text-caption font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {category.title}
              </Link>
              <ContractServiceStatusBadge status={service.status} variant="long" />
            </div>

            <h1 className="mt-1.5 text-h2 font-bold text-on-surface">{service.title}</h1>
            <p className="mt-2 text-body-1 leading-relaxed text-on-surface-variant">
              {service.description}
            </p>

            {service.note && (
              <p className="mt-2 inline-flex rounded-small bg-surface-container px-2.5 py-1 text-caption text-on-surface-variant">
                {service.note}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* --- Not-yet-active notice --- */}
      {isComingSoon && (
        <div
          role="note"
          className="mt-4 flex items-start gap-3 rounded-large border border-warning-200 bg-warning-50 p-4"
        >
          <IconInfo size={20} className="mt-0.5 shrink-0 text-warning-700" aria-hidden="true" />
          <div>
            <p className="text-body-2 font-medium text-warning-700">این خدمت هنوز فعال نشده است</p>
            <p className="mt-0.5 text-caption leading-relaxed text-warning-700/90">
              در حال آماده‌سازی این خدمت هستیم. تا آن زمان می‌توانید درخواست خود را ثبت کنید تا پس
              از فعال‌سازی به شما اطلاع دهیم، یا همین حالا با وکیل متخصص مشاوره بگیرید.
            </p>
          </div>
        </div>
      )}

      {/* --- What this service will include --- */}
      <section
        aria-labelledby="service-features-title"
        className="mt-6 rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface p-5 tablet:p-6"
      >
        <h2 id="service-features-title" className="text-h4 font-bold text-on-surface">
          در این خدمت چه مواردی پیش‌بینی شده است؟
        </h2>
        <p className="mt-1 text-caption text-on-surface-variant">
          فهرست زیر قابلیت‌هایی است که این خدمت در آینده ارائه خواهد کرد.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-2.5 tablet:grid-cols-2">
          {service.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-body-2 text-on-surface">
              <IconCheck size={18} className="mt-0.5 shrink-0 text-success-700" aria-hidden="true" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* --- Activation CTA --- */}
      <section
        aria-labelledby="service-cta-title"
        className="mt-6 rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface-container-low p-5 tablet:p-6"
      >
        {isComingSoon ? (
          <>
            <h2 id="service-cta-title" className="text-h4 font-bold text-on-surface">
              هر وقت فعال شد، به شما اطلاع می‌دهیم
            </h2>
            <p className="mt-1 mb-4 text-body-2 text-on-surface-variant">
              با ثبت درخواست، پس از فعال‌سازی این خدمت در بخش «مشاوره‌های من» اطلاع‌رسانی می‌شوید.
              این درخواست به معنی تولید یا تنظیم قرارداد نیست.
            </p>
            <ActivateServiceCta serviceTitle={service.title} />
          </>
        ) : (
          <>
            <h2 id="service-cta-title" className="text-h4 font-bold text-on-surface">
              شروع تنظیم قرارداد
            </h2>
            <p className="mt-1 mb-4 text-body-2 text-on-surface-variant">
              این خدمت فعال است و می‌توانید روند تنظیم قرارداد را آغاز کنید.
            </p>
            <Link
              href="/contracts/new"
              className="inline-flex w-full items-center justify-center gap-2 rounded-medium bg-primary px-6 py-3 text-button font-medium text-white transition-colors hover:bg-primary-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 touch-target tablet:w-auto"
            >
              شروع تنظیم قرارداد
            </Link>
          </>
        )}
      </section>

      {/* --- Related lawyers (real, verified roster) --- */}
      <div className="mt-6">
        <ContractLawyerSuggestion
          specialties={service.recommendedLawyerSpecialties}
          title="وکیل متخصص این قرارداد"
          description="برای بررسی و تنظیم دقیق‌تر، می‌توانید با وکیل متخصص این حوزه مشاوره بگیرید."
        />
      </div>

      {/* --- Back --- */}
      <div className="mt-6">
        <Link
          href="/contracts"
          className="inline-flex items-center gap-1.5 rounded-small text-body-2 font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <IconArrowBack size={18} aria-hidden="true" className="rtl-flip" />
          بازگشت به فهرست قراردادها
        </Link>
      </div>
    </div>
  );
}
