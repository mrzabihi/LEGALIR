# LEGALIR — Favicon / Web App Icon Implementation

## Goal (Spec Tasks 3–6)

Provide a complete, framework-native favicon set so the LEGALIR brand mark renders
correctly across the public website, authenticated web app, desktop and mobile
browsers, and mobile home-screen shortcuts — with **no HTTP 404s** for any icon
or manifest request.

## Approach

- **No brand redesign.** The existing approved transparent `public/legalir-logo.png`
  (1024×1024 RGBA) was used as the single source asset.
- **Derived assets** were generated programmatically with `sharp` (already present
  in `node_modules`) rather than hand-editing pixels, guaranteeing consistent
  transparent edges at every size.

## Assets Generated

| File | Size | Purpose |
| --- | --- | --- |
| `public/favicon.ico` | 16/32/48 packed | legacy browser tab icon |
| `public/favicon-16.png` | 16×16 | small tab icon |
| `public/favicon-32.png` | 32×32 | tab icon |
| `public/favicon-48.png` | 48×48 | tab icon |
| `public/apple-touch-icon.png` | 180×180 | iOS / Apple home-screen |
| `public/icon-192.png` | 192×192 | PWA / Android app icon |
| `public/icon-512.png` | 512×512 | PWA splash / maskable base |

Generator script: `apps/frontend/scripts/generate-icons.mjs`
Run with `node scripts/generate-icons.mjs` (idempotent — overwrites deterministically).

The `.ico` is produced by embedding PNG frames (PNG is a valid ICO payload, giving
full 32-bit transparency instead of a 1-bit mask).

## Metadata / Manifest Wiring

### `src/app/layout.tsx`
- `metadata.icons` now declares `favicon.ico`, `favicon-16.png`, `favicon-32.png`,
  and `apple-touch-icon.png`.
- `viewport.themeColor` set to brand navy: `#162033` (light) / `#0B1220` (dark).

### `public/manifest.json`
- `name: LEGALIR`, `short_name: لیگالیر`
- `theme_color: #162033`, `background_color: #0F172A`
- `icons` array with 192 and 512 entries plus a `maskable` variant — maskable
  icons prevent the app icon from disappearing in dark OS mode.

## QA Checklist (Spec Task 6)

| Route | Tab icon | 404-free |
| --- | --- | --- |
| Landing `/` | yes | yes |
| Dashboard `/dashboard` | yes | yes |
| Login `/login` | yes | yes |
| Profile `/profile` | yes | yes |
| Blog `/blog` | yes | yes |
| Unknown 404 route | yes | yes |

All icon/manifest paths resolve from `public/`, which Next.js serves at the root —
no favicon 404 is produced.
