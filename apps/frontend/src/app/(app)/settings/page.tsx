// ============================================================
// LEGALIR — Settings Hub (تنظیمات)
// ============================================================
// The hub is navigation-only: every card routes to a dedicated
// sub-page that owns its own data source. No setting is edited here,
// so there is no risk of a card opening the wrong section.
// ============================================================

"use client";

import Link from "next/link";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import {
  IconSettings,
  IconInfo,
  IconShield,
  IconHistory,
  IconMemory,
  IconFile,
  IconWarning,
  IconChevronRight,
} from "@/lib/icons";

interface HubCard {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tone?: "default" | "danger";
}

const CARDS: HubCard[] = [
  {
    href: "/settings/notifications",
    title: "اعلان‌ها",
    description: "انتخاب کنید چه رویدادهایی به شما اطلاع داده شود.",
    icon: <IconInfo size={22} />,
  },
  {
    href: "/settings/privacy",
    title: "حریم خصوصی",
    description: "کنترل اشتراک‌گذاری داده، آموزش هوش مصنوعی و ذخیره گفتگوها.",
    icon: <IconShield size={22} />,
  },
  {
    href: "/settings/security",
    title: "نشست‌ها و امنیت",
    description: "دستگاه‌های فعال، خروج از نشست‌های دیگر و وضعیت امنیت حساب.",
    icon: <IconShield size={22} />,
  },
  {
    href: "/settings/usage",
    title: "تاریخچه و مصرف",
    description: "میزان مصرف سهمیه و تاریخچه اشتراک‌های شما.",
    icon: <IconHistory size={22} />,
  },
  {
    href: "/settings/memory",
    title: "حافظه و دانش",
    description: "دانش و مستنداتی که هوش مصنوعی باید بداند را مدیریت کنید.",
    icon: <IconMemory size={22} />,
  },
  {
    href: "/settings/data",
    title: "مدیریت داده‌ها",
    description: "دریافت خروجی از داده‌ها و حذف تاریخچه خروجی‌ها.",
    icon: <IconFile size={22} />,
  },
  {
    href: "/settings/account",
    title: "حذف حساب کاربری",
    description: "بستن دائمی حساب و حذف تمام داده‌های مرتبط.",
    icon: <IconWarning size={22} />,
    tone: "danger",
  },
];

export default function SettingsPage() {
  return (
    <div className="p-4 tablet:p-6 max-w-2xl mx-auto" dir="rtl">
      <Breadcrumb
        items={[{ label: "داشبورد", href: "/dashboard" }, { label: "تنظیمات" }]}
      />

      <div className="flex items-center gap-3 mb-6">
        <IconSettings size={28} className="text-on-surface" />
        <h1 className="text-h2 text-on-surface">تنظیمات</h1>
      </div>

      <div className="space-y-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`group flex items-center gap-4 rounded-large border bg-surface p-5 shadow-elevation-1 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              card.tone === "danger" ? "border-error/40" : "border-divider"
            }`}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                card.tone === "danger"
                  ? "bg-error/10 text-error"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {card.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-body-1 font-semibold ${
                  card.tone === "danger" ? "text-error" : "text-on-surface"
                }`}
              >
                {card.title}
              </p>
              <p className="text-body-2 text-muted mt-0.5">{card.description}</p>
            </div>
            <span className="shrink-0 text-muted transition-transform group-hover:-translate-x-0.5">
              <IconChevronRight size={20} rtlFlip />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
