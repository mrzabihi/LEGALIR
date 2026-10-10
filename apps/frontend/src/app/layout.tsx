import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { InstallBanner } from "@/components/pwa/install-banner";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { SITE_URL, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  // Resolves every relative URL in metadata (canonical, openGraph, icons) to an
  // absolute one. Env-driven via NEXT_PUBLIC_SITE_URL — no hard-coded domain.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "لیگالیر | دستیار هوشمند حقوقی ایران",
    template: "%s | لیگالیر",
  },
  description: "پلتفرم هوشمند قوانین و قراردادهای حقوقی ایران",
  applicationName: "لیگالیر",
  manifest: "/manifest.json",
  // Public pages opt in explicitly; private groups (app/admin/auth) override
  // this with `robots: { index: false }` on their own layouts/pages.
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "لیگالیر",
    locale: "fa_IR",
    url: absoluteUrl("/"),
    title: "لیگالیر | دستیار هوشمند حقوقی ایران",
    description: "پلتفرم هوشمند قوانین و قراردادهای حقوقی ایران",
  },
  twitter: {
    card: "summary_large_image",
    title: "لیگالیر | دستیار هوشمند حقوقی ایران",
    description: "پلتفرم هوشمند قوانین و قراردادهای حقوقی ایران",
  },
  // iOS standalone chrome — Safari ignores the manifest's display mode for
  // the status bar and home-screen title, so these meta tags are required.
  appleWebApp: {
    capable: true,
    title: "لیگالیر",
    // `default` lets iOS reserve the top safe area and pick a readable status
    // bar colour. `black-translucent` would force white text, which is
    // invisible on this app's light surfaces.
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  // Next emits the standardised `mobile-web-app-capable`; iOS before 16.4 only
  // honours the legacy `apple-mobile-web-app-capable`, so emit both.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/favicon.ico" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#162033" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa-IR" dir="rtl" suppressHydrationWarning>
      <head />
      <body className="min-h-screen bg-background text-on-surface antialiased" suppressHydrationWarning>
        <a
          href="#main-content"
          className="skip-to-main"
        >
          پرش به محتوای اصلی
        </a>
        <Providers>{children}</Providers>
        {/* PWA: install affordance (mobile) + service-worker lifecycle.
            Both are client-only and render nothing on the server. */}
        <InstallBanner />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
