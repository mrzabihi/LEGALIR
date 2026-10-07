# PR #4 — Title & Description

> Paste the **Title** into the PR title field and the **Description** into the
> PR body field on GitHub. PR:
> https://github.com/mrzabihi/LEGALIR/pull/4

---

## Title

```
feat: admin platform & BI, legal calculators, contracts hub, user portraits, lawyer marketplace
```

Short variant (if the UI limits the length):

```
feat: admin platform + BI, calculators, contracts hub, avatars, marketplace
```

---

## Description

> Historical note: the original branch name (`pr/08-bottom-nav`) and title
> (`Pr/08 ADMIN O NEW SERVICES MEHR 405`) under-describe this change — the
> branch grew into a much larger delivery. This title/description reflect what
> is actually in the 32 commits.

### Summary

A full delivery pass across the LegalIR platform: the admin/back-office layer
and its BI surface, the 32 legal calculators, the unified contracts hub, the
lawyer marketplace rework, subscription lifecycle, and a consistent signed-in
user portrait. 32 commits, 393 files, +70,951 / −2,658.

### What's included

#### Admin platform & BI (largest area)

- Grouped KPI dashboard with dependency-free trend charts (`357ec2d`), a
  readable honest trend line with a clean axis (`89732ca`).
- Real admin management layer — AI, knowledge, content, lawyers, requests,
  calculators, energy — plus Excel export (`1397074`).
- Analytics & BI dashboard: real, honest, reconciled (`de4f621`), finance
  Excel export (`71347b5`), render + honesty contract for the tabs (`3051892`),
  Operations tab + previous-period overlay (`7233dbe`).
- Lawyer review console with suspension flow (`c2bbc23`); lawyer avatar upload
  from disk + sample gallery (`f1300cf`).
- Wide two-column plan form with live preview and inline validation (`883bb7d`).

#### Legal calculators

- 32 documented legal calculators + 1405 rate datasets (`30c7bec`).
- Discovery redesign: one-row filters, category identity, RTL rail (`bc540b2`);
  one gradient source, valid listbox ARIA, dead tone keys removed (`c64ec2b`);
  services shortcut navigates to `/calculators` (`6add8e2`).

#### Contracts & services

- Unified contracts hub + admin platform + services discovery (`4e90179`),
  with e2e coverage and stale specs aligned (`d3a1de7`); coming-soon tab
  shortened and segment wrapping fixed (`b95078b`).

#### Lawyers & marketplace

- Grouped marketplace with category carousels & filters (`ecdc885`); new
  first-level filter bar (search, category rail, quick chips, clear-all) with
  the full attribute set behind the bottom sheet; marketplace taxonomy +
  lawyer console (`85fc201`).
- Self-service lawyer portrait — the lawyer's own avatar, everywhere
  (`067959b`); admin-set lawyer avatars reach every public surface (tests).

#### Subscription

- Payment-driven activation, one-active lifecycle + energy ledger (`5e0a87c`);
  mobile snap carousel for plans as a presentation-only change (`f570726`).

#### User portrait (signed-in user)

- One `UserAvatar` renderer for every signed-in surface — header, drawer,
  sidebar, profile (`deb07ce`).
- End-to-end portrait: presets + `/api/v1/me/avatar` (GET/POST/DELETE,
  session-scoped, raster-only, private storage under `.data/user-avatars/`),
  readable `LG-…` system ids created on signup and backfilled once for legacy
  rows (`d79d1c0`). A failed/cleared image degrades to the name initial — never
  a broken or blank surface.

#### Misc

- Notifications: mobile bell navigates to `/notifications`, no popup
  (`c044c61`).
- Documents: honest model-connectivity gate + trial mode (`0786a03`).
- Tailwind kebab-case `on-*` colour utilities mapped (`81d0585`).

### Notes / caveats

- `apps/frontend/playwright.live.config.ts` is intentionally **not** committed
  (a scratch config that reuses a running dev server).
- Admin test/e2e auth uses the dev SUPER_ADMIN mobile; OTP request is rate
  limited (3 / 5 min) — wait out the window between reruns.

### Test plan

- [ ] `npm run typecheck` — `tsc --noEmit`
- [ ] `npm run lint` — `next lint`
- [ ] `npm run test` — vitest (avatar storage round-trip + path-escape
      refusal, public-id backfill, admin-lawyer-avatar "everywhere" contract,
      analytics render/honesty tabs, usage engine)
- [ ] `npm run test:e2e` — Playwright journeys (login, marketplace shots,
      profile-settings-points, avatar consistency)
- [ ] Manual: pick a preset / upload a portrait in profile → confirm it updates
      immediately in header, sidebar/drawer and dashboard, persists across
      refresh and re-login, and degrades to the initial on delete/failed load.
