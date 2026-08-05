"use client";

import { IconPerson } from "@/lib/icons";

export function EscalationCta() {
  return (
    <div className="rounded-large bg-surface p-4 border border-divider text-center">
      <p className="text-bodyMedium text-onSurfaceVariant mb-3">
        نیاز به مشاوره تخصصی دارید؟
      </p>
      <button
        disabled
        className="inline-flex items-center gap-2 rounded-medium bg-outline/10 text-onSurfaceVariant px-5 py-3 text-button cursor-not-allowed"
        aria-label="مشاوره با وکیل (به‌زودی)"
        title="بازارگاه وکلا به‌زودی راه‌اندازی می‌شود"
      >
        <IconPerson size={18} />
        مشاوره با وکیل
      </button>
      <p className="text-bodySmall text-muted mt-2">به‌زودی — بازارگاه وکلا</p>
    </div>
  );
}
