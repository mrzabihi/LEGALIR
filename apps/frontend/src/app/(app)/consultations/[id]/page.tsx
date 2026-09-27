// ============================================================
// LEGALIR — Consultation case room (PART 25)
// ============================================================
// Role-aware host for the case room. The server decides whether the viewer
// is the client or the assigned lawyer; the room renders the matching
// actions. A foreign viewer receives a 404 from the API, surfaced here as
// a not-found state.
// ============================================================

"use client";

import { use } from "react";
import { ConsultationRoom } from "@/components/consultations/consultation-room";

export default function ConsultationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ConsultationRoom id={id} />;
}
