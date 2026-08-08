import type { Metadata } from "next";
import { AIDisclaimer } from "@/components/public/AIDisclaimer";
import { IconSearch, IconBalance, IconShield, IconCheckCircle } from "@/lib/icons";

export const metadata: Metadata = {
  title: "درباره LEGALIR | پلتفرم هوشمند حقوقی ایران",
  description:
    "LEGALIR — پلتفرم هوشمند قوانین و قراردادهای حقوقی ایران. ماموریت ما دسترسی‌پذیر کردن اطلاعات حقوقی برای همه افراد جامعه با استفاده از هوش مصنوعی است.",
  alternates: { canonical: "/about" },
};

const sections = [
  {
    id: "mission",
    icon: IconBalance,
    title: "ماموریت ما",
    content:
      "LEGALIR با هدف دسترسی‌پذیر کردن اطلاعات و خدمات حقوقی برای همه افراد جامعه ایجاد شده است. ما باور داریم که هر فرد، فارغ از میزان آشنایی با قوانین، باید بتواند مسائل حقوقی روزمره خود را درک کند و برای حل آن‌ها اقدام آگاهانه انجام دهد.",
  },
  {
    id: "ai",
    icon: IconShield,
    title: "هوش مصنوعی در خدمت حقوق",
    content:
      "LEGALIR از هوش مصنوعی برای ارائه تحلیل اولیه حقوقی، تولید پیش‌نویس قرارداد و بررسی اسناد استفاده می‌کند. هوش مصنوعی ما با دسترسی به پایگاه داده قوانین ایران، تحلیل ساختاریافته ارائه می‌دهد. نکته مهم: LEGALIR یک ابزار اطلاعاتی و کمکی است و جایگزین وکیل متخصص نیست. تمام پاسخ‌های AI با ذکر منبع و سطح ریسک ارائه می‌شوند و در موضوعات حساس، ارجاع به وکیل توصیه می‌گردد.",
  },
  {
    id: "transparency",
    icon: IconSearch,
    title: "تعهد به شفافیت",
    items: [
      {
        title: "منابع قابل ردیابی",
        desc: "هر پاسخ حقوقی با ارجاع دقیق به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه است.",
      },
      {
        title: "وضعیت اعتبار",
        desc: "وضعیت هر منبع (معتبر، اصلاح‌شده یا منسوخ) به صورت شفاف نمایش داده می‌شود.",
      },
      {
        title: "حریم خصوصی",
        desc: "اطلاعات شخصی و گفتگوهای شما محرمانه است و برای آموزش مدل‌های عمومی استفاده نمی‌شود.",
      },
    ],
  },
  {
    id: "future",
    icon: IconCheckCircle,
    title: "نقشه راه آینده",
    items: [
      {
        title: "اتصال به وکلای متخصص",
        desc: "در فازهای بعدی، امکان ارتباط مستقیم با وکلای تأییدشده برای مشاوره تخصصی فراهم خواهد شد.",
      },
      {
        title: "دسته‌بندی هوشمند پرونده‌ها",
        desc: "سیستم مدیریت پرونده با دسته‌بندی خودکار و پیگیری وضعیت حقوقی.",
      },
      {
        title: "هشدارهای حقوقی",
        desc: "اعلان‌های هوشمند برای موعدهای قراردادی، تغییرات قوانین مرتبط و تاریخ‌های مهم.",
      },
    ],
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Page Header - Gradient */}
      <section className="bg-gradient-to-b from-primary-800 to-primary-900 text-white py-16 tablet:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-h1 text-white mb-4">درباره LEGALIR</h1>
          <p className="text-body-1 text-primary-100/80 max-w-xl mx-auto leading-relaxed">
            پلتفرم هوشمند قوانین و قراردادهای حقوقی ایران — دسترسی به دانش حقوقی برای همه
          </p>
        </div>
      </section>

      {/* Mission & AI Sections */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="space-y-6">
            {sections.slice(0, 2).map((section) => (
              <div
                key={section.id}
                id={section.id}
                className="rounded-xl bg-surface p-8 shadow-sm border border-neutral-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-11 w-11 rounded-xl bg-primary-50 flex items-center justify-center text-primary-700">
                    {"icon" in section && section.icon ? <section.icon size={22} /> : null}
                  </div>
                  <h2 className="text-h2 text-primary-800">{section.title}</h2>
                </div>

                {"content" in section && section.content && (
                  <p className="text-body-1 text-neutral-600 leading-relaxed">
                    {section.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Transparency & Roadmap Sections */}
      <section className="bg-neutral-50 py-16 border-y border-neutral-200">
        <div className="mx-auto max-w-4xl px-4">
          <div className="space-y-6">
            {sections.slice(2).map((section) => (
              <div
                key={section.id}
                id={section.id}
                className="rounded-xl bg-surface p-8 shadow-sm border border-neutral-200"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-11 w-11 rounded-xl bg-primary-50 flex items-center justify-center text-primary-700">
                    {"icon" in section && section.icon ? <section.icon size={22} /> : null}
                  </div>
                  <h2 className="text-h2 text-primary-800">{section.title}</h2>
                </div>

                {"content" in section && section.content && (
                  <p className="text-body-1 text-neutral-600 leading-relaxed">
                    {section.content}
                  </p>
                )}

                {"items" in section && section.items && (
                  <div className="space-y-5">
                    {section.items.map((item, idx) => (
                      <div
                        key={item.title}
                        className="flex gap-4"
                      >
                        <div className="h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-700 text-caption font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div>
                          <h3 className="text-button text-primary-800 mb-1">{item.title}</h3>
                          <p className="text-body-2 text-neutral-500 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer & Privacy */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 space-y-6">
          {/* Disclaimer */}
          <div
            id="disclaimer"
            className="rounded-xl bg-surface p-8 shadow-sm border border-neutral-200"
          >
            <h2 className="text-h2 text-primary-800 mb-4">سلب مسئولیت حقوقی</h2>
            <div className="p-5 rounded-xl bg-warning-container/60 border border-warning/25">
              <p className="text-body-2 text-neutral-700 leading-relaxed">
                LEGALIR یک ابزار کمک‌آموزشی و اطلاع‌رسانی حقوقی است. این پلتفرم جایگزین
                وکیل، مشاور حقوقی یا مراجع رسمی قضایی نیست. استفاده از اطلاعات ارائه‌شده
                در تصمیم‌گیری‌های حقوقی، بدون مشورت با وکیل متخصص، به عهده خود کاربر است.
                LEGALIR هیچ‌گونه مسئولیتی در قبال استفاده از اطلاعات تولیدشده توسط هوش
                مصنوعی ندارد.
              </p>
            </div>
          </div>

          {/* Privacy */}
          <div
            id="privacy"
            className="rounded-xl bg-surface p-8 shadow-sm border border-neutral-200"
          >
            <h2 className="text-h2 text-primary-800 mb-4">حریم خصوصی</h2>
            <p className="text-body-1 text-neutral-600 leading-relaxed">
              LEGALIR به حریم خصوصی کاربران خود متعهد است. اطلاعات شخصی، گفتگوها، اسناد
              بارگذاری‌شده و قراردادهای تولیدشده محرمانه هستند و برای آموزش مدل‌های عمومی
              استفاده نمی‌شوند. تمام داده‌ها در سرورهای امن با رعایت استانداردهای حفاظت
              از داده نگهداری می‌شوند.
            </p>
          </div>

          {/* AI Disclaimer */}
          <div className="mt-6">
            <AIDisclaimer />
          </div>
        </div>
      </section>
    </>
  );
}
