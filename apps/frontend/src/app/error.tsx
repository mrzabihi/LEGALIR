"use client";

import { ErrorDisplay } from "@/lib/error-utils";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa-IR" dir="rtl">
      <body>
        <ErrorDisplay
          title="خطای بحرانی"
          message={error.message || "خطای غیرمنتظره‌ای رخ داده است. لطفاً صفحه را refresh کنید."}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
