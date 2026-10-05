// ============================================================
// LEGALIR — Calculator detail (محاسبه‌گر) — server shell
// ============================================================
// Owns the route's SEO surface: per-calculator <title>, meta
// description, canonical URL, OpenGraph/Twitter cards and FAQPage
// structured data. All of it is derived from the calculator's own
// definition, so a new calculator needs no change here.
//
// The interactive form + result live in the client `CalculatorWorkspace`
// child; this module stays a server component so metadata and JSON-LD
// are emitted in the initial HTML.

import type { Metadata } from "next";
import Link from "next/link";
import { getCalculator, CALCULATOR_CATEGORY_FA } from "@/lib/calculators";
import { CalculatorWorkspace } from "./calculator-workspace";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const calc = getCalculator(slug);
  if (!calc) {
    return {
      title: "محاسبه‌گر یافت نشد",
      robots: { index: false, follow: false },
    };
  }

  const { def } = calc;
  const title = `${def.titleFa} — ${def.subtitleFa}`;
  const description = def.descriptionFa;
  const canonical = `/calculators/${def.slug}`;

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

export default async function CalculatorDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const calc = getCalculator(slug);

  if (!calc) return <NotFoundState slug={slug} />;

  const { def } = calc;

  // FAQPage structured data — emitted only when the calculator actually
  // declares FAQs, and built verbatim from those Q/A pairs (no invented
  // content). Google requires the visible text to match the markup.
  const faqJsonLd =
    def.faq && def.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: "fa-IR",
          mainEntity: def.faq.map((item) => ({
            "@type": "Question",
            name: item.qFa,
            acceptedAnswer: { "@type": "Answer", text: item.aFa },
          })),
        }
      : null;

  // BreadcrumbList — mirrors the visible breadcrumb in the workspace.
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    inLanguage: "fa-IR",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "محاسبه‌گرها",
        item: "/calculators",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: def.titleFa,
        item: `/calculators/${def.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Real data only — every field comes from the calculator record.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <CalculatorWorkspace slug={slug} />
    </>
  );
}

// ============================================================
// Not found
// ============================================================

function NotFoundState({ slug }: { slug: string }) {
  return (
    <div className="p-4 tablet:p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] p-8 shadow-elevation-1 text-center">
        <div className="text-4xl mb-4" aria-hidden="true">🔍</div>
        <h1 className="text-h3 text-on-surface font-bold mb-2">
          محاسبه‌گر یافت نشد
        </h1>
        <p className="text-body-2 text-on-surface-variant mb-5">
          محاسبه‌گری با شناسه «{slug}» وجود ندارد.
        </p>
        <Link
          href="/calculators"
          className="inline-flex items-center gap-1.5 rounded-medium bg-primary text-white px-5 py-2.5 text-button font-medium hover:bg-primary-700 transition-colors active:scale-[0.98]"
        >
          بازگشت به فهرست محاسبه‌گرها
        </Link>
      </div>
    </div>
  );
}
