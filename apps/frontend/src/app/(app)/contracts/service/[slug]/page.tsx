// ============================================================
// LEGALIR — Contract service detail route (/contracts/service/[slug])
// ============================================================
// Server shell that owns the SEO surface for one contract-drafting
// service: a per-service <title>, meta description, canonical URL,
// OpenGraph/Twitter cards and BreadcrumbList structured data — all derived
// from the service's own catalog record, so shipping a new service needs
// no change here.
//
// The interactive body is the client `ContractServiceDetailView`; nothing
// is generated and no form exists — this route only describes the service.
//
// NOTE: the singular `/contracts/[id]` route is the contract *instance*
// builder; this nested `service/` segment keeps the two from colliding.

import type { Metadata } from "next";
import Link from "next/link";
import { getContractService } from "@/lib/contract-services";
import { ContractServiceDetailView } from "@/components/contracts/catalog";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getContractService(slug);

  if (!service) {
    return {
      title: "خدمت قراردادی یافت نشد",
      robots: { index: false, follow: false },
    };
  }

  const title = service.seoTitle;
  const description = service.metaDescription;
  const canonical = `/contracts/service/${service.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      locale: "fa_IR",
      siteName: "لیگالیر",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function ContractServicePage({ params }: PageProps) {
  const { slug } = await params;
  const service = getContractService(slug);

  if (!service) return <NotFoundState slug={slug} />;

  // BreadcrumbList — mirrors the visible breadcrumb in the detail view.
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    inLanguage: "fa-IR",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "خانه", item: "/" },
      { "@type": "ListItem", position: 2, name: "قراردادها", item: "/contracts" },
      {
        "@type": "ListItem",
        position: 3,
        name: service.title,
        item: `/contracts/service/${service.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Real data only — every field comes from the service catalog record.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ContractServiceDetailView service={service} />
    </>
  );
}

// ============================================================
// Not found
// ============================================================

function NotFoundState({ slug }: { slug: string }) {
  return (
    <div className="mx-auto max-w-2xl p-4 tablet:p-6" dir="rtl">
      <div className="rounded-large border border-[color:var(--color-outline-variant)] bg-surface-container-low p-8 text-center shadow-elevation-1">
        <h1 className="mb-2 text-h3 font-bold text-on-surface">خدمت قراردادی یافت نشد</h1>
        <p className="mb-5 text-body-2 text-on-surface-variant">
          خدمتی با شناسه «{slug}» در فهرست وجود ندارد.
        </p>
        <Link
          href="/contracts"
          className="inline-flex items-center gap-1.5 rounded-medium bg-primary px-5 py-2.5 text-button font-medium text-white transition-colors hover:bg-primary-700 active:scale-[0.98]"
        >
          بازگشت به فهرست قراردادها
        </Link>
      </div>
    </div>
  );
}
