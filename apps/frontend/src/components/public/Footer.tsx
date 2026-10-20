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
      { href: "/about", label: "درباره لیگالیر" },
      { href: "/contact", label: "تماس با ما" },
    ],
  },
  legal: {
    title: "حقوقی",
    items: [
      { href: "/terms", label: "قوانین استفاده" },
      { href: "/privacy-policy", label: "حریم خصوصی" },
      { href: "/contact", label: "پشتیبانی" },
    ],
  },
};

export function Footer() {
  return (
    <footer className="mt-auto" role="contentinfo" dir="rtl">
      {/* Gold gradient top border */}
      <div className="h-1 bg-gradient-to-r from-primary-700 via-secondary-600 to-primary-700" />

      {/* Main footer content. `safe-area-bottom` keeps the copyright line
          clear of the iPhone home indicator in standalone (installed) mode. */}
      <div className="bg-neutral-100 safe-area-bottom">
        <div className="mx-auto max-w-6xl px-4 py-14">
          {/* Top Section: About + Links in responsive grid */}
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5 mb-12">
            {/* About Column — spans 2 on large screens */}
            <div className="sm:col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <img
                  src="/legalir-logo.png"
                  alt="LEGALIR"
                  className="h-12 w-auto"
                />
                <span className="text-h3 font-extrabold text-primary translate-y-[1px]">
                  لیگالیر
                </span>
              </div>
              <p className="text-body-2 text-neutral-600 leading-relaxed max-w-sm text-justify">
                لیگالیر با هدف دسترسی‌پذیر کردن اطلاعات و خدمات حقوقی برای همه افراد
                جامعه ایجاد شده است. ما باور داریم که هر فرد، فارغ از میزان آشنایی با
                قوانین، باید بتواند مسائل حقوقی روزمره خود را درک کند و برای حل آن‌ها
                اقدام آگاهانه انجام دهد.
              </p>
            </div>

            {/* Link Columns */}
            {Object.values(footerLinks).map((section) => (
              <div key={section.title} className="sm:col-span-1">
                <h3 className="text-button font-semibold text-on-surface mb-4 pb-2 border-b border-neutral-200">
                  {section.title}
                </h3>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      {/* `min-h-11` keeps every footer link at the 44px touch
                          minimum on phones, matching the landing footer. */}
                      <Link
                        href={item.href}
                        className="inline-flex min-h-11 items-center text-body-2 text-neutral-600 hover:text-primary transition-colors duration-200"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Newsletter slot — the old block was an email input and a «ثبت»
              button with no submit handler and no backend behind it. Rather
              than ship a dead control on every public page, this slot offers
              the two destinations it was standing in for: the legal blog and
              the contact channel. Same change as the landing footer
              (`landing/landing-footer.tsx`), kept consistent across both. */}
          <div className="border-t border-neutral-200 pt-10 mb-10">
            <div className="bg-white rounded-medium p-6 shadow-sm border border-neutral-200 max-w-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <h3 className="text-button font-semibold text-on-surface mb-1">
                    مطالب و اخبار حقوقی
                  </h3>
                  <p className="text-body-2 text-neutral-600">
                    تازه‌ترین مقالات و راهنماهای حقوقی را در وبلاگ لیگالیر بخوانید،
                    یا برای هر پرسش با تیم ما در تماس باشید.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/blog"
                    className="inline-flex min-h-11 items-center justify-center rounded-medium border border-neutral-300 px-4 text-button font-medium text-on-surface transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    مشاهده وبلاگ
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex min-h-11 items-center justify-center rounded-medium bg-primary px-4 text-button font-medium text-on-primary transition-colors hover:bg-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    تماس با ما
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-neutral-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-start">
            <p className="text-caption text-neutral-600">
              &#169; {new Date().getFullYear()} لیگالیر. تمام حقوق محفوظ است.
            </p>
            <p className="text-caption text-neutral-500 max-w-md leading-relaxed">
              خدمات تخصصی حقوقی با پشتیبانی هوش مصنوعی و منابع حقوقی معتبر
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
