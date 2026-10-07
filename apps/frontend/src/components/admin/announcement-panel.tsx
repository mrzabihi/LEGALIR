// ============================================================
// LEGALIR — Admin · Announcement composer (اطلاع‌رسانی)
// ============================================================
// Compose a platform announcement and publish it — or keep it as a draft.
// A published announcement is delivered through the SAME derived notification
// feed every user already has (`deriveNotifications`, category "public"), so
// there is no separate broadcast channel to fall out of sync. Gated on
// `admin:content:manage`; the server re-checks the same permission.
// ============================================================

"use client";

import { useState } from "react";
import { snackbar } from "@legalir/ui";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import {
  useAdminAnnouncements,
  useAdminMe,
  useCreateAdminAnnouncement,
  useSetAdminAnnouncementStatus,
} from "@/hooks/useAdmin";
import {
  Card,
  Button,
  Field,
  TextInput,
  TextArea,
  Select,
  Badge,
  StateView,
} from "@/components/admin/ui";
import { IconSend, IconCheckCircle } from "@/lib/icons";
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_AUDIENCE_FA,
  ANNOUNCEMENT_STATUS_FA,
  type AnnouncementAudience,
  type AdminAnnouncement,
} from "@legalir/types";

export function AnnouncementPanel() {
  const { can } = useAdminMe();
  const canManage = can("admin:content:manage");

  const list = useAdminAnnouncements();
  const create = useCreateAdminAnnouncement();
  const setStatus = useSetAdminAnnouncementStatus();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [href, setHref] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("ALL");
  const [publish, setPublish] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setMessage("");
    setHref("");
    setActionLabel("");
    setAudience("ALL");
    setPublish(true);
    setError(null);
  }

  function submit() {
    if (!canManage) return;
    const t = title.trim();
    const m = message.trim();
    if (!t) return setError("عنوان اطلاعیه الزامی است.");
    if (!m) return setError("متن اطلاعیه الزامی است.");
    setError(null);
    create.mutate(
      {
        title: t,
        message: m,
        href: href.trim() || null,
        actionLabel: actionLabel.trim() || null,
        audience,
        publish,
      },
      {
        onSuccess: (created) => {
          snackbar.show({
            message:
              created.status === "published"
                ? "اطلاعیه منتشر شد و در مرکز اعلان کاربران نمایش داده می‌شود."
                : "اطلاعیه به‌صورت پیش‌نویس ذخیره شد (منتشر نشده).",
            variant: "success",
          });
          reset();
        },
        onError: (err) =>
          snackbar.show({
            message: err instanceof Error ? err.message : "ثبت اطلاعیه ناموفق بود",
            variant: "error",
          }),
      }
    );
  }

  function toggle(a: AdminAnnouncement) {
    const next = a.status === "published" ? "draft" : "published";
    setStatus.mutate(
      { id: a.id, status: next },
      {
        onSuccess: () =>
          snackbar.show({
            message:
              next === "published" ? "اطلاعیه منتشر شد." : "اطلاعیه بازگردانده شد (پیش‌نویس).",
            variant: "success",
          }),
        onError: (err) =>
          snackbar.show({
            message: err instanceof Error ? err.message : "تغییر وضعیت ناموفق بود",
            variant: "error",
          }),
      }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <Card className="p-4">
          <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
            <div className="tablet:col-span-2">
              <Field label="عنوان اطلاعیه">
                <TextInput
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="مثلاً: به‌روزرسانی ماشین‌حساب دیه ۱۴۰۵"
                />
              </Field>
            </div>
            <div className="tablet:col-span-2">
              <Field
                label="متن اطلاعیه"
                hint="متن کوتاه و روشن؛ به‌عنوان بدنهٔ اعلان نمایش داده می‌شود."
              >
                <TextArea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={600}
                  rows={3}
                  placeholder="شرح مختصر تغییر یا رویداد…"
                />
              </Field>
            </div>
            <Field label="مخاطب">
              <Select
                value={audience}
                onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
              >
                {ANNOUNCEMENT_AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {ANNOUNCEMENT_AUDIENCE_FA[a]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="واحد انتشار">
              <Select
                value={publish ? "now" : "draft"}
                onChange={(e) => setPublish(e.target.value === "now")}
              >
                <option value="now">انتشار فوری</option>
                <option value="draft">ذخیره به‌عنوان پیش‌نویس</option>
              </Select>
            </Field>
            <Field label="نشانی مقصد (اختیاری)" hint="مسیر داخلی، مثلاً /calculators">
              <TextInput
                value={href}
                onChange={(e) => setHref(e.target.value)}
                dir="ltr"
                placeholder="/calculators"
              />
            </Field>
            <Field label="برچسب دکمه (اختیاری)" hint="فقط وقتی نشانی مقصد پر شده باشد.">
              <TextInput
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                maxLength={60}
                placeholder="مشاهده"
              />
            </Field>
          </div>

          {error && (
            <p className="mt-3 text-caption text-error-600 dark:text-error-400">{error}</p>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={reset} disabled={create.isPending}>
              پاک‌کردن
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              loading={create.isPending}
              startIcon={<IconSend size={16} />}
            >
              {publish ? "انتشار اطلاعیه" : "ذخیره پیش‌نویس"}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <p className="text-body-2 text-muted">
            برای نوشتن یا انتشار اطلاعیه به مجوز «مدیریت محتوا» نیاز دارید؛ این بخش برای شما
            فقط‌خواندنی است.
          </p>
        </Card>
      )}

      <StateView
        query={list}
        loadingRows={3}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="هنوز اطلاعیه‌ای ساخته نشده است."
      >
        {(d) => (
          <ul className="divide-y divide-divider overflow-hidden rounded-large border border-divider">
            {d.items.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-2 bg-surface px-4 py-3 tablet:flex-row tablet:items-center tablet:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.status === "published" ? (
                      <Badge tone="success">{ANNOUNCEMENT_STATUS_FA.published}</Badge>
                    ) : (
                      <Badge tone="warning">{ANNOUNCEMENT_STATUS_FA.draft}</Badge>
                    )}
                    <Badge tone="neutral">{ANNOUNCEMENT_AUDIENCE_FA[a.audience]}</Badge>
                    <span className="truncate text-body-2 font-medium text-on-surface">
                      {a.title}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-caption text-muted">{a.message}</p>
                  <p className="mt-1 text-caption text-muted">
                    {toPersianDate(a.createdAt)}
                    {a.createdByName ? ` · ${a.createdByName}` : ""}
                    {a.publishedAt ? ` · منتشرشده ${toPersianDate(a.publishedAt)}` : ""}
                  </p>
                </div>
                {canManage && (
                  <div className="shrink-0">
                    <Button
                      size="sm"
                      variant={a.status === "published" ? "secondary" : "primary"}
                      onClick={() => toggle(a)}
                      disabled={setStatus.isPending}
                      startIcon={
                        a.status === "published" ? undefined : <IconCheckCircle size={14} />
                      }
                    >
                      {a.status === "published" ? "بازگردانی به پیش‌نویس" : "انتشار"}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </StateView>

      {list.data && list.data.items.length > 0 && (
        <p className="text-caption text-muted">
          {toPersianNumber(list.data.items.filter((a) => a.status === "published").length)}{" "}
          اطلاعیهٔ منتشرشده از {toPersianNumber(list.data.items.length)} مورد.
        </p>
      )}
    </div>
  );
}
