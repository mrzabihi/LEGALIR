import Link from "next/link";

const footerLinks = {
  services: {
    title: "خدمات",
    items: [
      { href: "/auth/mobile?intent=chat", label: "مشاوره حقوقی با هوش مصنوعی" },
      { href: "/auth/mobile?intent=document", label: "تحلیل و بررسی اسناد" },
      { href: "/auth/mobile?intent=contract", label: "تولید پیش‌نویس قرارداد" },
      { href: "/pricing", label: "تعرفه‌ها و اشتراک" },
    ],
  },
  platform: {
    title: "پلتفرم",
    items: [
      { href: "/features", label: "قابلیت‌ها" },
      { href: "/about", label: "درباره LEGALIR" },
      { href: "/contact", label: "تماس با ما" },
    ],
  },
  legal: {
    title: "حقوقی",
    items: [
      { href: "/about#disclaimer", label: "سلب مسئولیت" },
      { href: "/about#privacy", label: "حریم خصوصی" },
      { href: "/contact", label: "پشتیبانی" },
    ],
  },
};

export function Footer() {
  return (
    <footer className="mt-auto" role="contentinfo" dir="rtl">
      {/* Gold gradient top border */}
      <div className="h-1 bg-gradient-to-r from-primary-700 via-secondary-600 to-primary-700" />

      {/* Main footer content */}
      <div className="bg-neutral-100">
        <div className="mx-auto max-w-6xl px-4 py-14">
          {/* Top Section: About + Links in responsive grid */}
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5 mb-12">
            {/* About Column — spans 2 on large screens */}
            <div className="sm:col-span-2 lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/legalir-logo.png"
                  alt="LEGALIR"
                  className="h-14 w-auto"
                />
                <span className="text-h3 font-bold text-primary">
                  LEGALIR
                </span>
              </div>
              <p className="text-body-2 text-neutral-600 leading-relaxed max-w-sm">
                پلتفرم هوشمند قوانین و قراردادهای حقوقی ایران. با استفاده از هوش
                مصنوعی، تحلیل اولیه حقوقی، بررسی اسناد و تولید پیش‌نویس قرارداد
                ارائه می‌دهد.
              </p>
              <p className="text-caption text-neutral-500 mt-3">
                نسخه ۰.۱.۰ — مرحله توسعه
              </p>
            </div>

            {/* Link Columns */}
            {Object.values(footerLinks).map((section) => (
              <div key={section.title} className="sm:col-span-1">
                <h3 className="text-button font-semibold text-on-surface mb-4 pb-2 border-b border-neutral-200">
                  {section.title}
                </h3>
                <ul className="space-y-2.5">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="text-body-2 text-neutral-600 hover:text-primary transition-colors duration-200"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Newsletter Signup Placeholder */}
          <div className="border-t border-neutral-200 pt-10 mb-10">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200 max-w-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <h3 className="text-button font-semibold text-on-surface mb-1">
                    خبرنامه LEGALIR
                  </h3>
                  <p className="text-body-2 text-neutral-600">
                    برای اطلاع از به‌روزرسانی‌ها، امکانات جدید و آخرین اخبار
                    حقوقی ایمیل خود را وارد کنید.
                  </p>
                </div>
                <div className="flex gap-2 flex-1">
                  <input
                    type="email"
                    placeholder="ایمیل خود را وارد کنید"
                    className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-200 text-body-2 text-right placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    className="px-5 py-2.5 rounded-lg bg-primary text-white text-button font-medium hover:bg-primary/90 active:bg-primary/80 transition-colors duration-200 whitespace-nowrap"
                  >
                    ثبت
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-neutral-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-start">
            <p className="text-caption text-neutral-600">
              &#169; {new Date().getFullYear()} LEGALIR. تمام حقوق محفوظ است.
            </p>
            <p className="text-caption text-neutral-500 max-w-md leading-relaxed">
              این پلتفرم در مرحله توسعه قرار دارد. پاسخ‌های هوش مصنوعی جایگزین
              مشاوره وکیل نیستند.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
