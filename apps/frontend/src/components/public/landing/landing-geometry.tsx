// ============================================================
// LEGALIR — Geometric colour blocking
// ============================================================
// A small, fixed vocabulary of shapes placed behind content: a cobalt
// disc, an outlined ring, and a tinted colour field. They give the hero,
// the services band and the finale an editorial anchor the way a magazine
// sets a colour block behind a photograph.
//
// Two placement rules came out of looking at the rendered page:
//
//   • A shape that is CLIPPED by the section edge reads as a rendering
//     artifact, not as a design decision — a low-alpha square cut in half
//     by `overflow: hidden` is indistinguishable from a stray gradient.
//     Every shape here is therefore fully inside the viewport at the
//     breakpoint where it appears.
//   • A tint at 3–5% alpha needs a hard edge to read as a block. The
//     colour field is a solid token fill with a radius; only the discs are
//     soft, because a soft circle reads as depth rather than as a panel.
//
// Nothing is rotated, animated, or gradient-filled, and the whole layer is
// `aria-hidden` + `pointer-events: none`: it carries no information the
// copy does not already state. On phones it is dropped entirely — at 390px
// there is no empty margin for these shapes and they would only crowd the
// text.

import type { CSSProperties, ReactNode } from "react";

export type GeometryVariant = "hero" | "services" | "cta";

function shape(className: string, style: CSSProperties, key: string): ReactNode {
  return <span key={key} className={className} style={style} />;
}

const LAYOUT: Record<GeometryVariant, ReactNode> = {
  /* Hero — one soft cobalt disc in the top-start corner, behind the
     headline. It echoes the circle the illustration itself is built
     around, so the mark reads as part of the same drawing rather than as
     an added ornament. */
  hero: shape(
    "landing-geometry__disc",
    { width: "30rem", height: "30rem", insetBlockStart: "-11rem", insetInlineStart: "-9rem" },
    "disc"
  ),

  /* Services band — a flat colour field filling the empty column beside
     the section header. It only appears from `laptop`, where the header
     stops at 42rem and leaves a real gap for it; any earlier and it would
     sit under the copy. */
  services: shape(
    "landing-geometry__field hidden laptop:block",
    { width: "21rem", height: "12rem", insetBlockStart: "5.5rem", insetInlineEnd: "2.5rem" },
    "field"
  ),

  /* Closing CTA — the page's last glass panel. A tinted disc sits fully
     inside the frame behind it, which is what gives the backdrop blur an
     edge to soften; without a subject the panel's translucency is
     invisible and the blur is a no-op. */
  cta: shape(
    "landing-geometry__disc landing-geometry__disc--soft",
    { width: "19rem", height: "19rem", insetBlockStart: "-5rem", insetInlineEnd: "-4rem" },
    "disc"
  ),
};

export function LandingGeometry({ variant }: { variant: GeometryVariant }) {
  return (
    <div
      className="landing-geometry hidden tablet:block"
      aria-hidden="true"
      data-ln-depth="1"
    >
      {LAYOUT[variant]}
    </div>
  );
}
