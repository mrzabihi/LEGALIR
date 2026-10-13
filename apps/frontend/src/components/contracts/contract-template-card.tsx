// ============================================================
// LEGALIR — Contract template card
// ============================================================
// A TEMPLATE card is inspirational, not a work item: it exists to make
// the user want to start that contract. It answers three questions
// before the click, in order:
//
//   • what is this?      — the artwork, then the exact name + category
//   • what is it for?    — a one-line description
//   • what will I fill?  — how many steps the wizard holds
//
// and then offers a SPECIFIC call to action — «تنظیم قرارداد اجاره»,
// never a generic «شروع» — so the user knows exactly what they are
// about to build.
//
// It is deliberately compact: a fixed 16:9 photograph leads, the text
// block is tightly spaced and clamped, and every card in a row is the
// same height (the grid's `auto-rows-fr` + `h-full` here) so the grid
// never looks ragged. The whole card is ONE real <button> — there is no
// nested interactive element — so keyboard and pointer reach the same
// single action.
//
// The artwork comes from `lib/contracts/artwork` (one image per type).
// A type without a photograph falls back to the hand-built SVG scene in
// `lib/contracts/visuals`, so a freshly-registered contract type still
// renders a coherent card.
// ============================================================

"use client";

import Image from "next/image";
import type { ContractDefinition } from "@/lib/contracts/registry";
import { ContractVisual } from "@/lib/contracts/visuals";
import { contractArtwork } from "@/lib/contracts/artwork";
import { toPersianNumber } from "@/lib/persian-utils";
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
  const artwork = contractArtwork(definition.id);
  // The trailing «بازبینی و پیش‌نمایش» step is not a data-entry topic, so
  // it is not counted — the number reads as "how much will I fill in".
  const stepCount = definition.wizardSteps.filter((s) => s.id !== "review").length;

  return (
    <button
      type="button"
      onClick={() => onStart(definition)}
      disabled={disabled}
      aria-label={`${definition.ctaFa} — ${definition.typeFa}`}
      className="group flex h-full w-full flex-col overflow-hidden rounded-large border border-[color:var(--color-outline-variant)] bg-surface text-right shadow-elevation-1 transition-[box-shadow,border-color] duration-short3 hover:border-primary hover:shadow-elevation-3 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60"
    >
      {/* 16:9 media band — a fixed aspect ratio so every card in a row has
          the same image height and the grid never shifts as art loads. The
          band is the card IDENTITY, not decoration: the title, description
          and CTA below stay the primary content. A quiet tonal fill sits
          behind the image so the empty band (and the SVG fallback) never
          flashes white. */}
      <div className="relative aspect-video w-full overflow-hidden bg-surface-container-low">
        {artwork ? (
          <Image
            src={artwork}
            alt=""
            fill
            sizes="(max-width: 600px) 78vw, (max-width: 900px) 45vw, 30vw"
            className="object-cover transition-transform duration-medium2 ease-standard group-hover:scale-[1.03] motion-reduce:transform-none"
          />
        ) : (
          // No photograph for this type — draw the hand-built scene instead
          // so the card is never a blank rectangle.
          <ContractVisual
            type={definition.id}
            className="h-full w-full transition-transform duration-medium2 ease-standard group-hover:scale-[1.03] motion-reduce:transform-none"
          />
        )}

        {/* Category — a small white glass chip on the leading edge. A
            near-solid white fill with a dark hairline and a soft lift
            reads crisply over ANY part of the art (light or dark photo),
            and stays premium rather than muddy the way a translucent gray
            surface did. */}
        <span className="absolute top-2.5 start-2.5 rounded-full border border-black/[0.06] bg-white/95 px-2 py-0.5 text-labelSmall font-medium text-neutral-800 shadow-elevation-1 backdrop-blur-md">
          {definition.categoryFa}
        </span>

        {/* «جدید» — data-driven and on the OPPOSITE corner from the
            category chip so the two never collide. Renders nothing when
            the type is not flagged new. */}
        {definition.isNew && (
          <span className="absolute top-2.5 end-2.5 rounded-full bg-secondary px-2 py-0.5 text-labelSmall font-medium text-on-secondary">
            جدید
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="line-clamp-2 text-titleMedium text-on-surface">
          {definition.typeFa}
        </h3>
        <p className="line-clamp-2 text-caption leading-5 text-muted">
          {definition.descriptionFa}
        </p>

        {/* The card's single primary action, pinned to the bottom so it
            lines up across a row however long the title runs. The whole
            card is the target; this is the visible affordance. */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
          <span className="text-labelSmall text-muted">
            {toPersianNumber(stepCount)} مرحله
          </span>
          <span className="inline-flex items-center gap-1 text-labelLarge font-medium text-primary">
            {starting ? "در حال ایجاد…" : definition.ctaFa}
            <IconArrowBack className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:-translate-x-0.5" />
          </span>
        </div>
      </div>
    </button>
  );
}
