// ============================================================
// LEGALIR — useIsHydrated
// ============================================================
// `false` while rendering on the server AND during the client's hydration
// render, then `true` once hydration has completed.
//
// Why this exists: an SSR-ed Client Component whose first client render must
// be byte-identical to the server HTML cannot branch on a value that may
// already differ on the client at hydration time. The classic offender is a
// React Query result: `["me"]` is fetched by the app shell, which can finish
// (and warm the cache) *before* a page nested in its own Suspense boundary
// (see `(app)/loading.tsx`) hydrates. React Query hands the same live
// `getCurrentResult()` to both `getSnapshot` and `getServerSnapshot`, so at
// hydration the page would read a resolved query while the server rendered its
// pending/loading state — a hydration mismatch.
//
// Gating the loading branch on `!useIsHydrated()` forces the hydration render
// to match the server; the live value is read on every later render. Because
// `useSyncExternalStore` only falls back to the server snapshot while
// hydrating, a pure client-side mount (in-app navigation) reads `true`
// immediately — so navigation never flashes a loading state.

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
