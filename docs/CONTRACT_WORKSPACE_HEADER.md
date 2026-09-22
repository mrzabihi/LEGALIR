# LEGALIR — Contract Workspace Header

> The sticky header of the contract draft workspace
> (`components/contracts/builder/contract-workspace-header.tsx`).
>
> It is a **workspace**, not a discovery surface, so it is deliberately quiet:
> no glassmorphism, no glow — a solid surface and two levels of hierarchy.
>
> The surface is a **soft light-blue control surface** (`--contract-sticky-bg`,
> `#DAE3F3`), not plain white. That is what makes "this is the persistent status
> area" legible at a glance while the white contract form scrolls underneath.

---

## 1. What changed

The previous header used `bg-surface/95` + `backdrop-blur` (glassmorphism) and
carried a decorative save label. It was replaced with:

- a **solid light-blue** control surface (`--contract-sticky-bg`) — no
  translucency, no blur — so the header reads as a distinct persistent band
  above the white form;
- **two levels** of hierarchy instead of one dense row;
- **scroll-aware elevation** — flat at the top of the page, lifted once content
  slides under it (see §2);
- a **real** save status wired to the wizard's autosave state;
- a **real** progress bar driven by server-computed section completeness.

The sticky behaviour is kept (`sticky top-0 z-20`), so the contract's identity
and progress stay visible while the user scrolls a long step.

---

## 2. Surface & elevation

The header floats above the white contract form, so it sits on a soft light-blue
control surface rather than plain white. All values live in `globals.css` as
`--contract-sticky-*` custom properties (light + dark), so nothing is scattered
across pages:

| Token | Light | Role |
|---|---|---|
| `--contract-sticky-bg` | `#DAE3F3` | the header surface |
| `--contract-sticky-text` | `#172B4E` | primary text (LEGALIR navy) |
| `--contract-sticky-muted` | `rgba(23,43,78,.72)` | secondary text |
| `--contract-sticky-accent` | `#C3B18A` | bronze — state badge border + hairline only |
| `--contract-sticky-border` | `rgba(23,43,78,.10)` | `border-bottom` |
| `--contract-sticky-shadow` | `0 6px 18px rgba(23,43,78,.08)` | scroll-aware elevation |
| `--contract-sticky-chip` | `rgba(23,43,78,.06)` | section chips |
| `--contract-sticky-chip-strong` | `rgba(23,43,78,.12)` | step chip |
| `--contract-sticky-track` | `rgba(23,43,78,.14)` | progress track |

The bronze accent is deliberately rationed: a thin border on the lifecycle
state badge and a 16 px hairline at the header's start edge. It is never a
background.

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
| Back link | «بازگشت به مرکز قراردادها» → `/contracts` |
| Save status | shares the back-link row, right-aligned, `aria-live="polite"` |
| Title | `text-h4`; truncates on desktop, clamps to 2 lines on mobile |
| Status badge | the raw lifecycle state label, e.g. «پیش‌نویس»; bronze border |
| Reference code | `LGL-RENT-1405-000016 — رهن و اجاره ملک مسکونی` |
| Copy button | copies the reference code; labelled for screen readers |

### LEVEL 2 — progress

| Element | Notes |
|---|---|
| «تکمیل قرارداد» | the section title |
| «مرحله X از Y» | the wizard step position, on a navy chip |
| «{progress}٪» | the server-computed percentage |
| Progress bar | 6 px (`h-1.5`), `role="progressbar"` with `aria-valuenow` |
| «۲ از ۵ بخش تکمیل شده» | completed / total, from the real section list |
| Remaining chips | up to 6 section labels still under 100 %, then «+N» |
| Blockers | a warning line listing the sections that block signing |

The bar turns `bg-success` at 100 % and `--contract-sticky-text` (navy)
otherwise.

---

## 4. The save status is REAL

`SaveStatusLabel` renders the wizard's actual autosave state — it is not a
decorative label:

| `SaveStatus` | Rendered |
|---|---|
| `saving` | a spinner + «در حال ذخیره...» |
| `saved` | a brand-green dot + «همه تغییرات ذخیره شده‌اند» |
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

- **Desktop / tablet** — a compact two-level header, measured ~189 px at the
  default laptop width.
- **Mobile** — the title clamps to two lines (`max-mobile-l:line-clamp-2
  max-mobile-l:whitespace-normal`) instead of truncating to an unreadable
  fragment. The remaining-section chips ride a **single horizontal rail**
  (`overflow-x-auto scrollbar-hide`) so the sticky header never grows to two
  rows; from `mobile-l` (375 px) up they wrap normally. A fade hint at the end
  edge signals the rail continues. Measured ~235 px (≈30 % of a 780 px viewport)
  with no horizontal overflow.
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
  `bg-success` / `text-warning-700` roles — no invented hex values in the
  component. Contrast on the `#DAE3F3` surface: navy `#172B4E` 10.95:1 (AAA),
  muted ~5.8:1 (AA), success `#1F6F50` 4.72:1 (AA), warning `#92400E` 5.49:1
  (AA). The brand green `#32B183` is used only as a small dot
  (`bg-control-selected`), never as text on the blue surface (2.1:1 — fail).

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
