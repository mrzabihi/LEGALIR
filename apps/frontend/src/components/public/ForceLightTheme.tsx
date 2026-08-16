"use client";

import { useLayoutEffect } from "react";

/**
 * ForceLightTheme — pins the public (marketing) site to the single light theme.
 *
 * Per product spec the Landing (and the rest of the public `(public)` route
 * group) must be Light-only and must not react to the Web App's persisted
 * dark preference. The authenticated Web App keeps Light+Dark.
 *
 * This only mutates the `data-theme` DOM attribute; it never writes to
 * `localStorage`, so a user's saved Web App theme is preserved and re-applied
 * when they navigate back into the app.
 */
export function ForceLightTheme() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");

    // Re-assert light if any other theme store tries to re-apply dark on a
    // public route (e.g. the shared ThemeProvider reading a persisted value).
    const observer = new MutationObserver(() => {
      if (document.documentElement.getAttribute("data-theme") !== "light") {
        document.documentElement.setAttribute("data-theme", "light");
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
