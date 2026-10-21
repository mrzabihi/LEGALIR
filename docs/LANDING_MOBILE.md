# The mobile landing: composition, measurements, rollback

What the phone version of `/` is built from, the numbers that justify each
decision, and how to put it back the way it was. Every measurement below was
taken on this machine (12 logical CPUs, Windows 10, Node 20, Chromium via
Playwright, `next dev --turbopack` on `:3000`) on **2026-10-21**, using
`e2e/_mobile-measure.spec.ts` — the command is at the end.

The rule this document serves is the same one `VERIFICATION_LOOP.md` states:
**a check you skip is not a check you passed.** So the layout claims are not
prose. Each one is either a number in this file or an assertion in
`e2e/landing-polish.spec.ts`.

---

## 1. What changed, and where it lives

| Piece | File | Commit |
|---|---|---|
| the twelve-room catalogue itself | `src/app/(home)/page.tsx`, `src/app/globals.css` | `bcf7adc` |
| the exhibit's four-cell bento grammar | `globals.css:3764-4052`, `landing-exhibit.tsx:145-243` | `56eff8e` |
| the 4:5 hero plate at its real ratio | `exhibits.ts:48-60`, `page.tsx:404-443`, `globals.css:3643-3691` | `56eff8e` |
| the closing room on the same grammar | `globals.css:3693-3762`, `page.tsx:1071-1111` | `56eff8e` |
| services bento (1 → 2 → 3 columns) | `landing-services.tsx:288-307` | `15a4bea` |
| the wall-text room's plate on phones | `globals.css:3861-3912` | `6f934b9` |
| the phone invariants in the gate | `e2e/landing-polish.spec.ts:332-391` | `6f934b9` |

Nothing here touches a shared component. The landing keeps its own
`.landing`-scoped `--ln-*` token layer (`globals.css:3446-3600`), which is why
a layout change on `/` cannot move `/pricing`, `/about` or `/auth/mobile`.

Breakpoints are the project's own (`tailwind.config.ts:465-472`): `mobile-s`
320, `mobile-l` 375, `tablet` 600, `laptop` 900, `desktop` 1024, `wide` 1440.

---

## 2. The grammar, per section

The old page was a ladder: a paragraph, then a picture at the full measure,
then a paragraph. On a phone that reads as a slideshow — you scroll one
screen, a drawing fills it, you scroll again. The rewrite splits every block
into named cells so the drawing becomes **one cell of a composition** instead
of a band of its own, and not one word of copy is hidden to achieve it.

| Section | Below 900px | At and above 900px |
|---|---|---|
| **Hero** | plate 74% of the figure, capped at 24rem, aligned to the reading-start edge; caption directly under it at the same width | plate capped at 30rem, centred; caption under it |
| **Exhibit room** | `"media mark" / "head head" / "text text"` — plate and chapter rule share the first row, rule bottom-aligned to the plate's lower edge; title and body each run the full measure | `"media ." / "media mark" / "media head" / "media text"` — the original two-column magazine spread |
| **Comparison room** (rooms ۶, ۷, ۱۱) | `mark / head / media / text` — the pair is the one full-measure beat on the page, because a comparison needs the width | the same two-column spread as its neighbours, with the pair inside the media column |
| **Wall-text room** (room ۱۰) | a 1:1 tile borrowing the plate's surface (canvas fill, hairline, radius); numeral sized `48cqi` against the tile | back to the bare wall: `min-height: 14rem`, numeral `clamp(4.5rem, 3rem + 6vw, 9rem)`, hairline rule visible |
| **Services** | 1 column below 375px, 2 columns 375–599px, featured card spans the measure | 3 columns |
| **Blog** | one editorial row per post, number / title+excerpt / metadata stacked | `3.5rem · 1fr · auto`, baselines aligned |
| **FAQ** | one column, header above the disclosure list | header in a sticky 0.8fr column beside a 1.2fr list |
| **Finale** | `"mark art" / "copy copy"` — the same header-row grammar as an exhibit | `"art mark" / "art copy"`, art centred |

Two details in that table are worth their own line, because both were bugs
before they were decisions:

- **`flip` is written as grid areas, not `order`.** On this RTL page `order`
  would have reversed the text inside the block along with the plate. Areas
  mirror the plate and leave the reading order alone.
- **The wall-text numeral switches off `tabular-nums` below 900px.** Tabular
  figures give each digit a full-em advance, which at `48cqi` pushed «۱» and
  «۰» far enough apart that the pair stopped reading as one number.

---

## 3. Measurements

### 3.1 Width sweep

`overflow` is `scrollWidth − clientWidth`; the constant `−6 px` is the
scrollbar gutter, i.e. no positive overflow at any width. `hero screens` and
`max plate` are rendered height ÷ viewport height (844 px). `hero served` is
the `w=` variant `next/image` actually chose.

| width | overflow | CLS | LCP | LCP element | hero served | hero box | hero screens | max plate | exhibit h |
|---|---|---|---|---|---|---|---|---|---|
| 320 | −6 | **0** | 1044 ms | `img.landing-hero__img` | w=256 | 203×253 | 0.30 | 0.18 | 335–807 |
| 360 | −6 | **0** | 776 ms | `img.landing-hero__img` | w=256 | 232×290 | 0.34 | 0.21 | 331–769 |
| 390 | −6 | **0** | 904 ms | `img.landing-hero__img` | w=256 | 255×318 | 0.38 | 0.23 | 341–698 |
| 430 | −6 | **0** | 724 ms | `img.landing-hero__img` | w=320 | 284×355 | 0.42 | 0.26 | 331–719 |
| 768 | −6 | **0** | 748 ms | `img.landing-hero__img` | w=375 | 368×460 | 0.55 | 0.47 | 496–884 |
| 834 | −6 | **0** | 736 ms | `img.landing-hero__img` | w=375 | 368×460 | 0.55 | 0.51 | 527–921 |
| 1024 | −6 | **0** | 1068 ms | `img.landing-hero__img` | w=600 | 435×544 | 0.64 | 0.61 | 257–970 |
| 1440 | −6 | **0** | 772 ms | `img.landing-hero__img` | w=600 | 480×600 | 0.71 | 0.77 | 224–858 |

Reading the table:

- **The hero is the LCP element at every width.** That is the intended outcome
  of replacing the old hero with the 4:5 plate: the first screen is supposed
  to be dominated by the commissioned portrait. LCP 724–1068 ms is a warm dev
  server on localhost, not a field measurement — treat it as a relative signal
  (which element paints last) rather than an absolute budget.
- **`max plate` ≤ 0.26 on phones.** The bound the gate enforces is 0.5; the
  shipped numbers clear it by a factor of two. This is the measurement that
  says "no drawing owns a screen any more".
- **The 0.5 bound is a phone bound.** At 768 and 834 the largest non-hero
  plate is 0.47 and 0.51, because ≥600px moves to the tablet grammar where a
  plate is legitimately half the spread. The sweep deliberately gates
  320/360/390/430 only — asserting 0.5 at 834 would be asserting the wrong
  thing about the wrong layout.
- **`exhibit h` spread is the bento working.** The range is wide on purpose:
  rooms carry different copy lengths and different tile weights
  (`wide-media` 1.45fr, plain 1.15fr, `narrow-media` 0.82fr). Uniform heights
  would mean clipped copy, which is the failure the two-up services grid was
  rejected for the first time.

### 3.2 Per-room detail at 390px

`mark/media` are the top offsets of the chapter rule and the plate, measured
from the room's own top. Equal-ish values on the plate axis plus a larger rule
offset is the header-row grammar: same row, rule bottom-aligned.

| room | height | plate box | mark/media top | title | body |
|---|---|---|---|---|---|
| ۰۱ | 498 | 194×194 | 203 / 22 | full | full |
| ۰۲ | 698 | 175×175 | 184 / 22 | full | full |
| ۰۳ | 421 | 148×148 | 157 / 22 | full | full |
| ۰۴ | 372 | 175×175 | 184 / 22 | full | full |
| ۰۵ | 372 | 175×175 | 184 / 22 | full | full |
| ۰۶ | 461 | 344×186 (pair) | 22 / 106 | full | full |
| ۰۷ | 492 | 344×186 (pair) | 22 / 106 | full | full |
| ۰۸ | 448 | 175×175 | 184 / 22 | full | full |
| ۰۹ | 452 | 148×148 | 157 / 22 | full | full |
| ۱۰ | 341 | 175×175 (wall-text) | 184 / 22 | full | full |
| ۱۱ | 491 | 344×186 (pair) | 22 / 106 | full | full |
| ۱۲ | 344 | 148×148 | 157 / 22 | full | full |

The three shapes are exactly the three grammars: a tile beside its rule, a
pair strip under its rule, and the wall-text tile — which measures **175×175**,
i.e. square, which is what makes it sit in the row like the drawings do. At
834px that same tile measures **392×392** (square, `aspect-ratio: 1`), against
224 px tall for the desktop room at 1024 and 1440 where it correctly reverts to
the wall.

### 3.3 Image weight

Source set on disk: **18 files, 4.28 MB** — 17 room plates plus the hero,
96 KB – 530 KB each (`public/assets/landing/`). Two of the seventeen are
referenced by no route and never ship: `minimal-14-legal-precision` (the brief's
ban, §5) and `minimal-15-human-meets-ai`. So the page renders from **16
plates**, which is the `16` in the last row below. What a phone actually
downloads:

| | 320 | 390 | 430 | 834 | 1440 |
|---|---|---|---|---|---|
| cold, above the fold | **36.6 KB** | **56.5 KB** | **62.4 KB** | 139.4 KB | 260.2 KB |
| full page, after a full scroll | 144 KB | 144 KB | 150 KB | — | — |
| image elements on the page | 16 | 16 | 16 | 16 | 16 |
| lazy, not requested yet at rest | 14 | 14 | 14 | 14 | 14 |

Three things produce those numbers:

1. **`sizes` matches the CSS exactly.** A single plate asks for
   `(min-width: 900px) 46vw, 50vw` (`landing-exhibit.tsx:195`), a pair for
   `24vw/46vw` and `22vw/42vw`, the hero for
   `(min-width: 900px) 30rem, (min-width: 600px) 23rem, 65vw`
   (`page.tsx:428`). The served variant tracks the box: 256 → 320 → 375 → 600
   across the sweep, never 1440.
2. **`priority` on the hero only.** It is the one above-the-fold image, so it
   gets the preload; the preload carries the full `imageSrcSet` plus the same
   `imageSizes`, so the preloaded candidate and the rendered candidate agree.
   Every other plate is `loading="lazy"`.
3. **Real intrinsic dimensions.** `exhibits.ts` declares 1024² for the set and
   1024×1280 for the hero, so `next/image` reserves the box before the bytes
   land.

The hero plate is the clearest single number: **287 KB on disk, 15.2 KB served
at 320px** — 18.9× smaller — and the whole twelve-room page costs **144 KB of
images on a phone**, against a 4.28 MB source set (30×).

### 3.4 CLS

**CLS is 0.0000 at every width, at rest and across a full-page scroll** (the
scroll pass walks the document one screen at a time with a 220 ms settle, then
waits for the last lazy plates to decode). No layout-shift entry is recorded
at all, so there is no "small but non-zero" residual to explain.

That is the direct result of the two rules in §3.3 plus one more:
`.landing-exhibit__media > figure { width: 100% }` (`globals.css:3815-3823`).
The plate is a flex item, and a flex item with no content yet shrinks to zero —
the comment in the source calls this out, because the not-yet-decoded image is
exactly when it happens. `width: 100%` pins the cell so the row's height is
correct before the bytes arrive.

### 3.5 Services grid

| width | `grid-template-columns` | featured card | card heights |
|---|---|---|---|
| 320 | 1 × 274 | 274 (full) | 161–214 |
| 360 | 1 × 314 | 314 (full) | 161–186 |
| 375 | 2 × 158.5 | 329 (full row) | 185–209 |
| 390 | 2 × 166 | 344 (full row) | 185–209 |
| 430 | 2 × 186 | 384 (full row) | 185–190 |
| 600 | 3 × 166 | 530 (full row) | 207–246 |
| 834 | 3 × 244 | 764 (full row) | 207–246 |
| 1024 | 3 × 307 | 954 (full row) | 183–254 |

The single column below 375px is deliberate: at 320 a two-up gives each card
130px, and a Persian clause does not survive that — it clips, and clipped copy
reads as broken copy. The two-up keeps the full description and lets the row
stretch to the taller card instead (`landing-services.tsx:291-298`).

---

## 4. What the gate asserts

Everything above is a number someone could re-derive. These are the parts that
fail a build if they stop being true — `e2e/landing-polish.spec.ts`:

| Assertion | Line | Guards |
|---|---|---|
| 320/360/390/430: no horizontal overflow (≤1 px) | `:382` | the sideways scroller |
| 320/360/390/430: no non-hero image > 0.5 screens | `:384-388` | the drawing-owns-a-screen regression |
| 390: `.landing-geometry` is `display: none` | `:318-324` | the decorative discs leaking onto a phone |
| 390: the highlight marker still draws (`is-drawn`) | `:326-328` | motion surviving the layout rewrite |
| parallax resting headroom vs `clientHeight × 0.07` | `:97-121` | the drift being clipped by `overflow: hidden` |
| hover lift + elevation declared in the CSSOM | `:123-197` | card interaction, without pointer-driving |
| reduced motion: everything paints, nothing waits | `:283-305` | a failed motion chunk hiding content |

The hero is excluded from the 0.5 bound on purpose (`:348-350`): the first
screen is allowed to be dominated by the portrait. The gate is the exception
that has to be written down, not one that has to be measured.

The sweep is `12` tests; the whole landing spec runs `12 passed (20.5 s)`.

---

## 5. Rollback

Every piece is independent, and no shared component, dependency, lockfile or
build config was touched. Revert the smallest thing that is wrong.

### By commit

```
git revert --no-commit 6f934b9   # wall-text tile + phone invariants
git revert --no-commit 15a4bea   # services bento   (this commit is large: see below)
git revert --no-commit 56eff8e   # 4:5 hero, exhibit bento grammar, finale
```

`15a4bea` is not a landing commit — it carries the lawyer workbench and the
admin bindings as well. Revert only its landing paths:

```
git checkout 15a4bea^ -- \
  "apps/frontend/src/app/(home)/page.tsx" \
  apps/frontend/src/app/globals.css \
  apps/frontend/src/components/public/landing/landing-motion.tsx \
  apps/frontend/src/components/public/landing/landing-services.tsx
```

### By piece, without git

| To undo | Do this |
|---|---|
| the phone bento grammar | delete `globals.css:3957-4052` (the `min-width: 900px` block) and change the base `.landing-exhibit` grid back to a single column; the desktop spread is what that block restores, so removing it makes phones identical to desktop instead of reverting them |
| the wall-text tile | delete `.landing-exhibit--walltext .landing-walltext` and its `__num` / `__rule` rules at `globals.css:3883-3912`. The room falls back to a bare numeral between two illustrated neighbours — legible, but it reads as a broken chapter |
| the 4:5 hero | `exhibits.ts:54-60` → pass `SIZE` (1024²) instead of `{width: 1024, height: 1280}`, and drop `page.tsx:415-443`'s figure back to a full-measure image. Do **not** keep the 4:5 file and declare it square: `next/image` would letterbox it and the caption would float |
| the services two-up | `landing-services.tsx:300` → `mobile-l:grid-cols-2` to `grid-cols-1`, leaving 7 stacked cards |
| the phone invariants | delete `landing-polish.spec.ts:332-391`. The layout does not change; you only lose the gate |

### What is NOT reversible by design

- `minimal-14-legal-precision.webp` stays in `public/assets/landing/` and is
  referenced by no route. That is the brief's ban on «ستون‌های دادگاه», not an
  oversight — see the comment at `exhibits.ts:150-157`. Do not "clean it up"
  into a route.
- `minimal-15-human-meets-ai.webp` is likewise unreferenced, but for the
  duller reason that the twelve rooms do not need a fourteenth subject. It is
  dead weight in the repo (152 KB), not a decision. Deleting it is safe; it
  ships to no visitor either way.
- The wall-text room has no illustration on purpose. Giving room ۱۰ a plate
  means either reusing another room's drawing (two identical plates) or
  breaking the ban.

Rollback of the *verification* machinery — `verify`, `affected`, `repo-map` —
is already recorded in `VERIFICATION_LOOP.md §5`, including the one-line
`package.json` restore for the sequential `verify`.

---

## 6. Re-measuring

```
# the live dev server must be on :3000; this config never starts one
npx playwright test e2e/_mobile-measure.spec.ts -c playwright.live.config.ts --reporter=list
```

The spec prints two blocks — the width sweep as a markdown table, and the
per-room detail at 390 — which is where the tables in §3.1 and §3.2 came from.
It asserts almost nothing on purpose: it is a measuring instrument, not a
gate, and it is `_`-prefixed so `testIgnore` keeps it out of `npm run test:e2e`.

For the image-weight numbers, the run has to be cold per width: a single
browser context reuses decoded images across navigations and every
`transferSize` after the first reads 0. Open a new context per width (which is
what the byte measurements above did), or read the `w=` variant and compare it
against `ls -l public/assets/landing/`.

The gate itself:

```
npm run verify -w apps/frontend        # assets + types + lint + selector selftest
npx playwright test e2e/landing-polish.spec.ts -c playwright.live.config.ts
```

---

## 7. Known gaps

- **LCP is measured locally, not in the field.** 724–1068 ms on a warm dev
  server says the hero paints last, which is the useful part; it says nothing
  about a 3G phone. A real LCP number needs a production build behind a
  throttled profile, and `next build` must not run while the dev server holds
  `.next`, so it is left open rather than measured badly.
- **No testimonial/CTA band was re-composed for phones.** The task list covers
  hero, exhibits, services, blog, FAQ and finale; nothing on the page is still
  a full-measure picture between two text blocks, which was the actual goal.
- **The hero comment was stale and has been corrected.** It claimed "78% of
  the measure" with the caption "running down the free side"; the measured
  reality is 74% of the figure, capped at 24rem, caption directly under it at
  the same width, at every viewport from 320 to 1440.
