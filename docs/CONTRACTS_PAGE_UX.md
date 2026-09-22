# LEGALIR — Contracts Page UX

> The `/contracts` page is the **top of the contract funnel**. It answers two
> questions, always in this order:
>
> 1. **«چه قراردادی می‌توانم بسازم؟»** — the template library (SECTION 1)
> 2. **«قراردادهایی که قبلاً ساخته یا شروع کرده‌ام کجا هستند؟»** — my contracts (SECTION 2)
>
> The order is a product requirement, not a layout accident: the page must
> always offer *start something new* before *resume something old*.

---

## 1. Page structure

```
┌──────────────────────────────────────────────────────────┐
│  breadcrumb + title (PageContextHeader)                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │  🔍  جستجوی قرارداد؛ مثلاً اجاره، NDA، خودرو…       │  │  ← one input, drives BOTH sections
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  SECTION 1 — قالب‌های قرارداد                              │
│  [همه] [املاک] [شخصی] [تجاری]        ← category chips     │
│  ┌────────┐ ┌────────┐ ┌────────┐                        │
│  │ 16:9   │ │ 16:9   │ │ 16:9   │   ← template cards     │
│  │ visual │ │ visual │ │ visual │      (max 8)           │
│  └────────┘ └────────┘ └────────┘                        │
│              [ مشاهده همه قراردادها ]                      │
│                                                           │
│  SECTION 2 — قراردادهای من                                 │
│  ┌ ادامه دهید ─────────────────────────────────────────┐ │
│  │  (drafts only — hidden when there are none)          │ │
│  └──────────────────────────────────────────────────────┘ │
│  [همه][پیش‌نویس][در حال تکمیل]…  [نوع ▾] [مرتب‌سازی ▾]     │
│  ┌──────────────┐ ┌──────────────┐                       │
│  │ work item    │ │ work item    │  ← user cards         │
│  └──────────────┘ └──────────────┘                       │
└──────────────────────────────────────────────────────────┘
```

The container is `max-w-6xl` so the template grid can hold three columns on
desktop without the user cards becoming uncomfortably wide.

---

## 2. One search, two sections

The search box sits **directly under the page title** and is the single input
for the whole page. Its value lives in the URL (`?q=…`), so a filtered view
survives refresh, deep-linking and browser back/forward.

Search is **Persian-aware** (`lib/contracts/search.ts`). Persian text has
several interchangeable code points that a naive `includes()` misses:

| Variant | Folded to |
|---|---|
| ي (U+064A) / ى (U+0649) | ی (U+06CC) |
| ك (U+0643) | ک (U+06A9) |
| ة (U+0629) | ه (U+0647) |
| نیم‌فاصله ZWNJ (U+200C) | a space |
| اعراب / تشدید | removed |
| Persian/Arabic digits | ASCII |

Folding ZWNJ to a **space** (not deleting it) is what makes «نرم‌افزار» and
«نرم افزار» match each other — the exact case the spec calls out.

Templates are matched against their **title, description, category and a
`keywords` synonym list** declared in the registry, so typing «مستأجر»,
«خودرو» or «محرمانگی» finds the right template even when those words are not
in its title.

---

## 3. SECTION 1 — the template library

- Renders every **implemented** definition from the registry
  (`implementedContractDefinitions()`), so a new domain appears here the moment
  its definition is registered — no hard-coded card list.
- **Category chips** (همه / املاک / شخصی / تجاری) map the registry's *domains*
  onto the three buckets a person actually thinks in
  (`lib/contracts/categories.ts`). The chips scroll horizontally on mobile so
  they never wrap into a second line above the fold.
- **Max 8 cards** initially, then «مشاهده همه قراردادها» expands in place.
  Collapsing back happens automatically whenever the query or category changes,
  so the user always sees the top of a fresh result set.
- Cards enter with a **staggered** `animate-slide-up-fade` (45 ms apart, capped
  at 8) and respect `prefers-reduced-motion`.

### Template cards have visuals, not just icons

A template card is **inspirational**, so it leads with a **16:9 illustration**,
never a bare outline icon. There are no image assets in the repo, so
`lib/contracts/visuals.tsx` is a hand-built SVG scene system:

- eight scenes (rent, sale, vehicle, debt, freelance, NDA, SaaS, startup) on a
  shared `320×180` `Scene` wrapper;
- themeable through CSS variables, so they follow light/dark automatically;
- `preserveAspectRatio="xMidYMid slice"` inside a fixed `aspect-video` box, so
  a grid of cards never shifts layout as the visuals paint;
- unique gradient ids via `React.useId()`, so multiple cards on one page never
  collide.

---

## 4. SECTION 2 — my contracts

The user's contracts come from **two lifecycles**:

- the Contract Operating System (`PropertyContractListItem`, 15 states)
- the legacy V1 workspace (`V1ContractListItem`, 7 states)

`lib/contracts/unified.ts` folds both into one `UnifiedContract` shape, so no
card ever has to know which lifecycle produced it. The status buckets
themselves live in `lib/contracts/status.ts` — the single mapping from either
raw state onto seven shared, user-facing buckets.

### Draft priority

`sortUnifiedContracts()` orders by **work remaining first**, then
most-recently-updated. Drafts and in-progress contracts surface at the top —
the "resume where you left off" requirement — and finished work sinks down.

### «ادامه دهید»

A dedicated block at the top of SECTION 2 lists the drafts the user can pick up
right now (`resumableContracts()`), capped at four. It is **hidden entirely**
when there are no drafts — no empty heading.

### Smart grouping

On the «همه» view the list is bucketed by work remaining:

| Group | Statuses |
|---|---|
| نیازمند ادامه | draft, in_progress |
| در حال بررسی | generated, under_review |
| قراردادهای آماده | approved, exported |
| بایگانی | archived |

Empty groups are dropped. Each group shows at most **8 cards**, then
«مشاهده بیشتر» expands **in place** — the active filters are preserved because
expansion is local state, not a navigation.

### Filters

- **Status** — chips on desktop, in a **bottom sheet** on mobile (the chips
  would otherwise push the list below the fold).
- **Type** — a dropdown, never chips.
- **Sort** — آخرین ویرایش (default) / تاریخ ایجاد / الفبا.

The desktop bar and the mobile sheet read the **same state**, so the two can
never disagree.

### Empty states

Two distinct states, because they need different actions:

- **no-contracts** — the user has never built one → «ساخت قرارداد» scrolls to
  the template library.
- **no-results** — filters/search excluded everything → «پاک کردن فیلترها».

---

## 5. Template card vs user card

The two must never look interchangeable.

| | Template card | User card |
|---|---|---|
| Purpose | inspiration | work item |
| Leads with | 16:9 illustration | status badge + title |
| Shows | category badge, description, step count | type, progress, last change |
| Verb | «شروع» | status-specific («ادامه تکمیل», «مشاهده قرارداد», «دانلود مجدد») |
| Secondary | — | ⋮ menu (copy id, delete draft) |

The user card's primary action label comes from `primaryActionLabel(status)`,
so every card in the list agrees on the wording for a given status.

---

## 6. Accessibility

- Search input has `aria-label="جستجوی قرارداد"`; the clear button is labelled.
- Category chips are a `role="tablist"` with `aria-selected`.
- Status chips are `role="tab"`; the mobile sheet's chips use `aria-pressed`.
- **Status is never colour-only** — `ContractStatusBadge` always renders the
  label alongside the colour dot.
- Progress bars carry `role="progressbar"` with `aria-valuenow/min/max`.
- The ⋮ menu closes on outside-click and Escape, and returns focus to its
  trigger.
- All interactive targets are ≥ 40 px; focus rings use
  `focus-visible:outline-primary`.

---

## 7. Analytics

`lib/contracts/analytics.ts` is the **one** place the page reports through. It
pushes onto `window.dataLayer` when a tag manager is present and is otherwise a
no-op — safe on the server and in tests. Swapping in a real vendor later means
editing that file only.

Events: `contract_template_viewed`, `contract_template_started`,
`contract_category_selected`, `contract_search_performed`,
`contract_status_filtered`, `contract_type_filtered`, `contract_sort_changed`,
`contract_view_all_clicked`, `contract_resumed`.

---

## 8. Files

| File | Role |
|---|---|
| `lib/contracts/registry.ts` | single source of truth for every contract type |
| `lib/contracts/status.ts` | raw state → shared status bucket |
| `lib/contracts/unified.ts` | both lifecycles → one `UnifiedContract` |
| `lib/contracts/categories.ts` | domain → user-facing template bucket |
| `lib/contracts/search.ts` | Persian-aware normalisation + scoring |
| `lib/contracts/visuals.tsx` | the SVG illustration system |
| `lib/contracts/analytics.ts` | the one reporting seam |
| `components/contracts/contract-list.tsx` | the page body (both sections) |
| `components/contracts/contract-template-grid.tsx` | SECTION 1 |
| `components/contracts/my-contracts-section.tsx` | SECTION 2 |
| `components/contracts/user-contract-card.tsx` | the work-item card |
| `components/contracts/contract-template-card.tsx` | the inspiration card |
| `components/contracts/contracts-filter-sheet.tsx` | mobile filter bottom sheet |

Tests: `components/contracts/__tests__/contracts-page.test.tsx`.
