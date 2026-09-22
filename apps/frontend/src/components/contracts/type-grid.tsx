// ============================================================
// LEGALIR — Contract Type Grid
// ============================================================
// The always-visible "start a contract" grid that sits at the top of
// the contracts list. It renders every IMPLEMENTED contract definition
// from the registry, so a new domain shows up here the moment its
// definition is registered — no hard-coded card list.
//
// Layout contract (per product requirement):
//   • The first row is exactly ONE card tall and responsive
//     (1 / 2 / 3 columns by breakpoint).
//   • When more types exist than fit in that first row, the overflow
//     is hidden behind a «مشاهده بیشتر» toggle that reveals a
//     scrollable list.
//
// The one-row height is measured from the first rendered card via a
// ResizeObserver rather than hard-coded, so it stays correct as the
// card content or font metrics change.
// ============================================================

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowBack,
  IconBriefcase,
  IconCar,
  IconChevronDown,
  IconCloud,
  IconCoin,
  IconContract,
  IconHome,
  IconShield,
  IconUsers,
} from "@/lib/icons";
import { implementedContractDefinitions } from "@/lib/contracts/registry";
import { useCreatePropertyContract } from "@/hooks/usePropertyContracts";
import { DEFAULT_PROPERTY_KIND } from "@/lib/api/property-contracts";
import type { ContractTypeId } from "@legalir/types";

const ICONS: Record<string, React.ReactNode> = {
  home: <IconHome className="w-6 h-6" />,
  key: <IconContract className="w-6 h-6" />,
  car: <IconCar className="w-6 h-6" />,
  coin: <IconCoin className="w-6 h-6" />,
  briefcase: <IconBriefcase className="w-6 h-6" />,
  shield: <IconShield className="w-6 h-6" />,
  cloud: <IconCloud className="w-6 h-6" />,
  users: <IconUsers className="w-6 h-6" />,
};

/** Columns rendered per breakpoint — must match the grid classes below. */
const COLUMNS = { base: 1, tablet: 2, desktop: 3 } as const;

export function ContractTypeGrid() {
  const router = useRouter();
  const create = useCreatePropertyContract();
  const [error, setError] = React.useState<string | null>(null);
  const [pendingType, setPendingType] = React.useState<ContractTypeId | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  const definitions = implementedContractDefinitions();

  // --- Measure one card row so the collapsed grid is exactly one row tall ---
  const firstCardRef = React.useRef<HTMLButtonElement | null>(null);
  const [rowHeight, setRowHeight] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = firstCardRef.current;
    if (!el) return;
    const measure = () => setRowHeight(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [definitions.length]);

  // How many cards fit in the first row at the current breakpoint.
  const [columns, setColumns] = React.useState<number>(COLUMNS.base);
  React.useEffect(() => {
    const tablet = window.matchMedia("(min-width: 600px)");
    const desktop = window.matchMedia("(min-width: 1024px)");
    const sync = () =>
      setColumns(desktop.matches ? COLUMNS.desktop : tablet.matches ? COLUMNS.tablet : COLUMNS.base);
    sync();
    tablet.addEventListener("change", sync);
    desktop.addEventListener("change", sync);
    return () => {
      tablet.removeEventListener("change", sync);
      desktop.removeEventListener("change", sync);
    };
  }, []);

  const hasOverflow = definitions.length > columns;

  async function start(typeId: ContractTypeId) {
    setError(null);
    setPendingType(typeId);
    try {
      const created = await create.mutateAsync({
        type: typeId,
        propertyKind: DEFAULT_PROPERTY_KIND,
        initiatorRole: definitions.find((d) => d.id === typeId)!.defaultInitiatorRole,
      });
      router.push(`/contracts/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ایجاد قرارداد ناموفق بود");
      setPendingType(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-titleSmall text-on-surface">شروع قرارداد جدید</h2>
        {hasOverflow && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 rounded-medium px-2 py-1 text-caption text-primary hover:bg-primary/10 transition-colors touch-target"
          >
            {expanded ? "بستن" : "مشاهده بیشتر"}
            <IconChevronDown
              size={16}
              className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-medium border border-error/30 bg-error-50 px-3 py-2.5 text-body-2 text-on-surface">
          {error}
        </div>
      )}

      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-out"
        style={
          expanded
            ? { maxHeight: "60vh", overflowY: "auto" }
            : rowHeight != null
              ? { maxHeight: rowHeight }
              : undefined
        }
      >
        <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
          {definitions.map((def, i) => (
            <button
              key={def.id}
              ref={i === 0 ? firstCardRef : undefined}
              type="button"
              onClick={() => void start(def.id)}
              disabled={create.isPending}
              className="text-right rounded-large border border-divider bg-surface p-5 shadow-elevation-1 hover:shadow-elevation-3 hover:border-primary/40 transition-all disabled:opacity-60"
            >
              <div
                className={`w-12 h-12 rounded-medium bg-gradient-to-br ${def.gradient} flex items-center justify-center text-white mb-3`}
              >
                {ICONS[def.icon] ?? <IconContract className="w-6 h-6" />}
              </div>
              <h3 className="text-titleMedium text-on-surface">{def.typeFa}</h3>
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
        </div>
      </div>
    </section>
  );
}
