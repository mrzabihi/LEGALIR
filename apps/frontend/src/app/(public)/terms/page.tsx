import type { Metadata } from "next";
import { AIDisclaimer } from "@/components/public/AIDisclaimer";

export const metadata: Metadata = {
  title: "قوانین استفاده | LEGALIR",
  description:
    "شرایط و ضوابط استفاده از خدمات پلتفرم هوشمند حقوقی LEGALIR — حقوق و تعهدات کاربران و پلتفرم.",
  alternates: { canonical: "/terms" },
};

const sections = [
  {
    id: "acceptance",
    title: "پذیرش شرایط",
    body: "با ثبت‌نام و استفاده از خدمات LEGALIR، شما این شرایط و ضوابط را می‌پذیرید. در صورت عدم موافقت با هر یک از بندهای این سند، لطفاً از خدمات پلتفرم استفاده نکنید. LEGALIR ممکن است این شرایط را در آینده به‌روزرسانی کند و ادامه استفاده از خدمات به معنای پذیرش نسخه به‌روزشده است.",
  },
  {
    id: "service",
    title: "ماهیت خدمات",
    body: "LEGALIR یک ابزار اطلاعاتی و کمک‌آموزشی مبتنی بر هوش مصنوعی است که تحلیل اولیه حقوقی، بررسی اسناد و تولید پیش‌نویس قرارداد ارائه می‌دهد. این خدمات جایگزین وکیل، مشاور حقوقی یا مراجع رسمی قضایی نیست و خروجی‌های آن باید به‌عنوان نقطه شروع بررسی و نه تصمیم نهایی تلقی شود.",
  },
  {
    id: "account",
    title: "حساب کاربری",
    body: "شماره موبایلی که با آن ثبت‌نام می‌کنید، هویت اصلی حساب شماست و قابل تغییر نیست. مسئولیت حفظ امنیت حساب و فعالیت‌هایی که از طریق آن انجام می‌شود بر عهده شماست. در صورت مشاهده هرگونه دسترسی غیرمجاز، باید بلافاصله از طریق بخش «نشست‌ها و امنیت» نسبت به خروج از سایر دستگاه‌ها اقدام کنید.",
  },
  {
    id: "acceptable-use",
    title: "استفاده مجاز",
    body: "استفاده از خدمات برای فعالیت‌های غیرقانونی، تولید محتوای گمراه‌کننده، نقض حقوق مالکیت فکری دیگران یا تلاش برای دسترسی غیرمجاز به سیستم‌ها ممنوع است. LEGALIR حق تعلیق یا حذف حساب کاربرانی که این شرایط را نقض کنند را برای خود محفوظ می‌دارد.",
  },
  {
    id: "intellectual-property",
    title: "مالکیت فکری",
    body: "تمام حقوق مادی و معنوی پلتفرم، شامل نرم‌افزار، طراحی، پایگاه داده قوانین و محتوای تولیدشده توسط LEGALIR، متعلق به این پلتفرم است. محتوایی که شما بارگذاری می‌کنید (اسناد و اطلاعات) متعلق به خود شما باقی می‌ماند و LEGALIR تنها برای ارائه خدمات از آن استفاده می‌کند.",
  },
  {
    id: "liability",
    title: "محدودیت مسئولیت",
    body: "LEGALIR هیچ‌گونه مسئولیتی در قبال تصمیم‌های حقوقی که بر اساس خروجی‌های هوش مصنوعی گرفته می‌شود ندارد. استفاده از اطلاعات ارائه‌شده در تصمیم‌گیری‌های حقوقی، بدون مشورت با وکیل متخصص، به عهده خود کاربر است.",
  },
  {
    id: "changes",
    title: "تغییرات و خاتمه",
    body: "LEGALIR می‌تواند در هر زمان خدمات خود را تغییر دهد یا متوقف کند. کاربر نیز می‌تواند در هر زمان از طریق بخش «حذف حساب کاربری» در تنظیمات، حساب خود را به‌صورت دائمی حذف کند.",
  },
];

export default function TermsPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-primary-800 to-primary-900 text-white py-16 tablet:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-h1 text-white mb-4">قوانین استفاده</h1>
          <p className="text-body-1 text-primary-100/80 max-w-xl mx-auto leading-relaxed">
            شرایط و ضوابط استفاده از خدمات پلتفرم هوشمند حقوقی LEGALIR
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
