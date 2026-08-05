"use client";

import { ErrorDisplay } from "@/lib/error-utils";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorDisplay
      title="خطا در بارگذاری صفحه"
      message={error.message || "مشکلی در بارگذاری این صفحه رخ داده است."}
      onRetry={reset}
    />
  );
}
