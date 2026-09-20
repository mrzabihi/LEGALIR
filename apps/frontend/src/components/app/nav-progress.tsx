"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// ============================================================
// NavProgress — global route-transition progress bar
// ============================================================
// App Router gives no built-in "navigation started" signal for
// arbitrary <Link>s, so we listen for internal anchor clicks in the
// capture phase and show a thin top bar until the pathname commits.
// This makes slow transitions (dev compile, cold RSC fetch) feel
// responsive instead of frozen.

/** Hard ceiling so a failed navigation can never leave the bar stuck. */
const SAFETY_TIMEOUT_MS = 8000;

function isInternalNavigation(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute("href");
  if (!href) return false;
  if (href.startsWith("#")) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  if (anchor.dataset["noNavProgress"] !== undefined) return false;

  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  // Same path + query means no navigation will occur.
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return false;
  }
  return true;
}

export function NavProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Start the bar on any qualifying internal link click.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const anchor = target?.closest?.("a");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (!isInternalNavigation(anchor)) return;

      setPending(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Clear the bar once the destination route commits.
  useEffect(() => {
    setPending(false);
  }, [pathname]);

  // Safety timeout in case the navigation never commits.
  useEffect(() => {
    if (!pending) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = window.setTimeout(() => setPending(false), SAFETY_TIMEOUT_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pending]);

  if (!pending) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
      aria-hidden="true"
    >
      <div className="nav-progress-bar h-full w-full origin-right bg-gradient-to-l from-primary-500 via-primary-600 to-secondary-400" />
    </div>
  );
}
