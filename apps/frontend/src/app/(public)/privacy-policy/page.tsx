import type { Metadata } from "next";
import { AIDisclaimer } from "@/components/public/AIDisclaimer";

export const metadata: Metadata = {
  title: "سیاست حریم خصوصی | LEGALIR",
  description:
    "سیاست حریم خصوصی LEGALIR — نحوه جمع‌آوری، استفاده و حفاظت از داده‌های کاربران و کنترل‌های در اختیار شما.",
  alternates: { canonical: "/privacy-policy" },
};

const sections = [
  {
    id: "data-collected",
    title: "داده‌هایی که جمع‌آوری می‌کنیم",
    body: "برای ارائه خدمات، شماره موبایل (به‌عنوان شناسه حساب)، اطلاعات پروفایل که خودتان وارد می‌کنید، گفتگوها، اسناد بارگذاری‌شده و قراردادهای تولیدشده را نگهداری می‌کنیم. همچنین اطلاعات فنی محدودی مانند نوع دستگاه و مرورگر برای مدیریت نشست‌ها ثبت می‌شود.",
  },
  {
    id: "how-used",
    title: "نحوه استفاده از داده‌ها",
    body: "داده‌های شما برای ارائه و بهبود خدمات، شخصی‌سازی پاسخ‌ها، مدیریت سهمیه مصرف و اطلاع‌رسانی‌های انتخابی شما استفاده می‌شود. ما داده‌های شخصی شما را نمی‌فروشیم و در اختیار اشخاص ثالث قرار نمی‌دهیم.",
  },
  {
    id: "ai-training",
    title: "آموزش هوش مصنوعی",
    body: "به‌صورت پیش‌فرض، گفتگوهای شما برای آموزش مدل‌های عمومی استفاده نمی‌شود. کنترل این موضوع به‌صورت شفاف در بخش «حریم خصوصی» تنظیمات در اختیار شماست و می‌توانید در هر زمان آن را تغییر دهید.",
  },
  {
    id: "your-controls",
    title: "کنترل‌های در اختیار شما",
    body: "از طریق بخش تنظیمات می‌توانید اشتراک‌گذاری داده‌های مصرف، اجازه آموزش هوش مصنوعی، ذخیره تاریخچه گفتگو و تأیید خودکار حافظه را مدیریت کنید. همچنین می‌توانید نشست‌های فعال خود را ببینید و از سایر دستگاه‌ها خارج شوید.",
  },
  {
    id: "security",
    title: "امنیت داده‌ها",
    body: "ورود به حساب با رمز یک‌بارمصرف پیامکی انجام می‌شود و هر ورود به‌عنوان یک نشست جداگانه ثبت می‌گردد. شماره موبایل حساب قابل تغییر نیست تا از جابه‌جایی هویت حساب جلوگیری شود. داده‌ها با رعایت استانداردهای حفاظت از داده نگهداری می‌شوند.",
  },
  {
    id: "retention",
    title: "نگهداری و حذف داده‌ها",
    body: "داده‌های شما تا زمانی که حساب فعال است نگهداری می‌شود. با استفاده از گزینه «حذف حساب کاربری» در تنظیمات، تمام داده‌های مرتبط با حساب شما به‌صورت دائمی و غیرقابل بازگشت حذف می‌شود.",
  },
  {
    id: "contact",
    title: "تماس با ما",
    body: "در صورت داشتن هرگونه پرسش درباره این سیاست یا نحوه مدیریت داده‌های خود، می‌توانید از طریق صفحه «تماس با ما» با تیم LEGALIR در ارتباط باشید.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-primary-800 to-primary-900 text-white py-16 tablet:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-h1 text-white mb-4">سیاست حریم خصوصی</h1>
          <p className="text-body-1 text-primary-100/80 max-w-xl mx-auto leading-relaxed">
            نحوه جمع‌آوری، استفاده و حفاظت از داده‌های شما در LEGALIR
          </p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 space-y-6">
          {sections.map((section) => (
            <div
              key={section.id}
              id={section.id}
              className="rounded-xl bg-surface p-8 shadow-sm border border-neutral-200"
            >
              <h2 className="text-h2 text-primary-800 mb-4">{section.title}</h2>
              <p className="text-body-1 text-neutral-600 leading-relaxed">
                {section.body}
              </p>
            </div>
          ))}

          <div className="mt-6">
            <AIDisclaimer />
          </div>
        </div>
      </section>
    </>
  );
}
