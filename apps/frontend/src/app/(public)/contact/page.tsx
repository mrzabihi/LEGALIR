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
      {/* Page Header - Gradient */}
      <section className="bg-gradient-to-b from-primary-800 to-primary-900 text-white py-16 tablet:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-h1 text-white mb-4">تماس با LEGALIR</h1>
          <p className="text-body-1 text-primary-100/80 max-w-xl mx-auto leading-relaxed">
            ما آماده پاسخگویی به سوالات و دریافت نظرات شما هستیم
          </p>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid tablet:grid-cols-3 gap-6 mb-12">
            {contactMethods.map((method) => (
              <Link
                key={method.title}
                href={method.href}
                className="rounded-xl bg-surface p-6 shadow-sm hover:shadow-elevation-4 transition-all border border-neutral-200 text-center group"
              >
                <div className="h-14 w-14 rounded-xl bg-primary-50 flex items-center justify-center text-primary-700 mx-auto mb-4 group-hover:bg-primary-100 transition-colors">
                  <method.icon size={26} />
                </div>
                <h3 className="text-h3 text-primary-800 mb-2">{method.title}</h3>
                <p className="text-body-2 text-neutral-500 mb-5 leading-relaxed">
                  {method.description}
                </p>
                <span className="inline-block rounded-medium bg-primary-700 text-white px-5 py-2.5 text-button hover:bg-primary-800 transition-colors">
                  {method.action}
                </span>
              </Link>
            ))}
          </div>

          {/* In-App Support Card */}
          <div className="rounded-xl bg-surface border border-neutral-200 shadow-sm p-8 text-center">
            <div className="h-14 w-14 rounded-xl bg-primary-50 flex items-center justify-center text-primary-700 mx-auto mb-4">
              <IconChat size={26} />
            </div>
            <h2 className="text-h2 text-primary-800 mb-3">پشتیبانی درون برنامه</h2>
            <p className="text-body-1 text-neutral-500 mb-8 max-w-lg mx-auto leading-relaxed">
              پس از ورود به LEGALIR، می‌توانید از طریق گفتگوی درون‌برنامه‌ای با تیم
              پشتیبانی در ارتباط باشید. همچنین تمامی گفتگوهای حقوقی شما با AI در پلتفرم
              ذخیره می‌شوند و در صورت نیاز به پشتیبانی، سوابق شما در دسترس خواهد بود.
            </p>
            <Link
              href="/auth/mobile"
              className="inline-block rounded-medium bg-primary-700 text-white px-10 py-3.5 text-button hover:bg-primary-800 transition-colors touch-target shadow-elevation-1 hover:shadow-elevation-4"
            >
              ورود به LEGALIR
            </Link>
          </div>

          {/* Platform Info */}
          <div className="mt-6 p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-center">
            <p className="text-caption text-neutral-400">
              LEGALIR نسخه ۰.۱.۰ — در مرحله توسعه. ساعات پاسخگویی: شنبه تا چهارشنبه ۹ صبح تا ۶ عصر
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
