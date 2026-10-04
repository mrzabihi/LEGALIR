// ============================================================
// LEGALIR — Service Worker registrar
// ============================================================
// Registers /sw.js after the page is interactive and manages updates.
//
// Update policy: when a new worker is waiting, we do NOT reload the page.
// Instead we surface a Persian snackbar with an explicit «به‌روزرسانی» action.
// Only when the user taps it do we tell the worker to skipWaiting and reload —
// so an unsaved form or draft is never wiped by a surprise refresh.
//
// Registration is skipped in development: the dev server serves modules
// unbundled and a stale cache would fight hot reload.

"use client";

import { useEffect, useRef } from "react";
import { snackbar } from "@legalir/ui";

export function ServiceWorkerRegistrar() {
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let registration: ServiceWorkerRegistration | null = null;
    let updateTimer: number | undefined;

    const promptUpdate = (worker: ServiceWorker) => {
      snackbar.show({
        message: "نسخه جدید لیگالیر آماده است.",
        variant: "info",
        duration: 0,
        action: {
          label: "به‌روزرسانی",
          onClick: () => {
            reloadingRef.current = true;
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // A worker already waiting from a previous visit.
        if (registration.waiting && navigator.serviceWorker.controller) {
          promptUpdate(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration?.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              promptUpdate(installing);
            }
          });
        });

        // Poll for updates hourly while the tab stays open.
        updateTimer = window.setInterval(() => {
          registration?.update().catch(() => undefined);
        }, 60 * 60 * 1000);
      } catch {
        /* registration is best-effort; the app works without it */
      }
    };

    // Reload once the new worker takes control (after the user accepted).
    const onControllerChange = () => {
      if (reloadingRef.current) {
        reloadingRef.current = false;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
      if (updateTimer) window.clearInterval(updateTimer);
    };
  }, []);

  return null;
}
