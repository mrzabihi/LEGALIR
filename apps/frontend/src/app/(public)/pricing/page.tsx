import type { Metadata } from "next";
import { PricingClient } from "./PricingClient";

export const metadata: Metadata = {
  title: "تعرفه‌های LEGALIR | اشتراک پلتفرم حقوقی",
  description:
    "تعرفه‌ها و پلن‌های اشتراک LEGALIR — انتخاب پلن مناسب برای استفاده از خدمات هوش مصنوعی حقوقی، تحلیل اسناد و تولید قرارداد",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return <PricingClient />;
}
