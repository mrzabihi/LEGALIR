"use client";

import { IconInfo } from "@/lib/icons";

export function DisclaimerBanner() {
  return (
    <div className="flex items-start gap-2 p-3 rounded-medium bg-primary-container border border-primary">
      <IconInfo size={18} className="text-primary shrink-0 mt-0.5" />
      <p className="text-bodySmall text-onSurfaceVariant leading-relaxed">
        تحلیل تخصصی حقوقی، همراه با منابع و مستندات مرتبط
      </p>
    </div>
  );
}
