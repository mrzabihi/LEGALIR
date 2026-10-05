// ============================================================
// LEGALIR — App-scoped 404 (inside the (app) layout)
// The app layout already supplies the sidebar / top bar / bottom nav, so
// this only renders the shared view. `min-h-[60vh]` centres it; the
// layout's `pb-24` keeps it clear of the mobile bottom nav.
// ============================================================

import { NotFoundView } from "@/components/shared";

export default function AppNotFound() {
  return <NotFoundView className="min-h-[60vh]" />;
}
