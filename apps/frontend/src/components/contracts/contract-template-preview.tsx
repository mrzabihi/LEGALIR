// ============================================================
// LEGALIR — Contract template preview
// ============================================================
// Before a user starts a contract they should be able to see what
// KIND of document they are about to build: which sections the wizard
// will walk them through, who the parties are, which documents must be
// uploaded, and whether an official registration is legally required.
//
// Every line of this dialog comes from the REAL registry definition —
// nothing here is invented copy. The dialog is a STRUCTURE preview, not
// the final contract text (that text is generated from the user's own
// data), and it says so explicitly.
//
// Preview content and the start action are kept visually separate: the
// body only reads, and the single committing action lives in the dialog
// footer, clearly labelled with the same verb as the card's CTA.
// ============================================================

"use client";

import { Dialog, Button } from "@legalir/ui";
import {
  partyRoleLabelFa,
  TERMINAL_WIZARD_STEP_IDS,
  type ContractDefinition,
} from "@/lib/contracts/registry";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IconCheck,
  IconContract,
  IconDocument,
  IconGavel,
  IconUsers,
} from "@/lib/icons";

interface ContractTemplatePreviewProps {
  /** The template being previewed, or null when the dialog is closed. */
  definition: ContractDefinition | null;
  onClose: () => void;
  /** Start a contract of the previewed type. */
  onStart: (definition: ContractDefinition) => void;
  /** True while this template's contract is being created. */
  starting?: boolean;
}

/** A small labelled block used for the three quick facts up top. */
function MetaFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-medium bg-surface-container-low px-3 py-2">
      <span className="mt-0.5 shrink-0 text-primary" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-labelSmall text-muted">{label}</p>
        <p className="truncate text-labelLarge font-medium text-on-surface">{value}</p>
      </div>
    </div>
  );
}

export function ContractTemplatePreview({
  definition,
  onClose,
  onStart,
  starting = false,
}: ContractTemplatePreviewProps) {
  if (!definition) return null;

  // The terminal stages (review, signature, final) own no fields, so they
  // are not listed as sections the user fills in.
  const steps = definition.wizardSteps.filter((s) => !TERMINAL_WIZARD_STEP_IDS.includes(s.id));
  const requiredDocs = definition.requiredDocuments.filter((d) => d.required);
  const optionalDocs = definition.requiredDocuments.filter((d) => !d.required);
  const roles = definition.roles.map(partyRoleLabelFa);
  const registrationRequired = definition.registrationPolicy.officialRegistrationRequired;

  return (
    <Dialog
      open
      onClose={onClose}
      title={definition.typeFa}
      description={definition.descriptionFa}
      maxWidth="2xl"
      actions={
        <>
          {/* Closing reads as the quiet secondary choice; starting the
              wizard is the only committing action. */}
          <Button type="button" variant="text" onClick={onClose}>
            بستن
          </Button>
          <Button
            type="button"
            onClick={() => onStart(definition)}
            disabled={starting}
            startIcon={<IconContract size={18} />}
          >
            {starting ? "در حال ایجاد…" : definition.ctaFa}
          </Button>
        </>
      }
    >
      <div className="space-y-5 pb-1">
        {/* Three facts at a glance — how much to fill in, with whom, and
            how many documents the process expects. */}
        <div className="grid grid-cols-1 gap-2 tablet:grid-cols-3">
          <MetaFact
            icon={<IconContract size={16} />}
            label="بخش‌های تنظیم"
            value={`${toPersianNumber(steps.length)} مرحله`}
          />
          <MetaFact
            icon={<IconUsers size={16} />}
            label="طرفین قرارداد"
            value={roles.join(" و ")}
          />
          <MetaFact
            icon={<IconDocument size={16} />}
            label="مدارک الزامی"
            value={`${toPersianNumber(requiredDocs.length)} مدرک`}
          />
        </div>

        {/* The contract's structure — the core of the preview. */}
        <section aria-labelledby="preview-structure">
          <h3 id="preview-structure" className="text-titleSmall font-semibold text-on-surface">
            ساختار قرارداد
          </h3>
          <ol className="mt-2 space-y-1.5">
            {steps.map((step, index) => (
              <li
                key={step.id}
                className="flex items-start gap-2.5 rounded-medium border border-divider bg-surface px-3 py-2"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-container text-labelSmall font-semibold text-primary"
                >
                  {toPersianNumber(index + 1)}
                </span>
                <div className="min-w-0">
                  <p className="text-labelLarge font-medium text-on-surface">{step.titleFa}</p>
                  <p className="text-caption text-muted">{step.descriptionFa}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Documents the user should prepare — required first, then the
            optional ones, each tagged so the two are never confused. */}
        {definition.requiredDocuments.length > 0 && (
          <section aria-labelledby="preview-documents">
            <h3 id="preview-documents" className="text-titleSmall font-semibold text-on-surface">
              مدارک موردنیاز
            </h3>
            <ul className="mt-2 grid grid-cols-1 gap-1.5 tablet:grid-cols-2">
              {[...requiredDocs, ...optionalDocs].map((doc) => (
                <li
                  key={`${doc.category}-${doc.labelFa}`}
                  className="flex items-center justify-between gap-2 rounded-medium bg-surface-container-low px-3 py-1.5"
                >
                  <span className="flex min-w-0 items-center gap-2 text-labelMedium text-on-surface">
                    <IconDocument size={14} aria-hidden="true" className="shrink-0 text-muted" />
                    <span className="truncate">{doc.labelFa}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-labelSmall ${
                      doc.required
                        ? "bg-primary-container text-primary"
                        : "bg-surface-container text-muted"
                    }`}
                  >
                    {doc.required ? "الزامی" : "اختیاری"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Registration policy — a legal fact from the registry, never a
            hard-coded claim in the UI. */}
        <section
          aria-labelledby="preview-registration"
          className="rounded-medium border border-divider bg-surface-container-low p-3"
        >
          <h3
            id="preview-registration"
            className="flex items-center gap-1.5 text-titleSmall font-semibold text-on-surface"
          >
            <IconGavel size={16} aria-hidden="true" className="text-primary" />
            ثبت رسمی
            <span
              className={`rounded-full px-2 py-0.5 text-labelSmall ${
                registrationRequired
                  ? "bg-error-50 text-error"
                  : "bg-success-50 text-success-700"
              }`}
            >
              {registrationRequired ? "الزامی" : "اختیاری"}
            </span>
          </h3>
          <p className="mt-1.5 text-body-2 leading-6 text-on-surface-variant">
            {definition.registrationPolicy.explanationFa}
          </p>
        </section>

        {/* What this preview is — and is not. Keeps the structural view
            from being mistaken for the final contract text. */}
        <p className="flex items-start gap-1.5 text-caption text-muted">
          <IconCheck size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-success-700" />
          این پیش‌نمایش ساختار و مدارک قرارداد را نشان می‌دهد؛ متن نهایی پس از تکمیل اطلاعات شما
          ساخته و به تأیید طرفین می‌رسد.
        </p>
      </div>
    </Dialog>
  );
}
