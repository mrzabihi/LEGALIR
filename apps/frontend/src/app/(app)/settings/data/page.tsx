// ============================================================
// LEGALIR — Settings · Data Management (مدیریت داده‌ها)
// ============================================================
// Data export is not yet implemented. Rather than simulate a
// successful export/delete, the actions are shown as disabled with an
// explicit "به‌زودی" state so the UI never lies about what happened.
// ============================================================

"use client";

import { SettingsShell } from "@/components/settings/settings-shell";
import { SettingsCard, EmptyState } from "@/components/settings/settings-ui";
import { IconFile, IconDownload, IconDelete } from "@/lib/icons";

export default function DataSettingsPage() {
  return (
    <SettingsShell
      title="مدیریت داده‌ها"
      description="دریافت خروجی از داده‌ها و حذف تاریخچه خروجی‌ها."
    >
      <SettingsCard title="مدیریت داده‌ها" icon={<IconFile size={22} />}>
        <div className="mb-5">
          <p className="text-body-2 text-muted mb-3">
            شما می‌توانید یک نسخه کامل از تمام داده‌های خود شامل تحلیل اسناد،
            تاریخچه گفتگوها، قراردادهای تولیدشده و تنظیمات حساب را به صورت یک
            فایل ZIP دریافت کنید. آماده‌سازی فایل ممکن است تا چند ساعت طول بکشد.
          </p>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-body-2 text-on-primary font-medium opacity-50 cursor-not-allowed transition"
          >
            <IconDownload size={16} />
            دریافت خروجی از تمام داده‌های من
          </button>
          <p className="mt-2 text-caption text-muted">
            این قابلیت به‌زودی فعال می‌شود.
          </p>
        </div>

        <hr className="border-divider my-5" />

        <div className="mb-5">
          <h3 className="text-body-1 text-on-surface font-medium mb-3">
            تاریخچه خروجی‌ها
          </h3>
          <EmptyState text="تاکنون خروجی داده‌ای درخواست نشده است." />
        </div>

        <hr className="border-divider my-5" />

        <div>
          <p className="text-body-2 text-muted mb-3">
            با حذف تاریخچه خروجی‌ها، تمام فایل‌های خروجی قبلی از سرور حذف شده و
            لینک‌های دانلود آن‌ها از کار خواهد افتاد. این عمل قابل بازگشت نیست.
          </p>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 rounded-full border border-error/30 px-4 py-2 text-body-2 text-error opacity-50 cursor-not-allowed transition"
          >
            <IconDelete size={16} />
            حذف تاریخچه خروجی‌ها
          </button>
          <p className="mt-2 text-caption text-muted">
            این قابلیت به‌زودی فعال می‌شود.
          </p>
        </div>
      </SettingsCard>
    </SettingsShell>
  );
}
