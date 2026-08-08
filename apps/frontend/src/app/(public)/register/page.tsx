import type { Metadata } from "next";
import { LoginForm } from "../login/LoginForm";

export const metadata: Metadata = {
  title: "ثبت‌نام در LEGALIR",
  description: "ثبت‌نام در پلتفرم هوشمند حقوقی LEGALIR",
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return (
    <>
      {/* Page Header - Gradient */}
      <section className="bg-gradient-to-b from-primary-800 to-primary-900 text-white py-16 tablet:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-h1 text-white mb-4">ثبت‌نام در LEGALIR</h1>
          <p className="text-body-1 text-primary-100/80 max-w-xl mx-auto leading-relaxed">
            به جامعه کاربران LEGALIR بپیوندید. ثبت‌نام رایگان و سریع — فقط با شماره موبایل
          </p>
        </div>
      </section>

      {/* Register Form Section */}
      <section className="bg-neutral-50 py-16">
        <div className="mx-auto max-w-md px-4">
          <div className="rounded-xl bg-surface border border-neutral-200 shadow-sm p-8">
            <div className="text-center mb-6">
              <h2 className="text-h3 text-primary-800 mb-2">ایجاد حساب کاربری</h2>
              <p className="text-body-2 text-neutral-500 leading-relaxed">
                شماره موبایل خود را وارد کنید تا کد تأیید برای شما ارسال شود
              </p>
            </div>
            <LoginForm />
            <p className="text-caption text-neutral-400 text-center mt-6 leading-relaxed">
              با ثبت‌نام، شرایط استفاده و حریم خصوصی LEGALIR را می‌پذیرید.
              اطلاعات شما محرمانه بوده و برای آموزش مدل‌های عمومی استفاده نمی‌شود.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white border-t border-neutral-200 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-h2 text-primary-800 text-center mb-8">
            مزایای ثبت‌نام در LEGALIR
          </h2>
          <div className="grid tablet:grid-cols-3 gap-6">
            {[
              {
                title: "دسترسی رایگان اولیه",
                desc: "بدون هیچ هزینه‌ای شروع کنید و خدمات پایه را تجربه کنید",
              },
              {
                title: "تاریخچه شخصی",
                desc: "تمام گفتگوها و تحلیل‌های شما در تاریخچه منظم ذخیره می‌شود",
              },
              {
                title: "پشتیبانی اختصاصی",
                desc: "از پشتیبانی درون‌برنامه‌ای برای راهنمایی و رفع مشکلات استفاده کنید",
              },
            ].map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-xl bg-surface border border-neutral-200 shadow-sm p-6 text-center"
              >
                <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-700 mx-auto mb-3 text-button font-bold">
                  &#10003;
                </div>
                <h3 className="text-h3 text-primary-800 mb-2">{benefit.title}</h3>
                <p className="text-body-2 text-neutral-500 leading-relaxed">
                  {benefit.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <p className="text-body-2 text-neutral-500 mb-4">
              قبلاً ثبت‌نام کرده‌اید؟
            </p>
            <a
              href="/login"
              className="inline-block rounded-medium border border-neutral-300 text-neutral-700 px-8 py-3 text-button hover:bg-neutral-50 hover:border-neutral-400 transition-colors touch-target"
            >
              ورود به حساب کاربری
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
