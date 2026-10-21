"use client";

// ============================================================
// LEGALIR — Landing header (home page only)
// ============================================================
// This header is mounted by the `(home)` route-group layout, so it is
// rendered on `/` and nowhere else. The shared `(public)` header keeps
// serving /about, /pricing, /blog … untouched.
//
// Behaviour is carried over from the previous public header verbatim,
// because it is a tested contract:
//   • signed-in → «داشبورد»; guest → «ورود» / «ثبت‌نام»
//   • «شروع کنید» opens the three services; a guest is routed through
//     /auth/mobile?intent=… so the intent survives login
//   • the mobile drawer traps focus, locks the page, closes on Escape
//     and on backdrop click
// What changed is only the visual language: one 72px bar, a quiet
// underline for the active route, a single filled CTA, and a drawer that
// uses the same surfaces as the page.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronDown, IconClose, IconDashboard, IconMenu } from "@/lib/icons";
import { useSessionStatus } from "@/lib/auth/use-auth";

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "صفحه اصلی" },
  { href: "/features", label: "قابلیت‌ها" },
  { href: "/pricing", label: "تعرفه‌ها" },
  { href: "/download", label: "دانلود" },
  { href: "/blog", label: "وبلاگ حقوقی" },
  { href: "/about", label: "درباره ما" },
  { href: "/contact", label: "تماس با ما" },
];

const SERVICES = [
  { href: "/new", intent: "chat", label: "مشاوره حقوقی" },
  { href: "/documents", intent: "document", label: "تحلیل سند" },
  { href: "/contracts", intent: "contract", label: "تولید قرارداد" },
];

/** Ask LandingMotion to pause/resume the smooth scroller. The drawer fixes
 *  the body, and a running interpolator would keep writing scroll state
 *  underneath it. The event keeps the two islands decoupled. */
function broadcastScrollLock(locked: boolean) {
  document.dispatchEvent(
    new CustomEvent("landing:scroll-lock", { detail: locked })
  );
}

export function LandingHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const servicesRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const { isAuthenticated, isLoading: sessionLoading } = useSessionStatus();

  const goToService = useCallback(
    (href: string, intent: string) => {
      setServicesOpen(false);
      setMobileOpen(false);
      if (isAuthenticated) router.push(href);
      else router.push(`/auth/mobile?intent=${intent}`);
    },
    [isAuthenticated, router]
  );

  // Portals need a DOM target, which only exists after hydration.
  useEffect(() => setMounted(true), []);

  // Close transient UI on navigation.
  useEffect(() => {
    setMobileOpen(false);
    setServicesOpen(false);
  }, [pathname]);

  // Scroll state — one rAF-throttled passive listener, cleaned up.
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Drawer: lock the page, pause the scroller, trap focus, restore focus.
  useEffect(() => {
    if (!mobileOpen) return;
    const scrollY = window.scrollY;
    const { overflow, position, top, width } = document.body.style;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    broadcastScrollLock(true);

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.width = width;
      window.scrollTo(0, scrollY);
      broadcastScrollLock(false);
      previouslyFocused?.focus();
    };
  }, [mobileOpen]);

  // Services menu: outside click + Escape.
  useEffect(() => {
    if (!servicesOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (servicesRef.current && !servicesRef.current.contains(event.target as Node)) {
        setServicesOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setServicesOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [servicesOpen]);

  const isActive = (href: string) => pathname === href;

  return (
    <header
      role="banner"
      /* The third and last glass surface: the page scrolls beneath this
         bar, so the translucency has a subject. `.landing-glass--bar` drops
         the radius and shadow the panel recipe carries — only the blur and
         the alpha are borrowed. The hairline appears on scroll, which is the
         bar's own micro-interaction. */
      className={`landing-glass landing-glass--bar sticky top-0 z-40 transition-[border-color,background-color] duration-300 ease-[var(--ln-ease)] ${
        scrolled
          ? "border-b-[color:var(--ln-line)] bg-[rgba(255,255,255,0.86)]"
          : "bg-[rgba(255,255,255,0.7)]"
      }`}
    >
      <div className="landing-container flex h-16 items-center gap-6 laptop:h-[72px]">
        {/* Brand — start edge in RTL.
            The landing header shows the crest ALONE: the Persian wordmark
            beside it was removed by the brief. The link keeps an explicit
            accessible name, so the destination is still announced. Every
            other header in the product (`components/public/Header`, the app
            shells) is untouched and still renders the full lockup. */}
        <Link
          href="/"
          aria-label="لیگالیر — صفحه اصلی"
          /* On phones the crest and the menu trigger trade places: the
             hamburger takes the reading-start edge (the right, in RTL) and
             the crest sits at the far end. This is expressed as flex
             `order`, not by moving DOM nodes, so the tab order and the
             accessible name stay exactly as they were, and the desktop
             row is untouched (`laptop:order-none` restores source order). */
          className="landing-link order-3 flex min-h-11 shrink-0 items-center rounded-sm laptop:order-none"
        >
          {/* Static brand mark, fixed height, `w-auto` — the repo's logo
              convention across every shell (see components/public/Header).
              A raster optimizer would only re-encode a 40px asset. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/legalir-logo.png"
            alt=""
            width={472}
            height={351}
            className="h-9 w-auto laptop:h-10"
          />
        </Link>

        {/* Desktop navigation */}
        <nav
          aria-label="ناوبری اصلی"
          className="hidden items-center gap-1 laptop:flex"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`landing-link relative inline-flex min-h-11 items-center rounded-sm px-3 text-[13.5px] font-medium transition-colors duration-200 ${
                  active
                    ? "text-[color:var(--ln-navy)]"
                    : "text-[color:var(--ln-muted)] hover:text-[color:var(--ln-navy)]"
                }`}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 -bottom-[1px] h-[2px] rounded-full bg-[color:var(--ln-gold)] transition-opacity duration-200 ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="order-2 ms-auto laptop:order-none" />

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 laptop:flex">
          {!sessionLoading &&
            (isAuthenticated ? (
              <Link
                href="/dashboard"
                className="landing-link inline-flex min-h-11 items-center gap-2 rounded-[var(--ln-r-sm)] px-3 text-[13.5px] font-medium text-[color:var(--ln-navy)] transition-colors hover:bg-[color:var(--ln-canvas)]"
              >
                <IconDashboard size={17} />
                داشبورد
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/mobile"
                  className="landing-link inline-flex min-h-11 items-center rounded-[var(--ln-r-sm)] px-3 text-[13.5px] font-medium text-[color:var(--ln-ink-soft)] transition-colors hover:text-[color:var(--ln-navy)]"
                >
                  ورود
                </Link>
                <Link
                  href="/auth/register"
                  className="landing-link hidden min-h-11 items-center rounded-[var(--ln-r-sm)] px-3 text-[13.5px] font-medium text-[color:var(--ln-ink-soft)] transition-colors hover:text-[color:var(--ln-navy)] desktop:inline-flex"
                >
                  ثبت‌نام
                </Link>
              </>
            ))}

          <div className="relative" ref={servicesRef}>
            <button
              type="button"
              onClick={() => setServicesOpen((open) => !open)}
              aria-expanded={servicesOpen}
              aria-haspopup="true"
              className="landing-btn landing-btn--primary !min-h-11 !px-5 text-[13.5px]"
            >
              شروع کنید
              <IconChevronDown
                size={15}
                aria-hidden="true"
                className={`transition-transform duration-200 ${servicesOpen ? "rotate-180" : ""}`}
              />
            </button>

            <div
              className={`absolute end-0 top-full z-50 mt-2 w-60 origin-top rounded-[var(--ln-r-md)] border border-[color:var(--ln-line)] bg-white p-1.5 shadow-[var(--ln-shadow-3)] transition-[opacity,transform] duration-200 ${
                servicesOpen
                  ? "visible translate-y-0 opacity-100"
                  : "invisible -translate-y-1 opacity-0"
              }`}
            >
              {SERVICES.map((service) => (
                <button
                  key={service.href}
                  type="button"
                  onClick={() => goToService(service.href, service.intent)}
                  className="flex min-h-11 w-full items-center rounded-[var(--ln-r-sm)] px-3 text-start text-[13.5px] text-[color:var(--ln-ink-soft)] transition-colors hover:bg-[color:var(--ln-canvas)] hover:text-[color:var(--ln-navy)]"
                >
                  {service.label}
                </button>
              ))}
              <div className="my-1.5 h-px bg-[color:var(--ln-line)]" />
              <Link
                href="/pricing"
                onClick={() => setServicesOpen(false)}
                className="flex min-h-11 items-center rounded-[var(--ln-r-sm)] px-3 text-[13.5px] font-medium text-[color:var(--ln-green)] transition-colors hover:bg-[color:var(--ln-green-soft)]"
              >
                مشاهده اشتراک‌ها
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="باز کردن منو"
          aria-expanded={mobileOpen}
          className="order-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--ln-r-sm)] text-[color:var(--ln-navy)] transition-colors hover:bg-[color:var(--ln-canvas)] laptop:order-none laptop:hidden"
        >
          <IconMenu size={24} />
        </button>
      </div>

      {/* `landing-portal` re-declares the --ln-* tokens on the dialog root:
          this subtree is portalled to <body>, so it sits outside the
          `.landing` wrapper that owns those custom properties. */}
      {mounted &&
        mobileOpen &&
        createPortal(
          <div
            className="landing-portal fixed inset-0 z-50 overflow-hidden laptop:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="منوی موبایل"
          >
            <div
              className="absolute inset-0 bg-scrim backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            <div
              ref={drawerRef}
              className="absolute inset-y-0 start-0 flex h-dvh w-[min(86vw,340px)] max-w-full flex-col bg-white shadow-[var(--ln-shadow-3)] animate-drawer-slide-in"
            >
              {/* The global `.safe-area-*` helpers are plain rules outside
                  Tailwind's layers, so they would silently override `py-*`.
                  Padding is written here as one calc instead. */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--ln-line)] px-4 pb-3 [padding-top:calc(env(safe-area-inset-top,0px)+0.75rem)]">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/legalir-logo.png"
                    alt="لیگالیر"
                    width={472}
                    height={351}
                    className="h-8 w-auto"
                  />
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="بستن منو"
                  className="touch-target-min flex items-center justify-center rounded-[var(--ln-r-sm)] text-[color:var(--ln-muted)] transition-colors hover:bg-[color:var(--ln-canvas)] hover:text-[color:var(--ln-navy)]"
                >
                  <IconClose size={22} />
                </button>
              </div>

              <nav
                aria-label="منوی موبایل"
                className="flex-1 overflow-y-auto overscroll-contain px-3 py-4"
              >
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`mb-0.5 block rounded-[var(--ln-r-sm)] px-3 py-3 text-[14.5px] transition-colors ${
                      isActive(item.href)
                        ? "bg-[color:var(--ln-green-soft)] font-semibold text-[color:var(--ln-green)]"
                        : "text-[color:var(--ln-ink-soft)] hover:bg-[color:var(--ln-canvas)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}

                <p className="mb-2 mt-5 px-3 text-[11.5px] font-semibold text-[color:var(--ln-muted)]">
                  خدمات پرکاربرد
                </p>
                {SERVICES.map((service) => (
                  <button
                    key={service.href}
                    type="button"
                    onClick={() => goToService(service.href, service.intent)}
                    className="mb-0.5 block w-full rounded-[var(--ln-r-sm)] px-3 py-3 text-start text-[14.5px] text-[color:var(--ln-ink-soft)] transition-colors hover:bg-[color:var(--ln-canvas)]"
                  >
                    {service.label}
                  </button>
                ))}
              </nav>

              <div className="shrink-0 border-t border-[color:var(--ln-line)] px-4 pt-4 [padding-bottom:calc(env(safe-area-inset-bottom,0px)+1rem)]">
                {!sessionLoading &&
                  (isAuthenticated ? (
                    <Link
                      href="/dashboard"
                      className="landing-btn landing-btn--primary w-full"
                    >
                      <IconDashboard size={18} />
                      داشبورد
                    </Link>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Link href="/auth/mobile" className="landing-btn landing-btn--primary w-full">
                        ورود
                      </Link>
                      <Link href="/auth/register" className="landing-btn landing-btn--secondary w-full">
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
