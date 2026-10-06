// ============================================================
// LEGALIR — Admin · Content & Notifications (محتوا و اطلاع‌رسانی)
// ============================================================
// The content surface. Today the platform owns a blog store; this page
// reports its real publish state (total vs published) and lists the
// articles newest-first. Authoring is done in the blog editor, not here —
// so this page is READ-ONLY and says so.
//
// Honesty: there is no notifications store wired to the admin API yet, so
// the notifications section states that plainly rather than inventing a
// broadcast button that goes nowhere.
// ============================================================

"use client";

import { useAdminContent } from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import {
  PageHeader,
  StatCard,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  InfoBanner,
  Section,
} from "@/components/admin/ui";

export default function AdminContentPage() {
  const query = useAdminContent();

  return (
    <div>
      <PageHeader
        title="محتوا و اطلاع‌رسانی"
        description="وضعیت انتشار محتوای پلتفرم. نوشتن و ویرایش مقاله در ویرایشگر وبلاگ انجام می‌شود؛ این نما فقط‌خواندنی است."
      />

      {query.data && (
        <div className="mb-5 grid grid-cols-2 gap-3 tablet:grid-cols-3">
          <StatCard label="کل مقاله‌ها" value={query.data.blog.total} />
          <StatCard label="منتشرشده" value={query.data.blog.published} tone="success" />
          <StatCard
            label="پیش‌نویس / منتشرنشده"
            value={Math.max(0, query.data.blog.total - query.data.blog.published)}
            tone="warning"
          />
        </div>
      )}

      <Section title="مقاله‌ها" subtitle="فهرست محتوای وبلاگ، جدیدترین در بالا.">
        <StateView
          query={query}
          loadingRows={6}
          isEmpty={(d) => d.blog.items.length === 0}
          emptyMessage="هنوز مقاله‌ای ثبت نشده است."
        >
          {(data) => (
            <DataTable
              head={
                <tr>
                  <Th>عنوان</Th>
                  <Th>نشانی (slug)</Th>
                  <Th>وضعیت</Th>
                  <Th>انتشار</Th>
                </tr>
              }
            >
              {data.blog.items.map((a) => (
                <tr key={a.id}>
                  <Td className="max-w-[320px]">
                    <span className="block truncate font-medium text-on-surface" title={a.title}>
                      {a.title}
                    </span>
                  </Td>
                  <Td dir="ltr" className="text-caption text-muted">
                    {a.slug}
                  </Td>
                  <Td>
                    {a.publishedAt ? (
                      <Badge tone="success">منتشرشده</Badge>
                    ) : (
                      <Badge tone="warning">پیش‌نویس</Badge>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-caption text-muted">
                    {a.publishedAt ? toPersianDate(a.publishedAt) : "—"}
                  </Td>
                </tr>
              ))}
            </DataTable>
          )}
        </StateView>
      </Section>

      <Section title="اطلاع‌رسانی و اعلان‌ها">
        <InfoBanner tone="info">
          در این نسخه، سامانهٔ اعلان‌های سراسری به رابط مدیریتی متصل نشده است؛ بنابراین
          امکان ارسال یا زمان‌بندی اطلاعیه در این صفحه وجود ندارد. پس از راه‌اندازی سرویس
          اعلان، این بخش به آن متصل خواهد شد. هیچ اعلان ساختگی ارسال نمی‌شود.
        </InfoBanner>
      </Section>

      {query.data && (
        <p className="mt-2 text-caption text-muted">
          جمع کل: {toPersianNumber(query.data.blog.total)} مقاله ·{" "}
          {toPersianNumber(query.data.blog.published)} منتشرشده.
        </p>
      )}
    </div>
  );
}
