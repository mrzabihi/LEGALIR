import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "ثبت‌نام در LEGALIR",
  description: "ثبت‌نام در پلتفرم هوشمند حقوقی LEGALIR",
};

export default function RegisterPage() {
  redirect("/auth/mobile");
}
