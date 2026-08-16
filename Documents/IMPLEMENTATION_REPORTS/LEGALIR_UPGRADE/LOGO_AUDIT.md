# Logo Audit

**Section:** §31–§33
**Status:** Implemented

## Asset

`public/legalir-logo.png` — 1024×1024 RGBA (transparent background), the
single approved brand mark. No duplicate or redesigned asset was created.

## Presentation changes

| Location | Old | New |
| --- | --- | --- |
| Web App sidebar | White mark inverted (`brightness-0 invert`) inside a `primary-700` box | Transparent mark + `LEGALIR` wordmark, matching the Landing presentation |
| Web App mobile top bar | Inverted mark inside a `primary-700` box | Transparent mark (`h-10 w-auto`) |
| Splash | `next/image` fill, `object-contain` | Unchanged (already correct) |
| Auth layout | Transparent mark on gradient | Unchanged (already correct) |

## Rules verified

- Original shape, typography, proportions, and brand colors preserved.
- Sufficient size, contrast, padding, and clear space on Light, Dark,
  Desktop, Mobile, Sidebar, Header, Auth, and Splash.
- No logo disappears against its background.

## Note

The `<img>` element is used (not `next/image`) for the mark to preserve exact
colors; `next/image` optimization is not required for this static brand asset
and would risk color shifting. This is a documented, intentional trade-off.
