# LEGALIR — Image & asset conventions

> How image and icon assets are stored, referenced, optimized and checked, so
> the app renders identically after clone / push / PR / deploy with **no
> dependency on a developer's machine or a path outside the repo**.

---

## 1. Where assets live

Runtime assets live **only** under `apps/frontend/public/` — Next.js serves
that directory at the site root and the Docker image copies it into the
standalone bundle.

| Path | Contents |
| --- | --- |
| `public/*.png`, `*.ico` | logos, favicons, PWA/app icons |
| `public/assets/blog/` | blog cover art |
| `public/assets/promo/` | dashboard / services promotion banners (`*-sm` = mobile) |
| `public/assets/lawyers/` | demo portrait thumbnails |
| `public/demo-documents/` | seeded demo PDFs |

Source / design material the app never serves stays **out of `public/`**:
`DESIGN/`, `LAWYER/` and `Documents/` hold posters, avatars, brand art and
source logos. `Documents/` and `iran legal/` are gitignored; `DESIGN/` and
`LAWYER/` are tracked reference history. **No code references these folders.**

---

## 2. How to reference an asset

- Use a **root-relative URL from `public/`**: `src="/legalir-logo.png"`,
  `src="/assets/promo/legalir-banner-nda.webp"`.
- **Never** use an absolute or machine-local path (`D:\...`, `C:/...`,
  `/Users/...`, `/home/...`, `file://`), a temp file, or anything outside the
  repo.
- Prefer `next/image` for content images — `next.config.ts` enables AVIF/WebP
  so the optimizer emits a modern format automatically.
- Use a **plain `<img>`** only when the asset is an SVG with internal
  animation (e.g. `/assets/blog/legalir-animated.svg`) — `next/image` would
  rasterize it and drop the SMIL.
- Always give `width`/`height` (or `fill` + a sized container) to avoid layout
  shift. Lazy-load below-the-fold images; use `priority` /
  `fetchPriority="high"` on the hero only.

---

## 3. Adding a new asset

1. **Format** — **SVG** for logos/icons/graphics that are genuinely vector;
   **WebP** for photos and renders; PNG only when alpha or a legacy consumer
   requires it.
2. **Size** — export at the largest size it is displayed at × 2 (retina), not
   the multi-thousand-pixel master.
3. **Optimize before committing** — lossless first:
   - PNG: maximum zlib compression, adaptive filtering, palette only when the
     image is truly indexed.
   - SVG: pass through an SVG optimizer; keep `viewBox`, colours, opacity and
     structure unchanged.
   - WebP: lossless, or the lowest quality with **no visible** artifact,
     haloing, banding or transparency loss.
4. **Verify** there is no visible change before replacing an original. If the
   master is needed for future re-edits, keep it in `DESIGN/` or `Documents/`
   (never in `public/`) and commit only the production-size file.
5. **Drop it in `public/`** and reference it root-relative. No build step, no
   config entry.

---

## 4. What NOT to commit

- Build output, caches, `node_modules/`, `.next/`, temp files.
- QA screenshots and audit captures (gitignored by design).
- Duplicate copies of a `public/` asset at the repo root.

---

## 5. Pre-PR check

```
npm run check:assets
```

Dependency-free. It fails (exit 1) when source or config references an asset:

- an **absolute / non-portable path** (`D:\...`, `file://`, `/Users/…`,
  `/home/…`);
- a **root-relative ref with no matching file** in `public/`;
- a **case mismatch** that would 404 on Linux/CI but pass on a
  case-insensitive dev machine.

It also runs as the first step of `npm run validate`. Dynamic refs
(`/api/...`, template literals like `` `/promo-${n}.webp` ``) are skipped —
they resolve at runtime and are covered by tests.
