// ============================================================
// LEGALIR — Contract template card
// ============================================================
// A TEMPLATE card is inspirational, not a work item: it exists to make
// the user want to start that contract. So it leads with a 16:9
// illustration (never a bare outline icon), then the title, the
// description and a single "شروع" call to action.
//
// It is deliberately different from `UserContractCard`, which is a
// work item — status, progress, last change, resume. The two must
// never look interchangeable.
// ============================================================

"use client";

import type { ContractDefinition } from "@/lib/contracts/registry";
import { ContractVisual } from "@/lib/contracts/visuals";
import { IconArrowBack } from "@/lib/icons";

interface ContractTemplateCardProps {
  definition: ContractDefinition;
  /** Start a new contract of this type. */
  onStart: (definition: ContractDefinition) => void;
  /** True while this card's contract is being created. */
  starting?: boolean;
  /** True while any card is being created (disables the rest). */
  disabled?: boolean;
}

export function ContractTemplateCard({
  definition,
  onStart,
  starting = false,
  disabled = false,
}: ContractTemplateCardProps) {
  return (
    <button
      type="button"
      onClick={() => onStart(definition)}
      disabled={disabled}
      aria-label={`شروع ${definition.typeFa}`}
      className="group flex h-full w-full flex-col text-right rounded-large border border-divider bg-surface overflow-hidden shadow-elevation-1 hover:shadow-elevation-3 hover:border-primary/40 transition-all duration-short3 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-60"
    >
      {/* 16:9 illustration — a fixed aspect ratio so every card in a row has
          the same image height and a grid never shifts as visuals load. */}
      <div className="relative aspect-video w-full overflow-hidden bg-surface-container-low">
        <ContractVisual
          type={definition.id}
          className="h-full w-full transition-transform duration-medium2 ease-standard group-hover:scale-[1.03]"
        />
        <span className="absolute top-3 start-3 rounded-full bg-surface/90 px-2.5 py-0.5 text-labelSmall text-on-surface shadow-elevation-1">
          {definition.categoryFa}
        </span>
        {/* «جدید» badge — data-driven, opposite corner from the category
            badge so the two never overlap. Renders nothing when not new. */}
        {definition.isNew && (
          <span className="absolute top-3 end-3 rounded-full bg-secondary px-2.5 py-0.5 text-labelSmall text-on-secondary shadow-elevation-1">
            جدید
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 tablet:p-4">
        <h3 className="line-clamp-2 text-titleMedium text-on-surface">
          {definition.typeFa}
        </h3>
        <p className="mt-1 flex-1 line-clamp-2 text-caption leading-6 text-muted">
          {definition.descriptionFa}
        </p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-labelSmall text-muted">
            {definition.wizardSteps.length} مرحله
          </span>
          <span className="inline-flex items-center gap-1 text-labelLarge text-primary">
            {starting ? "در حال ایجاد…" : "شروع"}
            <IconArrowBack className="w-4 h-4" />
          </span>
        </div>
      </div>
    </button>
  );
}
