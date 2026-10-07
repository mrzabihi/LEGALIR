// ============================================================
// LEGALIR — Admin · Energy & Service Cost (انرژی و هزینهٔ خدمات)
// ============================================================
// Route entry for the §6 surface. Authorization is enforced by the admin
// shell (route visibility) and, authoritatively, by every admin API; this
// page only resolves the caller's own manage-permission so it can render the
// controls as read-only for a viewer who may look but not touch.
// ============================================================

"use client";

import { useAdminMe } from "@/hooks/useAdmin";
import { EnergyCostCenter } from "@/components/admin/energy-cost-center";

export default function AdminEnergyPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:energy:manage");

  return <EnergyCostCenter canManage={canManage} />;
}
