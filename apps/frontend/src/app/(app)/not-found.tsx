import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-6xl text-muted" aria-hidden="true">۴۰۴</div>
      <h1 className="text-h2 text-on-surface">صفحه یافت نشد</h1>
      <p className="text-body-2 text-muted max-w-sm">
        صفحه‌ای که به دنبال آن هستید وجود ندارد یا حذف شده است.
      </p>
      <Link
        href="/dashboard"
        className="rounded-medium bg-primary px-6 py-3 text-white font-button hover:opacity-90 transition-opacity touch-target mt-2"
      >
        بازگشت به خانه
      </Link>
    </div>
  );
}
