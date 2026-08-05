"use client";

import { IconWarning } from "@/lib/icons";

export function DisclaimerBanner() {
  return (
    <div className="flex items-start gap-2 p-3 rounded-medium bg-warning/[0.08] border border-warning/20">
      <IconWarning size={18} className="text-warning shrink-0 mt-0.5" />
      <p className="text-bodySmall text-onSurfaceVariant leading-relaxed">
        این پاسخ توسط هوش مصنوعی تولید شده و جایگزین مشاوره با وکیل متخصص نیست.
        LEGALIR هیچ قطعیتی در نتایج ارائه‌شده تضمین نمی‌کند.
        پیش از هر اقدام حقوقی، با وکیل مشورت کنید.
      </p>
    </div>
  );
}
