// ============================================================
// LEGALIR — Test Setup (Vitest + React Testing Library)
// ============================================================

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, afterAll } from "vitest";
import { server } from "@/mocks/server";

// jsdom implements neither ResizeObserver nor matchMedia; components that
// measure their container (the document preview card / PDF viewer) need
// both. Minimal no-op shims — tests assert on rendered output, not layout.
if (typeof globalThis.ResizeObserver === "undefined") {
  /* eslint-disable @typescript-eslint/no-empty-function */
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  /* eslint-enable @typescript-eslint/no-empty-function */
}

// jsdom has no IntersectionObserver; the article table of contents uses
// one to track the active heading. A no-op shim is enough — tests assert
// on the rendered anchors, not on scroll-spy behaviour.
if (typeof globalThis.IntersectionObserver === "undefined") {
  /* eslint-disable @typescript-eslint/no-empty-function */
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  } as unknown as typeof IntersectionObserver;
  /* eslint-enable @typescript-eslint/no-empty-function */
}

if (typeof window !== "undefined" && !window.matchMedia) {
  /* eslint-disable @typescript-eslint/no-empty-function */
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  /* eslint-enable @typescript-eslint/no-empty-function */
}

// MSW server for all tests
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
