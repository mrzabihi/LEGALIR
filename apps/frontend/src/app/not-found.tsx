// ============================================================
// LEGALIR — Custom 404 Not Found
// Modern gradient design consistent with dashboard/profile/services
// ============================================================

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center bg-background" dir="rtl">
      {/* Large gradient 404 */}
      <div
        className="text-[140px] tablet:text-[180px] leading-none font-black select-none bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 bg-clip-text text-transparent"
        aria-hidden="true"
      >
        ۴۰۴
      </div>

      {/* Illustration — compass/search icon suggesting "lost" */}
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary-100 to-blue-100 border border-primary/10 flex items-center justify-center -mt-4 shadow-sm">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary-600"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          <path d="M8 11a3 3 0 1 0 6 0 3 3 0 1 0-6 0" />
        </svg>
      </div>

      <div className="space-y-2">
        <h1 className="text-h2 text-on-surface font-bold">این صفحه پیدا نشد</h1>
        <p className="text-body-2 text-muted max-w-sm mx-auto leading-relaxed">
          ممکن است آدرس تغییر کرده باشد یا صفحه مورد نظر دیگر در دسترس نباشد
        </p>
      </div>

      <div className="flex items-center gap-3 mt-4 flex-wrap justify-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-surface border border-divider/60 px-6 py-3 text-body-2 text-on-surface font-medium hover:bg-surface-hover hover:border-divider transition-all touch-target shadow-sm"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M9 22V12h6v10" />
          </svg>
          بازگشت به خانه
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-700 to-primary-800 px-6 py-3 text-body-2 text-white font-medium hover:from-primary-800 hover:to-primary-900 transition-all touch-target shadow-md shadow-primary/20 active:scale-[0.98]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          رفتن به داشبورد
        </Link>
      </div>

      {/* Footer */}
      <p className="text-caption text-muted/60 mt-10">
        لیگالیر — دستیار هوشمند حقوقی ایران
      </p>
    </div>
  );
}
