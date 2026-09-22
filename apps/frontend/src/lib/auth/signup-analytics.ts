// ============================================================
// LEGALIR — Signup entry analytics
// ============================================================
// The signup entry page is the top of the registration funnel, so the spec
// asks for the entry/selection events to be observable. There is no analytics
// vendor wired into the app yet. Rather than scatter `console.log`s or invent
// a fake endpoint, this module is the ONE place the page reports through: it
// pushes onto `window.dataLayer` when a tag manager is present and is
// otherwise a no-op. Swapping in a real vendor later means editing this file
// only.
//
// No PII is ever included — the events carry the event name and nothing else.

/** The signup-entry events the registration page emits. */
export type SignupEvent =
  | "signup_entry_viewed"
  | "signup_personal_selected"
  | "signup_lawyer_selected"
  | "signup_business_selected"
  | "login_from_register_clicked";

interface DataLayerWindow extends Window {
  dataLayer?: Record<string, unknown>[];
}

/**
 * Report a signup-entry event. Safe to call on the server and in tests — it
 * does nothing when there is no `window`.
 */
export function trackSignupEvent(event: SignupEvent): void {
  if (typeof window === "undefined") return;
  const w = window as DataLayerWindow;
  if (!Array.isArray(w.dataLayer)) return;
  w.dataLayer.push({ event });
}
