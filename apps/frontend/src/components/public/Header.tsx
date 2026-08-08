"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import { IconMenu, IconClose, IconLightMode, IconDarkMode } from "@/lib/icons";
import { useThemeStore } from "@/stores/theme-store";

interface NavItem {
  href: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/", label: "صفحه اصلی" },
  { href: "/features", label: "قابلیت‌ها" },
  { href: "/pricing", label: "تعرفه‌ها" },
  { href: "/about", label: "درباره ما" },
  { href: "/contact", label: "تماس با ما" },
];

const ctaItems = [
  { href: "/auth/mobile?intent=chat", label: "مشاوره حقوقی" },
  { href: "/auth/mobile?intent=document", label: "تحلیل سند" },
  { href: "/auth/mobile?intent=contract", label: "تولید قرارداد" },
];

export function Header() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useThemeStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ctaOpen, setCtaOpen] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileOpen]);

  useEffect(() => {
    if (!ctaOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ctaRef.current && !ctaRef.current.contains(e.target as Node)) {
        setCtaOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCtaOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [ctaOpen]);

  const isActive = useCallback(
    (href: string) => pathname === href,
    [pathname]
  );

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-neutral-200 shadow-sm" role="banner">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
          aria-label="LEGALIR — صفحه اصلی"
        >
          <img
            src="/legalir-logo.png"
            alt="LEGALIR"
            className="h-16 w-auto"
          />
          <span className="text-h3 text-primary-800 font-bold hidden mobile-l:inline">
            LEGALIR
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden tablet:flex items-center gap-1" aria-label="ناوبری اصلی">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2.5 rounded-medium text-body-2 font-medium transition-all duration-200 ${
                isActive(item.href)
                  ? "bg-primary-50 text-primary-700"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden tablet:flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="h-10 w-10 rounded-medium flex items-center justify-center text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
            aria-label={theme === "light" ? "حالت تیره" : "حالت روشن"}
          >
            {theme === "light" ? <IconDarkMode size={20} /> : <IconLightMode size={20} />}
          </button>

          <div className="h-6 w-px bg-neutral-200" />

          <Link
            href="/auth/mobile"
            className="px-4 py-2.5 rounded-medium text-body-2 font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            ورود
          </Link>

          <div className="relative" ref={ctaRef}>
            <button
              onClick={() => setCtaOpen((prev) => !prev)}
              className="rounded-medium bg-primary-700 text-white px-5 py-2.5 text-button hover:bg-primary-800 transition-all duration-200 shadow-sm hover:shadow-md"
              aria-expanded={ctaOpen}
              aria-haspopup="true"
            >
              شروع کنید
              <svg className="inline-block mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              className={`absolute end-0 top-full mt-2 w-52 rounded-xl bg-white shadow-xl border border-neutral-200 py-1 transition-all duration-200 origin-top-right z-30 ${
                ctaOpen
                  ? "opacity-100 scale-100 visible"
                  : "opacity-0 scale-95 invisible"
              }`}
            >
              {ctaItems.map((cta) => (
                <Link
                  key={cta.href}
                  href={cta.href}
                  className="block px-4 py-3 text-body-2 text-neutral-700 hover:bg-neutral-50 hover:text-primary-700 transition-colors"
                  onClick={() => setCtaOpen(false)}
                >
                  {cta.label}
                </Link>
              ))}
              <div className="border-t border-neutral-100 my-1" />
              <Link
                href="/pricing"
                className="block px-4 py-3 text-body-2 text-primary-700 font-medium hover:bg-primary-50 transition-colors"
                onClick={() => setCtaOpen(false)}
              >
                مشاهده اشتراک‌ها
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile: Theme Toggle + Hamburger */}
        <div className="flex items-center gap-1 tablet:hidden">
          <button
            onClick={toggleTheme}
            className="h-10 w-10 rounded-medium flex items-center justify-center text-neutral-500 hover:text-neutral-800 transition-colors"
            aria-label={theme === "light" ? "حالت تیره" : "حالت روشن"}
          >
            {theme === "light" ? <IconDarkMode size={20} /> : <IconLightMode size={20} />}
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            className="h-10 w-10 rounded-medium flex items-center justify-center text-neutral-700 hover:bg-neutral-100 transition-colors"
            aria-label="باز کردن منو"
            aria-expanded={mobileOpen}
          >
            <IconMenu size={24} />
          </button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 tablet:hidden" role="dialog" aria-modal="true" aria-label="منوی موبایل">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute inset-y-0 end-0 w-[85vw] max-w-[340px] bg-white shadow-2xl flex flex-col animate-drawer-slide-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <img
                  src="/legalir-logo.png"
                  alt="LEGALIR"
                  className="h-14 w-auto"
                />
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="h-10 w-10 rounded-medium flex items-center justify-center text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
                aria-label="بستن منو"
              >
                <IconClose size={24} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3" aria-label="منوی موبایل">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-4 py-3.5 rounded-medium text-body-1 transition-colors mb-1 ${
                    isActive(item.href)
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              <div className="my-5 border-t border-neutral-200" />

              <p className="px-4 text-caption text-neutral-400 mb-3 font-medium">خدمات پرکاربرد</p>
              {ctaItems.map((cta) => (
                <Link
                  key={cta.href}
                  href={cta.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-medium text-body-1 text-neutral-700 hover:bg-neutral-50 transition-colors mb-1"
                >
                  <span className="w-2 h-2 rounded-full bg-secondary-500" />
                  {cta.label}
                </Link>
              ))}
            </nav>

            <div className="px-4 py-4 border-t border-neutral-200 bg-neutral-50">
              <Link
                href="/auth/mobile"
                className="flex items-center justify-center w-full rounded-medium bg-primary-700 text-white py-3.5 text-button font-medium hover:bg-primary-800 transition-colors shadow-sm"
              >
                ورود / ثبت‌نام
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
