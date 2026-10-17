// ============================================================
// LEGALIR — useCreateAction
// ============================================================
// One source of truth for the «ساخت جدید» quick-action sheet flow, shared
// by every create entry point (the mobile/PWA centre button and the
// desktop sidebar item).
//
// The flow: the create entry is a verb *and* a destination. Tapping it first
// navigates to `/new` (the full «ساخت جدید» launcher) and then raises the
// sheet, so dismissing the sheet never dumps the user back on the previous
// page — they land on the launcher they just "opened".
//
// A pending-arrival ref marks the entry's own navigation so the route-change
// effect can tell "I opened the launcher" apart from "the user navigated
// elsewhere" (which must close the sheet). Every other route change — a
// destination tap, browser back/forward — closes the sheet.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/** The launcher route the create entry lands on before raising the sheet. */
export const CREATE_LAUNCHER_PATH = "/new";

export function useCreateAction() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Set while the create entry is navigating to `/new` *and* opening the
  // sheet, so the route-change effect below never mistakes that arrival for
  // a normal route change (which must close the sheet).
  const openingLauncherRef = useRef(false);

  function toggle() {
    if (open) {
      openingLauncherRef.current = false;
      setOpen(false);
      return;
    }
    openingLauncherRef.current = true;
    if (pathname !== CREATE_LAUNCHER_PATH) router.push(CREATE_LAUNCHER_PATH);
    setOpen(true);
  }

  const close = () => setOpen(false);

  useEffect(() => {
    const isOwnLauncherArrival =
      openingLauncherRef.current && pathname === CREATE_LAUNCHER_PATH;
    openingLauncherRef.current = false;
    if (isOwnLauncherArrival) return;
    setOpen(false);
  }, [pathname]);

  return { open, toggle, close };
}
