// ============================================================
// LEGALIR — Contracts page analytics
// ============================================================
// The Contracts page is the top of the contract funnel, so the spec
// asks for the discovery events to be observable: which template was
// viewed, which category was picked, which filter was applied.
//
// There is no analytics vendor wired into the app yet. Rather than
// scatter `console.log`s or invent a fake endpoint, this module is the
// ONE place the page reports through: it pushes onto `window.dataLayer`
// when a tag manager is present and is otherwise a no-op. Swapping in
// a real vendor later means editing this file only.
// ============================================================

/** The discovery events the Contracts page emits. */
export type ContractAnalyticsEvent =
  | "contract_template_viewed"
  | "contract_template_started"
  | "contract_category_selected"
  | "contract_search_performed"
  | "contract_status_filtered"
  | "contract_type_filtered"
  | "contract_sort_changed"
  | "contract_view_all_clicked"
  | "contract_resumed";

interface DataLayerWindow extends Window {
  dataLayer?: Record<string, unknown>[];
}

/**
 * Report a Contracts-page event. Safe to call on the server and in
 * tests — it does nothing when there is no `window`.
 */
export function trackContractEvent(
  event: ContractAnalyticsEvent,
  props: Record<string, unknown> = {}
): void {
  if (typeof window === "undefined") return;
  const w = window as DataLayerWindow;
  if (!Array.isArray(w.dataLayer)) return;
  w.dataLayer.push({ event, ...props });
}
