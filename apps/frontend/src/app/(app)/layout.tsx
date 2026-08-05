// ============================================================
// LEGALIR — Authenticated App Layout (Route Group)
// ============================================================

import { AppLayout } from "@/components/app";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
