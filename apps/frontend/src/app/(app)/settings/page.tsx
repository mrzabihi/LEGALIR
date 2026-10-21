// ============================================================
// LEGALIR — Settings Hub (تنظیمات)
// ============================================================
// The hub is navigation-only: every card routes to a dedicated
// sub-page that owns its own data source. No setting is edited here,
// so there is no risk of a card opening the wrong section.
//
// The eight destinations never changed — only how they are grouped.
// They used to be one flat column, so «حذف حساب کاربری» carried the
// same visual weight as «اعلان‌ها» and the reader had to scan all
// eight rows to find anything. The groups below are the page's own
// real taxonomy (nothing invented), and every card keeps its title,
// description, icon, tone and href exactly as it was.
// ============================================================

"use client";

import Link from "next/link";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { PageContainer } from "@/components/shared/page-container";
import { SectionHeader } from "@/components/shared/section-header";
import {
  IconSettings,
  IconInfo,
  IconShield,
  IconHistory,
  IconMemory,
  IconFile,
  IconWarning,
  IconSubscription,
  IconChevronRight,
} from "@/lib/icons";

interface HubCard {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tone?: "default" | "danger";
}

interface HubGroup {
  id: string;
  title: string;
  description: string;
  cards: HubCard[];
}

const GROUPS: HubGroup[] = [
  {
    id: "settings-subscription",
    title: "اشتراک و اعلان‌ها",
    description: "پلن جاری و رویدادهایی که می‌خواهید دربارهٔ آن‌ها خبردار شوید.",
    cards: [
      {
        href: "/settings/subscription",
        title: "اشتراک",
        description: "پلن فعلی، وضعیت، تاریخ پایان و مزایای اشتراک شما.",
        icon: <IconSubscription size={22} />,
      },
      {
        href: "/settings/notifications",
        title: "اعلان‌ها",
        description: "انتخاب کنید چه رویدادهایی به شما اطلاع داده شود.",
        icon: <IconInfo size={22} />,
      },
    ],
  },
  {
    id: "settings-privacy",
    title: "حریم خصوصی و امنیت",
    description: "دسترسی به داده‌ها، نشست‌های فعال و وضعیت امنیت حساب.",
    cards: [
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
    ],
  },
  {
    id: "settings-data",
    title: "مصرف، حافظه و داده",
    description: "سهمیه‌های مصرف‌شده، دانش هوش مصنوعی و خروجی داده‌های شما.",
    cards: [
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
    ],
  },
];

/** The one irreversible destination — kept apart from the rest. */
const DANGER_CARD: HubCard = {
  href: "/settings/account",
  title: "حذف حساب کاربری",
  description: "بستن دائمی حساب و حذف تمام داده‌های مرتبط.",
  icon: <IconWarning size={22} />,
  tone: "danger",
};

function HubCardLink({ card }: { card: HubCard }) {
  const danger = card.tone === "danger";
  return (
    <Link
      href={card.href}
      className={`group flex items-start gap-4 rounded-large border bg-surface p-5 shadow-elevation-1 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        danger ? "border-error" : "border-divider"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-medium ${
          danger ? "bg-error-container text-error" : "bg-primary-container text-primary"
        }`}
      >
        {card.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-body-1 font-semibold ${
            danger ? "text-error" : "text-on-surface"
          }`}
        >
          {card.title}
        </p>
        <p className="mt-0.5 text-body-2 text-muted">{card.description}</p>
      </div>
      <span className="shrink-0 pt-1 text-muted transition-transform group-hover:-translate-x-0.5">
        <IconChevronRight size={20} rtlFlip />
      </span>
    </Link>
  );
}

export default function SettingsPage() {
  return (
    <PageContainer>
      <Breadcrumb
        items={[{ label: "داشبورد", href: "/dashboard" }, { label: "تنظیمات" }]}
      />

      <div className="mb-6 flex items-center gap-3">
        <IconSettings size={28} className="text-on-surface" />
        <h1 className="text-h2 text-on-surface">تنظیمات</h1>
      </div>

      <div className="space-y-7">
        {GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={group.id}>
            <SectionHeader
              id={group.id}
              title={group.title}
              description={group.description}
            />
            {/* Two-up from `tablet`: the column is 1120px, so a single column
                of short rows leaves half the page empty and doubles the scroll. */}
            <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
              {group.cards.map((card) => (
                <HubCardLink key={card.href} card={card} />
              ))}
            </div>
          </section>
        ))}

        {/* Irreversible action — separated by a rule so it can never be hit
            while scanning the ordinary settings. */}
        <section aria-label="حذف حساب" className="border-t border-divider pt-6">
          <HubCardLink card={DANGER_CARD} />
        </section>
      </div>
    </PageContainer>
  );
}
