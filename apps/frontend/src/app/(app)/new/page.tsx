import Link from "next/link";

const services = [
  {
    href: "/chat",
    title: "گفت‌وگوی حقوقی",
    description: "سوال خود را مطرح کنید و تحلیل حقوقی با استناد به منابع دریافت کنید",
    icon: "💬",
  },
  {
    href: "/documents",
    title: "تحلیل سند حقوقی",
    description: "قرارداد یا سند خود را بارگذاری و گزارش ریسک دریافت کنید",
    icon: "📄",
  },
  {
    href: "/contracts",
    title: "ساخت قرارداد",
    description: "با پاسخ به پرسش‌نامه، پیش‌نویس قرارداد شخصی‌سازی‌شده بسازید",
    icon: "📝",
  },
];

export default function NewServicePage() {
  return (
    <div className="p-4 tablet:p-6 max-w-4xl mx-auto">
      <h1 className="text-h2 text-on-surface mb-2">ساخت جدید</h1>
      <p className="text-body-2 text-muted mb-6">چه خدمتی نیاز دارید؟</p>

      <div className="grid tablet:grid-cols-3 gap-4">
        {services.map((service) => (
          <Link
            key={service.href}
            href={service.href}
            className="rounded-large bg-surface p-6 shadow-elevation-1 hover:shadow-elevation-4 transition-shadow border border-divider text-center"
          >
            <div className="text-4xl mb-4">{service.icon}</div>
            <h3 className="text-h3 text-on-surface mb-2">{service.title}</h3>
            <p className="text-body-2 text-muted">{service.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
