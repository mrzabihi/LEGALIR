// ============================================================
// LEGALIR — the shared overlay layer stack
// ============================================================
// Every overlay in this package (Dialog, Drawer) attaches its own
// document-level keydown listener, so two open overlays mean two listeners
// answering the same keystroke. Two defects came out of that:
//
//   • Escape closed EVERY open layer at once. A confirm dialog opened from a
//     record drawer dismissed both — the drawer, its unsaved form state, and
//     the user's place in it — from a single keypress.
//   • `body.overflow` was written and cleared per overlay, so closing the
//     inner dialog released the scroll lock while the drawer underneath was
//     still covering the page.
//
// The stack fixes both by giving each open layer a token and an order:
// only the newest token may consume Escape or move focus, and the body scroll
// lock is reference counted so it is released by the LAST layer, not by
// whichever one happened to close first.
//
// Module scope, not React context, on purpose: the layers are portalled to
// <body> and often live in different subtrees (a drawer in a page, a dialog
// from a global prompt component), so no common provider exists.
// ============================================================

export type OverlayToken = symbol;

/** Open layers, oldest first. The last entry is the top layer. */
const layers: OverlayToken[] = [];

/** Number of open layers holding the body scroll lock. */
let lockDepth = 0;

/** `body.overflow` as it was before this package took the lock. */
let overflowBeforeLock = "";

function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (lockDepth === 0) {
    overflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockDepth += 1;
}

function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  if (lockDepth === 0) return;
  lockDepth -= 1;
  if (lockDepth === 0) {
    // Restore what the page had, rather than assuming "": a layer can be
    // opened above a page that was already locked by its own logic.
    document.body.style.overflow = overflowBeforeLock;
  }
}

/**
 * Register a now-open overlay. The returned token is the layer's identity for
 * its whole lifetime — store it and hand it back to `releaseOverlayLayer`.
 */
export function acquireOverlayLayer(): OverlayToken {
  const token: OverlayToken = Symbol("overlay-layer");
  layers.push(token);
  lockBodyScroll();
  return token;
}

/** Unregister a layer. Safe to call twice or after another layer closed. */
export function releaseOverlayLayer(token: OverlayToken) {
  const index = layers.indexOf(token);
  if (index === -1) return;
  layers.splice(index, 1);
  unlockBodyScroll();
}

/**
 * Whether `token` is the newest open layer — the only one allowed to answer a
 * key that belongs to the topmost surface.
 */
export function isTopOverlayLayer(token: OverlayToken | null): boolean {
  if (!token) return false;
  return layers[layers.length - 1] === token;
}

/** Whether any layer is currently registered. */
export function hasOpenOverlayLayer(): boolean {
  return layers.length > 0;
}
