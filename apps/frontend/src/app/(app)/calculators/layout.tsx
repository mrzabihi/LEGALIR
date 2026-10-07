// ============================================================
// LEGALIR — Calculators section metadata
// ============================================================
// The catalog page is a client component (it reads the registry at
// render time), so it cannot export `metadata` itself. This server
// layout supplies the section's SEO surface. Child routes
// (`/calculators/[slug]`) override it with their own
// `generateMetadata`, so this only applies to the index.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "محاسبه‌گرهای حقوقی",
  description:
    "محاسبه‌گرهای حقوقی و مالی لیگالیر: هزینه دادرسی، حق‌الوکاله، دیه، مالیات حقوق، عیدی و سنوات، کمیسیون املاک، سهم‌الارث و بیش از ۳۰ محاسبه دقیق بر پایه قوانین و تعرفه‌های رسمی.",
  alternates: { canonical: "/calculators" },
  openGraph: {
    type: "website",
    title: "محاسبه‌گرهای حقوقی | لیگالیر",
    description:
      "بیش از ۳۰ محاسبه‌گر حقوقی و مالی مستند بر پایه قوانین و تعرفه‌های رسمی ایران.",
    url: "/calculators",
    locale: "fa_IR",
    siteName: "لیگالیر",
  },
  twitter: {
    card: "summary",
    title: "محاسبه‌گرهای حقوقی | لیگالیر",
    description:
      "بیش از ۳۰ محاسبه‌گر حقوقی و مالی مستند بر پایه قوانین و تعرفه‌های رسمی ایران.",
  },
};

export default function CalculatorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
