import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "ورود به LEGALIR",
  description: "ورود به پلتفرم هوشمند حقوقی LEGALIR",
};

export default function LoginPage() {
  redirect("/auth/mobile");
}
