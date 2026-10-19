// ============================================================
// LEGALIR — Home (landing) route-group layout
// ============================================================
// `/` is the only route in this group. It mounts the landing-specific
// header, footer and motion island and leaves the shared `(public)`
// layout (used by /about, /pricing, /blog, /contact …) untouched.
//
// The `.landing` wrapper is the token scope: every `--ln-*` variable and
// every landing utility in globals.css is nested under it, so nothing
// here can restyle the app shell, the admin console or the lawyer panel.

import { ForceLightTheme } from "@/components/public/ForceLightTheme";
import { LandingFooter } from "@/components/public/landing/landing-footer";
import { LandingHeader } from "@/components/public/landing/landing-header";
import { LandingMotion } from "@/components/public/landing/landing-motion";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing flex min-h-screen flex-col">
      {/* The public site is light-only (§3/§40). The component only mutates
          the DOM attribute on this route and never writes the saved theme. */}
      <ForceLightTheme />
      <LandingHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <LandingFooter />
      {/* One client island: Lenis + GSAP reveals. Renders nothing and is a
          no-op for reduced-motion visitors and no-JS clients. */}
      <LandingMotion />
    </div>
  );
}
