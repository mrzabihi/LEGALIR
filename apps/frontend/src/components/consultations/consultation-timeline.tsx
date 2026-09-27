"use client";

// ============================================================
// LEGALIR — Consultation state timeline
// ============================================================
// The auditable history of the request: every meaningful state change,
// when it happened, and who performed it. The actor is rendered from the
// recorded role (client / lawyer / system) — never a raw user id.
// ============================================================

import { IconHistory } from "@/lib/icons";
import { LEGAL_REQUEST_STATE_FA, type LegalRequestEvent } from "@legalir/types";
import { formatDateTime } from "./consultation-status";

/** A human label for the actor who drove a transition. */
function actorLabel(ev: LegalRequestEvent): string {
  if (ev.actorRole === "LAWYER") return "وکیل";
  if (ev.actorRole === "system") return "سیستم";
  if (ev.actorRole === "ADMIN" || ev.actorRole === "SUPER_ADMIN") return "پشتیبانی";
  return "کاربر";
}

export function ConsultationTimeline({ events }: { events: LegalRequestEvent[] }) {
  return (
    <section className="rounded-2xl border border-divider/60 bg-surface p-5">
      <h2 className="mb-4 flex items-center gap-2 text-h3 text-on-surface">
        <IconHistory size={18} />
        تاریخچه وضعیت
      </h2>
      {events.length === 0 ? (
        <p className="text-body-2 text-muted">هنوز رویدادی ثبت نشده است.</p>
      ) : (
        <ol className="relative space-y-4 border-r border-divider/70 pr-5">
          {events.map((ev) => (
            <li key={ev.id} className="relative">
              <span className="absolute -right-[26px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary ring-4 ring-surface" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body-2 font-medium text-on-surface">
                  {LEGAL_REQUEST_STATE_FA[ev.toState]}
                </span>
                {ev.fromState && (
                  <span className="text-caption text-muted">
                    از {LEGAL_REQUEST_STATE_FA[ev.fromState]}
                  </span>
                )}
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-caption text-muted">
                  {actorLabel(ev)}
                </span>
              </div>
              {ev.note && <p className="mt-1 text-body-2 text-muted">{ev.note}</p>}
              <p className="mt-1 text-caption text-muted">{formatDateTime(ev.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
