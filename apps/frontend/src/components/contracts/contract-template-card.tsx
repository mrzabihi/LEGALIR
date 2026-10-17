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
// TWO distinct actions, deliberately not merged:
//   • «پیش‌نمایش» — a quiet overlay on the artwork that opens the
//     structure preview dialog (steps, parties, documents, registration).
//   • the CTA    — «تنظیم قرارداد اجاره», never a generic «شروع» — the
//     ONE committing action, pinned to the card's bottom edge.
//
// Splitting them means the preview can never accidentally create a
// draft, and the start button can never be confused with "look inside".
// They are siblings, never nested: the artwork button covers only the
// media band, so both are reachable by keyboard independently.
//
// The card is compact on purpose: a fixed-height media band leads, the
// text block is tightly spaced and clamped, and every card in a row is
// the same height (`auto-rows-fr` on the grid + `h-full` here).
// ============================================================

"use client";

import Image from "next/image";
import type { ContractDefinition } from "@/lib/contracts/registry";
import { ContractVisual } from "@/lib/contracts/visuals";
import { contractArtwork } from "@/lib/contracts/artwork";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconArrowBack, IconEye } from "@/lib/icons";
import { Button } from "@legalir/ui";

interface ContractTemplateCardProps {
  definition: ContractDefinition;
  /** Start a new contract of this type. */
  onStart: (definition: ContractDefinition) => void;
  /** Open the structure preview for this template. */
  onPreview?: (definition: ContractDefinition) => void;
  /** True while this card's contract is being created. */
  starting?: boolean;
  /** True while any card is being created (disables the rest). */
  disabled?: boolean;
}

export function ContractTemplateCard({
  definition,
  onStart,
  onPreview,
  starting = false,
  disabled = false,
}: ContractTemplateCardProps) {
  const artwork = contractArtwork(definition.id);
  // The trailing «بازبینی و پیش‌نمایش» step is not a data-entry topic, so
  // it is not counted — the number reads as "how much will I fill in".
  const stepCount = definition.wizardSteps.filter((s) => s.id !== "review").length;
  const requiredDocCount = definition.requiredDocuments.filter((d) => d.required).length;

  return (
    <article className="group flex h-full w-full flex-col overflow-hidden rounded-large border border-[color:var(--color-outline-variant)] bg-surface text-right shadow-elevation-1 transition-[box-shadow,border-color] duration-short3 can-hover:hover:border-[color:var(--color-outline)] can-hover:hover:shadow-elevation-3 focus-within:border-primary">
      {/* Fixed-height media band — the card IDENTITY, not decoration. A
          quiet tonal fill sits behind the image so the empty band (and
          the SVG fallback) never flashes white. The whole band is the
          preview trigger; the visible chip names the action so a pointer
          user never has to guess. */}
      <div className="relative h-40 w-full overflow-hidden bg-surface-container-low">
        {artwork ? (
          <Image
            src={artwork}
            alt=""
            fill
            sizes="(max-width: 600px) 92vw, (max-width: 900px) 45vw, 30vw"
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

        {onPreview && (
          <button
            type="button"
            onClick={() => onPreview(definition)}
            aria-label={`پیش‌نمایش ${definition.typeFa}`}
            className="absolute inset-0 flex items-start justify-start bg-gradient-to-t from-black/45 via-transparent to-transparent p-3 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          >
            <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.06] bg-white/95 px-2 py-0.5 text-labelSmall font-medium text-neutral-800 shadow-elevation-1 backdrop-blur-md transition-colors duration-short3 group-hover:bg-white">
              <IconEye size={13} aria-hidden="true" />
              پیش‌نمایش
            </span>
          </button>
        )}

        {/* Category — a small white glass chip on the trailing edge (the
            preview chip owns the leading one). A near-solid white fill
            with a dark hairline and a soft lift reads crisply over ANY
            part of the art (light or dark photo). Pointer-events stay off
            it so the band below is still one clean preview target. */}
        <span className="pointer-events-none absolute top-2.5 end-12 rounded-full border border-black/[0.06] bg-white/95 px-2 py-0.5 text-labelSmall font-medium text-neutral-800 shadow-elevation-1 backdrop-blur-md">
          {definition.categoryFa}
        </span>

        {/* «جدید» — data-driven and on the OPPOSITE corner from the
            category chip so the two never collide. Renders nothing when
            the type is not flagged new. */}
        {definition.isNew && (
          <span className="pointer-events-none absolute bottom-2.5 end-2.5 rounded-full bg-secondary px-2 py-0.5 text-labelSmall font-medium text-on-secondary">
            جدید
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="line-clamp-2 text-titleMedium text-on-surface">
          {definition.typeFa}
        </h3>
        <p className="line-clamp-2 text-caption leading-5 text-muted">
          {definition.descriptionFa}
        </p>

        {/* The real facts about the work — steps and mandatory documents.
            Pinned above the action so a card's metadata lines up across
            a row however long the title runs. */}
        <p className="mt-auto flex items-center gap-1.5 pt-2 text-labelSmall text-muted">
          <span>{toPersianNumber(stepCount)} مرحله</span>
          <span aria-hidden="true">·</span>
          <span>{toPersianNumber(requiredDocCount)} مدرک الزامی</span>
        </p>

        {/* The card's single primary action. */}
        <Button
          type="button"
          size="small"
          fullWidth
          onClick={() => onStart(definition)}
          loading={starting}
          disabled={disabled}
          endIcon={!starting ? <IconArrowBack size={16} aria-hidden="true" /> : undefined}
          className="mt-1 px-3 text-labelMedium"
        >
          {starting ? "در حال ایجاد…" : definition.ctaFa}
        </Button>
      </div>
    </article>
  );
}
