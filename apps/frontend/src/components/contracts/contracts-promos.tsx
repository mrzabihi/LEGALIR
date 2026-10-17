// ============================================================
// LEGALIR — Service promos under the contracts workspace
// ============================================================
// Two — and only two — promotions for services that are genuinely
// different from «تنظیم قرارداد»:
//
//   • consulting a verified human lawyer  → /lawyers
//   • reading the legal knowledge library → /legal-library
//
// They reuse the SAME campaign treatment as the /services page
// (`CampaignBanner`): gradient surface, code-native artwork, one
// headline, one message, ONE action, `Reveal` on scroll and
// `animate-float` artwork. Both collapse under `prefers-reduced-motion`,
// so the promo never moves when the user asked motion to stop.
//
// Placement is deliberate: the block sits AFTER both contract sections,
// so it can never push the template rail or the user's own contracts
// down, and can never compete with the page's primary action.
// ============================================================

"use client";

import { IconHandshake, IconLibrary } from "@/lib/icons";
import type { CampaignBannerDef } from "@/lib/services/catalog";
import { CampaignBanner } from "@/components/services/campaign-banner";

const LAWYER_PROMO: CampaignBannerDef = {
  id: "contracts-promo-lawyer",
  eyebrow: "وکیل انسانی",
  title: "به مشاوره تخصصی نیاز دارید؟",
  message: "از میان وکلای تأییدشده لیگالیر، وکیل مناسب موضوع خود را انتخاب کنید.",
  cta: "مشاهده خدمت",
  href: "/lawyers",
  icon: IconHandshake,
  art: "lawyer",
  gradient: "from-primary-700 via-primary-800 to-primary-900",
  accent: "#D89A13",
  experience: "مشاوره با وکیل انسانی",
  keywords: ["وکیل", "مشاوره"],
};

const LIBRARY_PROMO: CampaignBannerDef = {
  id: "contracts-promo-library",
  eyebrow: "آموزش حقوقی",
  title: "پیش از تنظیم، قوانین را بشناسید",
  message: "راهنماها و مقالات کاربردی لیگالیر را مطالعه کنید؛ این محتوا آموزشی است.",
  cta: "مشاهده خدمت",
  href: "/legal-library",
  icon: IconLibrary,
  art: "library",
  // Deliberately deeper than the /services library campaign. The shared
  // banner draws its supporting line at `white/80`, so a gold panel has
  // to start dark enough for that composite to clear 4.5:1 — `600`
  // measured 3.88:1, `800` measures 5.03:1.
  gradient: "from-secondary-800 via-secondary-900 to-secondary-900",
  accent: "#D89A13",
  experience: "مطالعه منابع آموزشی",
  keywords: ["منابع", "مقاله", "قانون"],
};

export function ContractsPromos() {
  return (
    <section aria-label="خدمات دیگر لیگالیر" className="space-y-4">
      <CampaignBanner banner={LAWYER_PROMO} size="panel" />
      <CampaignBanner banner={LIBRARY_PROMO} size="panel" />
    </section>
  );
}
