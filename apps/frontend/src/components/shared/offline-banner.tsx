"use client";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 bg-error text-on-error text-center py-2 px-4 text-body-2 font-medium"
    >
      ارتباط با اینترنت قطع شده است. برخی امکانات در دسترس نیستند.
    </div>
  );
}
