"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconMenu, IconClose, IconDashboard } from "@/lib/icons";
import { useSessionStatus } from "@/lib/auth/use-auth";

interface NavItem {
  href: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/", label: "صفحه اصلی" },
  { href: "/features", label: "قابلیت‌ها" },
  { href: "/pricing", label: "تعرفه‌ها" },
  { href: "/blog", label: "وبلاگ حقوقی" },
  { href: "/about", label: "درباره ما" },
  { href: "/contact", label: "تماس با ما" },
];

// Each service carries both its real destination and the intent token the
// login flow understands. A signed-in user goes straight to `href`; a guest
// is sent to `/auth/mobile?intent=<intent>` and returned to `href` after
// logging in (or signing up).
const ctaItems = [
  { href: "/new", intent: "chat", label: "مشاوره حقوقی" },
  { href: "/documents", intent: "document", label: "تحلیل سند" },
  { href: "/contracts", intent: "contract", label: "تولید قرارداد" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ctaOpen, setCtaOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Authoritative session state (server-confirmed). `isLoading` is true until
  // the first `/api/v1/me` settles, which lets us hold the auth controls back
  // so a stale localStorage entry never flashes the wrong button.
  const { isAuthenticated, isLoading: sessionLoading } = useSessionStatus();

  // Send the user to a service: directly when signed in, otherwise through
  // the login page with the intent preserved for the post-login redirect.
  const goToService = useCallback(
    (href: string, intent: string) => {
      setCtaOpen(false);
      setMobileOpen(false);
      if (isAuthenticated) {
        router.push(href);
      } else {
        router.push(`/auth/mobile?intent=${intent}`);
      }
    },
    [isAuthenticated, router]
  );

  // Portals need a DOM target, which only exists after hydration.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock background scroll while the drawer is open, restoring the exact
  // scroll position on close (iOS Safari otherwise jumps to the top).
  useEffect(() => {
    if (!mobileOpen) return;
    const scrollY = window.scrollY;
    const { overflow, position, top, width } = document.body.style;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.width = width;
      window.scrollTo(0, scrollY);
    };
  }, [mobileOpen]);

  // Move focus into the drawer on open, trap Tab inside it, and restore
  // focus to the hamburger on close.
  useEffect(() => {
    if (!mobileOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
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
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Desktop Nav — start side */}
        <nav className="hidden laptop:flex items-center gap-0.5" aria-label="ناوبری اصلی">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-2 py-2.5 rounded-medium text-body-2 font-medium transition-all duration-200 ${
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
        <div className="hidden laptop:flex items-center gap-3">
          {/* Auth controls are held back until the session is resolved, so the
              header never flashes "ورود / ثبت‌نام" for a signed-in user. */}
          {!sessionLoading &&
            (isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-medium text-body-2 font-medium text-primary-700 hover:text-primary-800 hover:bg-primary-50 transition-colors"
              >
                <IconDashboard size={18} />
                داشبورد
              </Link>
            ) : (
              <div className="flex items-center gap-1">
                <Link
                  href="/auth/mobile"
                  className="px-4 py-2.5 rounded-medium text-body-2 font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                >
                  ورود
                </Link>
                <Link
                  href="/auth/register"
                  className="px-4 py-2.5 rounded-medium text-body-2 font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                >
                  ثبت‌نام
                </Link>
              </div>
            ))}

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
                <button
                  key={cta.href}
                  type="button"
                  onClick={() => goToService(cta.href, cta.intent)}
                  className="block w-full text-start px-4 py-3 text-body-2 text-neutral-700 hover:bg-neutral-50 hover:text-primary-700 transition-colors"
                >
                  {cta.label}
                </button>
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

        {/* Mobile: Hamburger — first in DOM order so it lands on the start
            (right) side under RTL. */}
        <div className="flex items-center gap-1 laptop:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="h-10 w-10 rounded-medium flex items-center justify-center text-neutral-700 hover:bg-neutral-100 transition-colors"
            aria-label="باز کردن منو"
            aria-expanded={mobileOpen}
          >
            <IconMenu size={24} />
          </button>
        </div>

        {/* Mobile spacer — pushes the hamburger to the start (right) side */}
        <div className="laptop:hidden flex-1" aria-hidden="true" />
      </div>

      {/* Mobile Nav Drawer — portaled to <body> so the header's
          `backdrop-blur-md` (a backdrop-filter, which makes the header the
          containing block for fixed descendants) cannot clip it to the
          header's own box. */}
      {mounted &&
        mobileOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 overflow-hidden laptop:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="منوی موبایل"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            <div
              ref={drawerRef}
              className="absolute inset-y-0 start-0 flex h-dvh w-[min(85vw,340px)] max-w-full flex-col bg-white shadow-2xl animate-drawer-slide-in"
            >
              <div className="safe-area-top flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
                <img
                  src="/legalir-logo.png"
                  alt="LEGALIR"
                  className="h-10 w-auto shrink-0"
                />
                <button
                  ref={closeBtnRef}
                  onClick={() => setMobileOpen(false)}
                  className="touch-target-min flex shrink-0 items-center justify-center rounded-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
                  aria-label="بستن منو"
                >
                  <IconClose size={24} />
                </button>
              </div>

              <nav
                className="flex-1 overflow-y-auto overscroll-contain px-3 py-4"
                aria-label="منوی موبایل"
              >
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mb-1 block rounded-medium px-4 py-3.5 text-body-1 transition-colors ${
                      isActive(item.href)
                        ? "bg-primary-50 font-medium text-primary-700"
                        : "text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}

                <div className="my-5 border-t border-neutral-200" />

                <p className="mb-3 px-4 text-caption font-medium text-neutral-400">
                  خدمات پرکاربرد
                </p>
                {ctaItems.map((cta) => (
                  <button
                    key={cta.href}
                    type="button"
                    onClick={() => goToService(cta.href, cta.intent)}
                    className="mb-1 flex w-full items-center gap-3 rounded-medium px-4 py-3 text-start text-body-1 text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    <span className="h-2 w-2 rounded-full bg-secondary-500" />
                    {cta.label}
                  </button>
                ))}
              </nav>

              <div className="safe-area-bottom shrink-0 border-t border-neutral-200 bg-neutral-50 px-4 py-4">
                {!sessionLoading &&
                  (isAuthenticated ? (
                    <Link
                      href="/dashboard"
                      className="flex w-full items-center justify-center gap-2 rounded-medium bg-primary-700 py-3.5 text-button font-medium text-white shadow-sm transition-colors hover:bg-primary-800"
                    >
                      <IconDashboard size={18} />
                      داشبورد
                    </Link>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Link
                        href="/auth/mobile"
                        className="flex w-full items-center justify-center rounded-medium bg-primary-700 py-3.5 text-button font-medium text-white shadow-sm transition-colors hover:bg-primary-800"
                      >
                        ورود
                      </Link>
                      <Link
                        href="/auth/register"
                        className="flex w-full items-center justify-center rounded-medium border border-primary-700/40 py-3.5 text-button font-medium text-primary-700 transition-colors hover:bg-primary-50"
                      >
                        ثبت‌نام
                      </Link>
                    </div>
                  ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
