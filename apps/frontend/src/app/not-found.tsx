// ============================================================
// LEGALIR — Root 404 (unmatched routes)
// Renders the shared NotFoundView inside the public site chrome so the
// header/nav stay available. The illustration carries the «۴۰۴».
// ============================================================

import { Header } from "@/components/public/Header";
import { Footer } from "@/components/public/Footer";
import { NotFoundView } from "@/components/shared";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex flex-1 flex-col">
        <NotFoundView className="flex-1" />
      </main>
      <Footer />
    </div>
  );
}
