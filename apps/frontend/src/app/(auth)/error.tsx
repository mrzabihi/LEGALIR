"use client";

import { ErrorDisplay } from "@/lib/error-utils";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorDisplay
      title="خطا در بارگذاری"
      message={error.message || "مشکلی در بارگذاری صفحه احراز هویت رخ داده است."}
      onRetry={reset}
    />
  );
}
