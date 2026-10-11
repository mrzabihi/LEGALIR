import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// ============================================================
// LEGALIR — robots.txt (Next.js metadata route → /robots.txt)
// ============================================================
// Disallows crawling of API routes and every authenticated surface (consumer
// app, admin panel, auth/onboarding flows). This is a crawl-directive ONLY —
// it is NOT a security boundary. Access control is enforced server-side by the
// middleware (session cookie) and `lib/rbac.ts`; a well-behaved crawler obeys
// these rules, a malicious one is stopped by the app, not by this file.
// ============================================================

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Private: authenticated consumer app + admin panel.
          "/admin",
          "/dashboard",
          "/new",
          "/chat",
          "/documents",
          "/contracts",
          "/history",
          "/memory",
          "/subscription",
          "/profile",
          "/settings",
          "/services",
          "/support",
          "/calculators",
          "/lawyer",
          "/consultations",
          "/legal-library",
          "/onboarding",
          // Auth + API: never indexable.
          "/auth",
          "/api",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
