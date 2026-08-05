"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
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

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile nav is open
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

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileOpen]);

  const isActive = useCallback(
    (href: string) => pathname === href,
    [pathname]
  );

  return (
    <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur border-b border-divider" role="banner">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-on-surface hover:opacity-80 transition-opacity"
          aria-label="LEGALIR — صفحه اصلی"
        >
          <div className="h-10 w-10 rounded-medium bg-primary flex items-center justify-center text-white font-bold text-h3 shrink-0">
            ل
          </div>
          <span className="text-h3 text-primary font-bold hidden mobile-l:inline">
            LEGALIR
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden tablet:flex items-center gap-1" aria-label="ناوبری اصلی">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-medium text-body-2 transition-colors ${
                isActive(item.href)
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted hover:text-on-surface hover:bg-background"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden tablet:flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="h-10 w-10 rounded-medium flex items-center justify-center text-muted hover:text-on-surface hover:bg-background transition-colors touch-target"
            aria-label={theme === "light" ? "حالت تیره" : "حالت روشن"}
          >
            {theme === "light" ? <IconDarkMode size={20} /> : <IconLightMode size={20} />}
          </button>

          {/* CTA Dropdown */}
          <div className="relative group">
            <button className="rounded-medium bg-primary text-white px-4 py-2 text-button hover:bg-primary-variant transition-colors touch-target">
              شروع کنید
            </button>
            <div className="absolute end-0 top-full mt-1 w-48 rounded-medium bg-surface shadow-elevation-8 border border-divider opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30">
              {ctaItems.map((cta) => (
                <Link
                  key={cta.href}
                  href={cta.href}
                  className="block px-4 py-2.5 text-body-2 text-on-surface hover:bg-background transition-colors first:rounded-t-medium last:rounded-b-medium"
                >
                  {cta.label}
                </Link>
              ))}
              <Link
                href="/pricing"
                className="block px-4 py-2.5 text-body-2 text-on-surface hover:bg-background transition-colors border-t border-divider"
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
            className="h-10 w-10 rounded-medium flex items-center justify-center text-muted hover:text-on-surface transition-colors touch-target"
            aria-label={theme === "light" ? "حالت تیره" : "حالت روشن"}
          >
            {theme === "light" ? <IconDarkMode size={20} /> : <IconLightMode size={20} />}
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            className="h-10 w-10 rounded-medium flex items-center justify-center text-on-surface hover:bg-background transition-colors touch-target"
            aria-label="باز کردن منو"
            aria-expanded={mobileOpen}
          >
            <IconMenu size={24} />
          </button>
        </div>
      </div>

      {/* Mobile Nav Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 tablet:hidden" role="dialog" aria-modal="true" aria-label="منوی موبایل">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-scrim"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div className="absolute inset-y-0 end-0 w-[85vw] max-w-[320px] bg-surface shadow-elevation-16 flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-medium bg-primary flex items-center justify-center text-white font-bold text-caption">
                  ل
                </div>
                <span className="text-h3 text-primary font-bold">LEGALIR</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="h-10 w-10 rounded-medium flex items-center justify-center text-muted hover:text-on-surface transition-colors touch-target"
                aria-label="بستن منو"
              >
                <IconClose size={24} />
              </button>
            </div>

            {/* Nav Links */}
            <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="منوی موبایل">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-4 py-3 rounded-medium text-body-1 transition-colors mb-1 ${
                    isActive(item.href)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-on-surface hover:bg-background"
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              <div className="my-4 border-t border-divider" />

              <p className="px-4 text-caption text-muted mb-2">خدمات سریع</p>
              {ctaItems.map((cta) => (
                <Link
                  key={cta.href}
                  href={cta.href}
                  className="block px-4 py-2.5 rounded-medium text-body-1 text-on-surface hover:bg-background transition-colors mb-1"
                >
                  {cta.label}
                </Link>
              ))}
            </nav>

            {/* Drawer Footer */}
            <div className="px-4 py-3 border-t border-divider">
              <Link
                href="/auth/mobile"
                className="block w-full rounded-medium bg-primary text-white py-3 text-button text-center hover:bg-primary-variant transition-colors touch-target"
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
