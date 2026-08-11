import { IconShield } from "@/lib/icons";

interface AIDisclaimerProps {
  compact?: boolean;
}

export function AIDisclaimer({ compact = false }: AIDisclaimerProps) {
  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/15 text-caption text-onSurface">
        <IconShield size={14} className="text-primary shrink-0" />
        <span>خدمات تخصصی حقوقی با پشتیبانی هوش مصنوعی و منابع حقوقی</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface border border-divider/60 p-6 shadow-elevation-1">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-medium bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <IconShield size={18} className="text-primary" />
        </div>
        <div>
          <h3 className="text-h3 text-onSurface mb-2">چگونه LEGALIR به شما کمک می‌کند</h3>
          <ul className="space-y-2 text-body-2 text-muted">
            <li>
              <strong className="text-onSurface">تحلیل ساختاریافته:</strong> LEGALIR با ترکیب هوش مصنوعی، منابع حقوقی و ابزارهای تخصصی، تحلیل و بررسی ساختاریافته مسائل، اسناد و قراردادهای حقوقی را در اختیار شما قرار می‌دهد.
            </li>
            <li>
              <strong className="text-onSurface">ابزار تخصصی:</strong> LEGALIR یک دستیار هوشمند حقوقی است که به شما در تحلیل، بررسی و تنظیم اسناد و قراردادها کمک می‌کند.
            </li>
            <li>
              <strong className="text-onSurface">منابع شفاف:</strong> تمام پاسخ‌ها با ارجاع به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه هستند و وضعیت اعتبار هر منبع مشخص شده است.
            </li>
            <li>
              <strong className="text-onSurface">مسیر وکیل:</strong> در موارد نیاز به تصمیم‌گیری حقوقی، LEGALIR مسیر ارتباط با وکلای متخصص را فراهم می‌کند.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
