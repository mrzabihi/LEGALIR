// ============================================================
// LEGALIR — landing «از کجا شروع کنم؟» → /new hand-off
// ============================================================
// The landing card lets a visitor describe a legal problem in one short
// box, then sends them into the real start flow (`/new`). The description
// is personal legal information, so it is handled under four rules:
//
//   • sessionStorage, never localStorage — the value lives in this tab
//     only and dies with the tab. Nothing is written to disk.
//   • never a query string — the text cannot end up in the URL, the
//     browser history, a referer header or the server's access logs.
//   • never logged — this module has no console/analytics call, and the
//     card never passes the text to `trackSignupEvent` or any other sink.
//   • cleared on read — `/new` consumes the draft once and drops it, so a
//     reload of the panel starts empty instead of resurfacing old text.
//
// A guest signs in between the card and `/new`; sessionStorage survives
// that same-tab navigation, which is exactly the "temporary, same-tab"
// window the brief allows. Anything longer is deliberately not supported.
// The same pattern already backs the pasted-contract review hand-off
// (`lib/contracts/pasted-review.ts`).

/** sessionStorage key. Scoped to the landing hand-off only. */
export const LANDING_START_DRAFT_KEY = "legalir-landing-start-draft";

/** The short box is a *pointer*, not a case file — cap it. */
export const LANDING_START_MAX_LENGTH = 300;

/** Below this, there is not enough text for the start flow to route on. */
export const LANDING_START_MIN_LENGTH = 10;

function storage(): Storage | null {
  // Private-mode Safari and a hardened browser can throw on access.
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Persist the description for the `/new` step in this tab.
 * @returns false when storage is unavailable, so the caller can show a
 * real message instead of silently dropping what the user wrote.
 */
export function writeLandingStartDraft(text: string): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(LANDING_START_DRAFT_KEY, text);
    return true;
  } catch {
    return false;
  }
}

/** Read the hand-off without consuming it. */
export function peekLandingStartDraft(): string | null {
  const store = storage();
  if (!store) return null;
  try {
    const value = store.getItem(LANDING_START_DRAFT_KEY);
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= LANDING_START_MAX_LENGTH
      ? trimmed
      : null;
  } catch {
    return null;
  }
}

/**
 * Read and drop the hand-off in one step. Called by the `/new` panel on
 * mount, so the text exists exactly as long as it takes to seed the box.
 */
export function consumeLandingStartDraft(): string | null {
  const value = peekLandingStartDraft();
  clearLandingStartDraft();
  return value;
}

/** Drop the hand-off (on success, on cancel, or when it is unusable). */
export function clearLandingStartDraft(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(LANDING_START_DRAFT_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}
