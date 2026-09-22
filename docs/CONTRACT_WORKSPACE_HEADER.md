# LEGALIR — Contract Workspace Header

> The sticky header of the contract draft workspace
> (`components/contracts/builder/contract-workspace-header.tsx`).
>
> It is a **workspace**, not a discovery surface, so it is deliberately quiet:
> no glassmorphism, no glow — a solid surface and two levels of hierarchy.

---

## 1. What changed

The previous header used `bg-surface/95` + `backdrop-blur` (glassmorphism) and
carried a decorative save label. It was replaced with:

- a **solid** `bg-surface` header — no translucency, no blur;
- **two levels** of hierarchy instead of one dense row;
- a **real** save status wired to the wizard's autosave state;
- a **real** progress bar driven by server-computed section completeness.

The sticky behaviour is kept (`sticky top-0 z-20`), so the contract's identity
and progress stay visible while the user scrolls a long step.

---

## 2. Two-level hierarchy

### LEVEL 1 — contract identity

| Element | Notes |
|---|---|
| Back link | «بازگشت به مرکز قراردادها» → `/contracts` |
| Title | `text-h4`; truncates on desktop, clamps to 2 lines on mobile |
| Status badge | the raw lifecycle state label, e.g. «پیش‌نویس» |
| Reference code | `LGL-RENT-1405-000016 — رهن و اجاره ملک مسکونی` |
| Copy button | copies the reference code; labelled for screen readers |
| Save status | right-aligned, `aria-live="polite"` |

### LEVEL 2 — progress

| Element | Notes |
|---|---|
| «تکمیل قرارداد» | the section title |
| «۲ از ۵ بخش تکمیل شده» | completed / total, from the real section list |
| Progress bar | 6 px (`h-1.5`), `role="progressbar"` with `aria-valuenow` |
| «مرحله X از Y» | the wizard step position |
| «{progress}٪» | the server-computed percentage |
| Remaining chips | up to 6 section labels still under 100 %, then «+N» |
| Blockers | a warning line listing the sections that block signing |

The bar turns `bg-success` at 100 % and `bg-primary` otherwise.

---

## 3. The save status is REAL

`SaveStatusLabel` renders the wizard's actual autosave state — it is not a
decorative label:

| `SaveStatus` | Rendered |
|---|---|
| `saving` | a spinner + «در حال ذخیره...» |
| `saved` | ✓ «همه تغییرات ذخیره شده‌اند» |
| `error` | «ذخیره انجام نشد — تلاش مجدد» (a button that calls `onRetrySave`) |
| `idle` | «ذخیره خودکار فعال است» |

The whole block is wrapped in `aria-live="polite"`, so a screen-reader user
hears «ذخیره شد» without the header stealing focus.

---

## 4. The progress is REAL

`progress` and `sections` come from the server-computed `ContractCompleteness`
that the wizard already holds — the same value the step rail uses to decide
which steps are done. There are no fake percentages anywhere in the header.

`completed` is `sections.filter(s => s.percent === 100).length`; `remaining` is
the complement, rendered as chips.

---

## 5. Responsive behaviour

- **Desktop** — a compact two-level header, target height ~120–160 px.
- **Mobile** — the title clamps to two lines (`max-mobile-l:line-clamp-2
  max-mobile-l:whitespace-normal`) instead of truncating to an unreadable
  fragment; the remaining-section chips wrap.
- The header is `sticky top-0`; the wizard's sticky footer is
  `fixed bottom-0 … desktop:static`, so on desktop the footer returns to normal
  flow and only the header stays pinned.

---

## 6. Accessibility

- `role="progressbar"` with `aria-valuenow` / `aria-valuemin` / `aria-valuemax`
  and `aria-label="پیشرفت تکمیل قرارداد"`.
- Save status is announced through `aria-live="polite"`.
- The copy button has `aria-label="کپی شناسه قرارداد"`.
- The back link is a real `<Link>` with a visible label, not an icon-only
  control.
- Colours come from MD3 tokens (`bg-surface`, `text-on-surface`, `text-muted`,
  `bg-success`, `text-warning-700`) — no invented hex values.

---

## 7. Props

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
