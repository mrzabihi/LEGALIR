import Link from "next/link";
import { IconShield } from "@/lib/icons";

export function ForbiddenPage({
  title = "دسترسی محدود",
  message = "شما به این بخش دسترسی ندارید. برای استفاده از این ویژگی نیاز به ارتقای اشتراک دارید.",
  showUpgrade = true,
}: {
  title?: string;
  message?: string;
  showUpgrade?: boolean;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-error/10 p-4 mb-2">
        <IconShield size={48} className="text-error" />
      </div>
      <h1 className="text-h2 text-on-surface">{title}</h1>
      <p className="text-body-2 text-muted max-w-sm">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        <Link
          href="/dashboard"
          className="rounded-medium border border-divider px-6 py-3 text-body-2 text-on-surface hover:bg-surfaceVariant transition-colors touch-target"
        >
          بازگشت به خانه
        </Link>
        {showUpgrade && (
          <Link
            href="/subscription"
            className="rounded-medium bg-primary px-6 py-3 text-white font-button hover:opacity-90 transition-opacity touch-target"
          >
            ارتقای اشتراک
          </Link>
        )}
      </div>
    </div>
  );
}
