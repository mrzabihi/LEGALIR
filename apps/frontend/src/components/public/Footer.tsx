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
    <footer className="border-t border-divider bg-surface/70 mt-auto" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid tablet:grid-cols-3 gap-8 mb-10">
          {/* About Column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-medium bg-primary flex items-center justify-center text-white font-bold text-caption">
                ل
              </div>
              <span className="text-h3 text-primary font-bold">LEGALIR</span>
            </div>
            <p className="text-body-2 text-muted leading-relaxed">
              پلتفرم هوشمند قوانین و قراردادهای حقوقی ایران. با استفاده از هوش مصنوعی،
              تحلیل اولیه حقوقی، بررسی اسناد و تولید پیش‌نویس قرارداد ارائه می‌دهد.
            </p>
            <p className="text-caption text-muted mt-3">
              نسخه ۰.۱.۰ — مرحله توسعه
            </p>
          </div>

          {/* Link Columns */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="text-button text-on-surface mb-3">{section.title}</h3>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-body-2 text-muted hover:text-on-surface transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-divider pt-6 flex flex-col tablet:flex-row items-center justify-between gap-3 text-center tablet:text-start">
          <p className="text-caption text-muted">
            © {new Date().getFullYear()} LEGALIR. تمام حقوق محفوظ است.
          </p>
          <p className="text-caption text-muted max-w-md">
            این پلتفرم در مرحله توسعه قرار دارد. پاسخ‌های هوش مصنوعی جایگزین مشاوره وکیل نیستند.
          </p>
        </div>
      </div>
    </footer>
  );
}
