# LEGALIR — Legal Blog Article UX

> `/blog/contract-penalty-clause` — «وجه‌الالتزام در قراردادها — از ماده ۲۳۰ تا رأی وحدت رویه ۸۰۵»
>
> This is a **visual transformation** of an existing prepared source deck
> (`Documents/Blog/بررسی رأی وحدت رویه ۸۰۵ - weblog.pptx`) into a premium,
> responsive legal editorial article. The prose, the provisions, the ruling
> and the practical advice are the **source's own words**. No law, ruling,
> reasoning, example, author, date or URL was invented.

---

## 1. The storyline

The article is not a flat wall of text. It follows the source deck's own
axis, and the visual weight of each section follows that axis:

```
ماده ۲۳۰  →  مسئله (تشتت آرا)  →  رأی ۸۰۵  →  اثر عملی
   │              │                  │            │
 provision      timeline           case        cardList
 (statute)     (3 steps)         (ruling)     (effects)
```

Heading anchors, in order:

| # | Anchor | Level | Role |
|---|---|---|---|
| 1 | `article-230` | H2 | the statute the whole article turns on |
| 2 | `legal-background` | H2 | the problem — conflicting practice |
| 3 | `article-522` | H3 | the second provision in play |
| 4 | `ruling-805` | H2 | the ruling itself |
| 5 | `practical-effects` | H2 | what changes in practice |
| 6 | `consequences` | H2 | downstream consequences |
| 7 | `examples` | H2 | worked examples |
| 8 | `conclusion` | H2 | closing |

---

## 2. Content model — typed blocks, not JSX

The article body is **data**, not a hand-written JSX tree, and it is not a
generic CMS. `lib/blog/article-types.ts` defines a small, legal-specific
block vocabulary; `lib/blog/contract-penalty-clause.ts` holds the content.

| Block kind | Component | Used for |
|---|---|---|
| `paragraph` | inline `<p>` | running prose (`lead` marks the opener) |
| `heading` | inline `<h2>`/`<h3>` | section headings, carry the TOC anchor `id` |
| `provision` | `LegalProvisionCard` | a statute article (ماده ۲۳۰، ماده ۵۲۲) |
| `case` | `LegalCaseCard` | a ruling (رأی وحدت رویه ۸۰۵) |
| `quote` | `LegalQuote` | a verbatim holding pulled out of the flow |
| `highlight` | `LegalHighlight` | key statement / practical advice callout |
| `timeline` | `LegalTimeline` | ordered legal developments |
| `takeaway` | `LegalTakeaway` | the closing set of key points |
| `cardList` | `LegalCardList` | numbered grid of effects / challenges / examples |
| `source` | `LegalSourceReference` | the references the article rests on |

`LegalArticle` (`components/blog/legal-article/legal-article.tsx`) is a pure
`switch` from block kind to component. There is **no content in the
renderer** — adding a block kind is a two-line change.

`articleHeadings(doc)` derives the table of contents from the same block
list, so the TOC can never list a heading the article does not have.

---

## 3. Components

```
components/blog/
├── legal-article/
│   ├── legal-article.tsx          # pure block → component switch
│   ├── legal-article-section.tsx  # the reading column / wide breakout
│   ├── legal-article-hero.tsx     # hero + back link
│   ├── blocks.tsx                 # the 8 presentational block components
│   └── index.ts                   # barrel
├── article-toc.tsx                # rail (desktop) + disclosure (mobile)
├── reading-progress.tsx           # 3px scroll bar
└── article-actions.tsx            # share + bookmark (the only client state)
```

Every block component in `blocks.tsx` is **pure** — no hooks, no state, no
data fetching — so it renders identically on the server (for SEO) and in
tests.

---

## 4. Responsive strategy

Two widths, defined once in `LegalArticleSection`:

| Content | Width | Rationale |
|---|---|---|
| running prose | `max-w-[780px]` | the 720–820px reading measure |
| visual sections (timeline, card grids) | `max-w-[1120px]` | the 1000–1200px visual width |

The page container is `max-w-[1440px]`. The desktop TOC rail only appears at
the `wide` (1440) breakpoint — below that the article column would be
squeezed under 1000px, so the TOC collapses into a disclosure above the
article instead.

Measured live:

| Viewport | Prose | Wide sections | TOC |
|---|---|---|---|
| 375 / 390 / 430 | full width − padding | full width − padding | disclosure |
| 768 | 780px | 780px | disclosure |
| 1024 | 780px | 986px | disclosure |
| 1280 | 780px | 1120px | disclosure |
| 1440+ | 780px | 1106px | rail (w-64) |

**Mobile is not a shrunk desktop.** The timeline is a *vertical* rail on
mobile and a *horizontal* rail at `tablet`+ — a different layout, not a
scaled one. The card grids go single-column on mobile, two-column at
`tablet`.

---

## 5. Accessibility

- Semantic structure: the public layout provides the single `<main>`; the
  article is `<article id="main-content">` (the skip-link target). One `<h1>`
  (the post's own `titleFa`), then a real H2/H3 hierarchy.
- The TOC is a `<nav aria-label="فهرست مطالب">` of real `<a href="#id">`
  links — keyboard-navigable, browser-history-friendly, and printable. The
  active heading carries `aria-current="location"`.
- The mobile TOC is a disclosure with `aria-expanded`.
- The reading-progress bar is `aria-hidden="true"` — decorative only.
- The hero's decorative motif is `aria-hidden="true"`.
- Focus-visible uses the global Navy indicator (2px, offset 2px).
- Motion is 250–450ms and collapses under the global `prefers-reduced-motion`
  rule.

---

## 6. SEO

The page is a **server component** (`export const dynamic = "force-dynamic"`),
so the article is fully rendered HTML for crawlers.

- `generateMetadata` emits `title`, `description`, canonical, OpenGraph
  (`type: "article"`, published/modified time, author, tags) and Twitter card
  — every field from the real post record.
- JSON-LD `BlogPosting` is emitted from the same real data: headline,
  description, dates, `inLanguage: "fa-IR"`, author, publisher, section,
  keywords. **No invented fields.**

---

## 7. Print

`globals.css` carries an article print block:

- `.no-print` hides the reading-progress bar, the TOC (rail and disclosure)
  and the share/bookmark row.
- `.article-hero` is flattened to a white surface with black text, and its
  decorative motif is hidden — no page of toner.
- The reading column and wide sections are released to full page width.
- `figure` / `aside` / `section` use `break-inside: avoid` so cards and
  callouts do not split across pages.

---

## 8. Two rendering paths, one route

`app/(public)/blog/[slug]/page.tsx` keeps both:

- a slug with a rich legal-article document (`getLegalArticle(slug)`) renders
  through the typed block system;
- **every other slug keeps the legacy markdown body, unchanged.**

This is why the existing blog flows, routes and data are untouched.

---

## 9. Tests

`components/blog/legal-article/__tests__/legal-article.test.tsx` — 18 tests:

- **content model** — hero has the three framing facts; every heading anchor
  is unique; the opener is a lead paragraph; the storyline order is
  ۲۳۰ → مسئله → ۸۰۵ → اثر عملی; both provisions and the ruling are
  first-class blocks.
- **renderer** — one H2 per level-2 heading; the statute renders as a
  provision card (not a paragraph); the ruling renders with authority and
  date; the timeline is an ordered list of three steps; the advice is a
  highlight; the closing points are a takeaway; the sources render; the
  effect/challenge grids are real lists.
- **hero** — the post title is the single H1 and the deck title is the lead.
- **TOC** — lists every heading and links to its anchor; collapses into a
  disclosure on mobile; renders nothing when there are no headings.
