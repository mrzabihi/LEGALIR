"use client";

// ============================================================
// LEGALIR — Support Page
// FAQ, contact info, and embedded AI assistant
// ============================================================

import { useState } from "react";
import { AiAssistantPanel } from "@/components/assistant";

// ============================================================
// FAQ Data
// ============================================================

const FAQ_ITEMS = [
  {
    id: "q1",
    question: "LEGALIR چگونه کار می‌کند؟",
    answer:
      "LEGALIR یک دستیار هوشمند حقوقی مبتنی بر هوش مصنوعی است که با استفاده از پایگاه دانش قوانین ایران، رویه قضایی و دکترین حقوقی، به سوالات شما پاسخ می‌دهد، اسناد حقوقی تنظیم می‌کند، و تحلیل حقوقی ارائه می‌دهد.",
  },
  {
    id: "q2",
    question: "آیا پاسخ‌های LEGALIR قابل استناد قانونی هستند؟",
    answer:
      "خیر. LEGALIR یک ابزار کمکی برای آگاهی‌بخشی حقوقی است و پاسخ‌های آن جایگزین مشاوره تخصصی با وکیل نمی‌باشد. برای تصمیم‌گیری‌های حقوقی مهم، همواره با یک وکیل متخصص مشورت کنید.",
  },
  {
    id: "q3",
    question: "آیا اطلاعات من محرمانه می‌ماند؟",
    answer:
      "بله. LEGALIR از رمزنگاری سرتاسری برای ارتباطات استفاده می‌کند. تمامی اطلاعات شما مطابق با قوانین حریم خصوصی ایران محافظت می‌شود و هرگز با اشخاص ثالث به اشتراک گذاشته نمی‌شود.",
  },
  {
    id: "q4",
    question: "چگونه می‌توانم اشتراک خود را ارتقا دهم؟",
    answer:
      "از طریق صفحه «اشتراک» می‌توانید پلن‌های مختلف را مشاهده و با انتخاب پلن مورد نظر، پرداخت را انجام دهید. پس از پرداخت موفق، اشتراک شما بلافاصله فعال می‌شود.",
  },
  {
    id: "q5",
    question: "مدت اعتبار اشتراک‌ها چقدر است؟",
    answer:
      "پلن‌های LEGALIR به صورت ماهانه (۳۰ روز) ارائه می‌شوند. در پایان دوره، در صورت فعال بودن تمدید خودکار، اشتراک شما به صورت خودکار تمدید خواهد شد.",
  },
  {
    id: "q6",
    question: "چگونه می‌توانم حساب خود را حذف کنم؟",
    answer:
      "از طریق صفحه «تنظیمات» و بخش «حذف حساب» می‌توانید درخواست حذف حساب خود را ثبت کنید. پس از تأیید نهایی، کلیه اطلاعات شما طبق قوانین حفاظت از داده‌ها حذف خواهد شد.",
  },
];

// ============================================================
// Component
// ============================================================

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<string | null>("q1");

  return (
    <div className="p-4 tablet:p-6 max-w-5xl mx-auto" dir="rtl">
      <h1 className="text-h2 text-on-surface mb-6 font-bold">پشتیبانی و راهنما</h1>

      <div className="grid desktop:grid-cols-5 gap-6">
        {/* Left column: FAQ + Contact */}
        <div className="desktop:col-span-3 space-y-6">
          {/* FAQ Section */}
          <section className="rounded-2xl bg-surface p-6 shadow-sm border border-divider/60">
            <h2 className="text-h3 text-on-surface mb-4 font-bold">سوالات متداول</h2>
            <div className="space-y-2">
              {FAQ_ITEMS.map((faq) => {
                const isOpen = openFaq === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="rounded-xl border border-divider/40 overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : faq.id)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-right hover:bg-surface-hover transition-colors"
                      aria-expanded={isOpen}
                    >
                      <span className="text-body-2 text-on-surface font-medium">
                        {faq.question}
                      </span>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`shrink-0 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-body-2 text-muted leading-relaxed">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Contact Info */}
          <section className="rounded-2xl bg-surface p-6 shadow-sm border border-divider/60">
            <h2 className="text-h3 text-on-surface mb-4 font-bold">تماس با ما</h2>
            <div className="grid tablet:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-container/50 border border-divider/30">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-body-2 text-on-surface font-medium">ایمیل</p>
                  <p className="text-caption text-muted mt-0.5">support@legalir.com</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-container/50 border border-divider/30">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <div>
                  <p className="text-body-2 text-on-surface font-medium">تلفن</p>
                  <p className="text-caption text-muted mt-0.5">۰۲۱-۹۱۰۰۰۰۰۰</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-container/50 border border-divider/30">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <circle cx="12" cy="10" r="3" />
                    <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-body-2 text-on-surface font-medium">آدرس</p>
                  <p className="text-caption text-muted mt-0.5">تهران، خیابان ولیعصر، برج فناوری، طبقه ۱۲</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-container/50 border border-divider/30">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-body-2 text-on-surface font-medium">ساعت پاسخگویی</p>
                  <p className="text-caption text-muted mt-0.5">شنبه تا چهارشنبه، ۹ صبح تا ۱۸ عصر</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right column: AI Assistant */}
        <div className="desktop:col-span-2">
          <div className="rounded-2xl bg-surface shadow-sm border border-divider/60 overflow-hidden min-h-[500px]">
            <AiAssistantPanel pageContext="support" mode="page" />
          </div>
        </div>
      </div>
    </div>
  );
}
