// ============================================================
// LEGALIR — Landing footer (home page only)
// ============================================================
// Same links, same destinations, same legal copy as the shared public
// footer — regrouped into a single four-column band on a navy base so the
// page ends on the brand colour instead of grey.
//
// One deliberate change: the old «خبرنامه» block was an email input and a
// «ثبت» button with no submit handler and no backend behind it. Rather
// than ship a dead control on the redesigned page, that slot now offers
// the two destinations the block was standing in for — the legal blog and
// the contact channel. Flagged in the report for product-owner sign-off.

import Link from "next/link";
import { IconChevronLeft } from "@/lib/icons";
import { toPersianDigits } from "@/lib/persian-utils";

const LINK_GROUPS = [
  {
    title: "خدمات",
    items: [
      { href: "/auth/mobile?intent=chat", label: "مشاوره حقوقی با هوش مصنوعی" },
      { href: "/auth/mobile?intent=document", label: "تحلیل و بررسی اسناد" },
      { href: "/auth/mobile?intent=contract", label: "تولید پیش‌نویس قرارداد" },
      { href: "/pricing", label: "تعرفه‌ها و اشتراک" },
    ],
  },
  {
    title: "پلتفرم",
    items: [
      { href: "/features", label: "قابلیت‌ها" },
      { href: "/about", label: "درباره لیگالیر" },
      { href: "/contact", label: "تماس با ما" },
    ],
  },
  {
    title: "حقوقی",
    items: [
      { href: "/terms", label: "قوانین استفاده" },
      { href: "/privacy-policy", label: "حریم خصوصی" },
      { href: "/contact", label: "پشتیبانی" },
    ],
  },
];

export function LandingFooter() {
  // Persian digits, like every other number on the page. The run is
  // isolated because «© ۲۰۲۶» in an RTL line would otherwise let the
  // bidi algorithm park the sign on the far side of the year.
  const year = toPersianDigits(new Date().getFullYear());

  return (
    <footer role="contentinfo" dir="rtl" className="bg-[color:var(--ln-ink)] text-white">
      <div className="landing-container">
        <div className="grid gap-10 py-12 tablet:grid-cols-2 laptop:grid-cols-[1.6fr_1fr_1fr_1fr] laptop:gap-8 laptop:py-16">
          {/* Brand + purpose */}
          <div className="tablet:col-span-2 laptop:col-span-1">
            <div className="flex items-center gap-2.5">
              {/* The light-on-dark lockup: the standard logo's wordmark is
                  navy and would disappear on this navy footer. Same crest,
                  same proportions — only the ink is inverted. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/legalir-logo-dashboard-dark.png"
                alt=""
                width={472}
                height={351}
                className="h-10 w-auto"
              />
              <span className="text-[16px] font-extrabold tracking-tight">لیگالیر</span>
            </div>
            <p className="mt-4 max-w-sm text-[13.5px] leading-7 text-white/[0.68]">
              لیگالیر با هدف دسترسی‌پذیر کردن اطلاعات و خدمات حقوقی برای همه افراد
              جامعه ایجاد شده است. ما باور داریم که هر فرد، فارغ از میزان آشنایی با
              قوانین، باید بتواند مسائل حقوقی روزمره خود را درک کند و برای حل آن‌ها
              اقدام آگاهانه انجام دهد.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {/* On ink, the cobalt fill cannot carry a 12.5px label at AA
                  (2.4:1), so the one action here is white-on-ink with a
                  hairline — the page's secondary recipe, inverted. */}
              <Link
                href="/auth/mobile?intent=chat"
                className="landing-link inline-flex min-h-11 items-center gap-1.5 rounded-[var(--ln-r-md)] border border-white/30 px-3.5 text-[12.5px] font-medium text-white transition-colors hover:border-white/60 hover:bg-white/10"
              >
                شروع مشاوره
                <IconChevronLeft size={14} aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="landing-link inline-flex min-h-11 items-center gap-1.5 rounded-[var(--ln-r-sm)] px-3.5 text-[12.5px] font-medium text-white/75 transition-colors hover:text-white"
              >
                گفت‌وگو با تیم
              </Link>
            </div>
          </div>

          {LINK_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="text-[11.5px] font-semibold tracking-[0.1em] text-white/55">
                {group.title}
              </h2>
              <ul className="mt-3.5 space-y-0.5">
                {group.items.map((item) => (
                  <li key={`${group.title}-${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      className="landing-link inline-flex min-h-11 items-center text-[13px] leading-6 text-white/70 transition-colors hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.12] py-6 text-center tablet:flex-row tablet:items-center tablet:justify-between tablet:text-start">
          <p className="text-[12px] text-white/55">
            <span className="inline-block [unicode-bidi:isolate]">&#169; {year}</span>{" "}
            لیگالیر. تمام حقوق محفوظ است.
          </p>
          <p className="text-[12px] leading-6 text-white/55">
            خدمات تخصصی حقوقی با پشتیبانی هوش مصنوعی و منابع حقوقی معتبر
          </p>
        </div>
      </div>
    </footer>
  );
}
