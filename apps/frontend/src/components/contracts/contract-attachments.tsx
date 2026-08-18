// ============================================================
// LEGALIR — Contract Attachments Panel
// Renders sample attached documents (laws, precedents, directives,
// regulations) with their legal sections.
// ============================================================

"use client";

import { useState } from "react";
import type { V1ContractAttachment } from "@legalir/types";
import { IconFile, IconChevronDown } from "@/lib/icons";

const KIND_BADGE: Record<string, string> = {
  law: "bg-blue-50 text-blue-700 border-blue-200",
  precedent: "bg-purple-50 text-purple-700 border-purple-200",
  directive: "bg-amber-50 text-amber-700 border-amber-200",
  regulation: "bg-emerald-50 text-emerald-700 border-emerald-200",
  other: "bg-neutral-50 text-neutral-600 border-neutral-200",
};

interface ContractAttachmentsProps {
  attachments: V1ContractAttachment[];
}

export function ContractAttachments({ attachments }: ContractAttachmentsProps) {
  if (!attachments || attachments.length === 0) {
    return (
      <div className="rounded-large bg-surface shadow-elevation-1 border border-divider p-8 text-center">
        <div className="text-4xl mb-4">📎</div>
        <h3 className="text-h3 text-onSurface mb-2">سند ضمیمه‌ای وجود ندارد</h3>
        <p className="text-body-2 text-muted">
          هنوز سندی به این قرارداد ضمیمه نشده است.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {attachments.map((attachment) => (
        <AttachmentCard key={attachment.id} attachment={attachment} />
      ))}
    </div>
  );
}

function AttachmentCard({ attachment }: { attachment: V1ContractAttachment }) {
  const [open, setOpen] = useState(false);
  const badge = KIND_BADGE[attachment.kind] ?? KIND_BADGE["other"];

  return (
    <div className="rounded-large bg-surface shadow-elevation-1 border border-divider overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start gap-3 p-4 text-right hover:bg-surface-hover transition-colors focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="h-10 w-10 rounded-medium bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <IconFile size={20} className="text-primary" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-body-1 font-medium text-onSurface">
              {attachment.title}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-caption font-medium ${badge}`}
            >
              {attachment.kindFa}
            </span>
          </span>
          <span className="block text-caption text-muted mt-1" dir="ltr">
            {attachment.fileName}
          </span>
        </span>
        <IconChevronDown
          size={20}
          className={`text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-divider bg-surface-container/40 p-4 space-y-3">
          {attachment.sections.map((section) => (
            <div key={section.id} className="rounded-medium bg-surface p-3 border border-divider/60">
              <h4 className="text-body-2 font-medium text-onSurface mb-1.5">
                {section.title}
              </h4>
              <p className="text-body-2 text-muted leading-relaxed whitespace-pre-line">
                {section.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
