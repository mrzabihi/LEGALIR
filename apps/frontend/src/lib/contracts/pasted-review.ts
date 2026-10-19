// ============================================================
// LEGALIR — Pasted-contract hand-off
// ============================================================
// A pasted contract can be tens of kilobytes, so it must not travel in a
// URL query string. Instead the review page puts the composed message in
// sessionStorage under a one-shot token and navigates with that token;
// the chat surface takes it out (read + delete) exactly once.
//
// Why sessionStorage and not localStorage: the hand-off is one navigation,
// not a saved draft. Closing the tab must not leave the user's contract
// text lying around in persistent storage.

const KEY_PREFIX = "legalir:review-pasted:";

function keyFor(token: string): string {
  return `${KEY_PREFIX}${token}`;
}

/** Store the composed message for one navigation. */
export function stashPastedReview(token: string, message: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(keyFor(token), message);
  } catch {
    // Storage can be unavailable (private mode / quota). The chat surface
    // then opens with an empty composer instead of a message — never with
    // someone else's text.
  }
}

/** Read the message and retire the token, so a refresh cannot replay it. */
export function takePastedReview(token: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = keyFor(token);
    const message = window.sessionStorage.getItem(key);
    if (message === null) return null;
    window.sessionStorage.removeItem(key);
    return message;
  } catch {
    return null;
  }
}

/** A one-shot token for the hand-off. */
export function newPastedReviewToken(): string {
  return crypto.randomUUID();
}
