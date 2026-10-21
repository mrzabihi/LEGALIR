// ============================================================
// LEGALIR — Landing exhibit block
// ============================================================
// The unit of the museum narrative: one chapter mark, one illustration
// mounted on a plate, one title, one short message, and (optionally) one
// real action.
//
// Three rules keep the page from turning into a card wall:
//   • The illustration is the subject, not a decoration: it is rendered at
//     the full width of its column with its 1:1 ratio intact, never
//     cropped to a banner and never scaled past its source pixels.
//   • Every exhibit differs in composition. `variant` changes the plate
//     treatment and the column ratio; `flip` moves the media to the other
//     side. Two consecutive exhibits never share both.
//   • Nothing here is interactive unless the caller passes an action, so a
//     non-linked plate never looks like a button.
//
// The subject matter is unchanged: the caller supplies the copy (it comes
// from the page's content inventory), and the manifest supplies only the
// art and its wall label.

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ExhibitArt } from "./exhibits";
import { IconChevronLeft } from "@/lib/icons";

type PlateVariant = "mist" | "bare" | "cobalt";

export interface LandingExhibitProps {
  /** Chapter number, Latin digits, e.g. "01". Purely a catalogue mark. */
  index: string;
  /** Short label that sits next to the numeral (e.g. «مسئله»). */
  chapter: string;
  /**
   * The plate for this scene. Optional on purpose: one chapter is a
   * wall-text room with no drawing. The alternative was the only unused
   * illustration in the set — a classical column, which is on the brief's
   * forbidden list — so the room is set in type instead of illustrated
   * with a cliché.
   */
  art?: ExhibitArt;
  /** A second plate in the same scene. Used only where two drawings carry
   *  one idea (before/after, one contract / several domains). The pair
   *  shares the media column and stacks on phones. */
  secondaryArt?: ExhibitArt;
  title: string;
  body: ReactNode;
  /** Optional real action. Omit when the exhibit is purely narrative. */
  action?: { href: string; label: string };
  /** Moves the plate to the opposite column from the previous exhibit. */
  flip?: boolean;
  /** Column weighting: `wide` gives the media more room than the text. */
  scale?: "wide" | "narrow" | "even";
  /** Plate treatment. Defaults to a mounted plate on the mist fill. */
  variant?: PlateVariant;
  /** Shown under the plate as the museum wall label. */
  showCaption?: boolean;
  /** Small supporting detail printed beneath the body copy. */
  footnote?: ReactNode;
  className?: string;
  id?: string;
}

const SCALE_CLASS: Record<NonNullable<LandingExhibitProps["scale"]>, string> = {
  wide: "landing-exhibit--wide-media",
  narrow: "landing-exhibit--narrow-media",
  even: "",
};

const PLATE_CLASS: Record<PlateVariant, string> = {
  mist: "landing-plate",
  bare: "landing-plate landing-plate--bare",
  cobalt: "landing-plate bg-[color:var(--ln-cobalt-soft)]",
};

/** One mounted work: plate + drawing + wall label. */
function Plate({
  art,
  index,
  variant,
  showCaption,
  sizes,
}: {
  art: ExhibitArt;
  index: string;
  variant: PlateVariant;
  showCaption: boolean;
  sizes: string;
}) {
  return (
    <figure className="m-0 min-w-0">
      <div
        className={PLATE_CLASS[variant]}
        data-ln-parallax={variant === "bare" ? undefined : "1"}
      >
        <Image
          src={art.src}
          alt={art.alt}
          width={art.width}
          height={art.height}
          // Half of a 1200px container on a 2× screen. The source is
          // 1024², so asking for more than that would only upscale.
          sizes={sizes}
          className="h-auto w-full select-none"
          loading="lazy"
          draggable={false}
        />
      </div>

      {showCaption && (
        <figcaption className="mt-3 flex items-baseline gap-2 border-t border-[color:var(--ln-line)] pt-2.5">
          {index && (
            <span className="shrink-0 text-[11px] font-semibold tracking-[0.12em] text-[color:var(--ln-faint)]">
              {index}
            </span>
          )}
          <span className="text-[12px] leading-6 text-[color:var(--ln-muted)]">
            {art.caption.title} — {art.caption.note}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

export function LandingExhibit({
  index,
  chapter,
  art,
  secondaryArt,
  title,
  body,
  action,
  flip = false,
  scale = "even",
  variant = "mist",
  showCaption = true,
  footnote,
  className = "",
  id,
}: LandingExhibitProps) {
  const headingId = id ? `${id}-title` : undefined;

  return (
    <div
      className={`landing-exhibit ${SCALE_CLASS[scale]} ${flip ? "landing-exhibit--flip" : ""} ${
        !art ? "landing-exhibit--walltext" : secondaryArt ? "landing-exhibit--pair" : ""
      } ${className}`}
    >
      {/* ---- Media ---------------------------------------------------- */}
      <div className="landing-exhibit__media" data-ln-reveal="0">
        {!art ? (
          // Wall-text room. The numeral is printed at display size on the
          // empty wall, which is the only thing that changes the page's
          // rhythm between two illustrated chapters without introducing a
          // second visual language.
          <div className="landing-walltext">
            <span className="landing-walltext__num" aria-hidden="true">
              {index}
            </span>
            <span className="landing-walltext__rule" aria-hidden="true" />
          </div>
        ) : secondaryArt ? (
          // Two works, one idea. The second plate is deliberately smaller
          // and sits on its own baseline so the pair reads as a comparison,
          // not as two equal panels.
          <div className="landing-exhibit__pair grid w-full grid-cols-2 gap-3 tablet:gap-4">
            <Plate
              art={art}
              index={index}
              variant={variant}
              showCaption={showCaption}
              sizes="(min-width: 900px) 24vw, 46vw"
            />
            <div className="landing-exhibit__pair-offset mt-8 tablet:mt-10">
              <Plate
                art={secondaryArt}
                index=""
                variant={variant}
                showCaption={showCaption}
                sizes="(min-width: 900px) 22vw, 42vw"
              />
            </div>
          </div>
        ) : (
          <Plate
            art={art}
            index={index}
            variant={variant}
            showCaption={showCaption}
            // Below 900px the plate is one cell of the bento row — about
            // half the measure — so asking for a full-width variant would
            // download twice the pixels the tile can ever show.
            sizes="(min-width: 900px) 46vw, 50vw"
          />
        )}
      </div>

      {/* ---- Copy ----------------------------------------------------
          Three elements, not one. Desktops stack them in a single column and
          see exactly the old reading order. Phones use them as bento cells:
          the chapter rule shares a two-cell header row with the plate, the
          title then runs the full measure, and the body copy sits under both.
          Splitting the block is what removes the "one picture owning a whole
          screen, then a block of text" pattern without hiding any copy — the
          chapter mark, the heading and the paragraph are the same elements
          either way. Each part carries its own reveal index so GSAP still
          animates real boxes. */}
      <div className="landing-exhibit__mark min-w-0" data-ln-reveal="1">
        <p className="landing-chapter">
          <span className="landing-chapter__num">{index}</span>
          <span>{chapter}</span>
        </p>
      </div>

      <div className="landing-exhibit__head min-w-0" data-ln-reveal="2">
        <h2
          id={headingId}
          className="landing-exhibit__title text-[clamp(1.5rem,1.1rem+1.5vw,2rem)] font-bold leading-[1.3] tracking-[-0.015em] text-[color:var(--ln-ink)] [text-wrap:balance]"
        >
          {title}
        </h2>
      </div>

      <div className="landing-exhibit__text min-w-0" data-ln-reveal="3">
        <div className="landing-deck">{body}</div>

        {footnote && (
          <p className="mt-4 text-[13px] leading-7 text-[color:var(--ln-muted)]">
            {footnote}
          </p>
        )}

        {action && (
          <Link href={action.href} className="landing-btn landing-btn--secondary mt-7">
            {action.label}
            <IconChevronLeft size={17} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
