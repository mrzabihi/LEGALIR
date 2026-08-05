// ============================================================
// LEGALIR — MSW Browser Integration
// ============================================================

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

export async function initMsw() {
  if (typeof window === "undefined") return;

  try {
    await worker.start({
      onUnhandledRequest: "bypass",
      quiet: true,
    });
  } catch {
    // Worker already started or not supported
  }
}
