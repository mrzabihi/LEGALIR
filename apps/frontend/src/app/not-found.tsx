// ============================================================
// LEGALIR — Custom 404 Not Found
// Branded, minimal, premium Persian 404
// ============================================================

import Link from "next/link";
import { IconHome, IconDashboard } from "@/lib/icons";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center bg-background">
      {/* Subtle brand mark */}
      <div
        className="text-[120px] leading-none font-bold text-surface-variant select-none"
        aria-hidden="true"
      >
        ۴۰۴
      </div>

      <div className="space-y-2">
        <h1 className="text-h2 text-on-surface">این صفحه پیدا نشد</h1>
        <p className="text-body-2 text-muted max-w-sm mx-auto">
          ممکن است آدرس تغییر کرده باشد یا صفحه دیگر در دسترس نباشد.
        </p>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-surface border border-divider px-6 py-3 text-body-2 text-on-surface font-medium hover:bg-surface-hover transition-colors touch-target"
        >
          <IconHome size={18} />
          بازگشت به خانه
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-body-2 text-white font-medium hover:bg-primary-variant transition-colors touch-target"
        >
          <IconDashboard size={18} />
          رفتن به داشبورد
        </Link>
      </div>

      {/* Subtle footer */}
      <p className="text-caption text-muted mt-8">
        LEGALIR — دستیار هوشمند حقوقی ایران
      </p>
    </div>
  );
}
