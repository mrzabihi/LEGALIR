import { IconShield } from "@/lib/icons";

interface AIDisclaimerProps {
  compact?: boolean;
}

export function AIDisclaimer({ compact = false }: AIDisclaimerProps) {
  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/30 text-caption text-muted">
        <IconShield size={14} className="text-warning shrink-0" />
        <span>خروجی هوش مصنوعی — مشاوره حقوقی رسمی نیست</span>
      </div>
    );
  }

  return (
    <div className="rounded-large bg-warning/5 border border-warning/20 p-6">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-medium bg-warning/15 flex items-center justify-center shrink-0 mt-0.5">
          <IconShield size={18} className="text-warning" />
        </div>
        <div>
          <h3 className="text-h3 text-on-surface mb-2">نکته مهم درباره هوش مصنوعی</h3>
          <ul className="space-y-2 text-body-2 text-muted">
            <li>
              <strong className="text-on-surface">اطلاعات AI:</strong> پاسخ‌های تولیدشده توسط هوش مصنوعی برای اطلاع‌رسانی اولیه هستند و نباید به عنوان نظر حقوقی قطعی تلقی شوند.
            </li>
            <li>
              <strong className="text-on-surface">کمک حقوقی:</strong> LEGALIR یک ابزار کمک‌آموزشی است و جایگزین وکیل، مشاور حقوقی یا مراجع رسمی قضایی نیست.
            </li>
            <li>
              <strong className="text-on-surface">منابع معتبر:</strong> تمام پاسخ‌ها با ارجاع به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه هستند و وضعیت اعتبار هر منبع مشخص شده است.
            </li>
            <li>
              <strong className="text-on-surface">اتصال به وکیل:</strong> در آینده، امکان ارتباط با وکلای تأییدشده برای مشاوره تخصصی فراهم خواهد شد.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
