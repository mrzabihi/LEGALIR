import type { Metadata } from "next";
import Link from "next/link";
import { IconPhone, IconChat, IconShield } from "@/lib/icons";

export const metadata: Metadata = {
  title: "تماس با LEGALIR | پشتیبانی و ارتباط",
  description:
    "تماس با تیم LEGALIR — راه‌های ارتباطی، پشتیبانی و اطلاعات تماس پلتفرم هوشمند حقوقی ایران",
  alternates: { canonical: "/contact" },
};

const contactMethods = [
  {
    icon: IconChat,
    title: "گفتگو با پشتیبانی",
    description: "از طریق پلتفرم LEGALIR با تیم پشتیبانی در ارتباط باشید",
    action: "ورود به پلتفرم",
    href: "/auth/mobile?intent=support",
  },
  {
    icon: IconShield,
    title: "سوالات متداول",
    description: "پاسخ سوالات رایج درباره خدمات، اشتراک و نحوه استفاده از LEGALIR",
    action: "مشاهده FAQ",
    href: "/features",
  },
  {
    icon: IconPhone,
    title: "تماس با ما",
    description: "برای ارتباط با تیم LEGALIR از طریق ایمیل با ما در تماس باشید",
    action: "info@legalir.ir",
    href: "mailto:info@legalir.ir",
  },
];

export default function ContactPage() {
  return (
    <>
      <div className="mx-auto max-w-4xl px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-h1 text-on-surface mb-3">تماس با LEGALIR</h1>
          <p className="text-body-1 text-muted max-w-xl mx-auto">
            ما آماده پاسخگویی به سوالات و دریافت نظرات شما هستیم
          </p>
        </div>

        {/* Contact Methods */}
        <div className="grid tablet:grid-cols-3 gap-6 mb-12">
          {contactMethods.map((method) => (
            <Link
              key={method.title}
              href={method.href}
              className="rounded-large bg-surface p-6 shadow-elevation-1 hover:shadow-elevation-4 transition-all border border-divider text-center"
            >
              <div className="h-12 w-12 rounded-large bg-primary/10 flex items-center justify-center text-primary mx-auto mb-3">
                <method.icon size={24} />
              </div>
              <h3 className="text-h3 text-on-surface mb-2">{method.title}</h3>
              <p className="text-body-2 text-muted mb-4">{method.description}</p>
              <span className="inline-block rounded-medium bg-primary text-white px-4 py-2 text-button hover:bg-primary-variant transition-colors">
                {method.action}
              </span>
            </Link>
          ))}
        </div>

        {/* Contact Form Note */}
        <div className="rounded-large bg-surface p-8 shadow-elevation-1 border border-divider text-center">
          <h2 className="text-h2 text-on-surface mb-3">پشتیبانی درون برنامه</h2>
          <p className="text-body-1 text-muted mb-6 max-w-lg mx-auto">
            پس از ورود به LEGALIR، می‌توانید از طریق گفتگوی درون‌برنامه‌ای با تیم پشتیبانی
            در ارتباط باشید. همچنین تمامی گفتگوهای حقوقی شما با AI در پلتفرم ذخیره می‌شوند
            و در صورت نیاز به پشتیبانی، سوابق شما در دسترس خواهد بود.
          </p>
          <Link
            href="/auth/mobile"
            className="inline-block rounded-medium bg-primary text-white px-8 py-3.5 text-button hover:bg-primary-variant transition-colors touch-target"
          >
            ورود به LEGALIR
          </Link>
        </div>

        {/* Platform info */}
        <div className="mt-6 p-4 rounded-medium bg-surface/70 text-center">
          <p className="text-caption text-muted">
            LEGALIR نسخه ۰.۱.۰ — در مرحله توسعه. ساعات پاسخگویی: شنبه تا چهارشنبه ۹ صبح تا ۶ عصر
          </p>
        </div>
      </div>
    </>
  );
}
