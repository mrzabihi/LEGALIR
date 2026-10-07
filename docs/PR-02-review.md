# PR #2 — Review & Disposition

> **Verdict: SUPERSEDED — close, do not merge.**
> Merging would regress `main`.
>
> PR: https://github.com/mrzabihi/LEGALIR/pull/2
> Branch: `feature/legalir-v0.3-rewards-profile` → `main`
> Reviewed: 2026-10-07

---

## Why

PR #2 has **2 commits not in `main`** (its other 15 are already merged).
Both were re-delivered into `main` through other branches — and that work has
since moved further ahead.

| PR #2 commit | Content | Where it landed in `main` |
|---|---|---|
| `03b92c2` feat(contracts): contract draft & review UX, six-tab result surface | `contracts/review` page (642 lines) + auth identity work | `2f9719c` — **same title**, tip of `pr/07-contract-review` |
| `6039960` feat(nav): polish mobile bottom-nav capsule bar & create-action sheet | `bottom-nav.tsx`, `create-action-sheet.tsx`, `icons.tsx`, `globals.css` | `b1e5dc7` feat(nav): mobile bottom-nav capsule bar & create-action sheet |

`main` is now **55 commits ahead** of this branch, and both headline files have
evolved past the branch versions:

- `bottom-nav.tsx`: after `b1e5dc7` it was reworked by `3f90350`
  (icon-colour + glow replaces the sliding capsule) and `329c36f` (brand icons).
- `create-action-sheet.tsx`: `main` = 12,324 bytes vs branch = 11,091 bytes
  (main is newer).

## Why not merge

`bottom-nav.tsx` on the branch (11,363 bytes) is **older** than `main`
(9,232 bytes). Merging PR #2 would restore the old capsule design and revert
`create-action-sheet.tsx` — a visual regression.

## Evidence commands

```bash
# 1. Commits on the branch not patch-applied in main
git cherry -v main origin/feature/legalir-v0.3-rewards-profile
#   + 03b92c2 feat(contracts): contract draft & review UX, six-tab result surface
#   + 6039960 feat(nav): polish mobile bottom-nav capsule bar & create-action sheet

# 2. Where main got the same features (same titles, other branches)
git log --oneline main -- "apps/frontend/src/app/(app)/contracts/review/page.tsx"
#   2f9719c feat(contracts): contract draft & review UX, six-tab result surface
git log --oneline main -- "apps/frontend/src/components/app/bottom-nav.tsx"
#   b1e5dc7 feat(nav): mobile bottom-nav capsule bar & create-action sheet
#   3f90350 feat(nav): replace sliding capsule with icon-colour + glow active state

# 3. How far ahead main is
git rev-list --count origin/feature/legalir-v0.3-rewards-profile..main   # 55
```

## Other status

- `mergeable`: unknown (GitHub has not computed it) — no checks, no reviews, no
  comments; last updated 2026-10-03.
- The three files that reported "MISSING" in a naive diff were just a design
  screenshot at the repo root (`Legalir Persian Navigation With Create Sheet.png`),
  not product code.

---

## Close comment (paste into PR #2)

```markdown
Superseded. Both commits on this branch were re-delivered into `main` via
other branches, and that work has since moved further:

- `03b92c2` (contract draft & review UX, six-tab result surface)
  → landed as `2f9719c`, same title, on `pr/07-contract-review`.
- `6039960` (mobile bottom-nav capsule bar & create action sheet)
  → landed as `b1e5dc7`, then evolved by `3f90350` (icon-colour + glow
  replaces the sliding capsule) and `329c36f` (brand icons).

`main` is now 55 commits ahead; merging this branch would regress
`bottom-nav.tsx` / `create-action-sheet.tsx` back to an older design.
Closing as superseded — no code from here is needed.
```

## Close command

```bash
gh pr close 2 --comment "Superseded — see comment."
# or via the UI: PR #2 → Close pull request
```

> Note: `gh` is not installed in this environment and no GitHub token is
> available, so the close must be performed manually (UI) or with `gh` once
> installed.

---

## Optional follow-up

The head branch `feature/legalir-v0.3-rewards-profile` exists both locally and
on `origin`. Once PR #2 is closed it can be deleted:

```bash
git push origin --delete feature/legalir-v0.3-rewards-profile
git branch -D feature/legalir-v0.3-rewards-profile
```

> The local `feature/legalir-v0.3-rewards-profile` was the release branch for
> `v0.6.0` (see `HANDOFF.md`); confirm the tag `v0.6.0` still points where you
> expect before deleting.
