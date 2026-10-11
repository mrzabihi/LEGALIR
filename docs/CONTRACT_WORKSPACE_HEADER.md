# LEGALIR — Contract Workspace Header

> The sticky header of the contract draft workspace
> (`components/contracts/builder/contract-workspace-header.tsx`).
>
> It is a **workspace**, not a discovery surface, so it is deliberately quiet:
> no glassmorphism, no glow — a solid surface and two levels of hierarchy.
>
> The surface is the **LEGALIR brand ivory** (`--contract-sticky-bg`,
> `#FCF6E8`), not plain white. That is what makes "this is the persistent status
> area" legible at a glance while the white contract form scrolls underneath.

---

## 1. What changed

The previous header used `bg-surface/95` + `backdrop-blur` (glassmorphism) and
carried a decorative save label. It was replaced with:

- a **solid LEGALIR brand-ivory** control surface (`--contract-sticky-bg`,
  `#FCF6E8`) — no translucency, no blur — so the header reads as a distinct
  persistent band above the white form;
- **two levels** of hierarchy instead of one dense row;
- **scroll-aware elevation** — flat at the top of the page, lifted once content
  slides under it (see §2);
- a **real** save status wired to the wizard's autosave state;
- a **real** progress bar driven by server-computed section completeness.

The sticky behaviour is kept (`sticky top-0 z-20`), so the contract's identity
and progress stay visible while the user scrolls a long step.

---

## 2. Surface & elevation

The header floats above the white contract form, so it sits on the brand ivory
control surface rather than plain white. All values live in `globals.css` as
`--contract-sticky-*` custom properties (light + dark), so nothing is scattered
across pages:

| Token | Light | Role |
|---|---|---|
| `--contract-sticky-bg` | `#FCF6E8` | the header surface (brand ivory) |
| `--contract-sticky-text` | `#222E2D` | primary text (brand teal, 13:1 AAA) |
| `--contract-sticky-muted` | `#4C5B57` | secondary text (6.6:1 AA) |
| `--contract-sticky-accent` | `#C69B38` | gold — hairline only |
| `--contract-sticky-border` | `rgba(34,46,45,.12)` | `border-bottom` |
| `--contract-sticky-shadow` | `0 6px 18px rgba(34,46,45,.08)` | scroll-aware elevation |
| `--contract-sticky-chip` | `rgba(34,46,45,.07)` | section chips |
| `--contract-sticky-chip-strong` | `#E4EEE8` | step chip (pale green) |
| `--contract-sticky-track` | `rgba(34,46,45,.14)` | progress track |
| `--contract-sticky-fill` | `#1D624E` | progress fill (brand green) |
| `--contract-sticky-badge-bg` | `#E4EEE8` | lifecycle badge surface |
| `--contract-sticky-badge-text` | `#1D624E` | lifecycle badge text (6.1:1 AA) |
| `--contract-sticky-badge-border` | `rgba(29,98,78,.24)` | lifecycle badge border |

The gold accent is deliberately rationed: a single 16 px hairline at the
header's start edge. It is never a background. The progress fill is always the
brand green `#1D624E` — it never doubles as the text colour.

**Elevation is scroll-aware.** The header is `sticky` inside the app shell's
`<main class="overflow-auto">`, not the window, so a plain `window.scrollY`
check would never fire. `findScrollParent()` walks up until it finds the element
whose `overflow-y` is `auto`/`scroll`, and a passive `scroll` listener toggles
`elevated` at `scrollTop > 4`. The shadow is applied through the named Tailwind
token `shadow-contract-sticky` (a named token, not an arbitrary
`shadow-[var(--…)]`, because Tailwind cannot disambiguate an arbitrary `var()`
between box-shadow and shadow-colour and silently emits the colour form). The
transition is `duration-200 ease-standard` — no noticeable animation.

**The header publishes its own height.** A `ResizeObserver` writes
`--contract-header-h` onto the header's parent, and the wizard's desktop step
rail consumes it (`top-[calc(var(--contract-header-h,128px)+1rem)]`) so its
sticky offset tracks the real header height instead of a magic number.

---

## 3. Two-level hierarchy

### LEVEL 1 — contract identity

| Element | Notes |
|---|---|
| Back link | «بازگشت به مرکز قراردادها» → `/contracts`; brand-green text with an RTL-mirrored back arrow |
| Save status | shares the back-link row, right-aligned, `aria-live="polite"` |
| Title | `text-h4`; clamps to 2 lines on phone, truncates to one line from `tablet` up |
| Status badge | the raw lifecycle state label, e.g. «پیش‌نویس»; pale-green chip (`--contract-sticky-badge-*`) |
| Reference code | `LGL-RENT-1405-000016 — رهن و اجاره ملک مسکونی` |
| Copy button | copies the reference code; labelled for screen readers |

### LEVEL 2 — progress

| Element | Notes |
|---|---|
| «تکمیل قرارداد» | the section title |
| «مرحله X از Y» | the wizard step position, on a pale-green chip |
| «{progress}٪» | the server-computed percentage |
| Progress bar | 6 px (`h-1.5`), `role="progressbar"` with `aria-valuenow` |
| «۲ از ۵ بخش تکمیل شده» | completed / total, from the real section list |
| Remaining chips | up to 6 section labels still under 100 %, then «+N» |
| Blockers | a warning line listing the sections that block signing |

The bar's fill is the brand green `--contract-sticky-fill` (`#1D624E`) at every
percentage — it never uses the text colour as a fill.

---

## 4. The save status is REAL

`SaveStatusLabel` renders the wizard's actual autosave state — it is not a
decorative label:

| `SaveStatus` | Rendered |
|---|---|
| `saving` | a spinner + «در حال ذخیره...» |
| `saved` | a brand-green dot + «همه تغییرات ذخیره شده‌اند» (brand-green text) |
| `error` | «ذخیره انجام نشد — تلاش مجدد» (a button that calls `onRetrySave`) |
| `idle` | «ذخیره خودکار فعال است» |

The whole block is wrapped in `aria-live="polite"`, so a screen-reader user
hears «ذخیره شد» without the header stealing focus.

---

## 5. The progress is REAL

`progress` and `sections` come from the server-computed `ContractCompleteness`
that the wizard already holds — the same value the step rail uses to decide
which steps are done. There are no fake percentages anywhere in the header.

`completed` is `sections.filter(s => s.percent === 100).length`; `remaining` is
the complement, rendered as chips.

---

## 6. Responsive behaviour

- **Desktop / tablet (≥600 px)** — a compact two-level header, measured ~203 px.
- **Phone (<600 px)** — the title clamps to two lines (`line-clamp-2`) instead
  of truncating to an unreadable fragment. The remaining-section chips ride a
  **single horizontal rail** (`overflow-x-auto scrollbar-hide`) so the sticky
  header never grows to two rows; the rail is keyboard-focusable and carries a
  fade hint at the end edge. Only from `tablet` (600 px) up do the chips wrap
  normally and the title truncate to one line. Measured ~231 px at 390 px and
  ~251 px at 320 px, with no horizontal overflow.
- The header is `sticky top-0`; the wizard's sticky footer is
  `fixed bottom-0 … desktop:static`, so on desktop the footer returns to normal
  flow and only the header stays pinned.

---

## 7. Accessibility

- `role="progressbar"` with `aria-valuenow` / `aria-valuemin` / `aria-valuemax`
  and `aria-label="پیشرفت تکمیل قرارداد"`.
- Save status is announced through `aria-live="polite"`.
- The copy button has `aria-label="کپی شناسه قرارداد"`.
- The back link is a real `<Link>` with a visible label, not an icon-only
  control.
- Colours come from the `--contract-sticky-*` tokens (see §2) plus the semantic
  `bg-warning-50` / `text-warning-700` roles for the blockers band — no
  invented hex values in the component. Contrast on the `#FCF6E8` surface:
  teal `#222E2D` 13.0:1 (AAA), muted `#4C5B57` 6.6:1 (AA), brand green
  `#1D624E` 6.1:1 (AA), warning ink `#92400E` 5.49:1 (AA). The blockers band
  uses a soft gold wash (`bg-warning-50`, `#FFFBEB`) on the ivory surface, never
  a saturated red. The back link uses the theme-aware brand foreground
  `--brand-fg`, which is `#1D624E` in light and lifts to a mint on the dark
  surface.
- The mobile chip rail is keyboard-scrollable: it takes `tabIndex={0}` (only when
  it actually overflows) with a visible `focus-visible` ring, so the hidden
  scrollbar does not hurt discoverability.

---

## 8. Props

```ts
interface ContractWorkspaceHeaderProps {
  title: string;
  referenceCode: string;
  typeFa: string;
  stateFa: string;                 // raw lifecycle state label
  progress: number;                // 0–100, server-computed
  sections: ContractCompletenessSection[];
  blockers: { sectionKey: string; labelFa: string; stepId: string }[];
  stepIndex: number;
  stepCount: number;
  saveStatus: SaveStatus;          // "idle" | "saving" | "saved" | "error"
  lastSavedAt: string | null;
  onRetrySave: () => void;
  onCopyId: () => void;
}
```

The shell (`wizard-shell.tsx`) supplies every value from the wizard context —
`state`, `saveStatus`, `lastSavedAt`, `saveNow`, `completeness.sections`,
`progress` — so the header never invents state of its own.

Tests: `components/contracts/__tests__/contracts-page.test.tsx`
(`describe("ContractWorkspaceHeader")`).
