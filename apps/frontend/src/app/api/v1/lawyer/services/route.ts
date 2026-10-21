// ============================================================
// LEGALIR — GET /api/v1/lawyer/services
// ============================================================
// The catalogue of services a lawyer can price, each joined with the lawyer's
// current rate and the SLA policy that applies to it. One call powers the
// rates page without the client having to know the taxonomy.
// ============================================================

import { NextResponse } from "next/server";
import { LAWYER_SERVICES } from "@legalir/types";
import { requireLawyer } from "@/lib/lawyer-portal/http";
import { getSlaPolicyForService, listLawyerRates } from "@/lib/lawyer-portal/store";
import { isPolicyActive } from "@/lib/lawyer-portal/sla";

export async function GET(request: Request) {
  const auth = requireLawyer(request, "lawyer:rates:manage");
  if (!auth.ok) return auth.response;

  const rates = listLawyerRates(auth.lawyer.profile.id);
  const byKey = new Map(rates.map((r) => [r.serviceKey, r]));

  const services = LAWYER_SERVICES.map((service) => {
    const policy = getSlaPolicyForService(service.id);
    return {
      id: service.id,
      nameFa: service.nameFa,
      descriptionFa: service.descriptionFa,
      onlineCapable: service.onlineCapable,
      rate: byKey.get(service.id) ?? null,
      sla: {
        responseHours: policy.responseHours,
        completionHours: policy.completionHours,
        clock: policy.clock,
        pauseBehavior: policy.pauseBehavior,
        warnBeforeHours: policy.warnBeforeHours,
        // A deactivated/archived policy still shows its numbers (so the lawyer
        // can see what WOULD apply) but is clearly not in force.
        active: isPolicyActive(policy),
        audience: policy.audience ?? "both",
      },
    };
  });

  return NextResponse.json({ data: { services } });
}
