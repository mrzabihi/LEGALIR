import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Development Tools",
  robots: "noindex, nofollow",
};

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
