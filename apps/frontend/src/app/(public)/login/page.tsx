import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "ورود به LEGALIR",
  description: "ورود به پلتفرم هوشمند حقوقی LEGALIR",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <>
      {/* Page Header - Gradient */}
      <section className="bg-gradient-to-b from-primary-800 to-primary-900 text-white py-16 tablet:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-h1 text-white mb-4">ورود به LEGALIR</h1>
          <p className="text-body-1 text-primary-100/80 max-w-xl mx-auto leading-relaxed">
            به پلتفرم هوشمند حقوقی ایران خوش آمدید. برای ادامه شماره موبایل خود را وارد کنید
          </p>
        </div>
      </section>

      {/* Login Form Section */}
      <section className="bg-neutral-50 py-16">
        <div className="mx-auto max-w-md px-4">
          <LoginForm />
        </div>
      </section>

      {/* Help Section */}
      <section className="bg-white border-t border-neutral-200 py-12">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="text-body-2 text-neutral-500 mb-4">
            حساب کاربری ندارید؟
          </p>
          <a
            href="/register"
            className="inline-block rounded-medium border border-neutral-300 text-neutral-700 px-8 py-3 text-button hover:bg-neutral-50 hover:border-neutral-400 transition-colors touch-target"
          >
            ثبت‌نام در LEGALIR
          </a>
          <p className="text-caption text-neutral-400 mt-6">
            با ورود یا ثبت‌نام، شرایط استفاده و حریم خصوصی LEGALIR را می‌پذیرید
          </p>
        </div>
      </section>
    </>
  );
}
