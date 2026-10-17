// ============================================================
// LEGALIR — Admin · discovery analysis view
// ============================================================
// Renders one recorded path-discovery analysis for an operator. It is the
// SINGLE presentation of a `LegalRequestDiscovery` record, reused by the
// request drawer and the dedicated /admin/discovery panel so the two can
// never disagree about how a recommendation is described.
//
// The card preserves the record's central honesty guarantee: what the USER
// stated is shown separately from what the SYSTEM inferred, the provenance
// (model vs deterministic rules) is stated rather than implied, and the
// engine's ranking is shown apart from the user's actual choice — a guess is
// never dressed up as a fact.
// ============================================================

"use client";

import type { LegalRequestDiscovery } from "@legalir/types";
import { discoveryIntentLabel, discoveryCategoryLabel } from "@/lib/intake/discovery";
import { Badge } from "@/components/admin/ui";

export function DiscoveryAnalysis({
  discovery,
  className = "",
}: {
  discovery: LegalRequestDiscovery;
  className?: string;
}) {
  const chosen = discovery.paths.find((p) => p.selected);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* --- Provenance + signals --------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={discovery.source === "ai" ? "info" : "neutral"} dot>
          {discovery.source === "ai" ? "تحلیل با مدل" : "تحلیل با قواعد"}
        </Badge>
        {typeof discovery.confidence === "number" && (
          <Badge tone="brand">اطمینان {toFa(discovery.confidence)}٪</Badge>
        )}
        {discovery.needsLawyer && <Badge tone="warning">نیازمند وکیل</Badge>}
        {discovery.hasDocument && <Badge tone="neutral">همراه با سند</Badge>}
      </div>

      {/* --- What the user stated -------------------------------------- */}
      <div className="rounded-medium border border-divider bg-surface-container-low p-3">
        <h5 className="mb-2 text-caption font-bold text-muted">آنچه شما گفتید</h5>
        <blockquote className="whitespace-pre-wrap text-body-2 leading-relaxed text-on-surface">
          {discovery.description}
        </blockquote>
        {(discovery.explicitIntent || discovery.explicitCategory) && (
          <p className="mt-2 text-caption text-muted">
            انتخاب صریح کاربر:{" "}
            {[
              discovery.explicitIntent ? discoveryIntentLabel(discovery.explicitIntent) : null,
              discovery.explicitCategory
                ? discoveryCategoryLabel(discovery.explicitCategory)
                : null,
            ]
              .filter(Boolean)
              .join(" — ")}
          </p>
        )}
      </div>

      {/* --- What the engine inferred ---------------------------------- */}
      <div className="rounded-medium border border-divider p-3">
        <h5 className="mb-2 text-caption font-bold text-muted">حدس ما</h5>
        <dl className="space-y-2 text-caption">
          <Row label="خلاصه" value={discovery.summaryFa} />
          <Row label="هدف" value={discovery.goalFa} />
          <Row
            label="زمینهٔ استنباط‌شده"
            value={discoveryCategoryLabel(discovery.inferredCategory) ?? "—"}
          />
        </dl>
        {discovery.ambiguitiesFa.length > 0 && (
          <div className="mt-3">
            <span className="text-caption font-medium text-muted">نکات مبهم</span>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-caption text-on-surface-variant">
              {discovery.ambiguitiesFa.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* --- The ranked paths ------------------------------------------ */}
      <div>
        <h5 className="mb-2 text-caption font-bold text-muted">
          مسیرهای پیشنهادی ({toFa(discovery.paths.length)})
        </h5>
        <ol className="space-y-2">
          {discovery.paths.map((path, i) => (
            <li
              key={`${path.intent}-${i}`}
              className="rounded-medium border border-divider p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body-2 font-medium text-on-surface">
                  {path.titleFa || discoveryIntentLabel(path.intent)}
                </span>
                {path.primary && <Badge tone="brand">پیشنهاد اصلی</Badge>}
                {path.selected && <Badge tone="success">انتخاب کاربر</Badge>}
              </div>
              <p className="mt-1 text-caption text-on-surface-variant">{path.rationaleFa}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* --- Outcome ---------------------------------------------------- */}
      {chosen && (
        <p className="text-caption text-muted">
          مسیر نهایی: <span className="text-on-surface-variant">{chosen.titleFa}</span>
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-on-surface-variant">{value || "—"}</dd>
    </div>
  );
}

/** Persian-digit formatting for a small integer (the admin surfaces read fa-IR). */
function toFa(n: number): string {
  return n.toLocaleString("fa-IR");
}
