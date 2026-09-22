// ============================================================
// LEGALIR — Settings Shell
// ============================================================
// Shared chrome for every /settings/* sub-page: RTL breadcrumb
// (تنظیمات → current), a back link to the hub, page title and an
// optional description. Keeps the sub-pages focused on their own
// content instead of repeating layout.
// ============================================================

import Link from "next/link";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { IconArrowBack } from "@/lib/icons";

export function SettingsShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 tablet:p-6 max-w-2xl mx-auto" dir="rtl">
      <Breadcrumb
        items={[
          { label: "داشبورد", href: "/dashboard" },
          { label: "تنظیمات", href: "/settings" },
          { label: title },
        ]}
      />

      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/settings"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-divider/60 text-muted hover:text-primary transition-colors touch-target-min"
          aria-label="بازگشت به تنظیمات"
        >
          <IconArrowBack size={20} rtlFlip />
        </Link>
        <div className="min-w-0">
          <h1 className="text-h2 text-onSurface font-bold">{title}</h1>
          {description && (
            <p className="text-body-2 text-muted mt-1">{description}</p>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
