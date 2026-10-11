// ============================================================
// LEGALIR — canonical site origin (single source of truth)
// ============================================================
// The absolute origin used for `metadataBase`, canonical URLs, the sitemap and
// robots. It is ENV-DRIVEN on purpose: never hard-code a production domain.
//
// Set `NEXT_PUBLIC_SITE_URL` in the deployment environment (see .env.example),
// e.g. `NEXT_PUBLIC_SITE_URL=https://legalir.ir`. When unset (local dev, CI,
// tests) it falls back to the dev origin so relative metadata still resolves
// to an absolute URL without guessing a real domain.
// ============================================================

const FALLBACK_ORIGIN = "http://localhost:3000";

function normalizeOrigin(value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return FALLBACK_ORIGIN;
  // Accept a bare host (`legalir.ir`) or a full origin; `new URL` needs a scheme.
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    // Drop any trailing slash so `${SITE_URL}${path}` never doubles up.
    return new URL(withScheme).origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

/** Absolute site origin with no trailing slash, e.g. `https://legalir.ir`. */
export const SITE_URL = normalizeOrigin(process.env["NEXT_PUBLIC_SITE_URL"]);

/**
 * Absolute URL for a site-relative path (`/about` → `https://legalir.ir/about`).
 * A leading slash is added when missing; `/` returns the bare origin.
 */
export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Robots directive for private surfaces (the authenticated app, the admin
 * panel and the auth/onboarding flows). Spread into a page's `metadata`:
 * `export const metadata = { ...NOINDEX_ROBOTS }`.
 * `follow: false` also stops crawlers from following in-app links to content
 * that must never be indexed.
 */
export const NOINDEX_ROBOTS = {
  robots: { index: false, follow: false },
} as const;
