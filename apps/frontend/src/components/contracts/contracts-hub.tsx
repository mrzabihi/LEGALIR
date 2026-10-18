// ============================================================
// LEGALIR — Contracts hub (the unified /contracts surface)
// ============================================================
// One page, two peer views, switched in place:
//
//   • «قراردادهای فعال»       — the user's own contracts + the template
//                              library (the former /contracts/my workspace)
//   • «بزودی»                 — the future contract services (the former
//                              /contracts discovery catalog)
//
// The switcher is a real Material SegmentedControl, NOT links between two
// routes: changing the view must never reload the page, must never move
// the URL path, and must leave the app shell (sidebar / header / bottom
// nav) untouched. Only the panel content changes.
//
// The selected view lives in `?view=active` (default) / `?view=coming-soon`
// so it survives refresh, deep-linking and Back/Forward, and writes via
// `router.replace` so switching adds no history entries. The header is
// shared by both views, so it stays pixel-identical across a switch.
//
// The template library and the contract list keep their own URL-backed
// filters, and the embedded catalog namespaces ITS two keys (`soon-q` /
// `soon-category`) so the two filter sets never collide on one URL.
// ============================================================

"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SegmentedControl } from "@legalir/ui";
import { COMING_SOON_CONTRACT_SERVICE_COUNT } from "@/lib/contract-services";
import { toPersianNumber } from "@/lib/persian-utils";
import { ContractList } from "./contract-list";
import { ContractCatalog } from "./catalog";
import { ContractsPageHeader } from "./contracts-page-header";
import { ContractPathCards } from "./contract-path-cards";
import { PageContainer } from "@/components/shared/page-container";

const ID_BASE = "contracts-view";
type ContractView = "active" | "coming-soon";

export function ContractsHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view: ContractView =
    searchParams.get("view") === "coming-soon" ? "coming-soon" : "active";

  // Replace, never push: switching a view is not a navigation the user
  // should have to "Back" out of. Other params (the workspace filters, the
  // catalog's namespaced filters) are preserved untouched.
  const setView = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "coming-soon") params.set("view", "coming-soon");
      else params.delete("view");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // The view switcher is the SAME element in both views and sits just
  // BELOW the search card: the active view hands it to `ContractList`
  // (which renders it right under its search card), the coming-soon view
  // renders it above its heading. One element ⇒ the two views can never
  // drift, and the switcher never floats above the search.
  const viewSwitcher = (
    <div className="flex justify-start">
      <SegmentedControl
        ariaLabel="نمای قراردادها"
        idBase={ID_BASE}
        value={view}
        onChange={setView}
        glow
        className="w-full tablet:w-auto"
        segments={[
          { value: "active", label: "قراردادهای فعال" },
          { value: "coming-soon", label: "بزودی" },
        ]}
      />
    </div>
  );

  return (
    <PageContainer dir="rtl">
      {/* The header is shared by BOTH views, so it stays pixel-identical
          when the user switches — the brief's "header stays fixed". It is
          the same `ContractsPageHeader` the workspace has always used. */}
      <ContractsPageHeader />

      {/* The page's TWO product paths — the primary content. They sit
          directly under the title and ABOVE the search, because choosing
          "build or review" is the first decision; searching the template
          library only makes sense after that. Rendered outside the view
          panels, so switching views never moves them. */}
      <ContractPathCards className="mt-3 tablet:mt-4" />

      {/* Active view — the workspace (my contracts + template library). */}
      {view === "active" ? (
        <section
          id={`${ID_BASE}-panel-active`}
          role="tabpanel"
          aria-labelledby={`${ID_BASE}-tab-active`}
          tabIndex={0}
          className="mt-3 tablet:mt-4 animate-fade-in focus-visible:outline-none"
        >
          <ContractList headerSlot={viewSwitcher} />
        </section>
      ) : (
        /* Coming-soon view — the future contract services. The embedded
           catalog drops its own hero (this panel supplies the heading) and
           namespaces its filter keys under `soon-`. */
        <section
          id={`${ID_BASE}-panel-coming-soon`}
          role="tabpanel"
          aria-labelledby={`${ID_BASE}-tab-coming-soon`}
          tabIndex={0}
          className="mt-3 tablet:mt-4 animate-fade-in focus-visible:outline-none"
        >
          {viewSwitcher}
          <div className="mt-4 mb-5">
            <h2 className="text-h3 font-bold text-on-surface">قراردادهای در دست توسعه</h2>
            <p className="mt-1 max-w-2xl text-body-2 text-on-surface-variant">
              {toPersianNumber(COMING_SOON_CONTRACT_SERVICE_COUNT)} خدمت قراردادی که به‌تدریج فعال می‌شوند.
              جزئیات و قابلیت‌های هر خدمت را ببینید و در صورت نیاز با وکیل متخصص مشورت کنید.
            </p>
          </div>
          {COMING_SOON_CONTRACT_SERVICE_COUNT > 0 ? (
            <ContractCatalog embedded paramPrefix="soon-" filterStatus="coming-soon" />
          ) : (
            <div className="rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface-container-low p-6 text-center">
              <p className="text-body-1 font-semibold text-on-surface">
                همهٔ خدمات قراردادی فعال شده‌اند
              </p>
              <p className="mt-1.5 text-body-2 text-on-surface-variant">
                در حال حاضر هیچ خدمتی در دست توسعه نیست. می‌توانید از فهرست کامل قراردادهای فعال
                استفاده کنید.
              </p>
              <Link
                href="/contracts"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-medium bg-primary px-6 py-2.5 text-button font-medium text-primary-on transition-colors hover:bg-primary-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                مشاهده قراردادهای فعال
              </Link>
            </div>
          )}
        </section>
      )}
    </PageContainer>
  );
}
