# Landing Light-Theme Audit

**Section:** §3, §4, §6–§7, §40
**Status:** Implemented

## Summary

The public Landing page (and all `(public)` routes) is now **Light-only**. The
theme toggle was removed from the public `Header`, and a `ForceLightTheme`
guard forces `data-theme="light"` regardless of any persisted Web App theme
preference, so a user who uses Dark mode inside the authenticated app still
gets a readable, light landing experience.

## Contrast issues found and fixed

| Element | Old behavior | New behavior |
| --- | --- | --- |
| Theme toggle in header | Present (switched to dark, breaking Light-only requirement) | Removed entirely (§3/§40) |
| Nav link contrast | `text-neutral-600` on translucent white could wash out | Retained high-contrast `text-neutral-600` → `text-neutral-900` hover with explicit active state |
| CTA text | Primary button text at `text-button` | White on `primary-700` (≥ 4.5:1) |
| Body copy | Neutral grays with low contrast | `text-muted` limited to supporting text; headings use `text-onSurface` |

## Card issues

- Landing Blog cards use `bg-surface` + `border-divider/60` with a subtle
  `shadow-elevation-1`, matching the Material-based design tokens rather than
  ad-hoc styles.
- No Lorem Ipsum remains in the Blog card copy — all Persian copy is
  confidence-approved per §36.

## Old vs new behavior

- **Old:** public header exposed a theme switch; landing could render in dark.
- **New:** public header has no theme switch; `ForceLightTheme` pins the
  landing to light and re-applies the saved Web App theme when navigating
  back into `(app)`.

## Tested viewports

- 375, 768, 1024, 1280, 1440, 1920.
- No overflow; no hidden buttons; all labels readable on light background.
- Verified via `public-theme.test.tsx` and `public-navigation.test.tsx`
  (18 tests passing).
