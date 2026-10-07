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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SegmentedControl } from "@legalir/ui";
import { CONTRACT_SERVICE_COUNT } from "@/lib/contract-services";
import { toPersianNumber } from "@/lib/persian-utils";
import { ContractList } from "./contract-list";
import { ContractCatalog } from "./catalog";
import { ContractsPageHeader } from "./contracts-page-header";

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

  return (
    <div className="mx-auto max-w-[1400px] p-4 tablet:p-6" dir="rtl">
      {/* The header is shared by BOTH views, so it stays pixel-identical
          when the user switches — the brief's "header stays fixed". It is
          the same `ContractsPageHeader` the workspace has always used. */}
      <ContractsPageHeader />

      {/* The view switcher. Full-width on phones (comfortable targets),
          content-width from tablet up. */}
      <div className="mb-6 flex">
        <SegmentedControl
          ariaLabel="نمای قراردادها"
          idBase={ID_BASE}
          value={view}
          onChange={setView}
          className="w-full tablet:w-auto"
          segments={[
            { value: "active", label: "قراردادهای فعال" },
            { value: "coming-soon", label: "بزودی" },
          ]}
        />
      </div>

      {/* Active view — the workspace (my contracts + template library). */}
      {view === "active" ? (
        <section
          id={`${ID_BASE}-panel-active`}
          role="tabpanel"
          aria-labelledby={`${ID_BASE}-tab-active`}
          tabIndex={0}
          className="animate-fade-in focus-visible:outline-none"
        >
          <ContractList />
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
          className="animate-fade-in focus-visible:outline-none"
        >
          <div className="mb-5">
            <h2 className="text-h3 font-bold text-on-surface">قراردادهای در دست توسعه</h2>
            <p className="mt-1 max-w-2xl text-body-2 text-on-surface-variant">
              {toPersianNumber(CONTRACT_SERVICE_COUNT)} خدمت قراردادی که به‌تدریج فعال می‌شوند.
              جزئیات و قابلیت‌های هر خدمت را ببینید و در صورت نیاز با وکیل متخصص مشورت کنید.
            </p>
          </div>
          <ContractCatalog embedded paramPrefix="soon-" />
        </section>
      )}
    </div>
  );
}
